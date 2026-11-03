import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { BoardHistory } from './BoardHistory';

describe('Board.eraseSelection', () => {
  it('erases every stitch in the selection and keeps the ones outside it', () => {
    const board = new Board(6, 6);
    board.place(1, 1, 'knit', '#111111');
    board.place(2, 2, 'purl', '#222222');
    board.place(4, 4, 'knit', '#333333');
    expect(board.eraseSelection({ top: 1, left: 1, bottom: 2, right: 2 })).toBe(true);
    expect(board.anchorAt(1, 1)).toBeUndefined();
    expect(board.anchorAt(2, 2)).toBeUndefined();
    expect(board.anchorAt(4, 4)).toEqual({ row: 4, col: 4 });
    expect(board.occupiedStitchCount).toBe(1);
  });

  it('erases a multi-cell stitch as one unit when the selection touches only part of it', () => {
    const board = new Board(10, 10);
    board.place(2, 2, 'right_up_two_cross', '#123456');
    board.place(2, 7, 'knit', '#ffffff');
    // 交差の右端だけを選んでも、選択範囲は記号全体へ広がる。
    expect(board.eraseSelection({ top: 2, left: 5, bottom: 2, right: 5 })).toBe(true);
    for (let col = 2; col <= 5; col++) expect(board.ownerAt(2, col)).toBe(-1);
    expect(board.anchorAt(2, 7)).toEqual({ row: 2, col: 7 });
    expect(board.occupiedStitchCount).toBe(1);
  });

  it('erases lines that cross the selection, like pasting does, and keeps the others', () => {
    const board = new Board(10, 10);
    board.addLine(2, 0, 9);
    board.addLine(3, 4, 6);
    board.addLine(4, 6, 9);
    board.addLine(6, 0, 9);
    expect(board.eraseSelection({ top: 2, left: 2, bottom: 4, right: 4 })).toBe(true);
    // 範囲をまたぐ線と範囲の中で始まる線は丸ごと消し、範囲より下で始まる線と範囲外の列の線は残す。
    expect(board.lines).toEqual([{ col: 4, top: 6, bottom: 9 }, { col: 6, top: 0, bottom: 9 }]);
  });

  it('erases a line whose end touches the selection', () => {
    const board = new Board(10, 10);
    board.addLine(3, 0, 2);
    expect(board.eraseSelection({ top: 2, left: 3, bottom: 4, right: 3 })).toBe(true);
    expect(board.lines).toEqual([]);
  });

  it('reports no change for an empty selection', () => {
    const board = new Board(6, 6);
    board.place(5, 5, 'knit', '#111111');
    board.addLine(5, 3, 5);
    expect(board.eraseSelection({ top: 0, left: 0, bottom: 2, right: 2 })).toBe(false);
    expect(board.occupiedStitchCount).toBe(1);
    expect(board.lines).toHaveLength(1);
  });

  it('is undone and redone as a single history step', () => {
    const board = new Board(8, 8);
    const history = new BoardHistory(board);
    board.place(1, 1, 'knit', '#111111');
    board.place(1, 2, 'right_up_two_cross', '#222222');
    board.addLine(3, 0, 4);
    history.record(board);
    const drawn = { cells: Array.from(board.cells), lines: board.lines.slice() };

    expect(board.eraseSelection({ top: 0, left: 0, bottom: 2, right: 5 })).toBe(true);
    expect(history.record(board)).toBe(true);
    expect(board.occupiedStitchCount).toBe(0);
    expect(board.lines).toEqual([]);

    expect(history.undo(board)).toBe(true);
    expect(Array.from(board.cells)).toEqual(drawn.cells);
    expect(board.lines).toEqual(drawn.lines);
    expect(board.anchorAt(1, 5)).toEqual({ row: 1, col: 2 });
    expect(board.occupiedStitchCount).toBe(2);

    expect(history.redo(board)).toBe(true);
    expect(board.occupiedStitchCount).toBe(0);
    expect(board.lines).toEqual([]);
    expect(history.canRedo).toBe(false);
  });
});
