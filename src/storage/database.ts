import { Board } from '@knitting-editor/editor-core/model/Board';
import { STITCH_BY_KEY } from '@knitting-editor/editor-core/stitches/catalog';
import {
  createDocument,
  getSetting,
  initializeStorage as initializePackedStorage,
  saveDocument,
  setSetting,
  type ChartDocument,
} from '@knitting-editor/editor-core/storage/database';

const LEGACY_KEY = 'knittingChartData';

/** Web-only compatibility migration for the pre-IndexedDB browser editor. */
export async function migrateLegacyData(): Promise<boolean> {
  if (await getSetting<boolean>('legacyMigrationComplete')) return false;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    await setSetting('legacyMigrationComplete', true);
    return false;
  }
  try {
    const legacy = JSON.parse(raw) as {
      numRows?: number;
      numCols?: number;
      grid?: Array<Array<{
        type?: string;
        color?: string;
        isContinuation?: boolean;
        isContinuationVertical?: boolean;
      }>>;
    };
    const rows = Math.min(1000, Math.max(1, Number(legacy.numRows) || 20));
    const cols = Math.min(1000, Math.max(1, Number(legacy.numCols) || 20));
    const board = new Board(rows, cols);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = legacy.grid?.[row]?.[col];
        if (!cell?.type || cell.type === 'empty' || cell.isContinuation || cell.isContinuationVertical) continue;
        if (STITCH_BY_KEY.has(cell.type)) board.place(row, col, cell.type, cell.color ?? '#000000', false);
      }
    }
    const document = await createDocument('移行した編み図', rows, cols);
    await saveDocument(document, board);
    await setSetting('legacyMigrationComplete', true);
    return true;
  } catch (error) {
    console.error('旧データの移行に失敗しました', error);
    return false;
  }
}

/** 旧データを移行してから共通の初期化を行う。Web版の起動はこちらを使う。 */
export async function initializeStorage(): Promise<{ documents: ChartDocument[]; activeId: string }> {
  await migrateLegacyData();
  return initializePackedStorage();
}
