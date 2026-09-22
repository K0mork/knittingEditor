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

interface PdfGrid {
  pageWidth: number;
  pageHeight: number;
  footer: number;
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
  const availableWidth = pageWidth - PAGE_MARGIN * 2;
  const availableHeight = pageHeight - PAGE_MARGIN * 2 - footer;
  const cellSize = tiled
    ? options.cellMillimeters * POINTS_PER_MILLIMETER
    : Math.min(availableWidth / cols, availableHeight / rows);
  const tileCols = tiled ? Math.max(1, Math.floor(availableWidth / cellSize)) : cols;
  const tileRows = tiled ? Math.max(1, Math.floor(availableHeight / cellSize)) : rows;
  return {
    pageWidth, pageHeight, footer, availableWidth, availableHeight, cellSize, tileRows, tileCols,
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
      if (!tiled) break;
    }
    if (!tiled) break;
  }

  return {
    ...grid,
    margin: PAGE_MARGIN,
    pageRows: tiled ? Math.ceil(rows / grid.stepRows) : 1,
    pageCols: tiled ? Math.ceil(cols / grid.stepCols) : 1,
    pageCount: tiles.length,
    tiles,
  };
}

/** 出力設定の推定表示用。タイルを組み立てずにページ数だけを求める。 */
export function pdfPageCount(rows: number, cols: number, options: PdfLayoutOptions): number {
  if (options.layout === 'single') return 1;
  const { stepRows, stepCols } = pdfGrid(rows, cols, options);
  return Math.ceil(rows / stepRows) * Math.ceil(cols / stepCols);
}
