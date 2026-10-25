import { describe, expect, it } from 'vitest';
import { STITCHES } from './catalog';
import { drawGlyph, getGlyphDefinition, glyphPdfCommands, glyphSvg, type GlyphDefinition } from './glyphs';

type CanvasCall = [string, ...unknown[]];

/** Canvasへの命令を引数ごと順に記録する。strokeでは、そのときの線の色・太さ・端と角の形を残す。 */
function recordingContext() {
  const calls: CanvasCall[] = [];
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  const context = {
    strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    save: record('save'),
    translate: record('translate'),
    scale: record('scale'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    ellipse: record('ellipse'),
    bezierCurveTo: record('bezierCurveTo'),
    stroke() { calls.push(['stroke', this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin]); },
    restore: record('restore'),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

const PATH_CALLS = new Set(['moveTo', 'lineTo', 'ellipse', 'bezierCurveTo']);

/** 記号定義の各要素から、描かれるべきパス命令の数を数える。 */
function expectedPathCounts(definition: GlyphDefinition) {
  const counts = { moveTo: 0, lineTo: 0, ellipse: 0, bezierCurveTo: 0 };
  for (const primitive of definition.primitives) {
    counts.moveTo += 1;
    if (primitive.kind === 'line') counts.lineTo += 1;
    else if (primitive.kind === 'polyline') counts.lineTo += primitive.points.length - 1;
    else if (primitive.kind === 'ellipse') counts.ellipse += 1;
    else counts.bezierCurveTo += primitive.curves.length;
  }
  return counts;
}

/** PDFの描画命令から、前後の座標変換・線の設定と、パス部分の演算子と数値の組を取り出す。 */
function parsePdfGlyph(commands: string) {
  const match = /^q 1 0 0 -1 0 (\S+) cm (\S+) w 1 J 1 j (.+) S Q$/.exec(commands);
  if (!match) throw new Error(`unexpected PDF glyph commands: ${commands}`);
  const operations: Array<{ operator: string; operands: number[] }> = [];
  let operands: number[] = [];
  for (const token of match[3].split(' ')) {
    if (/^[mlc]$/.test(token)) {
      operations.push({ operator: token, operands });
      operands = [];
    } else {
      operands.push(Number(token));
    }
  }
  expect(operands, 'operands after the last path operator').toEqual([]);
  return { height: Number(match[1]), strokeWidth: Number(match[2]), operations };
}

describe('glyph regression coverage', () => {
  it('sizes every picker SVG to its symbol slot, including whiteout', () => {
    for (const stitch of STITCHES) {
      expect(glyphSvg(stitch.key), stitch.key).toMatch(/<svg\b[^>]*style="width:100%;height:100%"/);
    }
  });

  it('keeps a glyph definition and SVG for every persistent stitch ID', () => {
    expect(STITCHES).toHaveLength(29);
    for (const stitch of STITCHES.filter((item) => item.key !== 'erase')) {
      expect(getGlyphDefinition(stitch.key), stitch.key).toBeDefined();
      expect(glyphSvg(stitch.key), stitch.key).toContain('<svg');
    }
  });
});

describe('Canvas glyph drawing commands', () => {
  it('draws the yarn-over circle as one ellipse subpath', () => {
    const { context, calls } = recordingContext();
    drawGlyph(context, 'yo', 10, 20, 30, '#123456');
    expect(calls).toEqual([
      ['save'],
      ['translate', 10, 20],
      ['scale', 0.3, 0.3],
      ['beginPath'],
      ['moveTo', 85, 50],
      ['ellipse', 50, 50, 35, 35, 0, 0, Math.PI * 2],
      ['stroke', '#123456', 9, 'round', 'round'],
      ['restore'],
    ]);
  });

  it('draws the twist stitch as four connected cubic curves', () => {
    const { context, calls } = recordingContext();
    drawGlyph(context, 'twist_stitch', 0, 0, 100, '#000000');
    expect(calls.filter(([name]) => PATH_CALLS.has(name))).toEqual([
      ['moveTo', 17, 82],
      ['bezierCurveTo', 30, 83, 43, 77, 58, 64],
      ['bezierCurveTo', 75, 49, 71, 16, 51, 14],
      ['bezierCurveTo', 31, 12, 25, 44, 40, 63],
      ['bezierCurveTo', 50, 76, 65, 82, 83, 82],
    ]);
  });

  it('starts a separate subpath for each line and curve of a twisted cross', () => {
    const { context, calls } = recordingContext();
    drawGlyph(context, 'purl_left_cross_twist_stitch', 0, 0, 100, '#000000');
    expect(calls.filter(([name]) => PATH_CALLS.has(name))).toEqual([
      ['moveTo', 24, 16], ['lineTo', 77, 40],
      ['moveTo', 128, 61], ['lineTo', 176, 84],
      ['moveTo', 110, 84], ['lineTo', 144, 84],
      ['moveTo', 38, 79],
      ['bezierCurveTo', 64, 85, 180, 34, 155, 16],
      ['bezierCurveTo', 128, 4, 61, 58, 78, 88],
    ]);
  });

  it('draws every polyline point after its first move', () => {
    const { context, calls } = recordingContext();
    drawGlyph(context, 'right_up_two_one', 0, 0, 100, '#000000');
    expect(calls.filter(([name]) => PATH_CALLS.has(name))).toEqual([
      ['moveTo', 36, 84], ['lineTo', 104, 50], ['lineTo', 48, 14],
      ['moveTo', 104, 50], ['lineTo', 160, 86],
    ]);
  });

  it('draws one complete stroked path for every exportable stitch', () => {
    for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
      const definition = getGlyphDefinition(stitch.key)!;
      const { context, calls } = recordingContext();
      drawGlyph(context, stitch.key, 4, 8, 20, '#123456');
      const names = calls.map(([name]) => name);
      expect(names.slice(0, 4), stitch.key).toEqual(['save', 'translate', 'scale', 'beginPath']);
      expect(names.slice(-2), stitch.key).toEqual(['stroke', 'restore']);
      expect(calls.slice(1, 3), stitch.key).toEqual([['translate', 4, 8], ['scale', 0.2, 0.2]]);
      expect(calls.at(-2), stitch.key).toEqual(['stroke', '#123456', definition.strokeWidth, 'round', 'round']);
      const path = names.slice(4, -2);
      expect(path.every((name) => PATH_CALLS.has(name)), stitch.key).toBe(true);
      expect({
        moveTo: path.filter((name) => name === 'moveTo').length,
        lineTo: path.filter((name) => name === 'lineTo').length,
        ellipse: path.filter((name) => name === 'ellipse').length,
        bezierCurveTo: path.filter((name) => name === 'bezierCurveTo').length,
      }, stitch.key).toEqual(expectedPathCounts(definition));
    }
  });
});

describe('PDF glyph drawing commands', () => {
  it('approximates the yarn-over circle with four cubic curves', () => {
    expect(glyphPdfCommands('yo')).toEqual({
      width: 100,
      height: 100,
      commands: 'q 1 0 0 -1 0 100 cm 9 w 1 J 1 j 85 50 m'
        + ' 85 69.33 69.33 85 50 85 c 30.67 85 15 69.33 15 50 c'
        + ' 15 30.67 30.67 15 50 15 c 69.33 15 85 30.67 85 50 c S Q',
    });
  });

  it('writes every cubic curve of the twist stitch', () => {
    expect(glyphPdfCommands('twist_stitch')?.commands).toBe(
      'q 1 0 0 -1 0 100 cm 9 w 1 J 1 j 17 82 m 30 83 43 77 58 64 c 75 49 71 16 51 14 c'
        + ' 31 12 25 44 40 63 c 50 76 65 82 83 82 c S Q',
    );
  });

  it('starts a separate subpath for each line and curve of a twisted cross', () => {
    expect(glyphPdfCommands('purl_left_cross_twist_stitch')).toEqual({
      width: 200,
      height: 100,
      commands: 'q 1 0 0 -1 0 100 cm 9 w 1 J 1 j 24 16 m 77 40 l 128 61 m 176 84 l 110 84 m 144 84 l'
        + ' 38 79 m 64 85 180 34 155 16 c 128 4 61 58 78 88 c S Q',
    });
  });

  it('writes every polyline point after its first move', () => {
    expect(glyphPdfCommands('right_up_two_one')?.commands).toBe(
      'q 1 0 0 -1 0 100 cm 9 w 1 J 1 j 36 84 m 104 50 l 48 14 l 104 50 m 160 86 l S Q',
    );
  });

  it('writes a complete path for every exportable stitch', () => {
    for (const stitch of STITCHES.filter((item) => item.renderKind === 'glyph')) {
      const definition = getGlyphDefinition(stitch.key)!;
      const pdf = glyphPdfCommands(stitch.key);
      expect(pdf, stitch.key).toBeDefined();
      expect([pdf!.width, pdf!.height], stitch.key).toEqual([definition.width, definition.height]);
      const { height, strokeWidth, operations } = parsePdfGlyph(pdf!.commands);
      expect([height, strokeWidth], stitch.key).toEqual([definition.height, definition.strokeWidth]);
      for (const { operator, operands } of operations) {
        expect(operands, `${stitch.key} ${operator}`).toHaveLength(operator === 'c' ? 6 : 2);
        expect(operands.every(Number.isFinite), `${stitch.key} ${operator}`).toBe(true);
      }
      const counts = expectedPathCounts(definition);
      expect({
        m: operations.filter(({ operator }) => operator === 'm').length,
        l: operations.filter(({ operator }) => operator === 'l').length,
        c: operations.filter(({ operator }) => operator === 'c').length,
      }, stitch.key).toEqual({ m: counts.moveTo, l: counts.lineTo, c: counts.ellipse * 4 + counts.bezierCurveTo });
    }
  });

  it('has no drawing commands for whiteout or unknown keys', () => {
    expect(glyphPdfCommands('erase')).toBeUndefined();
    expect(glyphPdfCommands('missing')).toBeUndefined();
  });
});
