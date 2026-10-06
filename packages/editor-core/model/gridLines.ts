/**
 * 10目・10段ごとの太線の位置。画面・PNG・PDFで同じ規則を使う。
 *
 * 段・目の番号は右下から数える（段は下から、目は右から）。太線は番号の10・20・30…と
 * その次の番号との境目に引くので、盤面の左上から数えた位置とは一致しない。
 * 盤面の外枠は通常の線のままにする。
 */

export const MAJOR_GRID_INTERVAL = 10;

/**
 * 盤面の上端（左端）から数えて`line`本目の罫線（0〜`total`）が太線か。
 * `total`は段数または列数。`line`本目の罫線は、番号`total - line`と`total - line + 1`の境目にある。
 */
export function isMajorGridLine(line: number, total: number): boolean {
  const number = total - line;
  return number > 0 && number < total && number % MAJOR_GRID_INTERVAL === 0;
}

/**
 * 上端（左端）から`start`段目（目）から`count`段（目）の範囲で、太線を引く罫線の位置を返す。
 * 位置は範囲の上端（左端）の罫線を0とした値で、0〜`count`に入る。A4分割のPDFでは
 * ページごとに数え直さず、盤面全体の番号に合わせる。
 */
export function majorGridLines(total: number, start = 0, count = total - start): number[] {
  const lines: number[] = [];
  for (let local = 0; local <= count; local++) {
    if (isMajorGridLine(start + local, total)) lines.push(local);
  }
  return lines;
}
