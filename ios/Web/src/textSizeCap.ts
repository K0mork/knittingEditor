/**
 * iOS版の編集画面で使うルートの文字サイズの上限。
 * AX1の本文サイズ。これより大きい文字では盤面が画面の半分を割るため、編集画面はここで頭打ちにする。
 */
export const MAX_ROOT_FONT_SIZE = 28;

/**
 * システムの文字サイズから、ルートへ設定するインラインの文字サイズを返す。
 * 上限以下なら空文字を返し、CSSの`-apple-system-body`に任せる。
 */
export function cappedRootFontSize(systemPx: number, max = MAX_ROOT_FONT_SIZE): string {
  if (!Number.isFinite(systemPx) || systemPx <= 0 || systemPx <= max) return '';
  return `${max}px`;
}

/**
 * 編集画面の文字サイズをAX1で頭打ちにする。
 *
 * `:root`の`font: -apple-system-body`はシステムのDynamic Type設定をそのまま反映する。
 * 文字サイズを大きくしても盤面のマスは大きくならないため、AX2以上では盤面が画面に
 * 残らなくなる。そこで、システムの文字サイズを読むためだけの不可視の要素を置き、
 * その計算済みの文字サイズが上限を超えたらルートへ`28px`を設定する。
 * 要素自身に`font: -apple-system-body`を指定するので、ルートのインライン指定には
 * 影響されず、常に現在のシステムの文字サイズを返す。
 *
 * アプリの実行中にシステムの文字サイズが変わったときは、要素の大きさの変化を
 * `ResizeObserver`で受け、使えない環境では`resize`で追従する。
 */
export function capRootFontSize(doc: Document = document): () => void {
  const view = doc.defaultView;
  if (!view || !doc.body) return () => {};

  const probe = doc.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body;white-space:nowrap;';
  probe.textContent = 'M';
  doc.body.appendChild(probe);

  const apply = (): void => {
    const systemPx = Number.parseFloat(view.getComputedStyle(probe).fontSize);
    doc.documentElement.style.fontSize = cappedRootFontSize(systemPx);
  };
  apply();

  const Observer = view.ResizeObserver;
  const observer = Observer ? new Observer(apply) : undefined;
  observer?.observe(probe);
  view.addEventListener('resize', apply);

  return (): void => {
    observer?.disconnect();
    view.removeEventListener('resize', apply);
    probe.remove();
  };
}
