import { describe, expect, it } from 'vitest';
import { STITCHES, STITCH_BY_KEY, stitchSvg } from './catalog';

const EXPECTED_IDS = {
  knit: 1,
  purl: 2,
  yo: 3,
  right_up_two_one: 4,
  left_up_two_one: 5,
  purl_left_up_two_one: 6,
  right_cross: 7,
  left_cross: 8,
  purl_right_cross: 9,
  purl_left_cross: 10,
  purl_right_up_two_cross: 11,
  purl_left_up_two_cross: 12,
  purl_right_cross_twist_stitch: 13,
  purl_left_cross_twist_stitch: 14,
  middle_up_three_one: 15,
  right_up_three_one: 16,
  left_up_three_one: 17,
  right_up_two_cross: 18,
  left_up_two_cross: 19,
  right_up_three_cross: 20,
  left_up_three_cross: 21,
  slip_stitch: 22,
  twist_stitch: 23,
  purl_twist_stitch: 24,
  erase: 25,
};

describe('stitch catalog', () => {
  it('keeps persisted ids stable and unique', () => {
    expect(Object.fromEntries(STITCHES.map((stitch) => [stitch.key, stitch.id]))).toEqual(EXPECTED_IDS);
    expect(new Set(STITCHES.map((stitch) => stitch.id)).size).toBe(STITCHES.length);
    expect(new Set(STITCHES.map((stitch) => stitch.key)).size).toBe(STITCHES.length);
  });

  it('provides valid SVG markup for every definition', () => {
    for (const stitch of STITCHES) {
      expect(stitch.width).toBeGreaterThan(0);
      expect(stitch.height).toBeGreaterThan(0);
      expect(stitch.svg).toMatch(/<svg\b[^>]*viewBox="[^"]+"/);
      expect(stitch.svg).toContain('</svg>');
    }
  });

  it('accepts the legacy misspelled purl twist key', () => {
    expect(STITCH_BY_KEY.get('purl_twisst_stitch')).toBe(STITCH_BY_KEY.get('purl_twist_stitch'));
    expect(stitchSvg('purl_twisst_stitch')).toBe(stitchSvg('purl_twist_stitch'));
  });
});
