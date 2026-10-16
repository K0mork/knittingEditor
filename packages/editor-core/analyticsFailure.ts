import { BackupLimitError, InvalidBackupError } from './storage/backupErrors';
import { WorkerProcessingError, WorkerStartError, WorkerVersionError } from './util/workerStarter';

export const FAILURE_REASONS = [
  'site_updated', 'worker_start', 'worker_error', 'storage_quota',
  'storage', 'invalid_backup', 'backup_limit', 'unknown',
] as const;
export type FailureReason = typeof FAILURE_REASONS[number];

/** 文面や任意のコードを送らず、既知の型だけを固定分類へ変換する。 */
export function failureReason(error: unknown): FailureReason {
  if (error instanceof WorkerVersionError) return 'site_updated';
  if (error instanceof WorkerStartError) return 'worker_start';
  if (error instanceof WorkerProcessingError) return 'worker_error';
  if (error instanceof BackupLimitError) return 'backup_limit';
  if (error instanceof InvalidBackupError) return 'invalid_backup';
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' ? 'storage_quota' : 'storage';
  }
  return 'unknown';
}
