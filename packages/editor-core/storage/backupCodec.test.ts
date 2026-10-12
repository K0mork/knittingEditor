import { expect, it, vi } from 'vitest';
import { Gunzip, gzipSync } from 'fflate';
import { gunzipWithLimit } from './backupCodec';

it('stops a single gzip member at the size limit before consuming the whole input', () => {
  const compressed = gzipSync(new Uint8Array(8 * 1024 * 1024));
  const push = vi.spyOn(Gunzip.prototype, 'push');
  try {
    expect(() => gunzipWithLimit(compressed, 1024 * 1024)).toThrow('解凍後のバックアップが大きすぎます');
    expect(push.mock.calls.length).toBeLessThan(Math.ceil(compressed.length / 256));
    expect(push.mock.calls.every(([chunk]) => chunk.length <= 256)).toBe(true);
  } finally { push.mockRestore(); }
});
