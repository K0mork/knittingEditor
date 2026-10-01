import { describe, expect, it } from 'vitest';
import { labelStride, showsLabel } from './labels';

describe('row and column label thinning', () => {
  it('labels every row and column when the cells are wide enough', () => {
    expect(labelStride(14, 6.7, 2)).toBe(1);
  });

  it('thins labels to multiples of 2, 5, 10… so neighbours never overlap', () => {
    for (const cellSize of [0.5, 1, 3, 5.7, 7, 10]) {
      const stride = labelStride(cellSize, 13.3, 2);
      expect(stride * cellSize, `cell ${cellSize}`).toBeGreaterThanOrEqual(15.3);
      expect([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]).toContain(stride);
    }
    expect(labelStride(7, 19.8, 3)).toBe(5);
  });

  it('shows only the multiples of the stride', () => {
    expect([1, 2, 5, 10, 15].filter((number) => showsLabel(number, 5))).toEqual([5, 10, 15]);
    expect([1, 2, 3].every((number) => showsLabel(number, 1))).toBe(true);
  });
});
