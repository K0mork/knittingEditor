import 'fake-indexeddb/auto';
import { forceCloseDatabase, IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Board } from '../model/Board';

type DatabaseModule = typeof import('./database');

// 接続はモジュールに1つ覚えるので、テストごとに空のIndexedDBと新しいモジュールを使う。
let open: MockInstance<IDBFactory['open']>;

async function loadDatabase(): Promise<DatabaseModule> {
  return import('./database');
}

/** モジュールが開いた最新の接続（ラップされていないIDBDatabase）。 */
function latestConnection(): IDBDatabase {
  const request = open.mock.results.at(-1)!.value as IDBOpenDBRequest;
  return request.result;
}

/** ブラウザが接続を強制的に閉じたときと同じく、`close`イベントを送って閉じる。 */
function forceClose(connection: IDBDatabase): void {
  // fake-indexeddbの型定義は引数をクラス型で宣言しているが、実際には接続そのものを受け取る。
  forceCloseDatabase(connection as unknown as Parameters<typeof forceCloseDatabase>[0]);
}

function deleteDatabase(): Promise<{ blocked: boolean }> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.deleteDatabase('knitting-editor-v2');
    request.onblocked = () => { blocked = true; };
    request.onsuccess = () => resolve({ blocked });
    request.onerror = () => reject(request.error);
  });
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new FakeIDBFactory());
  open = vi.spyOn(indexedDB, 'open');
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('IndexedDB connection', () => {
  it('reuses one open connection across operations', async () => {
    const database = await loadDatabase();
    await database.listDocuments();
    await database.createDocument('一つ目', 1, 1);
    await database.listDocuments();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('reopens after the browser closes the connection, keeping saved charts', async () => {
    const database = await loadDatabase();
    const created = await database.createDocument('閉じる前', 1, 2);
    forceClose(latestConnection());

    expect((await database.listDocuments()).map((item) => item.id)).toEqual([created.id]);
    expect(open).toHaveBeenCalledTimes(2);

    // 開き直した接続で保存もできる。
    const board = new Board(1, 2);
    board.place(0, 1, 'knit', '#123456', false);
    const saved = await database.saveDocument(created, board);
    expect(saved.id).toBe(created.id);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('closes its connection when another connection deletes the database, then reopens a fresh one', async () => {
    const database = await loadDatabase();
    await database.createDocument('消される編み図', 1, 1);

    await expect(deleteDatabase()).resolves.toEqual({ blocked: false });

    expect(await database.listDocuments()).toEqual([]);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed open and retries on the next operation', async () => {
    const database = await loadDatabase();
    // 新しい版のDBがあると、版1で開こうとして失敗する。
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('knitting-editor-v2', 2);
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    await expect(database.listDocuments()).rejects.toMatchObject({ name: 'VersionError' });

    await deleteDatabase();
    expect(await database.listDocuments()).toEqual([]);
    // テスト内で開いた1回と、モジュールの失敗・成功の2回。
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('keeps the reopened connection when an earlier, closed connection reports late', async () => {
    const database = await loadDatabase();
    await database.listDocuments();
    const first = latestConnection();
    await deleteDatabase();
    await database.listDocuments();
    expect(open).toHaveBeenCalledTimes(2);

    // 古い接続に届いた終了の通知は、開き直した新しい接続を捨てない。
    const closed = vi.fn();
    first.addEventListener('close', closed);
    forceClose(first);
    expect(closed).toHaveBeenCalledTimes(1);
    await database.listDocuments();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
