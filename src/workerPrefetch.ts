import type { WorkerLoader } from '@knitting-editor/editor-core/util/workerStarter';

// 通信処理はWebホストだけに置き、iOSの同梱コードへ含めない。
export const workerLoader: WorkerLoader = {
  async download(url) {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return new Blob([await response.text()], { type: 'text/javascript' });
  },
  async isMissing(url) {
    return (await fetch(url, { method: 'HEAD', cache: 'no-store' })).status === 404;
  },
};
