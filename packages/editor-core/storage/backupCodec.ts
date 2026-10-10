import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board, cellStitchId, MAX_BOARD_SIZE, packCell, type BlockAnchor, type PatternBlock } from '../model/Board';
import { normalizeBackgroundColor } from '../model/boardColors';
import { STITCH_BY_ID, STITCH_CATALOG_VERSION, type StitchDefinition } from '../stitches/catalog';
import { base64ToBytes, bytesToBase64 } from '../util/base64';
import type { ChartDocument, ImportBackupResult } from './database';

interface BackupDocument extends Omit<ChartDocument, 'cells'> { cells: string }
interface BackupPayload {
  format: 'knitting-editor';
  version: 2;
  stitchCatalogVersion?: number;
  exportedAt: string;
  documents: BackupDocument[];
  blocks: PatternBlock[];
}

export const BACKUP_LIMITS = {
  maxCompressedBytes: 32 * 1024 * 1024,
  maxDecompressedBytes: 256 * 1024 * 1024,
  maxDocuments: 500,
  maxBlocks: 5_000,
  maxBlockAnchors: MAX_BOARD_SIZE * MAX_BOARD_SIZE,
} as const;
/**
 * 記号が占めるセルを`occupied`へ登録する。すでに別の記号が占めていれば`message`で失敗させる。
 * 盤面とブロックの復元で、壊れたデータの重なりを同じ規則で弾く。
 */
function claimFootprint(occupied: Set<number>, cols: number, row: number, col: number, definition: StitchDefinition, message: string): void {
  for (let y = 0; y < definition.height; y++) {
    for (let x = 0; x < definition.width; x++) {
      const footprintIndex = (row + y) * cols + col + x;
      if (occupied.has(footprintIndex)) throw new Error(message);
      occupied.add(footprintIndex);
    }
  }
}

function validatePackedCells(rows: number, cols: number, bytes: Uint8Array): void {
  if (bytes.byteLength % Uint32Array.BYTES_PER_ELEMENT !== 0) throw new Error('盤面データが破損しています');
  const cells = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT);
  const legacyEncoding = cells.every((value) => value === 0 || (cellStitchId(value) === 0 && STITCH_BY_ID.has(value)));
  if (legacyEncoding) return;
  const occupied = new Set<number>();
  for (let index = 0; index < cells.length; index++) {
    const value = cells[index];
    if (!value) continue;
    const definition = cellDefinition(value);
    if (!definition) throw new Error('未対応の記号が盤面に含まれています');
    const row = Math.floor(index / cols);
    const col = index % cols;
    if (row + definition.height > rows || col + definition.width > cols) {
      throw new Error('盤面データが破損しています');
    }
    claimFootprint(occupied, cols, row, col, definition, '盤面データが重複しています');
  }
}

function cellDefinition(value: number): StitchDefinition | undefined {
  return STITCH_BY_ID.get(cellStitchId(value)) ?? (cellStitchId(value) === 0 ? STITCH_BY_ID.get(value) : undefined);
}

function restoreBlock(value: unknown, now: number): PatternBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ブロックデータが破損しています');
  const block = value as Partial<PatternBlock>;
  if (typeof block.name !== 'string' || !block.name.trim()
      || typeof block.rows !== 'number' || typeof block.cols !== 'number'
      || !Number.isInteger(block.rows) || !Number.isInteger(block.cols)
      || block.rows < 1 || block.cols < 1 || block.rows > MAX_BOARD_SIZE || block.cols > MAX_BOARD_SIZE
      || !Array.isArray(block.anchors)) {
    throw new Error('ブロックデータが破損しています');
  }
  const rows = block.rows;
  const cols = block.cols;
  const occupied = new Set<number>();
  const anchors: BlockAnchor[] = [];
  for (const value of block.anchors) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ブロックデータが破損しています');
    const anchor = value as Partial<BlockAnchor>;
    if (typeof anchor.row !== 'number' || typeof anchor.col !== 'number'
        || typeof anchor.value !== 'number'
        || !Number.isInteger(anchor.row) || !Number.isInteger(anchor.col)
        || anchor.row < 0 || anchor.col < 0
        || anchor.row >= rows || anchor.col >= cols
        || !Number.isSafeInteger(anchor.value) || anchor.value! < 1 || anchor.value! > 0xffff_ffff) {
      throw new Error('ブロックデータが破損しています');
    }
    const row = anchor.row;
    const col = anchor.col;
    const packedValue = anchor.value;
    const definition = cellDefinition(packedValue);
    if (!definition || row + definition.height > rows || col + definition.width > cols) {
      throw new Error('ブロックに未対応または不正な記号が含まれています');
    }
    claimFootprint(occupied, cols, row, col, definition, 'ブロックの記号が重複しています');
    anchors.push({ row, col, value: cellStitchId(packedValue) === 0 ? packCell(packedValue, 0) : packedValue });
  }
  return {
    id: crypto.randomUUID(),
    name: `${block.name.trim()}（復元）`,
    rows,
    cols,
    anchors,
    createdAt: now,
  };
}

