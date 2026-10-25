import 'fake-indexeddb/auto';
import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { BACKUP_REMINDER_STALE_MS, backupReminderKind } from '../state/backupReminder';
import { createDocument, getLastBackupAt, importBackup, listDocuments } from './database';
import { compareDocuments } from './documentOrder';

function backup(documents: unknown[]) {
  return new Blob([gzipSync(strToU8(JSON.stringify({ format: 'knitting-editor', version: 2, documents, blocks: [] }))) ]);
}
function chart(name: string, updatedAt?: number, createdAt?: number) {
  return { name, rows: 1, cols: 1, cells: 'AAAAAA==', updatedAt, createdAt };
}

describe('restored dates and ordering', () => {
  it('keeps original update dates, existing charts, new IDs and the restore suffix regardless of ID order', async () => {
    const existing = await createDocument('既存', 1, 1);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(5000);
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('ffffffff-ffff-4fff-8fff-ffffffffffff')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000000');
    try {
      const result = await importBackup(backup([chart('新', 20, 2), chart('旧（復元）', 10, 1)]));
      expect(result.documents.map((item) => [item.name, item.createdAt, item.updatedAt])).toEqual([
        ['新（復元）', 5000, 20], ['旧（復元）（復元）', 5000, 10],
      ]);
      expect(result.documents.every((item) => item.id !== existing.id)).toBe(true);
      const documents = await listDocuments();
      expect(documents.find((item) => item.id === existing.id)).toEqual(existing);
      expect(documents.filter((item) => result.documents.some((restored) => restored.id === item.id)).map((item) => item.name))
        .toEqual(['新（復元）', '旧（復元）（復元）']);
    } finally { uuid.mockRestore(); clock.mockRestore(); }
  });

  it('uses restore time for creation dates and for absent or invalid update dates, and preserves zero', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1234);
    try {
      const result = await importBackup(backup([chart('ゼロ', 0, 0), chart('旧形式'), chart('不正', NaN, NaN)]));
      expect(result.documents.map((item) => [item.createdAt, item.updatedAt])).toEqual([[1234, 0], [1234, 1234], [1234, 1234]]);
    } finally { clock.mockRestore(); }
  });

  it('keeps equal-date order stable across restores and input orders', async () => {
    // 2回の復元で作成日時をそろえ、同名の編み図の順序がIDだけで決まるようにする。
    // IDは入力順・保存キー順のどちらとも違う並びになるように割り当てる。
    const clock = vi.spyOn(Date, 'now').mockReturnValue(7000);
    const uuid = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001');
    try {
      const first = (await importBackup(backup([chart('B', 50, 1), chart('A', 50, 1)]))).documents;
      const second = (await importBackup(backup([chart('A', 50, 1), chart('B', 50, 1)]))).documents;
      expect([...first, ...second].map((item) => [item.name, item.id.slice(-1)])).toEqual([
        ['B（復元）', '4'], ['A（復元）', '3'], ['A（復元）', '2'], ['B（復元）', '1'],
      ]);
      expect([...first].sort(compareDocuments).map((item) => item.name)).toEqual(['A（復元）', 'B（復元）']);
      expect([...second].reverse().sort(compareDocuments).map((item) => item.name)).toEqual(['A（復元）', 'B（復元）']);
      const same = { ...first[0], name: '同名' };
      expect([{ ...same, id: 'z' }, { ...same, id: 'a' }].sort(compareDocuments).map((item) => item.id)).toEqual(['a', 'z']);
      // 一覧は更新日時・名前・作成日時・IDの順に並ぶ。保存キー順（1, 2, 3, 4）のままでは通らない。
      const restoredIds = new Set([...first, ...second].map((item) => item.id));
      const listed = (await listDocuments()).filter((item) => restoredIds.has(item.id));
      expect(listed.map((item) => [item.name, item.id.slice(-1)])).toEqual([
        ['A（復元）', '2'], ['A（復元）', '3'], ['B（復元）', '1'], ['B（復元）', '4'],
      ]);
    } finally { uuid.mockRestore(); clock.mockRestore(); }
  });

  it('does not show the backup reminder right after restoring an old chart', async () => {
    const now = Date.now();
    const old = now - 10 * BACKUP_REMINDER_STALE_MS;
    const [restored] = (await importBackup(backup([chart('昔の編み図', old + BACKUP_REMINDER_STALE_MS, old)]))).documents;
    const lastBackupAt = await getLastBackupAt(restored.id);
    // useBackupReminderが開いたときに求める条件と同じ。
    const input = (createdAt: number) => ({
      now, lastBackupAt, createdAt, edits: 0, snoozedUntil: undefined,
      changedBeforeOpen: restored.updatedAt > (lastBackupAt ?? createdAt),
    });
    expect(lastBackupAt).toBeUndefined();
    expect(restored.updatedAt).toBe(old + BACKUP_REMINDER_STALE_MS);
    expect(restored.createdAt).toBeGreaterThanOrEqual(now);
    expect(backupReminderKind(input(restored.createdAt))).toBeUndefined();
    // 作成日時まで元の値に戻すと、復元した直後に「まだバックアップしていません」が出てしまう。
    expect(backupReminderKind(input(old))).toBe('never');
  });
});
