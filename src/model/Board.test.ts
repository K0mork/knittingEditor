import { describe, expect, it } from 'vitest';
import { Board, cellStitchId } from './Board';
import { STITCH_BY_KEY } from '../stitches/catalog';

describe('Board', () => {
  it('places and clears a multi-cell stitch as one unit', () => {
    const board = new Board(10, 10);
    expect(board.place(2, 3, 'right_up_two_cross', '#ff0000')).toBe(true);
    expect(board.anchorAt(2, 6)).toEqual({ row: 2, col: 3 });
    board.clearAt(2, 5);
    expect(board.anchorAt(2, 3)).toBeUndefined();
  });

  it('clears overlapping symbols before placement', () => {
    const board = new Board(10, 10);
    board.place(2, 2, 'right_up_two_cross', '#111111');
    board.place(2, 4, 'left_up_two_one', '#222222');
    expect(board.valueAt(2, 2)).toBe(0);
    expect(cellStitchId(board.valueAt(2, 4))).toBe(STITCH_BY_KEY.get('left_up_two_one')!.id);
  });

  it('expands block selection around multi-cell symbols and pastes exact blanks', () => {
    const board = new Board(10, 10);
    board.place(2, 2, 'right_up_two_cross', '#123456');
    const block = board.createBlock({ top: 2, left: 3, bottom: 3, right: 4 }, '交差');
    expect(block.cols).toBe(4);
    board.place(6, 2, 'knit', '#ffffff');
    expect(board.pasteBlock(block, 5, 1)).toBe(true);
    expect(board.valueAt(6, 2)).toBe(0);
    expect(board.pasteBlock(block, 9, 9)).toBe(false);
  });

  it('supports one million cells in a compact buffer', () => {
    const board = new Board(1000, 1000);
    expect(board.cells.byteLength).toBe(4_000_000);
  });
});
