import { describe, expect, it } from 'vitest';
import { Board } from '../model/Board';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, PNG_PREFERRED_CELL_SIZE, pngLabelLayout, validatePngSize } from './exporters';

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

