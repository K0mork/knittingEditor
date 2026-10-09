import { cellColor, cellStitchId, colorHex } from './Board';
import { STITCH_BY_ID } from '../stitches/catalog';

/** 色の一覧に出す上限。スマホ幅で4段ほどに収まり、糸の色数としても十分に多い。 */
export const USED_COLOR_LIMIT = 24;

export interface UsedColor {
  /** `0xRRGGBB`の色。 */
  color: number;
  /** `#rrggbb`の小文字表記。`<input type="color">`の値と同じ形。 */
  hex: string;
  /** その色で置いている記号の数。2目の記号も起点の1マスだけを数える。 */
  count: number;
}

export interface UsedColorSummary {
  /** 使っている記号の多い順。同数ならセル配列の先頭から先に見つかった順。 */
  colors: UsedColor[];
  /** 上限で切る前の色の数。 */
  total: number;
}

/**
 * 盤面のセル配列から、記号に使っている色を数える。
 *
 * セルには記号の起点にだけ値が入る。空のマス（0）と、保存色を使わず白で塗るセルは数えない。
 * 1000×1000の盤面でも配列を1回なめるだけで済むが、呼び出し側は盤面が変わったとき
 * （`revision`）だけ呼び直し、描画のたびには呼ばない。
 */
export function collectUsedColors(cells: Uint32Array, limit = USED_COLOR_LIMIT): UsedColorSummary {
  const counts = new Map<number, number>();
  // 同じ色が続くことが多いので、直前の色はMapを引かずに数える。
  let runColor = -1;
  let runCount = 0;
  for (let index = 0; index < cells.length; index++) {
    const value = cells[index];
    if (!value) continue;
    if (STITCH_BY_ID.get(cellStitchId(value))?.renderKind === 'whiteout') continue;
    const color = cellColor(value);
    if (color === runColor) { runCount += 1; continue; }
    if (runColor >= 0) counts.set(runColor, (counts.get(runColor) ?? 0) + runCount);
    if (!counts.has(color)) counts.set(color, 0);
    runColor = color;
    runCount = 1;
  }
  if (runColor >= 0) counts.set(runColor, (counts.get(runColor) ?? 0) + runCount);

  // Mapは最初に入れた順を保ち、sortは安定なので、同数の色は見つかった順に並ぶ。
  const colors = Array.from(counts, ([color, count]) => ({ color, hex: colorHex(color), count }))
    .sort((a, b) => b.count - a.count);
  return { colors: colors.slice(0, Math.max(0, limit)), total: colors.length };
}

/**
 * 読み上げ用のおおまかな色名。色見本は見た目でしか区別できないので、ラベルに添える。
 * 厳密な色名ではなく、糸の色を言い分けられる程度の系統名を返す。
 */
export function describeColor(color: number): string {
  const red = ((color >> 16) & 0xff) / 255;
  const green = ((color >> 8) & 0xff) / 255;
  const blue = (color & 0xff) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));

  if (lightness < 0.1) return '黒';
  if (lightness > 0.93) return '白';
  if (saturation < 0.15 || chroma < 0.08) {
    if (lightness < 0.25) return '黒';
    if (lightness > 0.85) return '白';
    return '灰色';
  }

  let hue: number;
  if (max === red) hue = ((green - blue) / chroma) % 6;
  else if (max === green) hue = (blue - red) / chroma + 2;
  else hue = (red - green) / chroma + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return lightness > 0.72 ? 'ピンク' : lightness < 0.3 ? '茶色' : '赤';
  if (hue < 45) return lightness < 0.4 ? '茶色' : lightness > 0.8 ? 'ベージュ' : 'オレンジ';
  if (hue < 70) return lightness < 0.35 ? '茶色' : '黄色';
  if (hue < 95) return '黄緑';
  if (hue < 165) return '緑';
  if (hue < 200) return lightness < 0.45 ? '青緑' : '水色';
  if (hue < 250) return lightness < 0.3 ? '紺' : '青';
  if (hue < 290) return '紫';
  return lightness > 0.6 ? 'ピンク' : '赤紫';
}

/** 色見本ボタンの読み上げラベル。例：「赤 #d33c32、記号12個」。 */
export function usedColorLabel(item: Pick<UsedColor, 'color' | 'hex' | 'count'>): string {
  return `${describeColor(item.color)} ${item.hex}、記号${item.count}個`;
}
