import { useEffect, useRef, useState } from 'react';
import { ThumbnailCache, thumbnailSize } from '../model/thumbnail';
import type { ChartDocument } from '../storage/database';
import { documentAccessibleName, formatUpdatedAt, msUntilNextDay } from './documentListText';

/** 一覧を閉じて開き直しても作り直さないよう、縮小画像はモジュールで1つの置き場に覚える。 */
const thumbnailCache = new ThumbnailCache();

/**
 * 縮小画像の枠の内側の大きさ（CSS px）。`base.css`の`.document-thumbnail-frame`の64pxから枠線を
 * 除いた値。これより大きい縮小画像は縮めて表示するので、`pixelated`のままだと段や目が抜けて
 * 見える。そのときは滑らかに縮める。
 */
const THUMBNAIL_FRAME_INNER_SIZE = 62;

/**
 * 日付が変わったら描き直す。一覧を開いたまま0時を過ぎても「今日」が残らないようにする。
 * 端末のスリープやアプリの中断中はタイマーが遅れることがあるので、画面に戻ったときにも描き直す。
 */
function useDayChange(): void {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const redraw = () => setTick((value) => value + 1);
    // 0時ちょうどより少し後に起こし、タイマーの誤差で前日のまま描かないようにする。
    const timer = setTimeout(redraw, msUntilNextDay() + 1000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') redraw(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [tick]);
}

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
  const className = Math.max(width, height) > THUMBNAIL_FRAME_INNER_SIZE ? 'document-thumbnail downscaled' : 'document-thumbnail';
  return <canvas ref={canvasRef} className={className} width={width} height={height} aria-hidden="true" />;
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
  useDayChange();
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
