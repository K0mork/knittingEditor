import { expect, type Page } from './fixtures';

/** 固定座標で操作するテストの盤面を、設定パネルから指定の大きさにそろえる。 */
export async function resizeBoard(page: Page, rows: number, cols: number) {
  await page.getByRole('button', { name: '盤面', exact: true }).click();
  await page.getByLabel('段数', { exact: true }).fill(String(rows));
  await page.getByLabel('列数', { exact: true }).fill(String(cols));
  await page.getByRole('button', { name: '変更', exact: true }).click();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`${rows}段、${cols}目`));
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
}

/**
 * 端末内（IndexedDB）に保存された編み図の段数・列数と、記号を置いたマス（起点）の数を読む。
 * アプリの読み出し処理は通さず、保存の完了を外から確かめるために使う。
 */
export async function storedBoards(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ rows: number; cols: number; cells: ArrayBuffer }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      return documents.map(({ rows, cols, cells }) => ({ rows, cols, stitches: new Uint32Array(cells).filter((value) => value !== 0).length }));
    } finally { db.close(); }
  });
}

/**
 * 大きさを変えた盤面は変更前の表示位置を引き継ぐ。再読み込みの前後で同じ座標を押すテストは、
 * 保存を待ってから読み込み直し、指定の大きさの初期表示から始める。
 */
export async function resizeBoardFromInitialView(page: Page, rows: number, cols: number) {
  await resizeBoard(page, rows, cols);
  await expect.poll(async () => (await storedBoards(page)).map((board) => `${board.rows}x${board.cols}`)).toEqual([`${rows}x${cols}`]);
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`${rows}段、${cols}目`));
}

/**
 * 未保存の変更が残っていない（見出しの編み図名が「保存済み」を読み上げる）ことを待つ。
 * 未保存の変更があると再読み込みは`beforeunload`で止まるので、再読み込みの前に呼ぶ。
 * 直前の編集より前の保存を完了とみなさないよう、呼び出し側は保存内容もあわせて確かめる。
 */
export async function expectAutosaved(page: Page) {
  await expect(page.locator('.app-document-name')).toContainText('保存済み');
}

/** `packages/editor-core/state/useEditorSession.ts`の`AUTOSAVE_DELAY_MS`と同じ値にする。 */
const AUTOSAVE_DELAY_MS = 400;

interface AutosaveControl { delayed: number; release: () => void }
type AutosaveControlWindow = Window & { autosaveControl?: AutosaveControl };

/**
 * 自動保存のタイマー（`AUTOSAVE_DELAY_MS`で予約するもの）だけを延ばし、延ばした回数を数える。
 * `delay`を渡すとその時間まで延ばす。省くと`releaseAutosave`を呼ぶまで保存を始めない。
 * 処理速度によらず「保存より先に次の操作をする」状況を作るために使い、
 * 実際に延ばしたことは`expectAutosaveDelayed`で確かめる。読み込み直すと元に戻る。
 */
export async function delayAutosave(page: Page, delay?: number) {
  await page.evaluate(({ autosaveDelay, delay }) => {
    const original = window.setTimeout.bind(window);
    const originalClear = window.clearTimeout.bind(window);
    /** 保存を止めている間に予約されたタイマーと、そのとき呼ぶ処理。 */
    const held = new Map<number, () => void>();
    let released = false;
    const control: AutosaveControl = {
      delayed: 0,
      release: () => {
        released = true;
        for (const [id, run] of held) {
          originalClear(id);
          original(run, 0);
        }
        held.clear();
      },
    };
    (window as AutosaveControlWindow).autosaveControl = control;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout !== autosaveDelay || released || typeof handler !== 'function') return original(handler, timeout, ...args);
      control.delayed += 1;
      if (delay !== null) return original(handler, delay, ...args);
      const run = () => (handler as (...values: unknown[]) => void)(...args);
      // 解除するまで発火しないよう、設定できる最長の時間で予約しておく。
      const id = original(() => { held.delete(id); run(); }, 2 ** 31 - 1);
      held.set(id, run);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined) held.delete(id);
      originalClear(id);
    }) as typeof window.clearTimeout;
  }, { autosaveDelay: AUTOSAVE_DELAY_MS, delay: delay ?? null });
}

/** `delayAutosave`で止めた自動保存を始める。以後の自動保存は延ばさない。 */
export async function releaseAutosave(page: Page) {
  await page.evaluate(() => (window as AutosaveControlWindow).autosaveControl!.release());
}

/** 自動保存のタイマーを実際に延ばしたことを確かめる。値が変わって何も遅らせていない場合に失敗させる。 */
export async function expectAutosaveDelayed(page: Page) {
  const count = await page.evaluate(() => (window as AutosaveControlWindow).autosaveControl?.delayed ?? 0);
  expect(count, '延ばした自動保存のタイマー').toBeGreaterThan(0);
}
