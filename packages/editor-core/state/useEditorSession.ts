import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, type PatternBlock } from '../model/Board';
import { BoardHistory } from '../model/BoardHistory';
import { backgroundColorOf } from '../model/boardColors';
import { errorMessage } from '../util/errors';
import { boardFromDocument, listBlocks, listDocuments, recordBackup, saveDocument, setSetting, type ChartDocument } from '../storage/database';

export const AUTOSAVE_DELAY_MS = 400;

/**
 * 保存の結果。
 * - `idle`: 未保存の変更がなく、何も書き込んでいない。
 * - `saved`: 書き込みが完了し、未保存の変更は残っていない。
 * - `pending`: 書き込みは完了したが、その間に入った編集や編み図の切り替えが残っている。
 * - `failed`: 書き込みに失敗した。端末内のデータは古いままになる。
 */
export type SaveOutcome = 'idle' | 'saved' | 'pending' | 'failed';

export type SaveTrigger = 'autosave' | 'manual' | 'background';

/**
 * 編み図切り替えの結果。
 * - `switched`: 切り替えた。
 * - `pending`: 直前の変更を書き切れていないので切り替えなかった。`onSaveError`は呼ばれない。
 * - `failed`: 書き込みに失敗したので切り替えなかった。理由は`onSaveError`で通知済み。
 */
export type SwitchOutcome = 'switched' | 'pending' | 'failed';

export interface EditorSessionInit {
  documents: ChartDocument[];
  activeId: string;
  blocks: PatternBlock[];
}

export interface EditorSessionOptions {
  /** 端末内データの読み出し。Web版は旧localStorageからの移行、iOS版はタイムアウトを挟む。 */
  initialize: () => Promise<EditorSessionInit>;
  onInitialized?: (initialized: EditorSessionInit) => void;
  onInitializationError: (message: string) => void;
  onSaveError: (error: unknown, trigger: SaveTrigger) => void;
}

export interface EditorSession {
  documents: ChartDocument[];
  activeDocument: ChartDocument | undefined;
  board: Board | undefined;
  /** 開いている編み図の地の色（`#rrggbb`）。 */
  backgroundColor: string;
  blocks: PatternBlock[];
  revision: number;
  dirty: boolean;
  /** 最後の書き込みが失敗したか。次の書き込みが成功するまで`true`のまま。 */
  saveFailed: boolean;
  /** 開いている編み図と編集の世代。書き出し中に盤面が変わったかを比べるのに使う。 */
  backupGeneration: () => string;
  /** 保存の成否によらず、開いている編み図の今の盤面を写した記録を返す。`updatedAt`は写した時刻。 */
  backupSnapshot: () => ChartDocument | undefined;
  /**
   * 書き出した世代の日時を記録する直前に呼ぶ。世代が変わっていれば`undefined`を返す。
   * 変わっていなければ、記録する日時の下限（その世代までを保存した更新日時）を返し、
   * 後からこの世代を保存したときも記録した日時を保存の更新日時へ進める。
   */
  markBackupExported: (generation: string) => number | undefined;
  /** 盤面を編集したときに呼ぶ。自動保存の待ち時間を測り直す。履歴には積まない。 */
  changed: () => void;
  /** ここまでの編集を元に戻す単位として1件にまとめる。なぞり描きは指を離したときに呼ぶ。 */
  commitEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** 盤面を書き換えたときだけ`true`を返す。自動保存の対象になる。 */
  undo: () => boolean;
  redo: () => boolean;
  /** 保留中の変更をすぐ書き込む。バックアップ前やバックグラウンド移行前に使う。 */
  saveNow: (trigger?: SaveTrigger) => Promise<SaveOutcome>;
  /** 切り替え前に保留中の変更を書き込む。書き切れないときは盤面を差し替えず理由を返す。 */
  switchDocument: (document: ChartDocument, saveCurrent?: boolean) => Promise<SwitchOutcome>;
  refreshDocuments: () => Promise<void>;
  refreshBlocks: () => Promise<void>;
  applyActiveDocumentName: (name: string) => void;
  /** 地の色を変える。盤面の編集と同じく自動保存するが、元に戻す履歴には積まない。 */
  setBackgroundColor: (color: string) => void;
}

