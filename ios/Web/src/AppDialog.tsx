import { useCallback, useEffect, useState } from 'react';
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
      {request.kind === 'prompt' && <input aria-label="入力" value={value} onChange={(event) => setValue(event.target.value)} />}
      <div className="app-dialog-actions">
        <button onClick={() => onResolve(request.kind === 'prompt' ? null : false)}>キャンセル</button>
        <button className="primary" autoFocus={request.kind === 'confirm'} onClick={() => onResolve(request.kind === 'prompt' ? value : true)}>決定</button>
      </div>
    </section>
  </div>;
}
