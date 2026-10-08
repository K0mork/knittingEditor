import { describe, expect, it } from 'vitest';
import {
  applyContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  contentSecurityPolicyMetas,
  findInlineScripts,
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

describe('CONTENT_SECURITY_POLICY', () => {
  it('limits scripts, connections, workers, plugins, the base URL and forms', () => {
    expect(CONTENT_SECURITY_POLICY.split('; ')).toEqual([
      "default-src 'self'",
      "script-src 'self' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]);
    expect(CONTENT_SECURITY_POLICY).not.toContain('frame-ancestors');
  });
});

describe('findInlineScripts', () => {
  it('accepts external scripts, structured data, <style> elements and style attributes', () => {
    expect(findInlineScripts(page(
      '    <script type="module" crossorigin src="/assets/index.js"></script>\n    <script type="application/ld+json">{"@context":"https://schema.org"}</script>\n    <style>p { color: red; }</style>',
      '<p style="color: red">本文</p>',
    ))).toEqual([]);
  });

  it('reports inline scripts and event handler attributes', () => {
    expect(findInlineScripts(page('    <script>alert(1)</script>'))).toEqual(['インラインの<script>']);
    expect(findInlineScripts(page('    <script type="module">import "/a.js";</script>'))).toEqual(['インラインの<script>']);
    expect(findInlineScripts(page('    <script>alert(1)</script >'))).toEqual(['インラインの<script>']);
    expect(findInlineScripts(page('    <SCRIPT>alert(1)</SCRIPT\n>'))).toEqual(['インラインの<script>']);
    expect(findInlineScripts(page('', '<img src="/a.png" onerror="alert(1)">'))).toEqual(['on*属性']);
  });
});

describe('applyContentSecurityPolicy', () => {
  it('puts the policy right after the charset so that it covers every later element', () => {
    const lines = applyContentSecurityPolicy(page('')).split('\n');
    expect(lines[3]).toBe('    <meta charset="UTF-8" />');
    expect(lines[4]).toBe(`    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
    expect(contentSecurityPolicyMetas(lines.join('\n'))).toEqual([CONTENT_SECURITY_POLICY]);
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

  it('reports a missing, altered or misplaced policy', () => {
    expect(verifyContentSecurityPolicy(page(''))).toMatch(/0個/);
    const built = applyContentSecurityPolicy(page(''));
    expect(verifyContentSecurityPolicy(built.replace("object-src 'none'", 'object-src *'))).toMatch(/想定と違います/);
    const meta = built.split('\n')[4];
    const moved = built.replace(`${meta}\n`, '').replace('  </head>', `${meta}\n  </head>`);
    expect(verifyContentSecurityPolicy(moved)).toMatch(/直後にありません/);
  });
});
