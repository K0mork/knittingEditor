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
    board.place(2, 4, 'knit', '#222222');
    expect(board.valueAt(2, 2)).toBe(0);
    expect(cellStitchId(board.valueAt(2, 4))).toBe(STITCH_BY_KEY.get('knit')!.id);
  });

  it('keeps the established footprints for decreases and slip stitches', () => {
    const board = new Board(2, 3);
    expect(board.place(0, 0, 'right_up_three_one', '#111111')).toBe(true);
    expect(board.place(0, 1, 'right_up_three_one', '#111111')).toBe(false);
    board.clear();
    expect(board.place(0, 2, 'slip_stitch', '#222222')).toBe(true);
    expect(board.place(1, 2, 'slip_stitch', '#222222')).toBe(false);
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

  it('counts placed stitch anchors for accessible status', () => {
    const board = new Board(4, 4);
    expect(board.occupiedStitchCount).toBe(0);
    board.place(1, 1, 'knit', '#123456', false);
    expect(board.occupiedStitchCount).toBe(1);
    board.clearAt(1, 1);
    expect(board.occupiedStitchCount).toBe(0);
  });

  it('clamps a selection made entirely outside the board', () => {
    const board = new Board(10, 10);
    expect(board.normalizeSelection({ top: -3, left: -4, bottom: -1, right: -2 })).toEqual({
      top: 0, left: 0, bottom: 0, right: 0,
    });
    expect(board.normalizeSelection({ top: 12, left: 13, bottom: 15, right: 16 })).toEqual({
      top: 9, left: 9, bottom: 9, right: 9,
    });
  });
});
