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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function saveBlobWithNativeBridge(blob: Blob, filename: string): Promise<boolean> {
  const handler = nativeHandler();
  if (!handler) return false;
  try {
    handler.postMessage({
      version: 1,
      type: 'exportFile',
      filename,
      mimeType: blob.type || 'application/octet-stream',
      dataBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    });
    return true;
  } catch {
    return false;
  }
}

export function requestNativeBackupOpen(): boolean {
  const handler = nativeHandler();
  if (!handler) return false;
  try {
    handler.postMessage({ version: 1, type: 'openBackup' });
    return true;
  } catch {
    return false;
  }
}

export function notifyNativeReady(): boolean {
  const handler = nativeHandler();
  if (!handler) return false;
  try {
    handler.postMessage({ version: 1, type: 'webReady' });
    return true;
  } catch {
    return false;
  }
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
