// Web版のアイコンを、アプリアイコン（ios/App/AppIcon.icon）の背景色と層から作り直す。CIでは実行せず、生成したファイルをコミットする。
// WebにはLiquid Glassがないので、層を背景色の上に平らに重ねる。縮小に sips を使うため macOS で実行する。
//   node scripts/generate-web-icons.mjs
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ICON = new URL('../ios/App/AppIcon.icon/', import.meta.url);
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const PNG_OUTPUTS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
];
const ICO_SIZES = [16, 32, 48];

if (process.platform !== 'darwin') {
  throw new Error('アイコンは sips で縮小するため macOS で生成してください');
}

// 通常の外観の背景色（`srgb:r,g,b,a`）をCSSの色にする。
function backgroundColor(document) {
  const base = document['fill-specializations'].find(entry => !entry.appearance).value;
  const color = base['automatic-gradient'] ?? base.solid;
  const [r, g, b] = color.replace(/^srgb:/, '').split(',').map(Number);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}

// 背面から順に重ねる（icon.jsonのグループと層は手前から並ぶ）。
async function layerImages(document) {
  const names = document.groups.toReversed().flatMap(group => group.layers.toReversed().map(layer => layer['image-name']));
  return Promise.all(names.map(async name => 'data:image/svg+xml;base64,' + (await readFile(new URL(`Assets/${name}`, ICON))).toString('base64')));
}

async function renderFlatIcon(output) {
  const document = JSON.parse(await readFile(new URL('icon.json', ICON), 'utf8'));
  const layers = (await layerImages(document)).map(src => `<img src="${src}">`).join('');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
    await page.setContent(`<style>body{margin:0;width:1024px;height:1024px;background:${backgroundColor(document)}}img{position:absolute;inset:0;width:1024px;height:1024px}</style>${layers}`);
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await page.screenshot({ path: output, omitBackground: false });
  } finally {
    await browser.close();
  }
}

async function resizePng(source, directory, size) {
  const output = join(directory, `${size}.png`);
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', output], { stdio: 'ignore' });
  return readFile(output);
}

// PNGをそのまま格納するICO（Windows Vista以降・全主要ブラウザが対応）。
function buildIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const directory = await mkdtemp(join(tmpdir(), 'knitting-icons-'));
try {
  const source = join(directory, 'icon-1024.png');
  await renderFlatIcon(source);
  for (const { file, size } of PNG_OUTPUTS) {
    await writeFile(join(PUBLIC, file), await resizePng(source, directory, size));
    console.log(`public/${file} (${size}x${size})`);
  }
  const icoImages = [];
  for (const size of ICO_SIZES) icoImages.push({ size, png: await resizePng(source, directory, size) });
  await writeFile(join(PUBLIC, 'favicon.ico'), buildIco(icoImages));
  console.log(`public/favicon.ico (${ICO_SIZES.join(', ')})`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
