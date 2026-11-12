// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellColor, cellStitchId } from '../packages/editor-core/model/Board.ts';
import { decodeBackup } from '../packages/editor-core/storage/backupCodec.ts';
import { STITCH_BY_ID } from '../packages/editor-core/stitches/catalog.ts';

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
  { slug: 'twist', name: 'ねじり目の列' },
  { slug: 'nordic', name: '北欧の小モチーフ' },
  { slug: 'checker', name: '市松（配色）' },
];

const STITCH = { knit: 1, purl: 2, twist: 23, rightUpTwoCross: 18, leftUpTwoCross: 19 };
const COLORS = { garnet: 0xa63b32, sand: 0xe3d3ac, forest: 0x2f5d46 };
const ROWS = 20;
const COLS = 20;
const CELL = 18;

/**
 * 編み図の段番号（1段目が編み始め）から、盤面の段番号を返す。
 * エディタは盤面の段0を一番上に置き、高い段番号から順に振る。1段目は最後の段になる。
 */
const boardRowOfKnittedRow = (knittedRow) => ROWS - knittedRow;

function cellsOf(slug) {
  const { documents, blocks } = decodeBackup(read(`public/templates/${slug}.knit`));
  expect(documents).toHaveLength(1);
  expect(blocks).toHaveLength(0);
  const document = documents[0];
  expect(document.rows).toBe(ROWS);
  expect(document.cols).toBe(COLS);
  return { document, cells: new Uint32Array(document.cells) };
}

const at = (cells, row, col) => cells[row * COLS + col];
const stitchAt = (cells, row, col) => cellStitchId(at(cells, row, col));

