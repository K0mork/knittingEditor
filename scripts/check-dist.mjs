import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const required = ['index.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'guide/index.html'];
for (const file of required) await stat(join('dist', file));
const assets = await readdir(join('dist', 'assets'));
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
