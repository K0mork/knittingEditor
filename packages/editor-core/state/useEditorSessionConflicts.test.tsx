import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { createDocument, deleteDocument, listDocuments, renameDocument, saveDocument } from '../storage/database';
import { AUTOSAVE_DELAY_MS, useEditorSession, type EditorSession } from './useEditorSession';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it.each(['updated', 'deleted'] as const)('activates a conflict copy of a chart %s elsewhere and retains in-memory edits and history', async (conflict) => {
  const source = await createDocument('セッション競合', 1, 3);
  const notify = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let session!: EditorSession;
  function Probe() {
    session = useEditorSession({
      initialize: async () => ({ documents: [source], activeId: source.id, blocks: [] }),
      onInitializationError: (error) => { throw new Error(error); },
      onSaveError: (error) => { throw error; },
      onSaveConflict: notify,
    });
    return null;
  }
  try {
    await act(async () => root.render(<Probe />));
    if (conflict === 'deleted') await deleteDocument(source.id);
    else await saveDocument(source, new Board(1, 3));
    const board = session.board!;
    await act(async () => {
      board.place(0, 1, 'knit', '#123456');
      session.changed();
      session.commitEdit();
      expect(await session.saveNow()).toBe('saved');
    });
    const saved = session.activeDocument!;
    expect(saved.id).not.toBe(source.id);
    expect(saved.name).toBe('セッション競合（別のタブの編集）');
    expect(notify).toHaveBeenCalledExactlyOnceWith(saved);
    expect(session.board).toBe(board);
    expect(session.canUndo).toBe(true);
    expect(session.dirty).toBe(false);
    expect(session.documents).toEqual(await listDocuments());
    await act(async () => {
      session.undo();
      expect(await session.saveNow()).toBe('saved');
    });
    expect(session.activeDocument?.id).toBe(saved.id);
    expect(notify).toHaveBeenCalledTimes(1);
    const renamed = await renameDocument(saved.id, '自分で変更');
    await act(async () => session.applyActiveDocumentName(renamed.id, renamed.name, renamed.updatedAt));
    await act(async () => {
      board.place(0, 2, 'knit', '#123456');
      session.changed();
      await session.saveNow();
    });
    expect(session.activeDocument?.id).toBe(saved.id);
    expect(notify).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('autosaves with the latest saved record even if the timer fires before the re-render', async () => {
  const source = await createDocument('自動保存の競合', 1, 3);
  const notify = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let session!: EditorSession;
  function Probe() {
    session = useEditorSession({
      initialize: async () => ({ documents: [source], activeId: source.id, blocks: [] }),
      onInitializationError: (error) => { throw new Error(error); },
      onSaveError: (error) => { throw error; },
      onSaveConflict: notify,
    });
    return null;
  }
  // IndexedDBの代替はsetImmediateで進むので、タイマーだけを偽物にする。
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    await act(async () => root.render(<Probe />));
    const board = session.board!;
    // 自動保存のタイマーが、この時点の記録（保存前の更新日時）で予約される。
    await act(async () => {
      board.place(0, 0, 'knit', '#123456');
      session.changed();
      session.commitEdit();
    });
    await act(async () => {
      expect(await session.saveNow()).toBe('saved');
      // 保存の完了をまだ描画していない間に次の編集が入り、予約済みのタイマーが発火する。
      board.place(0, 1, 'knit', '#123456');
      session.changed();
      session.commitEdit();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
      expect(await session.saveNow()).toBe('saved');
    });
    expect(notify).not.toHaveBeenCalled();
    expect(session.activeDocument?.id).toBe(source.id);
    const documents = await listDocuments();
    expect(documents.filter((item) => item.name.startsWith('自動保存の競合'))).toHaveLength(1);
    expect(new Uint32Array(documents.find((item) => item.id === source.id)!.cells).filter(Boolean)).toHaveLength(2);
  } finally {
    vi.useRealTimers();
    await act(async () => root.unmount());
    container.remove();
  }
});
