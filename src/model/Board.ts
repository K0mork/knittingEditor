import { STITCH_BY_ID, STITCH_BY_KEY, type StitchDefinition } from '../stitches/catalog';

export const MAX_BOARD_SIZE = 1000;
const TYPE_SHIFT = 24;
const COLOR_MASK = 0x00ff_ffff;

export interface Point { row: number; col: number }
export interface Rect { top: number; left: number; bottom: number; right: number }
export interface BlockAnchor extends Point { value: number }
export interface PatternBlock { id: string; name: string; rows: number; cols: number; anchors: BlockAnchor[]; createdAt: number }

export function parseColor(color: string): number {
  const normalized = color.replace('#', '');
  return Number.parseInt(normalized.padEnd(6, '0').slice(0, 6), 16) & COLOR_MASK;
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

  constructor(rows = 20, cols = 20, cells?: Uint32Array) {
    Board.validateSize(rows, cols);
    this.rows = rows;
    this.cols = cols;
    this.cells = cells?.slice() ?? new Uint32Array(rows * cols);
    if (this.cells.length !== rows * cols) throw new Error('盤面データのサイズが一致しません');
    this.owners = new Int32Array(this.cells.length);
    this.rebuildOwners();
  }

  static validateSize(rows: number, cols: number): void {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > MAX_BOARD_SIZE || cols > MAX_BOARD_SIZE) {
      throw new Error(`段数・列数は1〜${MAX_BOARD_SIZE}で指定してください`);
    }
  }

  index(row: number, col: number): number { return row * this.cols + col; }
  inBounds(row: number, col: number): boolean { return row >= 0 && col >= 0 && row < this.rows && col < this.cols; }
  valueAt(row: number, col: number): number { return this.cells[this.index(row, col)] ?? 0; }
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
    this.cells.fill(0);
    this.owners.fill(-1);
  }

  resize(newRows: number, newCols: number, rowOffset = 0, colOffset = 0): void {
    Board.validateSize(newRows, newCols);
    const next = new Uint32Array(newRows * newCols);
    for (let index = 0; index < this.cells.length; index++) {
      const value = this.cells[index];
      if (!value) continue;
      const oldRow = Math.floor(index / this.cols);
      const oldCol = index % this.cols;
      const row = oldRow + rowOffset;
      const col = oldCol + colOffset;
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (definition && row >= 0 && col >= 0 && row + definition.height <= newRows && col + definition.width <= newCols) {
        next[row * newCols + col] = value;
      }
    }
    this.rows = newRows;
    this.cols = newCols;
    this.cells = next;
    this.owners = new Int32Array(next.length);
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
    let changed = true;
    while (changed) {
      changed = false;
      for (let row = normalized.top; row <= normalized.bottom; row++) {
        for (let col = normalized.left; col <= normalized.right; col++) {
          const anchor = this.anchorAt(row, col);
          if (!anchor) continue;
          const definition = this.definitionAt(row, col)!;
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

  createBlock(rect: Rect, name: string): PatternBlock {
    const selection = this.normalizeSelection(rect);
    const anchors: BlockAnchor[] = [];
    for (let row = selection.top; row <= selection.bottom; row++) {
      for (let col = selection.left; col <= selection.right; col++) {
        const value = this.valueAt(row, col);
        if (value) anchors.push({ row: row - selection.top, col: col - selection.left, value });
      }
    }
    return {
      id: crypto.randomUUID(), name,
      rows: selection.bottom - selection.top + 1,
      cols: selection.right - selection.left + 1,
      anchors, createdAt: Date.now(),
    };
  }

  pasteBlock(block: PatternBlock, top: number, left: number): boolean {
    if (top < 0 || left < 0 || top + block.rows > this.rows || left + block.cols > this.cols) return false;
    const owners = new Set<number>();
    for (let row = top; row < top + block.rows; row++) {
      for (let col = left; col < left + block.cols; col++) {
        const owner = this.ownerAt(row, col);
        if (owner >= 0) owners.add(owner);
      }
    }
    owners.forEach((owner) => this.clearOwner(owner));
    for (const anchor of block.anchors) {
      const definition = STITCH_BY_ID.get(cellStitchId(anchor.value));
      if (definition) this.place(top + anchor.row, left + anchor.col, definition.key, cellColor(anchor.value), false);
    }
    return true;
  }

  private rebuildOwners(): void {
    this.owners.fill(-1);
    for (let index = 0; index < this.cells.length; index++) {
      const value = this.cells[index];
      if (!value) continue;
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (!definition) { this.cells[index] = 0; continue; }
      const row = Math.floor(index / this.cols);
      const col = index % this.cols;
      if (!this.canFit(row, col, definition)) { this.cells[index] = 0; continue; }
      this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
        this.owners[this.index(targetRow, targetCol)] = index;
      });
    }
  }

  private canFit(row: number, col: number, definition: StitchDefinition): boolean {
    return row >= 0 && col >= 0 && row + definition.height <= this.rows && col + definition.width <= this.cols;
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
    if (definition) this.eachFootprint(row, col, definition, (targetRow, targetCol) => {
      const index = this.index(targetRow, targetCol);
      if (this.owners[index] === owner) this.owners[index] = -1;
    });
  }

  private transformStructure(axis: 'row' | 'col', index: number, insert: boolean): void {
    const nextRows = this.rows + (axis === 'row' ? (insert ? 1 : -1) : 0);
    const nextCols = this.cols + (axis === 'col' ? (insert ? 1 : -1) : 0);
    Board.validateSize(nextRows, nextCols);
    const next = new Uint32Array(nextRows * nextCols);
    for (let oldIndex = 0; oldIndex < this.cells.length; oldIndex++) {
      const value = this.cells[oldIndex];
      if (!value) continue;
      let row = Math.floor(oldIndex / this.cols);
      let col = oldIndex % this.cols;
      const coordinate = axis === 'row' ? row : col;
      if (!insert && coordinate === index) continue;
      if (coordinate >= index) {
        if (axis === 'row') row += insert ? 1 : -1;
        else col += insert ? 1 : -1;
      }
      const definition = STITCH_BY_ID.get(cellStitchId(value));
      if (definition && row >= 0 && col >= 0 && row + definition.height <= nextRows && col + definition.width <= nextCols) {
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
