/// <reference lib="webworker" />
import { Zlib, strToU8, zlibSync } from 'fflate';
import { STITCH_BY_ID, STITCHES } from '../stitches/catalog';
import { GLYPH_CELL, glyphPdfCommands } from '../stitches/glyphs';
import { cellColor, cellStitchId } from '../model/Board';
import { pdfPageLayout, type PdfLayoutOptions } from './pdfLayout';
import { errorMessage } from '../util/errors';

export interface PdfRequest extends PdfLayoutOptions {
  rows: number;
  cols: number;
  cells: ArrayBuffer;
}

type PdfObject = Uint8Array;
const encoder = new TextEncoder();
const ascii = (value: string) => encoder.encode(value);

function concat(parts: Uint8Array[]): Uint8Array {
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

function escapePdfText(value: string): string { return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)'); }

export function buildPdf(request: PdfRequest): Uint8Array {
  const cells = new Uint32Array(request.cells);
  const { pageWidth, pageHeight, margin, cellSize, tiles } = pdfPageLayout(request.rows, request.cols, request);

  const objects: PdfObject[] = [];
  objects.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(new Uint8Array());
  objects.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));

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
  tiles.forEach((tile, pageIndex) => {
    const originX = margin;
    const originY = pageHeight - margin - tile.rows * cellSize;
    function* pageCommands(): Generator<string> {
      let grid = '0.35 w 0.78 G ';
      for (let row = 0; row <= tile.rows; row++) {
        const y = (originY + row * cellSize).toFixed(3);
        grid += `${originX.toFixed(3)} ${y} m ${(originX + tile.cols * cellSize).toFixed(3)} ${y} l `;
      }
      for (let col = 0; col <= tile.cols; col++) {
        const x = (originX + col * cellSize).toFixed(3);
        grid += `${x} ${originY.toFixed(3)} m ${x} ${(originY + tile.rows * cellSize).toFixed(3)} l `;
      }
      yield `${grid}S\n`;
      for (let localRow = 0; localRow < tile.rows; localRow++) {
        let rowCommands = '';
        const boardRow = tile.row + localRow;
        for (let localCol = 0; localCol < tile.cols; localCol++) {
          const boardCol = tile.col + localCol;
          const value = cells[boardRow * request.cols + boardCol];
          if (!value) continue;
          const stitchId = cellStitchId(value);
          const stitch = STITCH_BY_ID.get(stitchId);
          if (!stitch) continue;
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
      if (request.layout === 'tiled') {
        const label = `Page ${pageIndex + 1}/${tiles.length}  Rows ${request.rows - tile.row}-${request.rows - (tile.row + tile.rows - 1)}  Cols ${request.cols - tile.col}-${request.cols - (tile.col + tile.cols - 1)}`;
        yield `0 g BT /F1 8 Tf ${margin} 10 Td (${escapePdfText(label)}) Tj ET\n`;
      }
    }
    const contentRef = objects.length + 1;
    objects.push(streamObject('', compressChunks(pageCommands())));
    const pageRef = objects.length + 1;
    pageRefs.push(pageRef);
    objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << ${xObjectResources} >> >> /Contents ${contentRef} 0 R >>`));
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
  self.onmessage = (event: MessageEvent<PdfRequest>) => {
    try {
      const pdf = buildPdf(event.data);
      self.postMessage({ ok: true, pdf: pdf.buffer }, { transfer: [pdf.buffer] });
    } catch (error) {
      self.postMessage({ ok: false, error: errorMessage(error) });
    }
  };
}

export {};
