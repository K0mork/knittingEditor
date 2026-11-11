// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

/** 計測する静的ページ。編集画面は`src/analytics.ts`が計測する。 */
const STATIC_PAGES = ['public/guide/index.html', 'public/support/index.html', 'public/privacy/index.html'];
const SCRIPT_TAG = '<script type="module" src="/analytics.js" data-analytics-entry></script>';

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
  });

  it('編集画面では静的ページ用のスクリプトを読み込まない', () => {
    // 編集画面は`src/analytics.ts`で計測する。両方を読み込むと二重に数える。
    expect(read('index.html')).not.toContain('/analytics.js');
  });

  it('アクセス解析を送らないiOS版の使い方には、計測のスクリプトを入れない', () => {
    expect(read('ios/Web/public/guide/index.html')).not.toContain('/analytics.js');
  });
});
