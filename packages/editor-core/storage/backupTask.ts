import backupWorkerUrl from './backup.worker.ts?worker&url';
import { createWorkerTask } from '../util/workerStarter';
import type { PatternBlock } from '../model/Board';
import type { ChartDocument } from './database';
import { decodeBackup, encodeBackup } from './backupCodec';

export type BackupTask = { operation: 'encode'; documents: ChartDocument[]; blocks: PatternBlock[] }
  | { operation: 'decode'; data: Uint8Array };
type Decoded = ReturnType<typeof decodeBackup>;

const backupTask = createWorkerTask(backupWorkerUrl);
export const prefetchBackupWorker = backupTask.preload;

export function runBackupTask(task: Extract<BackupTask, { operation: 'encode' }>): Promise<Uint8Array<ArrayBuffer>>;
export function runBackupTask(task: Extract<BackupTask, { operation: 'decode' }>): Promise<Decoded>;
export async function runBackupTask(task: BackupTask): Promise<Uint8Array<ArrayBuffer> | Decoded> {
  // Nodeの単体テストでは同じcodecを直接検証する。ブラウザとWKWebViewではWorkerを必ず使う。
  if (typeof Worker === 'undefined') {
    return task.operation === 'encode' ? encodeBackup(task.documents, task.blocks) : decodeBackup(task.data);
  }
  let result!: Uint8Array<ArrayBuffer> | Decoded;
  await backupTask.run<{ result?: Uint8Array<ArrayBuffer> | Decoded; error?: string }>((worker) => {
    // 起動確認後に元のバッファをコピーせず転送する。
    const buffers = task.operation === 'encode' ? task.documents.map((item) => item.cells) : [task.data.buffer as ArrayBuffer];
    worker.postMessage(task, buffers);
  }, (data) => {
    if (data.result === undefined) throw new Error(data.error?.trim() || 'バックアップを処理できませんでした。');
    result = data.result;
  }, 'バックアップを処理できませんでした。');
  return result;
}
