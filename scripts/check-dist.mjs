import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const required = ['index.html', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'icon-192.png', 'apple-touch-icon.png', 'og-image.png', 'guide/index.html', 'support/index.html', 'third-party-notices/index.html'];
for (const file of required) await stat(join('dist', file));
const assets = await readdir(join('dist', 'assets'));

const ogImage = await readFile(join('dist', 'og-image.png'));
if (ogImage.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('og-image.png がPNGではありません');
if (ogImage.readUInt32BE(16) !== 1200 || ogImage.readUInt32BE(20) !== 630) throw new Error('og-image.png が1200×630ではありません');
for (const page of ['index.html', 'guide/index.html', 'support/index.html']) {
  const html = await readFile(join('dist', page), 'utf8');
  if (!html.includes('<meta property="og:image" content="https://knittingeditor.com/og-image.png" />')) throw new Error(`${page} にog:imageがありません`);
}
async function checkPng(file, width, height) {
  const png = await readFile(join('dist', file));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${file} がPNGではありません`);
  if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw new Error(`${file} が${width}×${height}ではありません`);
}
await checkPng('icon-192.png', 192, 192);
await checkPng('apple-touch-icon.png', 180, 180);
const favicon = await readFile(join('dist', 'favicon.ico'));
if (favicon.readUInt16LE(0) !== 0 || favicon.readUInt16LE(2) !== 1 || favicon.readUInt16LE(4) < 1) throw new Error('favicon.ico がICOではありません');
for (const page of ['index.html', 'guide/index.html', 'support/index.html']) {
  const html = await readFile(join('dist', page), 'utf8');
  for (const link of ['<link rel="icon" href="/favicon.ico"', '<link rel="icon" href="/icon-192.png"', '<link rel="apple-touch-icon" href="/apple-touch-icon.png"']) {
    if (!html.includes(link)) throw new Error(`${page} に ${link} がありません`);
  }
}
const notices = await readFile(join('dist', 'third-party-notices', 'index.html'), 'utf8');
for (const name of ['fflate', 'idb', 'react', 'react-dom', 'scheduler']) {
  if (!new RegExp(`<h2>${name} [^<]+</h2>`).test(notices)) throw new Error(`third-party-notices/index.html に ${name} のライセンス表記がありません`);
}
if (!assets.some((file) => file.startsWith('pdf.worker-') && file.endsWith('.js'))) throw new Error('PDF Workerが出力されていません');

async function totalSize(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    total += entry.isDirectory() ? await totalSize(path) : (await stat(path)).size;
  }
  return total;
}

const bytes = await totalSize('dist');
if (bytes > 5 * 1024 * 1024) throw new Error(`配信物が5MBを超えています: ${bytes}`);
console.log(`dist verified: ${(bytes / 1024).toFixed(1)} KiB`);
