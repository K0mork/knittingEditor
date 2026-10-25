import { readFileSync } from 'node:fs';
import { pdfStreams } from '../../packages/editor-core/export/pdfStreams.test-helper';
import { expect, test } from './fixtures';

interface HeldPdfStart {
  /** trueの間に作ったWorkerは、起動の通知（ready）を`release`まで止める。 */
  armed: boolean;
  held: boolean;
  /** Workerへ送った盤面の要求ごとの、記号のあるセルの数。 */
  requests: number[];
  release: () => void;
}
type HeldPdfWindow = Window & { heldPdfStart: HeldPdfStart };

test('exports the board as it was when PDF export started even if undone while the worker starts', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
    const queued: Array<() => void> = [];
    const state: HeldPdfStart = { armed: false, held: false, requests: [], release: () => { queued.splice(0).forEach((deliver) => deliver()); } };
    (window as unknown as HeldPdfWindow).heldPdfStart = state;
    const Original = window.Worker;
    // Web版は先読みしたBlobのURLから起動するので、URLではなく作った時点で止める対象を決める。
    window.Worker = class extends Original {
      private readonly holdsReady = state.armed;
      set onmessage(handler: ((this: Worker, event: MessageEvent) => unknown) | null) {
        super.onmessage = handler && ((event: MessageEvent) => {
          if (this.holdsReady && event.data?.ready === true) {
            state.held = true;
            queued.push(() => handler.call(this, event));
            return;
          }
          handler.call(this, event);
        });
      }
      get onmessage() { return super.onmessage; }
      postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
        // 転送するとバッファが空になるので、送る前に数える。
        const cells = (message as { cells?: unknown } | null)?.cells;
        if (cells instanceof ArrayBuffer) state.requests.push(new Uint32Array(cells).filter((value) => value !== 0).length);
        super.postMessage(message, transfer as Transferable[]);
      }
    };
  });
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: Math.min(75, box!.width - 10), y: Math.min(75, box!.height - 10) } });
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);

  await page.getByRole('button', { name: '出力', exact: true }).click();
  await page.evaluate(() => { (window as unknown as HeldPdfWindow).heldPdfStart.armed = true; });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as HeldPdfWindow).heldPdfStart.held)).toBe(true);
  await expect(page.locator('.busy')).toHaveText('PDFを生成中');
  // Workerの起動を待つ間に、保存を始めた盤面の記号を元に戻す。
  await page.keyboard.press('Control+z');
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
  await page.evaluate(() => (window as unknown as HeldPdfWindow).heldPdfStart.release());

  const pdf = await download;
  expect(await pdf.failure()).toBeNull();
  expect(await page.evaluate(() => (window as unknown as HeldPdfWindow).heldPdfStart.requests)).toEqual([1]);
  // PDFにも、元に戻す前の記号が入っている。
  const commands = pdfStreams(readFileSync((await pdf.path())!)).join('\n');
  expect(commands).toMatch(/ cm \/S\d+ Do Q/);
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
});
