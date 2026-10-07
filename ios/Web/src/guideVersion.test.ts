import { afterEach, describe, expect, it } from 'vitest';
import guideHtml from '../public/guide/index.html?raw';

type AppInfoWindow = Window & { knittingEditorAppInfo?: unknown };

/** 同梱の「使い方」を読み込み、アプリが`WKUserScript`で置く値を与えてページのスクリプトを実行する。 */
function renderGuide(appInfo?: unknown): HTMLElement {
  const parsed = new DOMParser().parseFromString(guideHtml, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  const target = window as AppInfoWindow;
  if (appInfo === undefined) delete target.knittingEditorAppInfo;
  else target.knittingEditorAppInfo = appInfo;
  for (const script of parsed.querySelectorAll('script')) {
    new Function(script.textContent ?? '')();
  }
  const element = document.getElementById('app-version');
  if (!element) throw new Error('「使い方」にバージョンの表示欄がありません');
  return element;
}

afterEach(() => {
  delete (window as AppInfoWindow).knittingEditorAppInfo;
  document.body.innerHTML = '';
});

describe('guide app version', () => {
  it('shows the version and build number passed by the app', () => {
    const element = renderGuide(Object.freeze({ version: '1.0', build: '7' }));
    expect(element.hidden).toBe(false);
    expect(element.textContent).toBe('バージョン 1.0（ビルド 7）');
  });

  it('places the version at the end of the page', () => {
    const element = renderGuide({ version: '1.0', build: '7' });
    expect(element.closest('footer')).not.toBeNull();
  });

  it('shows only the version when the build number is missing', () => {
    expect(renderGuide({ version: '1.2' }).textContent).toBe('バージョン 1.2');
  });

  it('stays hidden outside the app or with malformed values', () => {
    for (const info of [undefined, null, {}, { version: '' }, { version: 1, build: '1' }]) {
      const element = renderGuide(info);
      expect(element.hidden).toBe(true);
      expect(element.textContent).toBe('');
    }
  });

  it('treats the values as text, not markup', () => {
    const element = renderGuide({ version: '<img src=x>', build: '1' });
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toBe('バージョン <img src=x>（ビルド 1）');
  });
});
