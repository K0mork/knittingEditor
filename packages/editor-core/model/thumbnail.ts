import { STITCHES } from '../stitches/catalog';
import { cellColor, cellStitchId, parseColor } from './Board';
import { backgroundColorOf, DEFAULT_BACKGROUND_COLOR } from './boardColors';

/**
 * 編み図一覧の縮小画像。ReactにもDOMにも依存しない。
 *
 * 一覧では記号を読ませるのではなく、どの編み図かを見分けられればよいので、各セルを記号の色で
 * 塗ったモザイクにする。記号が複数のセルにまたがるときは、占めるセルすべてを塗る。空きのセルは
 * 盤面の地の色、「白くする」は白。盤面が`THUMBNAIL_MAX_SIDE`を超えるときは、`step`×`step`セルを1画素に
 * まとめ、色を面積で平均する。1000×1000でも盤面を1回なめるだけで済み、記号の描画もしない。
 *
 * 保存はしない。IndexedDBの記録にも`.knit`にも縮小画像を持たせず、一覧を開いたときに保存済みの
 * セル配列から作る。保存形式が変わらないので、既存のデータとWeb版・iOS版の`.knit`の互換に
 * 影響しない。
 */

/** 縮小画像の長辺の画素数。一覧では長辺56〜64 CSS pxで表示するので、高密度の画面でも足りる。 */
export const THUMBNAIL_MAX_SIDE = 96;

const WHITE = 0xff_ffff;

export interface ChartThumbnail {
  /** 画素数。盤面の縦横比を保つ。 */
  width: number;
  height: number;
  /** 1画素にまとめた盤面の1辺のセル数。1なら1セルが1画素。 */
  step: number;
  /** RGBAの画素。`ImageData`へそのまま渡せる。 */
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

export function thumbnailSize(rows: number, cols: number): Pick<ChartThumbnail, 'width' | 'height' | 'step'> {
  const step = Math.max(1, Math.ceil(Math.max(rows, cols) / THUMBNAIL_MAX_SIDE));
  return { width: Math.max(1, Math.ceil(cols / step)), height: Math.max(1, Math.ceil(rows / step)), step };
}

interface StitchTable { width: Uint8Array; height: Uint8Array; whiteout: Uint8Array }
let stitchTable: StitchTable | undefined;

/** 記号IDから寸法を引く表。セルごとに`Map`を引くと1000×1000で目立って遅くなるので配列にする。 */
function stitches(): StitchTable {
  if (stitchTable) return stitchTable;
  const table: StitchTable = { width: new Uint8Array(256), height: new Uint8Array(256), whiteout: new Uint8Array(256) };
  for (const stitch of STITCHES) {
    table.width[stitch.id] = stitch.width;
    table.height[stitch.id] = stitch.height;
    table.whiteout[stitch.id] = stitch.renderKind === 'whiteout' ? 1 : 0;
  }
  stitchTable = table;
  return table;
}

/**
 * packed値のセル配列から縮小画像を作る。
 *
 * 記号IDだけを持つ旧形式のセル（色の無い値）は`boardFromDocument`と同じく黒の記号として読む。
 * 未知の記号と盤面からはみ出す記号は、`Board`が読み込むときと同じく描かない。
 */
export function renderThumbnail(rows: number, cols: number, cells: Uint32Array, background: string = DEFAULT_BACKGROUND_COLOR): ChartThumbnail {
  const { width, height, step } = thumbnailSize(rows, cols);
  const table = stitches();
  const red = new Uint32Array(width * height);
  const green = new Uint32Array(width * height);
  const blue = new Uint32Array(width * height);
  const covered = new Uint32Array(width * height);
  const total = Math.min(cells.length, rows * cols);
  for (let index = 0; index < total; index++) {
    const value = cells[index];
    if (!value) continue;
    let stitchId = cellStitchId(value);
    let color = cellColor(value);
    if (stitchId === 0) {
      // 旧形式：値そのものが記号ID。
      if (value > 0xff || !table.width[value]) continue;
      stitchId = value;
      color = 0;
    }
    const stitchWidth = table.width[stitchId];
    const stitchHeight = table.height[stitchId];
    if (!stitchWidth) continue;
    const row = Math.floor(index / cols);
    const col = index - row * cols;
    if (row + stitchHeight > rows || col + stitchWidth > cols) continue;
    if (table.whiteout[stitchId]) color = WHITE;
    const r = (color >>> 16) & 0xff;
    const g = (color >>> 8) & 0xff;
    const b = color & 0xff;
    for (let y = row; y < row + stitchHeight; y++) {
      const pixelRow = Math.floor(y / step) * width;
      for (let x = col; x < col + stitchWidth; x++) {
        const pixel = pixelRow + Math.floor(x / step);
        red[pixel] += r;
        green[pixel] += g;
        blue[pixel] += b;
        covered[pixel] += 1;
      }
    }
  }
  const ground = parseColor(background);
  const groundChannels = [(ground >>> 16) & 0xff, (ground >>> 8) & 0xff, ground & 0xff];
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < height; py++) {
    // 端の画素は盤面の残りだけを受け持つので、面積はstep×stepより小さいことがある。
    const spanY = Math.min(step, rows - py * step);
    for (let px = 0; px < width; px++) {
      const pixel = py * width + px;
      const area = spanY * Math.min(step, cols - px * step);
      // 壊れたデータで記号が重なっていても、面積を超えて数えない。
      const filled = Math.min(covered[pixel], area);
      const scale = covered[pixel] > 0 ? filled / covered[pixel] : 0;
      const empty = area - filled;
      const offset = pixel * 4;
      pixels[offset] = Math.round((red[pixel] * scale + empty * groundChannels[0]) / area);
      pixels[offset + 1] = Math.round((green[pixel] * scale + empty * groundChannels[1]) / area);
      pixels[offset + 2] = Math.round((blue[pixel] * scale + empty * groundChannels[2]) / area);
      pixels[offset + 3] = 255;
    }
  }
  return { width, height, step, pixels };
}

