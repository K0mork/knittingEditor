import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EditorAnalytics } from '../analytics';
import type { EditorPlatform } from '../platform';
import { initializeStorage, listBlocks } from '../storage/database';
import { EditorView, type EditorViewProps } from './EditorView';
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
  const platform: EditorPlatform = { saveFile: vi.fn(async () => undefined) };
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
    expect(container.querySelector('.gesture-hint')?.textContent).toBe('1本指：消去　2本指：移動・拡大');
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
});

describe('saveErrorMessage', () => {
  it('names the save that failed', () => {
    expect(saveErrorMessage('autosave')).toBe('自動保存に失敗しました。バックアップを保存してください。');
    expect(saveErrorMessage('manual')).toBe('変更を保存できませんでした。バックアップを保存してください。');
    expect(saveErrorMessage('background')).toBe('バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。');
  });
});
