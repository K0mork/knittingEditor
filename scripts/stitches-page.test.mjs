// @vitest-environment node
// 編み目記号の一覧ページが、アプリの記号一覧と同じ名前・並び・絵で作られているかを確かめる。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STITCHES,
  STITCH_CATEGORY_LABELS,
  STITCH_CATEGORY_ORDER,
  STITCH_STANDARD_LABELS,
} from '../packages/editor-core/stitches/catalog.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const page = read('public/stitches/index.html');

/** ページに載る記号の並び。アプリの記号一覧と同じく、区分の順にカタログの順で並べる。 */
const expectedOrder = STITCH_CATEGORY_ORDER.flatMap((category) => STITCHES.filter((stitch) => stitch.category === category));

function articleOf(key) {
  const match = new RegExp(`<article class="stitch" id="${key}" data-stitch="${key}">([\\s\\S]*?)</article>`).exec(page);
  expect(match, `${key} の記事`).not.toBeNull();
  return match[1];
}

describe('編み目記号の一覧ページ', () => {
  it('すべての記号を、アプリの記号一覧と同じ並びで1回ずつ載せる', () => {
    const keys = [...page.matchAll(/<article class="stitch" id="([a-z_]+)" data-stitch="([a-z_]+)">/g)].map((match) => match[2]);
    expect(keys).toEqual(expectedOrder.map((stitch) => stitch.key));
    expect(keys).toHaveLength(STITCHES.length);
  });

  it('名前・大きさ・標準の区分をカタログから作る', () => {
    for (const stitch of STITCHES) {
      const article = articleOf(stitch.key);
      expect(article, stitch.key).toContain(`<h3>${stitch.name}</h3>`);
      expect(article, stitch.key).toContain(`<span class="tag">${STITCH_STANDARD_LABELS[stitch.standardStatus]}</span>`);
      expect(article, stitch.key).toContain(`<span>${stitch.height}段×${stitch.width}目</span>`);
    }
  });

  it('記号の絵はアプリと同じSVGを使う', () => {
    for (const stitch of STITCHES) {
      expect(articleOf(stitch.key), stitch.key).toContain(stitch.svg);
    }
  });

  it('区分の見出しと順番をアプリの記号一覧とそろえる', () => {
    const sections = [...page.matchAll(/<section class="category" id="([a-z]+)" data-category="([a-z]+)">\s*<h2>([^<]+)<\/h2>/g)];
    expect(sections.map((match) => match[2])).toEqual(STITCH_CATEGORY_ORDER);
    expect(sections.map((match) => {
      const category = match[2];
      const count = STITCHES.filter((stitch) => stitch.category === category).length;
      return match[3] === `${STITCH_CATEGORY_LABELS[category]}の記号（${count}）`;
    })).toEqual(STITCH_CATEGORY_ORDER.map(() => true));
  });

  it('各記号の記事を、カタログの区分のsectionに置く', () => {
    const sections = [...page.matchAll(/<section class="category" id="[a-z]+" data-category="([a-z]+)">([\s\S]*?)<\/section>/g)]
      .map((match) => ({ category: match[1], body: match[2] }));
    const placed = sections.flatMap((section) => [...section.body.matchAll(/data-stitch="([a-z_]+)"/g)]
      .map((match) => ({ key: match[1], category: section.category })));

    for (const stitch of STITCHES) {
      expect(placed.filter((entry) => entry.key === stitch.key), stitch.key)
        .toEqual([{ key: stitch.key, category: stitch.category }]);
    }

    // 見出しの件数は、そのsectionにある記事の数と一致する。
    for (const section of sections) {
      const headingCount = Number(/<h2>[^<]*（(\d+)）<\/h2>/.exec(section.body)?.[1]);
      const articleCount = (section.body.match(/<article class="stitch"/g) ?? []).length;
      expect(headingCount, section.category).toBe(articleCount);
    }
  });

  it('減目の傾きと、すべり目・浮き目の糸の向きを正しく書く', () => {
    for (const key of ['right_up_two_one', 'purl_right_up_two_one', 'right_up_three_one']) {
      expect(articleOf(key), key).toContain('左に傾きます');
    }
    for (const key of ['left_up_two_one', 'purl_left_up_two_one', 'left_up_three_one']) {
      expect(articleOf(key), key).toContain('右に傾きます');
    }
    expect(articleOf('float_stitch')).toContain('表側に渡す');
    expect(articleOf('slip_stitch')).toContain('裏側に渡す');
  });

  it('すべての記号に、意味・使いどころ・置き方を書く', () => {
    for (const stitch of STITCHES) {
      const article = articleOf(stitch.key);
      // 見出しと大きさの下にある説明の文。
      expect(article, stitch.key).toMatch(/<div class="text">\s*<p>[^<]{15,}<\/p>/);
      expect(article, stitch.key).toMatch(/<dt>使いどころ<\/dt><dd>[^<]{5,}<\/dd>/);
      expect(article, stitch.key).toMatch(/<dt>編み図での置き方<\/dt><dd>[^<]{5,}/);
    }
  });

  it('記号が使うマスの図を、幅と高さに合わせて作る', () => {
    for (const stitch of STITCHES) {
      const article = articleOf(stitch.key);
      expect(article, stitch.key).toContain(`<figcaption>使うマス：${stitch.width}目×${stitch.height}段</figcaption>`);
    }
  });

  it('検索と共有のための情報を持つ', () => {
    expect(page).toContain('<link rel="canonical" href="https://knittingeditor.com/stitches/" />');
    expect(page).toContain('<meta property="og:url" content="https://knittingeditor.com/stitches/" />');
    expect(page).toContain('<meta property="og:image" content="https://knittingeditor.com/og-image.png" />');
    expect(page).toContain('<title>編み目記号の一覧｜棒針編み図エディタ</title>');
    expect(page).toMatch(/<meta name="description" content="[^"]*編み目記号[^"]*29種類[^"]*"/);
  });

  it('サイトマップとllms.txtから辿れる', () => {
    expect(read('public/sitemap.xml')).toContain('<loc>https://knittingeditor.com/stitches/</loc>');
    expect(read('public/llms.txt')).toContain('https://knittingeditor.com/stitches/');
  });

  it('トップページ・使い方・テンプレートからリンクする', () => {
    for (const path of ['index.html', 'public/guide/index.html', 'public/templates/index.html']) {
      expect(read(path), path).toContain('href="/stitches/"');
    }
  });

  it('計測のスクリプトを読み込み、編集画面へのリンクに印を付ける', () => {
    expect(page.split('<script type="module" src="/analytics.js" data-analytics-entry></script>')).toHaveLength(2);
    expect(page.match(/data-analytics="editor"/g)).toHaveLength(2);
    expect(page).not.toContain('<script>');
  });
});
