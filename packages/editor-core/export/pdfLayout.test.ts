import { describe, expect, it } from 'vitest';
import { buildPdf } from './pdf.worker';
import { pdfPageCount, pdfPageLayout, type PdfLayoutOptions } from './pdfLayout';

function pagesInPdf(rows: number, cols: number, options: PdfLayoutOptions): number {
  const pdf = buildPdf({ rows, cols, cells: new Uint32Array(rows * cols).buffer, ...options });
  const text = new TextDecoder('latin1').decode(pdf);
  return Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)![1]);
}

const cases: Array<{ rows: number; cols: number; options: PdfLayoutOptions }> = [
  { rows: 20, cols: 20, options: { layout: 'single', orientation: 'portrait', cellMillimeters: 5 } },
  { rows: 200, cols: 120, options: { layout: 'single', orientation: 'landscape', cellMillimeters: 5 } },
  { rows: 60, cols: 40, options: { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5 } },
  { rows: 60, cols: 40, options: { layout: 'tiled', orientation: 'landscape', cellMillimeters: 5 } },
  { rows: 300, cols: 300, options: { layout: 'tiled', orientation: 'portrait', cellMillimeters: 2 } },
  { rows: 300, cols: 300, options: { layout: 'tiled', orientation: 'landscape', cellMillimeters: 10 } },
  { rows: 1, cols: 1, options: { layout: 'tiled', orientation: 'portrait', cellMillimeters: 10 } },
];

describe('PDF page layout', () => {
  it.each(cases)('estimates the same page count the PDF actually contains ($rows×$cols $options.layout $options.orientation $options.cellMillimeters mm)', ({ rows, cols, options }) => {
    const estimated = pdfPageCount(rows, cols, options);
    expect(estimated).toBe(pdfPageLayout(rows, cols, options).pageCount);
    expect(estimated).toBe(pagesInPdf(rows, cols, options));
  });

  it('keeps one overlapping row and column between tiles', () => {
    const layout = pdfPageLayout(60, 40, { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5 });
    expect(layout.stepCols).toBe(layout.tileCols - 1);
    expect(layout.stepRows).toBe(layout.tileRows - 1);
    expect(layout.pageCount).toBe(layout.pageRows * layout.pageCols);
  });

  it('fits the whole board on a single page without a footer', () => {
    const layout = pdfPageLayout(40, 30, { layout: 'single', orientation: 'portrait', cellMillimeters: 5 });
    expect(layout.footer).toBe(0);
    expect(layout.tiles).toEqual([{ row: 0, col: 0, rows: 40, cols: 30 }]);
    expect(layout.cellSize).toBeCloseTo(Math.min(layout.availableWidth / 30, layout.availableHeight / 40), 6);
  });
});
