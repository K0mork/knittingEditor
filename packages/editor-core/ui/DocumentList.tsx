import { useEffect, useRef } from 'react';
import { ThumbnailCache, thumbnailSize } from '../model/thumbnail';
import type { ChartDocument } from '../storage/database';
import { documentAccessibleName, formatUpdatedAt } from './documentListText';

/** 一覧を閉じて開き直しても作り直さないよう、縮小画像はモジュールで1つの置き場に覚える。 */
const thumbnailCache = new ThumbnailCache();

/**
 * 編み図の縮小画像。画面に入ってから作って描く。編み図が多く盤面が大きくても、一覧を開いた
 * 時点では見えている数件分しか計算しない。読み上げは項目のボタンの名前に任せ、画像は読ませない。
 */
function DocumentThumbnail({ document }: { document: ChartDocument }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = thumbnailSize(document.rows, document.cols);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const thumbnail = thumbnailCache.get(document);
      context.putImageData(new ImageData(thumbnail.pixels, thumbnail.width, thumbnail.height), 0, 0);
    };
    if (typeof IntersectionObserver === 'undefined') { draw(); return; }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      draw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [document]);
  return <canvas ref={canvasRef} className="document-thumbnail" width={width} height={height} aria-hidden="true" />;
}

export interface DocumentListProps {
  documents: ChartDocument[];
  activeId: string;
  onOpen: (document: ChartDocument) => void;
  onRename: (document: ChartDocument) => void;
  onDuplicate: (document: ChartDocument) => void;
  onDelete: (document: ChartDocument) => void;
}

/** 編み図パネルの一覧。縮小画像・名前・寸法・更新日時と、名前変更・複製・削除のボタンを並べる。 */
export function DocumentList({ documents, activeId, onOpen, onRename, onDuplicate, onDelete }: DocumentListProps) {
  useEffect(() => { thumbnailCache.retain(documents.map((document) => document.id)); }, [documents]);
  const now = Date.now();
  return <ul className="document-list">{documents.map((document) => {
    const active = document.id === activeId;
    return <li className={active ? 'document active' : 'document'} key={document.id}>
      <button className="document-open" aria-label={documentAccessibleName(document, now)} aria-current={active || undefined} onClick={() => onOpen(document)}>
        <span className="document-thumbnail-frame"><DocumentThumbnail document={document} /></span>
        <span className="document-text">
          <span className="document-name">{document.name}</span>
          <small>{document.rows}段×{document.cols}目</small>
          <small><time dateTime={new Date(document.updatedAt).toISOString()}>更新 {formatUpdatedAt(document.updatedAt, now)}</time></small>
        </span>
      </button>
      <div className="document-actions">
        <button aria-label="名前変更" onClick={() => onRename(document)}>名称</button>
        <button aria-label="複製" onClick={() => onDuplicate(document)}>複製</button>
        <button aria-label="削除" disabled={documents.length === 1} onClick={() => onDelete(document)}>削除</button>
      </div>
    </li>;
  })}</ul>;
}
