// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STITCHES } from './catalog';

/**
 * 利用者向け文書の「29種類」「29記号」のような件数が、記号カタログの件数と
 * ずれていないかを検査する。記号を追加・削除したときに、文書側の更新漏れを
 * ここで検出する。SEO用の文言は変えず、件数だけをカタログに合わせる。
 */
const root = new URL('../../../', import.meta.url);

const checks: ReadonlyArray<{ file: string; pattern: RegExp }> = [
  { file: 'README.md', pattern: /(\d+)種類/g },
  { file: 'index.html', pattern: /(\d+)種類/g },
  { file: 'public/llms.txt', pattern: /(\d+)種類/g },
  { file: 'public/guide/index.html', pattern: /(\d+)種類/g },
  { file: 'ios/Web/public/guide/index.html', pattern: /(\d+)種類/g },
  { file: 'ios/SPECIFICATION.md', pattern: /(?:カタログv\d+の|全)(\d+)記号/g },
  { file: 'ios/DEVELOPMENT.md', pattern: /全(\d+)記号/g },
  { file: 'tests/e2e/seo.spec.ts', pattern: /(\d+)種類/g },
];

describe('user-facing stitch counts', () => {
  it.each(checks)('matches the catalog in $file', ({ file, pattern }) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    const counts = [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => Number(match[1]));
    expect(counts.length, `${file}に件数の記載がありません`).toBeGreaterThan(0);
    expect(counts, `${file}の件数`).toEqual(counts.map(() => STITCHES.length));
  });
});
