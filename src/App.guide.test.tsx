import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveOutcome } from '@knitting-editor/editor-core/state/useEditorSession';
import type { EditorViewProps } from '@knitting-editor/editor-core/ui/EditorView';
import App from './App';

const mocks = vi.hoisted(() => ({ save: vi.fn<() => Promise<SaveOutcome>>(), notify: vi.fn(), navigate: vi.fn() }));
vi.mock('@knitting-editor/editor-core/ui/useEditorController', () => ({
  useEditorController: () => ({ session: { saveNow: mocks.save }, notify: mocks.notify }),
}));
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({
  EditorView: ({ onGuideClick }: EditorViewProps) => <a href="/guide/" onClick={onGuideClick}>使い方</a>,
}));
vi.mock('@knitting-editor/editor-core/ui/guideNavigation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@knitting-editor/editor-core/ui/guideNavigation')>();
  return { ...original, createGuideNavigation: (options: Parameters<typeof original.createGuideNavigation>[0]) =>
    original.createGuideNavigation({ ...options, navigate: mocks.navigate }) };
});
vi.mock('./ShareFileDialog', () => ({ useShareOffer: () => ({ offerShare: vi.fn(), dialog: null }) }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  mocks.save.mockReset(); mocks.notify.mockReset(); mocks.navigate.mockReset();
  container = document.createElement('div'); document.body.append(container);
  await act(async () => { root = createRoot(container); root.render(<App />); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe('Web guide link', () => {
  it.each(['saved', 'idle', 'failed', 'pending'] as const)('checks %s before leaving', async (outcome) => {
    mocks.save.mockResolvedValue(outcome);
    await act(async () => container.querySelector('a')!.click());
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledTimes(outcome === 'saved' || outcome === 'idle' ? 1 : 0);
    if (outcome === 'failed' || outcome === 'pending') expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
  it('keeps the editor after timeout', async () => {
    vi.useFakeTimers();
    mocks.save.mockImplementation(() => new Promise(() => {}));
    await act(async () => container.querySelector('a')!.click());
    expect(mocks.navigate).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenLastCalledWith(expect.stringContaining('2秒以内'));
  });
  it('preserves modified clicks that open the guide without leaving the editor', async () => {
    // 既定の遷移はテスト内だけで抑え、ホストのイベント処理が保存を始めないことを確かめる。
    container.addEventListener('click', (event) => event.preventDefault());
    await act(async () => container.querySelector('a')!.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, ctrlKey: true,
    })));
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
