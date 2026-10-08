import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/**
 * Web版の配信物に付けるContent-Security-Policy。GitHub Pagesはレスポンスヘッダーを付けられないので、
 * 各HTMLの`<meta http-equiv>`で指定する。metaでは`frame-ancestors`・`report-uri`・`sandbox`が効かないため入れない。
 *
 * GA4の送信先は、GoogleのCSPガイドのGoogle Analytics 4（Googleシグナルなし）の指定に合わせる。
 * gtag.jsは`www.googletagmanager.com`からだけ読み込む（`src/analytics.ts`）。
 * `style-src`は、記号SVGの`style`属性（`packages/editor-core/stitches/glyphs.ts`）と、使い方などのページの
 * `<style>`要素をそのまま使うため`'unsafe-inline'`を許す。スクリプトにはインラインを許さない。
 */
export const CONTENT_SECURITY_POLICY_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://www.googletagmanager.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://*.google-analytics.com', 'https://*.googletagmanager.com'],
  'connect-src': ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
  'worker-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export const CONTENT_SECURITY_POLICY = Object.entries(CONTENT_SECURITY_POLICY_DIRECTIVES)
  .map(([name, sources]) => `${name} ${sources.join(' ')}`)
  .join('; ');

const META = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
const SCRIPT_ELEMENT = /<script\b([^>]*)>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_ATTRIBUTE = /<[a-z][^>]*\son[a-z]+\s*=/i;
const CHARSET_META = /<meta charset="UTF-8" \/>\n/i;
const POLICY_META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)" \/>/gi;

/**
 * ポリシーが止めてしまう書き方を探す。インラインのスクリプトと`on*`属性は許可しないので、
 * 見つけたらビルドを止めて書き方を直してもらう。`type="application/ld+json"`などのデータは実行されないので対象外。
 */
export function findInlineScripts(html) {
  const problems = [];
  for (const match of html.matchAll(SCRIPT_ELEMENT)) {
    const attributes = match[1];
    if (/\ssrc\s*=/i.test(attributes)) continue;
    const type = /\stype\s*=\s*"([^"]*)"/i.exec(attributes)?.[1].toLowerCase() ?? '';
    if (type === '' || type === 'module' || type.includes('javascript')) problems.push('インラインの<script>');
  }
  if (EVENT_HANDLER_ATTRIBUTE.test(html)) problems.push('on*属性');
  return problems;
}

/** HTMLに入っているポリシーのmetaの値。無ければ空の配列。 */
export function contentSecurityPolicyMetas(html) {
  return [...html.matchAll(POLICY_META)].map((match) => match[1]);
}

/** `<meta charset>`の直後にポリシーのmetaを入れる。ポリシーはmetaより後ろの要素にしか効かないため、先頭近くに置く。 */
export function applyContentSecurityPolicy(html) {
  if (contentSecurityPolicyMetas(html).length > 0) throw new Error('Content-Security-Policyのmetaが既にあります');
  const problems = findInlineScripts(html);
  if (problems.length > 0) throw new Error(`Content-Security-Policyが止める書き方があります: ${problems.join('、')}`);
  if (!CHARSET_META.test(html)) throw new Error('<meta charset="UTF-8" />が見つかりません');
  return html.replace(CHARSET_META, (charset) => `${charset}    ${META}\n`);
}

/** 配信物のHTMLが、正しいポリシーのmetaを`<meta charset>`の直後に1つだけ持つかを調べる。問題の説明を返す。 */
export function verifyContentSecurityPolicy(html) {
  const metas = contentSecurityPolicyMetas(html);
  if (metas.length !== 1) return `Content-Security-Policyのmetaが${metas.length}個あります`;
  if (metas[0] !== CONTENT_SECURITY_POLICY) return `Content-Security-Policyが想定と違います: ${metas[0]}`;
  const problems = findInlineScripts(html);
  if (problems.length > 0) return `Content-Security-Policyが止める書き方があります: ${problems.join('、')}`;
  if (!html.includes(`<meta charset="UTF-8" />\n    ${META}\n`)) return 'Content-Security-Policyのmetaが<meta charset>の直後にありません';
  return undefined;
}

/** ディレクトリの下にあるすべてのHTMLファイル。`dist/`の検査でも使う。 */
export async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

/**
 * 本番ビルドの出力先にあるすべてのHTML（`index.html`、`public/`から写したページ、生成したページ）へ
 * ポリシーのmetaを入れる。開発サーバー（`npm run dev`）には入れない。CSP違反はE2Eが本番ビルドで検出する。
 * `public/`のファイルはViteが変換しないため、書き出し後のファイルを直接書き換える。
 */
export function contentSecurityPolicy() {
  let outDir = 'dist';
  return {
    name: 'knitting-editor:content-security-policy',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      for (const file of await htmlFiles(outDir)) {
        const html = await readFile(file, 'utf8');
        try {
          await writeFile(file, applyContentSecurityPolicy(html));
        } catch (error) {
          this.error(`${relative(outDir, file)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    },
  };
}
