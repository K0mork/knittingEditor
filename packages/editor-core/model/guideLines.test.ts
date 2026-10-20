import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { normalizeGuideLines } from './guideLines';

const line = { col: 2, top: 1, bottom: 5 };

describe('縦の線', () => {
  it('隣接・同段を拒否し、同じ線を引き直しても残す', () => {
    const board = new Board(10, 6);
    expect(board.addLine(2, 1, 1)).toBe(false);
    expect(board.addLine(2, 1, 2)).toBe(false);
    expect(board.addLine(2, 1, 5)).toBe(true);
    expect(board.addLine(2, 1, 5)).toBe(false);
    expect(board.lines).toEqual([line]);
    board.place(1, 2, 'knit', '#ff0000');
    board.clearAt(1, 2);
    expect(board.lines).toEqual([line]);
  });

  it('重なりを置き換え、端で接する線と別の列は残す', () => {
    const board = new Board(10, 6);
    board.addLine(2, 1, 5);
    board.addLine(2, 5, 8);
    board.addLine(3, 1, 5);
    board.addLine(2, 0, 5);
    expect(board.lines).toEqual([{ col: 2, top: 5, bottom: 8 }, { col: 3, top: 1, bottom: 5 }, { col: 2, top: 0, bottom: 5 }]);
    expect(board.eraseLinesAt(0, 2)).toBe(false);
    expect(board.eraseLinesAt(5, 2)).toBe(false);
    expect(board.eraseLinesAt(2, 2)).toBe(true);
    expect(board.lineThrough(2, 2)).toBeUndefined();
  });

  it('途中の段の挿入・削除に追従し、端や列の削除で消える', () => {
    const board = new Board(10, 6, undefined, [line]);
    board.insertRow(3);
    expect(board.lines).toEqual([{ ...line, bottom: 6 }]);
    board.removeRow(3);
    expect(board.lines).toEqual([line]);
    board.insertRow(1);
    expect(board.lines).toEqual([{ ...line, top: 2, bottom: 6 }]);
    board.insertColumn(2);
    expect(board.lines[0].col).toBe(3);
    board.removeColumn(0);
    expect(board.lines[0].col).toBe(2);
    board.removeColumn(2);
    expect(board.lines).toEqual([]);
    for (const endpoint of [1, 5]) {
      const other = new Board(10, 6, undefined, [line]);
      other.removeRow(endpoint);
      expect(other.lines).toEqual([]);
    }
  });

  it('途中削除で隣接した線を消し、offsetで移動して盤外の線を捨てる', () => {
    const board = new Board(8, 6, undefined, [{ ...line, bottom: 3 }]);
    board.removeRow(2);
    expect(board.lines).toEqual([]);
    board.addLine(2, 1, 5);
    board.resize(10, 8, 2, 1);
    expect(board.lines).toEqual([{ col: 3, top: 3, bottom: 7 }]);
    board.resize(6, 8);
    expect(board.lines).toEqual([]);
  });

  it('両端が選択内の線だけコピーし、貼付先に交わる線を消す', () => {
    const board = new Board(12, 8, undefined, [line, { col: 3, top: 0, bottom: 8 }]);
    const block = board.createBlock({ top: 1, left: 2, bottom: 5, right: 4 }, '線');
    expect(block.lines).toEqual([{ col: 0, top: 0, bottom: 4 }]);
    board.addLine(4, 0, 10);
    board.addLine(6, 3, 7);
    expect(board.pasteBlock(block, 6, 4)).toBe(true);
    expect(board.lines).toEqual([line, { col: 3, top: 0, bottom: 8 }, { col: 4, top: 6, bottom: 10 }]);
    board.restore(12, 8, board.cells, [{ col: 1, top: 0, bottom: 1 }, line]);
    expect(board.lines).toEqual([line]);
  });

  it('壊れた線を捨てて先に受け入れた線を優先する', () => {
    expect(normalizeGuideLines([null, '線', { ...line, col: '2' }, { ...line, top: 1.5 }, { ...line, col: 6 }, { ...line, top: -1 }, { ...line, bottom: 10 }, { ...line, bottom: 1 }, { ...line, bottom: 2 }, line, { ...line, top: 2 }, { ...line, top: 5, bottom: 8 }], 10, 6)).toEqual([line, { ...line, top: 5, bottom: 8 }]);
  });
});
