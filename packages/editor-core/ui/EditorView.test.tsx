import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EditorAnalytics } from '../analytics';
import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '../platform';
import { deleteBlock, initializeStorage, listBlocks, saveBlock } from '../storage/database';
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
  function Host() {
    const editor = useEditorController(controllerOptions);
    return <EditorView
      editor={editor}
      renderTitle={(status) => <div className="app-title"><h1>題字</h1><p data-testid="status">{status}</p></div>}
      backupNote="案内"
      footer={<footer>フッター</footer>}
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
  return { container, platform, button, click };
}

describe('EditorView', () => {
  it('renders the host title around the document status and reports analytics', async () => {
    const analytics: EditorAnalytics = { track: vi.fn(), trackFirstEdit: vi.fn() };
    const { container, click } = await renderEditor({ analytics });

    expect(container.querySelector('h1')?.textContent).toBe('題字');
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('新しい編み図、保存済み');
    expect(container.querySelector('footer')?.textContent).toBe('フッター');
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

  it('hides the gesture hint about ten seconds after opening', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

  it('asks a mouse user to click the paste position', async () => {
    const block = { id: 'paste-prompt-block', name: '貼り付け案内ブロック', rows: 1, cols: 1, anchors: [], createdAt: Date.now() };
    await saveBlock(block);
    try {
      const { container, click } = await renderEditor();
      await click('ブロック');
      const blockButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.block-list button'))
        .find((item) => item.textContent?.startsWith(block.name));
      await act(async () => { blockButton!.click(); });
      expect(container.querySelector('.toast')?.textContent).toBe('貼り付ける左上のセルをクリックしてください');
    } finally {
      await deleteBlock(block.id);
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
      expect(askConfirm).toHaveBeenCalledWith('ブロック「削除確認ブロック」を削除しますか？');
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

  it('hands the current chart backup to the platform', async () => {
    const { platform, click } = await renderEditor();

    await click('保存');
    await click('この編み図');
    await waitUntil(() => vi.mocked(platform.saveFile).mock.calls.length > 0);
    const [blob, filename] = vi.mocked(platform.saveFile).mock.calls[0];
    expect(filename).toBe('新しい編み図.knit');
    expect(blob.type).toBe('application/gzip');
  });

  it('lets the host take over the restore request before opening the file picker', async () => {
    const requestRestore = vi.fn(() => true);
    const { container, click } = await renderEditor({}, { requestRestore });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const pick = vi.spyOn(input, 'click');

    await click('保存');
    await click('復元');
    expect(requestRestore).toHaveBeenCalledOnce();
    expect(pick).not.toHaveBeenCalled();

    requestRestore.mockReturnValue(false);
    await click('復元');
    expect(pick).toHaveBeenCalledOnce();
  });

  // 新しい編み図が開いたままになるので、盤面の初期状態に頼るテストより後に置く。
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
