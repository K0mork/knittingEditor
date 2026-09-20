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
  purl_right_up_two_one: 26,
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

  it('draws directional three-stitch decreases with three distinct primitives', () => {
    expect(getGlyphDefinition('right_up_three_one')?.primitives).toHaveLength(3);
    expect(getGlyphDefinition('left_up_three_one')?.primitives).toHaveLength(3);
  });

  it('joins decrease branches at the intersection without crossing past it', () => {
    const expectedRightTwo = [
      { kind: 'polyline', points: [{ x: 36, y: 84 }, { x: 104, y: 50 }, { x: 48, y: 14 }] },
      { kind: 'line', from: { x: 104, y: 50 }, to: { x: 160, y: 86 } },
    ];
    expect(getGlyphDefinition('right_up_two_one')?.primitives).toEqual(expectedRightTwo);
    expect(getGlyphDefinition('purl_right_up_two_one')?.primitives.slice(0, 2)).toEqual(expectedRightTwo);
    expect(getGlyphDefinition('left_up_two_one')?.primitives[0]).toMatchObject({
      kind: 'polyline',
      points: [{ x: 164, y: 84 }, { x: 96, y: 50 }, { x: 152, y: 14 }],
    });
    expect(getGlyphDefinition('purl_left_up_two_one')?.primitives[0]).toEqual(getGlyphDefinition('left_up_two_one')?.primitives[0]);

    expect(getGlyphDefinition('right_up_three_one')?.primitives[1]).toMatchObject({
      kind: 'polyline',
      points: [{ x: 48, y: 82 }, { x: 150, y: 50 }, { x: 60, y: 14 }],
    });
    expect(getGlyphDefinition('left_up_three_one')?.primitives[1]).toMatchObject({
      kind: 'polyline',
      points: [{ x: 252, y: 82 }, { x: 150, y: 50 }, { x: 240, y: 14 }],
    });
  });

  it('keeps the named side on top for every cable pair', () => {
    const pairs = [
      ['right_cross', 'left_cross', 1],
      ['purl_right_cross', 'purl_left_cross', 1],
      ['purl_right_up_two_cross', 'purl_left_up_two_cross', 2],
      ['right_up_two_cross', 'left_up_two_cross', 2],
      ['right_up_three_cross', 'left_up_three_cross', 3],
    ] as const;
    for (const [rightKey, leftKey, overCount] of pairs) {
      for (const [key, expectedDirection] of [[rightKey, -1], [leftKey, 1]] as const) {
        const glyph = getGlyphDefinition(key)!;
        const fullSpanLines = glyph.primitives.filter((primitive) => (
          primitive.kind === 'line'
          && Math.abs(primitive.to.x - primitive.from.x) > glyph.width * 0.75
        ));
        expect(fullSpanLines, key).toHaveLength(overCount);
        for (const primitive of fullSpanLines) {
          if (primitive.kind !== 'line') continue;
          expect(Math.sign(primitive.to.x - primitive.from.x), key).toBe(expectedDirection);
        }
      }
    }
  });

  it('keeps the named side on top for twisted cable symbols', () => {
    const right = getGlyphDefinition('purl_right_cross_twist_stitch')!;
    const left = getGlyphDefinition('purl_left_cross_twist_stitch')!;
    const rightOver = right.primitives[3];
    const leftOver = left.primitives[3];
    expect(rightOver).toMatchObject({
      kind: 'cubic',
      start: { x: 162, y: 79 },
      curves: [
        { control1: { x: 136, y: 85 }, control2: { x: 20, y: 34 }, to: { x: 45, y: 16 } },
        { control1: { x: 72, y: 4 }, control2: { x: 139, y: 58 }, to: { x: 122, y: 88 } },
      ],
    });
    expect(leftOver).toMatchObject({
      kind: 'cubic',
      start: { x: 38, y: 79 },
      curves: [
        { control1: { x: 64, y: 85 }, control2: { x: 180, y: 34 }, to: { x: 155, y: 16 } },
        { control1: { x: 128, y: 4 }, control2: { x: 61, y: 58 }, to: { x: 78, y: 88 } },
      ],
    });
    expect(left.primitives.slice(0, 3)).toEqual([
      { kind: 'line', from: { x: 24, y: 16 }, to: { x: 77, y: 40 } },
      { kind: 'line', from: { x: 128, y: 61 }, to: { x: 176, y: 84 } },
      { kind: 'line', from: { x: 110, y: 84 }, to: { x: 144, y: 84 } },
    ]);
    expect(right.primitives.some((primitive) => primitive.kind === 'ellipse')).toBe(false);
    expect(left.primitives.some((primitive) => primitive.kind === 'ellipse')).toBe(false);
  });

  it('keeps the approved twist and purl-twist geometry unchanged', () => {
    const twist = getGlyphDefinition('twist_stitch')!;
    const purlTwist = getGlyphDefinition('purl_twist_stitch')!;
    const approvedTwist = {
      kind: 'cubic',
      start: { x: 17, y: 82 },
      curves: [
        { control1: { x: 30, y: 83 }, control2: { x: 43, y: 77 }, to: { x: 58, y: 64 } },
        { control1: { x: 75, y: 49 }, control2: { x: 71, y: 16 }, to: { x: 51, y: 14 } },
        { control1: { x: 31, y: 12 }, control2: { x: 25, y: 44 }, to: { x: 40, y: 63 } },
        { control1: { x: 50, y: 76 }, control2: { x: 65, y: 82 }, to: { x: 83, y: 82 } },
      ],
    };
    expect(twist.primitives).toEqual([approvedTwist]);
    expect(purlTwist.primitives).toEqual([
      approvedTwist,
      { kind: 'line', from: { x: 30, y: 94 }, to: { x: 70, y: 94 } },
    ]);
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
