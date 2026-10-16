import { afterEach, expect, it, vi } from 'vitest';
import { runBackupTask } from './backupTask';
afterEach(() => vi.unstubAllGlobals());
it.each(['event', 'response', 'throw'])('reports a meaningful backup failure: %s', async (mode) => {
  vi.stubGlobal('Worker', class {
    onerror?: (event: { message: string; preventDefault: () => void }) => void;
    onmessage?: (event: { data: { error: string } }) => void;
    terminate() {}
    postMessage() {
      if (mode === 'throw') throw new Error('');
      queueMicrotask(() => {
        if (mode === 'event') this.onerror?.({ message: '', preventDefault() {} });
        else this.onmessage?.({ data: { error: '  ' } });
      });
    }
  });
  await expect(runBackupTask({ operation: 'encode', documents: [], blocks: [] })).rejects.toThrow('バックアップを処理できませんでした。');
});
