import { describe, expect, it, vi } from 'vitest';
import { Board, parseColor } from '../model/Board';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, PNG_PREFERRED_CELL_SIZE, pngGridStyles, pngLabelLayout, renderPng, validatePngSize } from './exporters';

describe('defaultPngCellSize', () => {
  it('uses the preferred cell size for ordinary boards', () => {
    const board = new Board(20, 20);
    expect(defaultPngCellSize(board)).toBe(PNG_PREFERRED_CELL_SIZE);
    const size = validatePngSize(board, defaultPngCellSize(board));
    expect([size.width, size.height]).toEqual([528, 528]);
  });

  it('falls back to the largest size that stays within the safe limits', () => {
    const board = new Board(1000, 1000);
    const size = defaultPngCellSize(board);
    expect(size).toBeLessThan(PNG_PREFERRED_CELL_SIZE);
    expect(validatePngSize(board, size).valid).toBe(true);
    expect(validatePngSize(board, size + 1).valid).toBe(false);
  });

  it('never returns a value outside the slider range', () => {
    for (const rows of [1, 20, 331, 664, 1000]) {
      const size = defaultPngCellSize(new Board(rows, rows));
      expect(size).toBeGreaterThanOrEqual(PNG_CELL_SIZE_RANGE.min);
      expect(size).toBeLessThanOrEqual(PNG_CELL_SIZE_RANGE.max);
    }
  });
});

describe('pngGridStyles', () => {
  it('keeps the previous gray lines on the default white ground', () => {
    expect(pngGridStyles(24)).toEqual({ minor: { color: '#bbbbbb', width: 1 }, major: { color: '#666666', width: 2 } });
  });

  it('draws lines lighter than a dark ground', () => {
    const { minor, major } = pngGridStyles(24, '#1e1e1e');
    expect(parseColor(minor.color)).toBeGreaterThan(0x1e_1e1e);
    expect(parseColor(major.color)).toBeGreaterThan(parseColor(minor.color));
  });
});

describe('pngLabelLayout', () => {
  it('keeps the one-cell number margin for ordinary boards', () => {
    const labels = pngLabelLayout(new Board(20, 20), 24);
    expect([labels.rowLabelWidth, labels.colLabelHeight]).toEqual([24, 24]);
    expect([labels.rowStride, labels.colStride]).toEqual([1, 1]);
  });

  it('widens the margins and thins the numbers when small cells cannot hold them', () => {
    const board = new Board(1000, 1000);
    const cellSize = defaultPngCellSize(board);
    const labels = pngLabelLayout(board, cellSize);
    // 4桁の段番号が帯からはみ出さず、隣どうしの番号も重ならない。
    expect(labels.rowLabelWidth).toBeGreaterThan(cellSize);
    expect(labels.rowLabelWidth).toBeGreaterThanOrEqual(Math.ceil(4 * 0.62 * labels.fontSize));
    expect(labels.colStride * cellSize).toBeGreaterThanOrEqual(4 * 0.62 * labels.fontSize);
    expect(labels.rowStride * cellSize).toBeGreaterThanOrEqual(labels.fontSize);
    const size = validatePngSize(board, cellSize);
    expect(size.width).toBe(1000 * cellSize + labels.rowLabelWidth * 2);
    expect(size.height).toBe(1000 * cellSize + labels.colLabelHeight * 2);
  });
});

describe('renderPng with real symbols', () => {
  it('draws colored single and multi-cell glyphs and whiteout on a dark ground', async () => {
    // Canvasの描画命令を記録する。drawCellとdrawGlyphは実装をそのまま通す。
    const strokes: Array<{ color: string; origin: number[]; path: number[][] }> = [];
    const fills: Array<{ color: string; rect: number[] }> = [];
    let origin = [0, 0];
    let path: number[][] = [];
    const context = {
      fillStyle: '', strokeStyle: '',
      fillRect: (...rect: number[]) => fills.push({ color: context.fillStyle, rect }),
      fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(),
      translate: (x: number, y: number) => { origin = [x, y]; },
      beginPath: () => { path = []; },
      moveTo: (...point: number[]) => path.push(point),
      lineTo: (...point: number[]) => path.push(point),
      ellipse: vi.fn(), bezierCurveTo: vi.fn(),
      stroke: () => strokes.push({ color: context.strokeStyle, origin: [...origin], path: [...path] }),
    };
    const canvas = {
      width: 0, height: 0, getContext: () => context,
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    try {
      const board = new Board(2, 4);
      board.place(0, 0, 'knit', '#c83264', false);
      board.place(1, 1, 'right_up_two_one', '#2468ac', false);
      board.place(1, 3, 'erase', '#abcdef', false);
      expect((await renderPng(board, 24, '#1e1e1e')).type).toBe('image/png');
      expect(strokes.filter((stroke) => stroke.color === '#c83264')).toEqual([
        expect.objectContaining({ origin: [24, 24], path: [[50, 12], [50, 88]] }),
      ]);
      const wide = strokes.find((stroke) => stroke.color === '#2468ac')!;
      expect(wide.origin).toEqual([48, 48]);
      expect(Math.max(...wide.path.map((point) => point[0]))).toBeGreaterThan(100);
      expect(fills).toContainEqual({ color: '#fff', rect: [96, 48, 24, 24] });
      strokes.length = 0;
      fills.length = 0;
      await renderPng(new Board(2, 4), 24, '#1e1e1e');
      expect(strokes.some((stroke) => ['#c83264', '#2468ac'].includes(stroke.color))).toBe(false);
      expect(fills).not.toContainEqual({ color: '#fff', rect: [96, 48, 24, 24] });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
