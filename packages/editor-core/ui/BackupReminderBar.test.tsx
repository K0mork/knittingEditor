import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '../platform';
import { BACKUP_REMINDER_EDIT_THRESHOLD, BACKUP_REMINDER_SNOOZE_KEY, BACKUP_REMINDER_SNOOZE_MS } from '../state/backupReminder';
import * as storage from '../storage/database';
import {
  createDocument, getLastBackupAt, getSetting, initializeStorage, listBlocks, saveDocument, setSetting,
} from '../storage/database';
import { AUTOSAVE_DELAY_MS } from '../state/useEditorSession';
import { BACKUP_REMINDER_IDLE_MS } from '../state/useBackupReminder';
import { EditorView } from './EditorView';
import { useEditorController } from './useEditorController';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

async function waitUntil(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(condition()).toBe(true);
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  await setSetting(BACKUP_REMINDER_SNOOZE_KEY, 0);
});

/** 作ってから`ageDays`日たち、そのあと編集したことのある編み図を開いた状態にする。 */
async function openEditedChart(name: string, ageDays: number) {
  const document = await createDocument(name);
  await saveDocument({ ...document, createdAt: Date.now() - ageDays * DAY }, new Board(20, 20));
  return document;
}

/** 画面に指・ポインタを置く、または離す。盤面はポインタを捕まえるので、通知は画面全体へ届く。 */
async function pointer(type: 'pointerdown' | 'pointerup' | 'pointercancel', pointerId: number) {
  await act(async () => { window.dispatchEvent(Object.assign(new Event(type), { pointerId })); });
}

async function renderEditor(saved: boolean | undefined = undefined) {
  const platform: EditorPlatform = {
    saveFile: vi.fn(async () => saved === undefined ? SAVE_RESULT_UNKNOWN : { saved: Promise.resolve(saved) }),
  };
  function Host() {
    const editor = useEditorController({
      initialize: async () => ({ ...await initializeStorage(), blocks: await listBlocks() }),
      platform,
      askText: async () => null,
      askConfirm: async () => false,
    });
    return <EditorView editor={editor} renderTitle={(status) => <h1>{status}</h1>} backupNote="案内" footer={null} />;
  }
  const container = document.createElement('div');
  document.body.append(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<Host />);
  });
  await waitUntil(() => container.querySelector('.app-shell') !== null);
  cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  const click = async (label: string, scope: ParentNode = container) => {
    const found = Array.from(scope.querySelectorAll('button')).find((item) => item.textContent === label);
    if (!found) throw new Error(`button not found: ${label}`);
    await act(async () => { found.click(); });
  };
  const reminder = () => container.querySelector('.backup-reminder');
  const panelText = () => container.querySelector('.export-controls')?.textContent ?? '';
  return { container, platform, click, reminder, panelText };
}

