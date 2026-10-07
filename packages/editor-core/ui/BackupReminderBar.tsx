import { backupReminderText, type BackupReminderKind } from '../state/backupReminder';

export interface BackupReminderBarProps {
  kind: BackupReminderKind;
  lastBackupAt: number | undefined;
  onBackup: () => void;
  onSnooze: () => void;
}

/**
 * `.knit`の書き出しを勧める帯。盤面には重ねず、道具列と盤面の間に1段だけ出す。
 * 押すと開いている編み図を書き出し、「あとで」で一定期間出さない。
 */
export function BackupReminderBar({ kind, lastBackupAt, onBackup, onSnooze }: BackupReminderBarProps) {
  return <section className="backup-reminder" aria-label="バックアップのおすすめ">
    <p role="status">{backupReminderText(kind, lastBackupAt)}</p>
    <div className="backup-reminder-actions">
      <button className="primary" onClick={onBackup}>書き出す</button>
      <button onClick={onSnooze}>あとで</button>
    </div>
  </section>;
}
