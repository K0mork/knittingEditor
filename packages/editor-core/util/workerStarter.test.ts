import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkerTask, WorkerVersionError } from './workerStarter';

const fallback = '処理できませんでした。';
afterEach(() => vi.unstubAllGlobals());
function setup(failures: number) {
  const urls: string[] = [];
  const terminate = vi.fn();
  const revoke = vi.fn();
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'self.onmessage = () => {};', status: 200 });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: revoke });
  vi.stubGlobal('Worker', class {
    onerror?: (event: { message: string; preventDefault: () => void }) => void;
    onmessage?: (event: { data: string }) => void;
    terminate = terminate;
    constructor(url: string) { urls.push(url); }
    postMessage() {
      queueMicrotask(() => {
        if (failures-- > 0) this.onerror?.({ message: '', preventDefault() {} });
        else this.onmessage?.({ data: 'done' });
      });
    }
  });
  const task = createWorkerTask('/worker.js');
  const receive = vi.fn();
  const run = () => task.run<string>((worker) => worker.postMessage({}), receive, fallback);
  return { task, run, urls, revoke, terminate, fetch, receive };
}
describe('worker tasks', () => {
  it('uses prefetched contents and releases each task', async () => {
    const state = setup(0);
    await Promise.all([state.task.preload(), state.task.preload()]);
    await state.run();
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.urls).toEqual(['blob:test']);
    expect(state.revoke).toHaveBeenCalledWith('blob:test');
    expect(state.terminate).toHaveBeenCalledTimes(1);
  });
  it('never fetches without Web opt-in, including failures', async () => {
    const state = setup(1);
    await expect(state.run()).rejects.toThrow(fallback);
    expect(state.urls).toEqual(['/worker.js']);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('uses the bundled URL successfully without any runtime fetch', async () => {
    const state = setup(0);
    await state.run();
    expect(state.urls).toEqual(['/worker.js']);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('uses the URL immediately while prefetch is pending', async () => {
    const state = setup(0);
    let complete!: (value: unknown) => void;
    state.fetch.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const pending = state.task.preload();
    await state.run();
    expect(state.urls).toEqual(['/worker.js']);
    complete({ ok: false });
    await pending;
  });
  it('falls back to the URL when prefetch is offline', async () => {
    const state = setup(0);
    state.fetch.mockRejectedValue(new Error('offline'));
    await state.task.preload();
    await state.run();
    expect(state.urls).toEqual(['/worker.js']);
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it('falls back after asynchronous blob startup failure', async () => {
    const state = setup(1);
    await state.task.preload();
    await state.run();
    expect(state.urls).toEqual(['blob:test', '/worker.js']);
    expect(state.revoke).toHaveBeenCalledWith('blob:test');
  });
  it('falls back after a synchronous blob constructor failure', async () => {
    const state = setup(0);
    await state.task.preload();
    const Original = Worker;
    vi.stubGlobal('Worker', class extends Original {
      constructor(url: string, options?: WorkerOptions) {
        if (url.startsWith('blob:')) throw new Error('blocked');
        super(url, options);
      }
    });
    await state.run();
    expect(state.urls).toEqual(['/worker.js']);
    expect(state.revoke).toHaveBeenCalledWith('blob:test');
  });
  it.each([404, 200, 'offline'])('classifies missing URL with HEAD: %s', async (status) => {
    const state = setup(2);
    await state.task.preload();
    if (status === 'offline') state.fetch.mockRejectedValue(new Error('offline'));
    else state.fetch.mockResolvedValue({ status });
    await expect(state.run()).rejects.toThrow(status === 404 ? WorkerVersionError : fallback);
    expect(state.fetch).toHaveBeenLastCalledWith('/worker.js', { method: 'HEAD', cache: 'no-store' });
  });
  it('does not retry task response errors', async () => {
    const state = setup(0);
    await state.task.preload();
    await expect(state.task.run((worker) => worker.postMessage({}), () => { throw new Error('invalid data'); }, fallback)).rejects.toThrow('invalid data');
    expect(state.urls).toEqual(['blob:test']);
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
});
