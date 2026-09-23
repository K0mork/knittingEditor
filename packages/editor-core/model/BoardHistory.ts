import type { Board } from './Board';

interface BoardState { rows: number; cols: number; cells: Uint32Array }

/**
 * 1回分の編集。寸法が変わらない編集は変わったセルだけを持ち、1000×1000の盤面でも
 * 1筆ごとに盤面全体を複製しない。寸法が変わる編集は前後の盤面をそのまま持つ。
 */
type HistoryEntry =
  | { kind: 'cells'; indices: Uint32Array; before: Uint32Array; after: Uint32Array }
  | { kind: 'layout'; before: BoardState; after: BoardState };

export const HISTORY_ENTRY_LIMIT = 100;
export const HISTORY_BYTE_LIMIT = 64 * 1024 * 1024;

export interface BoardHistoryOptions {
  entryLimit?: number;
  byteLimit?: number;
}

function copyState(board: Pick<Board, 'rows' | 'cols' | 'cells'>): BoardState {
  return { rows: board.rows, cols: board.cols, cells: board.cells.slice() };
}

function entryBytes(entry: HistoryEntry): number {
  return entry.kind === 'cells'
    ? entry.indices.byteLength + entry.before.byteLength + entry.after.byteLength
    : entry.before.cells.byteLength + entry.after.cells.byteLength;
}

/**
 * 盤面の元に戻す・やり直す。Reactに依存しない。
 *
 * 最後に記録した盤面（基準）を持ち、`record`で現在の盤面との差を1件の履歴にする。
 * 1回のなぞり描きのように複数回書き換える操作は、書き換えが終わってから1度だけ
 * `record`を呼べば1件にまとまる。
 */
export class BoardHistory {
  private baseline: BoardState;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private bytes = 0;
  private readonly entryLimit: number;
  private readonly byteLimit: number;

  constructor(board: Board, options: BoardHistoryOptions = {}) {
    this.baseline = copyState(board);
    this.entryLimit = options.entryLimit ?? HISTORY_ENTRY_LIMIT;
    this.byteLimit = options.byteLimit ?? HISTORY_BYTE_LIMIT;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** 基準との差を1件の履歴として積む。差が無ければ何もせず`false`を返す。 */
  record(board: Board): boolean {
    const entry = this.diff(board);
    if (!entry) return false;
    this.undoStack.push(entry);
    this.bytes += entryBytes(entry);
    this.redoStack = [];
    this.trim();
    return true;
  }

  /** 直前の編集を取り消す。記録前の書き換えが残っていれば、先にそれを1件として積む。 */
  undo(board: Board): boolean {
    this.record(board);
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.bytes -= entryBytes(entry);
    this.apply(board, entry, 'before');
    this.redoStack.push(entry);
    return true;
  }

  redo(board: Board): boolean {
    // 取り消したあとに書き換えがあれば、やり直す対象は無くなる。
    if (this.record(board)) return false;
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.apply(board, entry, 'after');
    this.undoStack.push(entry);
    this.bytes += entryBytes(entry);
    this.trim();
    return true;
  }

  private diff(board: Board): HistoryEntry | undefined {
    const base = this.baseline;
    if (base.rows !== board.rows || base.cols !== board.cols) {
      const entry: HistoryEntry = { kind: 'layout', before: base, after: copyState(board) };
      this.baseline = copyState(board);
      return entry;
    }
    const current = board.cells;
    let count = 0;
    for (let index = 0; index < current.length; index++) if (current[index] !== base.cells[index]) count++;
    if (count === 0) return undefined;
    const indices = new Uint32Array(count);
    const before = new Uint32Array(count);
    const after = new Uint32Array(count);
    for (let index = 0, cursor = 0; index < current.length; index++) {
      if (current[index] === base.cells[index]) continue;
      indices[cursor] = index;
      before[cursor] = base.cells[index];
      after[cursor] = current[index];
      base.cells[index] = current[index];
      cursor++;
    }
    return { kind: 'cells', indices, before, after };
  }

  private apply(board: Board, entry: HistoryEntry, side: 'before' | 'after'): void {
    if (entry.kind === 'layout') {
      this.baseline = { ...entry[side], cells: entry[side].cells.slice() };
    } else {
      const values = entry[side];
      for (let cursor = 0; cursor < entry.indices.length; cursor++) this.baseline.cells[entry.indices[cursor]] = values[cursor];
    }
    board.restore(this.baseline.rows, this.baseline.cols, this.baseline.cells);
  }

  /** 古い履歴から捨てる。直前の1件は容量を超えても残す。 */
  private trim(): void {
    while (this.undoStack.length > 1 && (this.undoStack.length > this.entryLimit || this.bytes > this.byteLimit)) {
      this.bytes -= entryBytes(this.undoStack.shift()!);
    }
  }
}
