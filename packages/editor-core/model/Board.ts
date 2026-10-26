import { normalizeGuideLines, linesOverlap, type GuideLine } from './guideLines';
import { STITCH_BY_ID, STITCH_BY_KEY, type StitchDefinition } from '../stitches/catalog';

export const MAX_BOARD_SIZE = 1000;
const TYPE_SHIFT = 24;
const COLOR_MASK = 0x00ff_ffff;

export interface Point { row: number; col: number }
export interface Rect { top: number; left: number; bottom: number; right: number }
export interface BlockAnchor extends Point { value: number }
export interface PatternBlock { id: string; name: string; rows: number; cols: number; anchors: BlockAnchor[]; lines?: GuideLine[]; createdAt: number }

export function parseColor(color: string): number {
  const normalized = color.trim().replace('#', '');
  // #rgb 表記は各桁を複製して展開する。#0f0 を #0f0000 として取り込まない。
  const expanded = normalized.length === 3
    ? normalized.replace(/./g, (digit) => digit + digit)
    : normalized;
  return Number.parseInt(expanded.padEnd(6, '0').slice(0, 6), 16) & COLOR_MASK;
}

export function colorHex(value: number): string {
  return `#${(value & COLOR_MASK).toString(16).padStart(6, '0')}`;
}

export function packCell(stitchId: number, color: number): number {
  return ((stitchId & 0xff) << TYPE_SHIFT) | (color & COLOR_MASK);
}

export function cellStitchId(value: number): number {
  return value >>> TYPE_SHIFT;
}

export function cellColor(value: number): number {
  return value & COLOR_MASK;
}

export class Board {
  rows: number;
  cols: number;
  cells: Uint32Array;
  private owners: Int32Array;
  private occupiedCount = 0;
  private guideLines: readonly GuideLine[] = Object.freeze([]);
  /** 記号とは独立した線の読み取り専用一覧。 */
  get lines(): readonly GuideLine[] { return this.guideLines; }

  constructor(rows = 20, cols = 20, cells?: Uint32Array, lines?: unknown) {
    Board.validateSize(rows, cols);
    this.rows = rows;
    this.cols = cols;
    this.cells = cells?.slice() ?? new Uint32Array(rows * cols);
    if (this.cells.length !== rows * cols) throw new Error('盤面データのサイズが一致しません');
    this.owners = new Int32Array(this.cells.length);
    this.rebuildOwners();
    this.guideLines = Object.freeze(normalizeGuideLines(lines, rows, cols));
  }

  /** 線を追加し、重なる既存の線を置き換える。 */
  addLine(col: number, top: number, bottom: number): boolean {
    const line = normalizeGuideLines([{ col, top, bottom }], this.rows, this.cols)[0];
    if (!line) return false;
    if (this.lines.some((old) => old.col === col && old.top === top && old.bottom === bottom)) return false;
    this.guideLines = Object.freeze([...this.lines.filter((old) => !linesOverlap(old, line)), line]);
    return true;
  }

  /** 両端と列が一致する線を削除する。 */
  removeLine(col: number, top: number, bottom: number): boolean {
    const next = this.lines.filter((line) => line.col !== col || line.top !== top || line.bottom !== bottom);
    if (next.length === this.lines.length) return false;
    this.guideLines = Object.freeze(next);
    return true;
  }

  /** 両端を除き、指定マスを通る線を返す。 */
  lineThrough(row: number, col: number): GuideLine | undefined {
    return this.lines.find((line) => line.col === col && line.top < row && row < line.bottom);
  }

  /** 指定マスを途中に含む線を削除する。 */
  eraseLinesAt(row: number, col: number): boolean {
    const line = this.lineThrough(row, col);
    return line ? this.removeLine(line.col, line.top, line.bottom) : false;
  }

