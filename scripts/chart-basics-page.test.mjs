// @vitest-environment node
// 編み図の作り方のページが、検索から来た人に必要な内容と導線を持つかを確かめる。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pdfPageRange } from '../packages/editor-core/export/pdf.worker.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const page = read('public/chart-basics/index.html');

describe('編み図の作り方のページ', () => {
  it('検索と共有のための情報を持つ', () => {
    expect(page).toContain('<title>編み図の作り方｜描く手段の選び方とA4印刷｜棒針編み図エディタ</title>');
    // og:titleは`<title>`と同じ文字列にする。
    const title = page.match(/<title>([^<]+)<\/title>/)?.[1];
    expect(title).toBeDefined();
    expect(page).toContain(`<meta property="og:title" content="${title}" />`);
    expect(page).toContain('<link rel="canonical" href="https://knittingeditor.com/chart-basics/" />');
    expect(page).toContain('<meta property="og:url" content="https://knittingeditor.com/chart-basics/" />');
    expect(page).toContain('<meta property="og:image" content="https://knittingeditor.com/og-image.png" />');
    expect(page).toMatch(/<meta name="description" content="[^"]*ゲージ[^"]*"/);
  });

  it('手段の比較・段数と目数・A4印刷・つまずきを1ページにまとめる', () => {
    for (const heading of ['編み図を描く方法を選ぶ', '段数と目数を決める', 'A4に印刷する', 'よくあるつまずき', '描き始める']) {
      expect(page, heading).toContain(`<h2>${heading}</h2>`);
    }
    // 方眼紙・表計算・アプリ・このサイトの4つを比べる。
    expect(page.match(/<section class="method">/g)).toHaveLength(4);
    for (const method of ['方眼紙に手書き', '表計算ソフト（Excelなど）', '編み図用のアプリ・サイト', 'このサイト（棒針編み図エディタ）']) {
      expect(page, method).toContain(`<h3>${method}</h3>`);
    }
    // ゲージから目数・段数を求める例と、分割PDFの手順。
    expect(page).toContain('20×50÷10=100目');
    expect(page).toContain('28×30÷10=84段');
    expect(page).toContain('読みやすく分割');
    expect(page).toContain('セル寸法');
    // ページ下端の目印は、PDF Workerの`pdfPageRange`が作る全角スペース区切りの例と同じにする。
    const range = pdfPageRange(
      { rows: 40, cols: 30, cells: new ArrayBuffer(0) },
      { row: 0, col: 0, rows: 20, cols: 30 },
      1,
      6,
    );
    expect(range).toBe('2/6ページ　段21〜40　目1〜30');
    expect(page).toContain(`「${range}」`);
  });

  it('使い方・記号の一覧・テンプレートと相互にリンクする', () => {
    for (const path of ['/', '/guide/', '/stitches/', '/templates/']) {
      expect(page, path).toContain(`href="${path}"`);
    }
    // 使い方からも、このページへのリンクがある。
    expect(read('public/guide/index.html')).toContain('href="/chart-basics/"');
    expect(read('public/stitches/index.html')).toContain('href="/chart-basics/"');
    expect(read('public/templates/index.html')).toContain('href="/chart-basics/"');
  });

  it('サイトマップとllms.txtから辿れる', () => {
    expect(read('public/sitemap.xml')).toContain('<loc>https://knittingeditor.com/chart-basics/</loc>');
    expect(read('public/llms.txt')).toContain('https://knittingeditor.com/chart-basics/');
  });

  it('計測のスクリプトを読み込み、編集画面へのリンクに印を付ける', () => {
    expect(page.split('<script type="module" src="/analytics.js" data-analytics-entry></script>')).toHaveLength(2);
    expect(page.match(/data-analytics="editor"/g)).toHaveLength(2);
    expect(page).not.toContain('<script>');
  });
});
