import { useCallback, useMemo, useRef, useState } from 'react';
import { boardSizeBucket, countBucket, trackAnalyticsEvent, trackFirstEdit } from './analytics';
import { BoardCanvas, type CanvasMode } from './canvas/BoardCanvas';
import type { PatternBlock, Rect } from './model/Board';
import { STITCHES } from './stitches/catalog';
import {
  createDocument, deleteBlock, deleteDocument, duplicateDocument, exportBackup, importBackup,
  initializeStorage, listBlocks, listDocuments, renameDocument, saveBlock, type ChartDocument,
} from './storage/database';
import { renderPdf, renderPng, saveBlob, validatePngSize } from './export/exporters';
import { useEditorSession } from '@knitting-editor/editor-core/state/useEditorSession';
import { ExportControls } from '@knitting-editor/editor-core/ui/ExportControls';
import { GridControls } from '@knitting-editor/editor-core/ui/GridControls';
import { StitchPicker } from '@knitting-editor/editor-core/ui/StitchPicker';
import { useClipboardShortcuts, useNotifier, usePanelFocus } from '@knitting-editor/editor-core/ui/hooks';

type BusyTask = 'PNGを生成中' | 'PDFを生成中' | 'バックアップを処理中';
type Panel = 'documents' | 'grid' | 'blocks' | 'export';
// 保存の書き込み中に次の編集が入ると、直前の変更が盤面にしか無い状態になる。
// 盤面を差し替える操作はそこで止めるので、止めた理由を利用者へ伝える。
const PENDING_SWITCH_MESSAGE = '編集中のため切り替えできませんでした。もう一度お試しください。';
const PENDING_RESTORE_MESSAGE = '編集中のため復元できませんでした。もう一度お試しください。';

// Web版はブラウザ標準のダイアログをそのまま使う。iOS版はWKWebViewでの見た目と
// キーボード表示が合わないため、アプリ内ダイアログへ差し替えている。
const askText = (title: string, defaultValue = '') => Promise.resolve(window.prompt(title, defaultValue));
const askConfirm = (title: string) => Promise.resolve(window.confirm(title));

