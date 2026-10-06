// 配信後の本番サイトを確認する。CIの`smoke`ジョブと手元の`npm run check:live`から使う。
//   node scripts/check-live-site.mjs [--dist <配信したdist>] [--origin <URL>] [--attempts <回数>]
// `--dist`を渡すと、本番のHTMLがその配信物と一致するまで待つ（このコミットが公開されたことの確認）。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    dist: { type: 'string' },
    origin: { type: 'string', default: 'https://knittingeditor.com' },
    attempts: { type: 'string', default: '10' },
    interval: { type: 'string', default: '30' },
  },
});
const origin = values.origin.replace(/\/$/, '');
const attempts = Number(values.attempts);
const intervalMs = Number(values.interval) * 1000;
if (!origin.startsWith('https://')) throw new Error(`本番URLはHTTPSで指定してください: ${origin}`);

const files = [
  { path: '/', type: 'text/html', distFile: 'index.html' },
  { path: '/guide/', type: 'text/html', distFile: 'guide/index.html' },
  { path: '/support/', type: 'text/html', distFile: 'support/index.html' },
  { path: '/third-party-notices/', type: 'text/html', distFile: 'third-party-notices/index.html' },
  { path: '/favicon.ico', type: 'image/vnd.microsoft.icon' },
  { path: '/icon-192.png', type: 'image/png' },
  { path: '/apple-touch-icon.png', type: 'image/png' },
  { path: '/og-image.png', type: 'image/png' },
  { path: '/robots.txt', type: 'text/plain' },
  { path: '/sitemap.xml', type: 'application/xml' },
  { path: '/CNAME', text: 'knittingeditor.com' },
];

// GitHub PagesのCDNは応答を最大10分キャッシュするため、毎回異なるクエリで最新を取りに行く。
async function get(path) {
  const url = `${origin}${path}${path.includes('?') ? '&' : '?'}smoke=${Date.now()}`;
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' }, redirect: 'manual' });
  return { response, body: Buffer.from(await response.arrayBuffer()) };
}

async function checkOnce() {
  const problems = [];
  for (const file of files) {
    const { response, body } = await get(file.path);
    if (response.status !== 200) {
      problems.push(`${file.path}: HTTP ${response.status}`);
      continue;
    }
    const type = response.headers.get('content-type') ?? '';
    if (file.type && !type.startsWith(file.type)) problems.push(`${file.path}: content-type ${type}`);
    if (file.text && body.toString('utf8').trim() !== file.text) problems.push(`${file.path}: 内容が${file.text}ではありません`);
    if (file.distFile && values.dist) {
      const expected = await readFile(join(values.dist, file.distFile));
      if (!body.equals(expected)) problems.push(`${file.path}: 配信物の${file.distFile}と一致しません`);
    }
    if (file.path === '/') {
      // HTMLが参照するビルド資産（ハッシュ付きのJS・CSS）がすべて取れること。
      const assets = [...body.toString('utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
      if (assets.length === 0) problems.push('/: /assets/ への参照がありません');
      for (const asset of new Set(assets)) {
        const { response: assetResponse } = await get(asset);
        if (assetResponse.status !== 200) problems.push(`${asset}: HTTP ${assetResponse.status}`);
      }
    }
  }
  // HTTPでのアクセスはHTTPSへ転送されること。
  const insecure = await fetch(origin.replace('https://', 'http://') + '/', { redirect: 'manual' });
  const location = insecure.headers.get('location') ?? '';
  if (insecure.status < 300 || insecure.status >= 400 || !location.startsWith(`${origin}/`)) {
    problems.push(`http:// が ${origin}/ へ転送されません（HTTP ${insecure.status} ${location}）`);
  }
  return problems;
}

for (let attempt = 1; ; attempt++) {
  let problems;
  try {
    problems = await checkOnce();
  } catch (error) {
    problems = [`取得に失敗しました: ${error.message}`];
  }
  if (problems.length === 0) {
    console.log(`live site verified: ${origin}${values.dist ? ` matches ${values.dist}` : ''}`);
    break;
  }
  console.log(`attempt ${attempt}/${attempts}:\n  ${problems.join('\n  ')}`);
  if (attempt >= attempts) {
    console.error('本番サイトの確認に失敗しました');
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
