/**
 * PDFの用紙分割計算。出力設定の「推定ページ数」とPDF Workerの実際の分割が
 * 食い違わないよう、余白・フッター・セル寸法の扱いはここだけに置く。
 */

export interface PdfLayoutOptions {
  layout: 'single' | 'tiled';
  orientation: 'portrait' | 'landscape';
  cellMillimeters: number;
}

export interface PdfTile {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

export interface PdfPageLayout {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  footer: number;
  /** 左右の段番号の帯の幅と、上下の目番号の帯の高さ。PNGと同じく四辺に番号を置く。 */
  rowLabelWidth: number;
  colLabelHeight: number;
  availableWidth: number;
  availableHeight: number;
  cellSize: number;
  tileRows: number;
  tileCols: number;
  /** 隣のページとの重なり1列・1段を差し引いた、1ページごとの前進量。 */
  stepRows: number;
  stepCols: number;
  pageRows: number;
  pageCols: number;
  pageCount: number;
  tiles: PdfTile[];
}

const A4_LONG_SIDE = 841.89;
const A4_SHORT_SIDE = 595.28;
const PAGE_MARGIN = 24;
const TILED_FOOTER = 18;
const POINTS_PER_MILLIMETER = 72 / 25.4;
/** 段・目番号の文字の大きさ（pt）。印刷して読める大きさで固定し、混み合うときは間引く。 */
export const PDF_LABEL_FONT_SIZE = 6;
/** Helveticaの数字の幅（em）。0〜9はすべて同じ幅。 */
const HELVETICA_DIGIT_WIDTH = 0.556;
/** 番号と盤面・帯の端との間隔（pt）。 */
export const PDF_LABEL_GAP = 2;

/** 番号の文字列の幅（pt）。 */
export function pdfLabelWidth(digits: number): number {
  return digits * HELVETICA_DIGIT_WIDTH * PDF_LABEL_FONT_SIZE;
}

interface PdfGrid {
  pageWidth: number;
  pageHeight: number;
  footer: number;
  rowLabelWidth: number;
  colLabelHeight: number;
  availableWidth: number;
  availableHeight: number;
  cellSize: number;
  tileRows: number;
  tileCols: number;
  stepRows: number;
  stepCols: number;
}

function pdfGrid(rows: number, cols: number, options: PdfLayoutOptions): PdfGrid {
  const portrait = options.orientation === 'portrait';
  const tiled = options.layout === 'tiled';
  const pageWidth = portrait ? A4_SHORT_SIDE : A4_LONG_SIDE;
  const pageHeight = portrait ? A4_LONG_SIDE : A4_SHORT_SIDE;
  const footer = tiled ? TILED_FOOTER : 0;
  // 段番号は最大の桁数ぶん、目番号は1行ぶんの帯を盤面の外側に取る。
  const rowLabelWidth = pdfLabelWidth(String(rows).length) + PDF_LABEL_GAP * 2;
  const colLabelHeight = PDF_LABEL_FONT_SIZE + PDF_LABEL_GAP * 2;
  const availableWidth = pageWidth - PAGE_MARGIN * 2 - rowLabelWidth * 2;
  const availableHeight = pageHeight - PAGE_MARGIN * 2 - footer - colLabelHeight * 2;
  const cellSize = tiled
    ? options.cellMillimeters * POINTS_PER_MILLIMETER
    : Math.min(availableWidth / cols, availableHeight / rows);
  const tileCols = tiled ? Math.max(1, Math.floor(availableWidth / cellSize)) : cols;
  const tileRows = tiled ? Math.max(1, Math.floor(availableHeight / cellSize)) : rows;
  return {
    pageWidth, pageHeight, footer, rowLabelWidth, colLabelHeight, availableWidth, availableHeight, cellSize, tileRows, tileCols,
    // 分割時は隣のページと1列・1段だけ重ねて読み継ぎやすくする。
    stepCols: Math.max(1, tileCols - (tiled ? 1 : 0)),
    stepRows: Math.max(1, tileRows - (tiled ? 1 : 0)),
  };
}

export function pdfPageLayout(rows: number, cols: number, options: PdfLayoutOptions): PdfPageLayout {
  const grid = pdfGrid(rows, cols, options);
  const tiled = options.layout === 'tiled';
  const tiles: PdfTile[] = [];
  for (let row = 0; row < rows; row += grid.stepRows) {
    for (let col = 0; col < cols; col += grid.stepCols) {
      tiles.push({
        row, col,
        rows: Math.min(grid.tileRows, rows - row),
        cols: Math.min(grid.tileCols, cols - col),
      });
      if (!tiled || col + grid.tileCols >= cols) break;
    }
    if (!tiled || row + grid.tileRows >= rows) break;
  }

  return {
    ...grid,
    margin: PAGE_MARGIN,
    pageRows: tiled ? axisPageCount(rows, grid.tileRows, grid.stepRows) : 1,
    pageCols: tiled ? axisPageCount(cols, grid.tileCols, grid.stepCols) : 1,
    pageCount: tiles.length,
    tiles,
  };
}

function axisPageCount(length: number, capacity: number, step: number): number {
  return 1 + Math.ceil(Math.max(0, length - capacity) / step);
}

/** 出力設定の推定表示用。タイルを組み立てずにページ数だけを求める。 */
export function pdfPageCount(rows: number, cols: number, options: PdfLayoutOptions): number {
  if (options.layout === 'single') return 1;
  const { tileRows, tileCols, stepRows, stepCols } = pdfGrid(rows, cols, options);
  return axisPageCount(rows, tileRows, stepRows) * axisPageCount(cols, tileCols, stepCols);
}
