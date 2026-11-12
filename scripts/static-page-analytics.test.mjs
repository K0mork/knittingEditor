// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

/** 計測する静的ページ。編集画面は`src/analytics.ts`が計測する。 */
const STATIC_PAGES = ['public/guide/index.html', 'public/templates/index.html', 'public/stitches/index.html', 'public/chart-basics/index.html', 'public/support/index.html', 'public/privacy/index.html'];
const SCRIPT_TAG = '<script type="module" src="/analytics.js" data-analytics-entry></script>';

/** 計測する静的ページと、プライバシーポリシーで使うページ名。 */
const PAGE_NAMES = {
  'public/guide/index.html': '使い方',
  'public/templates/index.html': 'テンプレート',
  'public/stitches/index.html': '編み目記号の一覧',
  'public/chart-basics/index.html': '編み図の作り方',
  'public/support/index.html': 'サポート',
  'public/privacy/index.html': 'このページ',
};

/** 静的ページの`data-analytics`の接頭辞と、プライバシーポリシーで使うリンクの種類の呼び方。 */
const LINK_KINDS = { editor: '編集画面', app_store: 'App Store', template_: 'ダウンロードしたテンプレート' };

describe('静的ページの計測', () => {
  it.each(STATIC_PAGES)('%sで計測のスクリプトを1回だけ読み込む', (path) => {
    expect(read(path).split(SCRIPT_TAG)).toHaveLength(2);
  });

  it('編集画面へ進むリンクとApp Storeのリンクに、計測用の印を付ける', () => {
    const guide = read('public/guide/index.html');
    expect(guide.match(/data-analytics="editor"/g)).toHaveLength(2);
    expect(guide.match(/data-analytics="app_store"/g)).toHaveLength(2);

    const support = read('public/support/index.html');
    expect(support.match(/data-analytics="editor"/g)).toHaveLength(1);
    expect(support.match(/data-analytics="app_store"/g)).toHaveLength(2);

    const templates = read('public/templates/index.html');
    expect(templates.match(/data-analytics="editor"/g)).toHaveLength(2);
    expect(templates.match(/data-analytics="template_[a-z0-9-]+"/g)).toHaveLength(8);
  });

  it('編集画面では静的ページ用のスクリプトを読み込まない', () => {
    // 編集画面は`src/analytics.ts`で計測する。両方を読み込むと二重に数える。
    expect(read('index.html')).not.toContain('/analytics.js');
  });

  it('計測する静的ページをすべてプライバシーポリシーに書く', () => {
    const measured = STATIC_PAGES.filter((path) => read(path).includes(SCRIPT_TAG));
    expect(measured).toEqual(Object.keys(PAGE_NAMES));

    const policy = read('public/privacy/index.html');
    const sentence = policy.split('\n').find((line) => line.includes('使われ方を知って'));
    expect(sentence).toBeDefined();
    for (const [path, name] of Object.entries(PAGE_NAMES)) {
      expect(sentence, `${path}の「${name}」が計測対象の文にない`).toContain(name);
    }
  });

  it('静的ページのdata-analyticsをすべてプライバシーポリシーに書く', () => {
    const policy = read('public/privacy/index.html');
    const sentence = policy.split('\n').find((line) => line.includes('<code>link_clicked</code>') && line.includes('一緒に送る'));
    expect(sentence).toBeDefined();

    const used = new Set();
    for (const path of STATIC_PAGES) {
      for (const match of read(path).matchAll(/data-analytics="([^"]+)"/g)) {
        const prefix = Object.keys(LINK_KINDS).find((candidate) => match[1].startsWith(candidate));
        expect(prefix, `${path}のdata-analytics="${match[1]}"の接頭辞`).toBeDefined();
        used.add(prefix);
      }
    }
    expect([...used].sort()).toEqual(Object.keys(LINK_KINDS).sort());
    for (const [prefix, wording] of Object.entries(LINK_KINDS)) {
      expect(sentence, `data-analytics="${prefix}"の「${wording}」がリンクの文にない`).toContain(wording);
    }
  });

  it('アクセス解析を送らないiOS版の使い方には、計測のスクリプトを入れない', () => {
    expect(read('ios/Web/public/guide/index.html')).not.toContain('/analytics.js');
  });
});
