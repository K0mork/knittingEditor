import { useCallback, useState } from 'react';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { useModalFocus } from '@knitting-editor/editor-core/ui/hooks';

/** 生成したファイルを共有シートで渡すための確認ダイアログ。`createWebPlatform`の`offerShare`へ渡す。 */
export function useShareOffer() {
  const [file, setFile] = useState<File>();
  const offerShare = useCallback((next: File) => setFile(next), []);
  const close = useCallback(() => setFile(undefined), []);
  const dialog = file && <ShareFileDialog key={file.name} file={file} onClose={close} />;
  return { offerShare, dialog };
}

function isShareCancel(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function ShareFileDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const [sharing, setSharing] = useState(false);
  const dialogRef = useModalFocus<HTMLElement>(onClose, 'button.primary');

  const share = async () => {
    setSharing(true);
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      // 共有シートを閉じただけなら何もしない。共有できなかったときは従来のダウンロードへ戻す。
      if (!isShareCancel(error)) downloadBlob(file, file.name);
    }
    onClose();
  };

  return <div className="share-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !sharing) onClose();
  }}>
    <section ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-description">
      <h2 id="share-dialog-title">「{file.name}」の準備ができました</h2>
      <p id="share-dialog-description">共有メニューから「ファイルに保存」やプリントを選べます。</p>
      <div className="share-dialog-actions">
        <button onClick={onClose} disabled={sharing}>閉じる</button>
        <button className="primary" onClick={() => void share()} disabled={sharing}>共有・保存</button>
      </div>
    </section>
  </div>;
}
