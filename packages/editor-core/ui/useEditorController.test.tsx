import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import * as database from '../storage/database';
import { useEditorController, type EditorController } from './useEditorController';

// eslint-disable-next-line no-var
declare global { var IS_REACT_ACT_ENVIRONMENT: boolean | undefined; }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let editor: EditorController;
let source: database.ChartDocument;
let savedBlock: ReturnType<Board['createBlock']>;
const quota = new DOMException('test quota', 'QuotaExceededError');

beforeEach(async () => {
  for (const document of await database.listDocuments()) await database.deleteDocument(document.id);
  for (const block of await database.listBlocks()) await database.deleteBlock(block.id);
  source = await database.createDocument('元の編み図', 4, 4);
  const other = await database.createDocument('別の編み図', 4, 4);
  await database.setSetting('activeDocumentId', source.id);
  savedBlock = database.boardFromDocument(source).createBlock({ top: 0, left: 0, bottom: 0, right: 0 }, '保存したブロック');
  await database.saveBlock(savedBlock);
  container = document.createElement('div');
  document.body.append(container);
  function Probe() {
    editor = useEditorController({
      initialize: async () => ({ documents: [source, other], activeId: source.id, blocks: [savedBlock] }),
      platform: { saveFile: async () => ({ saved: Promise.resolve(undefined) }) },
      askText: async () => '変更した名前',
      askConfirm: async () => true,
    });
    return null;
  }
  await act(async () => { root = createRoot(container); root.render(<Probe />); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

async function edit() {
  await act(async () => {
    editor.session.board!.resize(5, 6);
    editor.session.board!.place(0, 0, 'knit', '#123456');
    editor.changed();
    editor.session.setBackgroundColor('#808080');
  });
}

describe('duplicateChart', () => {
  it.each(['before autosave', 'pending', 'failed'])('duplicates the live board %s and keeps independent cells', async (timing) => {
    await edit();
    let release!: () => void;
    let saving: Promise<unknown> | undefined;
    if (timing === 'pending') {
      const original = database.saveDocument;
      vi.spyOn(database, 'saveDocument').mockImplementationOnce((document, board) => {
        const snapshot = new Board(board.rows, board.cols, board.cells);
        return new Promise((resolve) => { release = () => { void original(document, snapshot).then(resolve); }; });
      });
      await act(async () => { saving = editor.session.saveNow(); });
      await act(async () => {
        editor.session.board!.place(1, 1, 'purl', '#654321');
        editor.changed();
      });
    } else if (timing === 'failed') {
      vi.spyOn(database, 'saveDocument').mockRejectedValue(quota);
      await act(async () => { expect(await editor.session.saveNow()).toBe('failed'); });
    }
    const snapshot = editor.session.activeSnapshot()!;
    await act(async () => { await expect(editor.duplicateChart(source)).resolves.toBeUndefined(); });
    const copy = (await database.listDocuments()).find((document) => document.name === '元の編み図のコピー')!;
    expect(copy).toBeDefined();
    expect(copy.rows).toBe(5);
    expect(copy.cols).toBe(6);
    expect(copy.backgroundColor).toBe('#808080');
    expect(new Uint32Array(copy.cells)).toEqual(new Uint32Array(snapshot.cells));
    expect(editor.message).toBe('編み図を複製しました。');
    expect(editor.session.activeDocument?.id).toBe(source.id);
    if (saving) await act(async () => { release(); expect(await saving).toBe('pending'); });
    vi.restoreAllMocks();
    await act(async () => { editor.session.board!.clearAt(0, 0); editor.changed(); });
    await act(async () => { await editor.session.saveNow(); });
    expect(database.boardFromDocument(copy).valueAt(0, 0)).not.toBe(0);
    await act(async () => { await editor.switchDocument(copy); });
    expect(editor.session.board!.valueAt(0, 0)).not.toBe(0);
    await act(async () => { editor.session.board!.place(0, 2, 'knit', '#abcdef'); editor.changed(); });
    await act(async () => { await editor.session.saveNow(); });
    const original = (await database.listDocuments()).find((document) => document.id === source.id)!;
    expect(new Uint32Array(original.cells)[0]).toBe(0);
    expect(new Uint32Array(original.cells)[2]).toBe(0);
    expect(new Uint32Array(copy.cells)[0]).not.toBe(0);
    expect(new Uint32Array(snapshot.cells)[0]).not.toBe(0);
  });

  it('duplicates an inactive chart from its saved record', async () => {
    await edit();
    const other = editor.session.documents.find((document) => document.id !== source.id)!;
    await act(async () => { await editor.duplicateChart(other); });
    const copy = editor.session.documents.find((document) => document.name === '別の編み図のコピー')!;
    expect(copy.rows).toBe(4);
    expect(new Uint32Array(copy.cells).every((cell) => cell === 0)).toBe(true);
  });
});

describe('management failures', () => {
  it.each([
    ['createDocument', '編み図の作成', () => editor.createNewDocument()],
    ['renameDocument', '編み図の名前変更', () => editor.renameChart(source)],
    ['duplicateDocument', '編み図の複製', () => editor.duplicateChart(source)],
    ['deleteDocument', '編み図の削除', () => editor.deleteChart(source)],
    ['saveBlock', 'ブロックの保存', () => editor.saveSelectionAsBlock()],
    ['deleteBlock', 'ブロックの削除', () => editor.removeBlock(savedBlock)],
  ] as const)('catches %s rejection and preserves the data and list', async (method, label, action) => {
    await act(async () => { editor.setSelection({ top: 0, left: 0, bottom: 0, right: 0 }); });
    const before = await database.listDocuments();
    const board = editor.session.board;
    const selection = editor.selection;
    vi.spyOn(database, method).mockRejectedValueOnce(quota);
    await act(async () => { await expect(action()).resolves.toBeUndefined(); });
    expect(editor.message).toBe(`${label}に失敗しました。もう一度お試しください。`);
    expect(editor.session.documents).toEqual(expect.arrayContaining(before));
    expect(await database.listDocuments()).toEqual(before);
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(editor.session.board).toBe(board);
    expect(editor.selection).toEqual(selection);
    expect(editor.session.blocks).toEqual([savedBlock]);
    expect(await database.listBlocks()).toEqual([savedBlock]);
  });

  it('catches active-setting failure when opening another chart', async () => {
    vi.spyOn(database, 'setSetting').mockRejectedValueOnce(quota);
    const before = editor.session.board;
    await act(async () => { await expect(editor.switchDocument(editor.session.documents[1])).resolves.toBeUndefined(); });
    expect(editor.message).toContain('編み図を開けませんでした');
    expect(editor.session.board).toBe(before);
    expect(editor.session.activeDocument?.id).toBe(source.id);
  });

  it('does not create a new chart if saving the current edits fails', async () => {
    await edit();
    vi.spyOn(database, 'saveDocument').mockRejectedValueOnce(quota);
    await act(async () => { await editor.createNewDocument(); });
    expect(editor.message).toContain('編み図を作成できませんでした');
    expect(await database.listDocuments()).toHaveLength(2);
    expect(editor.session.dirty).toBe(true);
    expect(editor.session.canUndo).toBe(true);
  });

  it.each(['create', 'delete'])('rolls back %s if the active setting write fails', async (operation) => {
    const before = await database.listDocuments();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'settings') throw quota;
      return put.apply(this, args);
    });
    await act(async () => {
      if (operation === 'create') await editor.createNewDocument();
      else await editor.deleteChart(source);
    });
    expect(editor.message).toContain('に失敗しました');
    expect(await database.listDocuments()).toEqual(before);
    expect(editor.session.documents).toEqual(expect.arrayContaining(before));
    expect(editor.session.activeDocument?.id).toBe(source.id);
    expect(await database.getSetting('activeDocumentId')).toBe(source.id);
  });

  it('reflects saved and deleted blocks only after successful storage writes', async () => {
    await act(async () => { editor.setSelection({ top: 0, left: 0, bottom: 0, right: 0 }); });
    await act(async () => { await editor.saveSelectionAsBlock(); });
    expect(editor.session.blocks).toHaveLength(2);
    expect(editor.selection).toBeUndefined();
    expect(editor.message).toBe('ブロックを保存しました');
    await act(async () => { await editor.removeBlock(savedBlock); });
    expect(editor.session.blocks).toHaveLength(1);
    expect(await database.listBlocks()).toEqual(editor.session.blocks);
  });

  it('reflects successful rename and delete without another storage read', async () => {
    await edit();
    await act(async () => { await editor.renameChart(source); });
    expect(editor.session.activeDocument?.name).toBe('変更した名前');
    expect(editor.session.documents.find((document) => document.id === source.id)?.name).toBe('変更した名前');
    await act(async () => { await editor.deleteChart(source); });
    expect(editor.session.documents).toHaveLength(1);
    expect(editor.session.activeDocument?.id).toBe(editor.session.documents[0].id);
    expect(await database.getSetting('activeDocumentId')).toBe(editor.session.activeDocument?.id);
    expect(await database.listDocuments()).toEqual(editor.session.documents);
  });
});
