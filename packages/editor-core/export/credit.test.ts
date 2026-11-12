import { describe, expect, it } from 'vitest';
import { CREDIT_NAME, CREDIT_URL, creditQr } from './credit';

describe('creditQr', () => {
  it('encodes the site URL with a quiet zone', () => {
    expect(CREDIT_NAME).toBe('棒針編み図エディタ');
    expect(CREDIT_URL).toBe('https://knittingeditor.com/');
    const { size, modules } = creditQr();
    expect(size).toBeGreaterThanOrEqual(25);
    expect(modules).toHaveLength(size);
    expect(modules.every((row) => row.length === size)).toBe(true);
    // 周囲2モジュールは白い余白。
    for (let index = 0; index < 2; index++) {
      expect(modules[index].every((dark) => !dark)).toBe(true);
      expect(modules[size - 1 - index].every((dark) => !dark)).toBe(true);
      expect(modules.every((row) => !row[index] && !row[size - 1 - index])).toBe(true);
    }
  });

  it('draws the three position markers', () => {
    const { modules, size } = creditQr();
    const marker = (top: number, left: number) => {
      for (let offset = 0; offset < 7; offset++) {
        expect(modules[top][left + offset]).toBe(true);
        expect(modules[top + 6][left + offset]).toBe(true);
        expect(modules[top + offset][left]).toBe(true);
        expect(modules[top + offset][left + 6]).toBe(true);
      }
      for (let row = 2; row < 5; row++) {
        for (let col = 2; col < 5; col++) expect(modules[top + row][left + col]).toBe(true);
      }
      expect(modules[top + 1][left + 1]).toBe(false);
    };
    marker(2, 2);
    marker(2, size - 9);
    marker(size - 9, 2);
  });

  it('returns the same code every time', () => {
    expect(creditQr()).toEqual(creditQr());
  });
});
