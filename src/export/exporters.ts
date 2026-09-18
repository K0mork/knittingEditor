import { Board, cellColor, cellStitchId, colorHex } from '../model/Board';
import { STITCH_BY_ID, STITCHES, svgDataUrl } from '../stitches/catalog';

const PNG_MAX_SIDE = 16_384;
const PNG_MAX_PIXELS = 64_000_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('記号画像の読込みに失敗しました'));
    image.src = url;
  });
}

async function glyphImages(): Promise<Map<number, HTMLImageElement>> {
  const pairs = await Promise.all(STITCHES.filter((item) => item.key !== 'erase').map(async (item) => [item.id, await loadImage(svgDataUrl(item.key))] as const));
  return new Map(pairs);
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
  const glyphs = await glyphImages();
  const coloredGlyphs = new Map<string, HTMLCanvasElement>();
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
      const image = glyphs.get(stitch.id);
      if (!image) continue;
      const color = colorHex(cellColor(value));
      const cacheKey = `${stitch.id}:${color}`;
      let temporary = coloredGlyphs.get(cacheKey);
      if (!temporary) {
        temporary = document.createElement('canvas');
        temporary.width = Math.ceil(stitch.width * cellSize);
        temporary.height = Math.ceil(stitch.height * cellSize);
        const temporaryContext = temporary.getContext('2d')!;
        temporaryContext.drawImage(image, 0, 0, temporary.width, temporary.height);
        temporaryContext.globalCompositeOperation = 'source-in';
        temporaryContext.fillStyle = color;
        temporaryContext.fillRect(0, 0, temporary.width, temporary.height);
        coloredGlyphs.set(cacheKey, temporary);
      }
      context.drawImage(temporary, x, y);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG生成に失敗しました')), 'image/png'));
}

async function glyphMasks(size = 128): Promise<Array<{ id: number; width: number; height: number; size: number; data: ArrayBuffer }>> {
  const images = await glyphImages();
  const masks = [];
  for (const stitch of STITCHES.filter((item) => item.key !== 'erase')) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(images.get(stitch.id)!, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const packed = new Uint8Array((size * size) / 8);
    for (let index = 0; index < size * size; index++) {
      if (pixels[index * 4 + 3] > 32) packed[index >> 3] |= 1 << (7 - (index & 7));
    }
    masks.push({ id: stitch.id, width: stitch.width, height: stitch.height, size, data: packed.buffer });
  }
  return masks;
}

export async function renderPdf(board: Board, options: { layout: 'single' | 'tiled'; orientation: 'portrait' | 'landscape'; cellMillimeters: number }): Promise<Blob> {
  const glyphs = await glyphMasks();
  const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
  const cells = board.cells.buffer.slice(0);
  const transfers = [cells, ...glyphs.map((item) => item.data)];
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ ok: boolean; pdf?: ArrayBuffer; error?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.pdf) resolve(new Blob([event.data.pdf], { type: 'application/pdf' }));
      else reject(new Error(event.data.error ?? 'PDF生成に失敗しました'));
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({ rows: board.rows, cols: board.cols, cells, glyphs, ...options }, transfers);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
