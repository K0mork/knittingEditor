import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { BoardHistory } from './BoardHistory';

for (const axis of ['row', 'col'] as const) {
  const point = (coordinate: number) => axis === 'row' ? { row: coordinate, col: 0 } : { row: 0, col: coordinate };
  const makeBoard = () => {
    const board = new Board(axis === 'row' ? 4 : 1, axis === 'col' ? 4 : 1);
    board.place(0, 0, axis === 'row' ? 'slip_stitch' : 'right_cross', '#123456', false);
    const neighbor = point(2);
    board.place(neighbor.row, neighbor.col, 'knit', '#abcdef', false);
    return board;
  };
  describe(`${axis} structure changes`, () => {
    for (const index of [0, 1]) {
      it(`removes the entire stitch when deleting footprint cell ${index}`, () => {
        const board = makeBoard();
        const history = new BoardHistory(board);
        const before = board.cells.slice();
        if (axis === 'row') board.removeRow(index); else board.removeColumn(index);
        history.record(board);
        expect(board.occupiedStitchCount).toBe(1);
        expect(board.anchorAt(0, 0)).toBeUndefined();
        const neighbor = point(1);
        expect(board.anchorAt(neighbor.row, neighbor.col)).toEqual(neighbor);
        expect(board.normalizeSelection({ top: neighbor.row, bottom: neighbor.row, left: neighbor.col, right: neighbor.col }))
          .toEqual({ top: neighbor.row, bottom: neighbor.row, left: neighbor.col, right: neighbor.col });
        const after = board.cells.slice();
        expect(history.undo(board)).toBe(true);
        expect(board.cells).toEqual(before);
        const covered = point(1);
        expect(board.anchorAt(covered.row, covered.col)).toEqual({ row: 0, col: 0 });
        expect(history.redo(board)).toBe(true);
        expect(board.cells).toEqual(after);
        expect(board.clearAt(neighbor.row, neighbor.col)).toBe(true);
        expect(board.occupiedStitchCount).toBe(0);
        expect([...board.cells].every((value) => value === 0)).toBe(true);
      });
    }
    for (const index of [0, 1, 2, 4]) {
      it(`preserves whole stitches and history when inserting at ${index}`, () => {
        const board = makeBoard();
        const history = new BoardHistory(board);
        const before = board.cells.slice();
        if (axis === 'row') board.insertRow(index); else board.insertColumn(index);
        history.record(board);
        const anchor = point(index === 0 ? 1 : 0);
        const covered = point(index === 0 ? 2 : 1);
        const neighbor = point(index <= 2 ? 3 : 2);
        expect(board.occupiedStitchCount).toBe(2);
        expect(board.anchorAt(covered.row, covered.col)).toEqual(anchor);
        expect(board.anchorAt(neighbor.row, neighbor.col)).toEqual(neighbor);
        expect(board.normalizeSelection({ top: covered.row, bottom: covered.row, left: covered.col, right: covered.col }))
          .toEqual({ top: anchor.row, bottom: covered.row, left: anchor.col, right: covered.col });
        const after = board.cells.slice();
        expect(history.undo(board)).toBe(true);
        expect(board.cells).toEqual(before);
        expect(history.redo(board)).toBe(true);
        expect(board.cells).toEqual(after);
        expect(board.clearAt(covered.row, covered.col)).toBe(true);
        expect(board.anchorAt(anchor.row, anchor.col)).toBeUndefined();
        expect(board.anchorAt(neighbor.row, neighbor.col)).toEqual(neighbor);
        expect(board.occupiedStitchCount).toBe(1);
      });
    }
  });
}
