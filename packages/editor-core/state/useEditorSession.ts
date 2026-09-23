import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, type PatternBlock } from '../model/Board';
import { errorMessage } from '../util/errors';
import { boardFromDocument, listBlocks, listDocuments, saveDocument, setSetting, type ChartDocument } from '../storage/database';

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
  blocks: PatternBlock[];
  revision: number;
  dirty: boolean;
  /** 盤面を編集したときに呼ぶ。自動保存の待ち時間を測り直す。 */
  changed: () => void;
  /** 保留中の変更をすぐ書き込む。バックアップ前やバックグラウンド移行前に使う。 */
  saveNow: (trigger?: SaveTrigger) => Promise<SaveOutcome>;
  /** 切り替え前に保留中の変更を書き込む。書き切れないときは盤面を差し替えず理由を返す。 */
  switchDocument: (document: ChartDocument, saveCurrent?: boolean) => Promise<SwitchOutcome>;
  refreshDocuments: () => Promise<void>;
  refreshBlocks: () => Promise<void>;
  applyActiveDocumentName: (name: string) => void;
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
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  // 保存はイベントハンドラからも呼ばれる。再描画を待たずに最新値を読むためrefでも持つ。
  const activeDocumentRef = useRef<ChartDocument | undefined>(undefined);
  const boardRef = useRef<Board | undefined>(undefined);
  const dirtyRef = useRef(false);
  const editGenerationRef = useRef(0);

  const persist = useCallback(async (document: ChartDocument, target: Board, trigger: SaveTrigger): Promise<SaveOutcome> => {
    const documentId = document.id;
    const generation = editGenerationRef.current;
    let saved: ChartDocument;
    try {
      saved = await saveDocument(document, target);
    } catch (error) {
      optionsRef.current.onSaveError(error, trigger);
      return 'failed';
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
      setDocuments(initialized.documents);
      setActiveDocument(document);
      setBoard(boardRef.current);
      setBlocks(initialized.blocks);
      optionsRef.current.onInitialized?.(initialized);
    })().catch((error) => {
      optionsRef.current.onInitializationError(errorMessage(error));
    });
  }, []);

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
    dirtyRef.current = false;
    setActiveDocument(document);
    setBoard(nextBoard);
    setRevision((value) => value + 1);
    setDirty(false);
    await setSetting('activeDocumentId', document.id);
    return 'switched';
  }, [saveNow]);

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

  return {
    documents, activeDocument, board, blocks, revision, dirty,
    changed, saveNow, switchDocument, refreshDocuments, refreshBlocks, applyActiveDocumentName,
  };
}
