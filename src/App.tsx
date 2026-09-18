import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardCanvas, type CanvasMode } from './canvas/BoardCanvas';
import { Board, type PatternBlock, type Rect } from './model/Board';
import { STITCHES, stitchSvg } from './stitches/catalog';
import {
  boardFromDocument, createDocument, deleteBlock, deleteDocument, duplicateDocument,
  exportBackup, importBackup, initializeStorage, listBlocks, listDocuments,
  renameDocument, saveBlock, saveDocument, setSetting, type ChartDocument,
} from './storage/database';
import { downloadBlob, renderPdf, renderPng, validatePngSize } from './export/exporters';

type BusyTask = 'PNGを生成中' | 'PDFを生成中' | 'バックアップを処理中';

function Analytics() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-VVE0G4ZFL4';
    document.head.appendChild(script);
    const dataLayer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ??= []);
    const gtag = (...args: unknown[]) => dataLayer.push(args);
    gtag('js', new Date());
    gtag('config', 'G-VVE0G4ZFL4');
    return () => { script.remove(); };
  }, []);
  return null;
}

export default function App() {
  const [documents, setDocuments] = useState<ChartDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<ChartDocument>();
  const [board, setBoard] = useState<Board>();
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [revision, setRevision] = useState(0);
  const [selectedStitch, setSelectedStitch] = useState('knit');
  const [selectedColor, setSelectedColor] = useState('#d33c32');
  const [mode, setMode] = useState<CanvasMode>('draw');
  const [selection, setSelection] = useState<Rect>();
  const [pasteBlock, setPasteBlock] = useState<PatternBlock>();
  const [panel, setPanel] = useState<'documents' | 'grid' | 'blocks' | 'export' | undefined>();
  const [busy, setBusy] = useState<BusyTask>();
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDocuments = useCallback(async () => setDocuments(await listDocuments()), []);
  const refreshBlocks = useCallback(async () => setBlocks(await listBlocks()), []);

  useEffect(() => {
    void (async () => {
      const initialized = await initializeStorage();
      const document = initialized.documents.find((item) => item.id === initialized.activeId) ?? initialized.documents[0];
      setDocuments(initialized.documents);
      setActiveDocument(document);
      setBoard(boardFromDocument(document));
      setBlocks(await listBlocks());
    })().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    if (!dirty || !activeDocument || !board) return;
    const timer = window.setTimeout(() => {
      void saveDocument(activeDocument, board).then((saved) => {
        setActiveDocument(saved);
        setDirty(false);
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

  const changed = () => { setRevision((value) => value + 1); setDirty(true); };
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 4500); };

  const switchDocument = async (document: ChartDocument, saveCurrent = true) => {
    if (saveCurrent && dirty && activeDocument && board) await saveDocument(activeDocument, board);
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

  const promptIndex = (kind: 'row' | 'col', action: 'insert' | 'remove') => {
    if (!board) return;
    const maximum = kind === 'row' ? board.rows : board.cols;
    const label = kind === 'row' ? '段' : '列';
    const raw = window.prompt(`${action === 'insert' ? '挿入位置' : '削除する位置'}を入力してください（1〜${maximum}、表示番号基準）`);
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
    const name = window.prompt('ブロック名を入力してください', '新しいパターン');
    if (!name?.trim()) return;
    const block = board.createBlock(selection, name.trim());
    await saveBlock(block);
    await refreshBlocks();
    setSelection(undefined); setMode('draw');
    notify('ブロックを保存しました');
  };

  const choosePasteBlock = (block: PatternBlock) => {
    setPasteBlock(block); setMode('paste'); setSelection(undefined); setPanel(undefined);
    notify('貼り付ける左上のセルをタップしてください');
  };

  const handlePasteComplete = (ok: boolean) => {
    if (ok) { changed(); setMode('draw'); setPasteBlock(undefined); notify('ブロックを貼り付けました'); }
    else notify('盤面からはみ出すため貼り付けできません');
  };

  const runPngExport = async (cellSize: number) => {
    if (!board || !activeDocument) return;
    const validation = validatePngSize(board, cellSize);
    if (!validation.valid) { notify(`${validation.reason}。PDF保存をおすすめします。`); return; }
    setBusy('PNGを生成中');
    try { downloadBlob(await renderPng(board, cellSize), `${activeDocument.name}.png`); }
    catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const runPdfExport = async (layout: 'single' | 'tiled', orientation: 'portrait' | 'landscape', cellMillimeters: number) => {
    if (!board || !activeDocument) return;
    setBusy('PDFを生成中');
    try { downloadBlob(await renderPdf(board, { layout, orientation, cellMillimeters }), `${activeDocument.name}.pdf`); }
    catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const createNewDocument = async () => {
    const name = window.prompt('編み図名を入力してください', '新しい編み図');
    if (!name?.trim()) return;
    const document = await createDocument(name.trim());
    await refreshDocuments();
    await switchDocument(document);
  };

  const backup = async (all: boolean) => {
    if (!activeDocument) return;
    setBusy('バックアップを処理中');
    try {
      const blob = await exportBackup(all ? undefined : [activeDocument.id]);
      downloadBlob(blob, all ? 'knitting-editor-backup.knit' : `${activeDocument.name}.knit`);
    } finally { setBusy(undefined); }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    setBusy('バックアップを処理中');
    try { const count = await importBackup(file); await refreshDocuments(); await refreshBlocks(); notify(`${count}件の編み図を復元しました`); }
    catch (error) { notify(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(undefined); }
  };

  const currentStitch = useMemo(() => STITCHES.find((item) => item.key === selectedStitch)!, [selectedStitch]);
  if (!board || !activeDocument) return <main className="loading">編み図を読み込んでいます…</main>;

  return <div className="app-shell">
    <Analytics />
    <header className="app-header">
      <div><h1>棒針編み図エディタ</h1><p>{activeDocument.name}{dirty ? '（保存中…）' : ''}</p></div>
      <button className="header-document" onClick={() => setPanel(panel === 'documents' ? undefined : 'documents')}>編み図</button>
    </header>

    <main className="workspace">
      <section className="primary-tools" aria-label="編集ツール">
        <label className="color-tool"><span>色</span><input aria-label="記号の色" type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} /></label>
        <label className="stitch-tool"><span dangerouslySetInnerHTML={{ __html: stitchSvg(currentStitch.key) }} /><select aria-label="編み目記号" value={selectedStitch} onChange={(event) => { setSelectedStitch(event.target.value); setMode('draw'); }}>
          {STITCHES.map((stitch) => <option key={stitch.key} value={stitch.key}>{stitch.name}</option>)}
        </select></label>
        <button className={mode === 'draw' ? 'active' : ''} onClick={() => { setMode('draw'); setSelection(undefined); }}>描く</button>
        <button className={mode === 'select' ? 'active' : ''} onClick={() => { setMode('select'); setSelection(undefined); }}>範囲</button>
      </section>

      <section className="canvas-wrap">
        <BoardCanvas board={board} revision={revision} stitchKey={selectedStitch} color={selectedColor} mode={mode}
          selection={selection} pasteBlock={pasteBlock} onChange={changed} onSelectionChange={setSelection} onPasteComplete={handlePasteComplete} />
        <div className="gesture-hint">1本指：描画　2本指：移動・拡大</div>
      </section>

      <nav className="action-bar" aria-label="操作メニュー">
        <button onClick={() => setPanel(panel === 'grid' ? undefined : 'grid')}>盤面</button>
        <button onClick={() => setPanel(panel === 'blocks' ? undefined : 'blocks')}>ブロック</button>
        <button onClick={() => setPanel(panel === 'export' ? undefined : 'export')}>保存</button>
      </nav>
    </main>

    {panel && <aside className="drawer">
      <div className="drawer-heading"><h2>{panel === 'documents' ? '編み図' : panel === 'grid' ? '盤面設定' : panel === 'blocks' ? 'ブロック' : '保存・出力'}</h2><button onClick={() => setPanel(undefined)}>閉じる</button></div>
      {panel === 'documents' && <>
        <button className="primary" onClick={() => void createNewDocument()}>新しい編み図</button>
        <div className="document-list">{documents.map((document) => <div className={document.id === activeDocument.id ? 'document active' : 'document'} key={document.id}>
          <button onClick={() => void switchDocument(document)}>{document.name}<small>{document.rows}×{document.cols}</small></button>
          <div><button aria-label="名前変更" onClick={() => void (async () => { const name = prompt('新しい名前', document.name); if (name?.trim()) { await renameDocument(document.id, name.trim()); await refreshDocuments(); if (document.id === activeDocument.id) setActiveDocument({ ...activeDocument, name: name.trim() }); } })()}>名称</button>
          <button aria-label="複製" onClick={() => void (async () => { await duplicateDocument(document.id); await refreshDocuments(); })()}>複製</button>
          <button aria-label="削除" disabled={documents.length === 1} onClick={() => void (async () => { if (confirm(`「${document.name}」を削除しますか？`)) { await deleteDocument(document.id); const remaining = await listDocuments(); setDocuments(remaining); if (document.id === activeDocument.id) await switchDocument(remaining[0], false); } })()}>削除</button></div>
        </div>)}</div>
      </>}
      {panel === 'grid' && <GridControls board={board} changed={changed} mutateStructure={mutateStructure} promptIndex={promptIndex} notify={notify} />}
      {panel === 'blocks' && <>
        {selection && <button className="primary" onClick={() => void saveSelectionAsBlock()}>選択範囲をブロック保存</button>}
        {!selection && <button onClick={() => { setMode('select'); setPanel(undefined); }}>盤面で範囲を選択</button>}
        <div className="block-list">{blocks.length === 0 && <p>保存済みブロックはありません。</p>}{blocks.map((block) => <div key={block.id}><button onClick={() => choosePasteBlock(block)}>{block.name}<small>{block.rows}×{block.cols}</small></button><button onClick={() => void (async () => { await deleteBlock(block.id); await refreshBlocks(); })()}>削除</button></div>)}</div>
      </>}
      {panel === 'export' && <ExportControls board={board} onPng={runPngExport} onPdf={runPdfExport} onBackup={backup} onRestore={() => fileInputRef.current?.click()} />}
    </aside>}

    <input ref={fileInputRef} hidden type="file" accept=".knit,application/gzip" onChange={(event) => { void restore(event.target.files?.[0]); event.target.value = ''; }} />
    {busy && <div className="busy" role="status"><span className="spinner" />{busy}</div>}
    {message && <div className="toast" role="status">{message}</div>}
    <footer><span>© 2026 棒針編み図エディタ</span><a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noreferrer">プライバシー</a></footer>
  </div>;
}

function GridControls({ board, changed, mutateStructure, promptIndex, notify }: {
  board: Board; changed: () => void; mutateStructure: (operation: () => void) => void;
  promptIndex: (kind: 'row' | 'col', action: 'insert' | 'remove') => void; notify: (message: string) => void;
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
    <button className="danger" onClick={() => { if (confirm('盤面をすべて消去しますか？')) { board.clear(); changed(); notify('盤面を消去しました'); } }}>全体をクリア</button>
  </div>;
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
