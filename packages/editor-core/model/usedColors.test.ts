import { describe, expect, it } from 'vitest';
import { Board, MAX_BOARD_SIZE, packCell, parseColor } from './Board';
import { collectUsedColors, describeColor, USED_COLOR_LIMIT, usedColorLabel } from './usedColors';
import { STITCH_BY_KEY } from '../stitches/catalog';

describe('collectUsedColors', () => {
  it('returns no colors for an empty board', () => {
    expect(collectUsedColors(new Board(20, 20).cells)).toEqual({ colors: [], total: 0 });
  });

  it('counts each stitch once, including black and wide stitches', () => {
    const board = new Board(4, 6);
    board.place(0, 0, 'knit', '#000000');
    board.place(0, 1, 'knit', '#d33c32');
    // 2目の記号は起点の1マスにだけ値が入るので、1個として数える。
    board.place(1, 0, 'right_up_two_one', '#d33c32');
    board.place(2, 0, 'purl', '#3366cc');
    board.place(2, 1, 'purl', '#d33c32');

    expect(collectUsedColors(board.cells)).toEqual({
      colors: [
        { color: 0xd33c32, hex: '#d33c32', count: 3 },
        { color: 0x000000, hex: '#000000', count: 1 },
        { color: 0x3366cc, hex: '#3366cc', count: 1 },
      ],
      total: 3,
    });
  });

  it('orders many colors by use and keeps only the limit', () => {
    const knit = STITCH_BY_KEY.get('knit')!.id;
    const cells = new Uint32Array(1000);
    let index = 0;
    // 色nをn+1個ずつ置く。後ろの色ほど多く使っている。
    for (let color = 0; color < 40; color++) {
      for (let count = 0; count <= color; count++) cells[index++ % cells.length] = packCell(knit, color * 0x010101);
    }
    const summary = collectUsedColors(cells);
    expect(summary.total).toBe(40);
    expect(summary.colors).toHaveLength(USED_COLOR_LIMIT);
    const counts = summary.colors.map((item) => item.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    // 配列は1000マスで、置いた820個はすべて入る。最も多いのは最後の色。
    expect(summary.colors[0]).toEqual({ color: 39 * 0x010101, hex: '#272727', count: 40 });
    expect(collectUsedColors(cells, 5).colors).toHaveLength(5);
    expect(collectUsedColors(cells, 0).colors).toEqual([]);
  });

  it('keeps first-found order for colors used the same number of times', () => {
    const board = new Board(1, 3);
    board.place(0, 0, 'knit', '#00ff00');
    board.place(0, 1, 'knit', '#0000ff');
    board.place(0, 2, 'knit', '#ff0000');
    expect(collectUsedColors(board.cells).colors.map((item) => item.hex)).toEqual(['#00ff00', '#0000ff', '#ff0000']);
  });

  it('counts a full board of the largest size', () => {
    const knit = STITCH_BY_KEY.get('knit')!.id;
    const size = MAX_BOARD_SIZE * MAX_BOARD_SIZE;
    const cells = new Uint32Array(size);
    const colors = [parseColor('#d33c32'), parseColor('#ffffff'), parseColor('#264653')];
    // 1段ごとに色を替え、同じ色が続く区間と替わる箇所の両方を通す。
    for (let index = 0; index < size; index++) cells[index] = packCell(knit, colors[Math.floor(index / MAX_BOARD_SIZE) % colors.length]);
    cells[size - 1] = 0;

    const summary = collectUsedColors(cells);
    expect(summary.total).toBe(3);
    expect(summary.colors.map((item) => [item.hex, item.count])).toEqual([
      ['#d33c32', 334 * MAX_BOARD_SIZE - 1],
      ['#ffffff', 333 * MAX_BOARD_SIZE],
      ['#264653', 333 * MAX_BOARD_SIZE],
    ]);
  });
});

describe('describeColor', () => {
  it('names the color family for screen readers', () => {
    expect(describeColor(0x000000)).toBe('黒');
    expect(describeColor(0xffffff)).toBe('白');
    expect(describeColor(0x808080)).toBe('灰色');
    expect(describeColor(0xd33c32)).toBe('赤');
    expect(describeColor(0xffb6c1)).toBe('ピンク');
    expect(describeColor(0xff8c00)).toBe('オレンジ');
    expect(describeColor(0x8b4513)).toBe('茶色');
    expect(describeColor(0xf5deb3)).toBe('ベージュ');
    expect(describeColor(0xffd700)).toBe('黄色');
    expect(describeColor(0x9acd32)).toBe('黄緑');
    expect(describeColor(0x2e8b57)).toBe('緑');
    expect(describeColor(0x40c4e0)).toBe('水色');
    expect(describeColor(0x264653)).toBe('青緑');
    expect(describeColor(0x1f4fbf)).toBe('青');
    expect(describeColor(0x1b2a5c)).toBe('紺');
    expect(describeColor(0x7b3fbf)).toBe('紫');
    expect(describeColor(0xa0306a)).toBe('赤紫');
  });

  it('builds a label with the name, code and stitch count', () => {
    expect(usedColorLabel({ color: 0xd33c32, hex: '#d33c32', count: 12 })).toBe('赤 #d33c32、記号12個');
  });
});
