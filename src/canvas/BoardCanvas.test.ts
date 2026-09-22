import { describe, expect, it } from 'vitest';
import { STITCHES } from '../stitches/catalog';
import { glyphSearchStart } from './BoardCanvas';

describe('glyphSearchStart', () => {
  it('includes off-screen anchors whose multi-cell glyph overlaps the viewport', () => {
    const maxWidth = Math.max(...STITCHES.map((stitch) => stitch.width));
    const maxHeight = Math.max(...STITCHES.map((stitch) => stitch.height));

    expect(glyphSearchStart(8, 9)).toEqual({
      row: 8 - maxHeight + 1,
      col: 9 - maxWidth + 1,
    });
    expect(glyphSearchStart(0, 0)).toEqual({ row: 0, col: 0 });
  });
});
