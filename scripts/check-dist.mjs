import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const required = ['index.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'og-image.png', 'guide/index.html'];
for (const file of required) await stat(join('dist', file));
const assets = await readdir(join('dist', 'assets'));

const ogImage = await readFile(join('dist', 'og-image.png'));
if (ogImage.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('og-image.png がPNGではありません');
if (ogImage.readUInt32BE(16) !== 1200 || ogImage.readUInt32BE(20) !== 630) throw new Error('og-image.png が1200×630ではありません');
for (const page of ['index.html', 'guide/index.html']) {
  const html = await readFile(join('dist', page), 'utf8');
  if (!html.includes('<meta property="og:image" content="https://knittingeditor.com/og-image.png" />')) throw new Error(`${page} にog:imageがありません`);
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
