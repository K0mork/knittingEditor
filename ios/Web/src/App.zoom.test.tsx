import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

const state = vi.hoisted(() => ({ zoomBoard: vi.fn(), busy: undefined as string | undefined }));
vi.mock('@knitting-editor/editor-core/ui/useEditorController', () => ({
  useEditorController: () => ({
    zoomBoard: state.zoomBoard, busy: state.busy,
    session: { saveNow: vi.fn(), canUndo: false, canRedo: false },
  }),
}));
vi.mock('@knitting-editor/editor-core/ui/EditorView', () => ({ EditorView: () => null }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { state.zoomBoard.mockClear(); state.busy = undefined; });

it('applies native pinch and menu zoom and blocks them while busy or a modal is open', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const pinch = () => window.dispatchEvent(new CustomEvent('knittingEditorNativeZoom', { detail: { factor: 1.1, x: 412.5, y: 300 } }));
  const menu = () => window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'zoomIn' }));
  const modal = document.createElement('section');
  modal.setAttribute('aria-modal', 'true');
  try {
    await act(async () => root.render(<App />));
    pinch(); menu();
    expect(state.zoomBoard.mock.calls).toEqual([[1.1, { x: 412.5, y: 300 }], [1.25]]);
    document.body.append(modal);
    pinch(); menu();
    modal.remove();
    state.busy = 'バックアップを処理中';
    await act(async () => root.render(<App />));
    pinch(); menu();
    expect(state.zoomBoard).toHaveBeenCalledTimes(2);
    state.busy = undefined;
    await act(async () => root.render(<App />));
    pinch();
    expect(state.zoomBoard).toHaveBeenCalledTimes(3);
  } finally {
    modal.remove();
    await act(async () => root.unmount());
    container.remove();
  }
  pinch(); menu();
  expect(state.zoomBoard).toHaveBeenCalledTimes(3);
});
