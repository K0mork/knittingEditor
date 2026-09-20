import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { gunzipSync, strFromU8 } from 'fflate';
import { Board, cellStitchId } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import {
  boardFromDocument, createDocument, exportBackup, importBackup, initializeStorage, saveDocument,
} from './database';

describe('legacy migration', () => {
  beforeAll(() => {
    localStorage.clear();
    localStorage.setItem('knittingChartData', JSON.stringify({
      numRows: 3,
      numCols: 4,
      grid: [
        [{ type: 'knit', color: '#123456' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }],
        [{ type: 'empty' }, { type: 'right_cross', color: '#000000', multi: 2 }, { type: 'empty', isContinuation: true }, { type: 'empty' }],
        [{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }],
      ],
    }));
  });

  it('converts the legacy localStorage chart into the packed model', async () => {
    const { documents, activeId } = await initializeStorage();
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe(activeId);
    expect(documents[0].name).toBe('移行した編み図');
    const board = boardFromDocument(documents[0]);
    expect(cellStitchId(board.valueAt(0, 0))).toBe(STITCH_BY_KEY.get('knit')!.id);
    expect(board.anchorAt(1, 2)).toEqual({ row: 1, col: 1 });
  });
});

describe('backup restore', () => {
  it('round-trips the board and returns the restored document', async () => {
    const source = await createDocument('復元テスト', 3, 4);
    const board = new Board(3, 4);
    board.place(1, 2, 'knit', '#123456', false);
    await saveDocument(source, board);

    const backup = await exportBackup([source.id]);
    const payload = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await backup.arrayBuffer())))) as { stitchCatalogVersion?: number };
    expect(payload.stitchCatalogVersion).toBe(2);
    const result = await importBackup(backup);

    expect(result.count).toBe(1);
    expect(result.documents[0].id).not.toBe(source.id);
    expect(result.documents[0].name).toBe('復元テスト（復元）');
    const restored = boardFromDocument(result.documents[0]);
    expect(restored.valueAt(1, 2)).toBe(board.valueAt(1, 2));
  });
});
