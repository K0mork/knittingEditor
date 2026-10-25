import { afterEach, describe, expect, it, vi } from 'vitest';
import { STITCHES } from '../stitches/catalog';
import { Board } from '../model/Board';
import { usedStitches } from './annotations';
import { renderPng, validatePngSize } from './exporters';
import { buildPdf, pdfJapaneseTextWidth, pdfJapaneseText, pdfPageRange, type PdfRequest } from './pdf.worker';
import { pdfLegendRows, pdfPageCount, pdfPageLayout } from './pdfLayout';
import { pdfStreams } from './pdfStreams.test-helper';

const streams = (pdf: Uint8Array): string => pdfStreams(pdf).join('');

function sample() {
  const board = new Board(20, 20);
  board.place(0, 0, 'right_up_three_cross', '#111111', false);
  board.place(1, 0, 'right_up_three_cross', '#ff0000', false);
  board.place(2, 0, 'purl', '#111111', false);
  board.place(3, 0, 'erase', '#ffffff', false);
  return board;
}

function request(board: Board): PdfRequest {
  return { rows: board.rows, cols: board.cols, cells: board.cells.buffer as ArrayBuffer, layout: 'single', orientation: 'portrait', cellMillimeters: 5 };
}

const hex = (text: string) => pdfJapaneseText(text, 0, 0).match(/<([^>]+)>/)![1];

