import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boardSizeBucket, countBucket, trackAnalyticsEvent, trackFirstEdit } from './analytics';
import { BoardCanvas, type CanvasMode } from './canvas/BoardCanvas';
import { Board, type PatternBlock, type Rect } from './model/Board';
import {
  STITCHES, STITCH_CATEGORY_LABELS, type StitchCategory,
} from './stitches/catalog';
import {
  boardFromDocument, createDocument, deleteBlock, deleteDocument, duplicateDocument,
  exportBackup, importBackup, initializeStorage, listBlocks, listDocuments,
  renameDocument, saveBlock, saveDocument, setSetting, type ChartDocument,
} from './storage/database';
import { renderPdf, renderPng, saveBlob, validatePngSize } from './export/exporters';
import { listenNativeBackupSelected, listenNativeError, notifyNativeReady, requestNativeBackupOpen } from './nativeBridge';

declare global {
  interface Window {
    knittingEditorFlushPendingSave?: () => Promise<boolean>;
  }
}

type BusyTask = 'PNGを生成中' | 'PDFを生成中' | 'バックアップを処理中';
type Panel = 'documents' | 'grid' | 'blocks' | 'export';
type DialogRequest =
  | { kind: 'prompt'; title: string; defaultValue: string; resolve: (value: string | null) => void }
  | { kind: 'confirm'; title: string; resolve: (value: boolean) => void };
const STITCH_CATEGORY_ORDER: StitchCategory[] = ['basic', 'decrease', 'cable', 'twist', 'utility'];

function useModalFocus<T extends HTMLElement>(onEscape: () => void, initialSelector?: string) {
  const ref = useRef<T | null>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.getClientRects().length > 0);
    const initial = initialSelector ? root.querySelector<HTMLElement>(initialSelector) : undefined;
    const frame = requestAnimationFrame(() => (initial ?? focusable()[0])?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [initialSelector]);

  return ref;
}

