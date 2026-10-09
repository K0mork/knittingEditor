import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { GridControls } from './GridControls';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function renderControls(backgroundColor: string) {
  const onBackgroundColorChange = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<GridControls board={new Board(2, 2)} backgroundColor={backgroundColor} onBackgroundColorChange={onBackgroundColorChange}
      changed={() => undefined} askText={async () => null} askConfirm={async () => false} notify={() => undefined} />);
  });
  cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  const presets = () => [...container.querySelectorAll<HTMLButtonElement>('.background-preset')];
  return { container, presets, onBackgroundColorChange };
}

describe('GridControls background color', () => {
  it('offers white, gray and black and marks the current one', async () => {
    const view = await renderControls('#808080');
    expect(view.presets().map((button) => button.textContent)).toEqual(['白', 'グレー', '黒']);
    expect(view.presets().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(view.container.querySelector('.background-presets')?.getAttribute('aria-labelledby')).toBe('background-color-title');
  });

  it('marks no preset for a freely chosen color and shows it in the color input', async () => {
    const view = await renderControls('#2f4f4f');
    expect(view.presets().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(view.container.querySelector<HTMLInputElement>('.background-custom input')?.value).toBe('#2f4f4f');
  });

  it('reports the chosen preset and the freely chosen color', async () => {
    const view = await renderControls('#ffffff');
    await act(async () => { view.presets()[2].click(); });
    expect(view.onBackgroundColorChange).toHaveBeenLastCalledWith('#1e1e1e');

    const input = view.container.querySelector<HTMLInputElement>('.background-custom input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#2f4f4f');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(view.onBackgroundColorChange).toHaveBeenLastCalledWith('#2f4f4f');
  });
});
