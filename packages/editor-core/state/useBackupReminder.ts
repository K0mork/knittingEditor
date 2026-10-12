import { useCallback, useEffect, useRef, useState } from 'react';
import { getLastBackupAt, getSetting, recordBackup, setSetting, type ChartDocument } from '../storage/database';
import {
  BACKUP_REMINDER_SNOOZE_KEY, BACKUP_REMINDER_SNOOZE_MS, backupReminderKind, type BackupReminderKind,
} from './backupReminder';

/**
 * 編集の手を止めてから勧めの表示を見直すまでの時間。帯が出ると盤面が1段下がるので、
 * 続けてタップしている最中に出すと、次のタップが狙いと違うマスに入る。
 * 指・ポインタを画面に置いている間（なぞり描き、2本指の移動・拡大、範囲選択の途中）は数えず、
 * すべて離してから数え直す。
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
  /** 日時と「あとで」の記録を読み終えたか。読み込み中は日時も勧めも出さない。 */
  loaded: boolean;
  /** 勧めを出すときの種類。出さないときは`undefined`。 */
  kind: BackupReminderKind | undefined;
  /** 保存の失敗を帯で伝えるか。勧めと同じく、手を止めたときだけ切り替わる。 */
  saveFailureShown: boolean;
  /** 盤面を1回編集したときに呼ぶ。指を離して手を止めてから`BACKUP_REMINDER_IDLE_MS`後に勧めへ反映する。 */
  countEdit: () => void;
  /** `.knit`を書き出したあとに呼ぶ。`documentIds`を省くと全編み図を書き出したとみなす。 */
  recordExport: (documentIds?: string[], at?: number, isCurrent?: () => boolean) => Promise<void>;
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
export function useBackupReminder(activeDocument: ChartDocument | undefined, saveFailing = false): BackupReminder {
  const [opened, setOpened] = useState<OpenedDocumentStatus>();
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>();
  // 編集回数は手を止めるまで`editsRef`にだけ数え、止めたら`edits`へ移す。
  const editsRef = useRef(0);
  // `edits`へまだ移していない編集があるか。指を離したときに待ち時間を数え直すかを決める。
  const pendingRef = useRef(false);
  // 保存の失敗・回復をまだ帯へ反映していないか。帯の出し入れで盤面がずれるので、勧めと同じく手を止めてから反映する。
  const saveFailingRef = useRef(saveFailing);
  saveFailingRef.current = saveFailing;
  const noticePendingRef = useRef(false);
  const [saveFailureShown, setSaveFailureShown] = useState(false);
  const idleTimerRef = useRef<number | undefined>(undefined);
  // 画面に置かれている指・ポインタ。1つでもある間は待ち時間を数えない。
  const pointersRef = useRef(new Set<number>());
  const [edits, setEdits] = useState(0);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const activeDocumentRef = useRef(activeDocument);
  activeDocumentRef.current = activeDocument;
  const documentId = activeDocument?.id;

  useEffect(() => {
    let cancelled = false;
    void getSetting(BACKUP_REMINDER_SNOOZE_KEY)
      .then((value) => { if (!cancelled) setSnoozedUntil(typeof value === 'number' ? value : null); })
      // 読めなくても編集は続けられる。この画面では勧めが出ないだけにする。
      .catch(() => { if (!cancelled) setSnoozedUntil(Number.POSITIVE_INFINITY); });
    return () => { cancelled = true; };
  }, []);

  const clearIdleTimer = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = undefined;
  }, []);

  /** 手を止めてから`BACKUP_REMINDER_IDLE_MS`後に編集回数を取り込む。指を置いている間は待たない。 */
  const scheduleIdleCheck = useCallback(() => {
    clearIdleTimer();
    if ((!pendingRef.current && !noticePendingRef.current) || pointersRef.current.size > 0) return;
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = undefined;
      pendingRef.current = false;
      noticePendingRef.current = false;
      setEdits(editsRef.current);
      setSaveFailureShown(saveFailingRef.current);
      setCheckedAt(Date.now());
    }, BACKUP_REMINDER_IDLE_MS);
  }, [clearIdleTimer]);

  const resetEdits = useCallback(() => {
    clearIdleTimer();
    pendingRef.current = false;
    editsRef.current = 0;
    setEdits(0);
    // 保存の失敗の反映待ちは編集回数と別なので、待ち時間を数え直して残す。
    scheduleIdleCheck();
  }, [clearIdleTimer, scheduleIdleCheck]);

  useEffect(() => {
    noticePendingRef.current = saveFailing !== saveFailureShown;
    if (noticePendingRef.current) scheduleIdleCheck();
  }, [saveFailing, saveFailureShown, scheduleIdleCheck]);

  useEffect(() => {
    // 盤面は指を置いたまま描き続けるので、指を置いた時点で待ち時間を止め、離してから数え直す。
    // 盤面に限らず画面全体で見る。2本指の操作や範囲選択も同じに扱え、盤面側に手を入れずに済む。
    // 盤面はポインタを捕まえるので、指を離したときの通知は盤面の外でも届く。
    const press = (event: PointerEvent) => {
      pointersRef.current.add(event.pointerId);
      clearIdleTimer();
    };
    const release = (event: PointerEvent) => {
      if (!pointersRef.current.delete(event.pointerId)) return;
      scheduleIdleCheck();
    };
    // 離した通知を受け取れないまま画面を離れたときに、待ちが止まったままにならないようにする。
    const forget = () => {
      if (pointersRef.current.size === 0) return;
      pointersRef.current.clear();
      scheduleIdleCheck();
    };
    window.addEventListener('pointerdown', press, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', forget);
    return () => {
      window.removeEventListener('pointerdown', press, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', forget);
      clearIdleTimer();
    };
  }, [clearIdleTimer, scheduleIdleCheck]);

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
    pendingRef.current = true;
    scheduleIdleCheck();
  }, [scheduleIdleCheck]);

  const recordExport = useCallback(async (documentIds?: string[], at = Date.now(), isCurrent: () => boolean = () => true) => {
    // 書き出したファイルはもう利用者の手元にあるので、記録に失敗しても書き出しの失敗とはしない。
    try { await recordBackup(documentIds, at); } catch { return; }
    const currentId = activeDocumentRef.current?.id;
    if (!isCurrent() || !currentId || (documentIds && !documentIds.includes(currentId))) return;
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

  const loaded = current !== undefined && snoozedUntil !== undefined;
  return { lastBackupAt: current?.lastBackupAt, loaded, kind, saveFailureShown, countEdit, recordExport, snooze };
}