export default function App() {
  const [documents, setDocuments] = useState<ChartDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<ChartDocument>();
  const [board, setBoard] = useState<Board>();
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [revision, setRevision] = useState(0);
  const [selectedStitch, setSelectedStitch] = useState('knit');
  const [stitchPickerOpen, setStitchPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#d33c32');
  const [mode, setMode] = useState<CanvasMode>('draw');
  const [selection, setSelection] = useState<Rect>();
  const [pasteBlock, setPasteBlock] = useState<PatternBlock>();
  const [copiedBlock, setCopiedBlock] = useState<PatternBlock>();
  const [panel, setPanel] = useState<Panel>();
  const [busy, setBusy] = useState<BusyTask>();
  const [message, setMessage] = useState('');
  const [initializationError, setInitializationError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<DialogRequest>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDocumentIdRef = useRef<string | undefined>(undefined);
  const editGenerationRef = useRef(0);
  const notificationTimeoutRef = useRef<number | undefined>(undefined);
  const restoreRef = useRef<((file?: File) => Promise<void>) | undefined>(undefined);
  const notifyRef = useRef<((text: string) => void) | undefined>(undefined);

  const notify = useCallback((text: string) => {
    setMessage(text);
    if (notificationTimeoutRef.current !== undefined) window.clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = window.setTimeout(() => {
      setMessage('');
      notificationTimeoutRef.current = undefined;
    }, 4500);
  }, []);

  const refreshDocuments = useCallback(async () => setDocuments(await listDocuments()), []);
  const refreshBlocks = useCallback(async () => setBlocks(await listBlocks()), []);

  useEffect(() => {
    void (async () => {
      const initialized = await initializeStorage();
      const document = initialized.documents.find((item) => item.id === initialized.activeId) ?? initialized.documents[0];
      setDocuments(initialized.documents);
      activeDocumentIdRef.current = document.id;
      setActiveDocument(document);
      setBoard(boardFromDocument(document));
      setBlocks(await listBlocks());
      trackAnalyticsEvent('editor_ready', { document_count_bucket: countBucket(initialized.documents.length) });
    })().catch((error) => {
      trackAnalyticsEvent('operation_failed', { operation_name: 'editor_init' });
      setInitializationError(error instanceof Error ? error.message : String(error));
    });
  }, []);

  useEffect(() => {
    if (!dirty || !activeDocument || !board) return;
    const documentId = activeDocument.id;
    const editGeneration = editGenerationRef.current;
    const timer = window.setTimeout(() => {
      void saveDocument(activeDocument, board).then((saved) => {
        if (activeDocumentIdRef.current === documentId) {
          setActiveDocument((current) => current?.id === documentId ? saved : current);
          if (editGenerationRef.current === editGeneration) setDirty(false);
        }
        void refreshDocuments();
      }).catch(() => setMessage('自動保存に失敗しました。バックアップを保存してください。'));
    }, 400);
    return () => clearTimeout(timer);
  }, [dirty, revision, activeDocument?.id, board]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (!dirty || !activeDocument || !board) return true;
    try {
      const saved = await saveDocument(activeDocument, board);
      if (activeDocumentIdRef.current !== saved.id) return false;
      setActiveDocument((current) => current?.id === saved.id ? saved : current);
      setDirty(false);
      await refreshDocuments();
      return true;
    } catch {
      notify('バックグラウンド移行前の自動保存に失敗しました。バックアップを保存してください。');
      return false;
    }
  }, [activeDocument, board, dirty, notify, refreshDocuments]);

  useEffect(() => {
    const handler = () => { void flushPendingSave(); };
    window.addEventListener('knittingEditorAppWillResignActive', handler);
    const nativeFlush = async () => flushPendingSave();
    window.knittingEditorFlushPendingSave = nativeFlush;
    return () => {
      window.removeEventListener('knittingEditorAppWillResignActive', handler);
      if (window.knittingEditorFlushPendingSave === nativeFlush) delete window.knittingEditorFlushPendingSave;
    };
  }, [flushPendingSave]);

  useEffect(() => () => {
    if (notificationTimeoutRef.current !== undefined) window.clearTimeout(notificationTimeoutRef.current);
  }, []);

  const changed = () => {
    trackFirstEdit();
    editGenerationRef.current += 1;
    setRevision((value) => value + 1);
    setDirty(true);
  };
  const askText = useCallback((title: string, defaultValue = '') => new Promise<string | null>((resolve) => {
    setDialog({ kind: 'prompt', title, defaultValue, resolve });
  }), []);
  const askConfirm = useCallback((title: string) => new Promise<boolean>((resolve) => {
    setDialog({ kind: 'confirm', title, resolve });
  }), []);
  const resolveDialog = (value: string | null | boolean) => {
    if (!dialog) return;
    setDialog(undefined);
    if (dialog.kind === 'prompt') dialog.resolve(typeof value === 'string' ? value : null);
    else dialog.resolve(value === true);
  };
  const togglePanel = (nextPanel: Panel) => {
    const opening = panel !== nextPanel;
    setPanel(opening ? nextPanel : undefined);
    if (opening) trackAnalyticsEvent('feature_opened', { feature_name: nextPanel });
  };

  const switchDocument = async (document: ChartDocument, saveCurrent = true) => {
    if (saveCurrent && dirty && activeDocument && board) await saveDocument(activeDocument, board);
    activeDocumentIdRef.current = document.id;
    setActiveDocument(document);
    setBoard(boardFromDocument(document));
    setRevision((value) => value + 1);
    setDirty(false);
    setSelection(undefined);
    setMode('draw');
    await setSetting('activeDocumentId', document.id);
    setPanel(undefined);
  };

  const mutateStructure = (operation: () => void) => {
    if (!board) return;
    try { operation(); changed(); }
    catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  };

  const promptIndex = async (kind: 'row' | 'col', action: 'insert' | 'remove') => {
    if (!board) return;
    const maximum = kind === 'row' ? board.rows : board.cols;
    const raw = await askText(`${action === 'insert' ? '挿入位置' : '削除する位置'}を入力してください（1〜${maximum}、表示番号基準）`);
    if (raw === null) return;
    const displayed = Number(raw);
    if (!Number.isInteger(displayed) || displayed < 1 || displayed > maximum) { notify(`1〜${maximum}の整数を入力してください`); return; }
    const index = maximum - displayed;
    mutateStructure(() => {
      if (kind === 'row') action === 'insert' ? board.insertRow(index) : board.removeRow(index);
      else action === 'insert' ? board.insertColumn(index) : board.removeColumn(index);
    });
  };

  const saveSelectionAsBlock = async () => {
    if (!board || !selection) return;
    const name = await askText('ブロック名を入力してください', '新しいパターン');
    if (!name?.trim()) return;
    const block = board.createBlock(selection, name.trim());
    await saveBlock(block);
    await refreshBlocks();
    setSelection(undefined); setMode('draw');
    trackAnalyticsEvent('block_saved', { board_size_bucket: boardSizeBucket(block.rows, block.cols) });
    notify('ブロックを保存しました');
  };

  const copySelection = useCallback(() => {
    if (!board || !selection) return;
    const block = board.createBlock(selection, 'コピーした範囲');
    setCopiedBlock(block);
    setPasteBlock(block);
    setSelection(undefined);
    setMode('paste');
    notify('貼り付ける左上のセルをタップしてください');
  }, [board, selection]);

  const choosePasteBlock = (block: PatternBlock) => {
    setCopiedBlock(block); setPasteBlock(block); setMode('paste'); setSelection(undefined); setPanel(undefined);
    notify('貼り付ける左上のセルをタップしてください');
  };

  const handlePasteComplete = (ok: boolean) => {
    if (ok) { changed(); setMode('draw'); setPasteBlock(undefined); trackAnalyticsEvent('block_pasted'); notify('ブロックを貼り付けました'); }
    else notify('盤面からはみ出すため貼り付けできません');
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'c' && selection) {
        event.preventDefault();
        copySelection();
      } else if (event.key.toLowerCase() === 'v' && copiedBlock) {
        event.preventDefault();
        setPasteBlock(copiedBlock);
        setMode('paste');
        setSelection(undefined);
        notify('貼り付ける左上のセルをタップしてください');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selection, copiedBlock, copySelection]);

  useEffect(() => {
    if (!stitchPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStitchPickerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [stitchPickerOpen]);

  const runPngExport = async (cellSize: number) => {
    if (!board || !activeDocument) return;
    const validation = validatePngSize(board, cellSize);
    if (!validation.valid) { notify(`${validation.reason}。PDF保存をおすすめします。`); return; }
    setBusy('PNGを生成中');
    try {
      await saveBlob(await renderPng(board, cellSize), `${activeDocument.name}.png`);
      trackAnalyticsEvent('chart_exported', { export_format: 'png', board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    }
    catch (error) { trackAnalyticsEvent('operation_failed', { operation_name: 'png_export' }); notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const runPdfExport = async (layout: 'single' | 'tiled', orientation: 'portrait' | 'landscape', cellMillimeters: number) => {
    if (!board || !activeDocument) return;
    setBusy('PDFを生成中');
    try {
      await saveBlob(await renderPdf(board, { layout, orientation, cellMillimeters }), `${activeDocument.name}.pdf`);
      trackAnalyticsEvent('chart_exported', { export_format: 'pdf', pdf_layout: layout, board_size_bucket: boardSizeBucket(board.rows, board.cols) });
    }
    catch (error) { trackAnalyticsEvent('operation_failed', { operation_name: 'pdf_export' }); notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const createNewDocument = async () => {
    const name = await askText('編み図名を入力してください', '新しい編み図');
    if (!name?.trim()) return;
    const document = await createDocument(name.trim());
    await refreshDocuments();
    await switchDocument(document);
    trackAnalyticsEvent('chart_created');
  };

  const backup = async (all: boolean) => {
    if (!activeDocument) return;
    setBusy('バックアップを処理中');
    try {
      if (dirty && board) {
        const saved = await saveDocument(activeDocument, board);
        setActiveDocument(saved);
        setDirty(false);
        await refreshDocuments();
      }
      const blob = await exportBackup(all ? undefined : [activeDocument.id]);
      await saveBlob(blob, all ? 'knitting-editor-backup.knit' : `${activeDocument.name}.knit`);
      trackAnalyticsEvent('backup_exported', { backup_scope: all ? 'all' : 'current' });
    } catch (error) { trackAnalyticsEvent('operation_failed', { operation_name: 'backup_export' }); notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    setBusy('バックアップを処理中');
    try {
      if (dirty && activeDocument && board) await saveDocument(activeDocument, board);
      const result = await importBackup(file);
      await refreshDocuments();
      await refreshBlocks();
      if (result.documents[0]) await switchDocument(result.documents[0], false);
      trackAnalyticsEvent('backup_restored', { document_count_bucket: countBucket(result.count) });
      notify(`${result.count}件の編み図を復元しました`);
    }
    catch (error) { trackAnalyticsEvent('operation_failed', { operation_name: 'backup_restore' }); notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  restoreRef.current = restore;
  notifyRef.current = notify;

  useEffect(() => {
    const removeBackupListener = listenNativeBackupSelected(({ filename, dataBase64 }) => {
      try {
        const binary = atob(dataBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        void restoreRef.current?.(new File([bytes], filename, { type: 'application/gzip' }));
      } catch {
        notifyRef.current?.('バックアップを読み込めませんでした');
      }
    });
    const removeErrorListener = listenNativeError((message) => notifyRef.current?.(message));
    notifyNativeReady();
    return () => {
      removeBackupListener();
      removeErrorListener();
    };
  }, []);

  const currentStitch = useMemo(() => STITCHES.find((item) => item.key === selectedStitch) ?? STITCHES[0], [selectedStitch]);
  if (initializationError) return <main className="loading" role="alert">編み図を読み込めませんでした：{initializationError}<button onClick={() => window.location.reload()}>再読み込み</button></main>;
  if (!board || !activeDocument) return <main className="loading">編み図を読み込んでいます…</main>;

  return <div className="app-shell">
    <header className="app-header">
      <div className="app-title"><h1>棒針編み図エディタ</h1><p aria-live="polite" aria-atomic="true">{activeDocument.name}{dirty ? '（保存中…）' : ''}</p></div>
      <div className="header-actions">
        <a className="header-guide" href="/guide/">使い方</a>
        <button className="header-document" onClick={() => togglePanel('documents')}>編み図</button>
      </div>
    </header>

    <main className="workspace">
      <section className="primary-tools" aria-label="編集ツール">
        <label className="color-tool"><span>色</span><input aria-label="記号の色" type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} /></label>
        <button className="stitch-tool" aria-label="編み目記号を選ぶ" aria-haspopup="dialog" aria-expanded={stitchPickerOpen} onClick={() => setStitchPickerOpen(true)}>
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: currentStitch.svg }} />
          <span className="stitch-tool-name">{currentStitch.name}</span>
          <span className="stitch-tool-chevron" aria-hidden="true">⌄</span>
        </button>
        <button className={mode === 'draw' ? 'active' : ''} onClick={() => { setMode('draw'); setSelection(undefined); }}>描く</button>
        <button className={mode === 'erase' ? 'active' : ''} onClick={() => { setMode('erase'); setSelection(undefined); }}>消す</button>
        <button className={mode === 'select' ? 'active' : ''} onClick={() => { setMode('select'); setSelection(undefined); }}>範囲</button>
        {copiedBlock && <button className={mode === 'paste' ? 'active' : ''} onClick={() => { setPasteBlock(copiedBlock); setMode('paste'); setSelection(undefined); }}>貼付</button>}
      </section>

      {stitchPickerOpen && <div className="stitch-picker-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setStitchPickerOpen(false);
      }}>
        <StitchPicker onClose={() => setStitchPickerOpen(false)} selectedStitch={selectedStitch} onSelect={(key) => {
          setSelectedStitch(key);
          setMode('draw');
          setSelection(undefined);
          setStitchPickerOpen(false);
          trackAnalyticsEvent('stitch_selected', { stitch_key: key });
        }} />
      </div>}

      {selection && <div className="selection-actions" role="toolbar" aria-label="選択範囲の操作">
        <button className="primary" onClick={copySelection}>コピーして貼付</button>
        <button onClick={() => { setSelection(undefined); setMode('draw'); }}>解除</button>
      </div>}

      <section className="canvas-wrap">
        <BoardCanvas board={board} revision={revision} stitchKey={selectedStitch} color={selectedColor} mode={mode}
          selection={selection} pasteBlock={pasteBlock} onChange={changed} onSelectionChange={setSelection} onPasteComplete={handlePasteComplete} />
        <div className="gesture-hint">1本指：{mode === 'erase' ? '消去' : mode === 'select' ? '範囲選択' : mode === 'paste' ? '貼り付け' : '描画'}　2本指：移動・拡大</div>
      </section>

      <nav className="action-bar" aria-label="操作メニュー">
        <button onClick={() => togglePanel('grid')}>盤面</button>
        <button onClick={() => togglePanel('blocks')}>ブロック</button>
        <button onClick={() => togglePanel('export')}>保存</button>
      </nav>
    </main>

    {panel && <aside className="drawer">
      <div className="drawer-heading"><h2>{panel === 'documents' ? '編み図' : panel === 'grid' ? '盤面設定' : panel === 'blocks' ? 'ブロック' : '保存・出力'}</h2><button onClick={() => setPanel(undefined)}>閉じる</button></div>
      {panel === 'documents' && <>
        <button className="primary" onClick={() => void createNewDocument()}>新しい編み図</button>
        <div className="document-list">{documents.map((document) => <div className={document.id === activeDocument.id ? 'document active' : 'document'} key={document.id}>
          <button onClick={() => void switchDocument(document)}>{document.name}<small>{document.rows}×{document.cols}</small></button>
          <div><button aria-label="名前変更" onClick={() => void (async () => { const name = await askText('新しい名前', document.name); if (name?.trim()) { await renameDocument(document.id, name.trim()); await refreshDocuments(); if (document.id === activeDocument.id) setActiveDocument({ ...activeDocument, name: name.trim() }); } })()}>名称</button>
          <button aria-label="複製" onClick={() => void (async () => { await duplicateDocument(document.id); await refreshDocuments(); })()}>複製</button>
          <button aria-label="削除" disabled={documents.length === 1} onClick={() => void (async () => { if (await askConfirm(`「${document.name}」を削除しますか？`)) { await deleteDocument(document.id); const remaining = await listDocuments(); setDocuments(remaining); if (document.id === activeDocument.id) await switchDocument(remaining[0], false); } })()}>削除</button></div>
        </div>)}</div>
      </>}
      {panel === 'grid' && <GridControls board={board} changed={changed} mutateStructure={mutateStructure} promptIndex={promptIndex} confirmAction={askConfirm} notify={notify} />}
      {panel === 'blocks' && <>
        {selection && <><button className="primary" onClick={copySelection}>保存せずコピーして貼付</button><button onClick={() => void saveSelectionAsBlock()}>選択範囲をブロック保存</button></>}
        {!selection && <button onClick={() => { setMode('select'); setPanel(undefined); }}>盤面で範囲を選択</button>}
        <div className="block-list">{blocks.length === 0 && <p>保存済みブロックはありません。</p>}{blocks.map((block) => <div key={block.id}><button onClick={() => choosePasteBlock(block)}>{block.name}<small>{block.rows}×{block.cols}</small></button><button onClick={() => void (async () => { await deleteBlock(block.id); await refreshBlocks(); })()}>削除</button></div>)}</div>
      </>}
      {panel === 'export' && <ExportControls board={board} onPng={runPngExport} onPdf={runPdfExport} onBackup={backup} onRestore={() => { if (!requestNativeBackupOpen()) fileInputRef.current?.click(); }} />}
    </aside>}

    <input ref={fileInputRef} hidden type="file" accept=".knit,application/gzip" onChange={(event) => { void restore(event.target.files?.[0]); event.target.value = ''; }} />
    {dialog && <AppDialog request={dialog} onResolve={resolveDialog} />}
    {busy && <div className="busy" role="status" aria-live="polite"><span className="spinner" />{busy}</div>}
    {message && <div className="toast" role="status" aria-live="polite" aria-atomic="true">{message}</div>}
    <footer><span>© 2026 棒針編み図エディタ</span><a href="/guide/">使い方</a></footer>
  </div>;
}

function GridControls({ board, changed, mutateStructure, promptIndex, confirmAction, notify }: {
  board: Board; changed: () => void; mutateStructure: (operation: () => void) => void;
  promptIndex: (kind: 'row' | 'col', action: 'insert' | 'remove') => void; confirmAction: (message: string) => Promise<boolean>; notify: (message: string) => void;
}) {
  const [rows, setRows] = useState(board.rows);
  const [cols, setCols] = useState(board.cols);
  useEffect(() => { setRows(board.rows); setCols(board.cols); }, [board.rows, board.cols]);
  const resize = () => mutateStructure(() => board.resize(rows, cols, rows > board.rows ? rows - board.rows : 0, 0));
  return <div className="grid-controls">
    <div className="size-inputs"><label>段数<input type="number" min="1" max="1000" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><label>列数<input type="number" min="1" max="1000" value={cols} onChange={(event) => setCols(Number(event.target.value))} /></label><button className="primary" onClick={resize}>変更</button></div>
    <h3>追加</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols, 1, 0))}>上に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows + 1, board.cols))}>下に段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1, 0, 1))}>左に列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols + 1))}>右に列</button></div>
    <h3>削除</h3><div className="button-grid"><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols, -1, 0))}>上の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows - 1, board.cols))}>下の段</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1, 0, -1))}>左の列</button><button onClick={() => mutateStructure(() => board.resize(board.rows, board.cols - 1))}>右の列</button></div>
    <h3>指定位置</h3><div className="button-grid"><button onClick={() => promptIndex('row', 'insert')}>段を挿入</button><button onClick={() => promptIndex('col', 'insert')}>列を挿入</button><button onClick={() => promptIndex('row', 'remove')}>段を削除</button><button onClick={() => promptIndex('col', 'remove')}>列を削除</button></div>
    <button className="danger" onClick={() => void (async () => { if (await confirmAction('盤面をすべて消去しますか？')) { board.clear(); changed(); notify('盤面を消去しました'); } })()}>全体をクリア</button>
  </div>;
}

