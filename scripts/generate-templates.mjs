/**
 * 編み図テンプレートの`.knit`と、ページに載せるプレビューSVGを作る。
 *
 * 記号のIDと`.knit`の形式は、アプリと同じ実装（`packages/editor-core`）を使う。
 * `scripts/`のNodeスクリプトからTypeScriptをそのまま読み込むため、ViteのSSR読み込みを使う。
 * 作ったファイルは`public/templates/`へ置き、リポジトリに含める。
 *
 * 実行: node scripts/generate-templates.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT = new URL('../public/templates/', import.meta.url);
/** プレビューの1マスの大きさ（px）。 */
const CELL = 18;
/** 作った日時。ファイルを再生成しても中身が変わらないよう固定する。 */
const CREATED_AT = Date.parse('2026-11-11T00:00:00Z');
const INK = '#2b3a30';
const GRID = '#e6e1d4';
const PAPER = '#fffdf7';

const GARNET = 0xa63b32;
const SAND = 0xe3d3ac;
const FOREST = 0x2f5d46;

/** 20段20目で、指定した列だけ裏目にする。 */
const purlColumns = (columns) => () => columns.map((col) => ({ col, key: 'purl' }));
const columnsWhere = (predicate, count = 20) => Array.from({ length: count }, (_, col) => col).filter(predicate);

const TEMPLATES = [
  {
    slug: 'seed',
    name: '鹿の子編み',
    summary: '表目と裏目を1目ずつ交互に、段ごとにずらして並べる編み地です。小さな凹凸が出て、厚みのある編み地になります。',
    symbols: '表目・裏目',
    defaultKey: 'knit',
    plan: (row) => columnsWhere((col) => (row + col) % 2 === 0).map((col) => ({ col, key: 'purl' })),
  },
  {
    slug: 'stockinette',
    name: 'メリヤス編み',
    summary: '表から見た編み目を表目でそろえた編み地です。なめらかで、配色や模様の土台に向きます。',
    symbols: '表目',
    defaultKey: 'knit',
    plan: () => [],
  },
  {
    slug: 'rib-1x1',
    name: '1目ゴム編み',
    summary: '表目と裏目を1目ずつ交互に並べた編み地です。伸び縮みするので、袖口や衿、マフラーの端に向きます。',
    symbols: '表目・裏目',
    defaultKey: 'knit',
    plan: purlColumns(columnsWhere((col) => col % 2 === 1)),
  },
  {
    slug: 'rib-2x2',
    name: '2目ゴム編み',
    summary: '表目2目と裏目2目を交互に並べた編み地です。1目ゴムより幅が出て、セーターの裾や帽子に向きます。',
    symbols: '表目・裏目',
    defaultKey: 'knit',
    plan: purlColumns(columnsWhere((col) => col % 4 === 2 || col % 4 === 3)),
  },
  {
    slug: 'cable-2x2',
    name: '2/2ケーブル',
    summary: '4目の帯を6段ごとに交差させる、定番の縄編みです。交差の段だけ「右上2目交差」「左上2目交差」を使います。',
    symbols: '表目・裏目・右上2目交差・左上2目交差',
    defaultKey: 'purl',
    plan: (row) => {
      if (row % 6 !== 5) return columnsWhere((col) => col >= 8 && col <= 11).map((col) => ({ col, key: 'knit' }));
      return [{ col: 8, key: row % 12 === 5 ? 'right_up_two_cross' : 'left_up_two_cross' }];
    },
  },
  {
    slug: 'lace',
    name: '透かし（穴あき）',
    summary: 'かけ目と2目一度を組み合わせた、小さな穴の並ぶ編み地です。段の途中で目数を変えずに模様を入れられます。',
    symbols: '表目・かけ目・右上2目一度',
    defaultKey: 'knit',
    plan: (row) => row % 4 === 0
      ? [
        { col: 6, key: 'yo' }, { col: 7, key: 'right_up_two_one' },
        { col: 14, key: 'yo' }, { col: 15, key: 'right_up_two_one' },
      ]
      : [],
  },
  {
    slug: 'nordic',
    name: '北欧の小モチーフ',
    summary: '2色の表目で描く、菱形のモチーフです。配色の考え方と、色を変えたときの見え方を確かめられます。',
    symbols: '表目（2色）',
    defaultKey: 'knit',
    defaultColor: SAND,
    plan: (row) => Array.from({ length: 20 }, (_, col) => col)
      .filter((col) => Math.abs(row - 10) + Math.abs(col - 10) === 3 || Math.abs(row - 10) + Math.abs(col - 10) === 4)
      .map((col) => ({ col, key: 'knit', color: GARNET })),
  },
  {
    slug: 'checker',
    name: '市松（配色）',
    summary: '4目・4段の市松に2色を置いた編み地です。配色の切り替えと、色ごとの記号の見え方を確かめられます。',
    symbols: '表目（2色）',
    defaultKey: 'knit',
    defaultColor: SAND,
    plan: (row) => Array.from({ length: 20 }, (_, col) => col)
      .filter((col) => (Math.floor(row / 4) + Math.floor(col / 4)) % 2 === 0)
      .map((col) => ({ col, key: 'knit', color: FOREST })),
  },
];

