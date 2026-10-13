import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { ExportControls } from './ExportControls';

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
    await act(async () => root.render(<ExportControls board={board} onPng={onPng} onPdf={onPdf}
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
