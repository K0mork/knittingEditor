import { useSyncExternalStore } from 'react';
import { CANVAS_MODE_LABELS, type CanvasMode } from '../canvas/BoardCanvas';

/** 盤面を操作している入力。ペンはタッチと同じく「タップ」で案内する。 */
export type PointerKind = 'touch' | 'mouse';

export interface InputEnvironment {
  pointer: PointerKind;
  /** 物理キーボードがあると見込めるか。Escapeやショートカットを案内するかを決める。 */
  keyboard: boolean;
  /** MacとiPhone・iPad。ショートカットを⌘で表記する。 */
  apple: boolean;
}

// ソフトウェアキーボードでは押せないキー。これが押されたら物理キーボードがあるとみなす。
const HARDWARE_ONLY_KEYS = new Set(['Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

const matches = (query: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  // iPadOSのSafariはMacとして名乗るので、MacとiPadは区別しない。
  return /mac|iphone|ipad|ipod|ios/i.test(platform) || /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** 最初の判定。主な入力がタッチの端末ではタッチ、そうでなければマウスとみなす。 */
export function detectInputEnvironment(): InputEnvironment {
  const coarse = matches('(pointer: coarse)');
  return {
    pointer: coarse ? 'touch' : 'mouse',
    keyboard: !coarse && matches('(hover: hover)'),
    apple: isApplePlatform(),
  };
}

let current: InputEnvironment | undefined;
const listeners = new Set<() => void>();

function update(next: Partial<InputEnvironment>) {
  const base = getInputEnvironment();
  if (Object.entries(next).every(([key, value]) => base[key as keyof InputEnvironment] === value)) return;
  current = { ...base, ...next };
  listeners.forEach((listener) => listener());
}

// iPadにトラックパッドやキーボードをつないだときのように、使っている入力は途中で変わる。
// 最後に使われた入力に合わせて案内を切り替える。
const handlePointerDown = (event: PointerEvent) => {
  if (event.pointerType === 'mouse') update({ pointer: 'mouse' });
  else if (event.pointerType === 'touch' || event.pointerType === 'pen') update({ pointer: 'touch' });
};
// タッチではwheelは起きない。トラックパッドの2本指スクロールとピンチはwheelになる。
const handleWheel = () => update({ pointer: 'mouse' });
const handleKeyDown = (event: KeyboardEvent) => {
  if (HARDWARE_ONLY_KEYS.has(event.key) || event.ctrlKey || event.metaKey) update({ keyboard: true });
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    window.addEventListener('keydown', handleKeyDown, true);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('wheel', handleWheel, true);
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}

/** 今の入力環境。Reactの外（通知の文言を組み立てるときなど）からも読む。 */
export function getInputEnvironment(): InputEnvironment {
  current ??= detectInputEnvironment();
  return current;
}

/** テスト用。次に読んだときに判定し直す。 */
export function resetInputEnvironment(): void {
  current = undefined;
}

/** 入力環境を読み、変わったら描き直す。 */
export function useInputEnvironment(): InputEnvironment {
  return useSyncExternalStore(subscribe, getInputEnvironment, getInputEnvironment);
}

/** 盤面の右下に出す操作のヒント。 */
export function gestureHintText(mode: CanvasMode, environment: InputEnvironment): string {
  const modeLabel = CANVAS_MODE_LABELS[mode];
  if (environment.pointer === 'touch') return `1本指：${modeLabel}　2本指：移動・拡大`;
  // 貼り付けはドラッグではなく、置く位置をクリックして確定する。
  const action = mode === 'paste' ? 'クリック' : 'ドラッグ';
  const modifier = environment.apple ? '⌘' : 'Ctrl';
  return `${action}：${modeLabel}　ホイール：移動　${modifier}＋ホイール：拡大`;
}

/** 貼り付けを始めたときの案内。 */
export function pastePromptText(environment: InputEnvironment): string {
  return `貼り付ける左上のセルを${environment.pointer === 'touch' ? 'タップ' : 'クリック'}してください`;
}

/** 元に戻す・やり直すのボタンの`title`。対応するショートカットは`useHistoryShortcuts`。 */
export function historyTitles(environment: InputEnvironment): { undo: string; redo: string } {
  return environment.apple
    ? { undo: '元に戻す（⌘Z）', redo: 'やり直す（⇧⌘Z）' }
    : { undo: '元に戻す（Ctrl+Z）', redo: 'やり直す（Ctrl+Y）' };
}
