import { expect, it } from 'vitest';
import { failureReason } from './analyticsFailure';
import { BackupLimitError, InvalidBackupError } from './storage/backupErrors';
import { WorkerProcessingError, WorkerStartError, WorkerVersionError } from './util/workerStarter';

it.each([
  [new WorkerVersionError(), 'site_updated'],
  [new WorkerStartError('private'), 'worker_start'],
  [new WorkerProcessingError('private'), 'worker_error'],
  [new DOMException('private', 'QuotaExceededError'), 'storage_quota'],
  [new DOMException('private', 'UnknownError'), 'storage'],
  [new DOMException('private', 'AbortError'), 'storage'],
  [new InvalidBackupError('private'), 'invalid_backup'],
  [new BackupLimitError('private'), 'backup_limit'],
  [new Error('QuotaExceededError'), 'unknown'],
  [{ code: 'invalid_backup' }, 'unknown'],
  [undefined, 'unknown'],
])('classifies known types without reading messages: %s', (error, expected) => {
  expect(failureReason(error)).toBe(expected);
});
