import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APP_UPDATE_FIXTURE_BACKGROUND_COLOR,
  APP_UPDATE_FIXTURE_BLOCK_NAME,
  APP_UPDATE_FIXTURE_MARKER_NAME,
  APP_UPDATE_FIXTURE_PRIMARY_NAME,
} from '@knitting-editor/editor-core/storage/appUpdateFixtureData';
import { boardFromDocument, createDocument, deleteBlock, deleteDocument, getSetting, listBlocks, listDocuments } from '@knitting-editor/editor-core/storage/database';
import { seedAppUpdateFixture } from './debugAppUpdateSeed';

afterEach(async () => {
  for (const document of await listDocuments()) await deleteDocument(document.id);
  for (const block of await listBlocks()) await deleteBlock(block.id);
});

describe('seedAppUpdateFixture', () => {
  it('writes the two documents, the block and the active document through the storage API', async () => {
    await seedAppUpdateFixture();

    // 保存のAPIが書いた記録が、普段の読み出し（`listDocuments`）でそのまま読める。
    // 更新日時は保存した時刻になるので、一覧の並びは名前の集合で確かめる。
    const documents = await listDocuments();
    expect(documents.map((document) => document.name).sort())
      .toEqual([APP_UPDATE_FIXTURE_PRIMARY_NAME, APP_UPDATE_FIXTURE_MARKER_NAME]);
    const primary = documents.find((document) => document.name === APP_UPDATE_FIXTURE_PRIMARY_NAME)!;
    const marker = documents.find((document) => document.name === APP_UPDATE_FIXTURE_MARKER_NAME)!;
    // 編集画面の保存と同じ記録。作成日時はそのままに、保存で更新日時が進んでいる。
    for (const document of [primary, marker]) {
      expect(document.updatedAt).toBeGreaterThanOrEqual(document.createdAt);
    }
    // 最初の編み図は端末内データとしてそのまま読める内容（記号・線・地の色）を持つ。
    const primaryBoard = boardFromDocument(primary);
    expect(primaryBoard.occupiedStitchCount).toBe(3);
    expect(primaryBoard.lines).toHaveLength(1);
    expect(primary.backgroundColor).toBe(APP_UPDATE_FIXTURE_BACKGROUND_COLOR);
    // 編集画面は保存時に常に地の色を渡すので、目印も既定の白を持つ。
    expect(marker.backgroundColor).toBe('#ffffff');
    expect(boardFromDocument(marker).occupiedStitchCount).toBe(1);
    // 最初の編み図が起動時に開く。目印は記号1個のまま。
    expect(await getSetting('activeDocumentId')).toBe(primary.id);
    expect((await listBlocks()).map((block) => block.name)).toEqual([APP_UPDATE_FIXTURE_BLOCK_NAME]);
  });

  it('keeps existing documents untouched and adds nothing', async () => {
    await createDocument('利用者の既存編み図', 4, 4);
    await seedAppUpdateFixture();

    expect((await listDocuments()).map((document) => document.name)).toEqual(['利用者の既存編み図']);
    expect(await listBlocks()).toEqual([]);
  });
});
