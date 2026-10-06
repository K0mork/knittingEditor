// @vitest-environment node
// 利用者に見せる文章の句読点を「、」「。」にそろえる（#105）。全角の「，」「．」が入ったら失敗する。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

// Webサイト、アプリ内の使い方、編集画面とiOSアプリの文言、ライセンスページの導入文、App Storeの説明文案。
const targets = [
  'index.html',
  'public',
  'src',
  'packages',
  'scripts/third-party-notices.mjs',
  'ios/Web/index.html',
  'ios/Web/public',
  'ios/Web/src',
  'ios/App',
  'ios/docs/APP_STORE_METADATA.md',
];
const extensions = /\.(html|ts|tsx|mjs|css|swift|strings|md)$/;
const skippedDirectories = new Set(['node_modules', 'dist']);

function listFiles(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return skippedDirectories.has(entry.name) ? [] : listFiles(join(path, entry.name));
    return extensions.test(entry.name) ? [join(path, entry.name)] : [];
  });
}

function findFullWidthPunctuation(text) {
  return text.split('\n').flatMap((line, index) => (/[，．]/.test(line) ? [index + 1] : []));
}

describe('findFullWidthPunctuation', () => {
  it('reports the lines that use a full-width comma or period', () => {
    expect(findFullWidthPunctuation('編み図を作る、保存する。\n盤面，記号．\n1. 見出し')).toEqual([2]);
  });
});

describe('user-facing text', () => {
  it('uses 「、」 and 「。」 instead of 「，」 and 「．」', () => {
    const offending = targets
      .flatMap((target) => listFiles(join(root, target)))
      .flatMap((file) => findFullWidthPunctuation(readFileSync(file, 'utf8')).map((line) => `${relative(root, file)}:${line}`));
    expect(offending).toEqual([]);
  });
});
