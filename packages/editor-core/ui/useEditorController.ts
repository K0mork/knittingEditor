import { failureReason } from '../analyticsFailure';
import { WorkerVersionError } from '../util/workerStarter';
import type { ExportAnnotations } from '../export/annotations';
import { useCallback, useMemo, useRef, useState } from 'react';
import { boardSizeBucket, countBucket, NO_ANALYTICS, type EditorAnalytics } from '../analytics';
import { CANVAS_MODE_LABELS, type CanvasMode, type BoardZoom } from '../canvas/BoardCanvas';
import { renderPdf, renderPng, validatePngSize } from '../export/exporters';
import type { PdfLayoutOptions } from '../export/pdfLayout';
import type { PatternBlock, Rect } from '../model/Board';
import type { EditorPlatform } from '../platform';
import { useBackupReminder } from '../state/useBackupReminder';
import { useEditorSession, type EditorSessionInit, type SaveTrigger } from '../state/useEditorSession';
import { STITCHES, type StitchDefinition } from '../stitches/catalog';
import {
  createDocument, deleteBlock, deleteDocuments, duplicateDocument, exportBackup, importBackup,
  renameDocument, saveBlock, type ChartDocument,
} from '../storage/database';
import { errorMessage } from '../util/errors';
import { useClipboardShortcuts, useHistoryShortcuts, useNotifier, usePanelFocus } from './hooks';

export type BusyTask = 'PNGを生成中' | 'PDFを生成中' | 'バックアップを処理中';
export type EditorPanel = 'documents' | 'grid' | 'blocks' | 'export';

export const EDITOR_PANEL_TITLES: Record<EditorPanel, string> = {
  documents: '編み図', grid: '盤面設定', blocks: 'ブロック', export: '出力',
};

// 保存の書き込み中に次の編集が入ると、直前の変更が盤面にしか無い状態になる。
// 盤面を差し替える操作はそこで止めるので、止めた理由を利用者へ伝える。
const PENDING_SWITCH_MESSAGE = '編集中のため切り替えできませんでした。もう一度お試しください。';
const PENDING_RESTORE_MESSAGE = '編集中のため復元できませんでした。もう一度お試しください。';

export function saveErrorMessage(trigger: SaveTrigger): string {
  if (trigger === 'background') return 'バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。';
  if (trigger === 'autosave') return '自動保存に失敗しました。バックアップを保存してください。';
  return '変更を保存できませんでした。バックアップを保存してください。';
}

export interface ConfirmOptions {
  destructive?: boolean;
}

export interface EditorControllerOptions {
  autosaveDelayMs?: number;
  /** ポインタ操作の案内。省略すると修飾キー＋ホイールを案内する。 */
  pointerZoomGesture?: 'pinch';
  /** 端末内データの読み出し。Web版は旧localStorageからの移行、iOS版はタイムアウトを挟む。 */
  initialize: () => Promise<EditorSessionInit>;
  platform: EditorPlatform;
  /** 省略すると何も送らない。iOS版は渡さない。 */
  analytics?: EditorAnalytics;
  /** 名前や位置の入力。Web版は`window.prompt`、iOS版はアプリ内ダイアログを渡す。 */
  askText: (title: string, defaultValue?: string) => Promise<string | null>;
  askConfirm: (title: string, options?: ConfirmOptions) => Promise<boolean>;
}

/**
 * 編集画面の状態と操作をWeb版とiOS版で共有する。
 *
 * 画面の組み立ては`EditorView`が受け持ち、ここはReactの状態・保存・出力だけを持つ。
 * 環境で違う処理（入力ダイアログ、ファイルの受け渡し、分析）は`options`で受け取る。
 */
