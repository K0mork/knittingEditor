// 配信後の本番サイトを確認する。CIの`smoke`ジョブと手元の`npm run check:live`から使う。
//   node scripts/check-live-site.mjs [--dist <配信したdist>] [--origin <URL>] [--attempts <回数>] [--interval <秒>]
// `--dist`を渡すと、本番のHTMLがその配信物と一致するまで待つ（このコミットが公開されたことの確認）。
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// 1回の取得（応答の本文を読み終えるまで）の上限。止まった取得はこの時間で失敗にして次の試行へ回す。
export const REQUEST_TIMEOUT_MS = 30_000;
// setTimeoutが扱える最大の待ち時間。これより長いと待たずにすぐ実行されてしまう。
const MAX_INTERVAL_MS = 2 ** 31 - 1;

export const LIVE_SITE_FILES = [
  { path: '/', type: 'text/html', distFile: 'index.html' },
  { path: '/guide/', type: 'text/html', distFile: 'guide/index.html' },
  { path: '/support/', type: 'text/html', distFile: 'support/index.html' },
  { path: '/privacy/', type: 'text/html', distFile: 'privacy/index.html' },
  { path: '/privacy/app/', type: 'text/html', distFile: 'privacy/app/index.html' },
  { path: '/third-party-notices/', type: 'text/html', distFile: 'third-party-notices/index.html' },
  { path: '/favicon.ico', type: 'image/vnd.microsoft.icon' },
  { path: '/icon-192.png', type: 'image/png' },
  { path: '/apple-touch-icon.png', type: 'image/png' },
  { path: '/og-image.png', type: 'image/png' },
  { path: '/robots.txt', type: 'text/plain' },
  { path: '/sitemap.xml', type: 'application/xml' },
  { path: '/llms.txt', type: 'text/plain', distFile: 'llms.txt' },
  { path: '/CNAME', text: 'knittingeditor.com' },
];

/** コマンドライン引数を読み、確認を始める前に値を検証する。不正な値ならErrorを投げる。 */
export function parseLiveSiteOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      dist: { type: 'string' },
      origin: { type: 'string', default: 'https://knittingeditor.com' },
      attempts: { type: 'string', default: '10' },
      interval: { type: 'string', default: '30' },
    },
  });
  const origin = values.origin.replace(/\/$/, '');
  if (!origin.startsWith('https://')) throw new Error(`本番URLはHTTPSで指定してください: ${origin}`);
  const attempts = /^\d+$/.test(values.attempts) ? Number(values.attempts) : Number.NaN;
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new Error(`--attempts には1以上の整数を指定してください: ${values.attempts}`);
  }
  const interval = values.interval.trim() === '' ? Number.NaN : Number(values.interval);
  const intervalMs = interval * 1000;
  if (!Number.isFinite(interval) || interval < 0 || intervalMs > MAX_INTERVAL_MS) {
    throw new Error(`--interval には0以上の秒数（${Math.floor(MAX_INTERVAL_MS / 1000)}秒まで）を指定してください: ${values.interval}`);
  }
  return { dist: values.dist, origin, attempts, intervalMs };
}

/** 応答の本文まで読む。ヘッダーの取得から本文を読み終えるまでをtimeoutMsで打ち切る。 */
export async function fetchWithTimeout(url, init, { fetch: fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return { response, body: Buffer.from(await response.arrayBuffer()) };
}

/** 全ファイルを1回確認し、問題の一覧を返す（問題がなければ空）。 */
async function checkOnce({ origin, dist }, request) {
  // GitHub PagesのCDNは応答を最大10分キャッシュするため、毎回異なるクエリで最新を取りに行く。
  const get = (path) => request(`${origin}${path}${path.includes('?') ? '&' : '?'}smoke=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'manual',
  });
  const problems = [];
  for (const file of LIVE_SITE_FILES) {
    const { response, body } = await get(file.path);
    if (response.status !== 200) {
      problems.push(`${file.path}: HTTP ${response.status}`);
      continue;
    }
    const type = response.headers.get('content-type') ?? '';
    if (file.type && !type.startsWith(file.type)) problems.push(`${file.path}: content-type ${type}`);
    if (file.text && body.toString('utf8').trim() !== file.text) problems.push(`${file.path}: 内容が${file.text}ではありません`);
    if (file.distFile && dist) {
      const expected = await readFile(join(dist, file.distFile));
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
  const { response: insecure } = await request(origin.replace('https://', 'http://') + '/', { redirect: 'manual' });
  const location = insecure.headers.get('location') ?? '';
  if (insecure.status < 300 || insecure.status >= 400 || !location.startsWith(`${origin}/`)) {
    problems.push(`http:// が ${origin}/ へ転送されません（HTTP ${insecure.status} ${location}）`);
  }
  return problems;
}

/**
 * 本番サイトが確認できるまで、最大attempts回、intervalMsずつ待って試す。確認できたらtrue。
 * fetch・sleep・log・errorはテストで差し替える。
 */
export async function checkLiveSite(options, {
  fetch: fetchImpl = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  log = console.log,
  error = console.error,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const { origin, dist, attempts, intervalMs } = options;
  const request = (url, init) => fetchWithTimeout(url, init, { fetch: fetchImpl, timeoutMs: requestTimeoutMs });
  for (let attempt = 1; ; attempt++) {
    let problems;
    try {
      problems = await checkOnce({ origin, dist }, request);
    } catch (cause) {
      problems = [`取得に失敗しました: ${cause.message}`];
    }
    if (problems.length === 0) {
      log(`live site verified: ${origin}${dist ? ` matches ${dist}` : ''}`);
      return true;
    }
    log(`attempt ${attempt}/${attempts}:\n  ${problems.join('\n  ')}`);
    if (attempt >= attempts) {
      error('本番サイトの確認に失敗しました');
      return false;
    }
    await sleep(intervalMs);
  }
}

async function main() {
  let options;
  try {
    options = parseLiveSiteOptions(process.argv.slice(2));
  } catch (cause) {
    console.error(cause.message);
    process.exitCode = 1;
    return;
  }
  if (!(await checkLiveSite(options))) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