/** 保存済み1件だけを一覧へ反映する。`listDocuments`と同じ更新日時の降順を保つ。 */
export function mergeSavedDocument(documents: ChartDocument[], saved: ChartDocument): ChartDocument[] {
  const merged = documents.some((item) => item.id === saved.id)
    ? documents.map((item) => (item.id === saved.id ? saved : item))
    : [...documents, saved];
  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 編み図の読み込み・自動保存・切り替えをWeb版とiOS版で共有する。
 *
 * 保存経路はここに集約する。以前はiOS版の即時保存だけが世代番号を確認せず`dirty`を
 * 解除していたため、書き込み中に入った編集が未保存のまま「保存済み」と表示されうる状態
 * だった。自動保存も即時保存も同じ`persist`を通し、世代番号が進んでいれば`dirty`を残す。
 */
export function useEditorSession(options: EditorSessionOptions): EditorSession {
  const [documents, setDocuments] = useState<ChartDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<ChartDocument>();
  const [board, setBoard] = useState<Board>();
  const [backgroundColor, setBackgroundColorState] = useState(() => backgroundColorOf({}));
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  // 保存はイベントハンドラからも呼ばれる。再描画を待たずに最新値を読むためrefでも持つ。
  const activeDocumentRef = useRef<ChartDocument | undefined>(undefined);
  const boardRef = useRef<Board | undefined>(undefined);
  // 地の色は編み図の記録ではなくここを正とする。書き込み中に色を変えても、書き込み前の記録で
  // 上書きされて古い色へ戻らないようにするため。保存するときに記録へ入れる。
  const backgroundRef = useRef(backgroundColor);
  const dirtyRef = useRef(false);
  const editGenerationRef = useRef(0);
  // 書き出して日時を記録した世代（`編み図ID:編集世代`）。保存は書き出しを待たないので、
  // 書き出した盤面が後から保存されると更新日時が記録より新しくなり、次に開いたとき
  // 「バックアップの後に変更があります」と誤って出る。その保存の日時で記録を進める。
  const exportedGenerationRef = useRef<string | undefined>(undefined);
  // 履歴は開いている編み図ごとに持ち、端末へは保存しない。切り替えると捨てる。
  const historyRef = useRef<BoardHistory | undefined>(undefined);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistory = useCallback(() => {
    setCanUndo(historyRef.current?.canUndo ?? false);
    setCanRedo(historyRef.current?.canRedo ?? false);
  }, []);

  const resetHistory = useCallback((target: Board) => {
    historyRef.current = new BoardHistory(target);
    syncHistory();
  }, [syncHistory]);

  const persist = useCallback(async (document: ChartDocument, target: Board, trigger: SaveTrigger): Promise<SaveOutcome> => {
    const documentId = document.id;
    const generation = editGenerationRef.current;
    let saved: ChartDocument;
    try {
      saved = await saveDocument({ ...document, backgroundColor: backgroundRef.current }, target);
    } catch (error) {
      setSaveFailed(true);
      optionsRef.current.onSaveError(error, trigger);
      return 'failed';
    }
    setSaveFailed(false);
    if (exportedGenerationRef.current === `${documentId}:${generation}`) {
      // 記録に失敗しても保存の失敗ではない。次に開いたとき勧めが出るだけになる。
      void recordBackup([documentId], saved.updatedAt).catch(() => undefined);
    }
    // 書き込んだ1件だけを一覧へ反映する。全件取得だと編集していない編み図の
    // セル配列まで読み直すことになり、保存済みの編み図が増えるほど重くなる。
    setDocuments((current) => mergeSavedDocument(current, saved));
    if (activeDocumentRef.current?.id !== documentId) return 'pending';
    activeDocumentRef.current = saved;
    setActiveDocument((current) => (current?.id === documentId ? saved : current));
    // 書き込み開始後に編集が入っていれば未保存の変更が残る。dirtyは解除しない。
    if (editGenerationRef.current !== generation) return 'pending';
    dirtyRef.current = false;
    setDirty(false);
    return 'saved';
  }, []);

  useEffect(() => {
    void (async () => {
      const initialized = await optionsRef.current.initialize();
      const document = initialized.documents.find((item) => item.id === initialized.activeId) ?? initialized.documents[0];
      activeDocumentRef.current = document;
      boardRef.current = boardFromDocument(document);
      backgroundRef.current = backgroundColorOf(document);
      resetHistory(boardRef.current);
      setDocuments(initialized.documents);
      setActiveDocument(document);
      setBoard(boardRef.current);
      setBackgroundColorState(backgroundRef.current);
      setBlocks(initialized.blocks);
      optionsRef.current.onInitialized?.(initialized);
    })().catch((error) => {
      optionsRef.current.onInitializationError(errorMessage(error));
    });
  }, [resetHistory]);

  useEffect(() => {
    if (!dirty || !activeDocument || !board) return;
    const timer = window.setTimeout(() => { void persist(activeDocument, board, 'autosave'); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, revision, activeDocument, board, persist]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const changed = useCallback(() => {
    editGenerationRef.current += 1;
    dirtyRef.current = true;
    setRevision((value) => value + 1);
    setDirty(true);
  }, []);

  const commitEdit = useCallback(() => {
    const target = boardRef.current;
    if (target && historyRef.current?.record(target)) syncHistory();
  }, [syncHistory]);

  const stepHistory = useCallback((direction: 'undo' | 'redo') => {
    const target = boardRef.current;
    const history = historyRef.current;
    if (!target || !history) return false;
    const moved = direction === 'undo' ? history.undo(target) : history.redo(target);
    syncHistory();
    if (moved) changed();
    return moved;
  }, [changed, syncHistory]);
  const undo = useCallback(() => stepHistory('undo'), [stepHistory]);
  const redo = useCallback(() => stepHistory('redo'), [stepHistory]);

  const saveNow = useCallback(async (trigger: SaveTrigger = 'manual'): Promise<SaveOutcome> => {
    const document = activeDocumentRef.current;
    const target = boardRef.current;
    if (!dirtyRef.current || !document || !target) return 'idle';
    return persist(document, target, trigger);
  }, [persist]);

  const switchDocument = useCallback(async (document: ChartDocument, saveCurrent = true): Promise<SwitchOutcome> => {
    if (saveCurrent) {
      // 書き切れていないまま盤面を差し替えると、直前の編集がどこにも残らない。
      const outcome = await saveNow();
      if (outcome === 'failed' || outcome === 'pending') return outcome;
    }
    const nextBoard = boardFromDocument(document);
    activeDocumentRef.current = document;
    boardRef.current = nextBoard;
    backgroundRef.current = backgroundColorOf(document);
    resetHistory(nextBoard);
    dirtyRef.current = false;
    setActiveDocument(document);
    setBoard(nextBoard);
    setBackgroundColorState(backgroundRef.current);
    setRevision((value) => value + 1);
    setDirty(false);
    await setSetting('activeDocumentId', document.id);
    return 'switched';
  }, [saveNow, resetHistory]);

  const refreshDocuments = useCallback(async () => setDocuments(await listDocuments()), []);
  const refreshBlocks = useCallback(async () => setBlocks(await listBlocks()), []);

  const applyActiveDocumentName = useCallback((name: string) => {
    setActiveDocument((current) => {
      if (!current) return current;
      const renamed = { ...current, name };
      activeDocumentRef.current = renamed;
      return renamed;
    });
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    const next = backgroundColorOf({ backgroundColor: color });
    if (next === backgroundRef.current) return;
    backgroundRef.current = next;
    setBackgroundColorState(next);
    changed();
  }, [changed]);

  const backupGeneration = useCallback(() => `${activeDocumentRef.current?.id}:${editGenerationRef.current}`, []);

  const backupSnapshot = useCallback((): ChartDocument | undefined => {
    const document = activeDocumentRef.current;
    const target = boardRef.current;
    if (!document || !target) return undefined;
    return { ...document, backgroundColor: backgroundRef.current, rows: target.rows, cols: target.cols,
      cells: target.cells.slice().buffer as ArrayBuffer, updatedAt: Date.now() };
  }, []);

  const markBackupExported = useCallback((generation: string) => {
    if (backupGeneration() !== generation) return undefined;
    exportedGenerationRef.current = generation;
    // 書き出しを待つ間にこの世代の保存が済んでいれば、記録はその更新日時より前にしない。
    return activeDocumentRef.current?.updatedAt ?? 0;
  }, [backupGeneration]);

  return {
    documents, activeDocument, board, backgroundColor, blocks, revision, dirty, saveFailed,
    backupGeneration, backupSnapshot, markBackupExported,
    changed, commitEdit, canUndo, canRedo, undo, redo, saveNow, switchDocument, refreshDocuments, refreshBlocks, applyActiveDocumentName,
    setBackgroundColor,
  };
}
