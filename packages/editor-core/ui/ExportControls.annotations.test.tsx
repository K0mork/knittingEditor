import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as annotations from '../export/annotations';
import { validatePngSize } from '../export/exporters';
import { Board } from '../model/Board';
import { ExportControls, LEGEND_SETTLE_MS } from './ExportControls';

it('defaults the shared PNG/PDF annotation choice to off and passes it to both exports', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onPng = vi.fn();
  const onPdf = vi.fn();
  const board = new Board();
  board.place(0, 0, 'right_up_three_cross', '#111111', false);
  try {
    await act(async () => root.render(<ExportControls board={board} revision={0} onPng={onPng} onPdf={onPdf}
      onBackup={() => undefined} onRestore={() => undefined} backupNote="" />));
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const click = async (text: string) => {
      const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text)!;
      await act(async () => button.click());
    };
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(checkbox.checked).toBe(false);
    await click('PNGを保存');
    await click('PDFを保存');
    expect(onPng).toHaveBeenLastCalledWith(24, { includeTitleAndLegend: false, legendCount: 0, legendHeights: [] });
    expect(onPdf.mock.lastCall![0]).toMatchObject({ includeTitleAndLegend: false, legendCount: 0, legendHeights: [] });
    await act(async () => checkbox.click());
    await click('PNGを保存');
    await click('PDFを保存');
    expect(onPng).toHaveBeenLastCalledWith(24, { includeTitleAndLegend: true, legendCount: 1, legendHeights: [1] });
    expect(onPdf.mock.lastCall![0]).toMatchObject({ includeTitleAndLegend: true, legendCount: 1, legendHeights: [1] });
    expect(container.textContent).toContain('760×658px');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('recounts the legend of a 1000x1000 board only after edits settle, and from the live board on export', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const onPng = vi.fn();
  const onPdf = vi.fn();
  const board = new Board(1000, 1000);
  board.place(0, 0, 'knit', '#111111', false);
  const scans = vi.spyOn(annotations, 'exportLegend');
  const render = (revision: number, backupStatus?: string) => act(async () => root.render(<ExportControls board={board} revision={revision}
    onPng={onPng} onPdf={onPdf} onBackup={() => undefined} onRestore={() => undefined} backupStatus={backupStatus} backupNote="" />));
  const click = async (text: string) => {
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent === text)!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  };
  const sizeText = () => [...container.querySelectorAll('p')].find((item) => /^\d+×\d+px/.test(item.textContent ?? ''))!.textContent!;
  const cellSize = () => Number(container.querySelector<HTMLInputElement>('input[type="range"]')!.value);
  // 件数を渡さないと`validatePngSize`自身が一覧を数えるので、期待値は件数を指定して求める。
  const sizeWith = (legendCount: number) => {
    const size = validatePngSize(board, cellSize(), { includeTitleAndLegend: true, legendCount });
    return `${size.width}×${size.height}px`;
  };
  try {
    await render(0);
    expect(scans).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(scans).toHaveBeenCalledOnce();
    const before = sizeText();
    expect(before).toContain(sizeWith(1));

    // 盤面が変わらない再描画では数え直さない。
    await render(0, '最後のバックアップ: なし');
    expect(scans).toHaveBeenCalledOnce();

    // なぞり描きの間は、マスが変わるたびに版が進む。変更が続く間は数え直さない。
    for (const [index, key] of ['purl', 'yo', 'knit', 'purl'].entries()) {
      board.place(index + 1, 0, key, '#111111', false);
      await render(index + 1);
      await act(async () => { vi.advanceTimersByTime(LEGEND_SETTLE_MS - 1); });
    }
    expect(scans).toHaveBeenCalledOnce();
    expect(sizeText()).toBe(before);

    // 表示が追いつく前に押しても、出力には押した時点の盤面の一覧を渡す。
    await click('PNGを保存');
    await click('PDFを保存');
    const live = { includeTitleAndLegend: true, legendCount: 3, legendHeights: [1, 1, 1] };
    expect(onPng).toHaveBeenLastCalledWith(cellSize(), live);
    expect(onPdf.mock.lastCall![0]).toMatchObject(live);
    expect(scans).toHaveBeenCalledTimes(3);

    // 変更が止まると一度だけ数え直し、表示する寸法を合わせる。
    await act(async () => { vi.advanceTimersByTime(LEGEND_SETTLE_MS); });
    expect(scans).toHaveBeenCalledTimes(4);
    expect(sizeText()).not.toBe(before);
    expect(sizeText()).toContain(sizeWith(3));
  } finally {
    scans.mockRestore();
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  }
});
