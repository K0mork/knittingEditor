import { act, createElement, createRef, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { STITCHES } from '../stitches/catalog';
import { zoomViewportAt, type BoardZoom, BoardCanvas, type CanvasMode, canvasCellAt, canvasLabelMetrics, canvasLabels, fitCanvasLabels, initialViewport, clampViewport, glyphSearchStart, LABEL_SIZE, LIGHT_CANVAS_CHROME, readCanvasChrome } from './BoardCanvas';

describe('glyphSearchStart', () => {
  it('includes off-screen anchors whose multi-cell glyph overlaps the viewport', () => {
    const maxWidth = Math.max(...STITCHES.map((stitch) => stitch.width));
    const maxHeight = Math.max(...STITCHES.map((stitch) => stitch.height));

    expect(glyphSearchStart(8, 9)).toEqual({
      row: 8 - maxHeight + 1,
      col: 9 - maxWidth + 1,
    });
    expect(glyphSearchStart(0, 0)).toEqual({ row: 0, col: 0 });
  });
});

describe('clampViewport', () => {
  // 表示領域は番号の帯を除いた400×300。中央は(LABEL_SIZE + 200, LABEL_SIZE + 150)。
  const canvas = { width: LABEL_SIZE + 400, height: LABEL_SIZE + 300 };
  const centerX = LABEL_SIZE + 200;
  const centerY = LABEL_SIZE + 150;
  const board = { rows: 50, cols: 40 };

  it('keeps a position that is already within range', () => {
    const view = { x: 0, y: 0, cell: 20 };
    expect(clampViewport(view, board, canvas)).toBe(view);
  });

  it('stops when the top-left cell reaches the center of the visible area', () => {
    const view = clampViewport({ x: 10_000, y: 10_000, cell: 20 }, board, canvas);
    expect(view.x + 0.5 * view.cell).toBe(centerX);
    expect(view.y + 0.5 * view.cell).toBe(centerY);
  });

  it('stops when the bottom-right cell reaches the center of the visible area', () => {
    const view = clampViewport({ x: -10_000, y: -10_000, cell: 20 }, board, canvas);
    expect(view.x + (board.cols - 0.5) * view.cell).toBe(centerX);
    expect(view.y + (board.rows - 0.5) * view.cell).toBe(centerY);
  });

  it('lets a board smaller than the visible area move until either edge cell reaches the center', () => {
    const small = { rows: 3, cols: 2 };
    const right = clampViewport({ x: 10_000, y: 10_000, cell: 20 }, small, canvas);
    expect(right).toEqual({ x: centerX - 10, y: centerY - 10, cell: 20 });
    const left = clampViewport({ x: -10_000, y: -10_000, cell: 20 }, small, canvas);
    expect(left).toEqual({ x: centerX - 30, y: centerY - 50, cell: 20 });
    // 範囲の内側なら、画面の端へ寄せたりせずにそのまま置ける。
    const inside = { x: centerX - 20, y: centerY - 30, cell: 20 };
    expect(clampViewport(inside, small, canvas)).toBe(inside);
    // 左上の初期位置からは、右下のマスが中央に来るところまで寄せる。
    expect(clampViewport({ x: LABEL_SIZE + 8, y: LABEL_SIZE + 8, cell: 20 }, small, canvas)).toEqual(left);
  });

  it('uses the zoomed cell size for the limits', () => {
    const zoomedIn = clampViewport({ x: -10_000, y: 0, cell: 60 }, board, canvas);
    expect(zoomedIn.x).toBe(centerX - (board.cols - 0.5) * 60);
    expect(zoomedIn.cell).toBe(60);
    const zoomedOut = clampViewport({ x: -10_000, y: 0, cell: 4 }, board, canvas);
    expect(zoomedOut.x).toBe(centerX - (board.cols - 0.5) * 4);
  });

  it('pulls the board back when the canvas shrinks', () => {
    const wide = { width: LABEL_SIZE + 1000, height: LABEL_SIZE + 300 };
    const atRightLimit = clampViewport({ x: 10_000, y: 0, cell: 20 }, board, wide);
    const narrowed = clampViewport(atRightLimit, board, canvas);
    expect(narrowed.x + 0.5 * narrowed.cell).toBe(centerX);
  });

  it('does not move the board before the canvas has a size', () => {
    const view = { x: 10_000, y: -10_000, cell: 20 };
    expect(clampViewport(view, board, { width: 0, height: 0 })).toBe(view);
  });
});

describe('readCanvasChrome', () => {
  it('falls back to the light colors when the stylesheet defines no canvas colors', () => {
    expect(readCanvasChrome(document.createElement('div'))).toEqual(LIGHT_CANVAS_CHROME);
  });

  it('reads the surround, the number band and the numbers from the stylesheet variables', () => {
    const element = document.createElement('div');
    element.style.setProperty('--canvas-surround', '#1c221f');
    element.style.setProperty('--canvas-label-band', 'rgba(28, 34, 31, .96)');
    element.style.setProperty('--canvas-label', '#b6c2ba');
    document.body.append(element);
    expect(readCanvasChrome(element)).toEqual({ surround: '#1c221f', labelBand: 'rgba(28, 34, 31, .96)', label: '#b6c2ba' });
    element.remove();
  });
});

describe('screen label layout and hit testing', () => {
  it('excludes both bands after scrolling and at enlarged text sizes', () => {
    const view = { x: -24, y: -24, cell: 30 };
    expect(canvasCellAt({ x: 50, y: 12 }, view)).toBeUndefined();
    expect(canvasCellAt({ x: 12, y: 50 }, view)).toBeUndefined();
    expect(canvasCellAt({ x: 50, y: 50 }, view)).toEqual({ row: 2, col: 2 });
    expect(canvasCellAt({ x: 50, y: 50 }, view, 56)).toBeUndefined();
  });

  it('scales the font and band with the root font and leaves room for wide numbers', () => {
    expect(canvasLabelMetrics(24)).toEqual({ fontSize: 16.5, band: 42 });
    expect(canvasLabelMetrics(16, 25)).toEqual({ fontSize: 11, band: 33 });
  });

  it('caps the band and shrinks the font until the widest row number fits', () => {
    expect(canvasLabelMetrics(32)).toEqual({ fontSize: 22, band: LABEL_SIZE * 1.5 });
    expect(canvasLabelMetrics(64, 200)).toEqual({ fontSize: 44 * 34 / 200, band: LABEL_SIZE * 1.5 });
    // 文字の幅は大きさに比例するので、縮めた文字で測った幅に8pxを足しても帯を超えない。
    for (const [rootFontSize, digits] of [[24, 4], [32, 3], [32, 4], [48, 4], [53, 2], [64, 4]]) {
      const natural = canvasLabelMetrics(rootFontSize).fontSize;
      const widthAt = (size: number) => digits * 0.6 * size;
      const { fontSize, band } = canvasLabelMetrics(rootFontSize, widthAt(natural));
      expect(band).toBeLessThanOrEqual(LABEL_SIZE * 1.5);
      expect(fontSize).toBeLessThanOrEqual(natural);
      expect(widthAt(fontSize) + 8).toBeLessThanOrEqual(band + 1e-9);
    }
  });

  it('measures again when the real text width does not scale exactly with the font size', () => {
    // 小さい文字ほど相対的に幅が広くなる、比例しない測り方。
    const measure = (size: number) => 4 * 0.6 * size + 3;
    const { fontSize, band } = fitCanvasLabels(32, measure);
    expect(band).toBe(LABEL_SIZE * 1.5);
    expect(measure(fontSize) + 8).toBeLessThanOrEqual(band);
    expect(fitCanvasLabels(16, (size) => 2 * 0.6 * size)).toEqual({ fontSize: 11, band: LABEL_SIZE });
  });

  it('thins four-pixel cells and keeps all label extents outside the corner', () => {
    const labels = canvasLabels(1000, 0, 999, -20, 4, 28, 28, 700);
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label, index) => {
      expect(label.number % 10).toBe(0);
      expect(label.position - 14).toBeGreaterThanOrEqual(28);
      if (index) expect(label.position - labels[index - 1].position).toBeGreaterThanOrEqual(32);
    });
  });
});


