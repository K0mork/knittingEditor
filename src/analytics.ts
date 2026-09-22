const MEASUREMENT_ID = 'G-VVE0G4ZFL4';

type AnalyticsValue = string | number | boolean;
type AnalyticsParameters = Record<string, AnalyticsValue>;

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

export function boardSizeBucket(rows: number, cols: number): string {
  const cells = rows * cols;
  if (cells <= 400) return 'small';
  if (cells <= 2_500) return 'medium';
  if (cells <= 10_000) return 'large';
  return 'xlarge';
}

export function countBucket(count: number): string {
  if (count <= 1) return '1';
  if (count <= 3) return '2-3';
  if (count <= 9) return '4-9';
  return '10+';
}
