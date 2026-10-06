/**
 * `.knit`の書き出し（バックアップ）を勧める条件と表示の文言。ReactにもDOMにも依存しない。
 *
 * 編み図は端末内にだけ保存され、アプリの削除やブラウザのデータ消去で消える。
 * 控えめに勧めるため、次のすべてを満たすときだけ出す。
 * - 最後のバックアップの後に変更がある（変更の無い編み図には出さない）。
 * - 「あとで」で閉じてから`BACKUP_REMINDER_SNOOZE_MS`たっている。
 * - 最後のバックアップ（無ければ作成）から`BACKUP_REMINDER_STALE_MS`たった、
 *   またはこの画面で`BACKUP_REMINDER_EDIT_THRESHOLD`回以上編集した。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 長く書き出していないとみなす期間。SafariはWebサイトのデータを7日使わないと消すことがある。 */
export const BACKUP_REMINDER_STALE_MS = 7 * DAY_MS;
/** 「あとで」で閉じてから、次に勧めるまでの期間。全編み図で共通。 */
export const BACKUP_REMINDER_SNOOZE_MS = 3 * DAY_MS;
/** 一度に多く編集したとみなす回数。なぞり描き1回、貼り付け1回、元に戻す1回をそれぞれ1回と数える。 */
export const BACKUP_REMINDER_EDIT_THRESHOLD = 50;
/** 「あとで」で閉じた日時の設定キー。 */
export const BACKUP_REMINDER_SNOOZE_KEY = 'backupReminderSnoozedUntil';

export interface BackupReminderInput {
  now: number;
  /** 最後に`.knit`へ書き出した日時。まだ書き出していなければ`undefined`。 */
  lastBackupAt: number | undefined;
  /** 編み図を作った日時。まだ書き出していない編み図の期間はここから数える。 */
  createdAt: number;
  /** 編み図を開いた時点で、最後のバックアップ（無ければ作成）の後に変更があったか。 */
  changedBeforeOpen: boolean;
  /** 開いてから（または書き出し・「あとで」から）の編集回数。 */
  edits: number;
  /** この日時までは勧めない。 */
  snoozedUntil: number | undefined;
}

/** `never`はまだ一度も書き出していない、`changed`は前回の書き出しの後に変更がある。 */
export type BackupReminderKind = 'never' | 'changed';

export function backupReminderKind(input: BackupReminderInput): BackupReminderKind | undefined {
  if (!input.changedBeforeOpen && input.edits === 0) return undefined;
  if (input.snoozedUntil !== undefined && input.now < input.snoozedUntil) return undefined;
  const since = input.lastBackupAt ?? input.createdAt;
  const stale = input.now - since >= BACKUP_REMINDER_STALE_MS;
  if (!stale && input.edits < BACKUP_REMINDER_EDIT_THRESHOLD) return undefined;
  return input.lastBackupAt === undefined ? 'never' : 'changed';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 端末の時刻で「2026年10月6日 14:05」の形にする。 */
export function formatBackupDateTime(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${pad(date.getMinutes())}`;
}

/** 保存・出力パネルのバックアップ欄に出す、開いている編み図の書き出し状況。 */
export function backupStatusText(lastBackupAt: number | undefined): string {
  return lastBackupAt === undefined
    ? 'この編み図はまだバックアップしていません。'
    : `この編み図の最後のバックアップ：${formatBackupDateTime(lastBackupAt)}`;
}

/** 勧めの文言。狭い画面でも1〜2行に収まる長さにし、理由は保存・出力パネルの案内文に任せる。 */
export function backupReminderText(kind: BackupReminderKind, lastBackupAt: number | undefined): string {
  if (kind === 'never' || lastBackupAt === undefined) return 'この編み図はまだバックアップしていません。';
  const date = new Date(lastBackupAt);
  return `${date.getMonth() + 1}月${date.getDate()}日のバックアップの後に変更があります。`;
}
