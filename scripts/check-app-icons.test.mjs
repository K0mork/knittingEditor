// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkIconDocument, checkLayerSvg, checkProject } from '../ios/scripts/check-app-icons.mjs';

const iosRoot = fileURLToPath(new URL('../ios/', import.meta.url));
const icon = join(iosRoot, 'App/AppIcon.icon');

// アイコンを一時フォルダへ写し、変えてから検査する。
function checkEditedCopy(edit) {
  const temporary = mkdtempSync(join(tmpdir(), 'app-icon-check-'));
  try {
    cpSync(icon, temporary, { recursive: true });
    edit(temporary);
    checkIconDocument(temporary);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function editDocument(directory, change) {
  const document = JSON.parse(readFileSync(join(directory, 'icon.json'), 'utf8'));
  change(document);
  writeFileSync(join(directory, 'icon.json'), JSON.stringify(document));
}

test('the registered AppIcon.icon meets the Liquid Glass and appearance requirements', () => {
  checkProject(iosRoot);
});

test('rejects a document without a dark background', () => {
  assert.throws(() => checkEditedCopy(directory => editDocument(directory, document => {
    document['fill-specializations'] = document['fill-specializations'].filter(entry => entry.appearance !== 'dark');
  })), /dark background/);
});

test('rejects a layer without a tinted fill or without Liquid Glass', () => {
  assert.throws(() => checkEditedCopy(directory => editDocument(directory, document => {
    const layer = document.groups[0].layers[0];
    layer['fill-specializations'] = layer['fill-specializations'].filter(entry => entry.appearance !== 'tinted');
  })), /tinted fill/);
  assert.throws(() => checkEditedCopy(directory => editDocument(directory, document => {
    document.groups[0].layers[0].glass = false;
  })), /Liquid Glass/);
});

test('rejects more than four groups and a missing layer image', () => {
  assert.throws(() => checkEditedCopy(directory => editDocument(directory, document => {
    document.groups = Array.from({ length: 5 }, () => document.groups[0]);
  })), /one to four/);
  assert.throws(() => checkEditedCopy(directory => rmSync(join(directory, 'Assets', 'yarn.svg'))), /Missing layer image/);
});

test('rejects layers with text, raster images or a different canvas', () => {
  const shape = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><path d="M0 0H10V10Z"/></svg>';
  checkLayerSvg(shape, 'shape.svg');
  assert.throws(() => checkLayerSvg(shape.replace('<path', '<text>A</text><path'), 'text.svg'), /outlined vector/);
  assert.throws(() => checkLayerSvg(shape.replace('<path', '<image href="a.png"/><path'), 'image.svg'), /outlined vector/);
  assert.throws(() => checkLayerSvg(shape.replace('0 0 1024 1024', '0 0 512 512'), 'small.svg'), /1024x1024/);
});

test('rejects a leftover AppIcon asset catalog', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'app-icon-project-'));
  try {
    cpSync(join(iosRoot, 'knittingEditor.xcodeproj'), join(temporary, 'knittingEditor.xcodeproj'), { recursive: true });
    cpSync(icon, join(temporary, 'App/AppIcon.icon'), { recursive: true });
    checkProject(temporary);
    mkdirSync(join(temporary, 'App/Assets.xcassets/AppIcon.appiconset'), { recursive: true });
    assert.throws(() => checkProject(temporary), /AppIcon.appiconset/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
