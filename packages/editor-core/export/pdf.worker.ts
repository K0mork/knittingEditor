import { normalizeGuideLines, type GuideLine } from '../model/guideLines';
import { GUIDE_LINE_SHAPE, guideLineColor } from '../canvas/guideLines';
/// <reference lib="webworker" />
import { exportLegend } from './annotations';
import { Zlib, strToU8, zlibSync } from 'fflate';
import { STITCH_BY_ID, STITCHES } from '../stitches/catalog';
import { GLYPH_CELL, glyphPdfCommands } from '../stitches/glyphs';
import { cellColor, cellStitchId, parseColor } from '../model/Board';
import { boardSurface, DEFAULT_BACKGROUND_COLOR } from '../model/boardColors';
import { PDF_LEGEND_CELL_SIZE, PDF_LEGEND_ROW_PADDING, pdfLegendColumns, pdfLegendRows, type PdfLegendRow, PDF_LABEL_FONT_SIZE, PDF_LABEL_GAP, pdfLabelWidth, pdfPageLayout, type PdfLayoutOptions, type PdfTile } from './pdfLayout';
import { errorMessage } from '../util/errors';
import type { WorkerReadyMessage } from '../util/workerStarter';
import { labelStride, showsLabel } from './labels';
import { majorGridLines } from '../model/gridLines';

export interface PdfRequest extends PdfLayoutOptions {
  rows: number;
  cols: number;
  cells: ArrayBuffer;
  lines?: readonly GuideLine[];
  /** 盤面の地の色（`#rrggbb`）。省略すると白。 */
  background?: string;
}

/** PDF Workerの応答。成功時だけ`pdf`を持つ。 */
export type PdfResponse = { ok: true; pdf: ArrayBuffer } | { ok: false; error: string };

type PdfObject = Uint8Array;
const maxStitchWidth = Math.max(...STITCHES.map((stitch) => stitch.width));
const maxStitchHeight = Math.max(...STITCHES.map((stitch) => stitch.height));
const encoder = new TextEncoder();
const ascii = (value: string) => encoder.encode(value);

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

function streamObject(dictionary: string, stream: Uint8Array): Uint8Array {
  return concat([ascii(`<< ${dictionary} /Length ${stream.byteLength} /Filter /FlateDecode >>\nstream\n`), stream, ascii('\nendstream')]);
}

function compressChunks(chunks: Iterable<string>): Uint8Array {
  const output: Uint8Array[] = [];
  const compressor = new Zlib({ level: 9 }, (chunk) => output.push(chunk.slice()));
  const iterator = chunks[Symbol.iterator]();
  let current = iterator.next();
  while (!current.done) {
    const next = iterator.next();
    compressor.push(strToU8(current.value), next.done);
    current = next;
  }
  return concat(output);
}

/** CID 231〜325のASCIIは500、それ以外は既定の1000単位。 */
export function pdfJapaneseTextWidth(value: string, size = 8): number {
  return Array.from(value).reduce((width, character) => {
    const code = character.codePointAt(0)!;
    return width + (code >= 0x20 && code <= 0x7e ? 0.5 : 1);
  }, 0) * size;
}

/** UniJIS-UCS2-HW-HはBMPの文字を2バイトのコードで指定する。 */
export function pdfJapaneseText(value: string, x: number, y: number, size = 8): string {
  const hex = Array.from({ length: value.length }, (_, index) => value.charCodeAt(index).toString(16).padStart(4, '0')).join('');
  return `0 g BT /F2 ${size} Tf ${x.toFixed(3)} ${y.toFixed(3)} Td <${hex}> Tj ET\n`;
}

export function pdfPageRange(request: PdfRequest, tile: PdfTile, index: number, count: number): string {
  return `${index + 1}/${count}ページ　段${request.rows - tile.row - tile.rows + 1}〜${request.rows - tile.row}　目${request.cols - tile.col - tile.cols + 1}〜${request.cols - tile.col}`;
}

/** 数字の高さの目安（em）。番号を帯の中で上下中央へ置くのに使う。 */
const DIGIT_HEIGHT = 0.72;

