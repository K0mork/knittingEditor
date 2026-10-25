import { backupErrorCode } from './backupErrors';
import { decodeBackup, encodeBackup } from './backupCodec';
import type { BackupResponse, BackupTask } from './backupTask';
import type { WorkerReadyMessage } from '../util/workerStarter';

self.postMessage({ ready: true } satisfies WorkerReadyMessage);
self.onmessage = (event: MessageEvent<BackupTask>) => {
  try {
    const task = event.data;
    if (task.operation === 'encode') {
      const result = encodeBackup(task.documents, task.blocks);
      self.postMessage({ ok: true, operation: task.operation, result } satisfies BackupResponse, { transfer: [result.buffer] });
    } else {
      const result = decodeBackup(task.data);
      self.postMessage({ ok: true, operation: task.operation, result } satisfies BackupResponse, { transfer: result.documents.map((item) => item.cells) });
    }
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'バックアップを処理できませんでした。', code: backupErrorCode(error) } satisfies BackupResponse);
  }
};
