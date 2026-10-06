import { describe, expect, it } from 'vitest';
import { isMajorGridLine, majorGridLines } from './gridLines';

describe('majorGridLines', () => {
  it('draws the major line between numbers 10 and 11 on a 20-row board', () => {
    // 20段なら、上から10本目の罫線が10段目と11段目の境目。外枠は太くしない。
    expect(majorGridLines(20)).toEqual([10]);
  });

  it('counts from the numbered bottom-right edge when the size is not a multiple of ten', () => {
    // 25段: 10・20段目の上の罫線は、上端から25-10=15本目と25-20=5本目。
    expect(majorGridLines(25)).toEqual([5, 15]);
    // 23目: 10・20目の左の罫線は、左端から13本目と3本目。
    expect(majorGridLines(23)).toEqual([3, 13]);
  });

  it('leaves small boards and the outer edges without major lines', () => {
    expect(majorGridLines(9)).toEqual([]);
    expect(majorGridLines(10)).toEqual([]);
    expect(majorGridLines(11)).toEqual([1]);
    expect(isMajorGridLine(0, 30)).toBe(false);
    expect(isMajorGridLine(30, 30)).toBe(false);
  });

  it('keeps the board-wide numbering on every tiled page', () => {
    // 65段を、上から1段ずつ重ねて0〜27・27〜54・54〜64段目の3ページに分けた場合。
    const total = 65;
    const pages = [{ start: 0, count: 28 }, { start: 27, count: 28 }, { start: 54, count: 11 }];
    const lines = pages.map(({ start, count }) => majorGridLines(total, start, count));
    // 2ページ目の下端と3ページ目の上から1本目は、重ねた段の同じ罫線（番号10の境目）。
    expect(lines).toEqual([[5, 15, 25], [8, 18, 28], [1]]);
    // ページ内の位置を盤面全体の位置に戻すと、番号60・50…10の境目にそろう。
    const global = new Set(pages.flatMap(({ start }, index) => lines[index].map((line) => start + line)));
    expect([...global].map((line) => total - line).sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50, 60]);
  });
});
