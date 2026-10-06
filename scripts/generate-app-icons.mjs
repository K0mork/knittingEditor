// 編集可能な背景・前景SVGからAny / Dark / Tintedを生成する。
// node scripts/generate-app-icons.mjs && node scripts/generate-web-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium } from '@playwright/test';

const source = new URL('../ios/design/app-icon/', import.meta.url);
const output = new URL('../ios/App/Assets.xcassets/AppIcon.appiconset/', import.meta.url);
const background = await readFile(new URL('background.svg', source), 'utf8');
const foreground = await readFile(new URL('foreground.svg', source), 'utf8');

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// AnyとTintedはRGB（アルファチャンネルなし）、DarkだけRGBAで保存する。
function png(rgba, transparent) {
  const channels = transparent ? 4 : 3;
  const scanlines = Buffer.alloc(1024 * (1 + 1024 * channels));
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      for (let c = 0; c < channels; c++) {
        scanlines[y * (1 + 1024 * channels) + 1 + x * channels + c] = rgba[(y * 1024 + x) * 4 + c];
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1024, 0);
  header.writeUInt32BE(1024, 4);
  header[8] = 8;
  header[9] = transparent ? 6 : 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const appearance of ['Any', 'Dark', 'Tinted']) {
    const rgba = await page.evaluate(async ({ background, foreground, appearance }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const context = canvas.getContext('2d');
      async function draw(svg) {
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        await image.decode();
        context.drawImage(image, 0, 0);
      }
      if (appearance === 'Any') await draw(background);
      if (appearance === 'Tinted') {
        context.fillStyle = '#000';
        context.fillRect(0, 0, 1024, 1024);
        foreground = foreground.replaceAll('#f8eed8', '#ffffff').replaceAll('#ce683f', '#aaaaaa');
      }
      await draw(foreground);
      return Array.from(context.getImageData(0, 0, 1024, 1024).data);
    }, { background, foreground, appearance });
    const name = appearance === 'Any' ? 'AppIcon-1024.png' : `AppIcon-${appearance}-1024.png`;
    await writeFile(new URL(name, output), png(rgba, appearance === 'Dark'));
    console.log(fileURLToPath(new URL(name, output)));
  }
} finally {
  await browser.close();
}