  static validateSize(rows: number, cols: number): void {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > MAX_BOARD_SIZE || cols > MAX_BOARD_SIZE) {
      throw new Error(`段数・列数は1〜${MAX_BOARD_SIZE}で指定してください`);
    }
  }

  index(row: number, col: number): number { return row * this.cols + col; }
  inBounds(row: number, col: number): boolean { return row >= 0 && col >= 0 && row < this.rows && col < this.cols; }
  valueAt(row: number, col: number): number { return this.cells[this.index(row, col)] ?? 0; }
  get occupiedStitchCount(): number { return this.occupiedCount; }
  ownerAt(row: number, col: number): number { return this.inBounds(row, col) ? this.owners[this.index(row, col)] : -1; }

  definitionAt(row: number, col: number): StitchDefinition | undefined {
    const owner = this.ownerAt(row, col);
    return owner >= 0 ? STITCH_BY_ID.get(cellStitchId(this.cells[owner])) : undefined;
  }

  anchorAt(row: number, col: number): Point | undefined {
    const owner = this.ownerAt(row, col);
    return owner < 0 ? undefined : { row: Math.floor(owner / this.cols), col: owner % this.cols };
  }

  place(row: number, col: number, stitchKey: string, color: string | number, toggle = true): boolean {
    const definition = STITCH_BY_KEY.get(stitchKey);
    if (!definition || !this.canFit(row, col, definition)) return false;
    const value = packCell(definition.id, typeof color === 'string' ? parseColor(color) : color);
    const anchorIndex = this.index(row, col);
    if (toggle && this.cells[anchorIndex] === value && this.owners[anchorIndex] === anchorIndex) {
      this.clearOwner(anchorIndex);
      return true;
    }

    const conflicting = new Set<number>();
    this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
      const owner = this.ownerAt(targetRow, targetCol);
      if (owner >= 0) conflicting.add(owner);
    });
    conflicting.forEach((owner) => this.clearOwner(owner));
    this.cells[anchorIndex] = value;
    this.occupiedCount += 1;
    this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
      this.owners[this.index(targetRow, targetCol)] = anchorIndex;
    });
    return true;
  }

  clearAt(row: number, col: number): boolean {
    const owner = this.ownerAt(row, col);
    if (owner < 0) return false;
    this.clearOwner(owner);
    return true;
  }

  clear(): void {
    this.guideLines = Object.freeze([]);
    this.cells.fill(0);
    this.owners.fill(-1);
    this.occupiedCount = 0;
  }

  resize(newRows: number, newCols: number, rowOffset = 0, colOffset = 0): void {
    const lines = this.lines.map((line) => ({ col: line.col + colOffset, top: line.top + rowOffset, bottom: line.bottom + rowOffset }));
    this.relayout(newRows, newCols, (row, col) => ({ row: row + rowOffset, col: col + colOffset }));
    this.guideLines = Object.freeze(normalizeGuideLines(lines, newRows, newCols));
  }

  /** 縮小で消える記号数。複数セルの記号も、起点を1回だけ数える。盤面は変更しない。 */
  countStitchesRemovedByResize(newRows: number, newCols: number, rowOffset = 0, colOffset = 0): number {
    Board.validateSize(newRows, newCols);
    let removed = 0;
    for (let index = 0; index < this.cells.length; index++) {
      const value = this.cells[index];
      if (!value) continue;
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (!definition) continue;
      const row = Math.floor(index / this.cols) + rowOffset;
      const col = index % this.cols + colOffset;
      if (row < 0 || col < 0 || row + definition.height > newRows || col + definition.width > newCols) removed++;
    }
    return removed;
  }

  /**
   * 寸法とセル配列をまとめて差し替える。元に戻す・やり直すで使う。
   * `cells`は複製して持つので、呼び出し元は渡した配列を使い回してよい。
   */
  restore(rows: number, cols: number, cells: Uint32Array, lines?: unknown): void {
    Board.validateSize(rows, cols);
    if (cells.length !== rows * cols) throw new Error('盤面データのサイズが一致しません');
    this.rows = rows;
    this.cols = cols;
    this.guideLines = Object.freeze(normalizeGuideLines(lines, rows, cols));
    this.cells = cells.slice();
    this.owners = new Int32Array(this.cells.length);
    this.rebuildOwners();
  }

  insertRow(index: number): void { this.transformStructure('row', index, true); }
  removeRow(index: number): void { this.transformStructure('row', index, false); }
  insertColumn(index: number): void { this.transformStructure('col', index, true); }
  removeColumn(index: number): void { this.transformStructure('col', index, false); }

  normalizeSelection(rect: Rect): Rect {
    const clampRow = (row: number) => Math.max(0, Math.min(this.rows - 1, row));
    const clampCol = (col: number) => Math.max(0, Math.min(this.cols - 1, col));
    const normalized: Rect = {
      top: clampRow(Math.min(rect.top, rect.bottom)),
      left: clampCol(Math.min(rect.left, rect.right)),
      bottom: clampRow(Math.max(rect.top, rect.bottom)),
      right: clampCol(Math.max(rect.left, rect.right)),
    };
    // 各走査の境界を固定し、次の周では新しく加わった帯だけを調べる。
    // 盤面は走査中に変わらないので、一度調べたセルを再訪する必要はない。
    const scan = (top: number, left: number, bottom: number, right: number): void => {
      if (top > bottom || left > right) return;
      for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
          const anchor = this.anchorAt(row, col);
          if (!anchor) continue;
          const definition = this.definitionAt(row, col)!;
          normalized.top = Math.min(normalized.top, anchor.row);
          normalized.left = Math.min(normalized.left, anchor.col);
          normalized.bottom = Math.max(normalized.bottom, anchor.row + definition.height - 1);
          normalized.right = Math.max(normalized.right, anchor.col + definition.width - 1);
        }
      }
    };
    let scanned = { ...normalized };
    scan(scanned.top, scanned.left, scanned.bottom, scanned.right);
    while (scanned.top !== normalized.top || scanned.left !== normalized.left
      || scanned.bottom !== normalized.bottom || scanned.right !== normalized.right) {
      const next = { ...normalized };
      // 上下の帯は新しい全幅、左右の帯は走査済みの高さに限り、角の重複を避ける。
      scan(next.top, next.left, scanned.top - 1, next.right);
      scan(scanned.bottom + 1, next.left, next.bottom, next.right);
      scan(scanned.top, next.left, scanned.bottom, scanned.left - 1);
      scan(scanned.top, scanned.right + 1, scanned.bottom, next.right);
      scanned = next;
    }
    return normalized;
  }

  createBlock(rect: Rect, name: string): PatternBlock {
    const selection = this.normalizeSelection(rect);
    const anchors: BlockAnchor[] = [];
    for (let row = selection.top; row <= selection.bottom; row++) {
      for (let col = selection.left; col <= selection.right; col++) {
        const value = this.valueAt(row, col);
        if (value) anchors.push({ row: row - selection.top, col: col - selection.left, value });
      }
    }
    const lines = this.lines.filter((line) => line.col >= selection.left && line.col <= selection.right && line.top >= selection.top && line.bottom <= selection.bottom)
      .map((line) => ({ col: line.col - selection.left, top: line.top - selection.top, bottom: line.bottom - selection.top }));
    return {
      ...(lines.length ? { lines } : {}),
      id: crypto.randomUUID(), name,
      rows: selection.bottom - selection.top + 1,
      cols: selection.right - selection.left + 1,
      anchors, createdAt: Date.now(),
    };
  }

  pasteBlock(block: PatternBlock, top: number, left: number): boolean {
    if (top < 0 || left < 0 || top + block.rows > this.rows || left + block.cols > this.cols) return false;
    // 貼付範囲にかかる線を消し、ブロックの線で置き換える。
    this.guideLines = Object.freeze(this.lines.filter((line) => !(line.col >= left && line.col < left + block.cols && line.top < top + block.rows && line.bottom >= top)));
    for (const line of normalizeGuideLines(block.lines, block.rows, block.cols)) this.addLine(left + line.col, top + line.top, top + line.bottom);
    const owners = new Set<number>();
    for (let row = top; row < top + block.rows; row++) {
      for (let col = left; col < left + block.cols; col++) {
        const owner = this.ownerAt(row, col);
        if (owner >= 0) owners.add(owner);
      }
    }
    owners.forEach((owner) => this.clearOwner(owner));
    // 貼付範囲は空けてあるので、占有済みのセルは先に置いたブロックの記号のもの。
    // #157の修正前に作られ、記号が重なったブロックでは、盤面の読み込みと同じく先の記号を残す。
    for (const anchor of block.anchors) {
      const definition = STITCH_BY_ID.get(cellStitchId(anchor.value));
      const row = top + anchor.row;
      const col = left + anchor.col;
      if (definition && this.footprintFree(row, col, definition)) this.place(row, col, definition.key, cellColor(anchor.value), false);
    }
    return true;
  }

  /**
   * セル配列から所有情報を作り直す。未知の記号、はみ出す記号、先に受け入れた記号と重なる記号は消す。
   * 重なりは#157の修正前の段・列の削除で保存され得た。行優先で先に走査した起点を残す。
   */
  private rebuildOwners(): void {
    this.owners.fill(-1);
    this.occupiedCount = 0;
    for (let index = 0; index < this.cells.length; index++) {
      const value = this.cells[index];
      if (!value) continue;
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (!definition) { this.cells[index] = 0; continue; }
      const row = Math.floor(index / this.cols);
      const col = index % this.cols;
      if (!this.footprintFree(row, col, definition)) { this.cells[index] = 0; continue; }
      this.occupiedCount += 1;
      this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
        this.owners[this.index(targetRow, targetCol)] = index;
      });
    }
  }

  private canFit(row: number, col: number, definition: StitchDefinition): boolean {
    return row >= 0 && col >= 0 && row + definition.height <= this.rows && col + definition.width <= this.cols;
  }

  /** 記号が盤面に収まり、占めるセルがどれも他の記号に占められていないか。 */
  private footprintFree(row: number, col: number, definition: StitchDefinition): boolean {
    if (!this.canFit(row, col, definition)) return false;
    let free = true;
    this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
      if (this.owners[this.index(targetRow, targetCol)] >= 0) free = false;
    });
    return free;
  }

  private eachFootprint(row: number, col: number, definition: StitchDefinition, callback: (row: number, col: number) => void): void {
    for (let y = 0; y < definition.height; y++) for (let x = 0; x < definition.width; x++) callback(row + y, col + x);
  }

  private clearOwner(owner: number): void {
    const value = this.cells[owner];
    if (!value) return;
    const definition = STITCH_BY_ID.get(cellStitchId(value));
    const row = Math.floor(owner / this.cols);
    const col = owner % this.cols;
    this.cells[owner] = 0;
    this.occupiedCount -= 1;
    if (definition) this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
      const index = this.index(targetRow, targetCol);
      if (this.owners[index] === owner) this.owners[index] = -1;
    });
  }

  private transformStructure(axis: 'row' | 'col', index: number, insert: boolean): void {
    const delta = insert ? 1 : -1;
    const nextRows = this.rows + (axis === 'row' ? delta : 0);
    const nextCols = this.cols + (axis === 'col' ? delta : 0);
    // 段・列の増減に線を追従させ、端や列を削除した線は除く。
    const lines = this.lines.filter((line) => insert || (axis === 'row' ? line.top !== index && line.bottom !== index : line.col !== index)).map((line) => {
      const move = (value: number) => value >= index ? value + delta : value;
      return axis === 'row' ? { col: line.col, top: move(line.top), bottom: move(line.bottom) } : { ...line, col: move(line.col) };
    });
    this.relayout(nextRows, nextCols, (row, col, definition) => {
      const coordinate = axis === 'row' ? row : col;
      const span = axis === 'row' ? definition.height : definition.width;
      if (!insert && coordinate <= index && index < coordinate + span) return undefined;
      // 挿入線をまたぐ記号は起点と形を保ち、空きは記号の後ろにできる。
      if (coordinate < index) return { row, col };
      return axis === 'row' ? { row: row + delta, col } : { row, col: col + delta };
    });
    this.guideLines = Object.freeze(normalizeGuideLines(lines, nextRows, nextCols));
  }

  /**
   * 盤面の寸法を変え、各記号の起点を`move`の返す位置へ移す。`undefined`を返した記号と、
   * 移した先で盤面からはみ出す記号は捨てる。
   */
  private relayout(nextRows: number, nextCols: number, move: (row: number, col: number, definition: StitchDefinition) => Point | undefined): void {
    Board.validateSize(nextRows, nextCols);
    const next = new Uint32Array(nextRows * nextCols);
    for (let index = 0; index < this.cells.length; index++) {
      const value = this.cells[index];
      if (!value) continue;
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (!definition) continue;
      const target = move(Math.floor(index / this.cols), index % this.cols, definition);
      if (!target) continue;
      const { row, col } = target;
      if (row >= 0 && col >= 0 && row + definition.height <= nextRows && col + definition.width <= nextCols) {
        next[row * nextCols + col] = value;
      }
    }
    this.rows = nextRows;
    this.cols = nextCols;
    this.cells = next;
    this.owners = new Int32Array(next.length);
    this.rebuildOwners();
  }
}
