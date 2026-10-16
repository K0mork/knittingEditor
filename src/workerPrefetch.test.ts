import { afterEach, describe, expect, it, vi } from 'vitest';
import { workerLoader } from './workerPrefetch';

afterEach(() => vi.unstubAllGlobals());

describe('Web worker loader', () => {
  it('downloads worker contents as a JavaScript blob', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'worker source' });
    vi.stubGlobal('fetch', fetch);
    const blob = await workerLoader.download('/worker.js');
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/worker.js');
    expect(blob?.type).toBe('text/javascript');
    expect(await blob?.text()).toBe('worker source');
  });

  it('does not retain unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await workerLoader.download('/worker.js')).toBeUndefined();
  });

  it.each([404, 200, 500])('confirms a missing URL only for 404: %s', async (status) => {
    const fetch = vi.fn().mockResolvedValue({ status });
    vi.stubGlobal('fetch', fetch);
    expect(await workerLoader.isMissing('/worker.js')).toBe(status === 404);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/worker.js', { method: 'HEAD', cache: 'no-store' });
  });

  it('leaves network failures for the shared fallback handler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(workerLoader.download('/worker.js')).rejects.toThrow('offline');
    await expect(workerLoader.isMissing('/worker.js')).rejects.toThrow('offline');
  });
});