describe('initialViewport', () => {
  for (const canvas of [{ width: 390, height: 400 }, { width: 1000, height: 800 }]) {
    it(`shows stitch 1 and row 1 at ${canvas.width}px without changing zoom`, () => {
      const board = { rows: 20, cols: 20 };
      const view = initialViewport(30, board, canvas);
      expect(view.cell).toBe(30);
      expect(view.x + 19.5 * view.cell).toBeGreaterThan(LABEL_SIZE);
      expect(view.y + 19.5 * view.cell).toBeGreaterThan(LABEL_SIZE);
      expect(view.x + 20 * view.cell).toBeLessThanOrEqual(canvas.width);
      expect(view.y + 20 * view.cell).toBeLessThanOrEqual(canvas.height);
    });
  }
  it('shows the bottom-right start of a board larger than the canvas', () => {
    const canvas = { width: 390, height: 400 };
    const view = initialViewport(30, { rows: 200, cols: 200 }, canvas);
    expect(view.cell).toBe(30);
    expect(view.x + 200 * view.cell).toBeLessThanOrEqual(canvas.width);
    expect(view.y + 200 * view.cell).toBeLessThanOrEqual(canvas.height);
    expect(view.x + 199.5 * view.cell).toBeGreaterThan(LABEL_SIZE);
    expect(view.y + 199.5 * view.cell).toBeGreaterThan(LABEL_SIZE);
    expect(view.x).toBeLessThan(0);
    expect(view.y).toBeLessThan(0);
  });
});