function StitchPicker({ onClose, selectedStitch, onSelect }: {
  onClose: () => void;
  selectedStitch: string;
  onSelect: (key: string) => void;
}) {
  const pickerRef = useModalFocus<HTMLElement>(onClose, '.stitch-picker-heading button');
  return <section ref={pickerRef} className="stitch-picker" role="dialog" aria-modal="true" aria-labelledby="stitch-picker-title" aria-describedby="stitch-picker-description">
    <div className="stitch-picker-heading"><div><h2 id="stitch-picker-title">編み目記号</h2><p id="stitch-picker-description">記号を選ぶと描画モードになります。Escapeで閉じます。</p></div><button onClick={onClose}>閉じる</button></div>
    {STITCH_CATEGORY_ORDER.map((category) => <div className="stitch-category" key={category}>
      <h3>{STITCH_CATEGORY_LABELS[category]}</h3>
      <div className="stitch-grid">
        {STITCHES.filter((stitch) => stitch.category === category).map((stitch) => <button
          className={stitch.key === selectedStitch ? 'stitch-option selected' : 'stitch-option'}
          key={stitch.key}
          aria-pressed={stitch.key === selectedStitch}
          onClick={() => onSelect(stitch.key)}
        >
          <span className="stitch-option-symbol" aria-hidden="true" dangerouslySetInnerHTML={{ __html: stitch.svg }} />
          <span className="stitch-option-name">{stitch.name}</span>
          <small>{stitch.width}×{stitch.height}目</small>
        </button>)}
      </div>
    </div>)}
  </section>;
}

