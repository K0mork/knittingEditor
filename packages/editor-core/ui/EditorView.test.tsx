import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorAnalytics } from '../analytics';
import { Board } from '../model/Board';
import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '../platform';
import { deleteBlock, initializeStorage, listBlocks, saveBlock, type ChartDocument } from '../storage/database';
import { EditorView, GESTURE_HINT_DURATION_MS, type EditorViewProps } from './EditorView';
import { saveErrorMessage, useEditorController, type EditorControllerOptions } from './useEditorController';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  // jsdomにはResizeObserverとCanvas描画が無い。盤面の描画はこのテストの対象外。
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

beforeEach(async () => {
  // database.tsは接続を保持するため、DBを削除せず全ストアを空にする。
  await initializeStorage();
  const request = indexedDB.open('knitting-editor-v2');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const transaction = db.transaction(['documents', 'blocks', 'settings'], 'readwrite');
    for (const store of ['documents', 'blocks', 'settings']) transaction.objectStore(store).clear();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
});

/** `act`の中では描画がまとめて反映されるので、区切りながら条件が満たされるまで待つ。 */
async function waitUntil(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(condition()).toBe(true);
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function renderEditor(
  options: Partial<EditorControllerOptions> = {},
  view: Partial<Omit<EditorViewProps, 'editor'>> = {},
) {
  const platform: EditorPlatform = { saveFile: vi.fn(async () => SAVE_RESULT_UNKNOWN) };
  const controllerOptions: EditorControllerOptions = {
    initialize: async () => ({ ...await initializeStorage(), blocks: await listBlocks() }),
    platform,
    askText: async () => null,
    askConfirm: async () => false,
    ...options,
  };
  let latest!: ReturnType<typeof useEditorController>;
  function Host() {
    const editor = useEditorController(controllerOptions);
    latest = editor;
    return <EditorView
      editor={editor}
      renderTitle={(status) => <div className="app-title"><h1>題字</h1><p data-testid="status">{status}</p></div>}
      backupNote="案内"
      {...view}
    />;
  }
  const container = document.createElement('div');
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<Host />);
  });
  // 初期化はIndexedDBを読むので、表示が切り替わるまで待つ。
  await waitUntil(() => container.querySelector('.app-shell') !== null);
  cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  const button = (label: string) => {
    const found = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
    if (!found) throw new Error(`button not found: ${label}`);
    return found;
  };
  const click = async (label: string) => { await act(async () => { button(label).click(); }); };
  const notify: ReturnType<typeof useEditorController>['notify'] = (...args) => latest.notify(...args);
  return { container, platform, button, click, notify, editor: () => latest };
}