export function useEditorController(options: EditorControllerOptions) {
  const { platform, askText, askConfirm } = options;
  const analytics = options.analytics ?? NO_ANALYTICS;
  const [selectedStitch, setSelectedStitch] = useState('knit');
  const [stitchPickerOpen, setStitchPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#d33c32');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('draw');
  const [selection, setSelection] = useState<Rect>();
  const [pasteBlock, setPasteBlock] = useState<PatternBlock>();
  const [copiedBlock, setCopiedBlock] = useState<PatternBlock>();
  const [panel, setPanel] = useState<EditorPanel>();
  const [busy, setBusy] = useState<BusyTask>();
  const [initializationError, setInitializationError] = useState<string>();
  const boardZoomRef = useRef<BoardZoom>(null);
  const zoomBoard = useCallback((...args: Parameters<BoardZoom['zoom']>) => boardZoomRef.current?.zoom(...args), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { message, notificationAction, notify } = useNotifier();
  const { panelRef, rememberTrigger } = usePanelFocus<HTMLElement>(panel !== undefined);

  // 保存成功までは、編集や保存のきっかけが変わっても失敗の計測を重ねない。
  const saveFailureTrackedRef = useRef(false);
  const session = useEditorSession({
    initialize: options.initialize,
    autosaveDelayMs: options.autosaveDelayMs,
    onInitialized: (initialized) => analytics.track('editor_ready', {
      document_count_bucket: countBucket(initialized.documents.length),
    }),
    onInitializationError: (reason, error) => {
      analytics.track('operation_failed', { operation_name: 'editor_init', failure_reason: failureReason(error) });
      setInitializationError(reason);
    },
    onSaveError: (error, trigger) => {
      if (!saveFailureTrackedRef.current) {
        saveFailureTrackedRef.current = true;
        analytics.track('save_failed', { save_trigger: trigger, failure_reason: failureReason(error) });
      }
      notify(saveErrorMessage(trigger));
    },
    onSaveSuccess: () => { saveFailureTrackedRef.current = false; },
    onSaveConflict: (saved) => notify(`別のタブで変更されたため、この編集を「${saved.name}」として保存しました。`),
  });
  const {
    board, activeDocument, changed: markChanged, commitEdit, saveNow, switchDocument: switchSessionDocument,
    refreshDocuments, refreshBlocks, applyActiveDocumentName,
  } = session;
  const saveFailedRef = useRef(session.saveFailed);
  saveFailedRef.current = session.saveFailed;
  const backupReminder = useBackupReminder(activeDocument, session.saveFailed && session.dirty);
  const { countEdit } = backupReminder;

  // 指を離すたびに盤面全体を比べないよう、書き換えがあったときだけ履歴へ積む。
  const strokePendingRef = useRef(false);
  /** なぞり描きの途中の書き換え。指を離したときの`commitStroke`で1件の履歴になる。 */
  const strokeChanged = useCallback(() => {
    strokePendingRef.current = true;
    analytics.trackFirstEdit();
    markChanged();
  }, [analytics, markChanged]);
  const commitStroke = useCallback(() => {
    if (!strokePendingRef.current) return;
    strokePendingRef.current = false;
    commitEdit();
    countEdit();
  }, [commitEdit, countEdit]);
  /** 1回で終わる書き換え（貼り付け、盤面設定）。すぐ1件の履歴にする。 */
  const changed = useCallback(() => {
    strokePendingRef.current = false;
    analytics.trackFirstEdit();
    markChanged();
    commitEdit();
    countEdit();
  }, [analytics, markChanged, commitEdit, countEdit]);

  const stepHistory = useCallback((direction: 'undo' | 'redo') => {
    const moved = direction === 'undo' ? session.undo() : session.redo();
    if (!moved) return;
    countEdit();
    // 寸法が戻ると選択範囲が盤面の外を指しうるので、選択は解除する。
    setSelection(undefined);
    notify(direction === 'undo' ? '元に戻しました' : 'やり直しました');
  }, [session.undo, session.redo, notify, countEdit]);
  const undo = useCallback(() => stepHistory('undo'), [stepHistory]);
  const redo = useCallback(() => stepHistory('redo'), [stepHistory]);
  useHistoryShortcuts({ onUndo: undo, onRedo: redo });

  /** 失敗を記録して利用者へ伝える。出力やバックアップの`catch`で使う。 */
  const reportFailure = (operation: string, error: unknown) => {
    analytics.track('operation_failed', { operation_name: operation, failure_reason: failureReason(error) });
    if (error instanceof WorkerVersionError) {
      if (saveFailedRef.current) {
        notify('サイトが更新されました。端末内への保存に失敗しているため、再読み込みすると未保存の編集が失われます。先にPNGを保存してください。');
      } else {
        notify('サイトが更新されました。ページを再読み込みすると、もう一度お使いいただけます。', {
          label: '再読み込み', run: () => window.location.reload(),
        });
      }
    } else notify(errorMessage(error));
  };

  const togglePanel = (nextPanel: EditorPanel) => {
    const opening = panel !== nextPanel;
    if (opening) rememberTrigger();
    setPanel(opening ? nextPanel : undefined);
    if (opening) analytics.track('feature_opened', { feature_name: nextPanel });
  };
  const closePanel = () => setPanel(undefined);

  const chooseMode = (nextMode: CanvasMode) => { setMode(nextMode); setSelection(undefined); };
  const clearSelection = () => { setSelection(undefined); setMode('draw'); };
  const startSelecting = () => { setMode('select'); setPanel(undefined); };

  const selectStitch = (key: string) => {
    setSelectedStitch(key);
    setMode('draw');
    setSelection(undefined);
    setStitchPickerOpen(false);
    analytics.track('stitch_selected', { stitch_key: key });
  };

  /** 使っている色の一覧から選んだとき。記号を選んだときと同じく、そのまま描けるようにする。 */
  const selectColor = (color: string) => {
    setSelectedColor(color);
    setMode('draw');
    setSelection(undefined);
    setColorPickerOpen(false);
  };

  /**
   * 編み図を切り替える。一覧から選んだときはパネルを閉じて盤面を見せる。
   * 削除に伴う切り替えでは`keepPanel`を立て、続けて一覧を操作できるよう開いたままにする（#267）。
   */
  const switchDocument = useCallback(async (document: ChartDocument, saveCurrent = true, remember = true, keepPanel = false) => {
    if (document.id === activeDocument?.id) { if (!keepPanel) setPanel(undefined); return 'switched' as const; }
    let outcome;
    try { outcome = await switchSessionDocument(document, saveCurrent, remember); }
    catch {
      notify('編み図を開けませんでした。もう一度お試しください。');
      return;
    }
    // failedは`onSaveError`が通知済み。pendingは通知が出ないので、ここで理由を伝える。
    // 黙って何も起きないと、切り替えを押したつもりの利用者が変化に気づけない。
    if (outcome === 'pending') notify(PENDING_SWITCH_MESSAGE);
    if (outcome !== 'switched') return outcome;
    setSelection(undefined);
    setMode('draw');
    if (!keepPanel) setPanel(undefined);
    return outcome;
  }, [switchSessionDocument, activeDocument?.id, notify]);

  const startPaste = useCallback((block: PatternBlock) => {
    setCopiedBlock(block);
    setPasteBlock(block);
    setMode('paste');
    setSelection(undefined);
  }, []);

  const copySelection = useCallback(() => {
    if (!board || !selection) return;
    startPaste(board.createBlock(selection, 'コピーした範囲'));
  }, [board, selection, startPaste]);

  const choosePasteBlock = (block: PatternBlock) => { startPaste(block); setPanel(undefined); };

  const handlePasteComplete = (ok: boolean) => {
    if (!ok) { notify('盤面からはみ出すため貼付できません'); return; }
    changed();
    setMode('draw');
    setPasteBlock(undefined);
    analytics.track('block_pasted');
    notify('ブロックを貼付しました');
  };

  const pasteCopiedBlock = useCallback(() => { if (copiedBlock) startPaste(copiedBlock); }, [copiedBlock, startPaste]);
  useClipboardShortcuts({
    canCopy: selection !== undefined,
    canPaste: copiedBlock !== undefined,
    onCopy: copySelection,
    onPaste: pasteCopiedBlock,
  });

  const runManagementOperation = async (operation: string, label: string, action: () => Promise<void>) => {
    try { await action(); }
    catch (error) {
      analytics.track('operation_failed', { operation_name: operation, failure_reason: failureReason(error) });
      notify(`${label}に失敗しました。もう一度お試しください。`);
    }
  };

  // 書き込み中の自動保存を待つ。次の編集が残る場合は、管理操作を始めない。
  const saveBeforeManagement = async (label: string) => {
    const outcome = await saveNow();
    if (outcome === 'failed' || outcome === 'pending') {
      notify(`${label}できませんでした。変更を保存してから、もう一度お試しください。`);
      return false;
    }
    return true;
  };

  const saveSelectionAsBlock = () => runManagementOperation('block_save', 'ブロックの保存', async () => {
    if (!board || !selection) return;
    const name = (await askText('ブロック名を入力してください', '新しいパターン'))?.trim();
    if (!name) return;
    const block = board.createBlock(selection, name);
    await saveBlock(block);
    session.updateBlock(block);
    setSelection(undefined);
    setMode('draw');
    analytics.track('block_saved', { board_size_bucket: boardSizeBucket(block.rows, block.cols) });
    notify('ブロックを保存しました');
  });

  const removeBlock = (block: PatternBlock) => runManagementOperation('block_delete', 'ブロックの削除', async () => {
    // 削除は元に戻せないので、編み図の削除と同じく確認する。
    if (!(await askConfirm(`ブロック「${block.name}」を削除しますか？`, { destructive: true }))) return;
    await deleteBlock(block.id);
    session.removeBlock(block.id);
  });

  const runPngExport = async (cellSize: number, options: ExportAnnotations = {}) => {
    if (!board || !activeDocument) return;
    const validation = validatePngSize(board, cellSize, options);
    if (!validation.valid) { notify(`${validation.reason}。PDF保存をおすすめします。`); return; }
    setBusy('PNGを生成中');
    try {
      await platform.saveFile(await renderPng(board, cellSize, session.backgroundColor, { ...options, title: activeDocument.name }), `${activeDocument.name}.png`);
      analytics.track('chart_exported', { export_format: 'png', board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    } catch (error) { reportFailure('png_export', error); }
    finally { setBusy(undefined); }
  };

  const runPdfExport = async (pdfOptions: PdfLayoutOptions) => {
    if (!board || !activeDocument) return;
    notify('');
    setBusy('PDFを生成中');
    try {
      await platform.saveFile(await renderPdf(board, { ...pdfOptions, title: activeDocument.name }, session.backgroundColor), `${activeDocument.name}.pdf`);
      analytics.track('chart_exported', { export_format: 'pdf', pdf_layout: pdfOptions.layout, board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    } catch (error) { reportFailure('pdf_export', error); }
    finally { setBusy(undefined); }
  };

  const createNewDocument = () => runManagementOperation('chart_create', '編み図の作成', async () => {
    const name = (await askText('編み図名を入力してください', '新しい編み図'))?.trim();
    if (!name || !(await saveBeforeManagement('編み図を作成'))) return;
    const document = await createDocument(name);
    session.updateDocument(document);
    // 作成と開く編み図の設定は、同じトランザクションで保存済み。
    await switchDocument(document, false, false);
    analytics.track('chart_created');
  });

  const renameChart = (document: ChartDocument) => runManagementOperation('chart_rename', '編み図の名前変更', async () => {
    const name = (await askText('新しい名前', document.name))?.trim();
    if (!name) return;
    if (document.id === activeDocument?.id && !(await saveBeforeManagement('編み図の名前を変更'))) return;
    const renamed = await renameDocument(document.id, name);
    session.updateDocument(renamed);
    if (session.activeSnapshot()?.id === renamed.id) applyActiveDocumentName(renamed.name, renamed.updatedAt);
  });

  const duplicateChart = (document: ChartDocument) => runManagementOperation('chart_duplicate', '編み図の複製', async () => {
    // 保存の成否や書き込み中の編集に依存せず、押した時点の盤面を独立した配列へコピーする。
    const snapshot = document.id === activeDocument?.id ? session.activeSnapshot() : undefined;
    const copy = await duplicateDocument(document.id, snapshot?.id === document.id ? snapshot : undefined);
    session.updateDocument(copy);
    notify('編み図を複製しました');
  });

  /**
   * 選んだ編み図をまとめて削除する。編み図は最低1件残す。開いている編み図を含むときは残りの
   * 先頭へ切り替え、続けて操作できるよう一覧は開いたままにする（#267、#268）。
   */
  const deleteCharts = (targets: readonly ChartDocument[]) => runManagementOperation('chart_delete', '編み図の削除', async () => {
    const ids = new Set(targets.map((document) => document.id));
    const remaining = session.documents.filter((item) => !ids.has(item.id));
    if (!ids.size || !remaining.length) return;
    const title = ids.size === 1 ? `「${targets[0].name}」を削除しますか？` : `選んだ${ids.size}件の編み図を削除しますか？`;
    if (!(await askConfirm(title, { destructive: true }))) return;
    const active = activeDocument !== undefined && ids.has(activeDocument.id);
    if (active && !(await saveBeforeManagement('編み図を削除'))) return;
    // 削除が失敗したら、開いている編み図も一覧も変えない。
    await deleteDocuments([...ids], active ? remaining[0].id : undefined);
    for (const id of ids) session.removeDocument(id);
    if (active) await switchDocument(remaining[0], false, false, true);
  });

  const deleteChart = (document: ChartDocument) => deleteCharts([document]);

  const backup = async (all: boolean) => {
    if (!activeDocument) return;
    setBusy('バックアップを処理中');
    try {
      // 保存先の障害や保存中の編集に左右されず、この時点の盤面を退避する。
      const snapshot = session.backupSnapshot();
      if (!snapshot) return;
      const generation = session.backupGeneration();
      const at = snapshot.updatedAt;
      let exportedIds: string[] = [];
      const blob = await exportBackup(all ? undefined : [snapshot.id], snapshot, (ids) => { exportedIds = ids; });
      const { saved } = await platform.saveFile(blob, all ? 'knitting-editor-backup.knit' : `${activeDocument.name}.knit`);
      analytics.track('backup_exported', { backup_scope: all ? 'all' : 'current' });
      // 確認ダイアログや共有シートを閉じるまで待つので、その間は処理中の表示を出さない。
      setBusy(undefined);
      // 取りやめたら記録しない。結果が分からないhost（ダウンロード）では、渡した時点を書き出した日時とする。
      if (await saved === false) return;
      // 共有中に盤面が変わっていれば、渡したファイルは今の盤面のバックアップではない。
      const savedAt = session.markBackupExported(generation);
      if (savedAt === undefined) return;
      await backupReminder.recordExport(exportedIds, Math.max(at, savedAt),
        () => session.backupGeneration() === generation);
    } catch (error) { reportFailure('backup_export', error); }
    finally { setBusy(undefined); }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    setBusy('バックアップを処理中');
    try {
      const outcome = await saveNow();
      if (outcome === 'pending') { notify(PENDING_RESTORE_MESSAGE); return; }
      if (outcome === 'failed') return;
      const result = await importBackup(file);
      await refreshDocuments();
      await refreshBlocks();
      const switched = result.documents[0] ? await switchDocument(result.documents[0]) : 'switched';
      analytics.track('backup_restored', { document_count_bucket: countBucket(result.count) });
      const restored = `${result.count}件の編み図を復元しました`;
      // 保存失敗は上部の帯がバックアップを勧めるので、ここでは切り替えなかったことだけを伝える。
      if (switched === 'failed' || switched === 'pending') notify(`${result.count}件を復元しました。編集中の編み図が未保存のため、切り替えていません。`);
      else if (switched !== 'switched') notify(`${restored}。復元した編み図を開けませんでした。もう一度お試しください。`);
      else notify(restored);
    } catch (error) { reportFailure('backup_restore', error); }
    finally { setBusy(undefined); }
  };

  const currentStitch: StitchDefinition = useMemo(
    () => STITCHES.find((item) => item.key === selectedStitch) ?? STITCHES[0],
    [selectedStitch],
  );

  return {
    boardZoomRef, zoomBoard, pointerZoomGesture: options.pointerZoomGesture,
    session,
    changed, strokeChanged, commitStroke,
    undo, redo,
    notify, message, notificationAction,
    initializationError, busy,
    selectedStitch, currentStitch, selectStitch, stitchPickerOpen, setStitchPickerOpen,
    selectedColor, setSelectedColor, selectColor, colorPickerOpen, setColorPickerOpen,
    mode, modeLabel: CANVAS_MODE_LABELS[mode], chooseMode,
    selection, setSelection, clearSelection, startSelecting,
    pasteBlock, copiedBlock, startPaste, copySelection, choosePasteBlock, handlePasteComplete,
    panel, panelRef, togglePanel, closePanel,
    fileInputRef,
    askText, askConfirm,
    saveSelectionAsBlock, removeBlock,
    runPngExport, runPdfExport,
    createNewDocument, switchDocument, renameChart, duplicateChart, deleteChart, deleteCharts,
    backup, restore, backupReminder,
  };
}

export type EditorController = ReturnType<typeof useEditorController>;
