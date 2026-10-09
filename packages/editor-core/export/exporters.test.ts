import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board, parseColor } from '../model/Board';
import { defaultPngCellSize, PNG_CELL_SIZE_RANGE, PNG_PREFERRED_CELL_SIZE, pngGridStyles, pngLabelLayout, renderPdf, validatePngSize } from './exporters';

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


describe('renderPdf worker failures', () => {
  const options = { layout: 'single', orientation: 'portrait', cellMillimeters: 5 } as const;
  afterEach(() => vi.unstubAllGlobals());

  function mockWorker(reply: (worker: Worker) => void) {
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class {
      onmessage: Worker['onmessage'] = null;
      onerror: Worker['onerror'] = null;
      terminate = terminate;
      postMessage() { queueMicrotask(() => reply(this as unknown as Worker)); }
    });
    return terminate;
  }

  it.each([undefined, '', '   '])('explains reload and retry for an empty error message (%s)', async (message) => {
    const terminate = mockWorker((worker) => worker.onerror?.call(worker, message === undefined ? new Event('error') as ErrorEvent : { message } as ErrorEvent));
    await expect(renderPdf(new Board(1, 1), options)).rejects.toThrow('PDFを生成できませんでした。ページを再読み込みして、もう一度お試しください。');
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
