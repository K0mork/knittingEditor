import { cellColor, cellStitchId, colorHex } from '../model/Board';
import { STITCH_BY_ID } from './catalog';
import { drawGlyph } from './glyphs';

/**
 * packed値1セル分の記号を描く。画面の盤面とPNG出力で共有する。
 * 「白くする」は記号ではなく白い塗りで表し、未知の記号IDは何も描かない。
 */
export function drawCell(context: CanvasRenderingContext2D, value: number, x: number, y: number, cellSize: number): void {
  const stitch = STITCH_BY_ID.get(cellStitchId(value));
  if (!stitch) return;
  if (stitch.renderKind === 'whiteout') {
    context.fillStyle = '#fff';
    context.fillRect(x, y, cellSize, cellSize);
    return;
  }
  drawGlyph(context, stitch.key, x, y, cellSize, colorHex(cellColor(value)));
}
