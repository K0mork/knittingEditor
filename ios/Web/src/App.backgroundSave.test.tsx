import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import * as storage from '@knitting-editor/editor-core/storage/database';
import type { EditorController } from '@knitting-editor/editor-core/ui/useEditorController';
import App from './App';

const probe = vi.hoisted(() => ({ editor: undefined as EditorController | undefined }));

// Canvas描画だけを置き換える。App、controller、session、IndexedDBの保存は実物を通す。
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({
  EditorView: ({ editor }: { editor: EditorController }) => {
    probe.editor = editor;
    return <p>{editor.session.dirty ? '保存中' : '保存済み'}</p>;
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const persistDocument = storage.saveDocument;
const resignActive = 'knittingEditorAppWillResignActive';
// 偽のタイマーに置き換わる前の実物。イベント待ちの打ち切りに使う。
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const eventSaveTimeoutMs = 1000;

describe('App background save registration', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  let documentId: string;
  let save: MockInstance<typeof storage.saveDocument>;

  beforeEach(async () => {
    documentId = (await storage.createDocument('バックグラウンド保存', 4, 4)).id;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<App />);
    });
    // IndexedDBの初期化を実際に待つ。ここではまだタイマーを置き換えない。
    await vi.waitFor(async () => {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(probe.editor?.session.activeDocument?.id).toBe(documentId);
    });
    expect(window.knittingEditorFlushPendingSave).toBeTypeOf('function');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    save = vi.spyOn(storage, 'saveDocument');
  });

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container.remove();
    probe.editor = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.knittingEditorFlushPendingSave;
  });

  async function edit(row = 1, col = 2, color = '#123456') {
    await act(async () => {
      probe.editor!.session.board!.place(row, col, 'knit', color);
      probe.editor!.changed();
    });
    expect(probe.editor!.session.dirty).toBe(true);
  }

  async function storedBoard() {
    const chart = (await storage.listDocuments()).find((item) => item.id === documentId)!;
    return storage.boardFromDocument(chart);
  }

  async function flushEvent() {
    // イベントには戻り値が無いので、DB書き込みの完了を待ってからassertする。
    const persist = persistDocument;
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => { complete = resolve; });
    save.mockImplementationOnce(async (...args) => {
      try { return await persist(...args); }
      finally { complete(); }
    });
    // 購読が無いと保存が始まらない。待ち続けずにこのテストだけを失敗させる。
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = realSetTimeout(() => reject(new Error(`${resignActive} did not save within ${eventSaveTimeoutMs}ms`)), eventSaveTimeoutMs);
    });
    try {
      await act(async () => {
        window.dispatchEvent(new Event(resignActive));
        await Promise.race([completed, timedOut]);
      });
    } finally {
      realClearTimeout(timer);
    }
  }

  it.each(['function', 'event'] as const)('writes unsaved cells through the registered %s before autosave', async (entry) => {
    await edit();
    expect(save).not.toHaveBeenCalled();
    expect((await storedBoard()).occupiedStitchCount).toBe(0);
    if (entry === 'function') {
      await act(async () => expect(await window.knittingEditorFlushPendingSave!()).toBe(true));
    } else {
      await flushEvent();
    }
    expect(save).toHaveBeenCalledTimes(1);
    expect((await storedBoard()).cells).toEqual(probe.editor!.session.board!.cells);
    expect(probe.editor!.session.dirty).toBe(false);
    // 保存で保留中の自動保存も解除される。400ms後に二重に書き込まない。
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('returns true for pending but retains the edit made while the write was in flight', async () => {
    const persist = persistDocument;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    save.mockImplementationOnce(async (...args) => {
      const saved = await persist(...args);
      await gate;
      return saved;
    });
    await edit();
    let result!: Promise<boolean>;
    await act(async () => { result = window.knittingEditorFlushPendingSave!(); });
    await edit(2, 3, '#abcdef');
    await act(async () => { release(); expect(await result).toBe(true); });
    expect((await storedBoard()).occupiedStitchCount).toBe(1);
    expect(probe.editor!.session.board!.occupiedStitchCount).toBe(2);
    expect(probe.editor!.session.dirty).toBe(true);
    await act(async () => expect(await window.knittingEditorFlushPendingSave!()).toBe(true));
    expect((await storedBoard()).cells).toEqual(probe.editor!.session.board!.cells);
    expect(probe.editor!.session.dirty).toBe(false);
  });

  it.each(['function', 'event'] as const)('keeps failed %s saves dirty and reports a background error', async (entry) => {
    await edit();
    save.mockRejectedValueOnce(new Error('write failed'));
    await act(async () => {
      if (entry === 'function') expect(await window.knittingEditorFlushPendingSave!()).toBe(false);
      else window.dispatchEvent(new Event(resignActive));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect((await storedBoard()).occupiedStitchCount).toBe(0);
    expect(probe.editor!.session.dirty).toBe(true);
    expect(probe.editor!.message).toBe('バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。');
  });

  it('removes the function and event subscription on unmount without writing pending edits', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    await edit();
    await act(async () => root!.unmount());
    root = undefined;
    expect(window.knittingEditorFlushPendingSave).toBeUndefined();
    expect(remove).toHaveBeenCalledWith(resignActive, expect.any(Function));
    window.dispatchEvent(new Event(resignActive));
    await vi.advanceTimersByTimeAsync(400);
    expect(save).not.toHaveBeenCalled();
    expect((await storedBoard()).occupiedStitchCount).toBe(0);
  });

  it('does not delete a function subsequently registered by another owner', async () => {
    const replacement = vi.fn(async () => true);
    window.knittingEditorFlushPendingSave = replacement;
    await act(async () => root!.unmount());
    root = undefined;
    expect(window.knittingEditorFlushPendingSave).toBe(replacement);
  });
});
