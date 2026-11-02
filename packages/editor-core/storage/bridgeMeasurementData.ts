import { packCell } from '../model/Board';
import { STITCH_BY_ID } from '../stitches/catalog';
import type { ChartDocument } from './database';

// 実測gzip/Base64 bytes: N=1 3959865/5279820, N=4 15837799/21117068,
// N=8 31674947/42233264（日時のgzip差分は数byte）。N=16は上限で拒否される。
// Webの圧縮上限32 MiBを変えずに復元する。largeはネイティブ128 MiB近傍ではない。
export const BRIDGE_MEASUREMENT_COUNTS = { small: 1, medium: 4, large: 8 } as const;

/** 計測専用。固定seedの24bit色と1セル記号で圧縮しにくい有効な盤面を作る。 */
export function bridgeMeasurementDocument(index: number): ChartDocument {
  const stitch = [...STITCH_BY_ID.values()].find((item) => item.width === 1 && item.height === 1)!;
  const cells = new Uint32Array(1000 * 1000);
  let state = (0x6d2b79f5 + index) >>> 0;
  for (let i = 0; i < cells.length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    cells[i] = packCell(stitch.id, state & 0xffffff);
  }
  return {
    id: `bridge-measurement-${index}`, name: `ブリッジ計測${index + 1}`,
    rows: 1000, cols: 1000, cells: cells.buffer,
    createdAt: 1_700_000_000_000 + index, updatedAt: 1_700_000_000_000 + index,
  };
}
