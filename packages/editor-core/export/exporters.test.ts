import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board, parseColor } from '../model/Board';
import { BoardHistory } from '../model/BoardHistory';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, PNG_PREFERRED_CELL_SIZE, pngGridStyles, pngLabelLayout, renderPdf, renderPng, validatePngSize } from './exporters';

describe('defaultPngCellSize', () => {
  it('uses the preferred cell size for ordinary boards', () => {
    const board = new Board(20, 20);
    expect(defaultPngCellSize(board)).toBe(PNG_PREFERRED_CELL_SIZE);
    const size = validatePngSize(board, defaultPngCellSize(board));
    expect([size.width, size.height]).toEqual([528, 528]);
  });

  it('falls back to the largest size that stays within the safe limits', () => {
    const board = new Board(1000, 1000);
    const size = defaultPngCellSize(board);
    expect(size).toBeLessThan(PNG_PREFERRED_CELL_SIZE);
    expect(validatePngSize(board, size).valid).toBe(true);
    expect(validatePngSize(board, size + 1).valid).toBe(false);
  });

  it('never returns a value outside the slider range', () => {
    for (const rows of [1, 20, 331, 664, 1000]) {
      const size = defaultPngCellSize(new Board(rows, rows));
      expect(size).toBeGreaterThanOrEqual(PNG_CELL_SIZE_RANGE.min);
      expect(size).toBeLessThanOrEqual(PNG_CELL_SIZE_RANGE.max);
    }
  });
});

describe('pngGridStyles', () => {
  it('keeps the previous gray lines on the default white ground', () => {
    expect(pngGridStyles(24)).toEqual({ minor: { color: '#bbbbbb', width: 1 }, major: { color: '#666666', width: 2 } });
  });

  it('draws lines lighter than a dark ground', () => {
    const { minor, major } = pngGridStyles(24, '#1e1e1e');
    expect(parseColor(minor.color)).toBeGreaterThan(0x1e_1e1e);
    expect(parseColor(major.color)).toBeGreaterThan(parseColor(minor.color));
  });
});

describe('pngLabelLayout', () => {
  it('keeps the one-cell number margin for ordinary boards', () => {
    const labels = pngLabelLayout(new Board(20, 20), 24);
    expect([labels.rowLabelWidth, labels.colLabelHeight]).toEqual([24, 24]);
    expect([labels.rowStride, labels.colStride]).toEqual([1, 1]);
  });

  it('widens the margins and thins the numbers when small cells cannot hold them', () => {
    const board = new Board(1000, 1000);
    const cellSize = defaultPngCellSize(board);
    const labels = pngLabelLayout(board, cellSize);
    // 4桁の段番号が帯からはみ出さず、隣どうしの番号も重ならない。
    expect(labels.rowLabelWidth).toBeGreaterThan(cellSize);
    expect(labels.rowLabelWidth).toBeGreaterThanOrEqual(Math.ceil(4 * 0.62 * labels.fontSize));
    expect(labels.colStride * cellSize).toBeGreaterThanOrEqual(4 * 0.62 * labels.fontSize);
    expect(labels.rowStride * cellSize).toBeGreaterThanOrEqual(labels.fontSize);
    const size = validatePngSize(board, cellSize);
    expect(size.width).toBe(1000 * cellSize + labels.rowLabelWidth * 2);
    expect(size.height).toBe(1000 * cellSize + labels.colLabelHeight * 2);
  });
});

