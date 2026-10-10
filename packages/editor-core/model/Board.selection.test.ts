import { describe, expect, it } from 'vitest';
import { Board, type Rect } from './Board';
import { STITCHES } from '../stitches/catalog';

// 最適化前の全範囲再走査を、選択結果の比較対象として残す。
function normalizeByRescanning(board: Board, rect: Rect): Rect {
  const clampRow = (row: number) => Math.max(0, Math.min(board.rows - 1, row));
  const clampCol = (col: number) => Math.max(0, Math.min(board.cols - 1, col));
  const normalized: Rect = {
    top: clampRow(Math.min(rect.top, rect.bottom)),
    left: clampCol(Math.min(rect.left, rect.right)),
    bottom: clampRow(Math.max(rect.top, rect.bottom)),
    right: clampCol(Math.max(rect.left, rect.right)),
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = normalized.top; row <= normalized.bottom; row++) {
      for (let col = normalized.left; col <= normalized.right; col++) {
        const anchor = board.anchorAt(row, col);
        if (!anchor) continue;
        const definition = board.definitionAt(row, col)!;
        const nextTop = Math.min(normalized.top, anchor.row);
        const nextLeft = Math.min(normalized.left, anchor.col);
        const nextBottom = Math.max(normalized.bottom, anchor.row + definition.height - 1);
        const nextRight = Math.max(normalized.right, anchor.col + definition.width - 1);
        if (nextTop !== normalized.top || nextLeft !== normalized.left || nextBottom !== normalized.bottom || nextRight !== normalized.right) {
          Object.assign(normalized, { top: nextTop, left: nextLeft, bottom: nextBottom, right: nextRight });
          changed = true;
        }
      }
    }
  }
  return normalized;
}

class CountingBoard extends Board {
  anchorCalls = 0;

  override anchorAt(row: number, col: number) {
    this.anchorCalls += 1;
    return super.anchorAt(row, col);
  }
}

describe('Board selection expansion', () => {
  it.each([[100, 100], [300, 300], [1000, 1000], [1000, 2]])('scans each cell at most once for a %i×%i slip-stitch chain', (size, cols) => {
    const board = new CountingBoard(size, cols);
    for (let row = 0; row < size - 1; row++) {
      expect(board.place(row, row % 2, 'slip_stitch', '#111111', false)).toBe(true);
    }
    const before = board.cells.slice();
    expect(board.normalizeSelection({ top: size - 1, left: 0, bottom: size - 1, right: cols - 1 }))
      .toEqual({ top: 0, left: 0, bottom: size - 1, right: cols - 1 });
    expect(board.anchorCalls).toBeLessThanOrEqual(size * cols);
    expect(board.cells.every((value, index) => value === before[index])).toBe(true);
    expect(board.occupiedStitchCount).toBe(size - 1);
  });

  it.each(STITCHES)('includes the entire $key footprint when only its last cell is selected', (stitch) => {
    const board = new CountingBoard(6, 6);
    board.place(0, 0, stitch.key, '#111111', false);
    const row = stitch.height - 1;
    const col = stitch.width - 1;
    expect(board.normalizeSelection({ top: row, left: col, bottom: row, right: col }))
      .toEqual({ top: 0, left: 0, bottom: row, right: col });
    expect(board.anchorCalls).toBe(stitch.height * stitch.width);
  });

  it('follows stitches in all four added bands and their corners', () => {
    const board = new CountingBoard(8, 8);
    board.place(2, 3, 'slip_stitch', '#111111', false);
    board.place(4, 4, 'slip_stitch', '#111111', false);
    board.place(3, 4, 'right_cross', '#111111', false);
    board.place(4, 2, 'right_cross', '#111111', false);
    board.place(1, 2, 'slip_stitch', '#111111', false);
    board.place(5, 5, 'slip_stitch', '#111111', false);
    expect(board.normalizeSelection({ top: 3, left: 3, bottom: 4, right: 4 }))
      .toEqual({ top: 1, left: 2, bottom: 6, right: 5 });
    expect(board.anchorCalls).toBe(24);
  });

  it('matches the old result for ordinary and multi-cell boards, reversed and out-of-bounds selections', () => {
    let seed = 171;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let sample = 0; sample < 8; sample++) {
      const board = new CountingBoard(6, 6);
      // 最初は空盤面、それ以降は全種類から選び、重なりの処理も実際の配置APIに任せる。
      if (sample > 0) {
        for (let placement = 0; placement < 40; placement++) {
          const stitch = STITCHES[random() % STITCHES.length];
          board.place(random() % 6, random() % 6, stitch.key, '#123456', false);
        }
      }
      for (const top of [-2, 0, 1, 3, 5, 8]) {
        for (const bottom of [-2, 0, 1, 3, 5, 8]) {
          for (const left of [-2, 0, 2, 4, 5, 8]) {
            for (const right of [-2, 0, 2, 4, 5, 8]) {
              const rect = { top, left, bottom, right };
              const expected = normalizeByRescanning(board, rect);
              board.anchorCalls = 0;
              expect(board.normalizeSelection(rect)).toEqual(expected);
              const area = (expected.bottom - expected.top + 1) * (expected.right - expected.left + 1);
              expect(board.anchorCalls).toBe(area);
            }
          }
        }
      }
    }
  });
});