/** 大きさの上限を超えたバックアップ。理由をそのまま利用者へ伝える。 */
class BackupLimitError extends Error {}

/**
 * 壊れたファイルや`.knit`以外のファイルを復元しようとしたときの理由。解凍やJSONの読み取りで出る
 * ライブラリ・ブラウザのエラーは英語なので、利用者にはこちらを見せる。
 */
export const UNREADABLE_BACKUP_MESSAGE = 'バックアップを読み込めませんでした。ファイルが壊れているか、.knitのバックアップではありません';

export function gunzipWithLimit(data: Uint8Array, limit = BACKUP_LIMITS.maxDecompressedBytes as number): Uint8Array {
  if (data.byteLength > BACKUP_LIMITS.maxCompressedBytes) throw new BackupLimitError('バックアップファイルが大きすぎます');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const gunzip = new Gunzip((chunk) => {
    total += chunk.byteLength;
    if (total > limit) throw new BackupLimitError('解凍後のバックアップが大きすぎます');
    chunks.push(chunk.slice());
  });
  // 小さな圧縮入力でも大きく展開されるため、入力を細かく分けて上限を確認する。
  for (let offset = 0; offset < data.length; offset += 256) {
    gunzip.push(data.subarray(offset, offset + 256), offset + 256 >= data.length);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** `.knit`を解凍してJSONとして読む。上限を超えたとき以外の失敗は、`UNREADABLE_BACKUP_MESSAGE`にする。 */
function readBackupPayload(data: Uint8Array): unknown {
  let text: string;
  try {
    text = strFromU8(gunzipWithLimit(data));
  } catch (error) {
    if (error instanceof BackupLimitError) throw error;
    throw new Error(UNREADABLE_BACKUP_MESSAGE);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(UNREADABLE_BACKUP_MESSAGE);
  }
}

export function encodeBackup(documents: ChartDocument[], blocks: PatternBlock[]): Uint8Array<ArrayBuffer> {
  const payload: BackupPayload = {
    format: 'knitting-editor', version: 2, stitchCatalogVersion: STITCH_CATALOG_VERSION, exportedAt: new Date().toISOString(),
    documents: documents.map((item) => ({ ...item, cells: bytesToBase64(new Uint8Array(item.cells)) })), blocks,
  };
  return gzipSync(strToU8(JSON.stringify(payload)));
}

export function decodeBackup(data: Uint8Array): ImportBackupResult & { blocks: PatternBlock[] } {
  const parsed = readBackupPayload(data);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('対応していないバックアップ形式です');
  const payload = parsed as BackupPayload;
  if (payload.format !== 'knitting-editor' || payload.version !== 2 || !Array.isArray(payload.documents)) {
    throw new Error('対応していないバックアップ形式です');
  }
  if (payload.blocks !== undefined && !Array.isArray(payload.blocks)) {
    throw new Error('バックアップ形式が不正です');
  }
  const blocks = payload.blocks ?? [];
  if (payload.documents.length > BACKUP_LIMITS.maxDocuments || blocks.length > BACKUP_LIMITS.maxBlocks) {
    throw new Error('バックアップ内の件数が上限を超えています');
  }
  if ((payload.stitchCatalogVersion ?? 1) > STITCH_CATALOG_VERSION) {
    throw new Error('新しい記号カタログで作成されたバックアップです。アプリを更新してください');
  }
  const now = Date.now();
  const restoredDocuments = payload.documents.map((item): ChartDocument => {
    if (!item || typeof item.name !== 'string' || !Number.isInteger(item.rows) || !Number.isInteger(item.cols)) {
      throw new Error('編み図データが破損しています');
    }
    Board.validateSize(item.rows, item.cols);
    if (typeof item.cells !== 'string') throw new Error('盤面データが破損しています');
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = base64ToBytes(item.cells);
    } catch {
      throw new Error('盤面データが破損しています');
    }
    if (bytes.byteLength !== item.rows * item.cols * Uint32Array.BYTES_PER_ELEMENT) throw new Error('盤面データが破損しています');
    validatePackedCells(item.rows, item.cols, bytes);
    // 地の色が壊れていても編み図は捨てず、白い地として復元する。
    const { backgroundColor: rawBackground, ...rest } = item;
    const backgroundColor = normalizeBackgroundColor(rawBackground);
    return {
      ...rest, ...(backgroundColor ? { backgroundColor } : {}),
      id: crypto.randomUUID(), name: `${item.name}（復元）`, cells: bytes.slice().buffer as ArrayBuffer,
      createdAt: now, updatedAt: now,
    };
  });
  const restoredBlocks = blocks.map((block) => restoreBlock(block, now));
  const anchorCount = restoredBlocks.reduce((total, block) => total + block.anchors.length, 0);
  if (anchorCount > BACKUP_LIMITS.maxBlockAnchors) throw new Error('バックアップ内の記号数が上限を超えています');
  return { count: restoredDocuments.length, documents: restoredDocuments, blocks: restoredBlocks };
}
