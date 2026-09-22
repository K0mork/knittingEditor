/**
 * Reject an asynchronous operation when it does not make progress within the
 * user-visible timeout. The underlying promise is intentionally left running;
 * Promise.race attaches a rejection handler so a late failure is not unhandled.
 */
export function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}
