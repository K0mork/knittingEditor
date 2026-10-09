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
    await act(async () => { editor.session.board!.clearAt(0, 0); editor.changed(); });
    expect(database.boardFromDocument(copy).valueAt(0, 0)).not.toBe(0);
    await act(async () => { await editor.switchDocument(copy, false); });
    expect(editor.session.board!.valueAt(0, 0)).not.toBe(0);
    await act(async () => { editor.session.board!.clearAt(0, 0); editor.changed(); });
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