describe('backup reminder', () => {
  it('stays hidden on a fresh chart and shows the never-backed-up status in the panel', async () => {
    await createDocument('新品の編み図');
    const { click, reminder, panelText } = await renderEditor();
    // 記録の読み込みを待つ間に出ないことも含めて、少し待ってから確かめる。
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(reminder()).toBeNull();
    await click('保存');
    await waitUntil(() => panelText().includes('この編み図はまだバックアップしていません。'));
  });

  it('suggests a backup for a week-old chart, exports it, and shows the date', async () => {
    const document = await openEditedChart('一週間前の編み図', 8);
    const { container, platform, click, reminder, panelText } = await renderEditor();
    await waitUntil(() => reminder() !== null);
    expect(reminder()!.textContent).toContain('この編み図はまだバックアップしていません。');

    await click('書き出す', reminder()!);
    await waitUntil(() => vi.mocked(platform.saveFile).mock.calls.length > 0);
    expect(vi.mocked(platform.saveFile).mock.calls[0][1]).toBe('一週間前の編み図.knit');
    await waitUntil(() => reminder() === null);
    const recorded = await getLastBackupAt(document.id);
    expect(recorded).toBeGreaterThan(Date.now() - 60_000);

    await click('保存');
    expect(panelText()).toContain('この編み図の最後のバックアップ：');
    expect(container.querySelector('.backup-reminder')).toBeNull();
  });

  it('does not record a backup when the user cancels saving', async () => {
    const document = await openEditedChart('取りやめる編み図', 8);
    const { container, platform, click, reminder, panelText } = await renderEditor(false);
    await waitUntil(() => reminder() !== null);

    await click('書き出す', reminder()!);
    await waitUntil(() => vi.mocked(platform.saveFile).mock.calls.length > 0);
    // 処理を終え、記録を書き込むなら書き込み終える時間を置いてから、帯が残り、日時が記録されていないことを確かめる。
    await waitUntil(() => container.querySelector('.busy') === null);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(reminder()).not.toBeNull();
    expect(await getLastBackupAt(document.id)).toBeUndefined();
    await click('保存');
    expect(panelText()).toContain('この編み図はまだバックアップしていません。');
  });

  it('waits after "later" and keeps waiting after a reload', async () => {
    await openEditedChart('あとで書き出す編み図', 30);
    const first = await renderEditor();
    await waitUntil(() => first.reminder() !== null);
    await first.click('あとで', first.reminder()!);
    expect(first.reminder()).toBeNull();
    const snoozedUntil = await getSetting<number>(BACKUP_REMINDER_SNOOZE_KEY);
    expect(snoozedUntil).toBeGreaterThan(Date.now() + BACKUP_REMINDER_SNOOZE_MS - 60_000);
    await cleanup!();
    cleanup = undefined;

    const second = await renderEditor();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(second.reminder()).toBeNull();
  });

  it('suggests a backup after many edits, once the user pauses', async () => {
    await createDocument('たくさん編集する編み図');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { click, reminder } = await renderEditor();
      await click('盤面');
      for (let count = 1; count < BACKUP_REMINDER_EDIT_THRESHOLD; count++) await click('上に段');
      await click('閉じる');
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS); });
      expect(reminder()).toBeNull();

      await click('盤面');
      await click('上に段');
      await click('閉じる');
      // 続けて編集している間は出さず、盤面をずらさない。
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS - 100); });
      expect(reminder()).toBeNull();
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(reminder()?.textContent).toContain('この編み図はまだバックアップしていません。');

      // ドロワーを開いている間は出さない。
      await click('盤面');
      expect(reminder()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the reminder back while a finger or pointer stays on the screen', async () => {
    await createDocument('なぞり描きを続ける編み図');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { click, reminder } = await renderEditor();
      await click('盤面');
      for (let count = 0; count < BACKUP_REMINDER_EDIT_THRESHOLD; count++) await click('上に段');
      await click('閉じる');

      // 編集の直後に次のなぞり描きを始め、指を置いたままにしても出さない。
      await pointer('pointerdown', 1);
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS * 3); });
      expect(reminder()).toBeNull();

      // 2本指で触れている間も出さない。1本離しただけでは数え始めない。
      await pointer('pointerdown', 2);
      await pointer('pointerup', 1);
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS * 3); });
      expect(reminder()).toBeNull();

      // すべて離してから数え直す。
      await pointer('pointercancel', 2);
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS - 100); });
      expect(reminder()).toBeNull();
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(reminder()?.textContent).toContain('この編み図はまだバックアップしていません。');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a lasting save failure in the reminder slot only once the user pauses', async () => {
    await createDocument('保存できない編み図');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const failing = vi.spyOn(storage, 'saveDocument').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    try {
      const { container, click } = await renderEditor();
      const notice = () => container.querySelector('.backup-reminder[aria-label="保存の失敗"]');
      const edit = async () => { await click('盤面'); await click('上に段'); await click('閉じる'); };

      // 自動保存が失敗しても、指を置いている間は帯を出さず、盤面をずらさない。
      await pointer('pointerdown', 1);
      await edit();
      await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
      await waitUntil(() => container.querySelector('h1')?.textContent?.includes('保存失敗') === true);
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS * 3); });
      expect(notice()).toBeNull();

      await pointer('pointerup', 1);
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS - 100); });
      expect(notice()).toBeNull();
      await act(async () => { vi.advanceTimersByTime(100); });
      expect(notice()?.querySelector('[role="alert"]')?.textContent).toContain('端末内への保存に失敗しています。');

      // 保存できるようになっても、手を止めるまでは帯を残す。
      failing.mockRestore();
      await edit();
      await act(async () => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
      await waitUntil(() => container.querySelector('h1')?.textContent?.includes('保存済み') === true);
      expect(notice()).not.toBeNull();
      await act(async () => { vi.advanceTimersByTime(BACKUP_REMINDER_IDLE_MS); });
      expect(notice()).toBeNull();
    } finally {
      failing.mockRestore();
      vi.useRealTimers();
    }
  });
});
