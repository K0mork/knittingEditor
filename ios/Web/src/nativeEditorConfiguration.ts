declare global {
  interface Window {
    knittingEditorDebugConfiguration?: { readonly autosaveDelayMs?: unknown };
  }
}

/** DEBUGネイティブが文書開始時に渡した設定だけを使う。URLやWeb側の環境変数は読まない。 */
export function nativeAutosaveDelayMs(): number | undefined {
  const value = window.knittingEditorDebugConfiguration?.autosaveDelayMs;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647
    ? value : undefined;
}