describe('配布するテンプレートの.knit', () => {
  it.each(TEMPLATES)('$slug is a 20x20 chart that opens as a restored copy', ({ slug, name }) => {
    const { document } = cellsOf(slug);
    expect(document.name).toBe(`${name}（復元）`);
  });

  it.each(TEMPLATES)('$slug は、どの段も20目を使い、20目を作る', ({ slug }) => {
    // 段の途中で目数が変わると、次の段の目数と合わなくなる。かけ目や増し目を使う模様は、
    // この幅のままでは置けないため、テンプレートには入れない。
    const { cells } = cellsOf(slug);
    for (let row = 0; row < ROWS; row++) {
      let consumes = 0;
      let produces = 0;
      for (let col = 0; col < COLS; col++) {
        const value = at(cells, row, col);
        if (!value) continue;
        const definition = STITCH_BY_ID.get(cellStitchId(value));
        consumes += definition.consumes;
        produces += definition.produces;
      }
      expect({ row: ROWS - row, consumes, produces }).toEqual({ row: ROWS - row, consumes: 20, produces: 20 });
    }
  });

  it('メリヤス編みはすべて表目、鹿の子編みは表目と裏目を市松に置く', () => {
    const stockinette = cellsOf('stockinette').cells;
    expect([...stockinette].every((value) => cellStitchId(value) === STITCH.knit)).toBe(true);

    // 1段目は盤面の最後の段（底）。2段目はその上になる。
    const seed = cellsOf('seed').cells;
    expect(stitchAt(seed, boardRowOfKnittedRow(1), 0)).toBe(STITCH.purl);
    expect(stitchAt(seed, boardRowOfKnittedRow(1), 1)).toBe(STITCH.knit);
    expect(stitchAt(seed, boardRowOfKnittedRow(2), 0)).toBe(STITCH.knit);
    expect(stitchAt(seed, boardRowOfKnittedRow(2), 1)).toBe(STITCH.purl);
  });

  it('ゴム編みは表目と裏目を交互に並べる', () => {
    const oneByOne = cellsOf('rib-1x1').cells;
    expect([0, 1, 2, 3].map((col) => stitchAt(oneByOne, boardRowOfKnittedRow(1), col)))
      .toEqual([STITCH.knit, STITCH.purl, STITCH.knit, STITCH.purl]);

    const twoByTwo = cellsOf('rib-2x2').cells;
    expect([0, 1, 2, 3, 4, 5].map((col) => stitchAt(twoByTwo, boardRowOfKnittedRow(1), col)))
      .toEqual([STITCH.knit, STITCH.knit, STITCH.purl, STITCH.purl, STITCH.knit, STITCH.knit]);
  });

  it('ケーブルは6段ごとに交差し、帯の外は裏目', () => {
    const { cells } = cellsOf('cable-2x2');
    expect(stitchAt(cells, boardRowOfKnittedRow(1), 0)).toBe(STITCH.purl);
    expect(stitchAt(cells, boardRowOfKnittedRow(1), 8)).toBe(STITCH.knit);
    // 交差は6段目と12段目。盤面では1段目から数えて上へ並ぶ。
    expect(stitchAt(cells, boardRowOfKnittedRow(6), 8)).toBe(STITCH.rightUpTwoCross);
    expect(stitchAt(cells, boardRowOfKnittedRow(12), 8)).toBe(STITCH.leftUpTwoCross);
  });

  it('ねじり目は決まった列に置く', () => {
    const { cells } = cellsOf('twist');
    expect(stitchAt(cells, boardRowOfKnittedRow(1), 6)).toBe(STITCH.twist);
    expect(stitchAt(cells, boardRowOfKnittedRow(11), 14)).toBe(STITCH.twist);
    expect(stitchAt(cells, boardRowOfKnittedRow(1), 7)).toBe(STITCH.knit);
  });

  it('配色のテンプレートは色を変えて置く', () => {
    const nordic = cellsOf('nordic').cells;
    expect(cellColor(at(nordic, boardRowOfKnittedRow(11), 7))).toBe(COLORS.garnet);
    expect(cellColor(at(nordic, boardRowOfKnittedRow(1), 0))).toBe(COLORS.sand);

    const checker = cellsOf('checker').cells;
    expect(cellColor(at(checker, boardRowOfKnittedRow(1), 0))).toBe(COLORS.forest);
    expect(cellColor(at(checker, boardRowOfKnittedRow(1), 4))).toBe(COLORS.sand);
  });

  it.each(TEMPLATES)('$slug のプレビューは、復元した盤面を編集画面と同じ向きに描く', ({ slug }) => {
    // SVGの`use`は盤面のマス1つに対応する。編集画面と同じく、盤面の段`row`は`y = row * CELL`、
    // 列`col`は`x = col * CELL`にあり、`href`の記号IDもそのマスの記号と一致する。
    const { cells } = cellsOf(slug);
    const svg = readText(`public/templates/${slug}.svg`);
    const uses = [...svg.matchAll(/<use href="#s(\d+)" x="(\d+)" y="(\d+)"/g)]
      .map((match) => ({ stitchId: Number(match[1]), x: Number(match[2]), y: Number(match[3]) }));
    // 複数段の記号も`.knit`では起点のマスだけに値を持つので、値のあるマスの数と比べる。
    const anchorCount = [...cells].filter((value) => value !== 0).length;
    expect(uses).toHaveLength(anchorCount);

    const seen = new Set();
    for (const { stitchId, x, y } of uses) {
      const where = `${slug}: x=${x}, y=${y}`;
      expect(x % CELL, `${where} はマス目の位置`).toBe(0);
      expect(y % CELL, `${where} はマス目の位置`).toBe(0);
      const col = x / CELL;
      const row = y / CELL;
      expect(row >= 0 && row < ROWS && col >= 0 && col < COLS, `${where} は盤面の中`).toBe(true);
      const value = at(cells, row, col);
      expect(value ?? 0, `${where} の盤面のマスが空`).not.toBe(0);
      expect(cellStitchId(value), `${where} の記号が盤面と違う`).toBe(stitchId);
      const position = `${row},${col}`;
      expect(seen.has(position), `${where} が重複している`).toBe(false);
      seen.add(position);
    }
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
