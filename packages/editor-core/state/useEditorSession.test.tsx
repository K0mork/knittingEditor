import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import type { ChartDocument } from '../storage/database';
import {
  mergeSavedDocument, useEditorSession, type EditorSession, type EditorSessionOptions, type SaveTrigger,
} from './useEditorSession';

const mocks = vi.hoisted(() => ({
  saveDocument: vi.fn(),
  listDocuments: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock('../storage/database', async () => {
  const { Board: BoardClass } = await import('../model/Board');
  return {
    boardFromDocument: (document: ChartDocument) => new BoardClass(document.rows, document.cols, new Uint32Array(document.cells.slice(0))),
    listBlocks: async () => [],
    listDocuments: mocks.listDocuments,
    saveDocument: mocks.saveDocument,
    setSetting: mocks.setSetting,
  };
});

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function chart(id: string, updatedAt: number, name = id): ChartDocument {
  return { id, name, rows: 4, cols: 4, cells: new Uint32Array(16).buffer, createdAt: 0, updatedAt };
}

async function renderSession(overrides: Partial<EditorSessionOptions> = {}) {
  const saveErrors: SaveTrigger[] = [];
  const documents = [chart('a', 10), chart('b', 20)];
  const options: EditorSessionOptions = {
    initialize: async () => ({ documents, activeId: 'a', blocks: [] }),
    onInitializationError: () => undefined,
    onSaveError: (_error, trigger) => saveErrors.push(trigger),
    ...overrides,
  };
  const container = document.createElement('div');
  document.body.append(container);
  let root!: Root;
  let session!: EditorSession;
  function Probe() {
    session = useEditorSession(options);
    return null;
  }
  await act(async () => {
    root = createRoot(container);
    root.render(<Probe />);
  });
  return {
    get session() { return session; },
    saveErrors,
    async flush(millis = 0) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, millis)); }); },
    async unmount() { await act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  mocks.saveDocument.mockReset();
  mocks.listDocuments.mockReset();
  mocks.setSetting.mockReset();
  mocks.listDocuments.mockResolvedValue([]);
  mocks.setSetting.mockResolvedValue(undefined);
  mocks.saveDocument.mockImplementation(async (document: ChartDocument, board: Board) => ({
    ...document, rows: board.rows, cols: board.cols, cells: board.cells.slice().buffer, updatedAt: Date.now(),
  }));
});

describe('mergeSavedDocument', () => {
  it('replaces the saved entry and keeps the newest chart first', () => {
    const merged = mergeSavedDocument([chart('a', 10), chart('b', 20)], chart('a', 30, 'renamed'));
    expect(merged.map((item) => item.id)).toEqual(['a', 'b']);
    expect(merged[0].name).toBe('renamed');
  });

  it('adds a chart the list does not have yet', () => {
    const merged = mergeSavedDocument([chart('a', 10)], chart('c', 5));
    expect(merged.map((item) => item.id)).toEqual(['a', 'c']);
  });
});

