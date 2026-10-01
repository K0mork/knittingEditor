// Web版のアイコンをiOS版のAppIconから作り直す。CIでは実行せず、生成したファイルをコミットする。
// 縮小に sips を使うため macOS で実行する。
//   node scripts/generate-web-icons.mjs
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const PNG_OUTPUTS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
];
const ICO_SIZES = [16, 32, 48];

if (process.platform !== 'darwin') {
  throw new Error('アイコンは sips で縮小するため macOS で生成してください');
}

async function resizePng(directory, size) {
  const output = join(directory, `${size}.png`);
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), SOURCE, '--out', output], { stdio: 'ignore' });
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
  for (const { file, size } of PNG_OUTPUTS) {
    await writeFile(join(PUBLIC, file), await resizePng(directory, size));
    console.log(`public/${file} (${size}x${size})`);
  }
  const icoImages = [];
  for (const size of ICO_SIZES) icoImages.push({ size, png: await resizePng(directory, size) });
  await writeFile(join(PUBLIC, 'favicon.ico'), buildIco(icoImages));
  console.log(`public/favicon.ico (${ICO_SIZES.join(', ')})`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
