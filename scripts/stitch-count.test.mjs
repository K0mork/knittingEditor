// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STITCHES } from '../packages/editor-core/stitches/catalog.ts';

/**
 * 利用者向け文書の「29種類」「29記号」のような件数が、記号カタログの件数と
 * ずれていないかを検査する。記号を追加・削除したときに、文書側の更新漏れを
 * ここで検出する。SEO用の文言は変えず、件数だけをカタログに合わせる。
 */
const root = new URL('../', import.meta.url);

// 記号と関係のない「3種類のファイル」のような文で誤って失敗しないよう、
// 「種類」の後に続く語まで含めて照合する。
const stitchKinds = /(\d+)種類の編み目記号/g;

const checks = [
  { file: 'README.md', pattern: stitchKinds },
  { file: 'index.html', pattern: stitchKinds },
  { file: 'public/llms.txt', pattern: /(\d+)種類の(?:選択肢|編み目記号)/g },
  { file: 'public/guide/index.html', pattern: stitchKinds },
  { file: 'ios/Web/public/guide/index.html', pattern: stitchKinds },
  { file: 'ios/SPECIFICATION.md', pattern: /(?:カタログv\d+の|全)(\d+)記号/g },
  { file: 'ios/DEVELOPMENT.md', pattern: /全(\d+)記号/g },
  { file: 'tests/e2e/seo.spec.ts', pattern: stitchKinds },
];

describe('user-facing stitch counts', () => {
  it.each(checks)('matches the catalog in $file', ({ file, pattern }) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    const counts = [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => Number(match[1]));
    expect(counts.length, `${file}に件数の記載がありません`).toBeGreaterThan(0);
    expect(counts, `${file}の件数`).toEqual(counts.map(() => STITCHES.length));
  });
});
