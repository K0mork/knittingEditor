/** Workerとの受け渡しにも使う、バックアップの固定エラー分類。 */
export class InvalidBackupError extends Error {}
export class BackupLimitError extends Error {}

export function backupErrorCode(error: unknown): 'invalid_backup' | 'backup_limit' | undefined {
  if (error instanceof InvalidBackupError) return 'invalid_backup';
  if (error instanceof BackupLimitError) return 'backup_limit';
  return undefined;
}

export function restoreBackupError(message: string, code: unknown): Error {
  if (code === 'invalid_backup') return new InvalidBackupError(message);
  if (code === 'backup_limit') return new BackupLimitError(message);
  return new Error(message);
}
