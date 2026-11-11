/**
 * 使い方・サポート・プライバシーポリシーのページの計測。
 *
 * 編集画面の計測（`src/analytics.ts`）と同じGA4へ、ページの閲覧と、`data-analytics`を
 * 付けたリンクのクリックだけを送る。編み図の内容や、画面の操作は送らない。
 *
 * ビルドでCSPのmetaが入り、インラインのスクリプトは実行できない。このファイルを
 * `<script type="module" src="/analytics.js" data-analytics-entry></script>`で読み込む。
 *
 * 測定IDと送信の条件は`src/analytics.ts`とそろえる。ずれると`src/staticPageAnalytics.test.ts`が落ちる。
 */

/** 編集画面と同じGA4の測定ID。 */
export const MEASUREMENT_ID = 'G-VVE0G4ZFL4';

/** 送信を止める設定のキー。編集画面と同じキーを見る。 */
export const ANALYTICS_OPT_OUT_KEY = 'knitting-editor:analytics-opt-out';

/** 計測するのは本番のドメインだけ。開発サーバーやプレビューでは送らない。 */
export const PRODUCTION_HOST = 'knittingeditor.com';

/**
 * 本番の通常ブラウザだけで計測する。判定に使う情報は送信しない。
 * 条件は`src/analytics.ts`の`shouldSendAnalytics`と同じ。
 */
export function shouldMeasure({ production, webdriver, userAgent, optedOut }) {
  return production && !webdriver && !userAgent.includes('Claude/') && !optedOut;
}

/** 送信を止める設定になっているか。保存領域を使えないときは、止めていないものとして扱う。 */
function isOptedOut(storage) {
  try {
    return storage.getItem(ANALYTICS_OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 計測を始める。始めたら`true`、計測しない環境なら何も読み込まずに`false`を返す。
 * ページの閲覧は`config`が、リンクのクリックは`link_clicked`が送る。
 */
export function start(environment = {}) {
  const {
    location = window.location,
    navigator = window.navigator,
    storage = window.localStorage,
    document: doc = window.document,
  } = environment;
  if (!shouldMeasure({
    production: location.hostname === PRODUCTION_HOST,
    webdriver: navigator.webdriver === true,
    userAgent: navigator.userAgent ?? '',
    optedOut: isOptedOut(storage),
  })) return false;

  const dataLayer = window.dataLayer ?? (window.dataLayer = []);
  /**
   * gtag.jsの読み込みを待たずに命令を並べる。gtag.jsは`arguments`オブジェクトだけを命令として扱い、
   * 配列を積んでも何も送らない。残余引数（`...args`）には書き換えない。
   */
  function gtag() {
    dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  doc.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);

  // ページが切り替わっても送れるよう、送信はクリックの捕捉段階で行う。
  doc.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[data-analytics]');
    if (!link) return;
    gtag('event', 'link_clicked', { link_name: link.getAttribute('data-analytics') });
  }, { capture: true });
  return true;
}

// このファイルを読み込んでいるページだけで始める。テストから読み込んだときは何もしない。
if (typeof document !== 'undefined' && document.querySelector('script[data-analytics-entry]')) start();
