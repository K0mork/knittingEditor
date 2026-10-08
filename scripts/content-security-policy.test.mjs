import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyContentSecurityPolicy,
  contentSecurityPolicyFor,
  contentSecurityPolicyMetas,
  findInlineCode,
  styleHash,
  verifyContentSecurityPolicy,
} from './content-security-policy.mjs';

const page = (head, body = '<p>本文</p>') => `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>題名</title>
${head}
  </head>
  <body>${body}</body>
</html>
`;

describe('contentSecurityPolicyFor', () => {
  it('limits scripts, connections, workers, plugins, the base URL and forms', () => {
    const policy = contentSecurityPolicyFor(page(''));
    expect(policy.split('; ')).toEqual([
      "default-src 'self'",
      "script-src 'self' https://www.googletagmanager.com",
      "style-src 'self'",
      "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]);
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('frame-ancestors');
  });

  it('allows each <style> element by the hash of its exact text', () => {
    const css = '\n      body { margin: 0; }\n    ';
    const policy = contentSecurityPolicyFor(page(`    <style>${css}</style>\n    <style>${css}</style>`));
    const expected = `'sha256-${createHash('sha256').update(css).digest('base64')}'`;
    expect(styleHash(css)).toBe(expected);
    expect(policy).toContain(`style-src 'self' ${expected};`);
  });
});

describe('findInlineCode', () => {
  it('accepts external scripts and structured data', () => {
    expect(findInlineCode(page('    <script type="module" crossorigin src="/assets/index.js"></script>\n    <script type="application/ld+json">{"@context":"https://schema.org"}</script>'))).toEqual([]);
  });

  it('reports inline scripts, style attributes and event handler attributes', () => {
    expect(findInlineCode(page('    <script>alert(1)</script>'))).toEqual(['インラインの<script>']);
    expect(findInlineCode(page('    <script type="module">import "/a.js";</script>'))).toEqual(['インラインの<script>']);
    expect(findInlineCode(page('', '<p style="color: red">本文</p>'))).toEqual(['style属性']);
    expect(findInlineCode(page('', '<img src="/a.png" onerror="alert(1)">'))).toEqual(['on*属性']);
  });
});

describe('applyContentSecurityPolicy', () => {
  it('puts the policy right after the charset so that it covers every later element', () => {
    const html = applyContentSecurityPolicy(page('    <style>p { color: red; }</style>'));
    const lines = html.split('\n');
    expect(lines[3]).toBe('    <meta charset="UTF-8" />');
    expect(lines[4]).toBe(`    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicyFor(page('    <style>p { color: red; }</style>'))}" />`);
    expect(contentSecurityPolicyMetas(html)).toHaveLength(1);
  });

  it('stops the build instead of shipping a page the policy would break', () => {
    expect(() => applyContentSecurityPolicy(page('    <script>alert(1)</script>'))).toThrow(/インラインの<script>/);
    expect(() => applyContentSecurityPolicy(applyContentSecurityPolicy(page('')))).toThrow(/既にあります/);
    expect(() => applyContentSecurityPolicy('<html><head></head></html>')).toThrow(/charset/);
  });
});

describe('verifyContentSecurityPolicy', () => {
  it('accepts a page built by the plugin', () => {
    expect(verifyContentSecurityPolicy(applyContentSecurityPolicy(page('    <style>p { color: red; }</style>')))).toBeUndefined();
  });

  it('reports a missing policy, a stale style hash and a misplaced policy', () => {
    expect(verifyContentSecurityPolicy(page(''))).toMatch(/0個/);
    const built = applyContentSecurityPolicy(page('    <style>p { color: red; }</style>'));
    expect(verifyContentSecurityPolicy(built.replace('color: red', 'color: blue'))).toMatch(/想定と違います/);
    const meta = built.split('\n')[4];
    const moved = built.replace(`${meta}\n`, '').replace('  </head>', `${meta}\n  </head>`);
    expect(verifyContentSecurityPolicy(moved)).toMatch(/直後にありません/);
  });
});
