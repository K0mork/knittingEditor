export interface WorkerLoader {
  download(url: string): Promise<Blob | undefined>;
  isMissing(url: string): Promise<boolean>;
}

/** Webホストが明示的に有効にしたWorkerだけ、配信更新に備えて内容を保持する。 */
export class WorkerVersionError extends Error {
  constructor() { super('サイトが更新されました。'); this.name = 'WorkerVersionError'; }
}

class WorkerStartError extends Error {}

export function createWorkerTask(url: string) {
  let loader: WorkerLoader | undefined;
  let prefetch: Promise<void> | undefined;
  let contents: Blob | undefined;
  const preload = (webLoader: WorkerLoader) => {
    loader ??= webLoader;
    return prefetch ??= (async () => {
      try {
        contents = await loader.download(url);
      } catch { /* オフライン時は利用時のURL起動へ戻す。 */ }
    })();
  };
  async function run<T>(send: (worker: Worker) => void, receive: (data: T) => void, fallback: string): Promise<void> {
    const attempt = (blob?: Blob) => new Promise<void>((resolve, reject) => {
      let worker: Worker | undefined;
      let objectUrl: string | undefined;
      let ready = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        clearTimeout(timer);
        worker?.terminate();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        const message = error instanceof Error && error.message.trim() ? error.message : fallback;
        reject(ready ? new Error(message) : new WorkerStartError(message));
      };
      try {
        if (blob) objectUrl = URL.createObjectURL(blob);
        worker = new Worker(objectUrl ?? url, { type: 'module' });
        worker.onmessage = (event: MessageEvent<T | { ready: true }>) => {
          if (settled) return;
          if (event.data && typeof event.data === 'object' && 'ready' in event.data && event.data.ready === true) {
            if (ready) return;
            ready = true;
            clearTimeout(timer);
            // 起動確認後だけ転送する。以後の失敗ではデータを再送しない。
            try { send(worker!); } catch (error) { fail(error); }
            return;
          }
          if (!ready) { fail(new Error(fallback)); return; }
          try {
            receive(event.data as T);
            settled = true;
            cleanup();
            resolve();
          } catch (error) { fail(error); }
        };
        worker.onerror = (event) => { event.preventDefault?.(); fail(new Error(event.message?.trim() || fallback)); };
        worker.onmessageerror = () => fail(new Error(fallback));
        // メモリ上のBlob起動だけ待ち時間を制限する。URLの読み込みと処理時間は制限しない。
        if (blob) timer = setTimeout(() => fail(new Error(fallback)), 15_000);
      } catch (error) { fail(error); }
    });
    try {
      if (contents) {
        try { await attempt(contents); return; }
        catch (error) {
          if (!(error instanceof WorkerStartError)) throw error;
        }
      }
      await attempt();
    } catch (error) {
      if (!(error instanceof WorkerStartError)) throw error;
      if (loader) {
        try {
          if (await loader.isMissing(url)) throw new WorkerVersionError();
        } catch (checkError) { if (checkError instanceof WorkerVersionError) throw checkError; }
      }
      throw new Error(error instanceof Error && error.message.trim() ? error.message : fallback);
    }
  }
  return { preload, run };
}
