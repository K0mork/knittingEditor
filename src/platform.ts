import type { EditorPlatform } from '@knitting-editor/editor-core/platform';

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const webPlatform: EditorPlatform = {
  saveFile: async (blob, filename) => download(blob, filename),
  requestBackupOpen: async () => undefined,
  trackEvent: () => undefined,
  registerPendingSaveFlusher: (flush) => {
    const handler = () => { void flush(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  },
};
