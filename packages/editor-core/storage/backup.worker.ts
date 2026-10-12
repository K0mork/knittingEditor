import { decodeBackup, encodeBackup } from './backupCodec';
import type { BackupTask } from './backupTask';

self.onmessage = (event: MessageEvent<BackupTask>) => {
  try {
    const task = event.data;
    const result = task.operation === 'encode' ? encodeBackup(task.documents, task.blocks) : decodeBackup(task.data);
    const buffers = result instanceof Uint8Array ? [result.buffer] : result.documents.map((item) => item.cells);
    self.postMessage({ result }, { transfer: buffers });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'バックアップを処理できませんでした。' });
  }
};
