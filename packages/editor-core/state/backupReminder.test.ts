import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_EDIT_THRESHOLD, BACKUP_REMINDER_STALE_MS, backupReminderKind, backupReminderText, backupStatusText,
  formatBackupDateTime, type BackupReminderInput,
} from './backupReminder';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 6, 14, 5).getTime();

function input(overrides: Partial<BackupReminderInput>): BackupReminderInput {
  return {
    now, lastBackupAt: undefined, createdAt: now - DAY, changedBeforeOpen: false, edits: 0, snoozedUntil: undefined,
    ...overrides,
  };
}

describe('backupReminderKind', () => {
  it('stays quiet for a chart with no changes since its last backup, however old', () => {
    expect(backupReminderKind(input({ createdAt: now - 400 * DAY }))).toBeUndefined();
    expect(backupReminderKind(input({ lastBackupAt: now - 400 * DAY }))).toBeUndefined();
  });

  it('reminds after the edit threshold in one sitting', () => {
    expect(backupReminderKind(input({ edits: BACKUP_REMINDER_EDIT_THRESHOLD - 1 }))).toBeUndefined();
    expect(backupReminderKind(input({ edits: BACKUP_REMINDER_EDIT_THRESHOLD }))).toBe('never');
    expect(backupReminderKind(input({ lastBackupAt: now - DAY, edits: BACKUP_REMINDER_EDIT_THRESHOLD }))).toBe('changed');
  });

  it('reminds on the first change once the last backup is a week old', () => {
    const old = now - BACKUP_REMINDER_STALE_MS;
    expect(backupReminderKind(input({ lastBackupAt: old + 1, edits: 1 }))).toBeUndefined();
    expect(backupReminderKind(input({ lastBackupAt: old, edits: 1 }))).toBe('changed');
    // 開いた時点ですでに変更があれば、編集しなくても出す。
    expect(backupReminderKind(input({ lastBackupAt: old, changedBeforeOpen: true }))).toBe('changed');
  });

  it('counts the age of a chart that was never backed up from its creation', () => {
    expect(backupReminderKind(input({ createdAt: now - 6 * DAY, changedBeforeOpen: true }))).toBeUndefined();
    expect(backupReminderKind(input({ createdAt: now - 7 * DAY, changedBeforeOpen: true }))).toBe('never');
  });

  it('waits until the snooze ends', () => {
    const due = input({ lastBackupAt: now - 30 * DAY, changedBeforeOpen: true });
    expect(backupReminderKind({ ...due, snoozedUntil: now + 1 })).toBeUndefined();
    expect(backupReminderKind({ ...due, snoozedUntil: now })).toBe('changed');
  });
});

describe('backup texts', () => {
  it('formats the date and time in the local time zone', () => {
    expect(formatBackupDateTime(now)).toBe('2026年10月6日 14:05');
    expect(formatBackupDateTime(new Date(2027, 0, 2, 9, 0).getTime())).toBe('2027年1月2日 9:00');
  });

  it('describes the backup status of the open chart', () => {
    expect(backupStatusText(undefined)).toBe('この編み図はまだバックアップしていません。');
    expect(backupStatusText(now)).toBe('この編み図の最後のバックアップ：2026年10月6日 14:05');
  });

  it('keeps the reminder short', () => {
    expect(backupReminderText('never', undefined)).toBe('この編み図はまだバックアップしていません。');
    expect(backupReminderText('changed', now)).toBe('10月6日のバックアップの後に変更があります。');
  });
});
