import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board, type Rect } from '../model/Board';
import { BoardCanvas, type CanvasMode } from './BoardCanvas';

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

function setup(mode: CanvasMode, selected?: Rect) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const board = new Board(20, 20);
  const onChange = vi.fn();
  const onPasteComplete = vi.fn();
  const onEditEnd = vi.fn();
  const source = new Board(1, 1);
  source.place(0, 0, 'knit', '#000000');
  const pasteBlock = mode === 'paste' ? source.createBlock({ top: 0, left: 0, bottom: 0, right: 0 }, 'test') : undefined;
  let selection = selected;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = () => root.render(<BoardCanvas board={board} revision={0} mode={mode} stitchKey="knit" color="#000000"
    selection={selection} pasteBlock={pasteBlock} onChange={onChange} onSelectionChange={(next) => { selection = next; render(); }} onPasteComplete={onPasteComplete} onEditEnd={onEditEnd} />);
  act(render);
  const canvas = host.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  const pointer = (type: string, id: number, x: number, y: number, pointerType = 'touch') => act(() => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
    canvas.dispatchEvent(event);
  });
  return { board, onChange, onPasteComplete, onEditEnd, pointer, canvas, setMode: (next: CanvasMode) => act(() => { mode = next; render(); }), selection: () => selection, close: () => act(() => root.unmount()) };
}

describe('canvas touch editing', () => {
  for (const mode of ['draw', 'erase'] as const) {
    it(`discards provisional ${mode} after the first touch moves and a second arrives`, () => {
      const ui = setup(mode);
      if (mode === 'erase') ui.board.place(5, 5, 'knit', '#000000');
      const before = ui.board.cells.slice();
      ui.pointer('pointerdown', 1, 200, 200);
      ui.pointer('pointermove', 1, 203, 202);
      ui.pointer('pointerdown', 2, 260, 200);
      ui.pointer('pointerup', 2, 260, 200);
      ui.pointer('pointerup', 1, 203, 202);
      expect(ui.board.cells).toEqual(before);
      expect(ui.onChange).not.toHaveBeenCalled();
      ui.close();
    });

    it(`commits a single-finger ${mode} stroke`, () => {
      const ui = setup(mode);
      if (mode === 'erase') ui.board.place(5, 5, 'knit', '#000000');
      ui.pointer('pointerdown', 1, 200, 200);
      ui.pointer('pointermove', 1, 203, 202);
      ui.pointer('pointerup', 1, 203, 202);
      expect(ui.board.occupiedStitchCount).toBe(mode === 'draw' ? 1 : 0);
      expect(ui.onChange).toHaveBeenCalledTimes(1);
      ui.close();
    });
  }

  it('restores the previous selection including when the first touch starts outside the board', () => {
    const selected = { top: 2, left: 2, bottom: 6, right: 8 };
    for (const position of [200, 800]) {
      const ui = setup('select', selected);
      ui.pointer('pointerdown', 1, position, position);
      ui.pointer('pointerdown', 2, 260, 200);
      ui.pointer('pointerup', 2, 260, 200);
      ui.pointer('pointerup', 1, position, position);
      expect(ui.selection()).toEqual(selected);
      ui.close();
    }
  });

  for (const mode of ['draw', 'erase', 'select', 'paste', 'line'] as const) {
    it(`ignores band touches in ${mode} mode`, () => {
      const ui = setup(mode);
      // Fill the board so an erase under a band would change it.
      if (mode === 'erase') {
        for (let row = 0; row < ui.board.rows; row += 1) {
          for (let col = 0; col < ui.board.cols; col += 1) ui.board.place(row, col, 'knit', '#000000');
        }
      }
      const before = ui.board.cells.slice();
      ui.canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 60, deltaY: 60, cancelable: true }));
      ui.pointer('pointerdown', 1, 50, 12);
      ui.pointer('pointerup', 1, 50, 12);
      expect(ui.onChange).not.toHaveBeenCalled();
      expect(ui.onPasteComplete).not.toHaveBeenCalled();
      expect(ui.selection()).toBeUndefined();
      expect(ui.board.cells).toEqual(before);
      ui.close();
    });
  }
});

it('keeps single-finger selection working and ignores the band endpoint', () => {
  const ui = setup('select');
  ui.pointer('pointerdown', 1, 75, 75);
  ui.pointer('pointermove', 1, 165, 165);
  ui.pointer('pointermove', 1, 12, 165);
  ui.pointer('pointerup', 1, 12, 165);
  expect(ui.selection()).toEqual({ top: 1, left: 1, bottom: 4, right: 4 });
  ui.close();
});

it('does not paste when a visible-cell tap ends in a number band', () => {
  const ui = setup('paste');
  ui.pointer('pointerdown', 1, 75, 75);
  ui.pointer('pointerup', 1, 12, 75);
  expect(ui.onPasteComplete).not.toHaveBeenCalled();
  expect(ui.board.occupiedStitchCount).toBe(0);
  ui.close();
});

