import { openDB, unwrap, type DBSchema, type IDBPDatabase } from 'idb';
import { Board, cellStitchId, packCell, type PatternBlock } from '../model/Board';
import { STITCH_BY_ID } from '../stitches/catalog';
import { compareDocuments } from './documentOrder';
import { BACKUP_LIMITS } from './backupCodec';
import { runBackupTask } from './backupTask';
export { BACKUP_LIMITS, UNREADABLE_BACKUP_MESSAGE } from './backupCodec';

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

export interface ImportBackupResult {
  count: number;
  documents: ChartDocument[];
}

const DB_NAME = 'knitting-editor-v2';
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
  return values.sort(compareDocuments);
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
  document: Pick<ChartDocument, 'id' | 'name' | 'createdAt' | 'updatedAt'> & Partial<Pick<ChartDocument, 'backgroundColor'>>,
  board: Board,
): Promise<ChartDocument> {
  const db = await database();
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  let saved!: ChartDocument;
  await finishTransaction(transaction, () => new Promise<void>((resolve, reject) => {
    const store = transaction.objectStore('documents');
    const request = unwrap(store).get(document.id);
    request.onerror = () => reject(request.error);
    // 読み出しのイベント内で書き込みを予約し、トランザクションが有効な間に判定と保存を行う。
    request.onsuccess = () => {
      try {
        const current = request.result as ChartDocument | undefined;
        const conflict = !current || current.updatedAt !== document.updatedAt;
        const now = Math.max(Date.now(), (current?.updatedAt ?? document.updatedAt) + 1);
        saved = {
          ...document, rows: board.rows, cols: board.cols,
          cells: board.cells.slice().buffer as ArrayBuffer, updatedAt: now,
          ...(conflict ? { id: crypto.randomUUID(), name: `${document.name}（別のタブの編集）`, createdAt: now } : {}),
        };
        const writes = [store.put(saved)];
        if (conflict) writes.push(transaction.objectStore('settings').put({ key: 'activeDocumentId', value: saved.id }));
        void Promise.all(writes).then(() => resolve(), reject);
      } catch (error) { reject(error); }
    };
  }));
  return saved;
}

export async function renameDocument(id: string, name: string): Promise<ChartDocument> {
  const db = await database();
  const transaction = db.transaction('documents', 'readwrite');
  let renamed!: ChartDocument;
  await finishTransaction(transaction, async () => {
    const document = await transaction.store.get(id);
    if (!document) throw new Error('編み図が見つかりません');
    renamed = { ...document, name, updatedAt: Math.max(Date.now(), document.updatedAt + 1) };
    await transaction.store.put(renamed);
  });
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

/** doneの拒否を直ちに受け取り、書き込みが失敗した場合はその元の理由を返す。 */
async function finishTransaction(transaction: { done: Promise<void>; abort: () => void }, write: () => Promise<void>): Promise<void> {
  const completed = transaction.done.then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
  try {
    await write();
  } catch (error) {
    try { transaction.abort(); } catch { /* すでに中断済み。 */ }
    await completed;
    throw error;
  }
  const result = await completed;
  if (!result.ok) throw result.error;
}

export async function deleteDocument(id: string, nextActiveId?: string): Promise<void> {
  const db = await database();
  // 最後のバックアップ日時も一緒に消し、消した編み図の記録を設定に残さない。
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  await finishTransaction(transaction, async () => {
    await transaction.objectStore('documents').delete(id);
    await transaction.objectStore('settings').delete(lastBackupKey(id));
    if (nextActiveId) await transaction.objectStore('settings').put({ key: 'activeDocumentId', value: nextActiveId });
  });
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
  await finishTransaction(transaction, async () => {
    const ids = documentIds ?? await transaction.objectStore('documents').getAllKeys();
    for (const id of ids) await transaction.objectStore('settings').put({ key: lastBackupKey(id), value: at });
  });
}

export async function initializeStorage(): Promise<{ documents: ChartDocument[]; activeId: string }> {
  let documents = await listDocuments();
  if (documents.length === 0) documents = [await createDocument()];
  const remembered = await getSetting<string>('activeDocumentId');
  const activeId = documents.some((item) => item.id === remembered) ? remembered! : documents[0].id;
  await setSetting('activeDocumentId', activeId);
  return { documents, activeId };
}

export async function exportBackup(documentIds?: string[], snapshot?: ChartDocument, onSnapshot?: (documentIds: string[]) => void): Promise<Blob> {
  const db = await database();
  const documents = documentIds
    ? (await Promise.all([...new Set(documentIds)].map((id) => id === snapshot?.id ? snapshot : db.get('documents', id))))
      .filter((item): item is ChartDocument => item !== undefined)
    : await listDocuments();
  if (snapshot && !documentIds) {
    const index = documents.findIndex((item) => item.id === snapshot.id);
    if (index >= 0) documents[index] = snapshot;
    else documents.push(snapshot);
  }
  onSnapshot?.(documents.map((item) => item.id));
  const blocks = documentIds ? [] : await listBlocks();
  const bytes = await runBackupTask({ operation: 'encode', documents, blocks });
  return new Blob([bytes], { type: 'application/gzip' });
}

export async function importBackup(file: Blob): Promise<ImportBackupResult> {
  if (file.size > BACKUP_LIMITS.maxCompressedBytes) throw new Error('バックアップファイルが大きすぎます');
  const result = await runBackupTask({ operation: 'decode', data: new Uint8Array(await file.arrayBuffer()) });
  const db = await database();
  const transaction = db.transaction(['documents', 'blocks'], 'readwrite');
  await finishTransaction(transaction, async () => {
    for (const document of result.documents) await transaction.objectStore('documents').put(document);
    for (const block of result.blocks) await transaction.objectStore('blocks').put(block);
  });
  return { count: result.count, documents: result.documents };
}
