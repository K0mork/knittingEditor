import interopFixture from '../../../ios/test-fixtures/knitting-editor-v2-interop.knit.b64?raw';
import { base64ToBytes, bytesToBase64 } from '../util/base64';
import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { Board, packCell } from '../model/Board';
import { decodeBackup, encodeBackup } from '../storage/backupCodec';
import { STITCH_BY_KEY, STITCH_CATALOG_VERSION } from './catalog';
import { drawCell } from './drawCell';
import { getGlyphDefinition, glyphPdfCommands } from './glyphs';

const additions = [
  ['right_increase', 27, '右増し目', 1, 1, 2, 'JIS 2090'],
  ['left_increase', 28, '左増し目', 1, 1, 2, 'JIS 2100'],
  ['float_stitch', 29, '浮き目', 2, 1, 1, 'JIS 2170'],
] as const;

describe('increase and float stitches', () => {
  it('pins the new catalog version and metadata', () => {
    expect(STITCH_CATALOG_VERSION).toBe(4);
    for (const [key, id, name, height, consumes, produces, standardReference] of additions) {
      expect(STITCH_BY_KEY.get(key)).toMatchObject({
        id, key, name, width: 1, height, consumes, produces, category: 'basic', standardStatus: 'jis', standardReference,
      });
    }
  });

  it('uses mirrored branches for increases and a front yarn bar for float', () => {
    expect(getGlyphDefinition('right_increase')!.primitives).toEqual([
      { kind: 'line', from: { x: 28, y: 12 }, to: { x: 28, y: 88 } },
      { kind: 'line', from: { x: 28, y: 50 }, to: { x: 78, y: 16 } },
    ]);
    expect(getGlyphDefinition('left_increase')!.primitives).toEqual([
      { kind: 'line', from: { x: 72, y: 12 }, to: { x: 72, y: 88 } },
      { kind: 'line', from: { x: 72, y: 50 }, to: { x: 22, y: 16 } },
    ]);
    expect(getGlyphDefinition('float_stitch')!.primitives).toEqual([
      ...getGlyphDefinition('slip_stitch')!.primitives,
      { kind: 'line', from: { x: 8, y: 80 }, to: { x: 92, y: 80 } },
    ]);
  });

  it.each(additions)('draws %s on the board/PNG and PDF using the same geometry', (key, id) => {
    const context = {
      save: vi.fn(), translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawCell(context, packCell(id, 0x123456), 10, 20, 30);
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.strokeStyle).toBe('#123456');
    const primitives = getGlyphDefinition(key)!.primitives;
    const lines = primitives.flatMap((primitive) => primitive.kind === 'line' ? [primitive.from, primitive.to] : primitive.kind === 'polyline' ? primitive.points : []);
    expect(context.moveTo).toHaveBeenCalledWith(lines[0].x, lines[0].y);
    for (const point of lines.slice(1)) {
      expect(glyphPdfCommands(key)!.commands).toContain(`${point.x} ${point.y}`);
    }
    expect(STITCH_BY_KEY.get(key)!.svg).toContain('<svg');
  });

  it('round-trips all new IDs, colors and footprints with v4 metadata', () => {
    const board = new Board(2, 3);
    additions.forEach(([key], col) => expect(board.place(0, col, key, '#123456', false)).toBe(true));
    expect(board.ownerAt(1, 2)).toBe(board.ownerAt(0, 2));
    const encoded = encodeBackup([{ id: 'fixture', name: '追加記号', rows: 2, cols: 3, cells: board.cells.buffer as ArrayBuffer, createdAt: 0, updatedAt: 0 }], []);
    expect(JSON.parse(strFromU8(gunzipSync(encoded))).stitchCatalogVersion).toBe(4);
    expect(new Uint32Array(decodeBackup(encoded).documents[0].cells)).toEqual(board.cells);
  });

  it('reads the unchanged committed legacy fixture and v3 packed IDs', () => {
    expect([...new Uint32Array(decodeBackup(base64ToBytes(interopFixture.trim())).documents[0].cells)]).toEqual([1, 2, 3, 4, 5, 6]);
    const values = new Uint32Array([packCell(26, 0x123456), 0]);
    const fixture = gzipSync(strToU8(JSON.stringify({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [{ name: 'v3', rows: 1, cols: 2, cells: bytesToBase64(new Uint8Array(values.buffer)) }], blocks: [],
    })));
    expect(new Uint32Array(decodeBackup(fixture).documents[0].cells)).toEqual(values);
  });

  it('continues rejecting backups from a newer catalog', () => {
    const fixture = gzipSync(strToU8(JSON.stringify({ format: 'knitting-editor', version: 2, stitchCatalogVersion: 5, documents: [], blocks: [] })));
    expect(() => decodeBackup(fixture)).toThrow('新しい記号カタログ');
  });
});
