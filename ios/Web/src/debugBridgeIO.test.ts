import { beforeEach, expect, it, vi } from 'vitest';
import { seedBridgeMeasurement } from './debugBridgeIO';
const { listDocuments } = vi.hoisted(() => ({ listDocuments: vi.fn() }));
vi.mock('@knitting-editor/editor-core/storage/database', () => ({ listDocuments }));
beforeEach(() => listDocuments.mockReset());
it('refuses an existing user document before opening a write transaction', async () => {
  listDocuments.mockResolvedValue([{ id: 'existing' }]);
  await expect(seedBridgeMeasurement('small')).rejects.toThrow('新規テスト用コンテナ');
});
it.each(['invalid', 'toString', '__proto__'])('rejects unknown size %s', async (size) => {
  await expect(seedBridgeMeasurement(size)).rejects.toThrow('サイズ');
  expect(listDocuments).not.toHaveBeenCalled();
});
