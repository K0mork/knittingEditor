// @vitest-environment node
// 本番サイトには接続しない。fetchを差し替えたスタブと、一時ディレクトリのdistだけを使う。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSET_HISTORY_FILE, parseAssetHistory } from './asset-history.mjs';
import { MAX_PREVIOUS_GENERATIONS, parseRetainOptions, retainPreviousAssets, RETENTION_DAYS, selectRetainedGenerations } from './retain-previous-assets.mjs';

const ORIGIN = 'https://knittingeditor.com';
const NOW = Date.parse('2026-10-29T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const generation = (commit, daysAgo, files) => ({ commit, deployedAt: daysAgo === null ? null : at(daysAgo), files });

describe('parseAssetHistory', () => {
  it('accepts a list of generations, with unknown commit and date for versions before the list existed', () => {
    const history = { version: 1, generations: [generation('b', 0, ['index-b.js']), generation(null, null, ['index-a.js', 'pdf.worker-a.js'])] };
    expect(parseAssetHistory(JSON.stringify(history))).toEqual(history);
  });

  it.each([
    ['another version', { version: 2, generations: [generation('a', 0, ['index-a.js'])] }, '形式'],
    ['no generations', { version: 1, generations: [] }, '形式'],
    ['no files', { version: 1, generations: [generation('a', 0, [])] }, 'files'],
    ['a source map', { version: 1, generations: [generation('a', 0, ['index-a.js.map'])] }, 'ファイル名'],
    ['a path outside assets', { version: 1, generations: [generation('a', 0, ['../index.html'])] }, 'ファイル名'],
    ['a subdirectory', { version: 1, generations: [generation('a', 0, ['sub/index-a.js'])] }, 'ファイル名'],
    ['a dot file', { version: 1, generations: [generation('a', 0, ['.hidden'])] }, 'ファイル名'],
    ['a broken date', { version: 1, generations: [{ commit: 'a', deployedAt: 'yesterday', files: ['index-a.js'] }] }, 'deployedAt'],
    ['a numeric commit', { version: 1, generations: [{ commit: 1, deployedAt: null, files: ['index-a.js'] }] }, 'commit'],
  ])('rejects %s', (_, history, message) => {
    expect(() => parseAssetHistory(JSON.stringify(history))).toThrow(message);
  });
});

describe('selectRetainedGenerations', () => {
  const current = ['index-new.js', 'pdf.worker-a.js'];

  it('always keeps the version being replaced, however old it is', () => {
    const previous = generation('a', 400, ['index-a.js', 'pdf.worker-a.js']);
    expect(selectRetainedGenerations([previous], current, NOW)).toEqual([{ generation: previous, required: true }]);
  });

  it(`keeps older versions replaced within ${RETENTION_DAYS} days and stops at the first one replaced earlier`, () => {
    const generations = [
      generation('d', 1, ['index-d.js']),
      generation('c', RETENTION_DAYS, ['index-c.js']), // dに置き換わったのは1日前
      generation('b', 40, ['index-b.js']), // cに置き換わったのはちょうど30日前
      generation('a', 50, ['index-a.js']), // bに置き換わったのは40日前
    ];
    expect(selectRetainedGenerations(generations, current, NOW).map(({ generation: { commit }, required }) => [commit, required])).toEqual([
      ['d', true],
      ['c', false],
      ['b', false],
    ]);
  });

  it('stops when the date the version was replaced is unknown', () => {
    const generations = [generation(null, null, ['index-b.js']), generation('a', 1, ['index-a.js'])];
    expect(selectRetainedGenerations(generations, current, NOW).map(({ generation: { files } }) => files)).toEqual([['index-b.js']]);
  });

  it(`keeps at most ${MAX_PREVIOUS_GENERATIONS} previous versions`, () => {
    const generations = Array.from({ length: 15 }, (_, index) => generation(String(index), index, [`index-${index}.js`]));
    const selected = selectRetainedGenerations(generations, current, NOW);
    expect(selected).toHaveLength(MAX_PREVIOUS_GENERATIONS);
    expect(selected.at(-1).generation.commit).toBe(String(MAX_PREVIOUS_GENERATIONS - 1));
  });

  it('skips versions whose files are all in the new build and treats the next one as the version being replaced', () => {
    const redeployed = generation('same', 0, current);
    const previous = generation('a', 100, ['index-a.js', 'pdf.worker-a.js']);
    expect(selectRetainedGenerations([redeployed, previous], current, NOW)).toEqual([{ generation: previous, required: true }]);
  });
});

describe('parseRetainOptions', () => {
  it('uses dist, the production origin, the commit of the workflow run, 3 attempts and a 10 second interval by default', () => {
    expect(parseRetainOptions([], { GITHUB_SHA: 'abc' })).toEqual({ dist: 'dist', origin: ORIGIN, commit: 'abc', attempts: 3, intervalMs: 10_000 });
    expect(parseRetainOptions([], {}).commit).toBeNull();
  });

  it('reads the options', () => {
    expect(parseRetainOptions(['--dist', 'out', '--origin', 'https://example.test/', '--commit', 'def', '--attempts', '5', '--interval', '0.5'], {})).toEqual({
      dist: 'out',
      origin: 'https://example.test',
      commit: 'def',
      attempts: 5,
      intervalMs: 500,
    });
  });

  it.each([
    [['--origin', 'http://knittingeditor.com'], 'HTTPS'],
    [['--attempts', '0'], '--attempts'],
    [['--attempts', '21'], '--attempts'],
    [['--interval', '-1'], '--interval'],
    [['--interval', 'soon'], '--interval'],
    [['--interval', '601'], '--interval'],
  ])('rejects %j', (args, message) => {
    expect(() => parseRetainOptions(args, {})).toThrow(message);
  });
});

/** 本番サイトのスタブ。pathsに無いパスは404を返す。値が関数なら呼び出した結果を返す。 */
function fakeSite(paths) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const { pathname } = new URL(url);
    const entry = paths[pathname];
    if (entry === undefined) return new Response('not found', { status: 404 });
    return typeof entry === 'function' ? entry() : new Response(entry);
  };
  return { fetch, calls, paths: () => calls.map(({ url }) => new URL(url).pathname) };
}

