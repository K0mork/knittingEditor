import { drawGuideLine } from '../canvas/guideLines';
import pdfWorkerUrl from './pdf.worker.ts?worker&url';
import { createWorkerTask } from '../util/workerStarter';
import { annotationHeights, exportLegend, type ExportAnnotations } from './annotations';
import { packCell, type Board } from '../model/Board';
import { boardSurface, DEFAULT_BACKGROUND_COLOR } from '../model/boardColors';
import { drawCell } from '../stitches/drawCell';
import { strokeGrid, type GridLineStyle } from '../canvas/strokeGrid';
import type { PdfLayoutOptions } from './pdfLayout';
import type { PdfRequest, PdfResponse } from './pdf.worker';
import { labelStride, showsLabel } from './labels';

const PNG_MAX_SIDE = 16_384;
const PNG_MAX_PIXELS = 64_000_000;

export const PNG_CELL_SIZE_RANGE = { min: 2, max: 60 } as const;
/** 通常の盤面で印刷・共有に足りる既定の1セル画素数。 */
export const PNG_PREFERRED_CELL_SIZE = 24;

/**
 * 既定の1セル画素数を返す。
 *
 * 盤面が大きいと`PNG_PREFERRED_CELL_SIZE`では上限を超えるため、
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

const pngLegendRowHeight = (cellSize: number) => Math.max(20, cellSize) * 2 + 12;

export function validatePngSize(board: Board, cellSize: number, options: ExportAnnotations = {}): { width: number; height: number; valid: boolean; reason?: string } {
  const { rowLabelWidth, colLabelHeight } = pngLabelLayout(board, cellSize);
  const { titleHeight, legendHeight } = annotationHeights({ ...options, legendCount: options.includeTitleAndLegend ? (options.legendCount ?? exportLegend(board.cells, board.lines.length > 0).length) : 0 }, 40, pngLegendRowHeight(cellSize));
  const width = Math.max(board.cols * cellSize + rowLabelWidth * 2, options.includeTitleAndLegend ? Math.max(560, (Math.max(20, cellSize) * 6 + 200 + 36) * 2) : 0);
  const height = board.rows * cellSize + colLabelHeight * 2 + titleHeight + legendHeight;
  if (width > PNG_MAX_SIDE || height > PNG_MAX_SIDE) return { width, height, valid: false, reason: `一辺が上限${PNG_MAX_SIDE}pxを超えます` };
  if (width * height > PNG_MAX_PIXELS) return { width, height, valid: false, reason: '画像のメモリ使用量が上限を超えます' };
  return { width, height, valid: true };
}

/**
 * PNGの罫線。10目・10段ごとの太線は、セルが小さいときは1pxにして記号の邪魔にならないようにする。
 * 線の色は地の色から作る。
 */
export function pngGridStyles(cellSize: number, background: string = DEFAULT_BACKGROUND_COLOR): { minor: GridLineStyle; major: GridLineStyle } {
  const surface = boardSurface(background, 'png');
  return {
    minor: { color: surface.minorLine, width: 1 },
    major: { color: surface.majorLine, width: cellSize >= 12 ? 2 : 1 },
  };
}

/**
 * 盤面をPNGにする。地の色（`background`）は盤面のマスにだけ塗り、段・目番号の帯は白い紙のままにする。
 */
