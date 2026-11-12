// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

/** `docs/ANALYTICS.md`の「既存イベント」の表から、編集画面のイベント名を読む。 */
function editorEventNames(markdown) {
  const section = markdown.slice(markdown.indexOf('### 既存イベント'));
  const names = [];
  let inTable = false;
  for (const line of section.split('\n').slice(1)) {
    if (!inTable) {
      if (line.startsWith('| イベント |')) inTable = true;
      continue;
    }
    if (!line.startsWith('|')) break;
    const firstCell = line.split('|')[1].trim();
    if (firstCell === 'イベント' || /^-+$/.test(firstCell)) continue;
    const name = firstCell.match(/^`([a-z_]+)`$/);
    if (name === null) throw new Error(`イベント名を読めない行: ${line}`);
    names.push(name[1]);
  }
  return names;
}

/** プライバシーポリシーの「製品イベント」の表から、イベント名を読む。 */
function privacyEventNames(html) {
  const section = html.slice(html.indexOf('<h3>製品イベント</h3>'));
  const body = section.slice(section.indexOf('<tbody>'), section.indexOf('</tbody>'));
  return [...body.matchAll(/<tr><td>([\s\S]*?)<\/td>/g)].map((row) => {
    const name = row[1].replace(/<wbr>/g, '').match(/<code(?: class="[^"]*")?>([a-z_]+)<\/code>/);
    if (name === null) throw new Error(`イベント名を読めない行: ${row[0]}`);
    return name[1];
  });
}

describe('プライバシーポリシーの製品イベント', () => {
  it('docs/ANALYTICS.mdの編集画面のイベントをすべて載せる', () => {
    const documented = editorEventNames(read('docs/ANALYTICS.md'));
    const published = privacyEventNames(read('public/privacy/index.html'));

    expect(documented).toContain('link_clicked');
    expect(published).toEqual(expect.arrayContaining(documented));
  });
});
