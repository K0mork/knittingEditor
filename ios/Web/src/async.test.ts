import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './async';

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the operation result and clears its timer', async () => {
    vi.useFakeTimers();
    const result = withTimeout(Promise.resolve('完了'), 1000, 'timeout');
    expect(vi.getTimerCount()).toBe(1);
    await expect(result).resolves.toBe('完了');
    // 結果が先に届いたら、タイムアウトの予約は残さない。
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes the operation failure through and clears its timer', async () => {
    vi.useFakeTimers();
    const result = withTimeout(Promise.reject(new Error('読み込めませんでした')), 1000, 'timeout');
    expect(vi.getTimerCount()).toBe(1);
    await expect(result).rejects.toThrow('読み込めませんでした');
    expect(vi.getTimerCount()).toBe(0);
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
