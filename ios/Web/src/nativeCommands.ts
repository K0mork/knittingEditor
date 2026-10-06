import { defaultPngCellSize } from '@knitting-editor/editor-core/export/exporters';
import type { PdfLayoutOptions } from '@knitting-editor/editor-core/export/pdfLayout';
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

/** 文字を入力している要素。ここでの取り消しは盤面ではなく入力中の文字に効かせる。 */
function isEditable(element: Element | null): boolean {
  return element instanceof HTMLElement
    && (element.isContentEditable || element.tagName === 'TEXTAREA'
      || (element instanceof HTMLInputElement && !['button', 'checkbox', 'color', 'radio', 'range', 'submit'].includes(element.type)));
}

/**
 * ネイティブから届いた操作を実行する。
 *
 * - 元に戻す・やり直すは、入力欄で文字を打っている間は入力欄の取り消しにする。
 *   Web版のキー操作（`useHistoryShortcuts`）と同じ扱い。
 * - 出力や復元などの処理中と、ダイアログ・記号の一覧を開いている間は、ほかの操作を始めない。
 *   元に戻す・やり直すはWeb版のキー操作と同じく、処理中でなければ受け付ける。
 */
export function runNativeCommand(command: NativeCommand, handlers: NativeCommandHandlers, state: { busy: boolean }, doc: Document = document): NativeCommandOutcome {
  const history = command === 'undo' || command === 'redo';
  if (history && isEditable(doc.activeElement)) {
    if (typeof doc.execCommand === 'function') doc.execCommand(command);
    return 'textEditing';
  }
  if (state.busy) return 'blocked';
  if (!history && doc.querySelector('[aria-modal="true"]')) return 'blocked';
  handlers[command]();
  return 'performed';
}
