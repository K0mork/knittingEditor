import type { PatternBlock } from '../model/Board';
import type { ChartDocument } from './database';
import { decodeBackup, encodeBackup } from './backupCodec';

export type BackupTask = { operation: 'encode'; documents: ChartDocument[]; blocks: PatternBlock[] }
  | { operation: 'decode'; data: Uint8Array };
type Decoded = ReturnType<typeof decodeBackup>;

export function runBackupTask(task: Extract<BackupTask, { operation: 'encode' }>): Promise<Uint8Array<ArrayBuffer>>;
export function runBackupTask(task: Extract<BackupTask, { operation: 'decode' }>): Promise<Decoded>;
export async function runBackupTask(task: BackupTask): Promise<Uint8Array<ArrayBuffer> | Decoded> {
  // Nodeの単体テストでは同じcodecを直接検証する。ブラウザとWKWebViewではWorkerを必ず使う。
  if (typeof Worker === 'undefined') {
    return task.operation === 'encode' ? encodeBackup(task.documents, task.blocks) : decodeBackup(task.data);
  }
  const worker = new Worker(new URL('./backup.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ result?: Uint8Array<ArrayBuffer> | Decoded; error?: string }>) => {
      worker.terminate();
      if (event.data.result !== undefined) resolve(event.data.result);
      else reject(new Error(event.data.error ?? 'バックアップを処理できませんでした。'));
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.onmessageerror = () => { worker.terminate(); reject(new Error('バックアップを処理できませんでした。')); };
    try {
      const buffers = task.operation === 'encode' ? task.documents.map((item) => item.cells) : [task.data.buffer as ArrayBuffer];
      worker.postMessage(task, buffers);
    }
    catch (error) { worker.terminate(); reject(error); }
  });
}