export async function renderPng(board: Board, cellSize: number, background: string = DEFAULT_BACKGROUND_COLOR, options: ExportAnnotations = {}): Promise<Blob> {
  const legend = options.includeTitleAndLegend ? exportLegend(board.cells, board.lines.length > 0) : [];
  const size = validatePngSize(board, cellSize, { ...options, legendCount: legend.length });
  if (!size.valid) throw new Error(`${size.reason}。PDF保存を利用してください。`);
  const canvas = document.createElement('canvas');
  try {
    return await paintPng(canvas, size, board, cellSize, background, options, legend);
  } finally {
    // 大きな描画面はGCを待たずに縮める。続けて書き出すとき、前の描画面がメモリの上限に数えられないようにする。
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** `canvas`へPNGの内容を描き、エンコードを終えたBlobを返す。 */
async function paintPng(canvas: HTMLCanvasElement, size: { width: number; height: number }, board: Board, cellSize: number, background: string, options: ExportAnnotations, legend: ReturnType<typeof exportLegend>): Promise<Blob> {
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvasを利用できません');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const labels = pngLabelLayout(board, cellSize);
  // 盤面の左上。四辺の番号の帯の内側に盤面を置く。
  const offsetX = (canvas.width - board.cols * cellSize - labels.rowLabelWidth * 2) / 2;
  const left = offsetX + labels.rowLabelWidth;
  const { titleHeight } = annotationHeights({ ...options, legendCount: legend.length }, 40);
  const top = labels.colLabelHeight + titleHeight;
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
    context.fillText(String(number), x, titleHeight + labels.colLabelHeight / 2);
    context.fillText(String(number), x, bottom + labels.colLabelHeight / 2);
  }
  for (let row = 0; row < board.rows; row++) {
    const number = board.rows - row;
    if (!showsLabel(number, labels.rowStride)) continue;
    const y = top + (row + 0.5) * cellSize;
    context.fillText(String(number), offsetX + labels.rowLabelWidth / 2, y);
    context.fillText(String(number), right + labels.rowLabelWidth / 2, y);
  }
  const surface = boardSurface(background, 'png');
  for (let row = 0; row < board.rows; row++) {
    context.fillStyle = row % 2 === 0 ? surface.stripe : surface.background;
    context.fillRect(left, top + row * cellSize, board.cols * cellSize, cellSize);
  }
  const grid = pngGridStyles(cellSize, background);
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
  for (const line of board.lines) drawGuideLine(context, left + (line.col + 0.5) * cellSize, top + (line.top + 1) * cellSize, top + line.bottom * cellSize, cellSize, background);
  if (options.includeTitleAndLegend) {
    context.fillStyle = '#111';
    context.font = '20px system-ui';
    context.textAlign = 'left';
    context.fillText(options.title ?? '', 12, 20, canvas.width - 24);
    legend.forEach((stitch, index) => {
      const x = 12 + (index % 2) * (canvas.width / 2);
      const legendCell = Math.max(20, cellSize);
      const rowHeight = pngLegendRowHeight(cellSize);
      const centerY = bottom + labels.colLabelHeight + 6 + Math.floor(index / 2) * rowHeight + (rowHeight - 12) / 2;
      const y = centerY - stitch.height * legendCell / 2;
      if (stitch.key === 'guide-line') {
        drawGuideLine(context, x + legendCell / 2, centerY - legendCell * 0.75, centerY + legendCell * 0.75, legendCell, '#ffffff');
      } else {
        strokeGrid(context, { x, y, cell: legendCell, rows: stitch.height, cols: stitch.width, firstRow: 0, lastRow: stitch.height - 1, firstCol: 0, lastCol: stitch.width - 1 }, grid.minor, grid.minor);
        drawCell(context, packCell(stitch.id, 0x111111), x, y, legendCell);
      }
      context.fillStyle = '#111';
      context.font = '14px system-ui';
      const nameX = x + legendCell * 6 + 12;
      context.fillText(stitch.name, nameX, centerY, canvas.width / 2 - legendCell * 6 - 36);
    });
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG生成に失敗しました')), 'image/png'));
}

const PDF_WORKER_ERROR = 'PDFを生成できませんでした。もう一度お試しください。';
const pdfTask = createWorkerTask(pdfWorkerUrl);
export const prefetchPdfWorker = pdfTask.preload;

/**
 * 盤面をPDFにする。盤面は呼び出した時点で写し取り、Workerの起動を待つ間に
 * 元に戻す・描くなどで盤面が変わっても、保存を始めた時点の内容を出力する。
 */
export async function renderPdf(board: Board, options: PdfLayoutOptions, background: string = DEFAULT_BACKGROUND_COLOR): Promise<Blob> {
  // セルは写しを取る。線の配列は変更のたびに作り直されて凍結されているので、参照を持てば足りる。
  const cells = board.cells.slice().buffer;
  const request: PdfRequest = { rows: board.rows, cols: board.cols, cells, lines: board.lines, background, ...options };
  return pdfTask.run<PdfResponse, Blob>((worker) => {
    // 写しは起動確認後に1回だけ転送する。
    worker.postMessage(request, [cells]);
  }, (data) => {
    if (!data.ok || !data.pdf) throw new Error((!data.ok && data.error?.trim()) || PDF_WORKER_ERROR);
    return new Blob([data.pdf], { type: 'application/pdf' });
  }, PDF_WORKER_ERROR);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
