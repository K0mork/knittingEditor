import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting } from '@knitting-editor/editor-core/storage/database';
import { isIPhoneOrIPad } from './appleDevice';

/**
 * iPhone・iPad版アプリのApp Storeの製品ページ。
 * 押した先のApp Store Connectの集計に参照元（このサイト）が残るよう、リンクには`noreferrer`を付けない。
 */
export const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6829961403';

/** アプリが動く最も古いiOSの主番号。`ios/project.yml`の`deploymentTarget`とそろえる（テストで比べる）。 */
export const MINIMUM_IOS_MAJOR_VERSION = 17;

/** アプリの案内を閉じた日時を残す設定のキー。書き出しの勧めの「あとで」と同じく、端末内のIndexedDBに置く。 */
export const APP_STORE_NOTICE_DISMISSED_KEY = 'appStoreNoticeDismissedAt';

type DeviceNavigator = Pick<Navigator, 'userAgent' | 'maxTouchPoints'>;

/**
 * User-Agentから読めるiOSの主番号。読めなければ`undefined`。
 * 「iPhone OS 18_6」のようなOSの版は、新しいSafariでは固定されて実際より古く出ることがあるので、
 * Safariの「Version/26.0」も読み、大きいほうを使う。iPadOSのSafariはMacの名乗りで、OSの版を出さない。
 */
export function iosMajorVersion(userAgent: string): number | undefined {
  const versions = [/\bOS (\d+)_\d+/.exec(userAgent), /\bVersion\/(\d+)/.exec(userAgent)]
    .flatMap((match) => (match ? [Number(match[1])] : []));
  return versions.length > 0 ? Math.max(...versions) : undefined;
}

/**
 * アプリの案内を出す端末か。iPhone・iPadのブラウザ（Safari以外も）で、アプリが動かない古いiOSと読めるときは出さない。
 * 版が読めないときは出し、入れられるかはApp Storeの製品ページに任せる。
 * 自動操作のブラウザ（E2Eテストや公開後の確認）では、ほかの画面の確認の邪魔になるので出さない。
 */
export function shouldOfferIosApp(nav: DeviceNavigator & { webdriver?: boolean }): boolean {
  if (nav.webdriver || !isIPhoneOrIPad(nav)) return false;
  const version = iosMajorVersion(nav.userAgent);
  return version === undefined || version >= MINIMUM_IOS_MAJOR_VERSION;
}

/**
 * アプリの案内を出すかどうか。閉じるかApp Storeを開いたら記録し、その端末では二度と出さない。
 * 記録を読み終えるまでは出さない。読めなかったときも、閉じたのにまた出るよりよいので出さない。
 */
export function useAppStoreNotice(nav: DeviceNavigator & { webdriver?: boolean } = navigator) {
  const [offered] = useState(() => shouldOfferIosApp(nav));
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!offered) return;
    let cancelled = false;
    void getSetting(APP_STORE_NOTICE_DISMISSED_KEY)
      .then((dismissedAt) => { if (!cancelled) setShown(dismissedAt === undefined); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [offered]);
  const dismiss = useCallback(() => {
    setShown(false);
    void setSetting(APP_STORE_NOTICE_DISMISSED_KEY, Date.now()).catch(() => undefined);
  }, []);
  return { shown, dismiss };
}

/**
 * iPhone・iPad版アプリの案内。書き出しの勧めと同じ段（`.backup-reminder`）に出し、勧めより先に見せる。
 * 編集中のタブを残すため、App Storeは新しいタブで開く。iPhone・iPadではApp Storeのアプリが開く。
 */
export function AppStoreNotice({ onDismiss }: { onDismiss: () => void }) {
  return <section className="backup-reminder app-store-notice" aria-label="アプリの案内">
    <p><span>iPhone・iPad版のアプリがあります。</span><span>Web版の編み図は.knitバックアップで移せます。</span></p>
    <div className="backup-reminder-actions">
      <a className="app-store-notice-link" href={APP_STORE_URL} target="_blank" rel="noopener" onClick={onDismiss}>App Storeで見る</a>
      <button type="button" onClick={onDismiss}>閉じる</button>
    </div>
  </section>;
}