const labelText = (value: number, x: number, y: number) => `BT /F1 ${PDF_LABEL_FONT_SIZE} Tf ${x.toFixed(3)} ${y.toFixed(3)} Td (${value}) Tj ET\n`;

/**
 * PNGと同じく、盤面の上下に目番号、左右に段番号を書く。どちらも右下が1。
 * 分割したページでは、そのページに入る段・目の番号を書く。
 */
function tileLabels(tile: PdfTile, request: PdfRequest, originX: number, originY: number, cellSize: number): string {
  const fontSize = PDF_LABEL_FONT_SIZE;
  const colStride = labelStride(cellSize, pdfLabelWidth(String(request.cols).length), PDF_LABEL_GAP);
  const rowStride = labelStride(cellSize, fontSize, PDF_LABEL_GAP);
  const top = originY + tile.rows * cellSize + PDF_LABEL_GAP;
  const bottom = originY - PDF_LABEL_GAP - fontSize * DIGIT_HEIGHT;
  const right = originX + tile.cols * cellSize + PDF_LABEL_GAP;
  let commands = '0.33 g ';
  for (let localCol = 0; localCol < tile.cols; localCol++) {
    const number = request.cols - (tile.col + localCol);
    if (!showsLabel(number, colStride)) continue;
    const x = originX + (localCol + 0.5) * cellSize - pdfLabelWidth(String(number).length) / 2;
    commands += labelText(number, x, top) + labelText(number, x, bottom);
  }
  for (let localRow = 0; localRow < tile.rows; localRow++) {
    const number = request.rows - (tile.row + localRow);
    if (!showsLabel(number, rowStride)) continue;
    const y = originY + (tile.rows - localRow - 0.5) * cellSize - fontSize * DIGIT_HEIGHT / 2;
    const left = originX - PDF_LABEL_GAP - pdfLabelWidth(String(number).length);
    commands += labelText(number, left, y) + labelText(number, right, y);
  }
  return commands;
}

/** 通常の罫線と、10目・10段ごとの太線の太さ（pt）。色は地の色から作る（`boardSurface`）。 */
const PDF_MINOR_GRID_WIDTH = 0.35;
const PDF_MAJOR_GRID_MAX_WIDTH = 0.9;

/** `#rrggbb`をPDFの色の値（0〜1を3つ）にする。 */
function pdfRgb(color: string): string {
  const value = parseColor(color);
  return [16, 8, 0].map((shift) => (((value >> shift) & 255) / 255).toFixed(3)).join(' ');
}

/** 太線の太さ。盤面を1ページに縮めてセルが小さいときは、記号を潰さないよう細くする。 */
export function pdfMajorGridWidth(cellSize: number): number {
  return Math.min(PDF_MAJOR_GRID_MAX_WIDTH, Math.max(0.35, cellSize * 0.07));
}

/**
 * 盤面のマスへ地の色を塗る。白い紙と同じ白い地では塗らない。段・目番号の帯は紙のままにする。
 */
function tileBackground(tile: PdfTile, request: PdfRequest, originX: number, originY: number, cellSize: number): string {
  const background = request.background ?? DEFAULT_BACKGROUND_COLOR;
  if (parseColor(background) === 0xff_ffff) return '';
  return `${pdfRgb(background)} rg ${originX.toFixed(3)} ${originY.toFixed(3)} ${(tile.cols * cellSize).toFixed(3)} ${(tile.rows * cellSize).toFixed(3)} re f\n`;
}

/**
 * ページの罫線。太線は分割したページでも盤面全体の番号の10・20・30…の境目に引く。
 * 通常の線を先に、太線をあとに描き、交点で太線が途切れないようにする。
 */
