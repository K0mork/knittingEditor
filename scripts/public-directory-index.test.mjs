// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

let server;
let origin;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
});
afterAll(async () => { await server?.close(); });

test.each(['guide', 'support', 'privacy'])('serves public/%s/index.html for directory URLs', async (directory) => {
  const expected = await readFile(`public/${directory}/index.html`, 'utf8');
  for (const suffix of ['/', '/?from=editor', '/index.html']) {
    const response = await fetch(`${origin}/${directory}${suffix}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe(expected);
  }
  const head = await fetch(`${origin}/${directory}/`, { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
});

test('preserves editor fallback and static assets', async () => {
  for (const path of ['/', '/missing-directory/']) {
    const response = await fetch(`${origin}${path}`);
    expect(await response.text()).toContain('/@vite/client');
  }
  const asset = await fetch(`${origin}/robots.txt`);
  expect(await asset.text()).toBe(await readFile('public/robots.txt', 'utf8'));
});
