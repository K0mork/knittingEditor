import { restoreBackupError, type backupErrorCode } from './backupErrors';
import backupWorkerUrl from './backup.worker.ts?worker&url';
import { createWorkerTask } from '../util/workerStarter';
import type { PatternBlock } from '../model/Board';
import type { ChartDocument } from './database';
import { decodeBackup, encodeBackup } from './backupCodec';

export type BackupEncodeTask = { operation: 'encode'; documents: ChartDocument[]; blocks: PatternBlock[] };
export type BackupDecodeTask = { operation: 'decode'; data: Uint8Array };
export type BackupTask = BackupEncodeTask | BackupDecodeTask;

/** 要求の種類ごとの成功結果。Workerの応答と`runBackupTask`の戻り値はこの対応に従う。 */
export interface BackupTaskResults {
  encode: Uint8Array<ArrayBuffer>;
  decode: ReturnType<typeof decodeBackup>;
}

/** バックアップWorkerの応答。成功時は要求と同じ`operation`と、その種類の結果を返す。 */
export type BackupResponse =
  | { [Operation in BackupTask['operation']]: { ok: true; operation: Operation; result: BackupTaskResults[Operation] } }[BackupTask['operation']]
  | { ok: false; error: string; code: ReturnType<typeof backupErrorCode> };

const BACKUP_WORKER_ERROR = 'バックアップを処理できませんでした。';
const backupTask = createWorkerTask(backupWorkerUrl);
export const prefetchBackupWorker = backupTask.preload;

export function runBackupTask(task: BackupEncodeTask): Promise<BackupTaskResults['encode']>;
export function runBackupTask(task: BackupDecodeTask): Promise<BackupTaskResults['decode']>;
export async function runBackupTask(task: BackupTask): Promise<BackupTaskResults[BackupTask['operation']]> {
  // Nodeの単体テストでは同じcodecを直接検証する。ブラウザとWKWebViewではWorkerを必ず使う。
  if (typeof Worker === 'undefined') {
    return task.operation === 'encode' ? encodeBackup(task.documents, task.blocks) : decodeBackup(task.data);
  }
  return backupTask.run<BackupResponse, BackupTaskResults[BackupTask['operation']]>((worker) => {
    // 起動確認後に元のバッファをコピーせず転送する。
    const buffers = task.operation === 'encode' ? task.documents.map((item) => item.cells) : [task.data.buffer as ArrayBuffer];
    worker.postMessage(task, buffers);
  }, (data) => {
    if (data.ok !== true) throw restoreBackupError(data.error?.trim() || BACKUP_WORKER_ERROR, data.code);
    // 別の種類の結果を受け取ったまま保存・復元へ進めない。
    if (data.operation !== task.operation) throw new Error(BACKUP_WORKER_ERROR);
    return data.result;
  }, BACKUP_WORKER_ERROR);
}