describe('renderPng with real symbols', () => {
  it('draws colored single and multi-cell glyphs and whiteout on a dark ground', async () => {
    // Canvasの描画命令を記録する。drawCellとdrawGlyphは実装をそのまま通す。
    const strokes: Array<{ color: string; origin: number[]; path: number[][] }> = [];
    const fills: Array<{ color: string; rect: number[] }> = [];
    let origin = [0, 0];
    let path: number[][] = [];
    const context = {
      fillStyle: '', strokeStyle: '',
      fillRect: (...rect: number[]) => fills.push({ color: context.fillStyle, rect }),
      fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(),
      translate: (x: number, y: number) => { origin = [x, y]; },
      beginPath: () => { path = []; },
      moveTo: (...point: number[]) => path.push(point),
      lineTo: (...point: number[]) => path.push(point),
      ellipse: vi.fn(), bezierCurveTo: vi.fn(),
      stroke: () => strokes.push({ color: context.strokeStyle, origin: [...origin], path: [...path] }),
    };
    const canvas = {
      width: 0, height: 0, getContext: () => context,
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    try {
      const board = new Board(2, 4);
      board.place(0, 0, 'knit', '#c83264', false);
      board.place(1, 1, 'right_up_two_one', '#2468ac', false);
      board.place(1, 3, 'erase', '#abcdef', false);
      expect((await renderPng(board, 24, '#1e1e1e')).type).toBe('image/png');
      const knit = strokes.filter((stroke) => stroke.color === '#c83264');
      expect(knit).toEqual([expect.objectContaining({ origin: [24, 24] })]);
      expect(knit[0].path.length).toBeGreaterThan(1);
      const wide = strokes.find((stroke) => stroke.color === '#2468ac')!;
      expect(wide.origin).toEqual([48, 48]);
      expect(Math.max(...wide.path.map((point) => point[0]))).toBeGreaterThan(100);
      expect(fills).toContainEqual({ color: '#fff', rect: [96, 48, 24, 24] });
      strokes.length = 0;
      fills.length = 0;
      await renderPng(new Board(2, 4), 24, '#1e1e1e');
      expect(strokes.some((stroke) => ['#c83264', '#2468ac'].includes(stroke.color))).toBe(false);
      expect(fills).not.toContainEqual({ color: '#fff', rect: [96, 48, 24, 24] });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('renderPdf worker failures', () => {
  const options = { layout: 'single', orientation: 'portrait', cellMillimeters: 5 } as const;
  afterEach(() => vi.unstubAllGlobals());

  function mockWorker(reply: (worker: Worker) => void) {
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class {
      onmessage: Worker['onmessage'] = null;
      onerror: Worker['onerror'] = null;
      constructor() { queueMicrotask(() => this.onmessage?.call(this as unknown as Worker, { data: { ready: true } } as MessageEvent)); }
      terminate = terminate;
      postMessage() { queueMicrotask(() => reply(this as unknown as Worker)); }
    });
    return terminate;
  }

  it.each([undefined, '', '   '])('explains retry without recommending reload for an empty error message (%s)', async (message) => {
    const terminate = mockWorker((worker) => worker.onerror?.call(worker, message === undefined ? new Event('error') as ErrorEvent : { message } as ErrorEvent));
    await expect(renderPdf(new Board(1, 1), options)).rejects.toThrow('PDFを生成できませんでした。もう一度お試しください。');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('preserves an error message from PDF generation', async () => {
    const terminate = mockWorker((worker) => worker.onmessage?.call(worker, { data: { ok: false, error: '生成中の例外' } } as MessageEvent));
    await expect(renderPdf(new Board(1, 1), options)).rejects.toThrow('生成中の例外');
    expect(terminate).toHaveBeenCalledOnce();
  });

  it('rejects a constructor exception and allows a subsequent successful attempt', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Workerを開始できません'); } });
    await expect(renderPdf(new Board(1, 1), options)).rejects.toThrow('Workerを開始できません');
    mockWorker((worker) => worker.onmessage?.call(worker, { data: { ok: true, pdf: new ArrayBuffer(8) } } as MessageEvent));
    expect((await renderPdf(new Board(1, 1), options)).type).toBe('application/pdf');
  });
});


describe('renderPdf board snapshot', () => {
  const options = { layout: 'single', orientation: 'portrait', cellMillimeters: 5 } as const;
  afterEach(() => vi.unstubAllGlobals());

  /** readyを手で送るWorker。送られた要求と転送リストを記録する。 */
  function heldWorker() {
    const state = { instance: undefined as Worker | undefined, postMessage: vi.fn() };
    vi.stubGlobal('Worker', class {
      onmessage = null;
      terminate() {}
      postMessage = state.postMessage;
      constructor() { state.instance = this as unknown as Worker; }
    });
    const message = (data: unknown) => state.instance!.onmessage?.call(state.instance!, { data } as MessageEvent);
    return { state, message };
  }

  it('copies PDF cells once when export starts and transfers that copy after ready', async () => {
    const { state, message } = heldWorker();
    const board = new Board(2, 2);
    board.place(1, 1, 'knit', '#111111', false);
    const slice = vi.spyOn(board.cells, 'slice');
    const pending = renderPdf(board, options);
    expect(slice).toHaveBeenCalledOnce();
    expect(state.postMessage).not.toHaveBeenCalled();
    message({ ready: true });
    const [request, transfer] = state.postMessage.mock.calls[0];
    expect(request.cells).not.toBe(board.cells.buffer);
    expect(new Uint32Array(request.cells)).toEqual(board.cells);
    expect(transfer).toEqual([request.cells]);
    expect(transfer[0]).toBe(request.cells);
    // 重複したreadyでは送り直さない。
    message({ ready: true });
    expect(state.postMessage).toHaveBeenCalledOnce();
    expect(slice).toHaveBeenCalledOnce();
    message({ ok: true, pdf: new ArrayBuffer(8) });
    const blob = await pending;
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe(8);
  });

  it.each(['undo', 'insert row'] as const)('exports the board as it was when export started after %s before the worker is ready', async (change) => {
    const { state, message } = heldWorker();
    const board = new Board(4, 2);
    const history = new BoardHistory(board);
    board.place(0, 0, 'knit', '#c83264', false);
    board.addLine(1, 0, 2);
    history.record(board);
    const cells = Array.from(board.cells);
    const lines = board.lines;
    const pending = renderPdf(board, options, '#1e1e1e');
    // Workerの起動を待つ間に盤面を変える。
    if (change === 'undo') expect(history.undo(board)).toBe(true);
    else board.insertRow(0);
    expect(Array.from(board.cells)).not.toEqual(cells);
    expect(board.lines).not.toEqual(lines);
    message({ ready: true });
    const [request] = state.postMessage.mock.calls[0];
    expect(request).toMatchObject({ rows: 4, cols: 2, background: '#1e1e1e', layout: 'single' });
    expect(Array.from(new Uint32Array(request.cells))).toEqual(cells);
    expect(request.lines).toEqual([{ col: 1, top: 0, bottom: 2 }]);
    expect(request.lines).toBe(lines);
    message({ ok: true, pdf: new ArrayBuffer(8) });
    await pending;
  });

  it.each([
    { ok: true },
    { ok: true, pdf: null },
    { ok: false },
    {},
  ])('rejects a malformed PDF response with the retry message: %o', async (response) => {
    const { message } = heldWorker();
    const pending = renderPdf(new Board(1, 1), options);
    message({ ready: true });
    message(response);
    await expect(pending).rejects.toThrow('PDFを生成できませんでした。もう一度お試しください。');
  });
});

describe('renderPng canvas release', () => {
  /** 描画命令を何もしない関数で受けるCanvasの代わり。 */
  function fakeCanvas(overrides: { context?: object | null; toBlob?: (callback: BlobCallback) => void } = {}) {
    const context = overrides.context === undefined
      ? new Proxy({} as Record<string | symbol, unknown>, {
        get: (target, key) => key in target ? target[key] : (target[key] = vi.fn()),
        set: (target, key, value) => { target[key] = value; return true; },
      })
      : overrides.context;
    const canvas = {
      width: 0, height: 0,
      getContext: () => context,
      toBlob: overrides.toBlob ?? ((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' }))),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    return canvas;
  }
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the canvas until encoding completes and then shrinks it', async () => {
    let complete!: BlobCallback;
    const canvas = fakeCanvas({ toBlob: (callback) => { complete = callback; } });
    const board = new Board(2, 2);
    const size = validatePngSize(board, 24);
    const pending = renderPng(board, 24);
    await Promise.resolve();
    // エンコード中は描画面を縮めない。
    expect([canvas.width, canvas.height]).toEqual([size.width, size.height]);
    const blob = new Blob(['png'], { type: 'image/png' });
    complete(blob);
    expect(await pending).toBe(blob);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it.each([
    ['an empty blob', () => fakeCanvas({ toBlob: (callback) => callback(null) }), 'PNG生成に失敗しました'],
    ['no 2D context', () => fakeCanvas({ context: null }), 'Canvasを利用できません'],
    ['a toBlob exception', () => fakeCanvas({ toBlob: () => { throw new Error('toBlob失敗'); } }), 'toBlob失敗'],
    ['a drawing exception', () => fakeCanvas({ context: { fillRect: () => { throw new Error('描画失敗'); } } }), '描画失敗'],
  ] as const)('shrinks the canvas after %s', async (_name, create, message) => {
    const canvas = create();
    await expect(renderPng(new Board(2, 2), 24)).rejects.toThrow(message);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });
});

it.each(['#ffffff', '#1e1e1e'])('PNGの点線を両端の縁の間に描き、一覧にも線を加える（%s）', async (background) => {
  const paths: Array<{ color: string; points: number[][]; dash: number[]; width: number }> = [];
  const fills: number[][][] = [];
  let points: number[][] = [];
  let dash: number[] = [];
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 0,
    fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: () => { points = []; },
    moveTo: (...point: number[]) => points.push(point),
    lineTo: (...point: number[]) => points.push(point),
    setLineDash: (value: number[]) => { dash = value; },
    closePath: vi.fn(), fill: () => fills.push([...points]),
    stroke: () => paths.push({ color: context.strokeStyle, points: [...points], dash: [...dash], width: context.lineWidth }),
  };
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => callback(new Blob(['png'])) };
  vi.stubGlobal('document', { createElement: () => canvas });
  try {
    const board = new Board(6, 3);
    board.addLine(1, 0, 4);
    await renderPng(board, 24, background);
    const line = paths.find((path) => path.dash.length)!;
    expect(line.color).toBe(background === '#ffffff' ? '#333333' : '#e6e6e6');
    // 線は編み目記号の線と同じマスの9%、矢印は長さ46%・幅52%。
    expect(line.width).toBeCloseTo(24 * 0.09);
    expect(line.dash.map((value) => value / 24)).toEqual([expect.closeTo(0.14), expect.closeTo(0.1)]);
    expect(line.points).toEqual([[60, 48], [60, expect.closeTo(120 - 24 * 0.46)]]);
    const arrow = fills.find((fill) => fill.length === 3 && fill[0][1] === 120)!;
    expect(arrow[0]).toEqual([60, 120]);
    expect(arrow[2][0] - arrow[1][0]).toBeCloseTo(24 * 0.52);
    expect(arrow[1][1]).toBeCloseTo(120 - 24 * 0.46);
    await renderPng(board, 24, background, { includeTitleAndLegend: true });
    expect(context.fillText).toHaveBeenCalledWith('線', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(validatePngSize(board, 24, { includeTitleAndLegend: true }).height).toBeGreaterThan(validatePngSize(new Board(6, 3), 24, { includeTitleAndLegend: true }).height);
  } finally { vi.unstubAllGlobals(); }
});
