import { useEffect, useState, type MouseEventHandler, type ReactNode } from 'react';
import { BoardCanvas, type CanvasMode } from '../canvas/BoardCanvas';
import { parseColor } from '../model/Board';
import { describeColor } from '../model/usedColors';
import { ColorPicker } from './ColorPicker';
import { ExportControls } from './ExportControls';
import { GridControls } from './GridControls';
import { DocumentList } from './DocumentList';
import { gestureHintText, historyTitles, useInputEnvironment } from './inputEnvironment';
import { StitchPicker } from './StitchPicker';
import { BackupReminderBar } from './BackupReminderBar';
import { backupStatusText } from '../state/backupReminder';
import { EDITOR_PANEL_TITLES, type EditorController, type EditorPanel } from './useEditorController';

export interface EditorViewProps {
  editor: EditorController;
  /**
   * ヘッダーの題字。Web版は説明文を添え、iOS版は編み図名だけを出すので組み立てを任せる。
   * `documentStatus`は編み図名と保存状態で、`aria-live`の要素の中へ置く。
   */
  renderTitle: (documentStatus: ReactNode) => ReactNode;
  /** 使い方ページへのリンクを押したとき。両ホストで移動前に保留中の保存を確認する。 */
  onGuideClick?: MouseEventHandler<HTMLAnchorElement>;
  /** 復元ボタン。`true`を返すと処理済みとみなし、ファイル選択を開かない。 */
  requestRestore?: () => boolean;
  /** 端末内データが消える条件はWeb版とiOS版で違うので、案内文だけ差し替える。 */
  backupNote: ReactNode;
  /** 「編み図」パネルの一覧の後ろに置く案内。Web版はプライバシーポリシーへのリンクを渡し、iOS版は何も渡さない。 */
  documentsNote?: ReactNode;
  footer: ReactNode;
  /** 盤面の上に重ねる環境固有の要素。iOS版のアプリ内ダイアログなど。 */
  children?: ReactNode;
}

const MODE_BUTTONS: Array<{ mode: CanvasMode; label: string }> = [
  { mode: 'draw', label: '描く' },
  { mode: 'erase', label: '消す' },
  { mode: 'select', label: '範囲' },
];

const ACTION_BAR_PANELS: Array<{ panel: EditorPanel; label: string }> = [
  { panel: 'grid', label: '盤面' },
  { panel: 'blocks', label: 'ブロック' },
  { panel: 'export', label: '保存' },
];

/** 元に戻す・やり直すの矢印。文字の↶↷は書体によって細く小さく見えるので描く。 */
function HistoryIcon({ direction }: { direction: 'undo' | 'redo' }) {
  return <svg className="history-icon" viewBox="0 0 24 24" aria-hidden="true" style={direction === 'redo' ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>;
}

/** 操作のヒントを出しておく時間。盤面の下の段を隠すので、読み終えたころに消す。 */
export const GESTURE_HINT_DURATION_MS = 10_000;

/** 盤面の右下に出す操作のヒント。開いてから`GESTURE_HINT_DURATION_MS`で消える。 */
function GestureHint({ mode }: { mode: CanvasMode }) {
  const environment = useInputEnvironment();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), GESTURE_HINT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className={visible ? 'gesture-hint' : 'gesture-hint is-hidden'} aria-hidden={!visible || undefined}>{gestureHintText(mode, environment)}</div>;
}

