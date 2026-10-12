import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaveOutcome } from '../state/useEditorSession';
import { createGuideNavigation, GUIDE_NAVIGATION_SAVE_TIMEOUT_MS } from './guideNavigation';

afterEach(() => vi.useRealTimers());

describe('guide navigation after saving', () => {
  it.each(['saved', 'idle'] as const)('navigates only after %s', async (outcome) => {
    let complete!: (result: SaveOutcome) => void;
    const save = vi.fn(() => new Promise<SaveOutcome>((resolve) => { complete = resolve; }));
    const navigate = vi.fn();
    const notify = vi.fn();
    const open = createGuideNavigation({ save, navigate, notify });
    const pending = open('/guide/');
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('保存しています'));
    await open('/guide/');
    expect(save).toHaveBeenCalledTimes(1);
    complete(outcome);
    await pending;
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/guide/');
  });

  it.each(['failed', 'pending'] as const)('keeps the editor and explains %s, allowing retry', async (outcome) => {
    const save = vi.fn<() => Promise<SaveOutcome>>().mockResolvedValueOnce(outcome).mockResolvedValueOnce('saved');
    const navigate = vi.fn();
    const notify = vi.fn();
    const open = createGuideNavigation({ save, navigate, notify });
    await open('/guide/');
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining(outcome === 'failed' ? 'バックアップ' : 'もう一度'));
    await open('/guide/');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/guide/');
  });

  it('keeps the editor after timeout even if the original save finishes later', async () => {
    vi.useFakeTimers();
    let complete!: (result: SaveOutcome) => void;
    const navigate = vi.fn();
    const notify = vi.fn();
    const open = createGuideNavigation({
      save: () => new Promise<SaveOutcome>((resolve) => { complete = resolve; }), navigate, notify,
    });
    const pending = open('/guide/');
    await vi.advanceTimersByTimeAsync(GUIDE_NAVIGATION_SAVE_TIMEOUT_MS);
    await pending;
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('2秒以内'));
    complete('saved');
    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the editor if saving throws', async () => {
    const navigate = vi.fn();
    const notify = vi.fn();
    await createGuideNavigation({ save: async () => { throw new Error('storage'); }, navigate, notify })('/guide/');
    expect(navigate).not.toHaveBeenCalled();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('バックアップ'));
  });
});
