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
    boardFromDocument: (document: ChartDocument) => new BoardClass(document.rows, document.cols),
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
    ...document, rows: board.rows, cols: board.cols, updatedAt: Date.now(),
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

});
