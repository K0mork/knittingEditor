import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkerTask, WorkerVersionError } from './workerStarter';

const fallback = '処理できませんでした。';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup(failures: number) {
  const urls: string[] = [];
  const terminate = vi.fn();
  const revoke = vi.fn();
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => 'self.onmessage = () => {};', status: 200 });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: revoke });
  vi.stubGlobal('Worker', class {
    onerror?: (event: { message: string; preventDefault: () => void }) => void;
    onmessage?: (event: { data: string | { ready: true } }) => void;
    terminate = terminate;
    constructor(url: string) {
      urls.push(url);
      queueMicrotask(() => {
        if (failures-- > 0) this.onerror?.({ message: '', preventDefault() {} });
        else this.onmessage?.({ data: { ready: true } });
      });
    }
    postMessage() { queueMicrotask(() => this.onmessage?.({ data: 'done' })); }
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

it('waits for ready before sending and ignores duplicate ready messages', async () => {
  let instance!: Worker;
  const send = vi.fn();
  const terminate = vi.fn();
  vi.stubGlobal('Worker', class {
    onmessage = null;
    terminate = terminate;
    constructor() { instance = this as unknown as Worker; }
  });
  const pending = createWorkerTask('/worker.js').run(send, () => {}, fallback);
  expect(send).not.toHaveBeenCalled();
  instance.onmessage?.call(instance, { data: { ready: true } } as MessageEvent);
  instance.onmessage?.call(instance, { data: { ready: true } } as MessageEvent);
  expect(send).toHaveBeenCalledExactlyOnceWith(instance);
  instance.onmessage?.call(instance, { data: 'done' } as MessageEvent);
  await pending;
  expect(terminate).toHaveBeenCalledOnce();
});

it.each(['error', 'messageerror', 'send'])('never retries or checks HEAD after ready: %s', async (mode) => {
  const state = setup(0);
  await state.task.preload();
  await expect(state.task.run((worker) => {
    if (mode === 'send') throw new Error('');
    if (mode === 'error') worker.onerror?.call(worker, { message: '' } as ErrorEvent);
    else worker.onmessageerror?.call(worker, {} as MessageEvent);
  }, () => {}, fallback)).rejects.toThrow(fallback);
  expect(state.urls).toEqual(['blob:test']);
  expect(state.fetch).toHaveBeenCalledTimes(1);
  expect(state.terminate).toHaveBeenCalledOnce();
  expect(state.revoke).toHaveBeenCalledOnce();
});

it('times out blob startup, falling back without sending data to the stalled worker', async () => {
  vi.useFakeTimers();
  const state = setup(0);
  await state.task.preload();
  const Original = Worker;
  vi.stubGlobal('Worker', class extends Original {
    constructor(url: string, options?: WorkerOptions) {
      if (url.startsWith('blob:')) {
        // Blob起動だけreadyもerrorも届かない状態を作る。
        return { terminate: vi.fn() } as unknown as Worker;
      }
      super(url, options);
    }
  });
  const send = vi.fn((worker: Worker) => worker.postMessage({}));
  const pending = state.task.run(send, () => {}, fallback);
  expect(send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15_000);
  await pending;
  expect(send).toHaveBeenCalledOnce();
  expect(state.urls).toEqual(['/worker.js']);
  expect(state.revoke).toHaveBeenCalledWith('blob:test');
});

it('waits for URL startup without a timeout', async () => {
  vi.useFakeTimers();
  const state = setup(0);
  let instance!: Worker;
  vi.stubGlobal('Worker', class {
    onmessage = null;
    terminate = state.terminate;
    constructor() { instance = this as unknown as Worker; }
  });
  // 先読みが失敗したWebでも、低速なURLの読み込みを打ち切らない。
  state.fetch.mockRejectedValue(new Error('offline'));
  await state.task.preload();
  const send = vi.fn();
  const pending = state.task.run(send, state.receive, fallback);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(send).not.toHaveBeenCalled();
  expect(state.terminate).not.toHaveBeenCalled();
  expect(state.fetch).toHaveBeenCalledTimes(1);
  instance.onmessage?.call(instance, { data: { ready: true } } as MessageEvent);
  expect(send).toHaveBeenCalledExactlyOnceWith(instance);
  instance.onmessage?.call(instance, { data: 'done' } as MessageEvent);
  await pending;
  expect(state.receive).toHaveBeenCalledWith('done');
  expect(state.terminate).toHaveBeenCalledOnce();
});

it('does not impose the blob startup timeout on processing', async () => {
  vi.useFakeTimers();
  const state = setup(0);
  await state.task.preload();
  let instance!: Worker;
  vi.stubGlobal('Worker', class {
    onmessage = null;
    terminate() {}
    constructor() { instance = this as unknown as Worker; }
  });
  const receive = vi.fn();
  const pending = state.task.run(() => {}, receive, fallback);
  instance.onmessage?.call(instance, { data: { ready: true } } as MessageEvent);
  await vi.advanceTimersByTimeAsync(30_000);
  instance.onmessage?.call(instance, { data: 'done' } as MessageEvent);
  await pending;
  expect(receive).toHaveBeenCalledWith('done');
});
