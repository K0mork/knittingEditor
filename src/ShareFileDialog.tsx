import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { useModalFocus } from '@knitting-editor/editor-core/ui/hooks';

/** 共有したら`true`、閉じる・取り消しなら`false`、共有できずダウンロードへ切り替えたら`undefined`。 */
type ShareResult = boolean | undefined;

interface PendingShare {
  file: File;
  resolve: (result: ShareResult) => void;
}

/**
 * 生成したファイルを共有シートで渡すための確認ダイアログ。`createWebPlatform`の`offerShare`へ渡す。
 * `offerShare`はダイアログを閉じたときに、利用者が共有したかを返す。
 */
export function useShareOffer() {
  const [pending, setPending] = useState<PendingShare>();
  const pendingRef = useRef<PendingShare>(undefined);
  const settle = useCallback((result: ShareResult) => {
    pendingRef.current?.resolve(result);
    pendingRef.current = undefined;
    setPending(undefined);
  }, []);
  const offerShare = useCallback((file: File) => new Promise<ShareResult>((resolve) => {
    // 前のダイアログを閉じずに次のファイルが来たら、前のファイルは共有しなかったことにする。
    pendingRef.current?.resolve(false);
    const next = { file, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);
  useEffect(() => () => pendingRef.current?.resolve(false), []);
  const dialog = pending && <ShareFileDialog key={pending.file.name} file={pending.file} onClose={settle} />;
  return { offerShare, dialog };
}

function isShareCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function ShareFileDialog({ file, onClose }: { file: File; onClose: (result: ShareResult) => void }) {
  const [sharing, setSharing] = useState(false);
  // 共有シートを開いている間は閉じない。閉じると、共有を終えても「取りやめた」と返してしまう。
  const dismiss = useCallback(() => { if (!sharing) onClose(false); }, [onClose, sharing]);
  const dialogRef = useModalFocus<HTMLElement>(dismiss, 'button.primary');

  const share = async () => {
    setSharing(true);
    let result: ShareResult = true;
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      // 共有シートを閉じただけなら何もしない。共有できなかったときは従来のダウンロードへ戻す。
      if (isShareCancel(error)) result = false;
      else {
        downloadBlob(file, file.name);
        result = undefined;
      }
    }
    onClose(result);
  };

  return <div className="share-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) dismiss();
  }}>
    <section ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-description">
      <h2 id="share-dialog-title">「{file.name}」の準備ができました</h2>
      <p id="share-dialog-description">共有メニューから「ファイルに保存」やプリントを選べます。</p>
      <div className="share-dialog-actions">
        <button onClick={dismiss} disabled={sharing}>閉じる</button>
        <button className="primary" onClick={() => void share()} disabled={sharing}>共有・保存</button>
      </div>
    </section>
  </div>;
}
