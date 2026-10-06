import { defaultPngCellSize } from '@knitting-editor/editor-core/export/exporters';
import type { PdfLayoutOptions } from '@knitting-editor/editor-core/export/pdfLayout';
import { isEditableTarget } from '@knitting-editor/editor-core/ui/hooks';
import type { EditorController } from '@knitting-editor/editor-core/ui/useEditorController';
import type { NativeCommand } from './nativeBridge';

export type NativeCommandHandlers = Record<NativeCommand, () => void>;

/**
 * メニューから書き出すPDFの設定。保存・出力パネルを初めて開いたときの既定値と同じにする。
 * 分割や用紙の向きを変えたいときは、パネルから書き出す。
 */
export const MENU_PDF_OPTIONS: PdfLayoutOptions = { layout: 'single', orientation: 'portrait', cellMillimeters: 5 };

type CommandEditor = Pick<EditorController,
  'session' | 'createNewDocument' | 'backup' | 'runPngExport' | 'runPdfExport' | 'undo' | 'redo'>;

/** ネイティブのメニュー項目を、画面のボタンと同じ編集画面の操作へ対応づける。 */
export function nativeCommandHandlers(editor: CommandEditor, actions: {
  /** 復元のファイル選択。アプリではネイティブのDocument Pickerを開く。 */
  requestRestore: () => void;
  openGuide: () => void;
}): NativeCommandHandlers {
  return {
    newDocument: () => { void editor.createNewDocument(); },
    restoreBackup: actions.requestRestore,
    exportBackup: () => { void editor.backup(false); },
    exportAllBackup: () => { void editor.backup(true); },
    // PNGの画素数も、パネルを初めて開いたときの既定値を使う。
    exportPng: () => {
      const { board } = editor.session;
      if (board) void editor.runPngExport(defaultPngCellSize(board));
    },
    exportPdf: () => { void editor.runPdfExport(MENU_PDF_OPTIONS); },
    undo: editor.undo,
    redo: editor.redo,
    openGuide: actions.openGuide,
  };
}

export type NativeCommandOutcome = 'performed' | 'textEditing' | 'blocked';

/**
 * ネイティブから届いた操作を実行する。
 *
 * - 元に戻す・やり直すはWeb版のキー操作（`useHistoryShortcuts`）と同じ扱いにする。入力欄
 *   （`isEditableTarget`）にフォーカスがある間は盤面ではなく入力中の文字に効かせ、
 *   それ以外では処理中やダイアログ・記号の一覧を開いている間も受け付ける。
 * - ほかの操作は、出力や復元などの処理中と、ダイアログ・記号の一覧を開いている間は始めない。
 */
export function runNativeCommand(command: NativeCommand, handlers: NativeCommandHandlers, state: { busy: boolean }, doc: Document = document): NativeCommandOutcome {
  const history = command === 'undo' || command === 'redo';
  if (history && isEditableTarget(doc.activeElement)) {
    // 標準の「取り消す」をメニューで置き換えたため、入力欄の取り消しもここから行う。
    if (typeof doc.execCommand === 'function') doc.execCommand(command);
    return 'textEditing';
  }
  if (!history && (state.busy || doc.querySelector('[aria-modal="true"]'))) return 'blocked';
  handlers[command]();
  return 'performed';
}

/**
 * メニューの「元に戻す」「やり直す」を選べるか。
 *
 * 入力欄にフォーカスがある間は、盤面の履歴にかかわらず選べるようにする。選べない項目のキーは
 * メニューを素通りしてページへ届くが、ページのキー操作は入力欄では何もしないため、
 * ⌘Zでの文字の取り消しが効かなくなる。選べる状態にして、常に`runNativeCommand`を通す。
 */
export function nativeHistoryState(history: { canUndo: boolean; canRedo: boolean }, textEditing: boolean) {
  return { canUndo: history.canUndo || textEditing, canRedo: history.canRedo || textEditing };
}

/**
 * 入力欄にフォーカスがあるかを見張り、変わったときに知らせる。
 * `focusout`の時点では移動先がまだ決まっていないことがあるため、次のタスクで読み直す。
 */
export function watchTextEditing(listener: (editing: boolean) => void, doc: Document = document): () => void {
  let editing = isEditableTarget(doc.activeElement);
  let timer: number | undefined;
  const check = () => {
    timer = undefined;
    const next = isEditableTarget(doc.activeElement);
    if (next === editing) return;
    editing = next;
    listener(next);
  };
  const scheduleCheck = () => {
    if (timer === undefined) timer = window.setTimeout(check, 0);
  };
  doc.addEventListener('focusin', check);
  doc.addEventListener('focusout', scheduleCheck);
  listener(editing);
  return () => {
    doc.removeEventListener('focusin', check);
    doc.removeEventListener('focusout', scheduleCheck);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
