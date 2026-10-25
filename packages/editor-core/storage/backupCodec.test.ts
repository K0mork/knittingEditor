import { expect, it, vi } from 'vitest';
import { Gunzip, gzipSync, strToU8 } from 'fflate';
import { packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { bytesToBase64 } from '../util/base64';
import { decodeBackup, gunzipWithLimit } from './backupCodec';

it('stops a single gzip member at the size limit before consuming the whole input', () => {
  const compressed = gzipSync(new Uint8Array(8 * 1024 * 1024));
  const push = vi.spyOn(Gunzip.prototype, 'push');
  try {
    expect(() => gunzipWithLimit(compressed, 1024 * 1024)).toThrow('解凍後のバックアップが大きすぎます');
    expect(push.mock.calls.length).toBeLessThan(Math.ceil(compressed.length / 256));
    expect(push.mock.calls.every(([chunk]) => chunk.length <= 256)).toBe(true);
  } finally { push.mockRestore(); }
});

it('gives each restored chart its own exactly sized cell buffer', () => {
  const cells = bytesToBase64(new Uint8Array(Uint32Array.of(packCell(STITCH_BY_KEY.get('knit')!.id, 0x12_3456), 0).buffer));
  const chart = (name: string) => ({ name, rows: 1, cols: 2, cells });
  const restored = decodeBackup(gzipSync(strToU8(JSON.stringify({
    format: 'knitting-editor', version: 2, documents: [chart('一つ目'), chart('二つ目')], blocks: [],
  }))));
  const [first, second] = restored.documents;
  expect(first.cells).not.toBe(second.cells);
  expect(first.cells.byteLength).toBe(2 * Uint32Array.BYTES_PER_ELEMENT);
  new Uint32Array(first.cells)[1] = packCell(STITCH_BY_KEY.get('knit')!.id, 0);
  expect(Array.from(new Uint32Array(second.cells))).toEqual([packCell(STITCH_BY_KEY.get('knit')!.id, 0x12_3456), 0]);
});
