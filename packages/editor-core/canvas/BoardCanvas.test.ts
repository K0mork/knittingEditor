import { describe, expect, it } from 'vitest';
import { STITCHES } from '../stitches/catalog';
import { clampViewport, glyphSearchStart, LABEL_SIZE, LIGHT_CANVAS_CHROME, readCanvasChrome } from './BoardCanvas';

describe('glyphSearchStart', () => {
  it('includes off-screen anchors whose multi-cell glyph overlaps the viewport', () => {
    const maxWidth = Math.max(...STITCHES.map((stitch) => stitch.width));
    const maxHeight = Math.max(...STITCHES.map((stitch) => stitch.height));

    expect(glyphSearchStart(8, 9)).toEqual({
      row: 8 - maxHeight + 1,
      col: 9 - maxWidth + 1,
    });
    expect(glyphSearchStart(0, 0)).toEqual({ row: 0, col: 0 });
  });
});

describe('clampViewport', () => {
  // 表示領域は番号の帯を除いた400×300。中央は(LABEL_SIZE + 200, LABEL_SIZE + 150)。
  const canvas = { width: LABEL_SIZE + 400, height: LABEL_SIZE + 300 };
  const centerX = LABEL_SIZE + 200;
  const centerY = LABEL_SIZE + 150;
  const board = { rows: 50, cols: 40 };

  it('keeps a position that is already within range', () => {
    const view = { x: 0, y: 0, cell: 20 };
    expect(clampViewport(view, board, canvas)).toBe(view);
  });

  it('stops when the top-left cell reaches the center of the visible area', () => {
    const view = clampViewport({ x: 10_000, y: 10_000, cell: 20 }, board, canvas);
    expect(view.x + 0.5 * view.cell).toBe(centerX);
    expect(view.y + 0.5 * view.cell).toBe(centerY);
  });

  it('stops when the bottom-right cell reaches the center of the visible area', () => {
    const view = clampViewport({ x: -10_000, y: -10_000, cell: 20 }, board, canvas);
    expect(view.x + (board.cols - 0.5) * view.cell).toBe(centerX);
    expect(view.y + (board.rows - 0.5) * view.cell).toBe(centerY);
  });

  it('lets a board smaller than the visible area move until either edge cell reaches the center', () => {
    const small = { rows: 3, cols: 2 };
    const right = clampViewport({ x: 10_000, y: 10_000, cell: 20 }, small, canvas);
    expect(right).toEqual({ x: centerX - 10, y: centerY - 10, cell: 20 });
    const left = clampViewport({ x: -10_000, y: -10_000, cell: 20 }, small, canvas);
    expect(left).toEqual({ x: centerX - 30, y: centerY - 50, cell: 20 });
    // 範囲の内側なら、画面の端へ寄せたりせずにそのまま置ける。
    const inside = { x: centerX - 20, y: centerY - 30, cell: 20 };
    expect(clampViewport(inside, small, canvas)).toBe(inside);
    // 左上の初期位置からは、右下のマスが中央に来るところまで寄せる。
    expect(clampViewport({ x: LABEL_SIZE + 8, y: LABEL_SIZE + 8, cell: 20 }, small, canvas)).toEqual(left);
  });

  it('uses the zoomed cell size for the limits', () => {
    const zoomedIn = clampViewport({ x: -10_000, y: 0, cell: 60 }, board, canvas);
    expect(zoomedIn.x).toBe(centerX - (board.cols - 0.5) * 60);
    expect(zoomedIn.cell).toBe(60);
    const zoomedOut = clampViewport({ x: -10_000, y: 0, cell: 4 }, board, canvas);
    expect(zoomedOut.x).toBe(centerX - (board.cols - 0.5) * 4);
  });

  it('pulls the board back when the canvas shrinks', () => {
    const wide = { width: LABEL_SIZE + 1000, height: LABEL_SIZE + 300 };
    const atRightLimit = clampViewport({ x: 10_000, y: 0, cell: 20 }, board, wide);
    const narrowed = clampViewport(atRightLimit, board, canvas);
    expect(narrowed.x + 0.5 * narrowed.cell).toBe(centerX);
  });

  it('does not move the board before the canvas has a size', () => {
    const view = { x: 10_000, y: -10_000, cell: 20 };
    expect(clampViewport(view, board, { width: 0, height: 0 })).toBe(view);
  });
});

describe('readCanvasChrome', () => {
  it('falls back to the light colors when the stylesheet defines no canvas colors', () => {
    expect(readCanvasChrome(document.createElement('div'))).toEqual(LIGHT_CANVAS_CHROME);
  });

  it('reads the surround, the number band and the numbers from the stylesheet variables', () => {
    const element = document.createElement('div');
    element.style.setProperty('--canvas-surround', '#1c221f');
    element.style.setProperty('--canvas-label-band', 'rgba(28, 34, 31, .96)');
    element.style.setProperty('--canvas-label', '#b6c2ba');
    document.body.append(element);
    expect(readCanvasChrome(element)).toEqual({ surround: '#1c221f', labelBand: 'rgba(28, 34, 31, .96)', label: '#b6c2ba' });
    element.remove();
  });
});
