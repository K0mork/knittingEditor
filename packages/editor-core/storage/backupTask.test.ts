import { afterEach, expect, it, vi } from 'vitest';
import { packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { runBackupTask, type BackupResponse } from './backupTask';
import type { ChartDocument } from './database';
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
  // 要求の種類に合った形の応答を返し、その結果がそのまま戻ることを確かめる。
  const response: BackupResponse = operation === 'encode'
    ? { ok: true, operation, result: new Uint8Array(4) }
    : { ok: true, operation, result: { count: 0, documents: [], blocks: [] } };
  instance.onmessage?.call(instance, { data: response } as MessageEvent);
  expect(await pending).toBe(response.result);
  expect(clone).not.toHaveBeenCalled();
});

it.each([
  ['encode', { ok: true, operation: 'decode', result: { count: 0, documents: [], blocks: [] } }],
  ['decode', { ok: true, operation: 'encode', result: new Uint8Array(4) }],
] as const)('rejects a %s result of the other operation', async (operation, response) => {
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void;
    constructor() { queueMicrotask(() => this.onmessage?.({ data: { ready: true } })); }
    terminate() {}
    postMessage() { queueMicrotask(() => this.onmessage?.({ data: response })); }
  });
  const pending = operation === 'encode'
    ? runBackupTask({ operation, documents: [], blocks: [] })
    : runBackupTask({ operation, data: new Uint8Array() });
  await expect(pending).rejects.toThrow('バックアップを処理できませんでした。');
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

/** 実際の`backup.worker.ts`の処理へ要求を渡し、その応答をメイン側へ返すWorkerの代わり。 */
async function relayToRealWorker() {
  const responses: Array<{ data: unknown; transfer: Transferable[] }> = [];
  let target: { onmessage: ((event: MessageEvent) => void) | null } | undefined;
  const scope: { postMessage: (data: unknown, options?: StructuredSerializeOptions) => void; onmessage?: (event: MessageEvent) => void } = {
    postMessage: (data, options) => {
      responses.push({ data, transfer: options?.transfer ?? [] });
      const worker = target;
      queueMicrotask(() => worker?.onmessage?.({ data } as MessageEvent));
    },
  };
  vi.stubGlobal('self', scope);
  // 読み込み時の通知（ready）は、まだ受け手がいないので記録だけ残る。
  await import('./backup.worker');
  vi.stubGlobal('Worker', class {
    onmessage: ((event: MessageEvent) => void) | null = null;
    constructor() {
      target = this;
      queueMicrotask(() => this.onmessage?.({ data: responses[0].data } as MessageEvent));
    }
    postMessage(data: unknown) { queueMicrotask(() => scope.onmessage?.({ data } as MessageEvent)); }
    terminate() {}
  });
  return responses;
}

it('returns the encoded and decoded results of the real worker handler with their transfer lists', async () => {
  const responses = await relayToRealWorker();
  expect(responses[0].data).toEqual({ ready: true });
  const cells = new Uint32Array(6);
  cells[4] = packCell(STITCH_BY_KEY.get('knit')!.id, 0x112233);
  const document: ChartDocument = { id: 'chart', name: '往復', rows: 2, cols: 3, cells: cells.buffer, createdAt: 1, updatedAt: 2 };
  const bytes = await runBackupTask({ operation: 'encode', documents: [document], blocks: [] });
  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes.byteLength).toBeGreaterThan(0);
  expect(responses.at(-1)!.data).toMatchObject({ ok: true, operation: 'encode' });
  expect(responses.at(-1)!.transfer).toHaveLength(1);
  expect(responses.at(-1)!.transfer[0]).toBe(bytes.buffer);

  const decoded = await runBackupTask({ operation: 'decode', data: bytes });
  expect(decoded.count).toBe(1);
  expect(decoded.blocks).toEqual([]);
  expect(decoded.documents).toHaveLength(1);
  expect(decoded.documents[0]).toMatchObject({ rows: 2, cols: 3 });
  expect(decoded.documents[0].name).toContain('往復');
  expect(new Uint32Array(decoded.documents[0].cells)).toEqual(cells);
  expect(responses.at(-1)!.data).toMatchObject({ ok: true, operation: 'decode' });
  expect(responses.at(-1)!.transfer).toHaveLength(1);
  expect(responses.at(-1)!.transfer[0]).toBe(decoded.documents[0].cells);
});
