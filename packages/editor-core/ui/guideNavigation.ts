import type { SaveOutcome } from '../state/useEditorSession';

export const GUIDE_NAVIGATION_SAVE_TIMEOUT_MS = 2_000;

interface GuideNavigationOptions {
  save: () => Promise<SaveOutcome>;
  notify: (message: string) => void;
  navigate: (destination: string) => void;
}

/** 保存結果を確認するまで編集画面を残す。タイムアウト後の完了では遷移しない。 */
export function createGuideNavigation({ save, notify, navigate }: GuideNavigationOptions) {
  let waiting = false;
  return async (destination: string): Promise<void> => {
    if (waiting) return;
    waiting = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    notify('使い方を開く前に、編集を保存しています。');
    try {
      const outcome = await Promise.race([
        save(),
        new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), GUIDE_NAVIGATION_SAVE_TIMEOUT_MS);
        }),
      ]);
      if (outcome === 'saved' || outcome === 'idle') {
        navigate(destination);
      } else if (outcome === 'pending') {
        notify('保存中に新しい編集が入りました。少し待ってから、もう一度「使い方」を押してください。');
      } else if (outcome === 'timeout') {
        notify('保存の完了を2秒以内に確認できませんでした。少し待ってから、もう一度「使い方」を押してください。');
      } else {
        notify('編集を保存できなかったため、使い方を開きませんでした。「保存」からバックアップを保存してください。');
      }
    } catch {
      notify('編集を保存できなかったため、使い方を開きませんでした。「保存」からバックアップを保存してください。');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      waiting = false;
    }
  };
}
