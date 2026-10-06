import { useCallback, useEffect, useRef, useState } from 'react';
import { getLastBackupAt, getSetting, recordBackup, setSetting, type ChartDocument } from '../storage/database';
import {
  BACKUP_REMINDER_SNOOZE_KEY, BACKUP_REMINDER_SNOOZE_MS, backupReminderKind, type BackupReminderKind,
} from './backupReminder';

/**
 * 編集の手を止めてから勧めの表示を見直すまでの時間。帯が出ると盤面が1段下がるので、
 * 続けてタップしている最中に出すと、次のタップが狙いと違うマスに入る。
 */
export const BACKUP_REMINDER_IDLE_MS = 2_500;

interface OpenedDocumentStatus {
  documentId: string;
  lastBackupAt: number | undefined;
  changedBeforeOpen: boolean;
}

export interface BackupReminder {
  /** 開いている編み図の最後の書き出し日時。読み込み中と未書き出しは`undefined`。 */
  lastBackupAt: number | undefined;
  /** 記録を読み終えたか。読み込み中は日時も勧めも出さない。 */
  loaded: boolean;
  /** 勧めを出すときの種類。出さないときは`undefined`。 */
  kind: BackupReminderKind | undefined;
  /** 盤面を1回編集したときに呼ぶ。手を止めてから`BACKUP_REMINDER_IDLE_MS`後に勧めへ反映する。 */
  countEdit: () => void;
  /** `.knit`を書き出したあとに呼ぶ。`documentIds`を省くと全編み図を書き出したとみなす。 */
  recordExport: (documentIds?: string[]) => Promise<void>;
  /** 「あとで」。`BACKUP_REMINDER_SNOOZE_MS`のあいだ全編み図で勧めない。 */
  snooze: () => void;
}

/**
 * 最後の`.knit`書き出し日時を読み書きし、勧めを出すかを決める。
 *
 * 勧めの表示・非表示は、編み図を開いたとき、編集の手を`BACKUP_REMINDER_IDLE_MS`止めたとき、
 * 書き出したとき、「あとで」を押したときだけ変わる。編集中に帯が出て盤面がずれないよう、
 * 編集回数と時刻はこの時点で取り込み、描画のたびには読まない。
 */
export function useBackupReminder(activeDocument: ChartDocument | undefined): BackupReminder {
  const [opened, setOpened] = useState<OpenedDocumentStatus>();
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>();
  // 編集回数は手を止めるまで`editsRef`にだけ数え、止めたら`edits`へ移す。
  const editsRef = useRef(0);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const [edits, setEdits] = useState(0);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const activeDocumentRef = useRef(activeDocument);
  activeDocumentRef.current = activeDocument;
  const documentId = activeDocument?.id;

  useEffect(() => {
    let cancelled = false;
    void getSetting(BACKUP_REMINDER_SNOOZE_KEY)
      .then((value) => { if (!cancelled) setSnoozedUntil(typeof value === 'number' ? value : null); })
      // 読めなくても編集は続けられる。勧めが出ないだけにする。
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const resetEdits = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = undefined;
    editsRef.current = 0;
    setEdits(0);
  }, []);

  useEffect(() => () => window.clearTimeout(idleTimerRef.current), []);

  useEffect(() => {
    const document = activeDocumentRef.current;
    if (!documentId || !document) return;
    let cancelled = false;
    resetEdits();
    void getLastBackupAt(documentId).then((lastBackupAt) => {
      if (cancelled) return;
      setOpened({
        documentId,
        lastBackupAt,
        changedBeforeOpen: document.updatedAt > (lastBackupAt ?? document.createdAt),
      });
      setCheckedAt(Date.now());
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documentId, resetEdits]);

  const countEdit = useCallback(() => {
    editsRef.current += 1;
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = undefined;
      setEdits(editsRef.current);
      setCheckedAt(Date.now());
    }, BACKUP_REMINDER_IDLE_MS);
  }, []);

  const recordExport = useCallback(async (documentIds?: string[]) => {
    const at = Date.now();
    // 書き出したファイルはもう利用者の手元にあるので、記録に失敗しても書き出しの失敗とはしない。
    try { await recordBackup(documentIds, at); } catch { return; }
    const currentId = activeDocumentRef.current?.id;
    if (!currentId || (documentIds && !documentIds.includes(currentId))) return;
    setOpened({ documentId: currentId, lastBackupAt: at, changedBeforeOpen: false });
    resetEdits();
    setCheckedAt(at);
  }, [resetEdits]);

  const snooze = useCallback(() => {
    const until = Date.now() + BACKUP_REMINDER_SNOOZE_MS;
    setSnoozedUntil(until);
    resetEdits();
    void setSetting(BACKUP_REMINDER_SNOOZE_KEY, until).catch(() => undefined);
  }, [resetEdits]);

  const current = activeDocument && opened?.documentId === activeDocument.id ? opened : undefined;
  const kind = current && activeDocument && snoozedUntil !== undefined
    ? backupReminderKind({
      now: checkedAt,
      lastBackupAt: current.lastBackupAt,
      createdAt: activeDocument.createdAt,
      changedBeforeOpen: current.changedBeforeOpen,
      edits,
      snoozedUntil: snoozedUntil ?? undefined,
    })
    : undefined;

  return { lastBackupAt: current?.lastBackupAt, loaded: current !== undefined, kind, countEdit, recordExport, snooze };
}
