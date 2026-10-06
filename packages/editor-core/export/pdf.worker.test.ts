import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { Board, packCell } from '../model/Board';
import { STITCHES, STITCH_BY_KEY } from '../stitches/catalog';
import { buildPdf, type PdfRequest } from './pdf.worker';
import { pdfPageLayout } from './pdfLayout';

function request(rows: number, cols: number, dense: boolean): PdfRequest {
  const cells = new Uint32Array(rows * cols);
  if (dense) cells.fill(packCell(STITCH_BY_KEY.get('knit')!.id, 0x111111));
  return {
    rows, cols, cells: cells.buffer,
    layout: 'single', orientation: 'portrait', cellMillimeters: 5,
  };
}

function decodedStreams(pdf: Uint8Array): string[] {
  const binary = Array.from(pdf, (byte) => String.fromCharCode(byte)).join('');
  const streams: string[] = [];
  const pattern = /\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g;
  for (const match of binary.matchAll(pattern)) {
    const start = match.index! + match[0].length;
    const length = Number(match[1]);
    try { streams.push(new TextDecoder().decode(unzlibSync(pdf.subarray(start, start + length)))); }
    catch { /* Image streams need not decode into text for this assertion. */ }
  }
  return streams;
}

/** ページの命令から、通常の罫線を除いた太線の横線のy座標と縦線のx座標を取り出す。 */
function majorGrid(page: string): { width: number; horizontal: number[]; vertical: number[] } {
  const match = page.match(/^([\d.]+) w 0\.4 G (.*)S$/m);
  if (!match) return { width: 0, horizontal: [], vertical: [] };
  const horizontal: number[] = [];
  const vertical: number[] = [];
  for (const [, x1, y1, x2, y2] of match[2].matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l/g)) {
    if (y1 === y2) horizontal.push(Number(y1));
    else if (x1 === x2) vertical.push(Number(x1));
  }
  return { width: Number(match[1]), horizontal, vertical };
}

const gridPages = (pdf: Uint8Array) => decodedStreams(pdf).filter((stream) => stream.includes('0.35 w 0.78 G'));

