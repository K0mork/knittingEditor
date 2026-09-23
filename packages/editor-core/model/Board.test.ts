import { describe, expect, it } from 'vitest';
import { Board, cellColor, cellStitchId, colorHex, parseColor } from './Board';
import { STITCH_BY_KEY } from '../stitches/catalog';

describe('Board', () => {
  it('expands three digit colors instead of padding them with zeros', () => {
    expect(colorHex(parseColor('#0f0'))).toBe('#00ff00');
    expect(colorHex(parseColor('#fff'))).toBe('#ffffff');
    expect(colorHex(parseColor('#d33c32'))).toBe('#d33c32');
    const board = new Board(4, 4);
    board.place(0, 0, 'knit', '#0f0');
    expect(colorHex(cellColor(board.valueAt(0, 0)))).toBe('#00ff00');
  });

  it('keeps the cast-on row when the row count grows and shrinks again', () => {
    const board = new Board(20, 10);
    const knit = STITCH_BY_KEY.get('knit')!.id;
    board.place(19, 0, 'knit', '#111111');
    board.place(0, 1, 'purl', '#222222');

    // 盤面設定の段数変更が使うオフセット。上端側で増減する。
    board.resize(25, 10, 25 - 20, 0);
    expect(cellStitchId(board.valueAt(24, 0))).toBe(knit);
    expect(board.valueAt(19, 0)).toBe(0);

    board.resize(20, 10, 20 - 25, 0);
    expect(cellStitchId(board.valueAt(19, 0))).toBe(knit);
    expect(cellStitchId(board.valueAt(0, 1))).toBe(STITCH_BY_KEY.get('purl')!.id);
    expect(board.cells.reduce((count, value) => (value ? count + 1 : count), 0)).toBe(2);
    expect(board.occupiedStitchCount).toBe(2);
  });

  it('shifts stitches when rows and columns are inserted or removed at an index', () => {
    const board = new Board(4, 4);
    const knit = STITCH_BY_KEY.get('knit')!.id;
    const cross = STITCH_BY_KEY.get('right_cross')!.id;
    board.place(0, 0, 'knit', '#111111');
    board.place(2, 1, 'right_cross', '#222222');

    board.insertRow(1);
    expect([board.rows, board.cols]).toEqual([5, 4]);
    expect(cellStitchId(board.valueAt(0, 0))).toBe(knit);
    expect(cellStitchId(board.valueAt(3, 1))).toBe(cross);

    board.insertColumn(0);
    expect(cellStitchId(board.valueAt(0, 1))).toBe(knit);
    expect(board.anchorAt(3, 3)).toEqual({ row: 3, col: 2 });

    // 削除した段にある記号は消え、それより下の記号は1段上へ詰める。
    board.removeRow(0);
    expect(board.rows).toBe(4);
    expect(cellStitchId(board.valueAt(2, 2))).toBe(cross);
    expect(board.occupiedStitchCount).toBe(1);

    // 右端の列を削除すると、はみ出す2目の記号は残らない。
    board.removeColumn(4);
    expect(board.cols).toBe(4);
    expect(cellStitchId(board.valueAt(2, 2))).toBe(cross);
    board.removeColumn(3);
    expect(board.occupiedStitchCount).toBe(0);
  });

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
    board.place(0, 0, 'knit', '#123456', false);
    board.place(999, 999, 'purl', '#abcdef', false);
    expect(board.occupiedStitchCount).toBe(2);
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