describe('useEditorSession', () => {
  it.each(['before autosave', 'during pending save'])('keeps edits and history on same-ID selection %s', async (timing) => {
    const view = await renderSession();
    const stale = view.session.documents.find((document) => document.id === 'a')!;
    const target = view.session.board!;
    await act(async () => {
      target.resize(5, 6);
      target.place(0, 0, 'knit', '#123456');
      view.session.changed();
      view.session.commitEdit();
      view.session.setBackgroundColor('#808080');
    });
    let release!: () => void;
    let saving: Promise<unknown> | undefined;
    if (timing === 'during pending save') {
      mocks.saveDocument.mockImplementationOnce((document: ChartDocument, board: Board) => {
        const saved = { ...document, rows: board.rows, cols: board.cols, cells: board.cells.slice().buffer, updatedAt: 50 };
        return new Promise((resolve) => { release = () => resolve(saved); });
      });
      await act(async () => { saving = view.session.saveNow(); });
      await act(async () => {
        target.place(1, 1, 'purl', '#123456');
        view.session.changed();
        view.session.commitEdit();
      });
    }
    await act(async () => { expect(await view.session.switchDocument(stale)).toBe('switched'); });
    expect(view.session.board).toBe(target);
    expect(target.rows).toBe(5);
    expect(target.cols).toBe(6);
    expect(target.valueAt(0, 0)).not.toBe(0);
    expect(view.session.backgroundColor).toBe('#808080');
    expect(view.session.canUndo).toBe(true);
    expect(view.session.dirty).toBe(true);
    if (saving) await act(async () => { release(); expect(await saving).toBe('pending'); });
    await view.flush(500);
    expect(view.session.dirty).toBe(false);
    const saved = view.session.documents.find((document) => document.id === 'a')!;
    expect(saved.rows).toBe(5);
    expect(saved.cols).toBe(6);
    expect(new Uint32Array(saved.cells)[0]).toBe(target.valueAt(0, 0));
    expect(saved.backgroundColor).toBe('#808080');
    if (saving) expect(new Uint32Array(saved.cells)[7]).toBe(target.valueAt(1, 1));
    await view.unmount();
  });

  it('keeps the board and history if the active setting cannot be written', async () => {
    const view = await renderSession();
    const target = view.session.board;
    mocks.setSetting.mockRejectedValueOnce(new Error('quota'));
    await act(async () => {
      await expect(view.session.switchDocument(chart('b', 20))).rejects.toThrow('quota');
    });
    expect(view.session.activeDocument?.id).toBe('a');
    expect(view.session.board).toBe(target);
    await view.unmount();
  });

  it('autosaves the edited chart and clears the unsaved marker', async () => {
    const view = await renderSession();
    expect(view.session.activeDocument?.id).toBe('a');

    await act(async () => { view.session.changed(); });
    expect(view.session.dirty).toBe(true);
    await view.flush(500);

    expect(mocks.saveDocument).toHaveBeenCalledTimes(1);
    expect(view.session.dirty).toBe(false);
    await view.unmount();
  });

  it('updates the chart list from the save result instead of reloading every chart', async () => {
    const view = await renderSession();
    await act(async () => { view.session.changed(); });
    await view.flush(500);

    // 初期化は呼び出し側の`initialize`が行う。保存のたびに全件を読み直さない。
    expect(mocks.listDocuments).not.toHaveBeenCalled();
    expect(view.session.documents.map((item) => item.id)).toEqual(['a', 'b']);
    expect(view.session.documents[0].id).toBe('a');
    expect(view.session.documents[0].updatedAt).toBeGreaterThan(20);
    await view.unmount();
  });

  it('keeps the chart unsaved when an edit lands while the save is in flight', async () => {
    let release!: (saved: ChartDocument) => void;
    mocks.saveDocument.mockImplementation((document: ChartDocument) => new Promise<ChartDocument>((resolve) => {
      release = (saved) => resolve(saved ?? document);
    }));

    const view = await renderSession();
    await act(async () => { view.session.changed(); });

    let outcome: string | undefined;
    await act(async () => {
      void view.session.saveNow('background').then((result) => { outcome = result; });
      await Promise.resolve();
    });
    // 書き込みの完了前に次の編集が入る。保存済みとして扱ってはいけない。
    await act(async () => { view.session.changed(); });
    await act(async () => { release(chart('a', 99)); await Promise.resolve(); });

    expect(outcome).toBe('pending');
    expect(view.session.dirty).toBe(true);
    await view.unmount();
  });

  it('reports a failed save once and leaves the chart unsaved', async () => {
    mocks.saveDocument.mockRejectedValue(new Error('書き込みに失敗'));
    const view = await renderSession();

    await act(async () => { view.session.changed(); });
    let outcome: string | undefined;
    await act(async () => { outcome = await view.session.saveNow(); });

    expect(outcome).toBe('failed');
    expect(view.saveErrors).toEqual(['manual']);
    expect(view.session.dirty).toBe(true);
    await view.unmount();
  });

  it('writes pending edits before switching to another chart', async () => {
    const view = await renderSession();
    await act(async () => { view.session.changed(); });
    let switched: string | undefined;
    await act(async () => { switched = await view.session.switchDocument(chart('b', 20)); });
    expect(switched).toBe('switched');

    expect(mocks.saveDocument).toHaveBeenCalledTimes(1);
    expect(mocks.saveDocument.mock.calls[0][0].id).toBe('a');
    expect(view.session.activeDocument?.id).toBe('b');
    expect(view.session.dirty).toBe(false);
    expect(mocks.setSetting).toHaveBeenCalledWith('activeDocumentId', 'b');
    await view.unmount();
  });

  it('keeps the edited board and active setting when switching cannot save', async () => {
    mocks.saveDocument.mockRejectedValue(new Error('quota exceeded'));
    const view = await renderSession();
    const editedBoard = view.session.board!;
    await act(async () => {
      editedBoard.place(0, 0, 'knit', '#123456');
      view.session.changed();
    });
    let switched: string | undefined;
    await act(async () => { switched = await view.session.switchDocument(chart('b', 20)); });
    expect(switched).toBe('failed');
    expect(view.session.activeDocument?.id).toBe('a');
    expect(view.session.board).toBe(editedBoard);
    expect(editedBoard.valueAt(0, 0)).not.toBe(0);
    expect(view.session.dirty).toBe(true);
    expect(mocks.setSetting).not.toHaveBeenCalled();
    expect(view.saveErrors).toEqual(['manual']);
    await view.unmount();
  });

  it('does not switch when another edit arrives during the save', async () => {
    let release!: (saved: ChartDocument) => void;
    mocks.saveDocument.mockImplementation(() => new Promise<ChartDocument>((resolve) => { release = resolve; }));
    const view = await renderSession();
    await act(async () => { view.session.changed(); });
    let switched: string | undefined;
    await act(async () => {
      void view.session.switchDocument(chart('b', 20)).then((value) => { switched = value; });
    });
    await act(async () => { view.session.changed(); });
    await act(async () => { release(chart('a', 99)); });
    // 中止した理由を返す。呼び出し側はpendingのときだけ自前で通知する。
    expect(switched).toBe('pending');
    expect(view.session.activeDocument?.id).toBe('a');
    expect(view.session.dirty).toBe(true);
    expect(mocks.setSetting).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('saves a new ground with the chart without adding it to the undo history', async () => {
    const view = await renderSession();
    expect(view.session.backgroundColor).toBe('#ffffff');
    await act(async () => { view.session.setBackgroundColor('#1E1E1E'); });
    expect(view.session.backgroundColor).toBe('#1e1e1e');
    expect(view.session.dirty).toBe(true);
    expect(view.session.canUndo).toBe(false);
    await view.flush(500);

    expect(mocks.saveDocument).toHaveBeenCalledTimes(1);
    expect(mocks.saveDocument.mock.calls[0][0]).toMatchObject({ id: 'a', backgroundColor: '#1e1e1e' });
    expect(view.session.dirty).toBe(false);
    // 同じ色を選び直しても保存しない。
    await act(async () => { view.session.setBackgroundColor('#1e1e1e'); });
    expect(view.session.dirty).toBe(false);
    await view.unmount();
  });

  it('keeps a ground chosen while an earlier save is still being written', async () => {
    let release!: () => void;
    mocks.saveDocument.mockImplementationOnce((document: ChartDocument) => new Promise((resolve) => {
      release = () => resolve({ ...document, updatedAt: 50 });
    }));
    const view = await renderSession();
    await act(async () => { view.session.setBackgroundColor('#808080'); });
    await act(async () => { void view.session.saveNow(); await Promise.resolve(); });
    await act(async () => { view.session.setBackgroundColor('#1e1e1e'); });
    await act(async () => { release(); await Promise.resolve(); });

    // 書き込み前の記録（グレー）で上書きされず、あとで選んだ黒が残って保存される。
    expect(view.session.backgroundColor).toBe('#1e1e1e');
    expect(view.session.dirty).toBe(true);
    await view.flush(500);
    expect(mocks.saveDocument.mock.calls.at(-1)?.[0]).toMatchObject({ backgroundColor: '#1e1e1e' });
    await view.unmount();
  });

  it('loads the ground of the chart it switches to', async () => {
    const view = await renderSession();
    await act(async () => { await view.session.switchDocument({ ...chart('b', 20), backgroundColor: '#808080' }); });
    expect(view.session.backgroundColor).toBe('#808080');
    await act(async () => { await view.session.switchDocument(chart('a', 10)); });
    expect(view.session.backgroundColor).toBe('#ffffff');
    await view.unmount();
  });
});