function tileGrid(tile: PdfTile, request: PdfRequest, originX: number, originY: number, cellSize: number): string {
  const majorRows = new Set(majorGridLines(request.rows, tile.row, tile.rows));
  const majorCols = new Set(majorGridLines(request.cols, tile.col, tile.cols));
  const left = originX.toFixed(3);
  const right = (originX + tile.cols * cellSize).toFixed(3);
  const bottom = originY.toFixed(3);
  const top = (originY + tile.rows * cellSize).toFixed(3);
  // PDFの座標は下が0なので、上から`line`本目の横線は`tile.rows - line`段ぶん上にある。
  const rowLine = (line: number) => { const y = (originY + (tile.rows - line) * cellSize).toFixed(3); return `${left} ${y} m ${right} ${y} l `; };
  const colLine = (line: number) => { const x = (originX + line * cellSize).toFixed(3); return `${x} ${bottom} m ${x} ${top} l `; };
  const surface = boardSurface(request.background ?? DEFAULT_BACKGROUND_COLOR, 'pdf');
  let minor = `${PDF_MINOR_GRID_WIDTH} w ${pdfRgb(surface.minorLine)} RG `;
  for (let line = 0; line <= tile.rows; line++) if (!majorRows.has(line)) minor += rowLine(line);
  for (let line = 0; line <= tile.cols; line++) if (!majorCols.has(line)) minor += colLine(line);
  let commands = `${minor}S\n`;
  if (majorRows.size || majorCols.size) {
    let major = `${pdfMajorGridWidth(cellSize).toFixed(3)} w ${pdfRgb(surface.majorLine)} RG `;
    for (const line of majorRows) major += rowLine(line);
    for (const line of majorCols) major += colLine(line);
    commands += `${major}S\n`;
  }
  return commands;
}

/** PDF座標では下向きが負。指定時は点線の下端に矢印を描く。 */
export function pdfGuideLine(x: number, top: number, bottom: number, cell: number, background: string, arrow: boolean): string {
  if (top <= bottom) return '';
  const size = cell * GUIDE_LINE_SHAPE.arrowLength;
  const halfWidth = cell * GUIDE_LINE_SHAPE.arrowHalfWidth;
  const color = pdfRgb(guideLineColor(background));
  const end = bottom + (arrow ? size : 0);
  let commands = `q ${color} RG ${color} rg ${(cell * GUIDE_LINE_SHAPE.width).toFixed(3)} w [${(cell * GUIDE_LINE_SHAPE.dash).toFixed(3)} ${(cell * GUIDE_LINE_SHAPE.gap).toFixed(3)}] 0 d ${x.toFixed(3)} ${top.toFixed(3)} m ${x.toFixed(3)} ${end.toFixed(3)} l S\n`;
  if (arrow) commands += `[] 0 d ${x.toFixed(3)} ${bottom.toFixed(3)} m ${(x - halfWidth).toFixed(3)} ${(bottom + size).toFixed(3)} l ${(x + halfWidth).toFixed(3)} ${(bottom + size).toFixed(3)} l h f\n`;
  return commands + 'Q\n';
}

/** 点線をタイルで切る。1段重なる分割で矢印が重複しないよう、下端とその1段上を両方含むタイルだけに描く。 */
export function tileGuideLines(tile: PdfTile, request: PdfRequest, x: number, y: number, cell: number): string {
  let commands = '';
  for (const line of request.lines ?? []) {
    if (line.col < tile.col || line.col >= tile.col + tile.cols) continue;
    const top = Math.max(line.top + 1, tile.row);
    const bottom = Math.min(line.bottom, tile.row + tile.rows);
    const arrow = line.bottom - 1 >= tile.row && line.bottom < tile.row + tile.rows;
    commands += pdfGuideLine(x + (line.col - tile.col + 0.5) * cell, y + (tile.rows - top + tile.row) * cell, y + (tile.rows - bottom + tile.row) * cell, cell, request.background ?? DEFAULT_BACKGROUND_COLOR, arrow);
  }
  return commands;
}

