import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useModalFocus } from '@knitting-editor/editor-core/ui/hooks';

type DialogRequest =
  | { kind: 'prompt'; title: string; defaultValue: string; resolve: (value: string | null) => void }
  | { kind: 'confirm'; title: string; resolve: (value: boolean) => void };

/**
 * `window.prompt`・`window.confirm`の代わりに出すアプリ内ダイアログ。
 * WKWebView標準のダイアログは見た目とキーボード表示が合わないため置き換える。
 */
export function useAppDialog() {
  const [request, setRequest] = useState<DialogRequest>();

  const askText = useCallback((title: string, defaultValue = '') => new Promise<string | null>((resolve) => {
    setRequest({ kind: 'prompt', title, defaultValue, resolve });
  }), []);
  const askConfirm = useCallback((title: string) => new Promise<boolean>((resolve) => {
    setRequest({ kind: 'confirm', title, resolve });
  }), []);
  const resolveDialog = (value: string | null | boolean) => {
    if (!request) return;
    setRequest(undefined);
    if (request.kind === 'prompt') request.resolve(typeof value === 'string' ? value : null);
    else request.resolve(value === true);
  };

  const dialog = request && <AppDialog request={request} onResolve={resolveDialog} />;
  return { askText, askConfirm, dialog };
}

function AppDialog({ request, onResolve }: {
  request: DialogRequest;
  onResolve: (value: string | null | boolean) => void;
}) {
  const [value, setValue] = useState(request.kind === 'prompt' ? request.defaultValue : '');
  useEffect(() => { setValue(request.kind === 'prompt' ? request.defaultValue : ''); }, [request]);
  const dialogRef = useModalFocus<HTMLElement>(() => onResolve(request.kind === 'prompt' ? null : false), request.kind === 'prompt' ? 'input' : 'button.primary');
  // WKWebViewは、利用者のタップの処理の中でフォーカスした入力欄にしかキーボードを出さない（#148）。
  // `useModalFocus`は次のフレームでフォーカスするので、タップの処理が終わったあとになり、キーボードが
  // 出ない。「新しい編み図」などのボタンはタップの処理の中でこのダイアログを開くので、画面へ反映した
  // 直後（レイアウトの段階）に入力欄へフォーカスし、同じタップの処理の中に収める。
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // window.promptと同じく初期値を選択状態にし、そのまま上書き入力できるようにする。
    input.select();
  }, [request]);
  // promptは背景タップで閉じない。入力欄をタップするとキーボードが出てダイアログが上へ
  // ずれるため、続けて置いた指が背景へ当たり、入力した名前ごと取り消されていた。
  // 取り消しは「キャンセル」とEscapeで行う。confirmは失うものがないので従来どおり閉じる。
  return <div className="app-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (request.kind !== 'prompt' && event.target === event.currentTarget) onResolve(false);
  }}>
    <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-description" onKeyDown={(event) => {
      if (event.key === 'Enter' && request.kind === 'prompt' && event.target instanceof HTMLInputElement) onResolve(value);
    }}>
      <h2 id="app-dialog-title">{request.title}</h2>
      <p id="app-dialog-description" className="visually-hidden">入力を確認して決定またはキャンセルを選択してください。Escapeでキャンセルできます。</p>
      {request.kind === 'prompt' && <input ref={inputRef} aria-label="入力" value={value} onChange={(event) => setValue(event.target.value)} />}
      <div className="app-dialog-actions">
        <button onClick={() => onResolve(request.kind === 'prompt' ? null : false)}>キャンセル</button>
        <button className="primary" autoFocus={request.kind === 'confirm'} onClick={() => onResolve(request.kind === 'prompt' ? value : true)}>決定</button>
      </div>
    </section>
  </div>;
}
