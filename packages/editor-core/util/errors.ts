/** 例外を利用者へ見せる文言にする。`Error`以外が投げられても文字列として扱う。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
