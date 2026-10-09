import { useEffect, useRef } from 'react';

/**
 * 次の描画が画面に出たあとで`callback`を呼ぶ。1回目の`requestAnimationFrame`はその描画の直前に
 * 呼ばれるので、2回目まで待つ。盤面のCanvasも`requestAnimationFrame`で描くため、1回目の時点では
 * まだ画面に出ていないことがある。戻り値で取り消せる。
 */
export function afterNextPaint(
  callback: () => void,
  frame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (handle: number) => void = cancelAnimationFrame,
): () => void {
  let second: number | undefined;
  const first = frame(() => { second = frame(() => callback()); });
  return () => {
    cancel(first);
    if (second !== undefined) cancel(second);
  };
}

/**
 * 編集画面を出せたら（端末内データを読み込んで盤面を描いた、または読み込みに失敗して理由を出した）、
 * 画面に出たあとで一度だけ`notify`を呼ぶ。iOS版はこれで`webReady`を送り、ネイティブの準備中の表示を
 * 消す。早く送ると、準備中の表示が消えてから編集画面が出るまでに、Web側の読み込み中の表示が見える（#117）。
 */
export function useNotifyWhenEditorShown(shown: boolean, notify: () => void): void {
  const sentRef = useRef(false);
  useEffect(() => {
    if (!shown || sentRef.current) return;
    return afterNextPaint(() => {
      sentRef.current = true;
      notify();
    });
  }, [shown, notify]);
}
