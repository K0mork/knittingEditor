import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import * as storage from '../storage/database';
import { SAVE_RESULT_UNKNOWN } from '../platform';
import { useEditorController, type EditorController } from './useEditorController';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

async function editor(saveFile = vi.fn(async (_blob: Blob, _name: string) => SAVE_RESULT_UNKNOWN)) {
  const source = await storage.createDocument(`退避${crypto.randomUUID()}`, 2, 2);
  const container = document.createElement('div');
  const root = createRoot(container);
  let current!: EditorController;
  function Probe() {
    current = useEditorController({
      initialize: async () => ({ documents: [source], activeId: source.id, blocks: [] }),
      platform: { saveFile }, askText: async () => null, askConfirm: async () => false,
    });
    return null;
  }
  await act(async () => { root.render(<Probe />); });
  return { get current() { return current; }, source, saveFile,
    async close() { await act(async () => root.unmount()); } };
}

it.each([false, true])('exports the in-memory board while saving keeps failing and round-trips it (all=%s)', async (all) => {
  const view = await editor();
  try {
    vi.spyOn(storage, 'saveDocument').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    await act(async () => {
      view.current.session.board!.place(0, 1, 'knit', '#123456', false);
      view.current.changed();
      await view.current.session.saveNow();
    });
    expect(view.current.session.saveFailed).toBe(true);
    await act(async () => { await view.current.backup(all); });
    const blob = view.saveFile.mock.calls[0][0];
    const restored = await storage.importBackup(blob);
    expect(storage.boardFromDocument(restored.documents.find((item) => item.name === `${view.source.name}（復元）`)!).valueAt(0, 1))
      .toBe(view.current.session.board!.valueAt(0, 1));
    expect(view.current.session.dirty).toBe(true);
    expect(view.current.session.saveFailed).toBe(true);
  } finally { await view.close(); }
});

it('exports edits made during a pending save instead of the older stored board', async () => {
  const view = await editor();
  try {
    let release!: (value: storage.ChartDocument) => void;
    vi.spyOn(storage, 'saveDocument').mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    let saving!: ReturnType<EditorController['session']['saveNow']>;
    await act(async () => {
      view.current.session.board!.place(0, 0, 'knit', '#123456', false);
      view.current.changed();
      saving = view.current.session.saveNow();
      view.current.session.board!.place(1, 1, 'purl', '#123456', false);
      view.current.changed();
      release(view.source);
      expect(await saving).toBe('pending');
    });
    await act(async () => { await view.current.backup(false); });
    const restored = await storage.importBackup(view.saveFile.mock.calls[0][0]);
    expect(storage.boardFromDocument(restored.documents[0]).valueAt(1, 1))
      .toBe(view.current.session.board!.valueAt(1, 1));
  } finally { await view.close(); }
});

it('does not record an export when undo changes the generation during sharing', async () => {
  let finish!: (value: boolean) => void;
  const saved = new Promise<boolean>((resolve) => { finish = resolve; });
  const view = await editor(vi.fn(async (_blob: Blob, _name: string) => ({ saved })));
  try {
    await act(async () => {
      view.current.session.board!.place(0, 0, 'knit', '#123456', false);
      view.current.changed();
    });
    let exporting!: Promise<void>;
    await act(async () => {
      exporting = view.current.backup(false);
      while (!view.saveFile.mock.calls.length) await new Promise((resolve) => setTimeout(resolve, 1));
    });
    await act(async () => { view.current.undo(); finish(true); await exporting; });
    expect(await storage.getLastBackupAt(view.source.id)).toBeUndefined();
    expect(view.current.backupReminder.lastBackupAt).toBeUndefined();
  } finally { await view.close(); }
});

it('does not record a cancelled or failed file handoff', async () => {
  const view = await editor(vi.fn(async (_blob: Blob, _name: string) => ({ saved: Promise.resolve(false) })));
  try {
    await act(async () => { await view.current.backup(false); });
    expect(await storage.getLastBackupAt(view.source.id)).toBeUndefined();
    view.saveFile.mockRejectedValueOnce(new Error('handoff failed'));
    await act(async () => { await view.current.backup(false); });
    expect(await storage.getLastBackupAt(view.source.id)).toBeUndefined();
    expect(view.current.message).toContain('handoff failed');
  } finally { await view.close(); }
});

/** 書き出した盤面を後から保存しても、次に開いたとき「バックアップの後に変更があります」と判定されないこと。 */
async function expectBackupCoversStoredBoard(id: string) {
  await vi.waitFor(async () => {
    const stored = (await storage.listDocuments()).find((item) => item.id === id)!;
    expect(await storage.getLastBackupAt(id)).toBeGreaterThanOrEqual(stored.updatedAt);
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

it('advances the backup date when the exported unsaved board is saved afterwards', async () => {
  const view = await editor();
  try {
    await act(async () => {
      view.current.session.board!.place(0, 0, 'knit', '#123456', false);
      view.current.changed();
    });
    await act(async () => { await view.current.backup(false); });
    expect(view.current.session.dirty).toBe(true);
    await act(async () => { await tick(); expect(await view.current.session.saveNow()).toBe('saved'); });
    await expectBackupCoversStoredBoard(view.source.id);
  } finally { await view.close(); }
});

it('records no earlier than a save of the exported board that finished during sharing', async () => {
  let finish!: (value: boolean) => void;
  const saved = new Promise<boolean>((resolve) => { finish = resolve; });
  const view = await editor(vi.fn(async (_blob: Blob, _name: string) => ({ saved })));
  try {
    await act(async () => {
      view.current.session.board!.place(0, 0, 'knit', '#123456', false);
      view.current.changed();
    });
    let exporting!: Promise<void>;
    await act(async () => {
      exporting = view.current.backup(false);
      while (!view.saveFile.mock.calls.length) await tick();
    });
    await act(async () => { await tick(); expect(await view.current.session.saveNow()).toBe('saved'); });
    await act(async () => { finish(true); await exporting; });
    await expectBackupCoversStoredBoard(view.source.id);
  } finally { await view.close(); }
});

it('clears the save failure once a write succeeds even if newer edits remain', async () => {
  const view = await editor();
  try {
    const failing = vi.spyOn(storage, 'saveDocument').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await act(async () => {
      view.current.session.board!.place(0, 0, 'knit', '#123456', false);
      view.current.changed();
      expect(await view.current.session.saveNow()).toBe('failed');
    });
    expect(view.current.session.saveFailed).toBe(true);
    await act(async () => {
      const saving = view.current.session.saveNow();
      view.current.session.board!.place(1, 1, 'purl', '#123456', false);
      view.current.changed();
      expect(await saving).toBe('pending');
    });
    expect(failing).toHaveBeenCalledTimes(2);
    expect(view.current.session.saveFailed).toBe(false);
    expect(view.current.session.dirty).toBe(true);
  } finally { await view.close(); }
});
