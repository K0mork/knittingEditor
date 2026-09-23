import { useCallback, useMemo, useRef, useState } from 'react';
import { boardSizeBucket, countBucket, NO_ANALYTICS, type EditorAnalytics } from '../analytics';
import { CANVAS_MODE_LABELS, type CanvasMode } from '../canvas/BoardCanvas';
import { renderPdf, renderPng, validatePngSize } from '../export/exporters';
import type { PdfLayoutOptions } from '../export/pdfLayout';
import type { PatternBlock, Rect } from '../model/Board';
import type { EditorPlatform } from '../platform';
import { useEditorSession, type EditorSessionInit, type SaveTrigger } from '../state/useEditorSession';
import { STITCHES, type StitchDefinition } from '../stitches/catalog';
import {
  createDocument, deleteBlock, deleteDocument, duplicateDocument, exportBackup, importBackup,
  listDocuments, renameDocument, saveBlock, type ChartDocument,
} from '../storage/database';
import { errorMessage } from '../util/errors';
import { useClipboardShortcuts, useNotifier, usePanelFocus } from './hooks';

export type BusyTask = 'PNGを生成中' | 'PDFを生成中' | 'バックアップを処理中';
export type EditorPanel = 'documents' | 'grid' | 'blocks' | 'export';

export const EDITOR_PANEL_TITLES: Record<EditorPanel, string> = {
  documents: '編み図', grid: '盤面設定', blocks: 'ブロック', export: '保存・出力',
};

// 保存の書き込み中に次の編集が入ると、直前の変更が盤面にしか無い状態になる。
// 盤面を差し替える操作はそこで止めるので、止めた理由を利用者へ伝える。
const PENDING_SWITCH_MESSAGE = '編集中のため切り替えできませんでした。もう一度お試しください。';
const PENDING_RESTORE_MESSAGE = '編集中のため復元できませんでした。もう一度お試しください。';
const PASTE_PROMPT_MESSAGE = '貼り付ける左上のセルをタップしてください';

export function saveErrorMessage(trigger: SaveTrigger): string {
  if (trigger === 'background') return 'バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。';
  if (trigger === 'autosave') return '自動保存に失敗しました。バックアップを保存してください。';
  return '変更を保存できませんでした。バックアップを保存してください。';
}

