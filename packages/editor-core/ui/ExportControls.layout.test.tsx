import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { pdfPageCount } from '../export/pdfLayout';
import { ExportControls } from './ExportControls';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it('warns above 100 tiled pages, passes A4 landscape options, and clears the warning in single-page mode', async () => {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const board = new Board(1000, 1000);
  const onPdf = vi.fn();
  const warning = 'ページ数が多いため1ページ版もご検討ください';
  try {
    await act(async () => root.render(<ExportControls board={board} onPdf={onPdf} onPng={vi.fn()}
      onBackup={vi.fn()} onRestore={vi.fn()} backupNote="" />));
    const [layout, orientation] = container.querySelectorAll('select');
    const select = async (element: HTMLSelectElement, value: string) => {
      await act(async () => {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    expect(container.textContent).toContain('推定 1ページ');
    expect(container.textContent).not.toContain(warning);
    await select(layout, 'tiled');
    expect(container.textContent).toContain(warning);
    expect(orientation.querySelector('option[value="landscape"]')!.textContent).toBe('A4横');
    await select(orientation, 'landscape');
    const pages = pdfPageCount(1000, 1000, { layout: 'tiled', orientation: 'landscape', cellMillimeters: 5 });
    expect(pages).toBeGreaterThan(100);
    expect(container.textContent).toContain(`推定 ${pages}ページ`);
    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'PDFを保存')!.click());
    expect(onPdf).toHaveBeenCalledExactlyOnceWith({ layout: 'tiled', orientation: 'landscape', cellMillimeters: 5,
      includeTitleAndLegend: false, legendCount: 0, legendHeights: [] });
    await select(layout, 'single');
    expect(container.textContent).toContain('推定 1ページ');
    expect(container.textContent).not.toContain(warning);
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
