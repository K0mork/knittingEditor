import { expect, it } from 'vitest';
import { Board } from './Board';

it('preserves displayed row and stitch numbers through top/left resizing', () => {
  const board = new Board(20, 20);
  board.place(19, 17, 'knit', '#123456');
  board.place(0, 0, 'purl', '#abcdef');
  const original = board.cells.slice();
  board.resize(22, 22, 2, 2);
  expect(board.valueAt(21, 19)).toBe(original[19 * 20 + 17]);
  board.resize(20, 20, -2, -2);
  expect(board.cells).toEqual(original);
  expect(board.countStitchesRemovedByResize(18, 18, -2, -2)).toBe(1);
  board.resize(18, 18, -2, -2);
  expect(board.valueAt(17, 15)).toBe(original[19 * 20 + 17]);
});

it('counts partial horizontal and vertical footprints once without mutating', () => {
  const board = new Board(6, 6);
  board.place(1, 1, 'right_up_two_cross', '#123456');
  board.place(0, 5, 'slip_stitch', '#123456');
  board.place(5, 5, 'knit', '#123456');
  const original = board.cells.slice();
  expect(board.countStitchesRemovedByResize(5, 5, -1, -1)).toBe(1);
  expect(board.countStitchesRemovedByResize(4, 4, -2, -2)).toBe(2);
  expect(board.countStitchesRemovedByResize(1, 1, -5, -5)).toBe(2);
  expect(board.countStitchesRemovedByResize(8, 8, 2, 2)).toBe(0);
  expect(board.cells).toEqual(original);
  const count = board.countStitchesRemovedByResize(4, 4, -2, -2);
  const before = board.occupiedStitchCount;
  board.resize(4, 4, -2, -2);
  expect(before - board.occupiedStitchCount).toBe(count);
});

it('counts stitches crossing the bottom or right edge for explicit edge deletion', () => {
  const board = new Board(6, 6);
  board.place(4, 1, 'slip_stitch', '#123456');
  board.place(2, 2, 'right_up_two_cross', '#123456');
  expect(board.countStitchesRemovedByResize(5, 5)).toBe(2);
  expect(() => board.countStitchesRemovedByResize(0, 5)).toThrow();
});