// 描画APIは使わず、Reactの実際のポインタ処理を検証する。

function pointerTest(mode: CanvasMode, run: (board: Board, send: (type: string, x: number, y: number, button: number, buttons: number) => void, canvas: HTMLCanvasElement) => void, zoomRef?: RefObject<BoardZoom | null>) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const board = new Board(20, 20);
  act(() => root.render(createElement(BoardCanvas, {
    zoomRef, board, revision: 0, mode, stitchKey: 'knit', color: '#000000',
    onChange: () => {}, onSelectionChange: () => {}, onPasteComplete: () => {},
  })));
  const canvas = host.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  const send = (type: string, x: number, y: number, button: number, buttons: number) => act(() => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, button, buttons });
    canvas.dispatchEvent(event);
  });
  try { run(board, send, canvas); }
  finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
}

describe('canvas mouse sequences', () => {
  it('erases only the right-down cell and never draws during right drag or release', () => pointerTest('draw', (board, send) => {
    board.place(0, 0, 'knit', '#000000');
    board.place(0, 1, 'knit', '#000000');
    send('pointerdown', 50, 50, 2, 2);
    expect(board.valueAt(0, 0)).toBe(0);
    send('pointermove', 80, 50, -1, 2);
    send('pointermove', 110, 50, -1, 2);
    send('pointerup', 110, 50, 2, 0);
    expect(board.valueAt(0, 0)).toBe(0);
    expect(board.valueAt(0, 1)).not.toBe(0);
    expect(board.valueAt(0, 2)).toBe(0);
    send('pointerdown', 110, 50, 0, 1);
    send('pointerup', 110, 50, 0, 0);
    expect(board.valueAt(0, 2)).not.toBe(0);
  }));

  it('keeps erasing along a right-button drag in erase mode', () => pointerTest('erase', (board, send) => {
    for (let col = 0; col < 5; col++) board.place(0, col, 'knit', '#000000');
    send('pointerdown', 50, 50, 2, 2);
    expect(board.valueAt(0, 0)).toBe(0);
    send('pointermove', 80, 50, -1, 2);
    send('pointermove', 110, 50, -1, 2);
    send('pointerup', 110, 50, 2, 0);
    for (const col of [0, 1, 2]) expect(board.valueAt(0, col)).toBe(0);
    for (const col of [3, 4]) expect(board.valueAt(0, col)).not.toBe(0);
  }));

  for (const mode of ['draw', 'erase'] as const) {
    it(`keeps left-button ${mode} and resumes at band re-entry without bridging the gap`, () => pointerTest(mode, (board, send) => {
      if (mode === 'erase') for (let col = 0; col < 5; col++) board.place(0, col, 'knit', '#000000');
      send('pointerdown', 50, 50, 0, 1);
      send('pointermove', 80, 50, -1, 1);
      send('pointermove', 12, 50, -1, 1);
      send('pointermove', 170, 50, -1, 1);
      send('pointerup', 170, 50, 0, 0);
      for (const col of [0, 1, 4]) expect(board.valueAt(0, col) !== 0).toBe(mode === 'draw');
      for (const col of [2, 3]) expect(board.valueAt(0, col) !== 0).toBe(mode === 'erase');
    }));
  }

  it('keeps the accessible name and description without a keyboard stop', () => pointerTest('draw', (_board, _send, canvas) => {
    expect(canvas.getAttribute('role')).toBe('region');
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(canvas.getAttribute('aria-label')).toContain('20段、20目');
    expect(document.getElementById(canvas.getAttribute('aria-describedby')!)?.textContent).toContain('タップまたはドラッグ');
  }));
});