const ROWS = 20;
const COLS = 20;

/** 記号の配置から、セルの並び（1段目の左端から）を作る。覆われたマスは0のままにする。 */
function packTemplate(template, stitches, packCell) {
  const values = new Uint32Array(ROWS * COLS);
  const covered = new Uint8Array(ROWS * COLS);
  for (let row = 0; row < ROWS; row++) {
    for (const placement of template.plan(row)) {
      const definition = stitches.get(placement.key);
      if (!definition) throw new Error(`${template.slug}: 知らない記号です: ${placement.key}`);
      if (placement.col < 0 || placement.col + definition.width > COLS || row + definition.height > ROWS) {
        throw new Error(`${template.slug}: ${row + 1}段${placement.col + 1}目が盤面からはみ出します`);
      }
      const index = row * COLS + placement.col;
      if (covered[index]) throw new Error(`${template.slug}: ${row + 1}段${placement.col + 1}目が重なっています`);
      values[index] = packCell(definition.id, placement.color ?? 0);
      for (let y = 0; y < definition.height; y++) {
        for (let x = 0; x < definition.width; x++) covered[(row + y) * COLS + placement.col + x] = 1;
      }
    }
  }
  const defaultDefinition = stitches.get(template.defaultKey);
  for (let index = 0; index < values.length; index++) {
    if (!covered[index]) values[index] = packCell(defaultDefinition.id, template.defaultColor ?? 0);
  }
  return values;
}

/** SVGの文字列から、symbolに入れる中身とviewBoxを取り出す。 */
function glyphParts(svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const strokeWidth = /stroke-width="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox || !strokeWidth) throw new Error(`記号のSVGを読めません: ${svg.slice(0, 40)}`);
  return { viewBox, strokeWidth, body: svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')) };
}

/**
 * 盤面をプレビュー用のSVGにする。記号は使う種類だけ`symbol`にして、マスごとに`use`で置く。
 * 1段目が下になるよう、段は下から上へ並べる。
 */
function previewSvg(values, stitchesById, cellStitchId, cellColor) {
  const used = new Set();
  for (const value of values) if (value) used.add(cellStitchId(value));

  const symbols = [...used].map((id) => {
    const definition = stitchesById.get(id);
    const { viewBox, strokeWidth, body } = glyphParts(definition.svg);
    return `<symbol id="s${id}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`;
  }).join('');

  const width = COLS * CELL;
  const height = ROWS * CELL;
  const uses = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const value = values[row * COLS + col];
      if (!value) continue;
      const definition = stitchesById.get(cellStitchId(value));
      const color = cellColor(value);
      uses.push(`<use href="#s${definition.id}" x="${col * CELL}" y="${(ROWS - 1 - row) * CELL}" width="${definition.width * CELL}" height="${definition.height * CELL}" color="${color ? `#${color.toString(16).padStart(6, '0')}` : INK}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">`
    + `<defs><pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">`
    + `<path d="M ${CELL} 0 V ${CELL} M 0 ${CELL} H ${CELL}" fill="none" stroke="${GRID}" stroke-width="1"/>`
    + `</pattern>${symbols}</defs>`
    + `<rect width="${width}" height="${height}" fill="${PAPER}"/>`
    + `<rect width="${width}" height="${height}" fill="url(#grid)"/>`
    + uses.join('')
    + '</svg>\n';
}

const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { encodeBackup } = await server.ssrLoadModule('/packages/editor-core/storage/backupCodec.ts');
  const { STITCH_BY_KEY, STITCH_BY_ID } = await server.ssrLoadModule('/packages/editor-core/stitches/catalog.ts');
  const { packCell, cellStitchId, cellColor } = await server.ssrLoadModule('/packages/editor-core/model/Board.ts');

  await mkdir(OUTPUT, { recursive: true });
  for (const template of TEMPLATES) {
    const values = packTemplate(template, STITCH_BY_KEY, packCell);
    const backup = encodeBackup([{
      id: `template-${template.slug}`,
      name: template.name,
      rows: ROWS,
      cols: COLS,
      cells: values.buffer,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }], []);
    await writeFile(new URL(`${template.slug}.knit`, OUTPUT), backup);
    await writeFile(new URL(`${template.slug}.svg`, OUTPUT), previewSvg(values, STITCH_BY_ID, cellStitchId, cellColor));
    console.log(`${template.slug}.knit, ${template.slug}.svg`);
  }
} finally {
  await server.close();
}

