import { describe, expect, it } from 'vitest';
import { STITCHES, STITCH_BY_KEY, stitchSvg } from './catalog';
import { getGlyphDefinition, glyphPdfCommands } from './glyphs';

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

  it('records JIS status and keeps non-standard symbols explicit', () => {
    expect(STITCH_BY_KEY.get('knit')).toMatchObject({ standardStatus: 'jis', standardReference: 'JIS 2010' });
    expect(STITCH_BY_KEY.get('purl_twist_stitch')).toMatchObject({ standardStatus: 'jis-derived' });
    expect(STITCH_BY_KEY.get('right_up_three_cross')).toMatchObject({ standardStatus: 'extension' });
    expect(STITCH_BY_KEY.get('erase')).toMatchObject({ standardStatus: 'utility', renderKind: 'whiteout' });
  });

  it('separates chart span from stitch consumption', () => {
    expect(STITCH_BY_KEY.get('right_up_two_one')).toMatchObject({ width: 2, height: 1, consumes: 2, produces: 1 });
    expect(STITCH_BY_KEY.get('middle_up_three_one')).toMatchObject({ width: 3, height: 1, consumes: 3, produces: 1 });
    expect(STITCH_BY_KEY.get('slip_stitch')).toMatchObject({ width: 1, height: 2, consumes: 1, produces: 1 });
    expect(STITCH_BY_KEY.get('right_up_three_cross')).toMatchObject({ width: 6, height: 1, consumes: 6, produces: 6 });
  });

  it('uses the full operational footprint for screen and PDF vectors', () => {
    for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
      const glyph = getGlyphDefinition(stitch.key)!;
      expect(glyph.width, `${stitch.key} width`).toBe(stitch.width * 100);
      expect(glyph.height, `${stitch.key} height`).toBe(stitch.height * 100);
      expect(glyph.primitives.length).toBeGreaterThan(0);
      expect(glyphPdfCommands(stitch.key)?.commands).toContain(' S Q');
    }
  });

  it('keeps every vector primitive inside its drawing box', () => {
    for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
      const glyph = getGlyphDefinition(stitch.key)!;
      const points = glyph.primitives.flatMap((primitive) => {
        if (primitive.kind === 'line') return [primitive.from, primitive.to];
        if (primitive.kind === 'polyline') return primitive.points;
        if (primitive.kind === 'ellipse') return [
          { x: primitive.cx - primitive.rx, y: primitive.cy - primitive.ry },
          { x: primitive.cx + primitive.rx, y: primitive.cy + primitive.ry },
        ];
        return [primitive.start, ...primitive.curves.flatMap((curve) => [curve.control1, curve.control2, curve.to])];
      });
      for (const point of points) {
        expect(point.x, `${stitch.key} x`).toBeGreaterThanOrEqual(0);
        expect(point.x, `${stitch.key} x`).toBeLessThanOrEqual(glyph.width);
        expect(point.y, `${stitch.key} y`).toBeGreaterThanOrEqual(0);
        expect(point.y, `${stitch.key} y`).toBeLessThanOrEqual(glyph.height);
      }
      expect(stitch.svg).not.toMatch(/NaN|Infinity/);
    }
  });

  it('accepts the legacy misspelled purl twist key', () => {
    expect(STITCH_BY_KEY.get('purl_twisst_stitch')).toBe(STITCH_BY_KEY.get('purl_twist_stitch'));
    expect(stitchSvg('purl_twisst_stitch')).toBe(stitchSvg('purl_twist_stitch'));
  });
});
