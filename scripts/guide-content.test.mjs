// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const guides = ['public/guide/index.html', 'ios/Web/public/guide/index.html'];

for (const path of guides) {
  describe(path, () => {
    const document = new JSDOM(readFileSync(new URL(path, root), 'utf8')).window.document;
    const text = document.querySelector('main').textContent;

    it('explains chart management, reusable blocks and backup scope before restoring', () => {
      for (const label of ['新しい編み図', '名称', '複製', '削除', '選択範囲をブロック保存', 'この編み図を書き出す', '全データを書き出す', '（復元）']) {
        expect(text).toContain(`「${label}」`);
      }
      expect(text).toContain('保存済みブロックは含まれません');
      expect(text).toContain('すべての編み図と保存済みブロック');
      expect(text).toContain('既存の編み図は上書きされず');
      expect(text).toContain('復元した先頭の編み図へ切り替わります');
      expect(text).toContain('選んだ色にかかわらず白く描かれます');
    });

    it('describes where a block lands, how copies are named and what restoring adds', () => {
      for (const phrase of ['元の名前の末尾に「のコピー」を付けた編み図', '一覧に残った先頭の編み図が開きます', '「補助」にある記号', 'ブロックの左上になり', '収まらないときは貼付されません', '保存済みブロックも名前に「（復元）」を付けて追加されます']) {
        expect(text).toContain(phrase);
      }
      // バックアップの範囲は、復元の手順より前に読める。
      expect(text.indexOf('保存済みブロックは含まれません')).toBeGreaterThan(0);
      expect(text.indexOf('保存済みブロックは含まれません')).toBeLessThan(text.indexOf('「バックアップから復元」'));
      // 手順の見出しは、記号を選ぶ前に編み図の管理を置く順序を保つ。
      const headings = [...document.querySelectorAll('main h2')].map((heading) => heading.textContent);
      expect(headings.indexOf('編み図を増やす・切り替える')).toBeGreaterThan(-1);
      expect(headings.indexOf('編み図を増やす・切り替える')).toBeLessThan(headings.findIndex((heading) => heading.includes('編み目記号と色')));
      expect(headings.some((heading) => heading.includes('バックアップ'))).toBe(true);
    });

    it('explains right-side chart input and reading without changing numbering', () => {
      for (const explanation of ['表側から見た記号', '右下が1段め・1目め', '段は下から上へ、目は右から左へ', '奇数段は右から左へ、偶数段は左から右へ', '偶数段も表から見た「表目」を入力', '輪編み', '作り目を1段めと数え、次の2段めを裏側を見て編む', '作り目を描くと、最初に編む段は2段めになります']) {
        expect(text).toContain(explanation);
      }
    });

    if (path.startsWith('ios/')) {
      it('uses rendered code, app-specific instructions and honest return links', () => {
        expect(document.querySelector('body').textContent.replace(document.querySelector('script').textContent, '')).not.toContain('`');
        expect(text).not.toMatch(/Files|PCでは/);
        expect(text).toContain('「ファイル」アプリ');
        expect(text).toContain('プリントの項目が表示される環境では');
        expect(text).toContain('「ファイルを保存」の確認');
        for (const label of ['ファイルに保存', '共有', 'キャンセル']) expect(text).toContain(`「${label}」`);
        // プリントは環境によって表示が違うので、必ず出るとは書かない。
        expect(text).not.toMatch(/プリントを(選|押)/);
        expect(document.querySelectorAll('code').length).toBeGreaterThan(0);
        const links = [...document.querySelectorAll('a')].filter((link) => ['/', '/index.html'].includes(link.getAttribute('href')));
        expect(links.length).toBe(4);
        expect(document.querySelector('header a').textContent).toBe('棒針編み図エディタ');
        for (const link of links.filter((link) => !link.closest('header'))) expect(link.textContent).toContain('戻る');
        for (const link of links) expect(link.textContent).not.toContain('編み図を作成する');
      });

      it('explains how to allow Photos in the section that the denied-save toast opens', () => {
        // 写真への追加を拒否したときのトーストの「やり方を見る」は、アプリが渡す節のIDでこの節を開く（#208）。
        const swift = readFileSync(new URL('ios/App/WebViewContainer.swift', root), 'utf8');
        const sections = [...swift.matchAll(/guideSection: "([^"]+)"/g)].map((match) => match[1]);
        expect(sections).toEqual(['allow-photos']);
        const heading = document.getElementById('allow-photos');
        expect(heading?.textContent).toBe('写真への保存を許可する');
        let section = '';
        const settingsLinks = [];
        for (let node = heading.nextElementSibling; node && !/^H[23]$/.test(node.tagName); node = node.nextElementSibling) {
          section += node.textContent;
          if (node.matches('a[href]')) settingsLinks.push(node);
        }
        for (const label of ['画像を保存', '許可しない', '設定アプリを開く', 'アプリ', '棒針編み図', '写真', '写真の追加のみ']) expect(section).toContain(`「${label}」`);
        expect(settingsLinks.map((link) => [link.getAttribute('href'), link.textContent])).toEqual([['app-settings:', '設定アプリを開く']]);
        // 設定アプリを開くリンクは、この節だけに置く。
        expect(document.querySelectorAll('a[href^="app-settings:"]').length).toBe(1);
      });
    }
  });
}
