import { afterEach, expect, it, vi } from 'vitest';
import { runBackupTask } from './backupTask';
afterEach(() => vi.unstubAllGlobals());
it.each(['event', 'response', 'throw'])('reports a meaningful backup failure: %s', async (mode) => {
  vi.stubGlobal('Worker', class {
    onerror?: (event: { message: string; preventDefault: () => void }) => void;
    onmessage?: (event: { data: { error: string } | { ready: true } }) => void;
    constructor() { queueMicrotask(() => this.onmessage?.({ data: { ready: true } })); }
    terminate() {}
    postMessage() {
      if (mode === 'throw') throw new Error('');
      queueMicrotask(() => {
        if (mode === 'event') this.onerror?.({ message: '', preventDefault() {} });
        else this.onmessage?.({ data: { error: '  ' } });
      });
    }
  });
  await expect(runBackupTask({ operation: 'encode', documents: [], blocks: [] })).rejects.toThrow('バックアップを処理できませんでした。');
});

it.each(['encode', 'decode'] as const)('transfers the original buffers after ready without cloning: %s', async (operation) => {
  const clone = vi.fn(() => { throw new Error('must not clone'); });
  vi.stubGlobal('structuredClone', clone);
  let instance!: Worker;
  const postMessage = vi.fn();
  vi.stubGlobal('Worker', class {
    onmessage = null;
    terminate() {}
    postMessage = postMessage;
    constructor() { instance = this as unknown as Worker; }
  });
  const cells = new ArrayBuffer(16);
  const task = operation === 'encode'
    ? { operation, documents: [{ cells } as import('./database').ChartDocument], blocks: [] }
    : { operation, data: new Uint8Array(cells) };
  const pending = task.operation === 'encode' ? runBackupTask(task) : runBackupTask(task);
  expect(postMessage).not.toHaveBeenCalled();
  instance.onmessage?.call(instance, { data: { ready: true } } as MessageEvent);
  expect(postMessage).toHaveBeenCalledWith(task, [cells]);
  expect(postMessage.mock.calls[0][0]).toBe(task);
  expect(postMessage.mock.calls[0][1][0]).toBe(cells);
  instance.onmessage?.call(instance, { data: { result: new Uint8Array() } } as MessageEvent);
  await pending;
  expect(clone).not.toHaveBeenCalled();
});

it.each([
  ['invalid_backup', 'invalid_backup'],
  ['backup_limit', 'backup_limit'],
  ['unrecognized', 'worker_error'],
])('preserves only known backup codes across the worker boundary: %s', async (code, expected) => {
  const { failureReason } = await import('../analyticsFailure');
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void;
    constructor() { queueMicrotask(() => this.onmessage?.({ data: { ready: true } })); }
    terminate() {}
    postMessage() {
      queueMicrotask(() => this.onmessage?.({ data: { error: '元の文面', code } }));
    }
  });
  const error = await runBackupTask({ operation: 'decode', data: new Uint8Array() }).catch((error: unknown) => error);
  expect(failureReason(error)).toBe(expected);
  expect(error).toHaveProperty('message', '元の文面');
});
