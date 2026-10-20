import { parseColor } from '../model/Board';
import { isDarkColor } from '../model/boardColors';

export const guideLineColor = (background: string): string => isDarkColor(parseColor(background)) ? '#e6e6e6' : '#333333';

/** 盤面とPNGで同じ比率の細い点線と矢印を描く。座標は両端のマスの縁。 */
export function drawGuideLine(context: CanvasRenderingContext2D, x: number, top: number, bottom: number, cell: number, background: string): void {
  if (bottom <= top) return;
  const arrow = cell * 0.18;
  context.save();
  context.strokeStyle = guideLineColor(background);
  context.fillStyle = context.strokeStyle;
  context.lineWidth = cell * 0.045;
  context.setLineDash([cell * 0.09, cell * 0.1]);
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x, bottom - arrow);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(x, bottom);
  context.lineTo(x - arrow * 0.55, bottom - arrow);
  context.lineTo(x + arrow * 0.55, bottom - arrow);
  context.closePath();
  context.fill();
  context.restore();
}
