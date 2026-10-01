// OGP画像 public/og-image.png を作り直す。CIでは実行せず、生成したPNGをコミットする。
// 和文フォント（ヒラギノ角ゴシック）に依存するため macOS で実行する。
//   node scripts/generate-og-image.mjs
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const WIDTH = 1200;
const HEIGHT = 630;
const CELL = 150;
const SYMBOLS = ['knit', 'yo', 'twist_stitch'];
const OUTPUT = fileURLToPath(new URL('../public/og-image.png', import.meta.url));

if (process.platform !== 'darwin') {
  throw new Error('OGP画像はヒラギノ角ゴシックで描くため macOS で生成してください');
}

async function loadGlyphs() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
  try {
    const { stitchSvg } = await server.ssrLoadModule('/packages/editor-core/stitches/catalog.ts');
    return SYMBOLS.map((key) => {
      const svg = stitchSvg(key);
      if (!svg) throw new Error(`記号 ${key} が見つかりません`);
      return svg;
    });
  } finally {
    await server.close();
  }
}

function symbolColumn(glyphs) {
  const lines = glyphs.slice(1).map((_, index) => `<line x1="0" y1="${(index + 1) * CELL}" x2="${CELL}" y2="${(index + 1) * CELL}"/>`).join('');
  const cells = glyphs.map((svg, index) => `<div class="cell" style="top:${index * CELL}px">${svg}</div>`).join('');
  return `<div class="symbols"><svg width="${CELL}" height="${glyphs.length * CELL}" stroke="#c9d2c6" stroke-width="3">${lines}</svg>${cells}</div>`;
}

function html(glyphs) {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #f3f0e8;
      font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif; }
    svg { display: block; }
    .text { position: absolute; left: 60px; line-height: 1; white-space: nowrap; }
    .kind { top: 44px; font-size: 110px; font-weight: 800; color: #26322c; }
    .title { top: 156px; left: 44px; font-size: 300px; font-weight: 900; letter-spacing: -0.02em; color: #285d35; }
    .band { position: absolute; left: 0; bottom: 0; width: 100%; height: 118px; background: #3d7a4a; }
    .note { top: 531px; font-size: 80px; font-weight: 800; color: #fff; }
    .symbols { position: absolute; left: 960px; top: 40px; width: ${CELL}px; overflow: hidden; border-radius: 18px; background: #fffef9; }
    .cell { position: absolute; left: 0; width: ${CELL}px; height: ${CELL}px; padding: 9px; color: #285d35; }
  </style>
  <div class="text kind">棒針の</div>
  <div class="text title">編み図</div>
  ${symbolColumn(glyphs)}
  <div class="band"></div>
  <div class="text note">無料・登録不要</div>
  </html>`;
}

const glyphs = await loadGlyphs();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(html(glyphs));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUTPUT });
} finally {
  await browser.close();
}
console.log(`generated ${OUTPUT}`);
