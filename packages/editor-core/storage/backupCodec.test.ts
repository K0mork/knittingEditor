import { expect, it, vi } from 'vitest';
import { Gunzip, gzipSync, strToU8 } from 'fflate';
import { Board, packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { bytesToBase64 } from '../util/base64';
import { decodeBackup, encodeBackup, gunzipWithLimit } from './backupCodec';
import type { ChartDocument } from './database';

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

it('restores a full backup that holds a chart with overlapping symbols alongside an intact chart', () => {
  // #157の修正前に保存され得た、起点が重なった編み図。行優先で先に走査した起点を残す。
  const cross = packCell(STITCH_BY_KEY.get('right_cross')!.id, 0x33_6699);
  const knit = packCell(STITCH_BY_KEY.get('knit')!.id, 0xd3_3c32);
  const purl = packCell(STITCH_BY_KEY.get('purl')!.id, 0);
  const chart = (id: string, cells: Uint32Array): ChartDocument => ({
    id, name: id, rows: 2, cols: 3, cells: cells.slice().buffer, createdAt: 1, updatedAt: 2,
  });
  const overlapping = Uint32Array.of(cross, knit, 0, purl, cross, knit);
  const intact = Uint32Array.of(knit, 0, purl, 0, cross, 0);
  // 書き出しは保存されたままの盤面を検査せずに通す。
  const restored = decodeBackup(encodeBackup([chart('重なった編み図', overlapping), chart('正常な編み図', intact)], []));
  expect(restored.count).toBe(2);
  const [repaired, unchanged] = restored.documents;
  expect(repaired.name).toBe('重なった編み図（復元）');
  expect(Array.from(new Uint32Array(repaired.cells))).toEqual([cross, 0, 0, purl, cross, 0]);
  expect(Array.from(new Uint32Array(unchanged.cells))).toEqual(Array.from(intact));
  // 復元した盤面は、保存済みの盤面を読み込んだときと同じ内容になり、読み込みで変わらない。
  expect(Array.from(new Board(2, 3, overlapping).cells)).toEqual(Array.from(new Uint32Array(repaired.cells)));
  // 修復後の盤面は、もう一度書き出して復元しても変わらない。
  const again = decodeBackup(encodeBackup([repaired], []));
  expect(Array.from(new Uint32Array(again.documents[0].cells))).toEqual([cross, 0, 0, purl, cross, 0]);
});

it('still rejects stitches that run past the edge of a chart', () => {
  const cells = bytesToBase64(new Uint8Array(Uint32Array.of(0, packCell(STITCH_BY_KEY.get('right_cross')!.id, 0)).buffer));
  expect(() => decodeBackup(gzipSync(strToU8(JSON.stringify({
    format: 'knitting-editor', version: 2, documents: [{ name: 'はみ出し', rows: 1, cols: 2, cells }], blocks: [],
  }))))).toThrow('盤面データが破損しています');
});
