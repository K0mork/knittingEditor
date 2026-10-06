import { describe, expect, it } from 'vitest';
import { strokeGrid, type GridArea } from './strokeGrid';

interface Stroke { color: string; width: number; horizontal: number[]; vertical: number[] }

/** 描いた線を、`stroke`ごとに色・太さと、横線のy座標・縦線のx座標として記録する。 */
function recordingContext() {
  const strokes: Stroke[] = [];
  let horizontal: number[] = [];
  let vertical: number[] = [];
  let start = [0, 0];
  const context = {
    strokeStyle: '', lineWidth: 0,
    beginPath() { horizontal = []; vertical = []; },
    moveTo(x: number, y: number) { start = [x, y]; },
    lineTo(x: number, y: number) {
      if (start[1] === y) horizontal.push(y);
      else if (start[0] === x) vertical.push(x);
    },
    stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, horizontal, vertical }); },
  };
  return { context: context as unknown as CanvasRenderingContext2D, strokes };
}

const minor = { color: '#minor', width: 1 };
const major = { color: '#major', width: 2 };

describe('strokeGrid', () => {
  it('draws major lines at the numbered tens of a board whose size is not a multiple of ten', () => {
    const { context, strokes } = recordingContext();
    const area: GridArea = { x: 100, y: 50, cell: 10, rows: 25, cols: 23, firstRow: 0, lastRow: 24, firstCol: 0, lastCol: 22 };
    strokeGrid(context, area, minor, major);
    const [thin, thick] = strokes;
    expect(thick).toMatchObject({ color: '#major', width: 2 });
    // 段番号10・20の境目は上端から15本目と5本目、目番号10・20の境目は左端から13本目と3本目。
    expect(thick.horizontal).toEqual([50 + 5 * 10, 50 + 15 * 10]);
    expect(thick.vertical).toEqual([100 + 3 * 10, 100 + 13 * 10]);
    // 残りの線は通常の線で、1pxの線は画素の中央に置く。
    expect(thin).toMatchObject({ color: '#minor', width: 1 });
    expect(thin.horizontal).toHaveLength(26 - 2);
    expect(thin.vertical).toHaveLength(24 - 2);
    expect(thin.horizontal[0]).toBe(50.5);
  });

  it('keeps the board-wide numbering for a scrolled view', () => {
    const { context, strokes } = recordingContext();
    // 100段の盤面の、上から35〜64段目だけが見えている。
    const area: GridArea = { x: 0, y: -350, cell: 10, rows: 100, cols: 5, firstRow: 35, lastRow: 64, firstCol: 0, lastCol: 4 };
    strokeGrid(context, area, minor, major);
    const [thin, thick] = strokes;
    expect(thin.horizontal).toHaveLength(31 - 3);
    // 見えている罫線は35〜65本目。そのうち番号60・50・40の境目（40・50・60本目）が太線。
    expect(thick.horizontal).toEqual([40, 50, 60].map((line) => -350 + line * 10));
    expect(thick.vertical).toEqual([]);
  });
});