describe('PDF worker', () => {
  it('writes a syntactically structured PDF', () => {
    const pdf = buildPdf(request(20, 20, true));
    const text = new TextDecoder().decode(pdf);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    expect(text).toContain('/Subtype /Form');
    expect(text).not.toContain('/ImageMask true');
    expect(decodedStreams(pdf).join('\n')).toMatch(/50 12 m 50 88 l/);
  });

  it('keeps a dense one-million-cell PDF compact', () => {
    const started = performance.now();
    const pdf = buildPdf(request(1000, 1000, true));
    expect(pdf.byteLength).toBeLessThan(20_000_000);
    expect(performance.now() - started).toBeLessThan(15_000);
  }, 20_000);

  it('paints the white-out symbol in PDF instead of dropping it', () => {
    const input = request(1, 1, false);
    new Uint32Array(input.cells)[0] = packCell(STITCH_BY_KEY.get('erase')!.id, 0xffffff);
    const commands = decodedStreams(buildPdf(input)).join('\n');
    expect(commands).toMatch(/1 1 1 rg [\d.]+ [\d.]+ [\d.]+ [\d.]+ re f/);
  });

  it('references every persistent glyph in a combined PDF fixture', () => {
    const glyphs = STITCHES.filter((stitch) => stitch.renderKind === 'glyph');
    const cols = glyphs.reduce((sum, stitch) => sum + stitch.width, 0) + 1;
    const board = new Board(2, cols);
    let col = 0;
    for (const stitch of glyphs) {
      expect(board.place(0, col, stitch.key, '#123456', false), stitch.key).toBe(true);
      col += stitch.width;
    }
    expect(board.place(0, col, 'erase', '#ffffff', false)).toBe(true);

    const streams = decodedStreams(buildPdf({
      rows: board.rows, cols: board.cols, cells: board.cells.buffer as ArrayBuffer,
      layout: 'single', orientation: 'portrait', cellMillimeters: 5,
    })).join('\n');

    for (const stitch of glyphs) expect(streams).toContain(`/S${stitch.id} Do`);
    expect(streams).toMatch(/1 1 1 rg [\d.]+ [\d.]+ [\d.]+ [\d.]+ re f/);
  });

  it('numbers rows and columns on all four sides like the PNG output', () => {
    const commands = decodedStreams(buildPdf(request(20, 20, false))).join('\n');
    // 1〜20の番号が、目は上下、段は左右に1つずつで計4回ずつ現れる。
    for (const number of [1, 10, 20]) expect(commands.match(new RegExp(`\\(${number}\\) Tj`, 'g'))).toHaveLength(4);
    expect(commands).not.toContain('(21) Tj');
  });

  it('numbers each tiled page with the rows and columns on that page', () => {
    const pages = decodedStreams(buildPdf({ ...request(60, 40, false), layout: 'tiled' }))
      .filter((stream) => stream.includes(' Tj ET'));
    expect(pages.length).toBeGreaterThan(1);
    // 1ページ目は左上（最上段・左端の目）から始まる。
    expect(pages[0]).toContain('(60) Tj');
    expect(pages[0]).toContain('(40) Tj');
    expect(pages.at(-1)).toContain('(1) Tj');
  });

  it('thins the numbers on a large single-page chart instead of overlapping them', () => {
    const commands = decodedStreams(buildPdf(request(1000, 1000, false))).join('\n');
    expect(commands).toContain('(1000) Tj');
    expect(commands).toContain('(50) Tj');
    expect(commands).not.toContain('(49) Tj');
  });

  it('draws major lines at the numbered tens of a single-page chart', () => {
    const input = request(25, 23, false);
    const { pageHeight, margin, rowLabelWidth, colLabelHeight, cellSize } = pdfPageLayout(25, 23, input);
    const [page] = gridPages(buildPdf(input));
    const originX = margin + rowLabelWidth;
    const originY = pageHeight - margin - colLabelHeight - 25 * cellSize;
    const major = majorGrid(page);
    expect(major.width).toBeGreaterThan(0.35);
    // PDFの座標は下が0なので、段番号nの上の線は下端からnセル上、目番号nの左の線は右端からnセル左にある。
    expect(major.horizontal.map((y) => Math.round((y - originY) / cellSize))).toEqual([20, 10]);
    expect(major.vertical.map((x) => 23 - Math.round((x - originX) / cellSize))).toEqual([20, 10]);
  });

  it('aligns the major lines on every tiled page with the board-wide numbers', () => {
    // 段数・列数が10の倍数でないと、左上から数えた位置と番号の10の倍数がずれる。
    const [totalRows, totalCols] = [65, 43];
    const input: PdfRequest = { ...request(totalRows, totalCols, false), layout: 'tiled' };
    const { pageHeight, margin, rowLabelWidth, colLabelHeight, cellSize, tiles } = pdfPageLayout(totalRows, totalCols, input);
    const pages = gridPages(buildPdf(input));
    expect(pages).toHaveLength(tiles.length);
    expect(tiles.length).toBeGreaterThan(1);
    const rowNumbers = new Set<number>();
    const colNumbers = new Set<number>();
    tiles.forEach((tile, index) => {
      const originX = margin + rowLabelWidth;
      const originY = pageHeight - margin - colLabelHeight - tile.rows * cellSize;
      const major = majorGrid(pages[index]);
      // 線の位置を盤面全体の段番号・目番号に戻す。ページの中の番号の範囲にある10の倍数だけが太線になる。
      const rows = major.horizontal.map((y) => totalRows - tile.row - tile.rows + Math.round((y - originY) / cellSize));
      const cols = major.vertical.map((x) => totalCols - tile.col - Math.round((x - originX) / cellSize));
      const expectedRows = [10, 20, 30, 40, 50, 60].filter((number) => number <= totalRows - tile.row && number >= totalRows - tile.row - tile.rows);
      const expectedCols = [10, 20, 30, 40].filter((number) => number <= totalCols - tile.col && number >= totalCols - tile.col - tile.cols);
      expect(rows.sort((a, b) => a - b), `page ${index + 1} rows`).toEqual(expectedRows);
      expect(cols.sort((a, b) => a - b), `page ${index + 1} cols`).toEqual(expectedCols);
      rows.forEach((number) => rowNumbers.add(number));
      cols.forEach((number) => colNumbers.add(number));
    });
    expect([...rowNumbers].sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50, 60]);
    expect([...colNumbers].sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
  });
});
