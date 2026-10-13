import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { GridControls } from './GridControls';
import { usePanelFocus } from './hooks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.restoreAllMocks();
});

async function mount() {
  let frame!: FrameRequestCallback;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  function Panel({ board }: { board: Board }) {
    const { panelRef } = usePanelFocus<HTMLElement>(true);
    return <aside ref={panelRef}><h2 tabIndex={-1}>盤面設定</h2><GridControls board={board}
      backgroundColor="#ffffff" onBackgroundColorChange={vi.fn()} changed={vi.fn()}
      askText={async () => null} askConfirm={async () => false} notify={vi.fn()} /></aside>;
  }
  const render = async (board: Board) => { await act(async () => root.render(<Panel board={board} />)); };
  await render(new Board());
  const inputs = [...container.querySelectorAll<HTMLInputElement>('.size-inputs input')];
  const fill = async (input: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  return { inputs, render, fill, frame: () => frame(0) };
}

it.each([0, 1])('does not steal focus between size input selection and Delete: %i', async (index) => {
  const view = await mount();
  const input = view.inputs[index];
  // Playwrightのfill('')は入力を選択してから別の通信でDeleteを送る。
  input.select();
  input.focus();
  view.frame();
  expect(document.activeElement).toBe(input);
  // jsdomにはDeleteの既定動作がないため、フォーカス先への削除を模擬する。
  if (document.activeElement === input) await view.fill(input, '');
  expect(input.value).toBe('');
  await view.render(new Board());
  expect(input.value).toBe('');
});

it('focuses the heading when the panel has not received user focus', async () => {
  const view = await mount();
  view.frame();
  expect(document.activeElement).toBe(container.querySelector('h2'));
});

it('preserves drafts on a same-size board replacement and syncs actual dimension changes', async () => {
  const view = await mount();
  await view.fill(view.inputs[0], '');
  await view.fill(view.inputs[1], '30');
  const replacement = new Board();
  await view.render(replacement);
  expect(view.inputs.map((input) => input.value)).toEqual(['', '30']);
  replacement.resize(25, 35);
  await view.render(replacement);
  expect(view.inputs.map((input) => input.value)).toEqual(['25', '35']);
  await view.render(new Board(20, 20));
  expect(view.inputs.map((input) => input.value)).toEqual(['20', '20']);
});
