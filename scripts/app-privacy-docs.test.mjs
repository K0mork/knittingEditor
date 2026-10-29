// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

let directory;
let script;
let policy;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'app-privacy-docs-'));
  for (const path of ['ios/scripts', 'ios/docs', 'ios/App', 'public/privacy/app']) mkdirSync(join(directory, path), { recursive: true });
  for (const file of [
    'ios/scripts/check-app-store-docs.sh', 'ios/App/Info.plist',
    ...['APP_STORE_METADATA', 'APP_STORE_CHECKLIST', 'APP_REVIEW_NOTES', 'PRIVACY_POLICY', 'RELEASE_RUNBOOK', 'SCREENSHOTS', 'SIMULATOR_PERFORMANCE_BASELINE'].map((name) => `ios/docs/${name}.md`),
    'public/privacy/app/index.html',
  ]) copyFileSync(new URL(`../${file}`, import.meta.url), join(directory, file));
  script = join(directory, 'ios/scripts/check-app-store-docs.sh');
  policy = join(directory, 'public/privacy/app/index.html');
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function check() {
  return execFileSync('sh', [script], { encoding: 'utf8', stdio: 'pipe' });
}

test('accepts the canonical page and the document that points to it', () => {
  expect(check()).toContain('App Store documents are structurally valid');
});

test.each(['<h1>アプリのプライバシーポリシー</h1>', '情報を収集しません', 'https://knittingeditor.com/privacy/app/'])('rejects a canonical page missing %s', (required) => {
  writeFileSync(policy, readFileSync(policy, 'utf8').replaceAll(required, ''));
  expect(check).toThrow();
});

test('rejects a missing canonical page even when the Markdown pointer exists', () => {
  rmSync(policy);
  expect(check).toThrow();
});

test.each(['### Other input methods', '### 画面のボタン以外の操作'])('rejects review notes missing the section %s', (heading) => {
  const notes = join(directory, 'ios/docs/APP_REVIEW_NOTES.md');
  writeFileSync(notes, readFileSync(notes, 'utf8').replaceAll(heading, ''));
  expect(check).toThrow();
});

test.each(['APP_STORE_CHECKLIST', 'RELEASE_RUNBOOK'].flatMap((name) => ['iPhone Duo', 'iOS 27 SDK', '2027年4月'].map((text) => [name, text])))('rejects %s missing the April 2027 requirement %s', (name, text) => {
  const document = join(directory, `ios/docs/${name}.md`);
  writeFileSync(document, readFileSync(document, 'utf8').replaceAll(text, ''));
  expect(check).toThrow();
});

test('rejects screenshot documentation missing an iPhone Duo image', () => {
  const screenshots = join(directory, 'ios/docs/SCREENSHOTS.md');
  writeFileSync(screenshots, readFileSync(screenshots, 'utf8').replaceAll('app-store-iphone-duo-inner-05-dark.png', ''));
  expect(check).toThrow();
});

test('rejects metadata pointing to the Web policy instead of the app policy', () => {
  const metadata = join(directory, 'ios/docs/APP_STORE_METADATA.md');
  writeFileSync(metadata, readFileSync(metadata, 'utf8').replaceAll('https://knittingeditor.com/privacy/app/', 'https://knittingeditor.com/privacy/'));
  expect(check).toThrow();
});
