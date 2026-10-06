// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkCatalog, checkIcon } from '../ios/scripts/check-app-icons.mjs';

const directory = new URL('../ios/App/Assets.xcassets/AppIcon.appiconset/', import.meta.url);
const any = readFileSync(new URL('AppIcon-1024.png', directory));
const dark = readFileSync(new URL('AppIcon-Dark-1024.png', directory));
const tinted = readFileSync(new URL('AppIcon-Tinted-1024.png', directory));

test('registered Any, Dark and Tinted assets meet release requirements', () => {
  checkCatalog(directory.pathname);
});

test('rejects opaque dark, colored tinted and alpha-channel Any images', () => {
  assert.throws(() => checkIcon(any, 'dark'), /alpha channel/);
  assert.throws(() => checkIcon(any, 'tinted'), /grayscale/);
  assert.throws(() => checkIcon(dark, 'any'), /no alpha/);
  checkIcon(tinted, 'tinted');
});

test('rejects an incorrect source size', () => {
  const image = Buffer.from(any);
  image.writeUInt32BE(192, 16);
  assert.throws(() => checkIcon(image, 'any'), /1024x1024/);
});

test('rejects a missing or duplicate appearance in the asset catalog', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'app-icon-check-'));
  try {
    cpSync(directory, temporary, { recursive: true });
    const catalog = JSON.parse(readFileSync(new URL('Contents.json', directory), 'utf8'));
    catalog.images[2].appearances[0].value = 'dark';
    writeFileSync(join(temporary, 'Contents.json'), JSON.stringify(catalog));
    assert.throws(() => checkCatalog(temporary), /Missing or duplicate/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
