import { parseColor } from '../model/Board';
import { isDarkColor } from '../model/boardColors';

export const guideLineColor = (background: string): string => isDarkColor(parseColor(background)) ? '#e6e6e6' : '#333333';

/** 点線と矢印の大きさ（マスに対する比率）。盤面・PNG・PDFで共通。線の太さは編み目記号の線と同じ。 */
export const GUIDE_LINE_SHAPE = {
  width: 0.09,
  dash: 0.14,
  gap: 0.1,
  arrowLength: 0.46,
  arrowHalfWidth: 0.26,
} as const;

/** 盤面とPNGで同じ比率の点線と矢印を描く。座標は両端のマスの縁。 */
export function drawGuideLine(context: CanvasRenderingContext2D, x: number, top: number, bottom: number, cell: number, background: string): void {
  if (bottom <= top) return;
  const arrow = cell * GUIDE_LINE_SHAPE.arrowLength;
  const halfWidth = cell * GUIDE_LINE_SHAPE.arrowHalfWidth;
  context.save();
  context.strokeStyle = guideLineColor(background);
  context.fillStyle = context.strokeStyle;
  context.lineWidth = cell * GUIDE_LINE_SHAPE.width;
  context.setLineDash([cell * GUIDE_LINE_SHAPE.dash, cell * GUIDE_LINE_SHAPE.gap]);
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x, bottom - arrow);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(x, bottom);
  context.lineTo(x - halfWidth, bottom - arrow);
  context.lineTo(x + halfWidth, bottom - arrow);
  context.closePath();
  context.fill();
  context.restore();
}
