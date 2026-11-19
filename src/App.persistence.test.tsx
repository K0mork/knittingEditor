import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

// 永続化の要求はWeb版だけの処理なので、iOS版に同じ仕組みが入っていないことも含めて確かめる対象は
// `App`が保存成功の通知を要求へつなぐことだけにする（`requestPersistentStorageOnce`自体は
// `persistentStorage.test.ts`で確かめる）。
const mocks = vi.hoisted(() => ({
  save: vi.fn<() => Promise<'saved'>>(),
  notify: vi.fn(),
  navigate: vi.fn(),
  persist: vi.fn(),
  options: {} as { onSaveSuccess?: () => void },
}));
vi.mock('@knitting-editor/editor-core/ui/useEditorController', () => ({
  useEditorController: (options: typeof mocks.options) => {
    mocks.options = options;
    return { session: { saveNow: mocks.save }, notify: mocks.notify };
  },
}));
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({ EditorView: () => null }));
vi.mock('@knitting-editor/editor-core/ui/guideNavigation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@knitting-editor/editor-core/ui/guideNavigation')>();
  return { ...original, createGuideNavigation: (options: Parameters<typeof original.createGuideNavigation>[0]) =>
    original.createGuideNavigation({ ...options, navigate: mocks.navigate }) };
});
vi.mock('./ShareFileDialog', () => ({ useShareOffer: () => ({ offerShare: vi.fn(), dialog: null }) }));
vi.mock('./persistentStorage', () => ({ requestPersistentStorageOnce: mocks.persist }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  mocks.save.mockReset();
  mocks.notify.mockReset();
  mocks.navigate.mockReset();
  mocks.persist.mockReset();
  container = document.createElement('div'); document.body.append(container);
  await act(async () => { root = createRoot(container); root.render(<App />); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('persistent storage request wiring', () => {
  it('asks for persistent storage when a chart save succeeds', async () => {
    expect(mocks.persist).not.toHaveBeenCalled();
    await act(async () => { mocks.options.onSaveSuccess?.(); });
    expect(mocks.persist).toHaveBeenCalledTimes(1);
  });
});
