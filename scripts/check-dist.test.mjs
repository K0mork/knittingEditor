// @vitest-environment node
// `check-dist.mjs`はmain()を直接実行しない（dist/を作るのはビルド）。ここではmanifestの検査だけを確かめる。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyWebAppManifest } from './check-dist.mjs';

describe('verifyWebAppManifest', () => {
  it('accepts the manifest in the repository', async () => {
    const manifest = await readFile(join('public', 'manifest.webmanifest'), 'utf8');
    expect(verifyWebAppManifest(manifest)).toBeUndefined();
  });

  it('reports a manifest that is not JSON', () => {
    expect(verifyWebAppManifest('name=棒針編み図エディタ')).toBe('manifest.webmanifest がJSONではありません');
  });

  it.each([
    ['name', '別の名前'],
    ['short_name', '別の名前'],
    ['lang', 'en'],
    ['start_url', '/guide/'],
    ['scope', '/guide/'],
    ['display', 'browser'],
    ['theme_color', '#000000'],
    ['background_color', '#000000'],
  ])('reports a changed %s', (key, value) => {
    const manifest = { name: '棒針編み図エディタ', short_name: '棒針編み図エディタ', lang: 'ja', start_url: '/', scope: '/', display: 'standalone', theme_color: '#3d7a4a', background_color: '#f3f0e8', icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ] };
    const changed = { ...manifest, [key]: value };
    expect(verifyWebAppManifest(JSON.stringify(changed))).toBe(`manifest.webmanifestの${key}が想定と違います`);
  });

  it.each([
    ['a missing icon', (icons) => icons.slice(0, 2)],
    ['an icon with the wrong size', (icons) => [...icons.slice(0, 1), { ...icons[1], sizes: '256x256' }, icons[2]]],
    ['an icon without the maskable purpose', (icons) => [...icons.slice(0, 2), { ...icons[2], purpose: 'any' }]],
    ['an icon pointing elsewhere', (icons) => [{ ...icons[0], src: '/icon.png' }, icons[1], icons[2]]],
  ])('reports %s', (_, edit) => {
    const icons = [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
    const manifest = { name: '棒針編み図エディタ', short_name: '棒針編み図エディタ', lang: 'ja', start_url: '/', scope: '/', display: 'standalone', theme_color: '#3d7a4a', background_color: '#f3f0e8', icons: edit(icons) };
    expect(verifyWebAppManifest(JSON.stringify(manifest))).toBe('manifest.webmanifestのiconsが想定と違います');
  });
});
