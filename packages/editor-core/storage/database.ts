import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board, cellStitchId, MAX_BOARD_SIZE, packCell, type BlockAnchor, type PatternBlock } from '../model/Board';
import { normalizeBackgroundColor } from '../model/boardColors';
import { STITCH_BY_ID, STITCH_CATALOG_VERSION, type StitchDefinition } from '../stitches/catalog';
import { base64ToBytes, bytesToBase64 } from '../util/base64';

export interface ChartDocument {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: ArrayBuffer;
  /**
   * 盤面の地の色（`#rrggbb`）。選んでいない編み図には無く、白として描く（`backgroundColorOf`）。
   * `.knit`にもそのまま入る。この項目を知らない古い版で読み込んでも、白い地で表示されるだけになる。
   */
  backgroundColor?: string;
  createdAt: number;
  updatedAt: number;
}

interface SettingsRecord { key: string; value: string | boolean | number }

interface KnittingDB extends DBSchema {
  documents: { key: string; value: ChartDocument; indexes: { updatedAt: number } };
  blocks: { key: string; value: PatternBlock; indexes: { createdAt: number } };
  settings: { key: string; value: SettingsRecord };
}

interface BackupDocument extends Omit<ChartDocument, 'cells'> { cells: string }
interface BackupPayload {
  format: 'knitting-editor';
  version: 2;
  stitchCatalogVersion?: number;
  exportedAt: string;
  documents: BackupDocument[];
  blocks: PatternBlock[];
}

export interface ImportBackupResult {
  count: number;
  documents: ChartDocument[];
}

const DB_NAME = 'knitting-editor-v2';
export const BACKUP_LIMITS = {
  maxCompressedBytes: 32 * 1024 * 1024,
  maxDecompressedBytes: 256 * 1024 * 1024,
  maxDocuments: 500,
  maxBlocks: 5_000,
  maxBlockAnchors: MAX_BOARD_SIZE * MAX_BOARD_SIZE,
} as const;
let databasePromise: Promise<IDBPDatabase<KnittingDB>> | undefined;

