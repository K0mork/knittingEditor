import type { Board } from '../model/Board';
import { drawCell } from '../stitches/drawCell';
import { strokeGrid, type GridLineStyle } from '../canvas/strokeGrid';
import type { PdfLayoutOptions } from './pdfLayout';
import { labelStride, showsLabel } from './labels';

const PNG_MAX_SIDE = 16_384;
const PNG_MAX_PIXELS = 64_000_000;

export const PNG_CELL_SIZE_RANGE = { min: 2, max: 60 } as const;
/** 通常の盤面で印刷・共有に足りる既定の1セル画素数。 */
export const PNG_PREFERRED_CELL_SIZE = 24;

/**
 * 既定の1セル画素数を返す。
 *
 * 盤面が大きいと`PNG_PREFERRED_CELL_SIZE`では安全上限を超えるため、
 * その盤面で有効な最大値まで落とす。20×20なら24pxで528×528pxになる。
 */
export function defaultPngCellSize(board: Board, preferred: number = PNG_PREFERRED_CELL_SIZE): number {
  const start = Math.min(Math.max(preferred, PNG_CELL_SIZE_RANGE.min), PNG_CELL_SIZE_RANGE.max);
  for (let size = start; size > PNG_CELL_SIZE_RANGE.min; size -= 1) {
    if (validatePngSize(board, size).valid) return size;
  }
  return PNG_CELL_SIZE_RANGE.min;
}

/** 数字1文字の幅の見積もり（em）。描く前に帯の幅を決めるため、system-uiの数字より少し広めに取る。 */
const PNG_DIGIT_WIDTH = 0.62;
const PNG_LABEL_GAP = 3;

export interface PngLabelLayout {
  fontSize: number;
  /** 左右の段番号の帯の幅と、上下の目番号の帯の高さ（px）。 */
  rowLabelWidth: number;
  colLabelHeight: number;
  rowStride: number;
  colStride: number;
}

/**
 * 段・目番号の帯と間引き。帯は1セル分を基本にし、セルが小さくて番号が入らないときは番号の大きさまで広げる。
 * 隣の番号と重なるときは5・10などの倍数だけを書く。
 */
export function pngLabelLayout(board: Board, cellSize: number): PngLabelLayout {
  const fontSize = Math.max(8, cellSize * 0.34);
  const digitWidth = PNG_DIGIT_WIDTH * fontSize;
  return {
    fontSize,
    rowLabelWidth: Math.max(cellSize, Math.ceil(String(board.rows).length * digitWidth + PNG_LABEL_GAP * 2)),
    colLabelHeight: Math.max(cellSize, Math.ceil(fontSize + PNG_LABEL_GAP * 2)),
    rowStride: labelStride(cellSize, fontSize, PNG_LABEL_GAP),
    colStride: labelStride(cellSize, String(board.cols).length * digitWidth, PNG_LABEL_GAP),
  };
}

export function validatePngSize(board: Board, cellSize: number): { width: number; height: number; valid: boolean; reason?: string } {
  const { rowLabelWidth, colLabelHeight } = pngLabelLayout(board, cellSize);
  const width = board.cols * cellSize + rowLabelWidth * 2;
  const height = board.rows * cellSize + colLabelHeight * 2;
  if (width > PNG_MAX_SIDE || height > PNG_MAX_SIDE) return { width, height, valid: false, reason: `一辺が安全上限${PNG_MAX_SIDE}pxを超えます` };
  if (width * height > PNG_MAX_PIXELS) return { width, height, valid: false, reason: '画像のメモリ使用量が安全上限を超えます' };
  return { width, height, valid: true };
}

/** PNGの罫線。10目・10段ごとの太線は、セルが小さいときは1pxにして記号の邪魔にならないようにする。 */
export function pngGridStyles(cellSize: number): { minor: GridLineStyle; major: GridLineStyle } {
  return {
    minor: { color: '#bbbbbb', width: 1 },
    major: { color: '#666666', width: cellSize >= 12 ? 2 : 1 },
  };
}

export async function renderPng(board: Board, cellSize: number): Promise<Blob> {
  const size = validatePngSize(board, cellSize);
  if (!size.valid) throw new Error(`${size.reason}。PDF保存を利用してください。`);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvasを利用できません');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const labels = pngLabelLayout(board, cellSize);
  // 盤面の左上。四辺の番号の帯の内側に盤面を置く。
  const left = labels.rowLabelWidth;
  const top = labels.colLabelHeight;
  const right = left + board.cols * cellSize;
  const bottom = top + board.rows * cellSize;
  context.font = `${labels.fontSize}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#555';
  for (let col = 0; col < board.cols; col++) {
    const number = board.cols - col;
    if (!showsLabel(number, labels.colStride)) continue;
    const x = left + (col + 0.5) * cellSize;
    context.fillText(String(number), x, top / 2);
    context.fillText(String(number), x, bottom + top / 2);
  }
  for (let row = 0; row < board.rows; row++) {
    const number = board.rows - row;
    if (!showsLabel(number, labels.rowStride)) continue;
    const y = top + (row + 0.5) * cellSize;
    context.fillText(String(number), left / 2, y);
    context.fillText(String(number), right + left / 2, y);
  }
  for (let row = 0; row < board.rows; row++) {
    context.fillStyle = row % 2 === 0 ? '#f3f4f0' : '#fff';
    context.fillRect(left, top + row * cellSize, board.cols * cellSize, cellSize);
  }
  const grid = pngGridStyles(cellSize);
  strokeGrid(
    context,
    { x: left, y: top, cell: cellSize, rows: board.rows, cols: board.cols, firstRow: 0, lastRow: board.rows - 1, firstCol: 0, lastCol: board.cols - 1 },
    grid.minor,
    grid.major,
  );
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const value = board.valueAt(row, col);
      if (value) drawCell(context, value, left + col * cellSize, top + row * cellSize, cellSize);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG生成に失敗しました')), 'image/png'));
}

export async function renderPdf(board: Board, options: PdfLayoutOptions): Promise<Blob> {
  const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
  const cells = board.cells.buffer.slice(0);
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ ok: boolean; pdf?: ArrayBuffer; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.pdf) resolve(new Blob([event.data.pdf], { type: 'application/pdf' }));
      else reject(new Error(event.data.error ?? 'PDF生成に失敗しました'));
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({ rows: board.rows, cols: board.cols, cells, ...options }, [cells]);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
