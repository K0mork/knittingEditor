import { describe, expect, it } from 'vitest';
import { STITCHES } from './catalog';
import { getGlyphDefinition, glyphPdfCommands, glyphSvg } from './glyphs';

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
});