describe('export title and legend', () => {
  afterEach(() => vi.restoreAllMocks());

  it('includes only used glyphs in catalog order, each multi-cell stitch once regardless of color', () => {
    expect(usedStitches(sample().cells).map((stitch) => stitch.name)).toEqual(['裏目', '右上3目交差']);
    expect(usedStitches(new Board().cells)).toEqual([]);
  });

  it('preserves PNG dimensions when off, and reserves title and legend space when on', () => {
    const board = sample();
    expect(validatePngSize(board, 24)).toEqual(validatePngSize(board, 24, { includeTitleAndLegend: false, title: '模様' }));
    expect(validatePngSize(board, 24)).toMatchObject({ width: 528, height: 528, valid: true });
    expect(validatePngSize(board, 24, { includeTitleAndLegend: true })).toMatchObject({ width: 760, height: 658, valid: true });
    expect(validatePngSize(new Board(1000, 1000), 16, { includeTitleAndLegend: true }).valid).toBe(false);
  });

  it('draws PNG title and used names only when enabled, keeping off commands identical', async () => {
    const calls: unknown[][] = [];
    const context = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => calls.push([name, ...args]), set: () => true });
    vi.spyOn(document, 'createElement').mockImplementation(() => ({
      getContext: () => context, toBlob: (callback: BlobCallback) => callback(new Blob(['png'])),
    }) as unknown as HTMLCanvasElement);
    const board = sample();
    await renderPng(board, 24);
    const original = calls.slice();
    calls.length = 0;
    await renderPng(board, 24, undefined, { includeTitleAndLegend: false, title: 'テスト模様' });
    expect(calls).toEqual(original);
    calls.length = 0;
    await renderPng(board, 24, undefined, { includeTitleAndLegend: true, title: 'テスト模様' });
    const texts = calls.filter((call) => call[0] === 'fillText').map((call) => call[1]);
    expect(texts).toContain('テスト模様');
    expect(texts).toContain('裏目');
    expect(texts.filter((text) => text === '右上3目交差')).toHaveLength(1);
    expect(texts).not.toContain('白くする');
    expect(texts).not.toContain('表目');
    // 盤面は拡張された画像の中央。凡例は24pxの6マス枠、名前は行の中央。
    expect(calls).toContainEqual(['fillRect', 140, 64, 480, 24]);
    expect(calls).toContainEqual(['moveTo', 392.5, 586]);
    expect(calls).toContainEqual(['lineTo', 392.5, 610]);
    expect(calls).toContainEqual(['fillText', '右上3目交差', 548, 598, 200]);
  });

  it('gives ASCII half-width advances in the Japanese font, including option-off footers', () => {
    const input = { ...request(new Board(65, 43)), layout: 'tiled' as const };
    const pdf = buildPdf(input);
    expect(new TextDecoder().decode(pdf)).toContain('/DW 1000 /W [231 325 500]');
    expect(new TextDecoder().decode(pdf)).toContain('/Encoding /UniJIS-UCS2-HW-H');
    const layout = pdfPageLayout(input.rows, input.cols, input);
    const footer = pdfPageRange(input, layout.tiles[0], 0, layout.pageCount);
    const asciiCount = [...footer].filter((character) => /^[ -~]$/.test(character)).length;
    expect(pdfJapaneseTextWidth(footer)).toBe((footer.length - asciiCount / 2) * 8);
    expect(pdfJapaneseTextWidth(footer)).toBeLessThan(layout.pageWidth - layout.margin * 2);
    expect(streams(pdf)).toContain(pdfJapaneseText(footer, layout.margin, 10));
    expect(pdfJapaneseTextWidth('Aran 2026')).toBe(36);
  });

  it('frames PDF legend cells at 12pt and centers one-row and two-row names', () => {
    const board = new Board(20, 20);
    board.place(0, 0, 'knit', '#111111', false);
    board.place(2, 0, 'slip_stitch', '#111111', false);
    const input = { ...request(board), includeTitleAndLegend: true, legendCount: 2, legendHeights: [1, 2] };
    const layout = pdfPageLayout(board.rows, board.cols, input);
    const bottom = layout.pageHeight - layout.margin - 24 - layout.colLabelHeight - board.rows * layout.cellSize;
    const center = bottom - layout.colLabelHeight - 8 - 12;
    const commands = streams(buildPdf(input));
    expect(commands).toContain(`24.000 ${(center - 6).toFixed(3)} m 36.000 ${(center - 6).toFixed(3)} l`);
    expect(commands).toContain(pdfJapaneseText('表目', 108, center - 8 * (0.752 - 0.221) / 2));
    expect(commands).toContain(pdfJapaneseText('すべり目', 108 + (layout.pageWidth - layout.margin * 2) / 3, center - 8 * (0.752 - 0.221) / 2));
  });

  it('starts a legend-only page at the layout top below the title', () => {
    const board = new Board(20, 20);
    board.place(0, 0, 'knit', '#111111', false);
    const input = { ...request(board), layout: 'tiled' as const, includeTitleAndLegend: true, title: '一覧', legendCount: 1, legendHeights: [1] };
    const layout = pdfPageLayout(board.rows, board.cols, input);
    expect(layout.legendPages).toHaveLength(1);
    const legendPage = pdfStreams(buildPdf(input)).at(-1)!;
    // 1段の記号の行は20pt。余白8ptを除いた12ptの枠の上端を、一覧の始まりにそろえる。
    const top = layout.legendPageTop;
    expect(legendPage).toContain(`24.000 ${top.toFixed(3)} m 36.000 ${top.toFixed(3)} l 24.000 ${(top - 12).toFixed(3)} m 36.000 ${(top - 12).toFixed(3)} l`);
    expect(legendPage).toContain(pdfJapaneseText('表目', 108, top - 6 - 8 * (0.752 - 0.221) / 2));
    expect(legendPage).toContain(pdfJapaneseText('一覧', layout.margin, layout.pageHeight - layout.margin - 16, 14));
  });

  it.each(['single', 'tiled'] as const)('includes PDF title, names and legend glyphs in %s mode only when on', (layout) => {
    const input = { ...request(sample()), layout };
    const off = buildPdf(input);
    expect(buildPdf({ ...input, includeTitleAndLegend: false, title: 'テスト模様' })).toEqual(off);
    expect(streams(off)).not.toContain(hex('テスト模様'));
    const on = streams(buildPdf({ ...input, includeTitleAndLegend: true, title: 'テスト模様' }));
    expect(on).toContain(hex('テスト模様'));
    expect(on).toContain(hex('裏目'));
    expect(on.match(new RegExp(hex('右上3目交差'), 'g'))).toHaveLength(1);
    expect(on).not.toContain(hex('表目'));
    expect(on).not.toContain(hex('白くする'));
    expect(on).toContain('/S20 Do');
  });

  it.each([false, true])('uses Japanese page ranges with annotation mode %s', (includeTitleAndLegend) => {
    const input = { ...request(new Board(65, 43)), layout: 'tiled' as const, includeTitleAndLegend };
    const { tiles, pageCount } = pdfPageLayout(input.rows, input.cols, input);
    const commands = streams(buildPdf(input));
    tiles.forEach((tile, index) => expect(commands).toContain(hex(pdfPageRange(input, tile, index, pageCount))));
    expect(pdfPageRange(input, tiles[0], 0, tiles.length)).toMatch(/^1\/\d+ページ　段\d+〜65　目\d+〜43$/);
    expect(commands).not.toContain('Page ');
    expect(commands).not.toContain('Rows ');
  });

  it.each(['portrait', 'landscape'] as const)('keeps estimated and generated page counts aligned with all legend entries (%s)', (orientation) => {
    const board = new Board(100, 60);
    // 全記号を重ならない起点に置く。
    let row = 0;
    for (const stitch of STITCHES.filter((stitch) => stitch.renderKind === 'glyph')) board.place(row++ * 2, 0, stitch.key, '#111111', false);
    const input = { ...request(board), layout: 'tiled' as const, orientation, includeTitleAndLegend: true, legendCount: usedStitches(board.cells).length, legendHeights: usedStitches(board.cells).map((stitch) => stitch.height) };
    const layout = pdfPageLayout(board.rows, board.cols, input);
    expect(layout.pageCount).toBe(pdfPageCount(board.rows, board.cols, input));
    const off = pdfPageLayout(board.rows, board.cols, { ...input, includeTitleAndLegend: false });
    expect(layout.tiles).toEqual(off.tiles);
    expect(layout.availableHeight).toBe(off.availableHeight);
    expect(layout.legendPages).toHaveLength(1);
    expect(layout.pageCount).toBe(off.pageCount + 1);
    expect(new TextDecoder().decode(buildPdf(input))).toContain(`/Count ${layout.pageCount} >>`);
    expect(layout.availableHeight).toBeGreaterThan(0);
    expect(layout.tiles.every((tile) => tile.rows * layout.cellSize <= layout.availableHeight)).toBe(true);
    expect(pdfPageCount(board.rows, board.cols, { ...input, layout: 'single' })).toBe(1);
  });
  it('uses three/four columns and reserves 32pt only for rows containing two-tall stitches', () => {
    const options = { includeTitleAndLegend: true, legendCount: 7, legendHeights: [1, 1, 1, 2, 1, 1, 1] };
    expect(pdfLegendRows(options, 595.28).map((row) => row.height)).toEqual([20, 32, 20]);
    expect(pdfLegendRows(options, 841.89).map((row) => row.height)).toEqual([32, 20]);
    const many = { ...options, layout: 'tiled' as const, orientation: 'landscape' as const, cellMillimeters: 5, legendCount: 120, legendHeights: Array<number>(120).fill(2) };
    const layout = pdfPageLayout(20, 20, many);
    expect(layout.legendPages).toHaveLength(2);
    expect(layout.legendPages.flat()).toHaveLength(30);
    expect(pdfPageCount(20, 20, many)).toBe(layout.tiles.length + 2);
  });

  it.each([3, 5, 10])('preserves tiled board commands and appends the legend once at %s mm', (cellMillimeters) => {
    const board = sample();
    const input = { ...request(board), layout: 'tiled' as const, orientation: 'landscape' as const, cellMillimeters };
    const options = { ...input, includeTitleAndLegend: true, title: 'Aran セーター 2026 WMwm', legendCount: 2, legendHeights: [1, 1] };
    const off = pdfPageLayout(board.rows, board.cols, input);
    const on = pdfPageLayout(board.rows, board.cols, options);
    expect(on.tiles).toEqual(off.tiles);
    expect(on.pageCount).toBe(off.pageCount + 1);
    expect(pdfPageCount(board.rows, board.cols, options)).toBe(on.pageCount);
    const pdf = buildPdf(options);
    expect(new TextDecoder().decode(pdf)).toContain(`/Count ${on.pageCount} >>`);
    const commands = streams(pdf);
    expect(commands.match(new RegExp(hex('裏目'), 'g'))).toHaveLength(1);
    expect(commands.match(new RegExp(hex(options.title), 'g'))).toHaveLength(on.pageCount);
    // 既存上余白で題名を描き、上側番号の位置を動かさない。
    expect(commands).toContain(pdfJapaneseText(options.title, on.margin, on.pageHeight - 18, 9));
    expect(commands).toContain(pdfJapaneseText(`${on.pageCount}/${on.pageCount}ページ`, on.margin, 10));
    const offCommands = streams(buildPdf(input));
    const grid = `${(on.margin + on.rowLabelWidth).toFixed(3)} ${(on.pageHeight - on.margin - on.colLabelHeight).toFixed(3)} m`;
    expect(offCommands).toContain(grid);
    expect(commands).toContain(grid);
  });

  it.each(['portrait', 'landscape'] as const)('omits tiled legend pages for empty and erase-only boards (%s)', (orientation) => {
    for (const eraseOnly of [false, true]) {
      const board = new Board(65, 43);
      if (eraseOnly) board.place(0, 0, 'erase', '#ffffff', false);
      for (const cellMillimeters of [3, 5, 10]) {
        const input = { ...request(board), layout: 'tiled' as const, orientation, cellMillimeters };
        const options = { ...input, includeTitleAndLegend: true, title: '空の編み図', legendCount: usedStitches(board.cells).length, legendHeights: [] };
        const off = pdfPageLayout(board.rows, board.cols, input);
        const on = pdfPageLayout(board.rows, board.cols, options);
        expect(on.legendPages).toEqual([]);
        expect(on.tiles).toEqual(off.tiles);
        expect(on.pageCount).toBe(off.pageCount);
        expect(pdfPageCount(board.rows, board.cols, options)).toBe(off.pageCount);
        const pdf = buildPdf(options);
        expect(new TextDecoder().decode(pdf)).toContain(`/Count ${off.pageCount} >>`);
        expect(streams(pdf).match(new RegExp(hex(options.title), 'g'))).toHaveLength(off.pageCount);
      }
    }
  });

});

