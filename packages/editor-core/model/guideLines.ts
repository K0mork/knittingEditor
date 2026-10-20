/** topは上端の段、bottomは矢印が向く下端の段。間隔は2段以上。 */
export interface GuideLine { readonly col: number; readonly top: number; readonly bottom: number }

/** 同じ列で重なる線を判定する。端だけの接触は含めない。 */
export function linesOverlap(a: GuideLine, b: GuideLine): boolean {
  return a.col === b.col && a.top < b.bottom && b.top < a.bottom;
}

/** 不正な線は捨て、先に受け入れた線と端だけが接する線は残す。 */
export function normalizeGuideLines(value: unknown, rows: number, cols: number): GuideLine[] {
  if (!Array.isArray(value)) return [];
  const lines: GuideLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { col, top, bottom } = item as GuideLine;
    if (![col, top, bottom].every(Number.isInteger) || col < 0 || col >= cols || top < 0 || bottom - top < 2 || bottom >= rows) continue;
    const line = { col, top, bottom };
    if (!lines.some((accepted) => linesOverlap(accepted, line))) lines.push(Object.freeze(line));
  }
  return lines;
}
