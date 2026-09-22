import { describe, expect, it } from 'vitest';
import { Board } from '../model/Board';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, PNG_PREFERRED_CELL_SIZE, validatePngSize } from './exporters';

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
