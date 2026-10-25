import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as database from '../storage/database';
import { useEditorController, type EditorController } from '../ui/useEditorController';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderEditor() {
  const source = await database.createDocument('元の編み図', 4, 4);
  const other = await database.createDocument('別の編み図', 4, 4);
  const container = document.createElement('div');
  const root = createRoot(container);
  let editor!: EditorController;
  function Probe() {
    editor = useEditorController({
      initialize: async () => ({ documents: [source, other], activeId: source.id, blocks: [] }),
      autosaveDelayMs: 60_000,
      platform: { saveFile: async () => ({ saved: Promise.resolve(undefined) }) },
      askText: async () => '新しい名前',
      askConfirm: async () => true,
    });
    return null;
  }
  await act(async () => root.render(<Probe />));
  return { source, other, get editor() { return editor; },
    async unmount() { await act(async () => root.unmount()); vi.restoreAllMocks(); } };
}

it.each(['session', 'controller'] as const)('keeps edits and history during the active setting write through %s', async (entry) => {
  const view = await renderEditor();
  const board = view.editor.session.board!;
  const original = database.setSetting;
  let release!: () => void;
  vi.spyOn(database, 'setSetting').mockImplementationOnce(async (...args) => {
    await new Promise<void>((resolve) => { release = resolve; });
    return original(...args);
  });
  try {
    let switching!: Promise<unknown>;
    await act(async () => { switching = entry === 'session'
      ? view.editor.session.switchDocument(view.other) : view.editor.switchDocument(view.other); });
    await act(async () => {
      board.place(0, 0, 'knit', '#123456');
      view.editor.session.changed();
      view.editor.session.commitEdit();
    });
    await act(async () => { release(); expect(await switching).toBe('pending'); });
    expect(view.editor.session.activeDocument?.id).toBe(view.source.id);
    expect(view.editor.session.board).toBe(board);
    expect(view.editor.session.canUndo).toBe(true);
    expect(view.editor.session.dirty).toBe(true);
    await act(async () => { expect(await view.editor.session.saveNow()).toBe('saved'); });
    const saved = (await database.listDocuments()).find((item) => item.id === view.source.id)!;
    expect(new Uint32Array(saved.cells)[0]).toBe(board.valueAt(0, 0));
    await act(async () => {
      await view.editor.session.switchDocument(view.other);
      await view.editor.session.switchDocument(saved);
    });
    expect(view.editor.session.board!.valueAt(0, 0)).toBe(board.valueAt(0, 0));
  } finally { await view.unmount(); }
});

it.each(['draw', 'undo'] as const)('saves %s arriving while a new document is created', async (edit) => {
  const view = await renderEditor();
  const board = view.editor.session.board!;
  const original = database.createDocument;
  let started!: () => void;
  const creatingStarted = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  vi.spyOn(database, 'createDocument').mockImplementationOnce(async (...args) => {
    started();
    await new Promise<void>((resolve) => { release = resolve; });
    return original(...args);
  });
  try {
    await act(async () => {
      board.place(0, 0, 'knit', '#123456');
      view.editor.session.changed();
      view.editor.session.commitEdit();
    });
    let creating!: Promise<void>;
    await act(async () => { creating = view.editor.createNewDocument(); await creatingStarted; });
    await act(async () => {
      if (edit === 'undo') view.editor.session.undo();
      else {
        board.place(0, 1, 'purl', '#123456');
        view.editor.session.changed();
        view.editor.session.commitEdit();
      }
    });
    await act(async () => { release(); await creating; });
    expect(view.editor.session.activeDocument?.id).not.toBe(view.source.id);
    const saved = (await database.listDocuments()).find((item) => item.id === view.source.id)!;
    expect([...new Uint32Array(saved.cells)]).toEqual([...board.cells]);
    await act(async () => { await view.editor.switchDocument(saved); });
    expect([...view.editor.session.board!.cells]).toEqual([...board.cells]);
  } finally { await view.unmount(); }
});

it('checks the current ID when applying a delayed rename without copying cells', async () => {
  const view = await renderEditor();
  try {
    await act(async () => { await view.editor.session.switchDocument(view.other); });
    const copy = vi.spyOn(view.editor.session.board!.cells, 'slice');
    await act(async () => {
      view.editor.session.applyActiveDocumentName(view.source.id, '古い編み図の名前', 100);
    });
    expect(view.editor.session.activeDocument?.name).toBe(view.other.name);
    await act(async () => {
      view.editor.session.applyActiveDocumentName(view.other.id, '現在の名前', 200);
    });
    expect(view.editor.session.activeDocument?.name).toBe('現在の名前');
    expect(copy).not.toHaveBeenCalled();
  } finally { await view.unmount(); }
});

it('builds independent active and backup snapshots with the same live content', async () => {
  const view = await renderEditor();
  try {
    await act(async () => {
      view.editor.session.board!.place(0, 0, 'knit', '#123456');
      view.editor.session.board!.addLine(1, 0, 2);
      view.editor.session.setBackgroundColor('#808080');
    });
    const active = view.editor.session.activeSnapshot()!;
    const backup = view.editor.session.backupSnapshot()!;
    expect(backup).toEqual({ ...active, updatedAt: backup.updatedAt });
    expect(active.updatedAt).toBe(view.source.updatedAt);
    expect(backup.updatedAt).toBeGreaterThanOrEqual(active.updatedAt);
    new Uint32Array(active.cells)[0] = 0;
    expect(active.guideLines![0]).not.toBe(backup.guideLines![0]);
    expect(active.guideLines![0]).not.toBe(view.editor.session.board!.lines[0]);
    expect(new Uint32Array(backup.cells)[0]).not.toBe(0);
    expect(backup.guideLines![0].col).toBe(1);
    expect(view.editor.session.board!.lines[0].col).toBe(1);
    expect(view.editor.session.board!.valueAt(0, 0)).not.toBe(0);
  } finally { await view.unmount(); }
});
