import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board, type PatternBlock } from '../model/Board';
import { STITCH_CATALOG_VERSION } from '../stitches/catalog';

export interface ChartDocument {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: ArrayBuffer;
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
  return new Board(document.rows, document.cols, new Uint32Array(document.cells.slice(0)));
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
  await db.put('documents', document);
  await setSetting('activeDocumentId', document.id);
  return document;
}

export async function saveDocument(document: Pick<ChartDocument, 'id' | 'name' | 'createdAt'>, board: Board): Promise<ChartDocument> {
  const saved: ChartDocument = {
    ...document, rows: board.rows, cols: board.cols,
    cells: board.cells.slice().buffer as ArrayBuffer, updatedAt: Date.now(),
  };
  await (await database()).put('documents', saved);
  return saved;
}

export async function renameDocument(id: string, name: string): Promise<void> {
  const db = await database();
  const document = await db.get('documents', id);
  if (!document) throw new Error('編み図が見つかりません');
  await db.put('documents', { ...document, name, updatedAt: Date.now() });
}

export async function duplicateDocument(id: string): Promise<ChartDocument> {
  const source = await (await database()).get('documents', id);
  if (!source) throw new Error('編み図が見つかりません');
  const now = Date.now();
  const copy: ChartDocument = {
    ...source, id: crypto.randomUUID(), name: `${source.name}のコピー`,
    cells: source.cells.slice(0), createdAt: now, updatedAt: now,
  };
  await (await database()).put('documents', copy);
  return copy;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await database();
  await db.delete('documents', id);
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

export async function initializeStorage(): Promise<{ documents: ChartDocument[]; activeId: string }> {
  let documents = await listDocuments();
  if (documents.length === 0) documents = [await createDocument()];
  const remembered = await getSetting<string>('activeDocumentId');
  const activeId = documents.some((item) => item.id === remembered) ? remembered! : documents[0].id;
  await setSetting('activeDocumentId', activeId);
  return { documents, activeId };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function gunzipWithLimit(data: Uint8Array): Uint8Array {
  if (data.byteLength > BACKUP_LIMITS.maxCompressedBytes) throw new Error('バックアップファイルが大きすぎます');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const gunzip = new Gunzip((chunk) => {
    total += chunk.byteLength;
    if (total > BACKUP_LIMITS.maxDecompressedBytes) throw new Error('解凍後のバックアップが大きすぎます');
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
  const payload = JSON.parse(strFromU8(gunzipWithLimit(new Uint8Array(await file.arrayBuffer())))) as BackupPayload;
  if (payload.format !== 'knitting-editor' || payload.version !== 2 || !Array.isArray(payload.documents)) {
    throw new Error('対応していないバックアップ形式です');
  }
  if (payload.documents.length > BACKUP_LIMITS.maxDocuments || (payload.blocks?.length ?? 0) > BACKUP_LIMITS.maxBlocks) {
    throw new Error('バックアップ内の件数が安全上限を超えています');
  }
  if ((payload.stitchCatalogVersion ?? 1) > STITCH_CATALOG_VERSION) {
    throw new Error('新しい記号カタログで作成されたバックアップです。アプリを更新してください');
  }
  const now = Date.now();
  const restoredDocuments = payload.documents.map((item): ChartDocument => {
    Board.validateSize(item.rows, item.cols);
    if (typeof item.cells !== 'string') throw new Error('盤面データが破損しています');
    const bytes = base64ToBytes(item.cells);
    if (bytes.byteLength !== item.rows * item.cols * Uint32Array.BYTES_PER_ELEMENT) throw new Error('盤面データが破損しています');
    return {
      ...item, id: crypto.randomUUID(), name: `${item.name}（復元）`, cells: bytes.slice().buffer as ArrayBuffer,
      createdAt: now, updatedAt: now,
    };
  });
  const db = await database();
  const transaction = db.transaction(['documents', 'blocks'], 'readwrite');
  for (const document of restoredDocuments) await transaction.objectStore('documents').put(document);
  for (const block of payload.blocks ?? []) {
    if (block.rows < 1 || block.cols < 1 || !Array.isArray(block.anchors)) continue;
    await transaction.objectStore('blocks').put({ ...block, id: crypto.randomUUID(), name: `${block.name}（復元）` });
  }
  await transaction.done;
  return { count: restoredDocuments.length, documents: restoredDocuments };
}