it('does not begin drawing when a finger moves from the band into the board', () => {
  const ui = setup('draw');
  ui.pointer('pointerdown', 1, 12, 75);
  ui.pointer('pointermove', 1, 75, 75);
  ui.pointer('pointerup', 1, 75, 75);
  expect(ui.onChange).not.toHaveBeenCalled();
  ui.close();
});

it('線を2回のタップで作り、途中を押すと消す', () => {
  const ui = setup('line');
  for (const y of [75, 195]) {
    ui.pointer('pointerdown', 1, 75, y);
    ui.pointer('pointerup', 1, 75, y);
  }
  expect(ui.board.lines).toEqual([{ col: 1, top: 1, bottom: 5 }]);
  ui.pointer('pointerdown', 1, 75, 135);
  ui.pointer('pointerup', 1, 75, 135);
  expect(ui.board.lines).toEqual([]);
  expect(ui.onChange).toHaveBeenCalledTimes(2);
  ui.close();
});

it('線のドラッグは列を固定し、2本指やキャンセルでは作らない', () => {
  const ui = setup('line');
  ui.pointer('pointerdown', 1, 75, 75);
  ui.pointer('pointermove', 1, 165, 195);
  ui.pointer('pointerup', 1, 165, 195);
  expect(ui.board.lines).toEqual([{ col: 1, top: 1, bottom: 5 }]);
  ui.pointer('pointerdown', 1, 135, 75);
  ui.pointer('pointermove', 1, 135, 195);
  ui.pointer('pointerdown', 2, 195, 195);
  ui.pointer('pointerup', 2, 195, 195);
  ui.pointer('pointerup', 1, 135, 195);
  ui.pointer('pointerdown', 1, 195, 75);
  ui.pointer('pointermove', 1, 195, 195);
  ui.pointer('pointercancel', 1, 195, 195);
  expect(ui.board.lines).toHaveLength(1);
  ui.close();
});

it('同じマスとEscapeで始点を取り消し、隣接マスは新しい始点にする', () => {
  const ui = setup('line');
  const tap = (y: number) => {
    ui.pointer('pointerdown', 1, 75, y);
    ui.pointer('pointerup', 1, 75, y);
  };
  tap(75);
  tap(75);
  tap(195);
  expect(ui.board.lines).toEqual([]);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  tap(75);
  tap(105);
  expect(ui.board.lines).toEqual([]);
  tap(195);
  expect(ui.board.lines).toEqual([{ col: 1, top: 2, bottom: 5 }]);
  ui.close();
});

it('消去の1筆で記号と線を消し、タッチの暫定描画でも線を維持する', () => {
  const ui = setup('erase');
  ui.board.addLine(1, 0, 5);
  ui.board.place(2, 1, 'knit', '#ff0000');
  ui.pointer('pointerdown', 1, 75, 105);
  ui.pointer('pointermove', 1, 105, 105);
  ui.pointer('pointerup', 1, 105, 105);
  expect(ui.board.lines).toEqual([]);
  expect(ui.board.occupiedStitchCount).toBe(0);
  ui.close();
  const draw = setup('draw');
  draw.board.addLine(1, 0, 5);
  draw.pointer('pointerdown', 1, 200, 200);
  draw.pointer('pointerup', 1, 200, 200);
  expect(draw.board.lines).toHaveLength(1);
  draw.close();
});


it('モードの切り替えで始点を取り消し、端が接する線を続けて引く', () => {
  const ui = setup('line');
  const tap = (y: number) => {
    ui.pointer('pointerdown', 1, 75, y);
    ui.pointer('pointerup', 1, 75, y);
  };
  tap(75);
  ui.setMode('draw');
  ui.setMode('line');
  tap(195);
  expect(ui.board.lines).toEqual([]);
  tap(315);
  tap(315);
  tap(435);
  expect(ui.board.lines).toEqual([{ col: 1, top: 5, bottom: 9 }, { col: 1, top: 9, bottom: 13 }]);
  expect(ui.onChange).toHaveBeenCalledTimes(2);
  ui.close();
});

it('上の段や別の列を押すと新しい始点になり、作成条件を満たさなければ途中の線を消す', () => {
  const ui = setup('line');
  const tap = (x: number, y: number) => {
    ui.pointer('pointerdown', 1, x, y);
    ui.pointer('pointerup', 1, x, y);
  };
  tap(75, 195);
  tap(75, 75);
  tap(135, 105);
  tap(135, 225);
  expect(ui.board.lines).toEqual([{ col: 3, top: 2, bottom: 6 }]);
  tap(75, 75);
  tap(135, 165);
  expect(ui.board.lines).toEqual([]);
  ui.close();
});

it('始点から同じ列の2段以上下なら、既存の線の途中でも作成を優先する', () => {
  const ui = setup('line');
  ui.board.addLine(1, 2, 6);
  for (const y of [75, 135]) {
    ui.pointer('pointerdown', 1, 75, y);
    ui.pointer('pointerup', 1, 75, y);
  }
  expect(ui.board.lines).toEqual([{ col: 1, top: 1, bottom: 3 }]);
  expect(ui.onChange).toHaveBeenCalledTimes(1);
  ui.close();
});