function ExportControls({ board, onPng, onPdf, onBackup, onRestore }: {
  board: Board; onPng: (size: number) => void; onPdf: (layout: 'single' | 'tiled', orientation: 'portrait' | 'landscape', mm: number) => void;
  onBackup: (all: boolean) => void; onRestore: () => void;
}) {
  const [pngSize, setPngSize] = useState(12);
  const [layout, setLayout] = useState<'single' | 'tiled'>('single');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [millimeters, setMillimeters] = useState(5);
  const png = validatePngSize(board, pngSize);
  const pageWidth = orientation === 'portrait' ? 547 : 794;
  const pageHeight = orientation === 'portrait' ? 776 : 529;
  const cellPoints = millimeters * 72 / 25.4;
  const pages = layout === 'single' ? 1 : Math.ceil(board.cols / Math.max(1, Math.floor(pageWidth / cellPoints) - 1)) * Math.ceil(board.rows / Math.max(1, Math.floor(pageHeight / cellPoints) - 1));
  return <div className="export-controls">
    <h3>PNG</h3><label>1セルの画素数<input type="range" min="2" max="30" value={pngSize} onChange={(event) => setPngSize(Number(event.target.value))} /><output>{pngSize}px</output></label><p>{png.width}×{png.height}px {!png.valid && `— ${png.reason}`}</p><button disabled={!png.valid} onClick={() => onPng(pngSize)}>PNGを保存</button>{!png.valid && <p className="recommend">この盤面はPDF保存をおすすめします。</p>}
    <h3>PDF</h3><label>構成<select value={layout} onChange={(event) => setLayout(event.target.value as 'single' | 'tiled')}><option value="single">全体を1ページ</option><option value="tiled">読みやすく分割</option></select></label><label>用紙<select value={orientation} onChange={(event) => setOrientation(event.target.value as 'portrait' | 'landscape')}><option value="portrait">A4縦</option><option value="landscape">A4横</option></select></label>{layout === 'tiled' && <label>セル寸法<input type="range" min="2" max="10" value={millimeters} onChange={(event) => setMillimeters(Number(event.target.value))} /><output>{millimeters}mm</output></label>}<p>推定 {pages}ページ{pages > 100 && ' — ページ数が多いため1ページ版もご検討ください'}</p><button onClick={() => onPdf(layout, orientation, millimeters)}>PDFを保存</button>
    <h3>バックアップ</h3><div className="button-grid"><button onClick={() => onBackup(false)}>この編み図</button><button onClick={() => onBackup(true)}>全データ</button><button onClick={onRestore}>復元</button></div><p>端末内データはブラウザ操作で消える場合があります。定期的に保存してください。</p>
  </div>;
}

