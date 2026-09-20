export const GLYPH_CELL = 100;

export interface GlyphPoint { x: number; y: number }

export type GlyphPrimitive =
  | { kind: 'line'; from: GlyphPoint; to: GlyphPoint }
  | { kind: 'polyline'; points: GlyphPoint[] }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'cubic'; start: GlyphPoint; curves: Array<{ control1: GlyphPoint; control2: GlyphPoint; to: GlyphPoint }> };

export interface GlyphDefinition {
  width: number;
  height: number;
  strokeWidth: number;
  primitives: GlyphPrimitive[];
}

const point = (x: number, y: number): GlyphPoint => ({ x, y });
const line = (x1: number, y1: number, x2: number, y2: number): GlyphPrimitive => ({ kind: 'line', from: point(x1, y1), to: point(x2, y2) });
const polyline = (...coordinates: number[]): GlyphPrimitive => ({
  kind: 'polyline',
  points: Array.from({ length: coordinates.length / 2 }, (_, index) => point(coordinates[index * 2], coordinates[index * 2 + 1])),
});

function mirror(primitives: GlyphPrimitive[], width: number): GlyphPrimitive[] {
  const flip = ({ x, y }: GlyphPoint) => point(width - x, y);
  return primitives.map((primitive) => {
    if (primitive.kind === 'line') return { ...primitive, from: flip(primitive.from), to: flip(primitive.to) };
    if (primitive.kind === 'polyline') return { ...primitive, points: primitive.points.map(flip) };
    if (primitive.kind === 'ellipse') return { ...primitive, cx: width - primitive.cx };
    return {
      ...primitive,
      start: flip(primitive.start),
      curves: primitive.curves.map((curve) => ({ control1: flip(curve.control1), control2: flip(curve.control2), to: flip(curve.to) })),
    };
  });
}

function scale(primitives: GlyphPrimitive[], scaleX: number, scaleY: number): GlyphPrimitive[] {
  const apply = ({ x, y }: GlyphPoint) => point(x * scaleX, y * scaleY);
  return primitives.map((primitive) => {
    if (primitive.kind === 'line') return { ...primitive, from: apply(primitive.from), to: apply(primitive.to) };
    if (primitive.kind === 'polyline') return { ...primitive, points: primitive.points.map(apply) };
    if (primitive.kind === 'ellipse') return { ...primitive, cx: primitive.cx * scaleX, cy: primitive.cy * scaleY, rx: primitive.rx * scaleX, ry: primitive.ry * scaleY };
    return {
      ...primitive,
      start: apply(primitive.start),
      curves: primitive.curves.map((curve) => ({ control1: apply(curve.control1), control2: apply(curve.control2), to: apply(curve.to) })),
    };
  });
}

function glyph(width: number, height: number, primitives: GlyphPrimitive[], strokeWidth = 9): GlyphDefinition {
  return { width: width * GLYPH_CELL, height: height * GLYPH_CELL, strokeWidth, primitives };
}

const rightTwoDecrease = [line(22, 14, 80, 86), line(18, 84, 55, 49)];
const middleThreeDecrease = [line(50, 12, 50, 88), line(16, 82, 50, 50), line(84, 82, 50, 50)];
const rightThreeDecrease = [line(50, 12, 50, 88), line(16, 82, 50, 50), line(20, 14, 82, 86)];

interface CableOptions { purlUnder?: boolean }

function cable(leftCount: number, rightCount: number, direction: 'right' | 'left', options: CableOptions = {}): GlyphDefinition {
  const width = (leftCount + rightCount) * GLYPH_CELL;
  const margin = 22;
  const rise = 68;
  const run = width - margin * 2;
  const length = Math.hypot(run, rise);
  const normal = point(rise / length, run / length);
  const spacing = leftCount + rightCount >= 6 ? 10 : 13;
  const bundle = (count: number, risingRight: boolean) => Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * spacing;
    const offsetX = normal.x * offset;
    const offsetY = normal.y * offset * (risingRight ? 1 : -1);
    const from = risingRight ? point(margin, 84) : point(width - margin, 84);
    const to = risingRight ? point(width - margin, 16) : point(margin, 16);
    return {
      from: point(from.x + offsetX, from.y + offsetY),
      to: point(to.x + offsetX, to.y + offsetY),
    };
  });
  const leftLines = bundle(leftCount, true);
  const rightLines = bundle(rightCount, false);
  const over = direction === 'right' ? leftLines : rightLines;
  const under = direction === 'right' ? rightLines : leftLines;
  const interpolate = (from: GlyphPoint, to: GlyphPoint, amount: number) => point(
    from.x + (to.x - from.x) * amount,
    from.y + (to.y - from.y) * amount,
  );
  const primitives: GlyphPrimitive[] = [];
  for (const strand of under) {
    const before = interpolate(strand.from, strand.to, 0.43);
    const after = interpolate(strand.from, strand.to, 0.57);
    primitives.push(line(strand.from.x, strand.from.y, before.x, before.y));
    primitives.push(line(after.x, after.y, strand.to.x, strand.to.y));
  }
  for (const strand of over) primitives.push(line(strand.from.x, strand.from.y, strand.to.x, strand.to.y));
  if (options.purlUnder) {
    const top = under[Math.floor((under.length - 1) / 2)].to;
    primitives.push(line(top.x - 17, top.y, top.x + 17, top.y));
  }
  return { width, height: GLYPH_CELL, strokeWidth: leftCount + rightCount >= 6 ? 7 : 9, primitives };
}

