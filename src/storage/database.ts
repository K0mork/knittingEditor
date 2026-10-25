import { Board } from '@knitting-editor/editor-core/model/Board';
import { STITCH_BY_KEY } from '@knitting-editor/editor-core/stitches/catalog';
import {
  createDocumentOnce,
  getSetting,
  initializeStorage as initializePackedStorage,
  setSetting,
  type ChartDocument,
} from '@knitting-editor/editor-core/storage/database';

const LEGACY_KEY = 'knittingChartData';
const MIGRATION_COMPLETE_KEY = 'legacyMigrationComplete';

/**
 * Web-only compatibility migration for the pre-IndexedDB browser editor.
 *
 * 編み図の追加、開く編み図の設定、完了の記録は1つのトランザクションで行う。失敗すれば何も残らず
 * 次の起動でやり直し、2つのタブが同時に始めても移行した編み図は1件だけになる。
 * 元の`localStorage`のデータは消さない。
 */
export async function migrateLegacyData(): Promise<boolean> {
  if (await getSetting<boolean>(MIGRATION_COMPLETE_KEY)) return false;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    await setSetting(MIGRATION_COMPLETE_KEY, true);
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
    return await createDocumentOnce(MIGRATION_COMPLETE_KEY, '移行した編み図', board) !== undefined;
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
