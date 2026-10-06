import { isMajorGridLine } from '../model/gridLines';

export interface GridLineStyle {
  color: string;
  width: number;
}

export interface GridArea {
  /** 盤面の左上（0段目・0目の角）の位置と、1セルの大きさ。 */
  x: number;
  y: number;
  cell: number;
  /** 盤面全体の段数・列数。太線の位置を番号に合わせるのに使う。 */
  rows: number;
  cols: number;
  /** 描くセルの範囲（両端を含む）。 */
  firstRow: number;
  lastRow: number;
  firstCol: number;
  lastCol: number;
}

/** 線の太さに合わせて画素の境目へそろえ、1pxの線がにじまないようにする。 */
function crisp(position: number, width: number): number {
  return Math.round(position) + (width % 2 === 1 ? 0.5 : 0);
}

/**
 * 罫線を描く。10目・10段ごとの太線（`isMajorGridLine`）は`major`、それ以外は`minor`で描く。
 * 太線をあとに描き、交点で太線が途切れないようにする。
 */
export function strokeGrid(context: CanvasRenderingContext2D, area: GridArea, minor: GridLineStyle, major: GridLineStyle): void {
  const left = area.x + area.firstCol * area.cell;
  const right = area.x + (area.lastCol + 1) * area.cell;
  const top = area.y + area.firstRow * area.cell;
  const bottom = area.y + (area.lastRow + 1) * area.cell;
  for (const [style, majorLines] of [[minor, false], [major, true]] as const) {
    context.beginPath();
    for (let row = area.firstRow; row <= area.lastRow + 1; row++) {
      if (isMajorGridLine(row, area.rows) !== majorLines) continue;
      const y = crisp(area.y + row * area.cell, style.width);
      context.moveTo(left, y);
      context.lineTo(right, y);
    }
    for (let col = area.firstCol; col <= area.lastCol + 1; col++) {
      if (isMajorGridLine(col, area.cols) !== majorLines) continue;
      const x = crisp(area.x + col * area.cell, style.width);
      context.moveTo(x, top);
      context.lineTo(x, bottom);
    }
    context.strokeStyle = style.color;
    context.lineWidth = style.width;
    context.stroke();
  }
}
