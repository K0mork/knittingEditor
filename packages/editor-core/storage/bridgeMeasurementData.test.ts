// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { encodeBackup, BACKUP_LIMITS } from './backupCodec';
import { bridgeMeasurementDocument } from './bridgeMeasurementData';

describe('bridge measurement data', () => {
  it('is deterministic and varies between documents', () => {
    const first = new Uint32Array(bridgeMeasurementDocument(0).cells);
    const same = new Uint32Array(bridgeMeasurementDocument(0).cells);
    const other = new Uint32Array(bridgeMeasurementDocument(1).cells);
    expect(first.every((value, i) => value === same[i])).toBe(true);
    expect(first.some((value, i) => value !== other[i])).toBe(true);
  });
  it('reports actual gzip and Base64 sizes without storing fixtures', () => {
    const documents = [];
    for (let n = 1; n <= 16; n++) {
      documents.push(bridgeMeasurementDocument(n - 1));
      if (![1, 2, 4, 8, 16].includes(n)) continue;
      try {
        const bytes = encodeBackup(documents, []);
        console.log(`BRIDGE_SIZE N=${n} gzip=${bytes.length} base64=${4 * Math.ceil(bytes.length / 3)}`);
        expect(bytes.length).toBeGreaterThan(n * 3_000_000);
        expect(bytes.length).toBeLessThan(BACKUP_LIMITS.maxCompressedBytes);
      } catch (error) {
        if (n !== 16) throw error;
        expect(String(error)).toContain('バックアップ');
        console.log('BRIDGE_SIZE N=16 rejected by existing web backup limit');
      }
    }
  }, 120_000);
});
