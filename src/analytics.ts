import type { AnalyticsParameters, EditorAnalytics } from '@knitting-editor/editor-core/analytics';

const MEASUREMENT_ID = 'G-VVE0G4ZFL4';

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

export function initializeAnalytics(analyticsEnabled = import.meta.env.PROD && !navigator.webdriver): void {
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