export interface EditorControllerOptions {
  /** 端末内データの読み出し。Web版は旧localStorageからの移行、iOS版はタイムアウトを挟む。 */
  initialize: () => Promise<EditorSessionInit>;
  platform: EditorPlatform;
  /** 省略すると何も送らない。iOS版は渡さない。 */
  analytics?: EditorAnalytics;
  /** 名前や位置の入力。Web版は`window.prompt`、iOS版はアプリ内ダイアログを渡す。 */
  askText: (title: string, defaultValue?: string) => Promise<string | null>;
  askConfirm: (title: string) => Promise<boolean>;
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
  const [mode, setMode] = useState<CanvasMode>('draw');
  const [selection, setSelection] = useState<Rect>();
  const [pasteBlock, setPasteBlock] = useState<PatternBlock>();
  const [copiedBlock, setCopiedBlock] = useState<PatternBlock>();
  const [panel, setPanel] = useState<EditorPanel>();
  const [busy, setBusy] = useState<BusyTask>();
  const [initializationError, setInitializationError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { message, notify } = useNotifier();
  const { panelRef, rememberTrigger } = usePanelFocus<HTMLElement>(panel !== undefined);

  const session = useEditorSession({
    initialize: options.initialize,
    onInitialized: (initialized) => analytics.track('editor_ready', {
      document_count_bucket: countBucket(initialized.documents.length),
    }),
    onInitializationError: (reason) => {
      analytics.track('operation_failed', { operation_name: 'editor_init' });
      setInitializationError(reason);
    },
    onSaveError: (_error, trigger) => notify(saveErrorMessage(trigger)),
  });
  const {
    board, activeDocument, changed: markChanged, saveNow, switchDocument: switchSessionDocument,
    refreshDocuments, refreshBlocks, applyActiveDocumentName,
  } = session;

  const changed = useCallback(() => { analytics.trackFirstEdit(); markChanged(); }, [analytics, markChanged]);

  /** 失敗を記録して利用者へ伝える。出力やバックアップの`catch`で使う。 */
  const reportFailure = (operation: string, error: unknown) => {
    analytics.track('operation_failed', { operation_name: operation });
    notify(errorMessage(error));
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

  const switchDocument = useCallback(async (document: ChartDocument, saveCurrent = true) => {
    const outcome = await switchSessionDocument(document, saveCurrent);
    // failedは`onSaveError`が通知済み。pendingは通知が出ないので、ここで理由を伝える。
    // 黙って何も起きないと、切り替えを押したつもりの利用者が変化に気づけない。
    if (outcome === 'pending') notify(PENDING_SWITCH_MESSAGE);
    if (outcome !== 'switched') return;
    setSelection(undefined);
    setMode('draw');
    setPanel(undefined);
  }, [switchSessionDocument, notify]);

  const startPaste = useCallback((block: PatternBlock) => {
    setCopiedBlock(block);
    setPasteBlock(block);
    setMode('paste');
    setSelection(undefined);
    notify(PASTE_PROMPT_MESSAGE);
  }, [notify]);

  const copySelection = useCallback(() => {
    if (!board || !selection) return;
    startPaste(board.createBlock(selection, 'コピーした範囲'));
  }, [board, selection, startPaste]);

  const choosePasteBlock = (block: PatternBlock) => { startPaste(block); setPanel(undefined); };

  const handlePasteComplete = (ok: boolean) => {
    if (!ok) { notify('盤面からはみ出すため貼り付けできません'); return; }
    changed();
    setMode('draw');
    setPasteBlock(undefined);
    analytics.track('block_pasted');
    notify('ブロックを貼り付けました');
  };

  const pasteCopiedBlock = useCallback(() => { if (copiedBlock) startPaste(copiedBlock); }, [copiedBlock, startPaste]);
  useClipboardShortcuts({
    canCopy: selection !== undefined,
    canPaste: copiedBlock !== undefined,
    onCopy: copySelection,
    onPaste: pasteCopiedBlock,
  });

  const saveSelectionAsBlock = async () => {
    if (!board || !selection) return;
    const name = (await askText('ブロック名を入力してください', '新しいパターン'))?.trim();
    if (!name) return;
    const block = board.createBlock(selection, name);
    await saveBlock(block);
    await refreshBlocks();
    setSelection(undefined);
    setMode('draw');
    analytics.track('block_saved', { board_size_bucket: boardSizeBucket(block.rows, block.cols) });
    notify('ブロックを保存しました');
  };

  const removeBlock = async (block: PatternBlock) => {
    await deleteBlock(block.id);
    await refreshBlocks();
  };

  const runPngExport = async (cellSize: number) => {
    if (!board || !activeDocument) return;
    const validation = validatePngSize(board, cellSize);
    if (!validation.valid) { notify(`${validation.reason}。PDF保存をおすすめします。`); return; }
    setBusy('PNGを生成中');
    try {
      await platform.saveFile(await renderPng(board, cellSize), `${activeDocument.name}.png`);
      analytics.track('chart_exported', { export_format: 'png', board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    } catch (error) { reportFailure('png_export', error); }
    finally { setBusy(undefined); }
  };

  const runPdfExport = async (pdfOptions: PdfLayoutOptions) => {
    if (!board || !activeDocument) return;
    setBusy('PDFを生成中');
    try {
      await platform.saveFile(await renderPdf(board, pdfOptions), `${activeDocument.name}.pdf`);
      analytics.track('chart_exported', { export_format: 'pdf', pdf_layout: pdfOptions.layout, board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    } catch (error) { reportFailure('pdf_export', error); }
    finally { setBusy(undefined); }
  };

  const createNewDocument = async () => {
    const name = (await askText('編み図名を入力してください', '新しい編み図'))?.trim();
    if (!name) return;
    const document = await createDocument(name);
    await refreshDocuments();
    await switchDocument(document);
    analytics.track('chart_created');
  };

  const renameChart = async (document: ChartDocument) => {
    const name = (await askText('新しい名前', document.name))?.trim();
    if (!name) return;
    await renameDocument(document.id, name);
    await refreshDocuments();
    if (document.id === activeDocument?.id) applyActiveDocumentName(name);
  };

  const duplicateChart = async (document: ChartDocument) => {
    await duplicateDocument(document.id);
    await refreshDocuments();
  };

  const deleteChart = async (document: ChartDocument) => {
    if (!(await askConfirm(`「${document.name}」を削除しますか？`))) return;
    await deleteDocument(document.id);
    const remaining = await listDocuments();
    if (document.id === activeDocument?.id) await switchDocument(remaining[0], false);
    await refreshDocuments();
  };

  const backup = async (all: boolean) => {
    if (!activeDocument) return;
    setBusy('バックアップを処理中');
    try {
      // 書き込めていないまま出力すると、直前の編集が欠けたバックアップになる。
      if (await saveNow() === 'failed') return;
      const blob = await exportBackup(all ? undefined : [activeDocument.id]);
      await platform.saveFile(blob, all ? 'knitting-editor-backup.knit' : `${activeDocument.name}.knit`);
      analytics.track('backup_exported', { backup_scope: all ? 'all' : 'current' });
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
      if (result.documents[0]) await switchDocument(result.documents[0], false);
      analytics.track('backup_restored', { document_count_bucket: countBucket(result.count) });
      notify(`${result.count}件の編み図を復元しました`);
    } catch (error) { reportFailure('backup_restore', error); }
    finally { setBusy(undefined); }
  };

  const currentStitch: StitchDefinition = useMemo(
    () => STITCHES.find((item) => item.key === selectedStitch) ?? STITCHES[0],
    [selectedStitch],
  );

  return {
    session,
    changed,
    notify, message,
    initializationError, busy,
    selectedStitch, currentStitch, selectStitch, stitchPickerOpen, setStitchPickerOpen,
    selectedColor, setSelectedColor,
    mode, modeLabel: CANVAS_MODE_LABELS[mode], chooseMode,
    selection, setSelection, clearSelection, startSelecting,
    pasteBlock, copiedBlock, startPaste, copySelection, choosePasteBlock, handlePasteComplete,
    panel, panelRef, togglePanel, closePanel,
    fileInputRef,
    askText, askConfirm,
    saveSelectionAsBlock, removeBlock,
    runPngExport, runPdfExport,
    createNewDocument, switchDocument, renameChart, duplicateChart, deleteChart,
    backup, restore,
  };
}

export type EditorController = ReturnType<typeof useEditorController>;
