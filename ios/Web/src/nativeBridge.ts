import type { SaveFileOutcome } from '@knitting-editor/editor-core/platform';
import { bytesToBase64 } from '@knitting-editor/editor-core/util/base64';

export interface NativeBackupDetail {
  filename: string;
  dataBase64: string;
}

interface NativeBridgeMessage {
  version: 1;
  type: 'exportFile' | 'openBackup' | 'webReady' | 'commandState';
  /** `exportFile`の要求ID。ネイティブ側は書き出しを終えたら`knittingEditorNativeExportFinished`で返す。 */
  id?: string;
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
  canUndo?: boolean;
  canRedo?: boolean;
}

/** メニューバーとキーボードショートカットからネイティブ側が送る操作。`App/EditorCommands.swift`と対応する。 */
export const NATIVE_COMMANDS = [
  'newDocument', 'restoreBackup', 'exportBackup', 'exportAllBackup', 'exportPng', 'exportPdf', 'undo', 'redo', 'openGuide',
] as const;
export type NativeCommand = typeof NATIVE_COMMANDS[number];

export function isNativeCommand(value: unknown): value is NativeCommand {
  return typeof value === 'string' && (NATIVE_COMMANDS as readonly string[]).includes(value);
}

interface NativeMessageHandler {
  postMessage(message: NativeBridgeMessage): void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        knittingEditor?: NativeMessageHandler;
      };
    };
  }
}

function nativeHandler(): NativeMessageHandler | undefined {
  return window.webkit?.messageHandlers?.knittingEditor;
}

/** ネイティブ側へ送る。受け口が無い、または送れなかったときは`false`を返す。 */
function post(message: NativeBridgeMessage): boolean {
  const handler = nativeHandler();
  if (!handler) return false;
  try {
    handler.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export const NATIVE_EXPORT_FINISHED_EVENT = 'knittingEditorNativeExportFinished';

/** 結果を待っている書き出し。ページを読み直すと、待っていた処理ごと消える。 */
const pendingExports = new Map<string, (saved: boolean | undefined) => void>();
let exportSequence = 0;

function nextExportRequestId(): string {
  exportSequence += 1;
  // 読み直したページの番号と重ならないよう、時刻と乱数を添える。Swift側は英数字・`-`・`_`の64文字までを受け付ける。
  return `export-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${exportSequence}`;
}

function settleExport(id: string, saved: boolean | undefined) {
  const resolve = pendingExports.get(id);
  if (!resolve) return;
  pendingExports.delete(id);
  resolve(saved);
}

let listeningExportFinished = false;

function listenExportFinished() {
  if (listeningExportFinished) return;
  listeningExportFinished = true;
  window.addEventListener(NATIVE_EXPORT_FINISHED_EVENT, (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object') return;
    const { id, saved } = detail as { id?: unknown; saved?: unknown };
    if (typeof id !== 'string') return;
    settleExport(id, typeof saved === 'boolean' ? saved : undefined);
  });
}

/** 編み図名やファイル内容は変えず、Swiftのファイル名検査に通る出力名を作る。 */
function safeExportFilename(filename: string): string {
  // FoundationのcontrolCharactersはCcに加えてCf（不可視の書式制御文字）も含む。
  const safe = filename.replace(/[\/\\\p{Cc}\p{Cf}]/gu, '_').replace(/\.{2,}/g, '_').trim();
  const extension = safe.match(/\.(png|pdf|knit)$/i)?.[0] ?? '';
  const stem = safe.slice(0, safe.length - extension.length) || 'chart';
  // SwiftのString.countと同様に、結合文字や絵文字を途中で分割しない。
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(stem);
  let truncated = '';
  let count = 0;
  for (const { segment } of segments) {
    if (count >= 180 - extension.length) break;
    truncated += segment;
    count += 1;
  }
  // 切り詰めた末尾の点と拡張子の点が、新たな`..`にならないようにする。
  return truncated.replace(/\.+$/, '_') + extension;
}

/**
 * ネイティブの保存画面・共有シートへファイルを渡す。受け口が無い、または送れなかったときは`undefined`を返す。
 *
 * `saved`は、保存・共有を終えたら`true`、保存画面・共有シート・確認アラートを取りやめたら`false`になる（#122）。
 * 前の書き出しの結果を待っている間に次を送ると、ネイティブ側は前の書き出しを取りやめとして返す。
 */
export async function saveBlobWithNativeBridge(blob: Blob, filename: string): Promise<SaveFileOutcome | undefined> {
  // 受け口が無いときはBlobを読み出さずに返し、呼び出し側のダウンロードへ任せる。
  if (!nativeHandler()) return undefined;
  listenExportFinished();
  const id = nextExportRequestId();
  const saved = new Promise<boolean | undefined>((resolve) => pendingExports.set(id, resolve));
  try {
    const posted = post({
      version: 1,
      type: 'exportFile',
      id,
      filename: safeExportFilename(filename),
      mimeType: blob.type || 'application/octet-stream',
      dataBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    });
    if (posted) return { saved };
  } catch {
    // 送れなかったときは下で待ちを片付け、ダウンロードへ任せる。
  }
  settleExport(id, undefined);
  return undefined;
}

export function requestNativeBackupOpen(): boolean {
  return post({ version: 1, type: 'openBackup' });
}

export function notifyNativeReady(): boolean {
  return post({ version: 1, type: 'webReady' });
}

/** 元に戻す・やり直すをメニューで選べるかどうかをネイティブ側へ伝える。 */
export function notifyNativeCommandState(state: { canUndo: boolean; canRedo: boolean }): boolean {
  return post({ version: 1, type: 'commandState', canUndo: state.canUndo, canRedo: state.canRedo });
}

export function listenNativeBackupSelected(listener: (detail: NativeBackupDetail) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object') return;
    const candidate = detail as Partial<NativeBackupDetail>;
    if (typeof candidate.filename !== 'string' || typeof candidate.dataBase64 !== 'string') return;
    listener({ filename: candidate.filename, dataBase64: candidate.dataBase64 });
  };
  window.addEventListener('knittingEditorNativeBackupSelected', handler);
  return () => window.removeEventListener('knittingEditorNativeBackupSelected', handler);
}

export function listenNativeError(listener: (message: string) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail === 'string' && detail) listener(detail);
  };
  window.addEventListener('knittingEditorNativeError', handler);
  return () => window.removeEventListener('knittingEditorNativeError', handler);
}

export function listenNativeCommand(listener: (command: NativeCommand) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isNativeCommand(detail)) listener(detail);
  };
  window.addEventListener('knittingEditorNativeCommand', handler);
  return () => window.removeEventListener('knittingEditorNativeCommand', handler);
}
