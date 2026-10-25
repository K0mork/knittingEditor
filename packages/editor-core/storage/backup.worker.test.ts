import { afterEach, expect, it, vi } from 'vitest';
import { backupErrorCode, restoreBackupError } from './backupErrors';
import { decodeBackup, encodeBackup, BACKUP_LIMITS } from './backupCodec';
import { failureReason } from '../analyticsFailure';

afterEach(() => vi.unstubAllGlobals());

it.each(['invalid_backup', 'backup_limit'] as const)('sends a typed codec error through the real worker handler: %s', async (expected) => {
  vi.resetModules();
  const postMessage = vi.fn();
  const worker = { postMessage, onmessage: undefined as undefined | ((event: MessageEvent) => void) };
  vi.stubGlobal('self', worker);
  await import('./backup.worker');
  worker.onmessage?.({ data: expected === 'invalid_backup'
    ? { operation: 'decode', data: new Uint8Array([0]) }
    : { operation: 'encode', documents: Array(BACKUP_LIMITS.maxDocuments + 1).fill({}), blocks: [] },
  } as MessageEvent);
  const response = postMessage.mock.calls.at(-1)![0];
  expect(response).toMatchObject({ ok: false, code: expected });
  // 失敗の応答は転送するバッファを持たない。
  expect(postMessage.mock.calls.at(-1)).toHaveLength(1);
  // resetModules後の同じクラス定義で復元する。
  const errors = await import('./backupErrors');
  const analytics = await import('../analyticsFailure');
  expect(analytics.failureReason(errors.restoreBackupError(response.error, response.code))).toBe(expected);
});

it('marks invalid and oversized codec inputs without parsing messages', () => {
  for (const [run, expected] of [
    [() => decodeBackup(new Uint8Array([0])), 'invalid_backup'],
    [() => encodeBackup(Array(BACKUP_LIMITS.maxDocuments + 1).fill({}), []), 'backup_limit'],
  ] as const) {
    try { run(); throw new Error('must fail'); }
    catch (error) {
      expect(backupErrorCode(error)).toBe(expected);
      expect(failureReason(restoreBackupError('unchanged', backupErrorCode(error)))).toBe(expected);
    }
  }
});
