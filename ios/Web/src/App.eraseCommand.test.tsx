import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeCommand } from './nativeBridge';
import App from './App';

const state = vi.hoisted(() => ({
  selection: undefined as { top: number; left: number; bottom: number; right: number } | undefined,
  canUndo: false,
  canRedo: false,
  busy: undefined as string | undefined,
  saveNow: vi.fn(async () => 'idle' as const),
  eraseSelection: vi.fn(),
  notify: vi.fn(),
  notifyState: vi.fn(),
}));

vi.mock('@knitting-editor/editor-core/ui/useEditorController', () => ({
  useEditorController: () => ({
    session: { saveNow: state.saveNow, canUndo: state.canUndo, canRedo: state.canRedo },
    selection: state.selection,
    eraseSelection: state.eraseSelection,
    notify: state.notify,
    restore: vi.fn(),
    zoomBoard: vi.fn(),
    busy: state.busy,
    createNewDocument: vi.fn(),
    backup: vi.fn(),
    runPngExport: vi.fn(),
    runPdfExport: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    mode: 'draw',
    chooseMode: vi.fn(),
  }),
}));
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({ EditorView: () => null }));
vi.mock('./nativeBridge', () => ({
  listenNativeBackupSelected: () => () => {},
  // 実物と同じくwindowのイベントを購読し、`NATIVE_COMMANDS`の値だけを届ける。
  listenNativeCommand: (listener: (command: NativeCommand) => void) => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail === 'string' && detail === 'eraseSelection') listener(detail);
    };
    window.addEventListener('knittingEditorNativeCommand', handler);
    return () => window.removeEventListener('knittingEditorNativeCommand', handler);
  },
  listenNativeError: () => () => {},
  listenNativeZoom: () => () => {},
  notifyNativeCommandState: state.notifyState,
  notifyNativeReady: () => {},
  requestNativeBackupOpen: () => false,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

/** メニューの「選んだ範囲を消去」を、ネイティブと同じCustomEventで送る。 */
function sendEraseSelection() {
  window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'eraseSelection' }));
}

function useExecCommand() {
  const execCommand = vi.fn(() => true);
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  return execCommand;
}

beforeEach(async () => {
  document.body.innerHTML = '';
  state.selection = { top: 0, left: 0, bottom: 0, right: 0 };
  state.canUndo = false;
  state.canRedo = false;
  state.busy = undefined;
  state.eraseSelection.mockReset();
  state.notify.mockReset();
  state.notifyState.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  Object.defineProperty(document, 'execCommand', { value: undefined, configurable: true });
});

const lastState = () => state.notifyState.mock.calls.at(-1)?.[0];

describe('iOS erase-selection command', () => {
  it('keeps erasing available through busy, and follows the selection, a text field and a modal', async () => {
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: true });

    // 入力欄にフォーカスがある間は、Deleteは盤面ではなく文字に効かせる。
    const input = document.createElement('input');
    document.body.append(input);
    await act(async () => { input.focus(); });
    expect(lastState()).toEqual({ canUndo: true, canRedo: true, canEraseSelection: false });

    // フォーカスが外れると、次のタスクで入力中ではなくなる（`watchTextEditing`）。
    await act(async () => {
      input.blur();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: true });

    // ダイアログ・記号の一覧などを開いている間は、後ろの盤面を消さない。
    const modal = document.createElement('section');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    await act(async () => { root.render(<App />); });
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: false });
    modal.remove();
    await act(async () => { root.render(<App />); });
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: true });

    // 出力・復元の処理中でも、画面の「消去」ボタンと同じく選べるままにする。
    state.busy = 'PNGを保存しています…';
    await act(async () => { root.render(<App />); });
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: true });
    state.busy = undefined;

    // 範囲が無ければ、Deleteは何も消さない。
    state.selection = undefined;
    await act(async () => { root.render(<App />); });
    expect(lastState()).toEqual({ canUndo: false, canRedo: false, canEraseSelection: false });
  });

  it('erases once, as one history step, when the menu command arrives', async () => {
    await act(async () => { sendEraseSelection(); });
    expect(state.eraseSelection).toHaveBeenCalledTimes(1);
  });

  it('does not erase the board when the command arrives while a text field has focus', async () => {
    const input = document.createElement('input');
    document.body.append(input);
    await act(async () => { input.focus(); });
    const execCommand = useExecCommand();

    await act(async () => { sendEraseSelection(); });
    // 状態の反映が遅れてメニューが有効なままでも、入力欄の文字だけを1文字消す。
    expect(execCommand).toHaveBeenCalledWith('delete');
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(state.eraseSelection).not.toHaveBeenCalled();
  });

  it('still erases during an export or restore, like the on-screen button and the web shortcut', async () => {
    state.busy = 'バックアップから復元しています…';
    await act(async () => { root.render(<App />); });
    await act(async () => { sendEraseSelection(); });
    expect(state.eraseSelection).toHaveBeenCalledTimes(1);
  });

  it('does not erase the board when the command arrives behind a modal', async () => {
    const modal = document.createElement('section');
    modal.setAttribute('aria-modal', 'true');
    document.body.append(modal);
    await act(async () => { root.render(<App />); });
    await act(async () => { sendEraseSelection(); });
    expect(state.eraseSelection).not.toHaveBeenCalled();
  });
});
