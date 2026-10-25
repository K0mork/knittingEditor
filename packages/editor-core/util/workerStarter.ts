import { BackupLimitError, InvalidBackupError } from '../storage/backupErrors';

export interface WorkerLoader {
  download(url: string): Promise<Blob | undefined>;
  isMissing(url: string): Promise<boolean>;
}

/** Webホストが明示的に有効にしたWorkerだけ、配信更新に備えて内容を保持する。 */
export class WorkerVersionError extends Error {
  constructor() { super('サイトが更新されました。'); this.name = 'WorkerVersionError'; }
}

export class WorkerStartError extends Error {}
export class WorkerProcessingError extends Error {}

/** Workerが読み込みを終えたときに最初に送る通知。これを受けてから要求を転送する。 */
export interface WorkerReadyMessage { ready: true }

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
  /**
   * Workerを起動し、readyを受けてから`send`で要求を1回だけ送る。
   * 応答は`receive`が検証して結果に変換し、その値で解決する。`receive`の例外は処理の失敗として扱う。
   */
  async function run<TResponse, TResult>(send: (worker: Worker) => void, receive: (data: TResponse) => TResult, fallback: string): Promise<TResult> {
    const attempt = (blob?: Blob) => new Promise<TResult>((resolve, reject) => {
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
        if (!ready) reject(new WorkerStartError(message));
        else if (error instanceof BackupLimitError || error instanceof InvalidBackupError) reject(error);
        else reject(new WorkerProcessingError(message));
      };
      try {
        if (blob) objectUrl = URL.createObjectURL(blob);
        worker = new Worker(objectUrl ?? url, { type: 'module' });
        worker.onmessage = (event: MessageEvent<TResponse | WorkerReadyMessage>) => {
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
            const result = receive(event.data as TResponse);
            settled = true;
            cleanup();
            resolve(result);
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
        try { return await attempt(contents); }
        catch (error) {
          if (!(error instanceof WorkerStartError)) throw error;
        }
      }
      return await attempt();
    } catch (error) {
      if (!(error instanceof WorkerStartError)) throw error;
      if (loader) {
        try {
          if (await loader.isMissing(url)) throw new WorkerVersionError();
        } catch (checkError) { if (checkError instanceof WorkerVersionError) throw checkError; }
      }
      throw error;
    }
  }
  return { preload, run };
}
