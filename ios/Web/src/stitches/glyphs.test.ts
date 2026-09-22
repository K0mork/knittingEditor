import { describe, expect, it } from 'vitest';
import { STITCHES } from './catalog';
import { drawGlyph, getGlyphDefinition, glyphPdfCommands, glyphSvg } from './glyphs';

describe('glyph regression coverage', () => {
  it('keeps a glyph definition and SVG for every persistent stitch ID', () => {
    expect(STITCHES).toHaveLength(26);
    for (const stitch of STITCHES.filter((item) => item.key !== 'erase')) {
      expect(getGlyphDefinition(stitch.key), stitch.key).toBeDefined();
      expect(glyphSvg(stitch.key), stitch.key).toContain('<svg');
    }
  });

  it('keeps PDF drawing commands for every exportable stitch', () => {
    for (const stitch of STITCHES.filter((item) => item.key !== 'erase')) {
      expect(glyphPdfCommands(stitch.key), stitch.key).toBeDefined();
    }
  });

  it('draws every exportable stitch through the Canvas path', () => {
    let strokeCount = 0;
    const context = {
      save: () => undefined,
      translate: () => undefined,
      scale: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      ellipse: () => undefined,
      bezierCurveTo: () => undefined,
      stroke: () => { strokeCount += 1; },
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
      drawGlyph(context, stitch.key, 0, 0, 30, '#123456');
    }

    expect(strokeCount).toBe(STITCHES.filter((item) => item.renderKind === 'glyph').length);
  });
});
