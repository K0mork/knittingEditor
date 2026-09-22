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
});
