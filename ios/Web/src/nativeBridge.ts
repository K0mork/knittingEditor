import { bytesToBase64 } from '@knitting-editor/editor-core/util/base64';

export interface NativeBackupDetail {
  filename: string;
  dataBase64: string;
}

interface NativeBridgeMessage {
  version: 1;
  type: 'exportFile' | 'openBackup' | 'webReady';
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
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

export async function saveBlobWithNativeBridge(blob: Blob, filename: string): Promise<boolean> {
  // 受け口が無いときはBlobを読み出さずに返し、呼び出し側のダウンロードへ任せる。
  if (!nativeHandler()) return false;
  try {
    return post({
      version: 1,
      type: 'exportFile',
      filename,
      mimeType: blob.type || 'application/octet-stream',
      dataBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    });
  } catch {
    return false;
  }
}

export function requestNativeBackupOpen(): boolean {
  return post({ version: 1, type: 'openBackup' });
}

export function notifyNativeReady(): boolean {
  return post({ version: 1, type: 'webReady' });
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
