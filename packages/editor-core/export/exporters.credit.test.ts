import { describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { pngHeader, whitePixel } from './pngCanvas.test-helper';
import { creditQr } from './credit';
import { PNG_CREDIT_MIN_WIDTH, pngCreditLayout, renderPng, validatePngSize } from './exporters';

/** 描画命令を記録するCanvas。`drawCell`などは実装をそのまま通す。 */
function recordingCanvas() {
  const fills: Array<{ color: string; rect: number[] }> = [];
  const texts: Array<{ color: string; text: string; x: number; y: number }> = [];
  const context = {
    fillStyle: '', strokeStyle: '',
    fillRect: (...rect: number[]) => fills.push({ color: context.fillStyle, rect }),
    fillText: (text: string, x: number, y: number) => texts.push({ color: context.fillStyle, text, x, y }),
    save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    ellipse: vi.fn(), bezierCurveTo: vi.fn(), stroke: vi.fn(), getImageData: whitePixel,
  };
  const sizes: Array<{ width: number; height: number }> = [];
  const canvas = {
    width: 0, height: 0, getContext: () => context,
    toBlob: (callback: BlobCallback) => {
      sizes.push({ width: canvas.width, height: canvas.height });
      callback(pngHeader(canvas.width, canvas.height));
    },
  };
  return { canvas, context, fills, texts, sizes };
}

describe('PNGのクレジット', () => {
  it('adds a bottom band only when the credit is on', async () => {
    const board = new Board(2, 4);
    const size = validatePngSize(board, 24, { includeCredit: true });
    expect(size.height).toBe(validatePngSize(board, 24).height + pngCreditLayout(size.width).height);
    const { canvas, fills, texts, sizes } = recordingCanvas();
    vi.stubGlobal('document', { createElement: () => canvas });
    try {
      await renderPng(board, 24, '#ffffff', { includeCredit: true });
      expect(sizes).toEqual([{ width: size.width, height: size.height }]);
      const layout = pngCreditLayout(size.width);
      const top = size.height - layout.height;
      // 白い帯と、上端の区切り線。
      expect(fills).toContainEqual({ color: '#fff', rect: [0, top, size.width, layout.height] });
      expect(fills).toContainEqual({ color: '#d5dbd3', rect: [0, top, size.width, 1] });
      // QRの黒モジュールは右端のQRの範囲にだけ描く。
      const black = fills.filter((fill) => fill.color === '#000');
      expect(black.length).toBeGreaterThan(creditQr().size);
      for (const { rect } of black) {
        expect(rect[0]).toBeGreaterThanOrEqual(size.width - layout.gap - layout.qr);
        expect(rect[1]).toBeGreaterThanOrEqual(top + layout.gap);
      }
      // サイト名とURLは左に描く。
      const creditTexts = texts.filter((item) => item.text === '棒針編み図エディタ' || item.text === 'https://knittingeditor.com/');
      expect(creditTexts).toHaveLength(2);
      expect(creditTexts.every((item) => item.x < size.width - layout.qr)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps room for the credit on a very small chart', async () => {
    const board = new Board(1, 1);
    const size = validatePngSize(board, 2, { includeCredit: true });
    expect(size.width).toBe(PNG_CREDIT_MIN_WIDTH);
    const layout = pngCreditLayout(size.width);
    expect(size.width - layout.qr - layout.gap * 4).toBeGreaterThan(120);
  });

  it('leaves no credit when the option is off', async () => {
    const { canvas, fills, texts, sizes } = recordingCanvas();
    vi.stubGlobal('document', { createElement: () => canvas });
    try {
      const size = validatePngSize(new Board(2, 4), 24);
      await renderPng(new Board(2, 4), 24, '#ffffff');
      expect(sizes).toEqual([{ width: size.width, height: size.height }]);
      expect(texts.some((item) => item.text === '棒針編み図エディタ' || item.text === 'https://knittingeditor.com/')).toBe(false);
      expect(fills.filter((fill) => fill.color === '#000')).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