/** 編集画面の組み立て。Web版とiOS版で共通。 */
export function EditorView({ editor, renderTitle, onGuideClick, requestRestore, backupNote, documentsNote, footer, children }: EditorViewProps) {
  const { session, mode, panel, selection, copiedBlock } = editor;
  const history = historyTitles(useInputEnvironment());
  const { board, activeDocument, dirty } = session;
  if (editor.initializationError) return <main className="loading" role="alert">編み図を読み込めませんでした：{editor.initializationError}<button onClick={() => window.location.reload()}>再読み込み</button></main>;
  if (!board || !activeDocument) return <main className="loading">編み図を読み込んでいます…</main>;

  const documentStatus = <>{activeDocument.name}<span aria-hidden="true">{dirty ? '（保存中…）' : ''}</span><span className="visually-hidden">、{dirty ? '保存中' : '保存済み'}</span></>;
  const modeButton = (target: CanvasMode, label: string, onClick: () => void) => <button key={target} className={mode === target ? 'active' : ''} aria-pressed={mode === target} onClick={onClick}>{label}</button>;

  return <div className="app-shell">
    <header className="app-header">
      {renderTitle(documentStatus)}
      <div className="header-actions">
        <a className="header-guide" href="/guide/" onClick={onGuideClick}>使い方</a>
        <button className="header-document" aria-controls="app-drawer" aria-expanded={panel === 'documents'} onClick={() => editor.togglePanel('documents')}>編み図</button>
      </div>
    </header>

    <main className="workspace">
      <section className="primary-tools" aria-label="編集ツール">
        <button className="color-tool" aria-label={`記号の色を選ぶ（現在：${describeColor(parseColor(editor.selectedColor))} ${editor.selectedColor}）`} aria-haspopup="dialog" aria-expanded={editor.colorPickerOpen} onClick={() => editor.setColorPickerOpen(true)}>
          <span>色</span>
          <span className="color-tool-swatch" aria-hidden="true" style={{ backgroundColor: editor.selectedColor }} />
        </button>
        <button className="stitch-tool" aria-label="編み目記号を選ぶ" aria-haspopup="dialog" aria-expanded={editor.stitchPickerOpen} onClick={() => editor.setStitchPickerOpen(true)}>
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: editor.currentStitch.svg }} />
          <span className="stitch-tool-name">{editor.currentStitch.name}</span>
          <span className="stitch-tool-chevron" aria-hidden="true">⌄</span>
        </button>
        {MODE_BUTTONS.map((item) => modeButton(item.mode, item.label, () => editor.chooseMode(item.mode)))}
        {copiedBlock && modeButton('paste', '貼付', () => editor.startPaste(copiedBlock))}
      </section>

      {editor.colorPickerOpen && <ColorPicker
        board={board}
        revision={session.revision}
        selectedColor={editor.selectedColor}
        onSelect={editor.selectColor}
        onChange={editor.setSelectedColor}
        onClose={() => editor.setColorPickerOpen(false)}
      />}

      {editor.stitchPickerOpen && <StitchPicker
        selectedStitch={editor.selectedStitch}
        onClose={() => editor.setStitchPickerOpen(false)}
        onSelect={editor.selectStitch}
      />}

      {selection && <div className="selection-actions" role="toolbar" aria-label="選択範囲の操作">
        <button className="primary" onClick={editor.copySelection}>コピーして貼付</button>
        <button onClick={editor.clearSelection}>解除</button>
      </div>}

      {/* ドロワーや処理中の表示と重なるときは出さない。 */}
      {editor.backupReminder.kind && !panel && !editor.busy && <BackupReminderBar kind={editor.backupReminder.kind}
        lastBackupAt={editor.backupReminder.lastBackupAt} onBackup={() => void editor.backup(false)} onSnooze={editor.backupReminder.snooze} />}

      <section className="canvas-wrap">
        <BoardCanvas board={board} background={session.backgroundColor} revision={session.revision} stitchKey={editor.selectedStitch} color={editor.selectedColor} mode={mode}
          selection={selection} pasteBlock={editor.pasteBlock} onChange={editor.strokeChanged} onEditEnd={editor.commitStroke} onSelectionChange={editor.setSelection} onPasteComplete={editor.handlePasteComplete} />
        <GestureHint mode={mode} />
      </section>

      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{editor.modeLabel}モード。{selection ? '選択範囲あり' : '選択範囲なし'}</p>

      <nav className="action-bar" aria-label="操作メニュー">
        {ACTION_BAR_PANELS.map((item) => <button key={item.panel} aria-controls="app-drawer" aria-expanded={panel === item.panel} onClick={() => editor.togglePanel(item.panel)}>{item.label}</button>)}
        {/* 上の道具列は狭い画面で余白が無いので、親指の届く操作メニューに置く。盤面には重ねない。 */}
        <div className="history-tools" role="group" aria-label="編集履歴">
          <button aria-label="元に戻す" title={history.undo} disabled={!session.canUndo} onClick={editor.undo}><HistoryIcon direction="undo" /><span className="history-label" aria-hidden="true">戻す</span></button>
          <button aria-label="やり直す" title={history.redo} disabled={!session.canRedo} onClick={editor.redo}><HistoryIcon direction="redo" /><span className="history-label" aria-hidden="true">やり直す</span></button>
        </div>
      </nav>
    </main>

    {panel && <aside ref={editor.panelRef} id="app-drawer" className="drawer" aria-labelledby="app-drawer-title">
      <div className="drawer-heading"><h2 id="app-drawer-title" tabIndex={-1}>{EDITOR_PANEL_TITLES[panel]}</h2><button onClick={editor.closePanel}>閉じる</button></div>
      {panel === 'documents' && <>
        <button className="primary" onClick={() => void editor.createNewDocument()}>新しい編み図</button>
        <DocumentList documents={session.documents} activeId={activeDocument.id}
          onOpen={(document) => void editor.switchDocument(document)} onRename={(document) => void editor.renameChart(document)}
          onDuplicate={(document) => void editor.duplicateChart(document)} onDelete={(document) => void editor.deleteChart(document)} />
        {documentsNote && <p className="documents-note">{documentsNote}</p>}
      </>}
      {panel === 'grid' && <GridControls board={board} backgroundColor={session.backgroundColor} onBackgroundColorChange={session.setBackgroundColor} changed={editor.changed} askText={editor.askText} askConfirm={editor.askConfirm} notify={editor.notify} />}
      {panel === 'blocks' && <>
        {selection && <><button className="primary" onClick={editor.copySelection}>保存せずコピーして貼付</button><button onClick={() => void editor.saveSelectionAsBlock()}>選択範囲をブロック保存</button></>}
        {!selection && <button onClick={editor.startSelecting}>盤面で範囲を選択</button>}
        <div className="block-list">{session.blocks.length === 0 && <p>保存済みブロックはありません。</p>}{session.blocks.map((block) => <div key={block.id}><button onClick={() => editor.choosePasteBlock(block)}>{block.name}<small>{block.rows}×{block.cols}</small></button><button onClick={() => void editor.removeBlock(block)}>削除</button></div>)}</div>
      </>}
      {panel === 'export' && <ExportControls board={board} onPng={editor.runPngExport} onPdf={editor.runPdfExport} onBackup={editor.backup}
        onRestore={() => { if (!requestRestore?.()) editor.fileInputRef.current?.click(); }}
        backupStatus={editor.backupReminder.loaded ? backupStatusText(editor.backupReminder.lastBackupAt) : undefined}
        backupNote={backupNote} />}
    </aside>}

    <input ref={editor.fileInputRef} hidden type="file" accept=".knit,application/gzip" onChange={(event) => { void editor.restore(event.target.files?.[0]); event.target.value = ''; }} />
    {children}
    {editor.busy && <div className="busy" role="status" aria-live="polite"><span className="spinner" />{editor.busy}</div>}
    {editor.message && <div className="toast" role="status" aria-live="polite" aria-atomic="true">{editor.message}</div>}
    {footer}
  </div>;
}
