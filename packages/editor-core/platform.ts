export type EditorAnalyticsValue = string | number;

/** Services supplied by the Web or WKWebView host. */
export interface EditorPlatform {
  saveFile(blob: Blob, filename: string): Promise<void>;
  requestBackupOpen(): Promise<void>;
  trackEvent(name: string, parameters?: Record<string, EditorAnalyticsValue>): void;
  registerPendingSaveFlusher(flush: () => Promise<boolean>): () => void;
}
