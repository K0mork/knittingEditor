import { describe, expect, it } from 'vitest';
import { parseColor } from './Board';
import {
  BACKGROUND_PRESETS, backgroundColorOf, boardSurface, DEFAULT_BACKGROUND_COLOR, isDarkColor, mixColor,
  normalizeBackgroundColor, relativeLuminance,
} from './boardColors';

describe('normalizeBackgroundColor', () => {
  it('accepts #rrggbb and lowercases it', () => {
    expect(normalizeBackgroundColor('#1E1E1E')).toBe('#1e1e1e');
  });

  it('rejects anything else', () => {
    for (const value of [undefined, null, 0x808080, '', '808080', '#fff', '#12345g', '#1234567', ' #123456']) {
      expect(normalizeBackgroundColor(value)).toBeUndefined();
    }
  });
});

describe('backgroundColorOf', () => {
  it('reads a missing or broken color as the default white', () => {
    expect(backgroundColorOf({})).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(backgroundColorOf({ backgroundColor: 'red' })).toBe(DEFAULT_BACKGROUND_COLOR);
    expect(backgroundColorOf({ backgroundColor: '#808080' })).toBe('#808080');
  });
});

describe('isDarkColor', () => {
  it('treats the gray preset as light and the black preset as dark', () => {
    const preset = (label: string) => parseColor(BACKGROUND_PRESETS.find((item) => item.label === label)!.color);
    expect(BACKGROUND_PRESETS.map((item) => item.label)).toEqual(['白', 'グレー', '黒']);
    expect(isDarkColor(preset('白'))).toBe(false);
    expect(isDarkColor(preset('グレー'))).toBe(false);
    expect(isDarkColor(preset('黒'))).toBe(true);
  });

  it('switches where the contrast with black and with white is equal', () => {
    expect(relativeLuminance(0xff_ffff)).toBeCloseTo(1);
    expect(relativeLuminance(0)).toBe(0);
    expect(isDarkColor(0x75_7575)).toBe(true);
    expect(isDarkColor(0x76_7676)).toBe(false);
  });
});

describe('mixColor', () => {
  it('moves each channel toward the target', () => {
    expect(mixColor(0xff_ffff, 0, 0.6)).toBe(0x66_6666);
    expect(mixColor(0x00_80ff, 0xff_ffff, 0)).toBe(0x00_80ff);
    expect(mixColor(0x00_80ff, 0xff_ffff, 1)).toBe(0xff_ffff);
  });
});

describe('boardSurface', () => {
  it('keeps the previous look on the default white ground', () => {
    expect(boardSurface('#ffffff', 'png')).toEqual({ background: '#ffffff', stripe: '#f3f4f3', minorLine: '#bbbbbb', majorLine: '#666666' });
    expect(boardSurface('#ffffff', 'pdf')).toMatchObject({ minorLine: '#c7c7c7', majorLine: '#666666' });
    // 以前の画面の罫線は#c9cec7・#7d8a83。
    expect(boardSurface('#ffffff', 'screen')).toMatchObject({ minorLine: '#c9cecb', majorLine: '#7d8982' });
  });

  it('draws lighter lines and stripes on a dark ground', () => {
    const ground = parseColor('#1e1e1e');
    const surface = boardSurface('#1e1e1e', 'screen');
    for (const color of [surface.stripe, surface.minorLine, surface.majorLine]) {
      expect(relativeLuminance(parseColor(color))).toBeGreaterThan(relativeLuminance(ground));
    }
    expect(relativeLuminance(parseColor(surface.majorLine))).toBeGreaterThan(relativeLuminance(parseColor(surface.minorLine)));
  });

  it('draws darker lines on a light ground', () => {
    const surface = boardSurface('#808080', 'png');
    expect(relativeLuminance(parseColor(surface.minorLine))).toBeLessThan(relativeLuminance(0x80_8080));
    expect(relativeLuminance(parseColor(surface.majorLine))).toBeLessThan(relativeLuminance(parseColor(surface.minorLine)));
  });
});
