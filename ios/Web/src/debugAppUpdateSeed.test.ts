import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_UPDATE_FIXTURE_BLOCK_NAME, APP_UPDATE_FIXTURE_MARKER_NAME, APP_UPDATE_FIXTURE_PRIMARY_NAME } from '@knitting-editor/editor-core/storage/appUpdateFixtureData';
import { boardFromDocument, createDocument, deleteBlock, deleteDocument, getSetting, listBlocks, listDocuments } from '@knitting-editor/editor-core/storage/database';
import { seedAppUpdateFixture } from './debugAppUpdateSeed';

afterEach(async () => {
  for (const document of await listDocuments()) await deleteDocument(document.id);
  for (const block of await listBlocks()) await deleteBlock(block.id);
});

describe('seedAppUpdateFixture', () => {
  it('writes the two documents, the block and the active document into an empty store', async () => {
    await seedAppUpdateFixture();

    const documents = await listDocuments();
    expect(documents.map((document) => document.name))
      .toEqual([APP_UPDATE_FIXTURE_PRIMARY_NAME, APP_UPDATE_FIXTURE_MARKER_NAME]);
    // 最初の編み図は端末内データとしてそのまま読める内容（記号・線・地の色）を持つ。
    const primary = boardFromDocument(documents[0]);
    expect(primary.occupiedStitchCount).toBe(3);
    expect(primary.lines).toHaveLength(1);
    expect(await getSetting('activeDocumentId')).toBe(documents[0].id);
    expect((await listBlocks()).map((block) => block.name)).toEqual([APP_UPDATE_FIXTURE_BLOCK_NAME]);
  });

  it('keeps existing documents untouched and adds nothing', async () => {
    await createDocument('利用者の既存編み図', 4, 4);
    await seedAppUpdateFixture();

    expect((await listDocuments()).map((document) => document.name)).toEqual(['利用者の既存編み図']);
    expect(await listBlocks()).toEqual([]);
  });
});
