import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { BoardHistory } from '../model/BoardHistory';
import { GridControls } from './GridControls';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); });

function fill(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderControls(board = new Board(), initialInput?: string) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const askConfirm = vi.fn(async () => false);
  const changed = vi.fn(() => root.render(<FirstPaint />));
  const notify = vi.fn();
  const props = { board, backgroundColor: '#ffffff', onBackgroundColorChange: vi.fn(), changed,
    askText: vi.fn(async (): Promise<string | null> => null), askConfirm, notify };
  function FirstPaint() {
    // 受動effectより早い入力を防御的に検証する。クリックで開くReact 19の実行順序や元のE2E失敗を再現するものではない。
    useLayoutEffect(() => {
      if (initialInput !== undefined) fill(container.querySelector('input')!, initialInput);
    }, []);
    return <GridControls {...props} />;
  }
  await act(async () => root.render(<FirstPaint />));
  const inputs = () => [...container.querySelectorAll<HTMLInputElement>('.size-inputs input')];
  const apply = async () => { await act(async () => container.querySelector<HTMLButtonElement>('.size-inputs button')!.click()); };
  const dimensions = async (rows: string, cols: string) => {
    await act(async () => { fill(inputs()[0], rows); fill(inputs()[1], cols); });
  };
  const rerender = async () => { await act(async () => root.render(<FirstPaint />)); };
  return { inputs, apply, dimensions, rerender, render: () => root.render(<FirstPaint />), askConfirm, askText: props.askText, changed, notify };
}

it.each(['', '1000'])('preserves an input made before initial passive effects: %j', async (value) => {
  const view = await renderControls(new Board(), value);
  expect(view.inputs()[0].value).toBe(value);
  await view.rerender();
  expect(view.inputs()[0].value).toBe(value);
  if (value) { await view.apply(); expect(view.inputs()[0].value).toBe(value); }
});
it('keeps stitch numbers when columns grow and shrink at the left edge', async () => {
  const board = new Board();
  board.place(19, 17, 'knit', '#123456'); // 1段、3目。
  const value = board.valueAt(19, 17);
  const view = await renderControls(board);
  await view.dimensions('20', '22');
  await view.apply();
  expect(board.valueAt(19, 19)).toBe(value);
  await view.dimensions('20', '18');
  await view.apply();
  expect(board.valueAt(19, 15)).toBe(value);
  expect(view.askConfirm).not.toHaveBeenCalled();
});
it('counts removed anchors once and leaves the board and history untouched on cancel', async () => {
  const board = new Board();
  board.place(0, 10, 'knit', '#123456');
  board.place(10, 1, 'right_up_two_cross', '#123456'); // 起点だけが左端を越える4目記号。
  board.place(10, 10, 'knit', '#123456');
  const original = board.cells.slice();
  const history = new BoardHistory(board);
  const view = await renderControls(board);
  view.changed.mockImplementation(() => { history.record(board); view.render(); });
  await view.dimensions('18', '18');
  await view.apply();
  expect(view.askConfirm).toHaveBeenCalledWith('記号2個が消えます。変更しますか？');
  expect([board.rows, board.cols]).toEqual([20, 20]);
  expect(board.cells).toEqual(original);
  expect(view.changed).not.toHaveBeenCalled();
  expect(history.canUndo).toBe(false);
  view.askConfirm.mockResolvedValue(true);
  await view.apply();
  expect(board.occupiedStitchCount).toBe(1);
  expect(history.undo(board)).toBe(true);
  expect(board.cells).toEqual(original);
  await view.rerender();
  expect(view.inputs().map((input) => input.value)).toEqual(['20', '20']);
  expect(history.redo(board)).toBe(true);
  await view.rerender();
  expect(view.inputs().map((input) => input.value)).toEqual(['18', '18']);
  expect(board.occupiedStitchCount).toBe(1);
});

it('waits for confirmation before applying and ignores repeated clicks while it is open', async () => {
  const board = new Board();
  board.place(0, 0, 'knit', '#123456');
  const view = await renderControls(board);
  let confirm!: (accepted: boolean) => void;
  view.askConfirm.mockImplementation(() => new Promise<boolean>((resolve) => { confirm = resolve; }));
  await view.dimensions('18', '18');
  await view.apply();
  await view.apply();
  expect(view.askConfirm).toHaveBeenCalledOnce();
  expect([board.rows, board.cols, board.occupiedStitchCount]).toEqual([20, 20, 1]);
  expect(view.changed).not.toHaveBeenCalled();
  await act(async () => confirm(true));
  expect([board.rows, board.cols, board.occupiedStitchCount]).toEqual([18, 18, 0]);
  expect(view.changed).toHaveBeenCalledOnce();
});
it.each([
  ['上の段', 0, 0, 3, 4],
  ['下の段', 3, 0, 3, 4],
  ['左の列', 0, 0, 4, 3],
  ['右の列', 0, 3, 4, 3],
] as const)('deletes an occupied edge without confirmation or notification: %s', async (name, row, col, rows, cols) => {
  const board = new Board(4, 4);
  board.place(row, col, 'knit', '#123456');
  const view = await renderControls(board);
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === name)!.click());
  expect(view.askConfirm).not.toHaveBeenCalled();
  expect(view.notify).not.toHaveBeenCalled();
  expect([board.rows, board.cols, board.occupiedStitchCount]).toEqual([rows, cols, 0]);
  expect(view.changed).toHaveBeenCalledOnce();
});

it.each(['段', '列'])('deletes a stitch at a specified displayed position without confirmation or notification: %s', async (kind) => {
  const board = new Board(4, 4);
  board.place(1, 1, 'right_cross', '#123456');
  const view = await renderControls(board);
  view.askText.mockResolvedValue('3');
  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === `${kind}を削除`)!.click());
  expect(view.askConfirm).not.toHaveBeenCalled();
  expect(view.notify).not.toHaveBeenCalled();
  expect(kind === '段' ? board.rows : board.cols).toBe(3);
  expect(board.occupiedStitchCount).toBe(0);
  expect(view.changed).toHaveBeenCalledOnce();
});
