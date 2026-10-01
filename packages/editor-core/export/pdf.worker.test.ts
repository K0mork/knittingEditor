import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { Board, packCell } from '../model/Board';
import { STITCHES, STITCH_BY_KEY } from '../stitches/catalog';
import { buildPdf, type PdfRequest } from './pdf.worker';

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
});

