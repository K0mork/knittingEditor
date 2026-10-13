import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { boardFromDocument, createDocument, deleteDocument, getSetting, listDocuments, renameDocument, saveDocument } from './database';

afterEach(() => vi.restoreAllMocks());

function edited(col: number) {
  const board = new Board(1, 3);
  board.place(0, col, 'knit', '#123456');
  return board;
}

describe('conflicting chart saves', () => {
  it('preserves both edits and makes the conflict copy active even within the same millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const loaded = await createDocument('元の編み図', 1, 3);
    const first = await saveDocument(loaded, edited(0));
    const second = await saveDocument(loaded, edited(1));
    expect(first.id).toBe(loaded.id);
    expect(first.updatedAt).toBeGreaterThan(loaded.updatedAt);
    expect(second.id).not.toBe(loaded.id);
    expect(second.name).toBe('元の編み図（別のタブの編集）');
    expect(await getSetting('activeDocumentId')).toBe(second.id);
    const original = (await listDocuments()).find((item) => item.id === loaded.id)!;
    expect(boardFromDocument(original).valueAt(0, 0)).toBeTruthy();
    expect(boardFromDocument(original).valueAt(0, 1)).toBe(0);
    expect(boardFromDocument(second).valueAt(0, 1)).toBeTruthy();
    expect((await saveDocument(second, edited(2))).id).toBe(second.id);
  });

  it('serializes simultaneous saves without losing either board', async () => {
    const source = await createDocument('同時保存', 1, 3);
    const saved = await Promise.all([saveDocument(source, edited(0)), saveDocument(source, edited(1))]);
    expect(new Set(saved.map((item) => item.id)).size).toBe(2);
    expect(saved.filter((item) => item.id === source.id)).toHaveLength(1);
  });

  it('does not resurrect a deleted ID and allows repeated deletion', async () => {
    const source = await createDocument('削除済み', 1, 3);
    await deleteDocument(source.id);
    await expect(deleteDocument(source.id)).resolves.toBeUndefined();
    const saved = await saveDocument(source, edited(1));
    expect(saved.id).not.toBe(source.id);
    expect((await listDocuments()).some((item) => item.id === source.id)).toBe(false);
    expect(boardFromDocument(saved).valueAt(0, 1)).toBeTruthy();
  });

  it('detects a rename by another tab and accepts the revision returned by this tab\'s rename', async () => {
    const source = await createDocument('変更前', 1, 3);
    const renamed = await renameDocument(source.id, '変更後');
    expect((await saveDocument(renamed, edited(0))).id).toBe(source.id);
    expect((await saveDocument(source, edited(1))).id).not.toBe(source.id);
    expect((await listDocuments()).find((item) => item.id === source.id)?.name).toBe('変更後');
  });
});