function recorder() {
  const lines = { log: [], warn: [], sleeps: [] };
  return {
    lines,
    deps: {
      log: (line) => lines.log.push(line),
      warn: (line) => lines.warn.push(line),
      sleep: async (ms) => {
        lines.sleeps.push(ms);
      },
      now: NOW,
    },
  };
}

describe('retainPreviousAssets', () => {
  const temporaryDirectories = [];
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  /** 新しい版をビルドしたあとのdist。 */
  function builtDist(files = ['index-new.js', 'index-new.js.map', 'index-new.css', 'pdf.worker-a.js']) {
    const dist = mkdtempSync(join(tmpdir(), 'retain-previous-assets-'));
    temporaryDirectories.push(dist);
    mkdirSync(join(dist, 'assets'));
    for (const file of files) writeFileSync(join(dist, 'assets', file), `new ${file}`);
    writeFileSync(join(dist, 'index.html'), '<script src="/assets/index-new.js"></script>');
    return dist;
  }
  const options = (dist) => ({ dist, origin: ORIGIN, commit: 'new', attempts: 2, intervalMs: 1000 });
  const history = (...generations) => JSON.stringify({ version: 1, generations });
  const readHistory = (dist) => parseAssetHistory(readFileSync(join(dist, ASSET_HISTORY_FILE), 'utf8'));

  it('adds the files of the previous versions and writes the list with the new version first', async () => {
    const dist = builtDist();
    const site = fakeSite({
      [`/${ASSET_HISTORY_FILE}`]: history(generation('b', 3, ['index-b.js', 'index-new.css', 'pdf.worker-a.js']), generation('a', 10, ['index-a.js', 'index-a.css', 'pdf.worker-a.js'])),
      '/assets/index-b.js': 'old index-b.js',
      '/assets/index-a.js': 'old index-a.js',
      '/assets/index-a.css': 'old index-a.css',
    });
    const { lines, deps } = recorder();
    const written = await retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch });

    expect(readdirSync(join(dist, 'assets')).sort()).toEqual(['index-a.css', 'index-a.js', 'index-b.js', 'index-new.css', 'index-new.js', 'index-new.js.map', 'pdf.worker-a.js']);
    expect(readFileSync(join(dist, 'assets', 'index-b.js'), 'utf8')).toBe('old index-b.js');
    // 新しい版と同じ名前のファイルは、ビルドしたものをそのまま使い、本番からは取らない。
    expect(readFileSync(join(dist, 'assets', 'pdf.worker-a.js'), 'utf8')).toBe('new pdf.worker-a.js');
    expect(site.paths()).toEqual([`/${ASSET_HISTORY_FILE}`, '/assets/index-b.js', '/assets/index-a.js', '/assets/index-a.css']);
    for (const { url, init } of site.calls) {
      expect(url).toMatch(/\?retain=\d+$/);
      expect(init.headers).toEqual({ 'cache-control': 'no-cache' });
    }
    expect(readHistory(dist)).toEqual(written);
    expect(written.generations.map(({ commit }) => commit)).toEqual(['new', 'b', 'a']);
    expect(written.generations[0]).toEqual({ commit: 'new', deployedAt: new Date(NOW).toISOString(), files: ['index-new.css', 'index-new.js', 'pdf.worker-a.js'] });
    expect(lines.log.at(-1)).toBe(`retained 2 previous version(s), 3 file(s) from ${ORIGIN}`);
    expect(lines.warn).toEqual([]);
  });

  it('collects the files of the live version from the pages and scripts when the site has no list yet', async () => {
    const dist = builtDist();
    const site = fakeSite({
      '/': () => new Response('<link rel="stylesheet" href="/assets/index-old.css"><script type="module" src="/assets/index-old.js"></script>', {
        headers: { 'last-modified': 'Mon, 26 Oct 2026 02:54:44 GMT' },
      }),
      '/guide/': '<link rel="stylesheet" href="/assets/index-old.css">',
      '/support/': '',
      '/privacy/': '',
      '/privacy/app/': '',
      '/third-party-notices/': '',
      '/assets/index-old.js': 'var a=`/assets/pdf.worker-old.js`;import("./chunk-old.js");//# sourceMappingURL=index-old.js.map',
      '/assets/index-old.css': 'body{background:url(/assets/paper-old.png)}',
      '/assets/pdf.worker-old.js': 'worker',
      '/assets/chunk-old.js': 'chunk',
      '/assets/paper-old.png': 'png',
    });
    const { lines, deps } = recorder();
    const written = await retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch });

    expect(written.generations[1]).toEqual({
      commit: null,
      deployedAt: '2026-10-26T02:54:44.000Z',
      files: ['chunk-old.js', 'index-old.css', 'index-old.js', 'paper-old.png', 'pdf.worker-old.js'],
    });
    // 参照をたどるときに取った内容をそのまま書き、取り直さない。ソースマップは取らない。
    expect(site.paths().filter((path) => path.startsWith('/assets/')).sort()).toEqual(written.generations[1].files.map((file) => `/assets/${file}`));
    expect(readFileSync(join(dist, 'assets', 'pdf.worker-old.js'), 'utf8')).toBe('worker');
    expect(readFileSync(join(dist, 'assets', 'paper-old.png'), 'utf8')).toBe('png');
    expect(lines.log[0]).toContain('HTMLからたどって集めます');
  });

  it('stops the deployment when a file of the version being replaced cannot be fetched', async () => {
    const dist = builtDist();
    const site = fakeSite({
      [`/${ASSET_HISTORY_FILE}`]: history(generation('b', 3, ['index-b.js', 'pdf.worker-b.js'])),
      '/assets/index-b.js': 'old index-b.js',
    });
    const { lines, deps } = recorder();
    await expect(retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch })).rejects.toThrow('直前の版 b');
    expect(site.paths().filter((path) => path === '/assets/pdf.worker-b.js')).toHaveLength(2);
    expect(lines.sleeps).toEqual([1000]);
    expect(existsSync(join(dist, ASSET_HISTORY_FILE))).toBe(false);
    expect(existsSync(join(dist, 'assets', 'index-b.js'))).toBe(false);
  });

  it('drops an older version whose files cannot be fetched and keeps the others', async () => {
    const dist = builtDist();
    const site = fakeSite({
      [`/${ASSET_HISTORY_FILE}`]: history(generation('c', 1, ['index-c.js']), generation('b', 2, ['index-b.js', 'pdf.worker-b.js']), generation('a', 3, ['index-a.js'])),
      '/assets/index-c.js': 'c',
      '/assets/index-b.js': 'b',
      '/assets/pdf.worker-b.js': () => new Response('unavailable', { status: 503 }),
      '/assets/index-a.js': 'a',
    });
    const { lines, deps } = recorder();
    const written = await retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch });
    expect(written.generations.map(({ commit }) => commit)).toEqual(['new', 'c', 'a']);
    expect(existsSync(join(dist, 'assets', 'index-b.js'))).toBe(false);
    expect(lines.warn).toEqual([expect.stringContaining('前の版 b')]);
    expect(lines.warn[0]).toContain('/assets/pdf.worker-b.js: HTTP 503');
  });

  it('retries the list and stops the deployment when the site does not return it', async () => {
    const dist = builtDist();
    const site = fakeSite({ [`/${ASSET_HISTORY_FILE}`]: () => new Response('error', { status: 500 }) });
    const { lines, deps } = recorder();
    await expect(retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch })).rejects.toThrow(`/${ASSET_HISTORY_FILE}: HTTP 500`);
    expect(site.paths()).toEqual([`/${ASSET_HISTORY_FILE}`, `/${ASSET_HISTORY_FILE}`]);
    expect(lines.sleeps).toEqual([1000]);
  });

  it('stops the deployment when the list on the site is broken', async () => {
    const dist = builtDist();
    const site = fakeSite({ [`/${ASSET_HISTORY_FILE}`]: '{"version":1,"generations":[]}' });
    const { deps } = recorder();
    await expect(retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch })).rejects.toThrow('形式');
  });

  it('refuses a dist that already has the list, before any request', async () => {
    const dist = builtDist();
    writeFileSync(join(dist, ASSET_HISTORY_FILE), '{}');
    const site = fakeSite({});
    const { deps } = recorder();
    await expect(retainPreviousAssets(options(dist), { ...deps, fetch: site.fetch })).rejects.toThrow('既にあります');
    expect(site.calls).toEqual([]);
  });
});
