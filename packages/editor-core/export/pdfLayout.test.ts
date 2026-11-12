import { describe, expect, it } from 'vitest';
import { Board } from '../model/Board';
import { STITCHES } from '../stitches/catalog';
import { buildPdf } from './pdf.worker';
import { PDF_CREDIT_FOOTER, PDF_LEGEND_CELL_SIZE, PDF_LEGEND_ROW_PADDING, pdfLegendRows, pdfPageCount, pdfPageLayout, type PdfLayoutOptions } from './pdfLayout';

function pagesInPdf(rows: number, cols: number, options: PdfLayoutOptions, cells: ArrayBuffer = new Uint32Array(rows * cols).buffer): number {
  const pdf = buildPdf({ rows, cols, cells, ...options });
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

  it.each([
    [53, 37, 1], [54, 37, 2], [53, 38, 2], [54, 38, 4],
    [105, 71, 4], [106, 72, 9],
  ])('covers %i×%i without overlap-only pages (%i pages)', (rows, cols, expected) => {
    const options: PdfLayoutOptions = { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5 };
    const layout = pdfPageLayout(rows, cols, options);
    expect(layout.pageCount).toBe(expected);
    expect(pdfPageCount(rows, cols, options)).toBe(expected);
    expect(pagesInPdf(rows, cols, options)).toBe(expected);
    expect(layout.pageRows * layout.pageCols).toBe(expected);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        expect(layout.tiles.some((tile) => row >= tile.row && row < tile.row + tile.rows && col >= tile.col && col < tile.col + tile.cols)).toBe(true);
      }
    }
  });

  it('keeps one overlapping row and column between tiles', () => {
    const layout = pdfPageLayout(60, 40, { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5 });
    expect(layout.stepCols).toBe(layout.tileCols - 1);
    expect(layout.stepRows).toBe(layout.tileRows - 1);
    expect(layout.pageCount).toBe(layout.pageRows * layout.pageCols);
  });

  it('reserves room for the credit footer and shrinks the chart area', () => {
    const options: PdfLayoutOptions = { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5 };
    const without = pdfPageLayout(100, 20, options);
    const withCredit = pdfPageLayout(100, 20, { ...options, includeCredit: true });
    expect(without.footer).toBe(18);
    expect(withCredit.footer).toBe(PDF_CREDIT_FOOTER);
    expect(withCredit.tileRows).toBeLessThan(without.tileRows);
  });

  it.each([
    [49, 37, 1], [50, 37, 2],
  ])('fits %i×%i into the credit footer as %i tiled page(s)', (rows, cols, expected) => {
    const options: PdfLayoutOptions = { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5, includeCredit: true };
    const layout = pdfPageLayout(rows, cols, options);
    expect(layout.tileRows * layout.cellSize + layout.colLabelHeight * 2 + layout.footer).toBeLessThanOrEqual(layout.pageHeight - layout.margin * 2 + 1e-6);
    expect(layout.pageCount).toBe(expected);
    expect(pdfPageCount(rows, cols, options)).toBe(expected);
    expect(pagesInPdf(rows, cols, options)).toBe(expected);
  });

  it('fits the whole board on a single page without a footer', () => {
    const layout = pdfPageLayout(40, 30, { layout: 'single', orientation: 'portrait', cellMillimeters: 5 });
    expect(layout.footer).toBe(0);
    expect(layout.tiles).toEqual([{ row: 0, col: 0, rows: 40, cols: 30 }]);
    expect(layout.cellSize).toBeCloseTo(Math.min(layout.availableWidth / 30, layout.availableHeight / 40), 6);
  });

  it.each([
    ['single', false, 0], ['single', true, 24],
    ['tiled', false, 0], ['tiled', true, 0],
  ] as const)('reserves the title above the board only for a single page with annotations (%s, %s)', (layout, includeTitleAndLegend, titleHeight) => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const options: PdfLayoutOptions = { layout, orientation, cellMillimeters: 5, includeTitleAndLegend, legendCount: 1, legendHeights: [1] };
      const result = pdfPageLayout(20, 20, options);
      expect(result.titleHeight).toBe(titleHeight);
      // 一覧だけのページは、題名の高さを上余白の下に取ってから一覧を始める。
      expect(result.legendPageTop).toBe(result.pageHeight - result.margin - 24);
      const plain = pdfPageLayout(20, 20, { ...options, includeTitleAndLegend: false });
      const legendHeight = layout === 'single' && includeTitleAndLegend ? 16 + PDF_LEGEND_CELL_SIZE + PDF_LEGEND_ROW_PADDING : 0;
      expect(result.availableHeight).toBeCloseTo(plain.availableHeight - titleHeight - legendHeight, 6);
    }
  });

  it('fills each legend-only page between the title and the credit footer', () => {
    const options: PdfLayoutOptions = { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5, includeTitleAndLegend: true, includeCredit: true, legendCount: 300, legendHeights: Array<number>(300).fill(2) };
    const layout = pdfPageLayout(20, 20, options);
    // 一覧はクレジットのフッターの上で止まり、QRやURLと重ならない。
    const capacity = layout.legendPageTop - layout.margin - layout.footer;
    expect(layout.footer).toBe(PDF_CREDIT_FOOTER);
    expect(capacity).toBeLessThan(layout.legendPageTop - layout.margin);
    expect(pdfLegendRows(options, layout.pageWidth)[0].height).toBe(2 * PDF_LEGEND_CELL_SIZE + PDF_LEGEND_ROW_PADDING);
    expect(layout.legendPages.length).toBeGreaterThan(1);
    expect(pdfPageCount(20, 20, options)).toBe(layout.pageCount);
    layout.legendPages.forEach((rows, index) => {
      const used = rows.reduce((sum, row) => sum + row.height, 0);
      expect(used).toBeLessThanOrEqual(capacity);
      // 次のページへ送った行は、このページに入らなかった。
      const next = layout.legendPages[index + 1]?.[0];
      if (next) expect(used + next.height).toBeGreaterThan(capacity);
    });
    // クレジットを外すと、一覧は下余白まで使えるのでページ数は増えない。
    const withoutCredit = pdfPageLayout(20, 20, { ...options, includeCredit: false });
    expect(layout.legendPages.length).toBeGreaterThanOrEqual(withoutCredit.legendPages.length);
  });

  it('counts the pages of a tiled PDF whose legend uses its own page', () => {
    const glyphs = STITCHES.filter((stitch) => stitch.renderKind === 'glyph');
    const cols = glyphs.reduce((sum, stitch) => sum + stitch.width, 0) + 1;
    const board = new Board(2, cols);
    let col = 0;
    for (const stitch of glyphs) {
      expect(board.place(0, col, stitch.key, '#111111', false), stitch.key).toBe(true);
      col += stitch.width;
    }
    const options: PdfLayoutOptions = { layout: 'tiled', orientation: 'portrait', cellMillimeters: 5, includeTitleAndLegend: true, includeCredit: true,
      legendCount: glyphs.length, legendHeights: glyphs.map((stitch) => stitch.height) };
    const layout = pdfPageLayout(board.rows, board.cols, options);
    expect(layout.legendPages.length).toBeGreaterThan(0);
    expect(layout.pageCount).toBe(layout.tiles.length + layout.legendPages.length);
    expect(pdfPageCount(board.rows, board.cols, options)).toBe(layout.pageCount);
    expect(pagesInPdf(board.rows, board.cols, options, board.cells.buffer as ArrayBuffer)).toBe(layout.pageCount);
  });

  it.each(cases)('keeps the grid and its row and column numbers inside the page margins ($rows×$cols $options.layout $options.orientation $options.cellMillimeters mm)', ({ rows, cols, options }) => {
    const layout = pdfPageLayout(rows, cols, options);
    expect(layout.rowLabelWidth).toBeGreaterThan(0);
    expect(layout.colLabelHeight).toBeGreaterThan(0);
    for (const tile of layout.tiles) {
      expect(tile.cols * layout.cellSize + layout.rowLabelWidth * 2).toBeLessThanOrEqual(layout.pageWidth - layout.margin * 2 + 1e-6);
      expect(tile.rows * layout.cellSize + layout.colLabelHeight * 2 + layout.footer).toBeLessThanOrEqual(layout.pageHeight - layout.margin * 2 + 1e-6);
    }
  });
});