function twist(): GlyphDefinition {
  return glyph(1, 1, [{
    kind: 'cubic',
    start: point(28, 84),
    curves: [
      { control1: point(38, 72), control2: point(30, 62), to: point(29, 48) },
      { control1: point(27, 27), control2: point(36, 16), to: point(50, 16) },
      { control1: point(65, 16), control2: point(74, 29), to: point(70, 49) },
      { control1: point(67, 67), control2: point(56, 77), to: point(39, 77) },
      { control1: point(48, 78), control2: point(59, 80), to: point(72, 84) },
    ],
  }]);
}

function twistCross(direction: 'right' | 'left'): GlyphDefinition {
  const primitives: GlyphPrimitive[] = [
    line(150, 86, 116, 61),
    line(84, 39, 50, 14),
    line(34, 14, 66, 14),
    line(50, 86, 79, 65),
    { kind: 'ellipse', cx: 100, cy: 50, rx: 23, ry: 19 },
    line(121, 35, 150, 14),
  ];
  return glyph(2, 1, direction === 'right' ? primitives : mirror(primitives, 2 * GLYPH_CELL));
}

const glyphs: Record<string, GlyphDefinition> = {
  knit: glyph(1, 1, [line(50, 12, 50, 88)]),
  purl: glyph(1, 1, [line(12, 50, 88, 50)]),
  yo: glyph(1, 1, [{ kind: 'ellipse', cx: 50, cy: 50, rx: 35, ry: 35 }]),
  right_up_two_one: glyph(2, 1, scale(rightTwoDecrease, 2, 1)),
  left_up_two_one: glyph(2, 1, scale(mirror(rightTwoDecrease, GLYPH_CELL), 2, 1)),
  purl_left_up_two_one: glyph(2, 1, scale([...mirror(rightTwoDecrease, GLYPH_CELL), line(35, 82, 65, 82)], 2, 1)),
  right_cross: cable(1, 1, 'right'),
  left_cross: cable(1, 1, 'left'),
  purl_right_cross: cable(1, 1, 'right', { purlUnder: true }),
  purl_left_cross: cable(1, 1, 'left', { purlUnder: true }),
  purl_right_up_two_cross: cable(2, 1, 'right', { purlUnder: true }),
  purl_left_up_two_cross: cable(1, 2, 'left', { purlUnder: true }),
  purl_right_cross_twist_stitch: twistCross('right'),
  purl_left_cross_twist_stitch: twistCross('left'),
  middle_up_three_one: glyph(3, 1, scale(middleThreeDecrease, 3, 1)),
  right_up_three_one: glyph(3, 1, scale(rightThreeDecrease, 3, 1)),
  left_up_three_one: glyph(3, 1, scale(mirror(rightThreeDecrease, GLYPH_CELL), 3, 1)),
  right_up_two_cross: cable(2, 2, 'right'),
  left_up_two_cross: cable(2, 2, 'left'),
  right_up_three_cross: cable(3, 3, 'right'),
  left_up_three_cross: cable(3, 3, 'left'),
  slip_stitch: glyph(1, 2, scale([polyline(16, 16, 50, 88, 84, 16)], 1, 2)),
  twist_stitch: twist(),
  purl_twist_stitch: glyph(1, 1, [...twist().primitives, line(30, 94, 70, 94)]),
};

export function getGlyphDefinition(key: string): GlyphDefinition | undefined {
  return glyphs[key];
}

const number = (value: number): string => Number(value.toFixed(3)).toString();
const svgPoint = ({ x, y }: GlyphPoint): string => `${number(x)},${number(y)}`;

