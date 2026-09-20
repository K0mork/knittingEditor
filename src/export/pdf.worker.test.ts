import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import { packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { buildPdf, type PdfRequest } from './pdf.worker';

function request(rows: number, cols: number, dense: boolean): PdfRequest {
  const cells = new Uint32Array(rows * cols);
  if (dense) cells.fill(packCell(STITCH_BY_KEY.get('knit')!.id, 0x111111));
  const mask = new Uint8Array(128 * 128 / 8);
  mask.fill(0xaa);
  return {
    rows, cols, cells: cells.buffer,
    glyphs: [{ id: STITCH_BY_KEY.get('knit')!.id, width: 1, height: 1, size: 128, data: mask.buffer }],
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
    expect(text).toContain('/ImageMask true');
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
});
