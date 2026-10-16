/** Webホストが明示的に有効にしたWorkerだけ、配信更新に備えて内容を保持する。 */
export class WorkerVersionError extends Error {
  constructor() { super('サイトが更新されました。'); this.name = 'WorkerVersionError'; }
}

export function createWorkerTask(url: string) {
  let enabled = false;
  let prefetch: Promise<void> | undefined;
  let contents: Blob | undefined;
  const preload = () => {
    enabled = true;
    return prefetch ??= (async () => {
      try {
        const response = await fetch(url);
        if (response.ok) contents = new Blob([await response.text()], { type: 'text/javascript' });
      } catch { /* オフライン時は利用時のURL起動へ戻す。 */ }
    })();
  };
  async function run<T>(send: (worker: Worker) => void, receive: (data: T) => void, fallback: string): Promise<void> {
    const attempt = (blob?: Blob) => new Promise<void>((resolve, reject) => {
      let worker: Worker | undefined;
      let objectUrl: string | undefined;
      const cleanup = () => {
        worker?.terminate();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      try {
        if (blob) objectUrl = URL.createObjectURL(blob);
        worker = new Worker(objectUrl ?? url, { type: 'module' });
        worker.onmessage = (event: MessageEvent<T>) => {
          cleanup();
          // 応答を受け取れた後の処理エラーは、起動失敗として再試行しない。
          try { receive(event.data); resolve(); } catch (error) { reject({ responseError: error }); }
        };
        worker.onerror = (event) => { event.preventDefault?.(); cleanup(); reject(new Error(event.message?.trim() || fallback)); };
        worker.onmessageerror = () => { cleanup(); reject({ responseError: new Error(fallback) }); };
        send(worker);
      } catch (error) { cleanup(); reject(error); }
    });
    try {
      if (contents) {
        try { await attempt(contents); return; }
        catch (error) {
          if (error && typeof error === 'object' && 'responseError' in error) throw error;
        }
      }
      await attempt();
    } catch (error) {
      if (error && typeof error === 'object' && 'responseError' in error) throw error.responseError;
      if (enabled) {
        try {
          if ((await fetch(url, { method: 'HEAD', cache: 'no-store' })).status === 404) throw new WorkerVersionError();
        } catch (checkError) { if (checkError instanceof WorkerVersionError) throw checkError; }
      }
      throw new Error(error instanceof Error && error.message.trim() ? error.message : fallback);
    }
  }
  return { preload, run };
}
