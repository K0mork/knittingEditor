import type { EditorPlatform } from '@knitting-editor/editor-core/platform';
import { requestNativeBackupOpen, saveBlobWithNativeBridge } from './nativeBridge';

function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const iosPlatform: EditorPlatform = {
  saveFile: async (blob, filename) => {
    if (!(await saveBlobWithNativeBridge(blob, filename))) browserDownload(blob, filename);
  },
  requestBackupOpen: async () => { requestNativeBackupOpen(); },
  trackEvent: () => undefined,
  registerPendingSaveFlusher: (flush) => {
    const handler = () => { void flush(); };
    window.addEventListener('knittingEditorAppWillResignActive', handler);
    return () => window.removeEventListener('knittingEditorAppWillResignActive', handler);
  },
};
