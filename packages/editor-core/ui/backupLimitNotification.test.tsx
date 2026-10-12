import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { SAVE_RESULT_UNKNOWN } from '../platform';
import { BACKUP_EXPORT_LIMIT_MESSAGE, BACKUP_LIMITS } from '../storage/backupCodec';
import { createDocument, deleteDocument, getLastBackupAt, listDocuments, recordBackup } from '../storage/database';
import { useEditorController, type EditorController } from './useEditorController';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it('notifies about individual exports without writing a file or advancing backup dates at the limit', async () => {
  for (const document of await listDocuments()) await deleteDocument(document.id);
  const first = await createDocument('残す編み図', 1, 1);
  const second = await createDocument('残す編み図2', 1, 1);
  await recordBackup([first.id], 123);
  const before = await listDocuments();
  const saveFile = vi.fn(async () => SAVE_RESULT_UNKNOWN);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const original = BACKUP_LIMITS.maxDocuments;
  let editor!: EditorController;
  function Probe() {
    editor = useEditorController({
      initialize: async () => ({ documents: before, activeId: first.id, blocks: [] }),
      platform: { saveFile }, askText: async () => null, askConfirm: async () => false,
    });
    return null;
  }
  try {
    await act(async () => root.render(<Probe />));
    Object.assign(BACKUP_LIMITS, { maxDocuments: 1 });
    await act(async () => editor.backup(true));
    expect(editor.message).toBe(BACKUP_EXPORT_LIMIT_MESSAGE);
    expect(saveFile).not.toHaveBeenCalled();
    expect(await getLastBackupAt(first.id)).toBe(123);
    expect(await getLastBackupAt(second.id)).toBeUndefined();
    expect(await listDocuments()).toEqual(before);
    expect(editor.busy).toBeUndefined();
  } finally {
    Object.assign(BACKUP_LIMITS, { maxDocuments: original });
    await act(async () => root.unmount());
    container.remove();
  }
});
