// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellColor, cellStitchId } from '../packages/editor-core/model/Board.ts';
import { decodeBackup } from '../packages/editor-core/storage/backupCodec.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const readText = (path) => readFileSync(new URL(path, root), 'utf8');

/** 配布しているテンプレート。`scripts/generate-templates.mjs`の定義と名前をそろえる。 */
const TEMPLATES = [
  { slug: 'seed', name: '鹿の子編み' },
  { slug: 'stockinette', name: 'メリヤス編み' },
  { slug: 'rib-1x1', name: '1目ゴム編み' },
  { slug: 'rib-2x2', name: '2目ゴム編み' },
  { slug: 'cable-2x2', name: '2/2ケーブル' },
  { slug: 'lace', name: '透かし（穴あき）' },
  { slug: 'nordic', name: '北欧の小モチーフ' },
  { slug: 'checker', name: '市松（配色）' },
];

const STITCH = { knit: 1, purl: 2, yo: 3, rightUpTwoOne: 4, rightUpTwoCross: 18, leftUpTwoCross: 19 };
const COLORS = { garnet: 0xa63b32, sand: 0xe3d3ac, forest: 0x2f5d46 };

function cellsOf(slug) {
  const { documents, blocks } = decodeBackup(read(`public/templates/${slug}.knit`));
  expect(documents).toHaveLength(1);
  expect(blocks).toHaveLength(0);
  const document = documents[0];
  expect(document.rows).toBe(20);
  expect(document.cols).toBe(20);
  return { document, cells: new Uint32Array(document.cells) };
}

const at = (cells, row, col) => cells[row * 20 + col];
const stitchAt = (cells, row, col) => cellStitchId(at(cells, row, col));

describe('配布するテンプレートの.knit', () => {
  it.each(TEMPLATES)('$slug is a 20x20 chart that opens as a restored copy', ({ slug, name }) => {
    const { document } = cellsOf(slug);
    expect(document.name).toBe(`${name}（復元）`);
  });

  it('メリヤス編みはすべて表目、鹿の子編みは表目と裏目を市松に置く', () => {
    const stockinette = cellsOf('stockinette').cells;
    expect([...stockinette].every((value) => cellStitchId(value) === STITCH.knit)).toBe(true);

    const seed = cellsOf('seed').cells;
    expect(stitchAt(seed, 0, 0)).toBe(STITCH.purl);
    expect(stitchAt(seed, 0, 1)).toBe(STITCH.knit);
    expect(stitchAt(seed, 1, 0)).toBe(STITCH.knit);
    expect(stitchAt(seed, 1, 1)).toBe(STITCH.purl);
  });

  it('ゴム編みは表目と裏目を交互に並べる', () => {
    const oneByOne = cellsOf('rib-1x1').cells;
    expect([0, 1, 2, 3].map((col) => stitchAt(oneByOne, 0, col))).toEqual([STITCH.knit, STITCH.purl, STITCH.knit, STITCH.purl]);

    const twoByTwo = cellsOf('rib-2x2').cells;
    expect([0, 1, 2, 3, 4, 5].map((col) => stitchAt(twoByTwo, 0, col)))
      .toEqual([STITCH.knit, STITCH.knit, STITCH.purl, STITCH.purl, STITCH.knit, STITCH.knit]);
  });

  it('ケーブルは6段ごとに交差し、帯の外は裏目', () => {
    const { cells } = cellsOf('cable-2x2');
    expect(stitchAt(cells, 0, 0)).toBe(STITCH.purl);
    expect(stitchAt(cells, 0, 8)).toBe(STITCH.knit);
    expect(stitchAt(cells, 5, 8)).toBe(STITCH.rightUpTwoCross);
    expect(stitchAt(cells, 11, 8)).toBe(STITCH.leftUpTwoCross);
  });

  it('透かしはかけ目と2目一度を置く', () => {
    const { cells } = cellsOf('lace');
    expect(stitchAt(cells, 0, 6)).toBe(STITCH.yo);
    expect(stitchAt(cells, 0, 7)).toBe(STITCH.rightUpTwoOne);
    // 2目一度が覆うマスは空にしておく。
    expect(at(cells, 0, 8)).toBe(0);
  });

  it('配色のテンプレートは色を変えて置く', () => {
    const nordic = cellsOf('nordic').cells;
    expect(cellColor(at(nordic, 10, 7))).toBe(COLORS.garnet);
    expect(cellColor(at(nordic, 0, 0))).toBe(COLORS.sand);

    const checker = cellsOf('checker').cells;
    expect(cellColor(at(checker, 0, 0))).toBe(COLORS.forest);
    expect(cellColor(at(checker, 0, 4))).toBe(COLORS.sand);
  });
});

describe('テンプレートの公開ページ', () => {
  it('すべてのテンプレートのプレビューとダウンロードを載せる', () => {
    const page = readText('public/templates/index.html');
    for (const { slug } of TEMPLATES) {
      expect(page).toContain(`src="/templates/${slug}.svg"`);
      expect(page).toContain(`href="/templates/${slug}.knit"`);
    }
    expect(page).toContain('<link rel="canonical" href="https://knittingeditor.com/templates/" />');
  });

  it('サイトマップとllms.txtから辿れる', () => {
    expect(readText('public/sitemap.xml')).toContain('<loc>https://knittingeditor.com/templates/</loc>');
    expect(readText('public/llms.txt')).toContain('https://knittingeditor.com/templates/');
  });
});
