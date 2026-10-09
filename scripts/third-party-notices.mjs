import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 配信物の中で、第三者ソフトウェアのライセンス表記を置く場所。 */
export const THIRD_PARTY_NOTICES_PATH = 'third-party-notices/index.html';

const NODE_MODULES = '/node_modules/';
const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;

/** バンドルへ入ったモジュールのIDから、`node_modules`内のパッケージのルートを返す。 */
export function packageRootOf(moduleId) {
  const id = moduleId.replace(/^\0/, '').split('?')[0].replaceAll('\\', '/');
  const index = id.lastIndexOf(NODE_MODULES);
  if (index < 0) return undefined;
  const parts = id.slice(index + NODE_MODULES.length).split('/');
  const nameLength = parts[0].startsWith('@') ? 2 : 1;
  if (parts.length <= nameLength) return undefined;
  return id.slice(0, index + NODE_MODULES.length) + parts.slice(0, nameLength).join('/');
}

/** パッケージの`package.json`とライセンス文を読む。ライセンス文が無ければビルドを止める。 */
export function readPackageNotice(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const licenseFile = readdirSync(root).find((file) => LICENSE_FILE.test(file));
  if (!manifest.name || !manifest.version || !manifest.license || !licenseFile) {
    throw new Error(`${root} の名前・版・ライセンス・ライセンス文のいずれかが見つかりません`);
  }
  return {
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
    text: readFileSync(join(root, licenseFile), 'utf8').trim(),
  };
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderNoticesHtml(notices) {
  const sections = [...notices]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (notice) => `      <section>
        <h2>${escapeHtml(notice.name)} ${escapeHtml(notice.version)}</h2>
        <p>ライセンス: ${escapeHtml(notice.license)}</p>
        <pre>${escapeHtml(notice.text)}</pre>
      </section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <title>第三者ソフトウェアのライセンス｜棒針編み図エディタ</title>
    <style>
      :root {
        font-family: Inter, "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
        color: #26322c;
        background: #f3f0e8;
        line-height: 1.8;
        color-scheme: light dark;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      header, main, footer { width: min(880px, calc(100% - 32px)); margin-inline: auto; }
      header { padding: 28px 0 12px; }
      main { padding: 8px 0 48px; }
      footer { padding: 20px 0 40px; border-top: 1px solid #d5dbd3; }
      h1 { font-size: clamp(1.5rem, 4.5vw, 2.2rem); line-height: 1.35; }
      h2 { margin-top: 2em; line-height: 1.45; font-size: 1.2rem; }
      a { color: #285d35; }
      pre {
        padding: 14px 16px;
        background: #fffef9;
        border: 1px solid #d5dbd3;
        font-size: 0.82rem;
        line-height: 1.6;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      @media (prefers-color-scheme: dark) {
        :root { color: #e2e8e3; background: #171c19; }
        footer { border-top-color: #3c4741; }
        a { color: #8fcb9b; }
        pre { background: #212824; border-color: #3c4741; }
      }
    </style>
  </head>
  <body>
    <header>
      <a href="/guide/">使い方へ戻る</a>
    </header>
    <main>
      <h1>第三者ソフトウェアのライセンス</h1>
      <p>棒針編み図エディタは、次のオープンソースソフトウェアを含んでいます。各ソフトウェアの著作権表示とライセンス条件を以下に記載します。</p>
${sections}
    </main>
    <footer>
      <a href="/guide/">使い方へ戻る</a>
    </footer>
  </body>
</html>
`;
}

/**
 * バンドルへ実際に入った`node_modules`のパッケージを集め、ライセンス表記のページを出力する。
 * Workerは別のビルドになるため、`workerPlugin`をViteの`worker.plugins`へ渡して同じ集計へ加える。
 * Workerのビルドは本体のモジュール変換中に走るので、本体の`generateBundle`より先に終わる。
 */
export function thirdPartyNotices() {
  const roots = new Set();
  const collect = (moduleIds) => {
    for (const id of moduleIds) {
      const root = packageRootOf(id);
      if (root) roots.add(root);
    }
  };
  const collectChunks = (bundle) => {
    for (const output of Object.values(bundle)) {
      if (output.type === 'chunk') collect(output.moduleIds ?? []);
    }
  };
  return {
    plugin: {
      name: 'knitting-editor:third-party-notices',
      apply: 'build',
      buildStart() {
        roots.clear();
      },
      generateBundle(_options, bundle) {
        collectChunks(bundle);
        if (roots.size === 0) this.error('バンドルに第三者のパッケージが見つかりません');
        this.emitFile({
          type: 'asset',
          fileName: THIRD_PARTY_NOTICES_PATH,
          source: renderNoticesHtml([...roots].map(readPackageNotice)),
        });
      },
    },
    workerPlugin: () => ({
      name: 'knitting-editor:third-party-notices-worker',
      apply: 'build',
      generateBundle(_options, bundle) {
        collectChunks(bundle);
      },
    }),
  };
}