export function buildPdf(request: PdfRequest): Uint8Array<ArrayBuffer> {
  const cells = new Uint32Array(request.cells);
  const lines = normalizeGuideLines(request.lines, request.rows, request.cols);
  const legend = request.includeTitleAndLegend ? exportLegend(cells, lines.length > 0) : [];
  const options = { ...request, legendCount: legend.length, legendHeights: legend.map((stitch) => stitch.height) };
  const { pageWidth, pageHeight, margin, titleHeight, legendPageTop, rowLabelWidth, colLabelHeight, cellSize, tiles, legendPages, pageCount } = pdfPageLayout(request.rows, request.cols, options);

  const objects: PdfObject[] = [];
  objects.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(new Uint8Array());
  objects.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  let japaneseFontRef = 0;
  if (request.includeTitleAndLegend || request.layout === 'tiled') {
    japaneseFontRef = objects.length + 1;
    objects.push(ascii(`<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-HW-H /DescendantFonts [${japaneseFontRef + 1} 0 R] >>`));
    objects.push(ascii(`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor ${japaneseFontRef + 2} 0 R /DW 1000 /W [231 325 500] >>`));
    objects.push(ascii('<< /Type /FontDescriptor /FontName /HeiseiKakuGo-W5 /Flags 4 /FontBBox [-92 -250 1010 922] /ItalicAngle 0 /Ascent 752 /Descent -221 /CapHeight 737 /StemV 80 >>'));
  }

  const formRefs = new Map<number, number>();
  for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
    const glyph = glyphPdfCommands(stitch.key);
    if (!glyph) continue;
    const formContent = zlibSync(ascii(glyph.commands), { level: 9 });
    const ref = objects.length + 1;
    formRefs.set(stitch.id, ref);
    objects.push(streamObject(`/Type /XObject /Subtype /Form /BBox [0 0 ${glyph.width} ${glyph.height}]`, formContent));
  }

  const xObjectResources = [...formRefs].map(([id, ref]) => `/S${id} ${ref} 0 R`).join(' ');
  const pageRefs: number[] = [];
  function titleCommands(tiled: boolean): string {
    const title = request.title ?? '';
    const size = Math.min(tiled ? 9 : 14, (pageWidth - margin * 2) / Math.max(1, pdfJapaneseTextWidth(title, 1)));
    return pdfJapaneseText(title, margin, tiled ? pageHeight - 18 : pageHeight - margin - 16, size);
  }

  function* legendCommands(rows: PdfLegendRow[], top: number): Generator<string> {
    const columns = pdfLegendColumns(pageWidth);
    const columnWidth = (pageWidth - margin * 2) / columns;
    for (const row of rows) {
      for (let column = 0; column < row.count; column++) {
        const stitch = legend[row.start + column];
        const x = margin + column * columnWidth;
        const height = stitch.height * PDF_LEGEND_CELL_SIZE;
        const y = top - (row.height - PDF_LEGEND_ROW_PADDING + height) / 2;
        if (stitch.key === 'guide-line') {
          yield pdfGuideLine(x + PDF_LEGEND_CELL_SIZE / 2, top - 4, top - row.height + 12, PDF_LEGEND_CELL_SIZE, '#ffffff', true);
        } else {
          const glyph = glyphPdfCommands(stitch.key)!;
          const scale = PDF_LEGEND_CELL_SIZE / GLYPH_CELL;
          yield tileGrid({ row: 0, col: 0, rows: stitch.height, cols: stitch.width }, { ...request, rows: stitch.height, cols: stitch.width, background: DEFAULT_BACKGROUND_COLOR }, x, y, PDF_LEGEND_CELL_SIZE);
          yield `0 g 0 G q ${scale} 0 0 ${scale} ${x} ${y + height - glyph.height * scale} cm /S${stitch.id} Do Q\n`;
        }
        const nameSize = Math.min(8, (columnWidth - 84) / pdfJapaneseTextWidth(stitch.name, 1));
        yield pdfJapaneseText(stitch.name, x + 84, y + height / 2 - nameSize * (0.752 - 0.221) / 2, nameSize);
      }
      top -= row.height;
    }
  }

  function addPage(commands: Iterable<string>): void {
    const contentRef = objects.length + 1;
    objects.push(streamObject('', compressChunks(commands)));
    const pageRef = objects.length + 1;
    pageRefs.push(pageRef);
    objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R${japaneseFontRef ? ` /F2 ${japaneseFontRef} 0 R` : ''} >> /XObject << ${xObjectResources} >> >> /Contents ${contentRef} 0 R >>`));
  }
  tiles.forEach((tile, pageIndex) => {
    const originX = margin + rowLabelWidth;
    const originY = pageHeight - margin - titleHeight - colLabelHeight - tile.rows * cellSize;
    function* pageCommands(): Generator<string> {
      yield tileBackground(tile, request, originX, originY, cellSize);
      yield tileGrid(tile, request, originX, originY, cellSize);
      yield tileLabels(tile, request, originX, originY, cellSize);
      yield `q ${originX.toFixed(3)} ${originY.toFixed(3)} ${(tile.cols * cellSize).toFixed(3)} ${(tile.rows * cellSize).toFixed(3)} re W n\n`;
      // 幅・高さのある記号は、ページより前の起点からも重なる。
      for (let localRow = Math.max(0, tile.row - maxStitchHeight + 1) - tile.row; localRow < tile.rows; localRow++) {
        let rowCommands = '';
        const boardRow = tile.row + localRow;
        for (let localCol = Math.max(0, tile.col - maxStitchWidth + 1) - tile.col; localCol < tile.cols; localCol++) {
          const boardCol = tile.col + localCol;
          const value = cells[boardRow * request.cols + boardCol];
          if (!value) continue;
          const stitchId = cellStitchId(value);
          const stitch = STITCH_BY_ID.get(stitchId);
          if (!stitch || localRow + stitch.height <= 0 || localCol + stitch.width <= 0) continue;
          if (stitch.renderKind === 'whiteout') {
            const x = originX + localCol * cellSize;
            const y = originY + (tile.rows - localRow - 1) * cellSize;
            rowCommands += `1 1 1 rg ${x.toFixed(3)} ${y.toFixed(3)} ${cellSize.toFixed(3)} ${cellSize.toFixed(3)} re f\n`;
            continue;
          }
          const color = cellColor(value);
          const red = ((color >> 16) & 255) / 255;
          const green = ((color >> 8) & 255) / 255;
          const blue = (color & 255) / 255;
          const x = originX + localCol * cellSize;
          const glyphHeight = stitch.glyph ? stitch.glyph.height / GLYPH_CELL : 1;
          const y = originY + (tile.rows - localRow - glyphHeight) * cellSize;
          const scale = cellSize / GLYPH_CELL;
          rowCommands += `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} RG ${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg q ${scale.toFixed(5)} 0 0 ${scale.toFixed(5)} ${x.toFixed(3)} ${y.toFixed(3)} cm /S${stitchId} Do Q\n`;
        }
        if (rowCommands) yield rowCommands;
      }
      yield tileGuideLines(tile, { ...request, lines }, originX, originY, cellSize);
      yield 'Q\n';
      if (request.includeTitleAndLegend) {
        yield titleCommands(request.layout === 'tiled');
        if (request.layout === 'single') yield* legendCommands(pdfLegendRows(options, pageWidth), originY - colLabelHeight - 8);
      }
      if (request.layout === 'tiled') {
        yield pdfJapaneseText(pdfPageRange(request, tile, pageIndex, pageCount), margin, 10);
      }
    }
    addPage(pageCommands());
  });
  legendPages.forEach((rows, index) => {
    function* commands(): Generator<string> {
      yield titleCommands(false);
      yield* legendCommands(rows, legendPageTop);
      yield pdfJapaneseText(`${tiles.length + index + 1}/${pageCount}ページ`, margin, 10);
    }
    addPage(commands());
  });
  objects[1] = ascii(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);

  const output: Uint8Array[] = [ascii('%PDF-1.7\n%knit\n')];
  const offsets = [0];
  let offset = output[0].byteLength;
  objects.forEach((body, index) => {
    offsets.push(offset);
    const object = concat([ascii(`${index + 1} 0 obj\n`), body, ascii('\nendobj\n')]);
    output.push(object);
    offset += object.byteLength;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  output.push(ascii(xref));
  return concat(output);
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.postMessage({ ready: true } satisfies WorkerReadyMessage);
  self.onmessage = (event: MessageEvent<PdfRequest>) => {
    try {
      const pdf = buildPdf(event.data);
      self.postMessage({ ok: true, pdf: pdf.buffer } satisfies PdfResponse, { transfer: [pdf.buffer] });
    } catch (error) {
      self.postMessage({ ok: false, error: errorMessage(error) } satisfies PdfResponse);
    }
  };
}

export {};
