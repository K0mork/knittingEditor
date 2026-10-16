import type { AnalyticsParameters, EditorAnalytics } from '@knitting-editor/editor-core/analytics';

const MEASUREMENT_ID = 'G-VVE0G4ZFL4';
const ANALYTICS_OPT_OUT_KEY = 'knitting-editor:analytics-opt-out';

interface AnalyticsEnvironment {
  prod: boolean;
  webdriver: boolean;
  userAgent: string;
  optedOut: boolean;
}

/** 本番の通常ブラウザだけで解析を有効にする。判定に使う情報は送信しない。 */
export function shouldSendAnalytics({ prod, webdriver, userAgent, optedOut }: AnalyticsEnvironment): boolean {
  return prod && !webdriver && !userAgent.includes('Claude/') && !optedOut;
}

function isAnalyticsOptedOut(): boolean {
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === '1';
  } catch {
    // 保存領域を利用できない場合は、通常の送信判定を続ける。
    return false;
  }
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
  }
}

let enabled = false;
let initialized = false;
let firstEditTracked = false;

function gtag(..._args: unknown[]): void {
  if (!enabled) return;
  (window.dataLayer ??= []).push(arguments);
}

export function initializeAnalytics(analyticsEnabled = shouldSendAnalytics({
  prod: import.meta.env.PROD,
  webdriver: navigator.webdriver,
  userAgent: navigator.userAgent,
  optedOut: isAnalyticsOptedOut(),
})): void {
  if (!analyticsEnabled || initialized) return;
  enabled = true;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
}

export function trackAnalyticsEvent(name: string, parameters: AnalyticsParameters = {}): void {
  gtag('event', name, parameters);
}

export function trackFirstEdit(): void {
  if (firstEditTracked) return;
  firstEditTracked = true;
  trackAnalyticsEvent('first_edit');
}

/** 共通の編集画面へ渡すGA4送信。 */
export const webAnalytics: EditorAnalytics = {
  track: trackAnalyticsEvent,
  trackFirstEdit,
};