function AppDialog({ request, onResolve }: {
  request: DialogRequest;
  onResolve: (value: string | null | boolean) => void;
}) {
  const [value, setValue] = useState(request.kind === 'prompt' ? request.defaultValue : '');
  useEffect(() => { setValue(request.kind === 'prompt' ? request.defaultValue : ''); }, [request]);
  const dialogRef = useModalFocus<HTMLElement>(() => onResolve(request.kind === 'prompt' ? null : false), request.kind === 'prompt' ? 'input' : 'button.primary');
  return <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onResolve(request.kind === 'prompt' ? null : false);
  }}>
    <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-description" onKeyDown={(event) => {
      if (event.key === 'Enter' && request.kind === 'prompt' && event.target instanceof HTMLInputElement) onResolve(value);
    }}>
      <h2 id="app-dialog-title">{request.title}</h2>
      <p id="app-dialog-description" className="visually-hidden">入力を確認して決定またはキャンセルを選択してください。Escapeでキャンセルできます。</p>
      {request.kind === 'prompt' && <input aria-label="入力" value={value} onChange={(event) => setValue(event.target.value)} />}
      <div className="app-dialog-actions">
        <button onClick={() => onResolve(request.kind === 'prompt' ? null : false)}>キャンセル</button>
        <button className="primary" autoFocus={request.kind === 'confirm'} onClick={() => onResolve(request.kind === 'prompt' ? value : true)}>決定</button>
      </div>
    </section>
  </div>;
}