export function glyphSvg(key: string): string {
  if (key === 'erase') {
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="12" width="76" height="76" fill="#fff" stroke="currentColor" stroke-width="6"/></svg>';
  }
  const definition = getGlyphDefinition(key);
  if (!definition) return '';
  const body = definition.primitives.map((primitive) => {
    if (primitive.kind === 'line') return `<line x1="${number(primitive.from.x)}" y1="${number(primitive.from.y)}" x2="${number(primitive.to.x)}" y2="${number(primitive.to.y)}"/>`;
    if (primitive.kind === 'polyline') return `<polyline points="${primitive.points.map(svgPoint).join(' ')}"/>`;
    if (primitive.kind === 'ellipse') return `<ellipse cx="${number(primitive.cx)}" cy="${number(primitive.cy)}" rx="${number(primitive.rx)}" ry="${number(primitive.ry)}"/>`;
    const commands = [`M ${svgPoint(primitive.start)}`, ...primitive.curves.map((curve) => `C ${svgPoint(curve.control1)} ${svgPoint(curve.control2)} ${svgPoint(curve.to)}`)];
    return `<path d="${commands.join(' ')}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${number(definition.width)} ${number(definition.height)}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" fill="none" stroke="currentColor" stroke-width="${number(definition.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function drawGlyph(context: CanvasRenderingContext2D, key: string, x: number, y: number, cellSize: number, color: string): void {
  const definition = getGlyphDefinition(key);
  if (!definition) return;
  context.save();
  context.translate(x, y);
  context.scale(cellSize / GLYPH_CELL, cellSize / GLYPH_CELL);
  context.beginPath();
  for (const primitive of definition.primitives) {
    if (primitive.kind === 'line') {
      context.moveTo(primitive.from.x, primitive.from.y); context.lineTo(primitive.to.x, primitive.to.y);
    } else if (primitive.kind === 'polyline') {
      primitive.points.forEach((item, index) => index === 0 ? context.moveTo(item.x, item.y) : context.lineTo(item.x, item.y));
    } else if (primitive.kind === 'ellipse') {
      context.moveTo(primitive.cx + primitive.rx, primitive.cy);
      context.ellipse(primitive.cx, primitive.cy, primitive.rx, primitive.ry, 0, 0, Math.PI * 2);
    } else {
      context.moveTo(primitive.start.x, primitive.start.y);
      for (const curve of primitive.curves) context.bezierCurveTo(curve.control1.x, curve.control1.y, curve.control2.x, curve.control2.y, curve.to.x, curve.to.y);
    }
  }
  context.strokeStyle = color;
  context.lineWidth = definition.strokeWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  context.restore();
}

export function glyphPdfCommands(key: string): { width: number; height: number; commands: string } | undefined {
  const definition = getGlyphDefinition(key);
  if (!definition) return undefined;
  const commands: string[] = [];
  for (const primitive of definition.primitives) {
    if (primitive.kind === 'line') {
      commands.push(`${number(primitive.from.x)} ${number(primitive.from.y)} m ${number(primitive.to.x)} ${number(primitive.to.y)} l`);
    } else if (primitive.kind === 'polyline') {
      const [first, ...rest] = primitive.points;
      commands.push(`${number(first.x)} ${number(first.y)} m ${rest.map((item) => `${number(item.x)} ${number(item.y)} l`).join(' ')}`);
    } else if (primitive.kind === 'ellipse') {
      const k = 0.5522847498;
      const left = primitive.cx - primitive.rx, right = primitive.cx + primitive.rx;
      const top = primitive.cy - primitive.ry, bottom = primitive.cy + primitive.ry;
      commands.push(`${number(right)} ${number(primitive.cy)} m`);
      commands.push(`${number(right)} ${number(primitive.cy + primitive.ry * k)} ${number(primitive.cx + primitive.rx * k)} ${number(bottom)} ${number(primitive.cx)} ${number(bottom)} c`);
      commands.push(`${number(primitive.cx - primitive.rx * k)} ${number(bottom)} ${number(left)} ${number(primitive.cy + primitive.ry * k)} ${number(left)} ${number(primitive.cy)} c`);
      commands.push(`${number(left)} ${number(primitive.cy - primitive.ry * k)} ${number(primitive.cx - primitive.rx * k)} ${number(top)} ${number(primitive.cx)} ${number(top)} c`);
      commands.push(`${number(primitive.cx + primitive.rx * k)} ${number(top)} ${number(right)} ${number(primitive.cy - primitive.ry * k)} ${number(right)} ${number(primitive.cy)} c`);
    } else {
      commands.push(`${number(primitive.start.x)} ${number(primitive.start.y)} m`);
      for (const curve of primitive.curves) commands.push(`${number(curve.control1.x)} ${number(curve.control1.y)} ${number(curve.control2.x)} ${number(curve.control2.y)} ${number(curve.to.x)} ${number(curve.to.y)} c`);
    }
  }
  return { width: definition.width, height: definition.height, commands: `q 1 0 0 -1 0 ${number(definition.height)} cm ${number(definition.strokeWidth)} w 1 J 1 j ${commands.join(' ')} S Q` };
}
