// @vitest-environment node
// 本番サイトには接続しない。fetchを差し替えたスタブと、127.0.0.1のローカルサーバーだけを使う。
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { checkLiveSite, fetchWithTimeout, LIVE_SITE_FILES, parseLiveSiteOptions, REQUEST_TIMEOUT_MS } from './check-live-site.mjs';

const ORIGIN = 'https://knittingeditor.com';
const SCRIPT = join(import.meta.dirname, 'check-live-site.mjs');

describe('parseLiveSiteOptions', () => {
  it('uses the production origin, 10 attempts and a 30 second interval by default', () => {
    expect(parseLiveSiteOptions([])).toEqual({ dist: undefined, origin: ORIGIN, attempts: 10, intervalMs: 30_000 });
  });

  it('reads the options and drops a trailing slash from the origin', () => {
    expect(parseLiveSiteOptions(['--dist', 'out', '--origin', 'https://example.test/', '--attempts', '3', '--interval', '0.5'])).toEqual({
      dist: 'out',
      origin: 'https://example.test',
      attempts: 3,
      intervalMs: 500,
    });
    expect(parseLiveSiteOptions(['--interval', '0']).intervalMs).toBe(0);
  });

  it.each(['bad', '', '0', '-1', '1.5', '1e1', 'Infinity', 'NaN', ' 2', '99999999999999999999'])('rejects --attempts %j before checking', (value) => {
    expect(() => parseLiveSiteOptions(['--attempts', value])).toThrow('--attempts');
  });

  it.each(['bad', '', ' ', '-1', 'Infinity', 'NaN', '2147484'])('rejects --interval %j before checking', (value) => {
    expect(() => parseLiveSiteOptions(['--interval', value])).toThrow('--interval');
  });

  it('rejects an origin without HTTPS and unknown options', () => {
    expect(() => parseLiveSiteOptions(['--origin', 'http://knittingeditor.com'])).toThrow('HTTPS');
    expect(() => parseLiveSiteOptions(['--attempt', '3'])).toThrow();
  });
});

/** 配信物と同じ内容を返す本番サイトのスタブ。 */
function fakeSite({ html = '<script src="/assets/index-abc.js"></script>', overrides = {} } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const { protocol, pathname } = new URL(url);
    if (protocol === 'http:') return new Response(null, { status: 301, headers: { location: `${ORIGIN}/` } });
    if (overrides[pathname]) return overrides[pathname]();
    if (pathname.startsWith('/assets/')) return new Response('asset', { headers: { 'content-type': 'text/javascript' } });
    const file = LIVE_SITE_FILES.find((candidate) => candidate.path === pathname);
    if (!file) return new Response('not found', { status: 404 });
    const body = file.text ?? (file.type === 'text/html' ? html : `body of ${pathname}`);
    return new Response(body, { headers: { 'content-type': file.type ?? 'text/plain' } });
  };
  return { fetch, calls };
}

function recorder() {
  const lines = { log: [], error: [], sleeps: [] };
  return {
    lines,
    deps: {
      log: (line) => lines.log.push(line),
      error: (line) => lines.error.push(line),
      sleep: async (ms) => {
        lines.sleeps.push(ms);
      },
    },
  };
}