describe('EditorView', () => {
  it('adds a button to a toast only when the notification carries an action', async () => {
    const { container, notify } = await renderEditor();
    const run = vi.fn();
    await act(async () => notify('写真に保存できませんでした。', { label: 'やり方を見る', run }));
    const toast = container.querySelector('.toast')!;
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.textContent).toBe('写真に保存できませんでした。やり方を見る');
    const action = toast.querySelector<HTMLButtonElement>('button.toast-action')!;
    expect(action.type).toBe('button');
    await act(async () => { action.click(); });
    expect(run).toHaveBeenCalledOnce();

    // 次の通知は、前の通知のボタンを引き継がない。
    await act(async () => notify('元に戻しました'));
    expect(container.querySelector('.toast')?.textContent).toBe('元に戻しました');
    expect(container.querySelector('.toast-action')).toBeNull();
  });

  it('shows stitch width in stitches and height in rows', async () => {
    const { container } = await renderEditor();
    await act(async () => { container.querySelector<HTMLButtonElement>('.stitch-tool')!.click(); });
    const size = (name: string) => [...container.querySelectorAll('.stitch-option')]
      .find((item) => item.querySelector('.stitch-option-name')?.textContent === name)?.querySelector('small')?.textContent;
    expect(size('すべり目')).toBe('2段×1目');
    expect(size('右上3目交差')).toBe('1段×6目');
  });

  it('shows both units for a rectangular block and preserves document size order', async () => {
    const block = { id: 'size-units-block', name: '寸法確認', rows: 2, cols: 5, anchors: [], createdAt: Date.now() };
    await saveBlock(block);
    try {
      const { container, click } = await renderEditor();
      await click('ブロック');
      const row = [...container.querySelectorAll('.block-list > div')].find((item) => item.textContent?.startsWith(block.name));
      expect(row?.querySelector('small')?.textContent).toBe('2段×5目');
      await click('閉じる');
      await click('編み図');
      expect(container.querySelector('.document-list')?.textContent).toContain('20段×20目');
    } finally {
      await deleteBlock(block.id);
    }
  });

  it('renders the host title around the document status and reports analytics', async () => {
    const analytics: EditorAnalytics = { track: vi.fn(), trackFirstEdit: vi.fn() };
    const { container, click } = await renderEditor({ analytics });

    expect(container.querySelector('h1')?.textContent).toBe('題字');
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('新しい編み図、保存済み');
    expect(container.querySelector('footer')).toBeNull();
    expect(analytics.track).toHaveBeenCalledWith('editor_ready', { document_count_bucket: '1' });

    await click('盤面');
    expect(container.querySelector('#app-drawer-title')?.textContent).toBe('盤面設定');
    expect(analytics.track).toHaveBeenCalledWith('feature_opened', { feature_name: 'grid' });
  });

  it('switches the canvas mode from the tool buttons', async () => {
    const { container, button, click } = await renderEditor();

    await click('消す');
    expect(button('消す').getAttribute('aria-pressed')).toBe('true');
    expect(button('描く').getAttribute('aria-pressed')).toBe('false');
    // jsdomはタッチ端末として振る舞わないので、マウス向けのヒントになる。
    expect(container.querySelector('.gesture-hint')?.textContent).toMatch(/^ドラッグ：消去　ホイール：移動　(Ctrl|⌘)＋ホイール：拡大$/);
  });

  it('picks a color used in the chart and returns to drawing', async () => {
    const board = new Board(4, 4);
    board.place(0, 0, 'knit', '#264653');
    board.place(0, 1, 'knit', '#264653');
    board.place(1, 0, 'purl', '#f4a261');
    const document: ChartDocument = {
      id: 'used-colors', name: '配色', rows: board.rows, cols: board.cols,
      cells: board.cells.slice().buffer as ArrayBuffer, createdAt: 1, updatedAt: 1,
    };
    const { container, button, click } = await renderEditor({ initialize: async () => ({ documents: [document], activeId: document.id, blocks: [] }) });
    const colorButton = () => container.querySelector<HTMLButtonElement>('.color-tool')!;
    expect(colorButton().getAttribute('aria-label')).toBe('記号の色を選ぶ（現在：赤 #d33c32）');

    await click('消す');
    await act(async () => { colorButton().click(); });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('color-picker-title');
    const swatches = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.used-color'));
    expect(swatches.map((item) => item.getAttribute('aria-label'))).toEqual(['青緑 #264653、記号2個', 'オレンジ #f4a261、記号1個']);
    expect(swatches.every((item) => item.getAttribute('aria-pressed') === 'false')).toBe(true);

    await act(async () => { swatches[1].click(); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(colorButton().getAttribute('aria-label')).toBe('記号の色を選ぶ（現在：オレンジ #f4a261）');
    expect(button('描く').getAttribute('aria-pressed')).toBe('true');

    await act(async () => { colorButton().click(); });
    expect(container.querySelector('.used-color.selected')?.getAttribute('aria-label')).toBe('オレンジ #f4a261、記号1個');
  });

  it('shows an empty used-color list and keeps the custom color picker', async () => {
    const { container } = await renderEditor();
    await act(async () => { container.querySelector<HTMLButtonElement>('.color-tool')!.click(); });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelectorAll('.used-color')).toHaveLength(0);
    expect(dialog.textContent).toContain('まだ記号を置いていません。');
    const input = dialog.querySelector<HTMLInputElement>('input[type="color"]')!;
    expect(input.value).toBe('#d33c32');
  });

  it('describes the limited color list as descending stitch usage', async () => {
    const board = new Board(5, 5);
    for (let index = 0; index < 25; index++) board.place(Math.floor(index / 5), index % 5, 'knit', `#${(index + 1).toString(16).padStart(6, '0')}`);
    const document: ChartDocument = {
      id: 'many-colors', name: '色の順序', rows: 5, cols: 5,
      cells: board.cells.slice().buffer as ArrayBuffer, createdAt: 1, updatedAt: 1,
    };
    const { container } = await renderEditor({ initialize: async () => ({ documents: [document], activeId: document.id, blocks: [] }) });
    await act(async () => { container.querySelector<HTMLButtonElement>('.color-tool')!.click(); });
    expect(container.querySelector('.color-picker-note')?.textContent).toBe('記号の多い順に24色を表示しています。ほかに1色あります。');
  });

  it('hides the gesture hint about ten seconds after opening', async () => {
    // IndexedDBのテスト実装が使うsetImmediateなどは本物のまま動かし、ヒントのタイマーだけを進める。
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { container } = await renderEditor();
      const hint = () => container.querySelector('.gesture-hint');
      expect(hint()?.classList.contains('is-hidden')).toBe(false);
      await act(async () => { vi.advanceTimersByTime(GESTURE_HINT_DURATION_MS - 1_000); });
      expect(hint()?.classList.contains('is-hidden')).toBe(false);
      await act(async () => { vi.advanceTimersByTime(1_000); });
      expect(hint()?.classList.contains('is-hidden')).toBe(true);
      expect(hint()?.getAttribute('aria-hidden')).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows only the paste band when choosing a block or restarting paste', async () => {
    const block = { id: 'paste-prompt-block', name: '貼り付け案内ブロック', rows: 1, cols: 1, anchors: [], createdAt: Date.now() };
    await saveBlock(block);
    try {
      const { container, click } = await renderEditor();
      await click('ブロック');
      const blockButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.block-list button'))
        .find((item) => item.textContent?.startsWith(block.name));
      await act(async () => { blockButton!.click(); });
      const expectBandWithoutToast = () => {
        expect(container.querySelector('.paste-actions')?.textContent).toContain('貼付中：左上にするマスをタップ');
        expect(container.querySelector('.toast')).toBeNull();
      };
      expectBandWithoutToast();
      await click('やめる');
      await click('貼付');
      expectBandWithoutToast();
      for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
        await click('やめる');
        await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ...modifier })); });
        expectBandWithoutToast();
      }
    } finally {
      await deleteBlock(block.id);
    }
  });

  it('shows only the paste band when copying a selection and preserves result notices', async () => {
    const { container, click, editor } = await renderEditor();
    await act(async () => { editor().setSelection({ top: 0, left: 0, bottom: 0, right: 0 }); });
    await click('コピーして貼付');
    expect(container.querySelector('.paste-actions')?.textContent).toContain('貼付中：左上にするマスをタップ');
    expect(container.querySelector('.toast')).toBeNull();
    await act(async () => { editor().handlePasteComplete(false); });
    expect(container.querySelector('.toast')?.textContent).toBe('盤面からはみ出すため貼付できません');
    expect(container.querySelector('.paste-actions')).not.toBeNull();
    await act(async () => { editor().handlePasteComplete(true); });
    expect(container.querySelector('.toast')?.textContent).toBe('ブロックを貼付しました');
    expect(container.querySelector('.paste-actions')).toBeNull();
  });

  it('keeps the paste band after notices expire and lets the user stop', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const block = { id: 'paste-band', name: '帯の確認', rows: 1, cols: 1, anchors: [], createdAt: 1 };
      const { container, click, button } = await renderEditor({
        initialize: async () => ({ ...await initializeStorage(), blocks: [block] }),
      });
      await click('ブロック');
      await act(async () => { container.querySelector<HTMLButtonElement>('.block-list button')!.click(); });
      expect(container.querySelector('.paste-actions')?.textContent).toContain('貼付中：左上にするマスをタップ');
      expect(container.querySelector('.toast')).toBeNull();
      await act(async () => { vi.advanceTimersByTime(15_000); });
      expect(container.querySelector('.toast')).toBeNull();
      expect(container.querySelector('.gesture-hint')?.getAttribute('aria-hidden')).toBe('true');
      expect(container.querySelector('.paste-actions')).not.toBeNull();
      await click('やめる');
      expect(container.querySelector('.paste-actions')).toBeNull();
      expect(button('描く').getAttribute('aria-pressed')).toBe('true');
      expect(container.querySelector('canvas')?.getAttribute('aria-label')).toContain('描画モード');
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes a saved block only after the user confirms', async () => {
    const block = { id: 'confirm-block-delete', name: '削除確認ブロック', rows: 1, cols: 1, anchors: [], createdAt: Date.now() };
    await saveBlock(block);
    try {
      const askConfirm = vi.fn(async () => false);
      const { container, click } = await renderEditor({ askConfirm });
      const deleteButton = () => Array.from(container.querySelectorAll('.block-list > div'))
        .find((row) => row.textContent?.startsWith(block.name))
        ?.querySelector<HTMLButtonElement>('button:last-child');

      await click('ブロック');
      await act(async () => { deleteButton()!.click(); });
      expect(askConfirm).toHaveBeenCalledWith('ブロック「削除確認ブロック」を削除しますか？', { destructive: true });
      expect((await listBlocks()).some((item) => item.id === block.id)).toBe(true);
      expect(deleteButton()).toBeDefined();

      askConfirm.mockResolvedValue(true);
      await act(async () => { deleteButton()!.click(); });
      await waitUntil(() => deleteButton() === undefined);
      expect((await listBlocks()).some((item) => item.id === block.id)).toBe(false);
    } finally {
      await deleteBlock(block.id);
    }
  });

  it('shows all backup actions in the save panel', async () => {
    const { container, click, button } = await renderEditor();
    await click('出力');
    expect(container.querySelector('#app-drawer-title')?.textContent).toBe('出力');
    for (const label of ['この編み図を書き出す', '全データを書き出す', 'バックアップから復元']) expect(button(label)).toBeDefined();
    await click('閉じる');
    expect(container.querySelector('#app-drawer-title')).toBeNull();
  });

  it('hands the current chart backup to the platform', async () => {
    const { platform, click } = await renderEditor();

    await click('出力');
    await click('この編み図を書き出す');
    await waitUntil(() => vi.mocked(platform.saveFile).mock.calls.length > 0);
    const [blob, filename] = vi.mocked(platform.saveFile).mock.calls[0];
    expect(filename).toBe('新しい編み図.knit');
    expect(blob.type).toBe('application/gzip');
  });

  it('shows the host note after the chart list only when the host passes one', async () => {
    const withNote = await renderEditor({}, { documentsNote: <a href="/privacy/">ポリシー</a> });
    await withNote.click('編み図');
    const note = withNote.container.querySelector('#app-drawer .documents-note');
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('/privacy/');
    expect(note?.previousElementSibling?.classList.contains('document-list')).toBe(true);
    await cleanup?.();
    cleanup = undefined;

    const withoutNote = await renderEditor();
    await withoutNote.click('編み図');
    expect(withoutNote.container.querySelector('#app-drawer .document-list')).not.toBeNull();
    expect(withoutNote.container.querySelector('.documents-note')).toBeNull();
  });

  it('lets the host take over the restore request before opening the file picker', async () => {
    const requestRestore = vi.fn(() => true);
    const { container, click } = await renderEditor({}, { requestRestore });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pick = vi.spyOn(input, 'click');

    await click('出力');
    await click('バックアップから復元');
    expect(requestRestore).toHaveBeenCalledOnce();
    expect(pick).not.toHaveBeenCalled();

    requestRestore.mockReturnValue(false);
    await click('バックアップから復元');
    expect(pick).toHaveBeenCalledOnce();
  });

  it('undoes grid changes and forgets the history when another chart opens', async () => {
    const { container, button, click } = await renderEditor({ askText: async () => '別の編み図' });
    const boardLabel = () => container.querySelector('canvas')?.getAttribute('aria-label') ?? '';
    const undo = container.querySelector<HTMLButtonElement>('button[aria-label="元に戻す"]')!;
    const redo = container.querySelector<HTMLButtonElement>('button[aria-label="やり直す"]')!;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    await click('盤面');
    await click('上に段');
    expect(boardLabel()).toContain('21段');
    expect(undo.disabled).toBe(false);

    await act(async () => { undo.click(); });
    expect(boardLabel()).toContain('20段');
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(false);
    expect(container.querySelector('.toast')?.textContent).toBe('元に戻しました');

    await act(async () => { redo.click(); });
    expect(boardLabel()).toContain('21段');
    expect(undo.disabled).toBe(false);

    await click('閉じる');
    await click('編み図');
    await click('新しい編み図');
    await waitUntil(() => container.querySelector('[data-testid="status"]')?.textContent?.startsWith('別の編み図') ?? false);
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);
    expect(button('描く')).toBeDefined();
  });
});

describe('saveErrorMessage', () => {
  it('names the save that failed', () => {
    expect(saveErrorMessage('autosave')).toBe('自動保存に失敗しました。バックアップを保存してください。');
    expect(saveErrorMessage('manual')).toBe('変更を保存できませんでした。バックアップを保存してください。');
    expect(saveErrorMessage('background')).toBe('バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。');
  });
});
