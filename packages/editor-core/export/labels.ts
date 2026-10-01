/**
 * PNG・PDFの段・目番号の間引き。どちらも盤面の四辺に番号を書き、右下が1になる。
 */

/** 番号を間引くときの間隔。編み図で数えやすい5・10の倍数を優先する。 */
const LABEL_STRIDES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/**
 * 番号を何個おきに書くか。隣の番号と`gap`以上離れる最小の間隔を返す。
 * 間隔が1より大きいときは、その倍数の番号だけを書く（`showsLabel`）。
 */
export function labelStride(cellSize: number, labelExtent: number, gap: number): number {
  return LABEL_STRIDES.find((stride) => stride * cellSize >= labelExtent + gap) ?? LABEL_STRIDES[LABEL_STRIDES.length - 1];
}

export function showsLabel(number: number, stride: number): boolean {
  return number % stride === 0;
}