export default function App() {
  const [selectedStitch, setSelectedStitch] = useState('knit');
  const [stitchPickerOpen, setStitchPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#d33c32');
  const [mode, setMode] = useState<CanvasMode>('draw');
  const [selection, setSelection] = useState<Rect>();
  const [pasteBlock, setPasteBlock] = useState<PatternBlock>();
  const [copiedBlock, setCopiedBlock] = useState<PatternBlock>();
  const [panel, setPanel] = useState<Panel>();
  const [busy, setBusy] = useState<BusyTask>();
  const [initializationError, setInitializationError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { message, notify } = useNotifier();
  const { panelRef, rememberTrigger } = usePanelFocus<HTMLElement>(panel !== undefined);

  const {
    documents, activeDocument, board, blocks, revision, dirty,
    changed: markChanged, saveNow, switchDocument: switchSessionDocument,
    refreshDocuments, refreshBlocks, applyActiveDocumentName,
  } = useEditorSession({
    initialize: async () => {
      const storage = await initializeStorage();
      return { ...storage, blocks: await listBlocks() };
    },
    onInitialized: (initialized) => trackAnalyticsEvent('editor_ready', {
      document_count_bucket: countBucket(initialized.documents.length),
    }),
    onInitializationError: (reason) => {
      trackAnalyticsEvent('operation_failed', { operation_name: 'editor_init' });
      setInitializationError(reason);
    },
    onSaveError: (_error, trigger) => notify(trigger === 'autosave'
      ? '自動保存に失敗しました。バックアップを保存してください。'
      : '変更を保存できませんでした。バックアップを保存してください。'),
  });

  const changed = useCallback(() => { trackFirstEdit(); markChanged(); }, [markChanged]);
  const togglePanel = (nextPanel: Panel) => {
    const opening = panel !== nextPanel;
    if (opening) rememberTrigger();
    setPanel(opening ? nextPanel : undefined);
    if (opening) trackAnalyticsEvent('feature_opened', { feature_name: nextPanel });
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
  }, [board, selection, notify]);

  const startPaste = useCallback((block: PatternBlock) => {
    setCopiedBlock(block); setPasteBlock(block); setMode('paste'); setSelection(undefined);
    notify('貼り付ける左上のセルをタップしてください');
  }, [notify]);

  const choosePasteBlock = (block: PatternBlock) => { startPaste(block); setPanel(undefined); };

  const handlePasteComplete = (ok: boolean) => {
    if (ok) { changed(); setMode('draw'); setPasteBlock(undefined); trackAnalyticsEvent('block_pasted'); notify('ブロックを貼り付けました'); }
    else notify('盤面からはみ出すため貼り付けできません');
  };

  const pasteCopiedBlock = useCallback(() => { if (copiedBlock) startPaste(copiedBlock); }, [copiedBlock, startPaste]);
  useClipboardShortcuts({
    canCopy: selection !== undefined,
    canPaste: copiedBlock !== undefined,
    onCopy: copySelection,
    onPaste: pasteCopiedBlock,
  });

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
      // 書き込めていないまま出力すると、直前の編集が欠けたバックアップになる。
      if (await saveNow() === 'failed') return;
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
      const outcome = await saveNow();
      if (outcome === 'pending') { notify(PENDING_RESTORE_MESSAGE); return; }
      if (outcome === 'failed') return;
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

  const currentStitch = useMemo(() => STITCHES.find((item) => item.key === selectedStitch) ?? STITCHES[0], [selectedStitch]);
  const modeLabel = mode === 'draw' ? '描画' : mode === 'erase' ? '消去' : mode === 'select' ? '範囲選択' : '貼り付け';
  const panelTitle = panel === 'documents' ? '編み図' : panel === 'grid' ? '盤面設定' : panel === 'blocks' ? 'ブロック' : '保存・出力';
  if (initializationError) return <main className="loading" role="alert">編み図を読み込めませんでした：{initializationError}<button onClick={() => window.location.reload()}>再読み込み</button></main>;
  if (!board || !activeDocument) return <main className="loading">編み図を読み込んでいます…</main>;

  return <div className="app-shell">
    <header className="app-header">
      <div className="app-title">
        <div className="app-heading-row">
          <h1>棒針編み図エディタ</h1>
          <p className="app-tagline">無料の棒針編み図作成サイト</p>
        </div>
        <p className="app-document-name" aria-live="polite" aria-atomic="true">{activeDocument.name}<span aria-hidden="true">{dirty ? '（保存中…）' : ''}</span><span className="visually-hidden">、{dirty ? '保存中' : '保存済み'}</span></p>
      </div>
      <div className="header-actions">
        <a className="header-guide" href="/guide/">使い方</a>
        <button className="header-document" aria-controls="app-drawer" aria-expanded={panel === 'documents'} onClick={() => togglePanel('documents')}>編み図</button>
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
        <button className={mode === 'draw' ? 'active' : ''} aria-pressed={mode === 'draw'} onClick={() => { setMode('draw'); setSelection(undefined); }}>描く</button>
        <button className={mode === 'erase' ? 'active' : ''} aria-pressed={mode === 'erase'} onClick={() => { setMode('erase'); setSelection(undefined); }}>消す</button>
        <button className={mode === 'select' ? 'active' : ''} aria-pressed={mode === 'select'} onClick={() => { setMode('select'); setSelection(undefined); }}>範囲</button>
        {copiedBlock && <button className={mode === 'paste' ? 'active' : ''} aria-pressed={mode === 'paste'} onClick={() => startPaste(copiedBlock)}>貼付</button>}
      </section>

      {stitchPickerOpen && <StitchPicker
        selectedStitch={selectedStitch}
        onClose={() => setStitchPickerOpen(false)}
        onSelect={(key) => {
          setSelectedStitch(key);
          setMode('draw');
          setSelection(undefined);
          setStitchPickerOpen(false);
          trackAnalyticsEvent('stitch_selected', { stitch_key: key });
        }}
      />}

      {selection && <div className="selection-actions" role="toolbar" aria-label="選択範囲の操作">
        <button className="primary" onClick={copySelection}>コピーして貼付</button>
        <button onClick={() => { setSelection(undefined); setMode('draw'); }}>解除</button>
      </div>}

      <section className="canvas-wrap">
        <BoardCanvas board={board} revision={revision} stitchKey={selectedStitch} color={selectedColor} mode={mode}
          selection={selection} pasteBlock={pasteBlock} onChange={changed} onSelectionChange={setSelection} onPasteComplete={handlePasteComplete} />
        <div className="gesture-hint">1本指：{mode === 'erase' ? '消去' : mode === 'select' ? '範囲選択' : mode === 'paste' ? '貼り付け' : '描画'}　2本指：移動・拡大</div>
      </section>

      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{modeLabel}モード。{selection ? '選択範囲あり' : '選択範囲なし'}</p>

      <nav className="action-bar" aria-label="操作メニュー">
        <button aria-controls="app-drawer" aria-expanded={panel === 'grid'} onClick={() => togglePanel('grid')}>盤面</button>
        <button aria-controls="app-drawer" aria-expanded={panel === 'blocks'} onClick={() => togglePanel('blocks')}>ブロック</button>
        <button aria-controls="app-drawer" aria-expanded={panel === 'export'} onClick={() => togglePanel('export')}>保存</button>
      </nav>
    </main>

    {panel && <aside ref={panelRef} id="app-drawer" className="drawer" aria-labelledby="app-drawer-title">
      <div className="drawer-heading"><h2 id="app-drawer-title" tabIndex={-1}>{panelTitle}</h2><button onClick={() => setPanel(undefined)}>閉じる</button></div>
      {panel === 'documents' && <>
        <button className="primary" onClick={() => void createNewDocument()}>新しい編み図</button>
        <div className="document-list">{documents.map((document) => <div className={document.id === activeDocument.id ? 'document active' : 'document'} key={document.id}>
          <button onClick={() => void switchDocument(document)}>{document.name}<small>{document.rows}×{document.cols}</small></button>
          <div><button aria-label="名前変更" onClick={() => void (async () => { const name = await askText('新しい名前', document.name); if (name?.trim()) { await renameDocument(document.id, name.trim()); await refreshDocuments(); if (document.id === activeDocument.id) applyActiveDocumentName(name.trim()); } })()}>名称</button>
          <button aria-label="複製" onClick={() => void (async () => { await duplicateDocument(document.id); await refreshDocuments(); })()}>複製</button>
          <button aria-label="削除" disabled={documents.length === 1} onClick={() => void (async () => { if (await askConfirm(`「${document.name}」を削除しますか？`)) { await deleteDocument(document.id); const remaining = await listDocuments(); if (document.id === activeDocument.id) await switchDocument(remaining[0], false); await refreshDocuments(); } })()}>削除</button></div>
        </div>)}</div>
      </>}
      {panel === 'grid' && <GridControls board={board} changed={changed} askText={askText} askConfirm={askConfirm} notify={notify} />}
      {panel === 'blocks' && <>
        {selection && <><button className="primary" onClick={copySelection}>保存せずコピーして貼付</button><button onClick={() => void saveSelectionAsBlock()}>選択範囲をブロック保存</button></>}
        {!selection && <button onClick={() => { setMode('select'); setPanel(undefined); }}>盤面で範囲を選択</button>}
        <div className="block-list">{blocks.length === 0 && <p>保存済みブロックはありません。</p>}{blocks.map((block) => <div key={block.id}><button onClick={() => choosePasteBlock(block)}>{block.name}<small>{block.rows}×{block.cols}</small></button><button onClick={() => void (async () => { await deleteBlock(block.id); await refreshBlocks(); })()}>削除</button></div>)}</div>
      </>}
      {panel === 'export' && <ExportControls board={board} onPng={runPngExport} onPdf={runPdfExport} onBackup={backup}
        onRestore={() => fileInputRef.current?.click()}
        backupNote="端末内データはブラウザ操作で消える場合があります。定期的に保存してください。" />}
    </aside>}

    <input ref={fileInputRef} hidden type="file" accept=".knit,application/gzip" onChange={(event) => { void restore(event.target.files?.[0]); event.target.value = ''; }} />
    {busy && <div className="busy" role="status" aria-live="polite"><span className="spinner" />{busy}</div>}
    {message && <div className="toast" role="status" aria-live="polite" aria-atomic="true">{message}</div>}
    <footer><span>© 2026 棒針編み図エディタ</span><a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noreferrer">プライバシー</a></footer>
  </div>;
}
