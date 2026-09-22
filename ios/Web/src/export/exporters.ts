import { Board, cellColor, cellStitchId, colorHex } from '../model/Board';
import { STITCH_BY_ID } from '../stitches/catalog';
import { drawGlyph } from '../stitches/glyphs';
import { iosPlatform } from '../platform';

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

export function validatePngSize(board: Board, cellSize: number): { width: number; height: number; valid: boolean; reason?: string } {
  const width = (board.cols + 2) * cellSize;
  const height = (board.rows + 2) * cellSize;
  if (width > PNG_MAX_SIDE || height > PNG_MAX_SIDE) return { width, height, valid: false, reason: `一辺が安全上限${PNG_MAX_SIDE}pxを超えます` };
  if (width * height > PNG_MAX_PIXELS) return { width, height, valid: false, reason: '画像のメモリ使用量が安全上限を超えます' };
  return { width, height, valid: true };
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
  context.font = `${Math.max(8, cellSize * 0.34)}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#555';
  for (let col = 0; col < board.cols; col++) {
    const label = String(board.cols - col);
    context.fillText(label, (col + 1.5) * cellSize, cellSize / 2);
    context.fillText(label, (col + 1.5) * cellSize, (board.rows + 1.5) * cellSize);
  }
  for (let row = 0; row < board.rows; row++) {
    const label = String(board.rows - row);
    context.fillText(label, cellSize / 2, (row + 1.5) * cellSize);
    context.fillText(label, (board.cols + 1.5) * cellSize, (row + 1.5) * cellSize);
  }
  for (let row = 0; row < board.rows; row++) {
    context.fillStyle = row % 2 === 0 ? '#f3f4f0' : '#fff';
    context.fillRect(cellSize, (row + 1) * cellSize, board.cols * cellSize, cellSize);
  }
  context.beginPath();
  for (let row = 0; row <= board.rows; row++) {
    const y = (row + 1) * cellSize + 0.5;
    context.moveTo(cellSize, y); context.lineTo((board.cols + 1) * cellSize, y);
  }
  for (let col = 0; col <= board.cols; col++) {
    const x = (col + 1) * cellSize + 0.5;
    context.moveTo(x, cellSize); context.lineTo(x, (board.rows + 1) * cellSize);
  }
  context.strokeStyle = '#bbb'; context.stroke();
  for (let row = 0; row < board.rows; row++) {
    for (let col = 0; col < board.cols; col++) {
      const value = board.valueAt(row, col);
      if (!value) continue;
      const stitch = STITCH_BY_ID.get(cellStitchId(value));
      if (!stitch) continue;
      const x = (col + 1) * cellSize;
      const y = (row + 1) * cellSize;
      if (stitch.key === 'erase') { context.fillStyle = '#fff'; context.fillRect(x, y, cellSize, cellSize); continue; }
      drawGlyph(context, stitch.key, x, y, cellSize, colorHex(cellColor(value)));
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG生成に失敗しました')), 'image/png'));
}

export async function renderPdf(board: Board, options: { layout: 'single' | 'tiled'; orientation: 'portrait' | 'landscape'; cellMillimeters: number }): Promise<Blob> {
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

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  await iosPlatform.saveFile(blob, filename);
}
