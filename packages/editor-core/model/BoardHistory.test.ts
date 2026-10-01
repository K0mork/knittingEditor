import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { BoardHistory } from './BoardHistory';

const cellsOf = (board: Board) => Array.from(board.cells);

describe('BoardHistory', () => {
  it('undoes and redoes a group of placements as one step', () => {
    const board = new Board(4, 4);
    const history = new BoardHistory(board);
    const empty = cellsOf(board);

    // 1回のなぞり描きで3目置いてから記録する。
    board.place(0, 0, 'knit', '#111111');
    board.place(0, 1, 'knit', '#111111');
    board.place(0, 2, 'knit', '#111111');
    expect(history.record(board)).toBe(true);
    const drawn = cellsOf(board);

    expect(history.canUndo).toBe(true);
    expect(history.undo(board)).toBe(true);
    expect(cellsOf(board)).toEqual(empty);
    expect(board.occupiedStitchCount).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    expect(history.redo(board)).toBe(true);
    expect(cellsOf(board)).toEqual(drawn);
    expect(board.occupiedStitchCount).toBe(3);
    expect(history.canRedo).toBe(false);
  });

  it('ignores records without a change', () => {
    const board = new Board(3, 3);
    const history = new BoardHistory(board);
    expect(history.record(board)).toBe(false);
    expect(history.canUndo).toBe(false);
    expect(history.undo(board)).toBe(false);
  });

  it('restores the footprint of wide stitches that an edit replaced', () => {
    const board = new Board(2, 6);
    const history = new BoardHistory(board);
    board.place(0, 0, 'right_up_two_cross', '#111111');
    history.record(board);
    // 4目幅の交差の途中へ表目を置くと、交差は消える。
    board.place(0, 2, 'knit', '#222222');
    history.record(board);
    expect(board.definitionAt(0, 0)).toBeUndefined();

    history.undo(board);
    expect(board.definitionAt(0, 3)?.key).toBe('right_up_two_cross');
    expect(board.anchorAt(0, 3)).toEqual({ row: 0, col: 0 });
  });

  it('undoes structural changes back to the previous size', () => {
    const board = new Board(5, 5);
    board.place(4, 0, 'knit', '#111111');
    const history = new BoardHistory(board);
    const before = cellsOf(board);

    board.resize(8, 6, 3, 0);
    history.record(board);
    board.removeColumn(0);
    history.record(board);
    expect([board.rows, board.cols]).toEqual([8, 5]);

    history.undo(board);
    expect([board.rows, board.cols]).toEqual([8, 6]);
    history.undo(board);
    expect([board.rows, board.cols]).toEqual([5, 5]);
    expect(cellsOf(board)).toEqual(before);

    history.redo(board);
    history.redo(board);
    expect([board.rows, board.cols]).toEqual([8, 5]);
  });

  it('records pending edits before undoing so they are not lost', () => {
    const board = new Board(3, 3);
    const history = new BoardHistory(board);
    board.place(0, 0, 'knit', '#111111');
    history.record(board);
    // 記録前の書き換え（なぞり描きの途中など）は、それだけを取り消す。
    board.place(1, 1, 'purl', '#111111');
    history.undo(board);
    expect(board.valueAt(0, 0)).not.toBe(0);
    expect(board.valueAt(1, 1)).toBe(0);
  });

  it('drops redo steps once a new edit is recorded', () => {
    const board = new Board(3, 3);
    const history = new BoardHistory(board);
    board.place(0, 0, 'knit', '#111111');
    history.record(board);
    history.undo(board);
    board.place(2, 2, 'purl', '#111111');
    expect(history.redo(board)).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(board.valueAt(2, 2)).not.toBe(0);
    expect(board.valueAt(0, 0)).toBe(0);
  });

  it('discards the oldest steps beyond the entry and byte limits', () => {
    const board = new Board(10, 10);
    const history = new BoardHistory(board, { entryLimit: 3 });
    for (let col = 0; col < 5; col++) {
      board.place(0, col, 'knit', '#111111');
      history.record(board);
    }
    let undone = 0;
    while (history.undo(board)) undone++;
    expect(undone).toBe(3);
    expect(board.occupiedStitchCount).toBe(2);

    // 1件でも上限を超える場合は、直前の1件だけは残す。
    const large = new Board(10, 10);
    const tight = new BoardHistory(large, { byteLimit: 1 });
    large.place(0, 0, 'knit', '#111111');
    tight.record(large);
    large.place(0, 1, 'knit', '#111111');
    tight.record(large);
    expect(tight.undo(large)).toBe(true);
    expect(tight.undo(large)).toBe(false);
    expect(large.occupiedStitchCount).toBe(1);
  });
});
