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
      for (const label of ['新しい編み図', '名称', '複製', '削除', '選択範囲をブロック保存', 'この編み図', '全データ', '（復元）']) {
        expect(text).toContain(`「${label}」`);
      }
      expect(text).toContain('保存済みブロックは含まれません');
      expect(text).toContain('すべての編み図と保存済みブロック');
      expect(text).toContain('既存の編み図は上書きされず');
      expect(text).toContain('復元した先頭の編み図へ切り替わります');
      expect(text).toContain('選んだ色にかかわらず白く描かれます');
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
        expect(document.querySelectorAll('code').length).toBeGreaterThan(0);
        const links = [...document.querySelectorAll('a')].filter((link) => ['/', '/index.html'].includes(link.getAttribute('href')));
        expect(links.length).toBe(4);
        expect(document.querySelector('header a').textContent).toBe('棒針編み図エディタ');
        for (const link of links.filter((link) => !link.closest('header'))) expect(link.textContent).toContain('戻る');
        for (const link of links) expect(link.textContent).not.toContain('編み図を作成する');
      });
    }
  });
}
