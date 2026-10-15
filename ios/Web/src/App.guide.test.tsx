import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveOutcome } from '@knitting-editor/editor-core/state/useEditorSession';
import type { EditorViewProps } from '@knitting-editor/editor-core/ui/EditorView';
import type { NativeCommand } from './nativeBridge';
import App from './App';

const mocks = vi.hoisted(() => ({
  save: vi.fn<() => Promise<SaveOutcome>>(), notify: vi.fn(), navigate: vi.fn(),
  command: undefined as ((command: NativeCommand) => void) | undefined,
  nativeError: undefined as ((message: string, guideSection?: string) => void) | undefined,
}));
vi.mock('@knitting-editor/editor-core/ui/useEditorController', () => ({
  useEditorController: () => ({ session: { saveNow: mocks.save, canUndo: false, canRedo: false }, notify: mocks.notify }),
}));
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({
  EditorView: ({ onGuideClick }: EditorViewProps) => <a href="/guide/" onClick={onGuideClick}>使い方</a>,
}));
vi.mock('@knitting-editor/editor-core/ui/guideNavigation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@knitting-editor/editor-core/ui/guideNavigation')>();
  return { ...original, createGuideNavigation: (options: Parameters<typeof original.createGuideNavigation>[0]) =>
    original.createGuideNavigation({ ...options, navigate: mocks.navigate }) };
});
vi.mock('./nativeBridge', () => ({
  listenNativeCommand: (listener: (command: NativeCommand) => void) => { mocks.command = listener; return () => {}; },
  listenNativeZoom: () => () => {},
  listenNativeBackupSelected: () => () => {},
  listenNativeError: (listener: (message: string, guideSection?: string) => void) => { mocks.nativeError = listener; return () => {}; },
  notifyNativeCommandState: () => {}, notifyNativeReady: () => {}, requestNativeBackupOpen: () => false,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  mocks.save.mockReset(); mocks.notify.mockReset(); mocks.navigate.mockReset();
  container = document.createElement('div'); document.body.append(container);
  await act(async () => { root = createRoot(container); root.render(<App />); });
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.useRealTimers();
});

for (const source of ['link', 'menu'] as const) {
  describe(`iOS guide ${source}`, () => {
    function open() {
      if (source === 'link') container.querySelector('a')!.click();
      else mocks.command!('openGuide');
    }
    it.each(['saved', 'idle', 'failed', 'pending'] as const)('checks %s before leaving', async (outcome) => {
      mocks.save.mockResolvedValue(outcome);
      await act(async () => open());
      expect(mocks.save).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledTimes(outcome === 'saved' || outcome === 'idle' ? 1 : 0);
      if (outcome === 'failed' || outcome === 'pending') expect(mocks.notify).toHaveBeenCalledTimes(2);
    });
    it('keeps the editor after timeout and late completion', async () => {
      vi.useFakeTimers();
      let complete!: (outcome: SaveOutcome) => void;
      mocks.save.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
      await act(async () => open());
      expect(mocks.navigate).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(mocks.notify).toHaveBeenLastCalledWith(expect.stringContaining('2秒以内'));
      await act(async () => complete('saved'));
      expect(mocks.navigate).not.toHaveBeenCalled();
    });
  });
}

describe('iOS native error', () => {
  it('shows a plain toast without a guide section', async () => {
    await act(async () => mocks.nativeError!('保存画面を表示できませんでした'));
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('保存画面を表示できませんでした');
  });

  it('adds a button that saves and opens the guide section', async () => {
    mocks.save.mockResolvedValue('saved');
    await act(async () => mocks.nativeError!('写真に保存できませんでした。', 'allow-photos'));
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('写真に保存できませんでした。', { label: 'やり方を見る', run: expect.any(Function) });
    expect(mocks.navigate).not.toHaveBeenCalled();
    const [, action] = mocks.notify.mock.calls[0] as [string, { run: () => void }];
    await act(async () => action.run());
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(new URL('/guide/#allow-photos', window.location.href).href);
  });
});
