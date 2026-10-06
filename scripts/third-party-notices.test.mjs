import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packageRootOf, readPackageNotice, renderNoticesHtml } from './third-party-notices.mjs';

describe('packageRootOf', () => {
  it('returns the package root for plain and scoped packages', () => {
    expect(packageRootOf('/repo/node_modules/react/cjs/react.production.js')).toBe('/repo/node_modules/react');
    expect(packageRootOf('/repo/node_modules/@scope/pkg/dist/index.js?commonjs-es-import')).toBe('/repo/node_modules/@scope/pkg');
    expect(packageRootOf('\0/repo/node_modules/a/node_modules/b/index.js')).toBe('/repo/node_modules/a/node_modules/b');
    expect(packageRootOf('C:\\repo\\node_modules\\idb\\build\\index.js')).toBe('C:/repo/node_modules/idb');
  });

  it('ignores our own sources and virtual modules', () => {
    expect(packageRootOf('/repo/packages/editor-core/model/Board.ts')).toBeUndefined();
    expect(packageRootOf('\0vite/preload-helper.js')).toBeUndefined();
    expect(packageRootOf('/repo/node_modules/@scope')).toBeUndefined();
  });
});

describe('readPackageNotice', () => {
  let directory;
  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('reads the name, version, license, and license text', () => {
    directory = mkdtempSync(join(tmpdir(), 'notice-'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.2.3', license: 'MIT' }));
    writeFileSync(join(directory, 'LICENSE.md'), '\nCopyright (c) Someone\n');
    expect(readPackageNotice(directory)).toEqual({ name: 'pkg', version: '1.2.3', license: 'MIT', text: 'Copyright (c) Someone' });
  });

  it('fails the build when the license text is missing', () => {
    directory = mkdtempSync(join(tmpdir(), 'notice-'));
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.2.3', license: 'MIT' }));
    expect(() => readPackageNotice(directory)).toThrow(/ライセンス文/);
  });
});

describe('renderNoticesHtml', () => {
  it('sorts packages by name and escapes the license text', () => {
    const html = renderNoticesHtml([
      { name: 'zeta', version: '1.0.0', license: 'ISC', text: 'Copyright <z> & "co"' },
      { name: 'alpha', version: '2.0.0', license: 'MIT', text: 'Copyright alpha' },
    ]);
    expect(html.indexOf('<h2>alpha 2.0.0</h2>')).toBeLessThan(html.indexOf('<h2>zeta 1.0.0</h2>'));
    expect(html).toContain('<pre>Copyright &lt;z&gt; &amp; &quot;co&quot;</pre>');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });
});
