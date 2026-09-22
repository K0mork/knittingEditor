import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './async';

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the operation result and clears its timer', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve('完了'), 1000, 'timeout')).resolves.toBe('完了');
    await vi.runOnlyPendingTimersAsync();
  });

  it('rejects with the supplied message when the operation stalls', async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const result = withTimeout(pending, 1000, '初期化がタイムアウトしました');
    const assertion = expect(result).rejects.toThrow('初期化がタイムアウトしました');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