describe('checkLiveSite', () => {
  const temporaryDirectories = [];
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('verifies every file, the referenced assets and the HTTPS redirect in one attempt', async () => {
    const site = fakeSite();
    const { lines, deps } = recorder();
    await expect(checkLiveSite({ origin: ORIGIN, attempts: 3, intervalMs: 1000 }, { ...deps, fetch: site.fetch })).resolves.toBe(true);
    const paths = site.calls.map(({ url }) => new URL(url).pathname);
    expect(paths).toEqual([...LIVE_SITE_FILES.map((file) => file.path).slice(0, 1), '/assets/index-abc.js', ...LIVE_SITE_FILES.slice(1).map((file) => file.path), '/']);
    expect(site.calls.at(-1).url).toBe('http://knittingeditor.com/');
    for (const { init } of site.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(lines.log).toEqual([`live site verified: ${ORIGIN}`]);
    expect(lines.sleeps).toEqual([]);
  });

  it('waits until the HTML matches the deployed dist', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'check-live-site-'));
    temporaryDirectories.push(dist);
    const html = '<script src="/assets/index-new.js"></script>';
    for (const file of LIVE_SITE_FILES.filter((candidate) => candidate.distFile)) {
      mkdirSync(dirname(join(dist, file.distFile)), { recursive: true });
      writeFileSync(join(dist, file.distFile), file.type === 'text/html' ? html : `body of ${file.path}`);
    }
    let attempt = 0;
    const oldSite = fakeSite({ html: '<script src="/assets/index-old.js"></script>' });
    const newSite = fakeSite({ html });
    const fetch = (url, init) => {
      if (new URL(url).pathname === '/') attempt += 1;
      return (attempt <= 1 ? oldSite : newSite).fetch(url, init);
    };
    const { lines, deps } = recorder();
    await expect(checkLiveSite({ origin: ORIGIN, dist, attempts: 3, intervalMs: 5000 }, { ...deps, fetch })).resolves.toBe(true);
    expect(lines.log[0]).toContain('attempt 1/3:');
    expect(lines.log[0]).toContain('/: 配信物のindex.htmlと一致しません');
    expect(lines.log.at(-1)).toBe(`live site verified: ${ORIGIN} matches ${dist}`);
    expect(lines.sleeps).toEqual([5000]);
  });

  it('reports problems and stops after the given number of attempts', async () => {
    const site = fakeSite({
      overrides: {
        '/CNAME': () => new Response('example.com'),
        '/robots.txt': () => new Response('gone', { status: 404 }),
      },
    });
    const { lines, deps } = recorder();
    await expect(checkLiveSite({ origin: ORIGIN, attempts: 2, intervalMs: 1000 }, { ...deps, fetch: site.fetch })).resolves.toBe(false);
    expect(lines.log).toHaveLength(2);
    expect(lines.log[1]).toContain('attempt 2/2:');
    expect(lines.log[1]).toContain('/robots.txt: HTTP 404');
    expect(lines.log[1]).toContain('/CNAME: 内容がknittingeditor.comではありません');
    expect(lines.error).toEqual(['本番サイトの確認に失敗しました']);
    expect(lines.sleeps).toEqual([1000]);
  });

  it('retries failed requests only up to the given number of attempts', async () => {
    let requests = 0;
    const fetch = async () => {
      requests += 1;
      throw new Error('offline');
    };
    const { lines, deps } = recorder();
    await expect(checkLiveSite({ origin: ORIGIN, attempts: 3, intervalMs: 0 }, { ...deps, fetch })).resolves.toBe(false);
    expect(requests).toBe(3);
    expect(lines.log).toEqual(['attempt 1/3:\n  取得に失敗しました: offline', 'attempt 2/3:\n  取得に失敗しました: offline', 'attempt 3/3:\n  取得に失敗しました: offline']);
    expect(lines.sleeps).toEqual([0, 0]);
  });

  it('gives up a stalled request after the timeout and moves on to the next attempt', async () => {
    let requests = 0;
    const fetch = (url, init) => {
      requests += 1;
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    };
    const { lines, deps } = recorder();
    await expect(checkLiveSite({ origin: ORIGIN, attempts: 2, intervalMs: 0 }, { ...deps, fetch, requestTimeoutMs: 20 })).resolves.toBe(false);
    expect(requests).toBe(2);
    expect(lines.log[0]).toMatch(/^attempt 1\/2:\n {2}取得に失敗しました: .*timeout/);
  });
});

describe('fetchWithTimeout', () => {
  let server;
  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise((done) => (server ? server.close(done) : done()));
    server = undefined;
  });

  async function listen(handler) {
    server = createServer(handler);
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    return `http://127.0.0.1:${server.address().port}/`;
  }

  it('reads the whole body', async () => {
    const url = await listen((request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('knitting');
      setTimeout(() => response.end('editor'), 20);
    });
    const { response, body } = await fetchWithTimeout(url, {}, { timeoutMs: 2000 });
    expect(response.status).toBe(200);
    expect(body.toString('utf8')).toBe('knittingeditor');
  });

  it('aborts a body that stops arriving after the headers', async () => {
    const url = await listen((request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('partial');
    });
    const started = Date.now();
    await expect(fetchWithTimeout(url, {}, { timeoutMs: 100 })).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('defaults to a timeout of 30 seconds', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});

describe('command line', () => {
  it.each([
    [['--attempts', 'bad'], '--attempts'],
    [['--attempts', '0'], '--attempts'],
    [['--interval', '-1'], '--interval'],
    [['--origin', 'http://knittingeditor.com'], 'HTTPS'],
  ])('exits with an error before any request for %j', async (args, message) => {
    // 検証で止まらなければ本番へ接続してしまうため、fetchを失敗させる前処理を入れて確かめる。
    const guard = 'data:text/javascript,globalThis.fetch=()=>{console.error("unexpected fetch");process.exit(99)}';
    const run = promisify(execFile)(process.execPath, ['--import', guard, SCRIPT, ...args]);
    const failure = await run.then(() => null, (error) => error);
    expect(failure?.code).toBe(1);
    expect(failure.stderr).toContain(message);
    expect(failure.stderr).not.toContain('unexpected fetch');
  });
});
