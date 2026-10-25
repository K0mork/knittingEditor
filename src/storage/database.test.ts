import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellStitchId } from '@knitting-editor/editor-core/model/Board';
import { STITCH_BY_KEY } from '@knitting-editor/editor-core/stitches/catalog';
import { boardFromDocument } from '@knitting-editor/editor-core/storage/database';
import { initializeStorage } from './database';

const LEGACY_CHART = JSON.stringify({ numRows: 1, numCols: 2, grid: [[{ type: 'knit', color: '#123456' }, { type: 'empty' }]] });

// 共通の保存・バックアップ検証は packages/editor-core/storage/database.test.ts にある。
// ここは旧Safari版からの移行というWeb限定の経路だけを対象にする。
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

// 移行は起動ごとに1回なので、テストごとに空のIndexedDBと新しいモジュールで始める。
describe('legacy migration transaction', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('knittingChartData', LEGACY_CHART);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function load() {
    const web = await import('./database');
    const shared = await import('@knitting-editor/editor-core/storage/database');
    return { ...web, shared };
  }

  it.each([
    // 移行した記号を含む編み図の書き込み。以前は空の編み図を先に保存していたので、ここで失敗すると空の編み図が残った。
    ['the chart write', (store: IDBObjectStore, value: unknown) => store.name === 'documents'
      && new Uint32Array((value as { cells: ArrayBuffer }).cells).some((cell) => cell !== 0)],
    ['the completion flag', (store: IDBObjectStore, value: unknown) => store.name === 'settings'
      && (value as { key?: string }).key === 'legacyMigrationComplete'],
  ])('leaves no chart when %s fails, then migrates exactly once on the next start', async (_label, matches) => {
    const { migrateLegacyData, shared } = await load();
    const original = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (matches(this, value)) throw new DOMException('injected', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await migrateLegacyData()).toBe(false);
    expect(logged).toHaveBeenCalledWith('旧データの移行に失敗しました', expect.objectContaining({ name: 'QuotaExceededError' }));
    expect(await shared.listDocuments()).toEqual([]);
    expect(await shared.getSetting('activeDocumentId')).toBeUndefined();
    expect(await shared.getSetting('legacyMigrationComplete')).toBeUndefined();
    // 元のデータは残し、次の起動でやり直せるようにする。
    expect(localStorage.getItem('knittingChartData')).toBe(LEGACY_CHART);

    put.mockRestore();
    expect(await migrateLegacyData()).toBe(true);
    expect(await migrateLegacyData()).toBe(false);
    const documents = await shared.listDocuments();
    expect(documents.map((item) => item.name)).toEqual(['移行した編み図']);
    expect(cellStitchId(boardFromDocument(documents[0]).valueAt(0, 0))).toBe(STITCH_BY_KEY.get('knit')!.id);
    expect(await shared.getSetting('activeDocumentId')).toBe(documents[0].id);
  });

  it('migrates the chart once when two starts run at the same time', async () => {
    const { initializeStorage: initialize, migrateLegacyData, shared } = await load();
    expect((await Promise.all([migrateLegacyData(), migrateLegacyData()])).sort()).toEqual([false, true]);
    expect(await shared.listDocuments()).toHaveLength(1);

    const [first, second] = await Promise.all([initialize(), initialize()]);
    expect(first.documents.map((item) => item.id)).toEqual(second.documents.map((item) => item.id));
    expect(first.documents).toHaveLength(1);
    expect(first.activeId).toBe(first.documents[0].id);
    expect(second.activeId).toBe(first.activeId);
  });

  it('migrates once when two first starts initialize storage together', async () => {
    const { initializeStorage: initialize, shared } = await load();
    const [first, second] = await Promise.all([initialize(), initialize()]);
    const documents = await shared.listDocuments();
    expect(documents.map((item) => item.name)).toEqual(['移行した編み図']);
    expect(first.activeId).toBe(documents[0].id);
    expect(second.activeId).toBe(documents[0].id);
  });

  it('records completion without adding a chart when there is no legacy data', async () => {
    localStorage.clear();
    const { migrateLegacyData, shared } = await load();
    expect(await migrateLegacyData()).toBe(false);
    expect(await shared.getSetting('legacyMigrationComplete')).toBe(true);
    expect(await shared.listDocuments()).toEqual([]);
  });
});
