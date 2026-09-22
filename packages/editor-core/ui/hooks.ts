import { useCallback, useEffect, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * モーダル内へフォーカスを閉じ込め、Escapeで閉じ、閉じたあとは開く前の要素へ戻す。
 * 以前はiOS版だけが持っていたが、キーボード操作はWeb版でも同じように必要なので共通化した。
 */
export function useModalFocus<T extends HTMLElement>(onEscape: () => void, initialSelector?: string) {
  const ref = useRef<T | null>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    const initial = initialSelector ? root.querySelector<HTMLElement>(initialSelector) : undefined;
    const frame = requestAnimationFrame(() => {
      const target = initial ?? focusable()[0];
      target?.focus();
      // window.promptと同じく初期値を選択状態にし、そのまま上書き入力できるようにする。
      if (target instanceof HTMLInputElement && target.type === 'text') target.select();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [initialSelector]);

  return ref;
}

/**
 * ドロワーを開いたときは見出しへ、閉じたときは開いたボタンへフォーカスを戻す。
 * `rememberTrigger`はパネルを開く直前に呼ぶ。
 */
export function usePanelFocus<T extends HTMLElement>(open: boolean) {
  const panelRef = useRef<T | null>(null);
  const returnFocusRef = useRef<HTMLElement | undefined>(undefined);
  const wasOpenRef = useRef(false);

  const rememberTrigger = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
  }, []);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open) {
      const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('h2')?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpen) {
      const frame = requestAnimationFrame(() => returnFocusRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  return { panelRef, rememberTrigger };
}

export const NOTIFICATION_DURATION_MS = 4500;

/** 一定時間で消えるトースト。続けて通知したときは前のタイマーを捨てる。 */
export function useNotifier() {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    setMessage(text);
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setMessage('');
      timeoutRef.current = undefined;
    }, NOTIFICATION_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
  }, []);

  return { message, notify };
}

export interface ClipboardShortcutOptions {
  canCopy: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
}

/** Ctrl/Cmd+CとCtrl/Cmd+Vで選択範囲のコピーと貼り付けを始める。 */
export function useClipboardShortcuts({ canCopy, canPaste, onCopy, onPaste }: ClipboardShortcutOptions) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'c' && canCopy) {
        event.preventDefault();
        onCopy();
      } else if (event.key.toLowerCase() === 'v' && canPaste) {
        event.preventDefault();
        onPaste();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [canCopy, canPaste, onCopy, onPaste]);
}
