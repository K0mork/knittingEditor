// 配信のあとも、前の版の`/assets/`のファイルを本番に残す（#363）。
// Pagesへの配信は成果物全体を置き換えるため、配信の前から開いていたページが参照する古いJSやWorkerが消える。
// ビルドしたdistへ本番サイトから前の版のファイルを取って加え、残した版の一覧を`asset-history.json`に書く。
// CIの`web`ジョブが、E2E（distを作り直す）のあと、Pagesの成果物を作る前に実行する。
//   node scripts/retain-previous-assets.mjs [--dist <dist>] [--origin <URL>] [--commit <SHA>] [--attempts <回数>] [--interval <秒>]
import { access, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ASSET_HISTORY_FILE, isRetainedAsset, parseAssetHistory } from './asset-history.mjs';
import { fetchWithTimeout, LIVE_SITE_FILES } from './check-live-site.mjs';

// 新しい版に置き換わってから、この日数のあいだは前の版のファイルを残す。直前の版は日数によらず残す。
export const RETENTION_DAYS = 30;
// 残す前の版の数の上限。今回配信する版は含まない。
export const MAX_PREVIOUS_GENERATIONS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
// JSとCSSの中から、同じ版の別のファイルへの参照を拾う（Workerの`/assets/pdf.worker-*.js`や、CSSの`url(/assets/*)`など）。
const ASSET_REFERENCE = /(?:\/assets\/|["'`(]\.\/)([\w-][\w.-]*\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|wasm))(?![\w.-])/g;

/**
 * 本番の一覧（新しい順）から、今回の配信に残す前の版を選ぶ。
 * 今回の版にすべて含まれる版（同じコミットの配信し直しなど）は残す必要がないので飛ばす。
 * 最初に残る版は直前の版として日数によらず残し、必須にする。それより前の版は、
 * 次の版に置き換わってから`RETENTION_DAYS`日以内のものを、`MAX_PREVIOUS_GENERATIONS`まで残す。
 */
export function selectRetainedGenerations(generations, currentFiles, now) {
  const current = new Set(currentFiles);
  const selected = [];
  for (let index = 0; index < generations.length && selected.length < MAX_PREVIOUS_GENERATIONS; index++) {
    const generation = generations[index];
    if (generation.files.every((file) => current.has(file))) continue;
    if (selected.length > 0) {
      const replacedAt = Date.parse(generations[index - 1].deployedAt ?? '');
      if (!(now - replacedAt <= RETENTION_DAYS * DAY_MS)) break;
    }
    selected.push({ generation, required: selected.length === 0 });
  }
  return selected;
}

/**
 * 一覧がまだ無い本番（この仕組みを入れる前の版）から、HTMLとJS・CSSの参照をたどって
 * 配信中の版のファイルを集める。内容も返し、取り直さずにそのまま残す。
 */
export async function discoverLiveGeneration(get) {
  const queue = [];
  const contents = new Map();
  const enqueue = (name) => {
    if (isRetainedAsset(name) && !contents.has(name) && !queue.includes(name)) queue.push(name);
  };
  let deployedAt = null;
  for (const file of LIVE_SITE_FILES.filter((candidate) => candidate.type === 'text/html')) {
    const { response, body } = await get(file.path);
    if (response.status !== 200) throw new Error(`${file.path}: HTTP ${response.status}`);
    if (file.path === '/') {
      const lastModified = Date.parse(response.headers.get('last-modified') ?? '');
      if (!Number.isNaN(lastModified)) deployedAt = new Date(lastModified).toISOString();
    }
    for (const match of body.toString('utf8').matchAll(/(?:src|href)="\/assets\/([^"?#]+)"/g)) enqueue(match[1]);
  }
  if (queue.length === 0) throw new Error('本番のHTMLに /assets/ への参照がありません');
  while (queue.length > 0) {
    const name = queue.shift();
    const { response, body } = await get(`/assets/${name}`);
    if (response.status !== 200) throw new Error(`/assets/${name}: HTTP ${response.status}`);
    contents.set(name, body);
    if (/\.(?:m?js|css)$/.test(name)) {
      for (const match of body.toString('utf8').matchAll(ASSET_REFERENCE)) enqueue(match[1]);
    }
  }
  return { generation: { commit: null, deployedAt, files: [...contents.keys()].sort() }, contents };
}

/** fnを最大attempts回、intervalMsずつ待って試す。最後の失敗はそのまま投げる。 */
async function withRetries(label, fn, { attempts, intervalMs, sleep, log }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (cause) {
      if (attempt >= attempts) throw cause;
      log(`${label}: attempt ${attempt}/${attempts}: ${cause.message}`);
      await sleep(intervalMs);
    }
  }
}

export function parseRetainOptions(args, env = process.env) {
  const { values } = parseArgs({
    args,
    options: {
      dist: { type: 'string', default: 'dist' },
      origin: { type: 'string', default: 'https://knittingeditor.com' },
      commit: { type: 'string' },
      attempts: { type: 'string', default: '3' },
      interval: { type: 'string', default: '10' },
    },
  });
  const origin = values.origin.replace(/\/$/, '');
  if (!origin.startsWith('https://')) throw new Error(`本番URLはHTTPSで指定してください: ${origin}`);
  const attempts = /^\d+$/.test(values.attempts) ? Number(values.attempts) : Number.NaN;
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 20) {
    throw new Error(`--attempts には1から20の整数を指定してください: ${values.attempts}`);
  }
  const interval = /^\d+(?:\.\d+)?$/.test(values.interval) ? Number(values.interval) : Number.NaN;
  if (!(interval <= 600)) throw new Error(`--interval には0から600の秒数を指定してください: ${values.interval}`);
  return { dist: values.dist, origin, commit: values.commit ?? env.GITHUB_SHA ?? null, attempts, intervalMs: interval * 1000 };
}

/**
 * distへ前の版のファイルを加え、`asset-history.json`を書く。直前の版が取れなければErrorを投げ、
 * 配信を止める。それより前の版が取れなければ、警告してその版だけ外す。
 * fetch・sleep・log・warn・nowはテストで差し替える。
 */
export async function retainPreviousAssets(options, {
  fetch: fetchImpl = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  log = console.log,
  warn = console.warn,
  now = Date.now(),
} = {}) {
  const { dist, origin, commit, attempts, intervalMs } = options;
  const assetsDirectory = join(dist, 'assets');
  const historyPath = join(dist, ASSET_HISTORY_FILE);
  // 2回実行すると、1回目に加えた前の版のファイルを今回の版と取り違えるため、作り直したdistだけを受け付ける。
  if (await access(historyPath).then(() => true, () => false)) throw new Error(`${historyPath} が既にあります。ビルドし直してから実行してください`);
  const currentFiles = (await readdir(assetsDirectory)).filter(isRetainedAsset).sort();
  if (currentFiles.length === 0) throw new Error(`${assetsDirectory} にファイルがありません`);
  const retry = { attempts, intervalMs, sleep, log };
  // GitHub PagesのCDNは応答を最大10分キャッシュするため、毎回異なるクエリで最新を取りに行く。
  const get = (path) => fetchWithTimeout(`${origin}${path}?retain=${Date.now()}`, { headers: { 'cache-control': 'no-cache' }, redirect: 'manual' }, { fetch: fetchImpl });

  const fetched = new Map();
  let previous;
  await withRetries(`/${ASSET_HISTORY_FILE}`, async () => {
    const { response, body } = await get(`/${ASSET_HISTORY_FILE}`);
    if (response.status === 404) {
      log(`/${ASSET_HISTORY_FILE} が本番にないため、配信中の版のファイルをHTMLからたどって集めます`);
      const discovered = await discoverLiveGeneration(get);
      for (const [name, content] of discovered.contents) fetched.set(name, content);
      previous = [discovered.generation];
      return;
    }
    if (response.status !== 200) throw new Error(`/${ASSET_HISTORY_FILE}: HTTP ${response.status}`);
    previous = parseAssetHistory(body.toString('utf8')).generations;
  }, retry);

  const retained = [];
  for (const { generation, required } of selectRetainedGenerations(previous, currentFiles, now)) {
    const label = `${generation.commit ?? 'unknown'} (${generation.deployedAt ?? '配信日時不明'})`;
    try {
      const contents = new Map();
      for (const name of generation.files) {
        if (currentFiles.includes(name)) continue;
        const known = fetched.get(name);
        if (known) {
          contents.set(name, known);
          continue;
        }
        contents.set(name, await withRetries(`/assets/${name}`, async () => {
          const { response, body } = await get(`/assets/${name}`);
          if (response.status !== 200) throw new Error(`/assets/${name}: HTTP ${response.status}`);
          return body;
        }, retry));
      }
      for (const [name, content] of contents) fetched.set(name, content);
      retained.push(generation);
    } catch (cause) {
      if (required) throw new Error(`直前の版 ${label} のファイルを本番から取れません: ${cause.message}`, { cause });
      warn(`前の版 ${label} を残せないため外します: ${cause.message}`);
    }
  }

  const keep = new Set(retained.flatMap((generation) => generation.files).filter((name) => !currentFiles.includes(name)));
  for (const name of keep) await writeFile(join(assetsDirectory, name), fetched.get(name));
  const history = {
    version: 1,
    generations: [{ commit, deployedAt: new Date(now).toISOString(), files: currentFiles }, ...retained],
  };
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  log(`retained ${retained.length} previous version(s), ${keep.size} file(s) from ${origin}`);
  return history;
}

async function main() {
  try {
    await retainPreviousAssets(parseRetainOptions(process.argv.slice(2)));
  } catch (cause) {
    console.error(cause.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