export interface ThumbnailSource {
  id: string;
  rows: number;
  cols: number;
  cells: ArrayBuffer;
  backgroundColor?: string;
  updatedAt: number;
}

/** 覚えておく縮小画像の上限。1件は最大96×96画素（約36KB）なので、上限でも数MBに収まる。 */
export const THUMBNAIL_CACHE_LIMIT = 200;

/**
 * 覚えておく項目。セル配列（`cells`）は持たない。一覧を読み直すたびにセル配列は新しい
 * ArrayBufferになるので、参照を持つと古いセル配列（1000×1000で1件4MB）を解放できなくなる。
 */
interface CachedThumbnail { rows: number; cols: number; background: string; updatedAt: number; thumbnail: ChartThumbnail }

/**
 * 編み図ごとに最後に作った縮小画像を覚える。一覧を開き直したり、別の編み図を保存して一覧が
 * 再描画されたりしても、寸法と更新日時が同じなら作り直さない。編集は自動保存で更新日時を
 * 変えるので、更新日時が同じならセルも同じとみなす。
 */
export class ThumbnailCache {
  private readonly entries = new Map<string, CachedThumbnail>();

  constructor(private readonly limit: number = THUMBNAIL_CACHE_LIMIT) {}

  get(source: ThumbnailSource): ChartThumbnail {
    const background = backgroundColorOf(source);
    const cached = this.entries.get(source.id);
    if (cached && cached.rows === source.rows && cached.cols === source.cols && cached.background === background && cached.updatedAt === source.updatedAt) {
      // 最近使った順に並べ直す。上限を超えたときは、いちばん長く使っていない項目から捨てる。
      this.entries.delete(source.id);
      this.entries.set(source.id, cached);
      return cached.thumbnail;
    }
    const thumbnail = renderThumbnail(source.rows, source.cols, new Uint32Array(source.cells, 0, Math.floor(source.cells.byteLength / 4)), background);
    this.entries.delete(source.id);
    this.entries.set(source.id, { rows: source.rows, cols: source.cols, background, updatedAt: source.updatedAt, thumbnail });
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return thumbnail;
  }

  /** 一覧から消えた編み図の分を捨てる。 */
  retain(ids: Iterable<string>): void {
    const keep = new Set(ids);
    for (const id of this.entries.keys()) if (!keep.has(id)) this.entries.delete(id);
  }

  has(id: string): boolean { return this.entries.has(id); }

  get size(): number { return this.entries.size; }
}
