import { expect, test, type Page } from './fixtures';

/**
 * 既定サイズ変更前のv2/version 1の保存形式を固定する。アプリの生成・保存・packCellは使わない。
 * cellsは行優先のUint32ArrayをArrayBufferにしたもの。上位8bitが記号ID、下位24bitがRGB。
 * 複数マスの記号も起点だけに値を置き、残りは0。fill/assignは固定値の空白を展開するだけ。
 * Playwrightへ渡すときだけ通常配列にし、ブラウザ内で保存時と同じArrayBufferへ戻す。
 */
const storedDocuments = [
  {
    id: 'stored-chart-tall', name: '保存済みの縦長模様', rows: 37, cols: 23,
    cells: Object.assign(Array<number>(851).fill(0), {
      0: 0x01d33c32, // (0,0): ID 1 表目、赤 #d33c32。
      26: 0x02000000, // (1,3): ID 2 裏目、黒。
      245: 0x07336699, // (10,15): ID 7 右上交差、横2マス、青 #336699。
      805: 0x16008000, // (35,0): ID 22 すべり目、縦2マス、緑 #008000。
      850: 0x03000000, // (36,22): ID 3 かけ目、黒。最終段・最終列にも記号を残す。
    }),
    backgroundColor: '#fff4df',
    guideLines: [{ col: 6, top: 2, bottom: 35 }, { col: 22, top: 0, bottom: 36 }],
    // 未指定時に選ばれる更新順の先頭と、記憶した2件目を別にしてactiveDocumentId無視も検出する。
    createdAt: 1_760_000_000_000, updatedAt: 1_760_000_050_000,
  },
  {
    id: 'stored-chart-wide', name: '保存済みの横長模様', rows: 8, cols: 120,
    cells: Object.assign(Array<number>(960).fill(0), {
      0: 0x02000000, // (0,0): ID 2 裏目、黒。
      179: 0x08336699, // (1,59): ID 8 左上交差、横2マス。60目への縮小も検出する。
      838: 0x16d33c32, // (6,118): ID 22 すべり目、縦2マス、赤。
      959: 0x01008000, // (7,119): ID 1 表目、緑。最終段・最終列。
    }),
    backgroundColor: '#e8f4ff',
    guideLines: [{ col: 119, top: 0, bottom: 7 }],
    createdAt: 1_760_000_020_000, updatedAt: 1_760_000_030_000,
  },
];

const storedBlocks = [{
  id: 'stored-block', name: '保存済みの交差ブロック', rows: 3, cols: 4,
  anchors: [
    { row: 0, col: 0, value: 0x07336699 }, // ID 7 右上交差、横2マス、青。
    { row: 1, col: 3, value: 0x16d33c32 }, // ID 22 すべり目、縦2マス、赤。
    { row: 2, col: 0, value: 0x02000000 }, // ID 2 裏目、黒。
  ],
  lines: [{ col: 2, top: 0, bottom: 2 }],
  createdAt: 1_760_000_040_000,
}];

type StoredDocument = Omit<typeof storedDocuments[number], 'cells'> & { cells: ArrayBuffer };
type StoredBlock = typeof storedBlocks[number];

/** アプリを含まない同一originでDBを新規作成し、全レコードのコミットまで待つ。 */
async function seedStoredCharts(page: Page) {
  const response = await page.goto('/robots.txt');
  expect(response?.ok()).toBe(true);
  // SPAへのフォールバックで先にアプリが起動してしまう構成になったら、ここで失敗させる。
  expect(response?.headers()['content-type']).toContain('text/plain');
  expect(await page.locator('script').count()).toBe(0);
  await page.evaluate(async ({ documents, blocks }) => {
    const request = indexedDB.open('knitting-editor-v2', 1);
    let created = false;
    request.onupgradeneeded = () => {
      created = true;
      const db = request.result;
      const documents = db.createObjectStore('documents', { keyPath: 'id' });
      documents.createIndex('updatedAt', 'updatedAt');
      const blocks = db.createObjectStore('blocks', { keyPath: 'id' });
      blocks.createIndex('createdAt', 'createdAt');
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('保存済みDBの作成がブロックされました'));
    });
    try {
      // fixtureが将来DBを先に作るようになっても、既存DBを消して隠さずに失敗させる。
      if (!created) throw new Error('アプリ起動前に新規DBを作成できませんでした');
      const transaction = db.transaction(['documents', 'blocks', 'settings'], 'readwrite');
      const completed = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('固定レコードの保存が中止されました'));
        transaction.onerror = () => reject(transaction.error);
      });
      for (const document of documents) {
        transaction.objectStore('documents').add({ ...document, cells: new Uint32Array(document.cells).buffer });
      }
      for (const block of blocks) transaction.objectStore('blocks').add(block);
      transaction.objectStore('settings').add({ key: 'activeDocumentId', value: 'stored-chart-wide' });
      // バックアップ日時の設定は入れず、IndexedDBにしか原本がない利用者の状態を再現する。
      await completed;
    } finally { db.close(); }
  }, { documents: storedDocuments, blocks: storedBlocks });
}