describe('initial view timing', () => {
  it('keeps a scroll that arrives before the first frame instead of replacing it with the initial view', () => {
    // 390×477はwebkit-mobile（iPhone 14）の盤面の大きさ。初期位置では表示領域の中央が段13・目15付近になる。
    const size = { clientWidth: 390, clientHeight: 477 };
    for (const [key, value] of Object.entries(size)) Object.defineProperty(HTMLCanvasElement.prototype, key, { configurable: true, get: () => value });
    const context = new Proxy({}, { get: (_target, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => undefined), set: () => true });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as CanvasRenderingContext2D);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const board = new Board(20, 20);
    try {
      act(() => root.render(createElement(BoardCanvas, {
        board, revision: 0, mode: 'draw', stitchKey: 'knit', color: '#000000',
        onChange: () => {}, onSelectionChange: () => {}, onPasteComplete: () => {},
      })));
      const canvas = host.querySelector('canvas')!;
      canvas.setPointerCapture = () => {};
      // 最初の描画より前に、盤面を右下へ大きく動かす。左上のマスが表示領域の中央で止まる。
      act(() => { canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -100_000, deltaY: -100_000 })); });
      act(() => { while (frames.length) frames.shift()!(0); });
      const center = { x: LABEL_SIZE + (size.clientWidth - LABEL_SIZE) / 2, y: LABEL_SIZE + (size.clientHeight - LABEL_SIZE) / 2 };
      for (const [type, buttons] of [['pointerdown', 1], ['pointerup', 0]] as const) act(() => {
        const event = new Event(type, { bubbles: true });
        Object.assign(event, { pointerId: 1, pointerType: 'mouse', clientX: center.x, clientY: center.y, button: 0, buttons });
        canvas.dispatchEvent(event);
      });
      expect([...board.cells.keys()].filter((index) => board.cells[index])).toEqual([0]);
    } finally {
      act(() => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
      getContext.mockRestore();
      // 上書きした大きさを消し、HTMLElementの本来の定義へ戻す。
      for (const key of Object.keys(size)) delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>)[key];
    }
  });
});

describe('zoomViewportAt', () => {
  const view = { x: -40, y: 10, cell: 30 };
  const position = { x: 240, y: 180 };
  it('keeps the world point under the anchor and reverses an incremental zoom', () => {
    const zoomed = zoomViewportAt(view, position, 1.25);
    expect(zoomed.cell).toBe(37.5);
    expect((position.x - zoomed.x) / zoomed.cell).toBeCloseTo((position.x - view.x) / view.cell);
    expect((position.y - zoomed.y) / zoomed.cell).toBeCloseTo((position.y - view.y) / view.cell);
    expect(zoomViewportAt(zoomed, position, 0.8)).toEqual(view);
  });
  it('clamps cell size while keeping the anchor', () => {
    for (const [factor, cell] of [[100, 72], [0.001, 4]]) {
      const next = zoomViewportAt(view, position, factor);
      expect(next.cell).toBe(cell);
      expect((position.x - next.x) / next.cell).toBeCloseTo((position.x - view.x) / view.cell);
    }
  });
  it('rejects invalid factors and positions', () => {
    for (const factor of [0, -1, NaN, Infinity]) expect(zoomViewportAt(view, position, factor)).toBe(view);
    expect(zoomViewportAt(view, { x: Infinity, y: 1 }, 1.25)).toBe(view);
  });
});

describe('host board zoom', () => {
  it.each(['point', 'center'] as const)('zooms around a client %s without editing the board', (anchor) => {
    const zoomRef = createRef<BoardZoom>();
    pointerTest('draw', (board, send, canvas) => {
      Object.defineProperty(canvas, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(canvas, 'clientHeight', { value: 400, configurable: true });
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 150, right: 500, bottom: 550, width: 400, height: 400 } as DOMRect);
      zoomRef.current!.zoom(2, anchor === 'point' ? { x: 250, y: 300 } : undefined);
      expect(board.cells.some(Boolean)).toBe(false);
      // 盤面外からのズームは無視する。
      zoomRef.current!.zoom(0.5, { x: 99, y: 300 });
      const local = anchor === 'point' ? 230 : 330;
      send('pointerdown', 100 + local, 150 + local, 0, 1);
      send('pointerup', 100 + local, 150 + local, 0, 0);
      const cell = anchor === 'point' ? 5 : 7;
      expect([...board.cells.keys()].filter(index => board.cells[index])).toEqual([cell * board.cols + cell]);
    }, zoomRef);
    expect(zoomRef.current).toBeNull();
  });
});