function database(): Promise<IDBPDatabase<KnittingDB>> {
  databasePromise ??= openDB<KnittingDB>(DB_NAME, 1, {
    upgrade(db) {
      const documents = db.createObjectStore('documents', { keyPath: 'id' });
      documents.createIndex('updatedAt', 'updatedAt');
      const blocks = db.createObjectStore('blocks', { keyPath: 'id' });
      blocks.createIndex('createdAt', 'createdAt');
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return databasePromise;
}

export function boardFromDocument(document: ChartDocument): Board {
  const cells = new Uint32Array(document.cells.slice(0));
  for (let index = 0; index < cells.length; index++) {
    const value = cells[index];
    if (value !== 0 && cellStitchId(value) === 0 && STITCH_BY_ID.has(value)) {
      cells[index] = packCell(value, 0);
    }
  }
  return new Board(document.rows, document.cols, cells);
}

export async function listDocuments(): Promise<ChartDocument[]> {
  const values = await (await database()).getAll('documents');
  return values.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createDocument(name = '新しい編み図', rows = 20, cols = 20): Promise<ChartDocument> {
  const board = new Board(rows, cols);
  const now = Date.now();
  const document: ChartDocument = {
    id: crypto.randomUUID(), name, rows, cols,
    cells: board.cells.slice().buffer as ArrayBuffer, createdAt: now, updatedAt: now,
  };
  const db = await database();
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  try {
    await transaction.objectStore('documents').put(document);
    await transaction.objectStore('settings').put({ key: 'activeDocumentId', value: document.id });
    await transaction.done;
  } catch (error) {
    try { transaction.abort(); } catch { /* すでに中止されたトランザクション。 */ }
    await transaction.done.catch(() => undefined);
    throw error;
  }
  return document;
}

export async function saveDocument(
  document: Pick<ChartDocument, 'id' | 'name' | 'createdAt'> & Partial<Pick<ChartDocument, 'backgroundColor'>>,
  board: Board,
): Promise<ChartDocument> {
  const saved: ChartDocument = {
    ...document, rows: board.rows, cols: board.cols,
    cells: board.cells.slice().buffer as ArrayBuffer, updatedAt: Date.now(),
  };
  await (await database()).put('documents', saved);
  return saved;
}

export async function renameDocument(id: string, name: string): Promise<ChartDocument> {
  const db = await database();
  const document = await db.get('documents', id);
  if (!document) throw new Error('編み図が見つかりません');
  const renamed = { ...document, name, updatedAt: Date.now() };
  await db.put('documents', renamed);
  return renamed;
}

export async function duplicateDocument(id: string, snapshot?: ChartDocument): Promise<ChartDocument> {
  const source = snapshot ?? await (await database()).get('documents', id);
  if (!source) throw new Error('編み図が見つかりません');
  const now = Date.now();
  const copy: ChartDocument = {
    ...source, id: crypto.randomUUID(), name: `${source.name}のコピー`,
    cells: source.cells.slice(0), createdAt: now, updatedAt: now,
  };
  await (await database()).put('documents', copy);
  return copy;
}

export async function deleteDocument(id: string, nextActiveId?: string): Promise<void> {
  const db = await database();
  // 最後のバックアップ日時も一緒に消し、消した編み図の記録を設定に残さない。
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  try {
    await transaction.objectStore('documents').delete(id);
    await transaction.objectStore('settings').delete(lastBackupKey(id));
    if (nextActiveId) await transaction.objectStore('settings').put({ key: 'activeDocumentId', value: nextActiveId });
    await transaction.done;
  } catch (error) {
    try { transaction.abort(); } catch { /* すでに中止されたトランザクション。 */ }
    await transaction.done.catch(() => undefined);
    throw error;
  }
}

export async function listBlocks(): Promise<PatternBlock[]> {
  const values = await (await database()).getAll('blocks');
  return values.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBlock(block: PatternBlock): Promise<void> { await (await database()).put('blocks', block); }
export async function deleteBlock(id: string): Promise<void> { await (await database()).delete('blocks', id); }

export async function getSetting<T extends SettingsRecord['value']>(key: string): Promise<T | undefined> {
  return (await (await database()).get('settings', key))?.value as T | undefined;
}

export async function setSetting(key: string, value: SettingsRecord['value']): Promise<void> {
  await (await database()).put('settings', { key, value });
}

/**
 * 最後に`.knit`を書き出した日時の設定キー。編み図ごとに1件持つ。
 *
 * 編み図の記録（`ChartDocument`）には入れない。入れると`.knit`へ書き出され、復元した
 * 編み図が「書き出し済み」の日時を持ち込んでしまう。設定に置けば保存形式も`.knit`も
 * 変わらず、記録の無い既存の編み図は「まだバックアップしていない」として読める。
 */
export function lastBackupKey(documentId: string): string {
  return `lastBackupAt:${documentId}`;
}

/** 編み図を最後に`.knit`へ書き出した日時。まだ書き出していなければ`undefined`。 */
export async function getLastBackupAt(documentId: string): Promise<number | undefined> {
  const value = await getSetting(lastBackupKey(documentId));
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * `.knit`へ書き出した編み図の日時を記録する。`documentIds`を省くと、今ある全編み図を記録する。
 * 全データの書き出しでも1回の書き込みで済むよう、1つのトランザクションにまとめる。
 */
export async function recordBackup(documentIds: string[] | undefined, at: number): Promise<void> {
  const db = await database();
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  const ids = documentIds ?? await transaction.objectStore('documents').getAllKeys();
  for (const id of ids) await transaction.objectStore('settings').put({ key: lastBackupKey(id), value: at });
  await transaction.done;
}

export async function initializeStorage(): Promise<{ documents: ChartDocument[]; activeId: string }> {
  let documents = await listDocuments();
  if (documents.length === 0) documents = [await createDocument()];
  const remembered = await getSetting<string>('activeDocumentId');
  const activeId = documents.some((item) => item.id === remembered) ? remembered! : documents[0].id;
  await setSetting('activeDocumentId', activeId);
  return { documents, activeId };
}

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

function gunzipWithLimit(data: Uint8Array): Uint8Array {
  if (data.byteLength > BACKUP_LIMITS.maxCompressedBytes) throw new BackupLimitError('バックアップファイルが大きすぎます');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const gunzip = new Gunzip((chunk) => {
    total += chunk.byteLength;
    if (total > BACKUP_LIMITS.maxDecompressedBytes) throw new BackupLimitError('解凍後のバックアップが大きすぎます');
    chunks.push(chunk.slice());
  });
  gunzip.push(data, true);
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

export async function exportBackup(documentIds?: string[]): Promise<Blob> {
  const documents = (await listDocuments()).filter((item) => !documentIds || documentIds.includes(item.id));
  const blocks = documentIds ? [] : await listBlocks();
  const payload: BackupPayload = {
    format: 'knitting-editor', version: 2, stitchCatalogVersion: STITCH_CATALOG_VERSION, exportedAt: new Date().toISOString(),
    documents: documents.map((item) => ({ ...item, cells: bytesToBase64(new Uint8Array(item.cells)) })),
    blocks,
  };
  return new Blob([gzipSync(strToU8(JSON.stringify(payload)))], { type: 'application/gzip' });
}

export async function importBackup(file: Blob): Promise<ImportBackupResult> {
  const parsed = readBackupPayload(new Uint8Array(await file.arrayBuffer()));
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
  const db = await database();
  const transaction = db.transaction(['documents', 'blocks'], 'readwrite');
  for (const document of restoredDocuments) await transaction.objectStore('documents').put(document);
  for (const block of restoredBlocks) await transaction.objectStore('blocks').put(block);
  await transaction.done;
  return { count: restoredDocuments.length, documents: restoredDocuments };
}