/** アプリの読み出し処理も通さず、documents/blocks全件と選択中IDを読み取る。 */
async function readStoredCharts(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction(['documents', 'blocks', 'settings']);
      const read = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const [documents, blocks, active] = await Promise.all([
        read<StoredDocument[]>(transaction.objectStore('documents').getAll()),
        read<StoredBlock[]>(transaction.objectStore('blocks').getAll()),
        read<{ key: string; value: string } | undefined>(transaction.objectStore('settings').get('activeDocumentId')),
      ]);
      return {
        documents: documents.map((document) => {
          // TypedArray等への保存形式変更を、バイト列だけ同じとして見逃さない。
          if (!(document.cells instanceof ArrayBuffer)) throw new Error('cellsがArrayBufferではありません');
          return { ...document, cells: Array.from(new Uint8Array(document.cells)) };
        }).sort((a, b) => a.id.localeCompare(b.id)),
        blocks: blocks.sort((a, b) => a.id.localeCompare(b.id)),
        activeDocumentId: active?.value,
      };
    } finally { db.close(); }
  });
}

const expectedRecords = {
  documents: storedDocuments.map((document) => ({
    ...document, cells: Array.from(new Uint8Array(new Uint32Array(document.cells).buffer)),
  })).sort((a, b) => a.id.localeCompare(b.id)),
  blocks: storedBlocks,
};

async function expectPreserved(page: Page, activeDocumentId: string) {
  // activeDocumentIdだけは一覧で選ぶたびに正当に変わるので、原本とは分けて切り替え先を検証する。
  // 未編集ならsaveNowはidleで、updatedAtも変わらない。documents/blocksは項目を除外せず比較する。
  await expect.poll(() => readStoredCharts(page)).toStrictEqual({ ...expectedRecords, activeDocumentId });
  // 自動保存の遅延（現在400ms）を越えて観測し、遅れて原本を上書きする退行も検出する。
  // リロード直前だけの一致や、expect.pollの最初の一致で終わらせない。
  await page.waitForTimeout(1000);
  expect(await readStoredCharts(page)).toStrictEqual({ ...expectedRecords, activeDocumentId });
}

async function expectDocumentList(page: Page, activeName: string) {
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await expect(page.locator('.document-list')).toBeVisible();
  await expect(page.locator('.document-list .document')).toHaveCount(2);
  // 更新日時による並び順には依存せず、全件の名前と寸法を組で確かめる。
  expect(await page.locator('.document-name').allTextContents()).toEqual(expect.arrayContaining([
    '保存済みの縦長模様', '保存済みの横長模様',
  ]));
  for (const [name, size] of [
    ['保存済みの縦長模様', '37段×23目'], ['保存済みの横長模様', '8段×120目'],
  ]) {
    const open = page.getByRole('button', { name: new RegExp(`^${name}、${size}、更新 `) });
    await expect(open).toBeVisible();
    await expect(open.locator('small').first()).toHaveText(size);
    if (name === activeName) await expect(open).toHaveAttribute('aria-current', 'true');
  }
}

test('ストレージにだけある編み図とブロックを起動・切り替え・2回の再読み込みで変えない', async ({ page }) => {
  // fixtures.tsはCSP監視のみ。初回の「/」へ移る前に、同じoriginで固定レコードを書き切る。
  await seedStoredCharts(page);
  expect(await readStoredCharts(page)).toStrictEqual({ ...expectedRecords, activeDocumentId: 'stored-chart-wide' });
  await page.goto('/');
  const board = page.getByLabel('編み図編集盤面');
  await expect(board).toHaveAttribute('aria-label', /^編み図編集盤面。8段、120目。記号4個。/);
  await expect(page.locator('.app-document-name')).toContainText('保存済みの横長模様');
  await expectPreserved(page, 'stored-chart-wide');
  await expectDocumentList(page, '保存済みの横長模様');

  await page.getByRole('button', { name: /^保存済みの縦長模様、37段×23目、更新 / }).click();
  await expect(board).toHaveAttribute('aria-label', /^編み図編集盤面。37段、23目。記号5個。/);
  await expect(page.locator('.app-document-name')).toContainText('保存済みの縦長模様');
  await expectPreserved(page, 'stored-chart-tall');

  // 編集も再投入もせず、同じDBを2回続けて読み直す。各回で全レコードと一覧を検証する。
  for (let reload = 0; reload < 2; reload++) {
    await page.reload();
    await expect(board).toHaveAttribute('aria-label', /^編み図編集盤面。37段、23目。記号5個。/);
    await expect(page.locator('.app-document-name')).toContainText('保存済みの縦長模様');
    await expectDocumentList(page, '保存済みの縦長模様');
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await expectPreserved(page, 'stored-chart-tall');
  }
});
