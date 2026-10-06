import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function checkIcon(png, appearance) {
  if (!png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Invalid PNG');
  if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) throw new Error('AppIcon must be 1024x1024');
  const channels = png[25] === 2 ? 3 : png[25] === 6 ? 4 : 0;
  if (!channels || png[24] !== 8 || png[28] !== 0) throw new Error('Expected non-interlaced 8-bit RGB/RGBA');
  if (appearance !== 'dark' && channels !== 3) throw new Error('Any/Tinted must have no alpha channel');
  if (appearance === 'dark' && channels !== 4) throw new Error('Dark must have an alpha channel');
  const data = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = 1024 * channels;
  if (raw.length !== 1024 * (stride + 1)) throw new Error('Unexpected PNG pixel length');
  let previous = Buffer.alloc(stride);
  let transparent = 0;
  let visible = 0;
  for (let y = 0; y < 1024; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error('Invalid PNG filter');
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      row[i] = (row[i] + predictor) & 255;
    }
    for (let i = 0; i < stride; i += channels) {
      if (appearance === 'tinted' && (row[i] !== row[i + 1] || row[i] !== row[i + 2])) throw new Error('Tinted must be grayscale');
      if (channels === 4) {
        if (row[i + 3] === 0) transparent++;
        if (row[i + 3] > 0) visible++;
      }
    }
    previous = row;
  }
  if (appearance === 'dark' && (!transparent || !visible)) throw new Error('Dark must contain transparent background and visible foreground');
}

export function checkCatalog(directory) {
  const catalog = JSON.parse(readFileSync(resolve(directory, 'Contents.json'), 'utf8'));
  if (catalog.images.length !== 3) throw new Error('Expected Any, Dark and Tinted entries');
  for (const appearance of ['any', 'dark', 'tinted']) {
    const entries = catalog.images.filter(image => appearance === 'any' ? !image.appearances?.length : image.appearances?.length === 1 && image.appearances[0].appearance === 'luminosity' && image.appearances[0].value === appearance);
    if (entries.length !== 1) throw new Error(`Missing or duplicate ${appearance} icon`);
    const entry = entries[0];
    if (entry.idiom !== 'universal' || entry.platform !== 'ios' || entry.size !== '1024x1024' || !entry.filename || resolve(directory, entry.filename) !== resolve(directory, entry.filename.split('/').pop())) throw new Error('Invalid icon catalog entry');
    checkIcon(readFileSync(resolve(directory, entry.filename)), appearance);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkCatalog(fileURLToPath(new URL('../App/Assets.xcassets/AppIcon.appiconset/', import.meta.url)));
  console.log('AppIcon Any / Dark / Tinted assets are valid');
}
