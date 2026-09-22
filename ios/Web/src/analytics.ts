type AnalyticsValue = string | number | boolean;
type AnalyticsParameters = Record<string, AnalyticsValue>;

// The app build deliberately keeps the Web API surface but never emits telemetry.
export function trackAnalyticsEvent(_name: string, _parameters: AnalyticsParameters = {}): void {}

export function trackFirstEdit(): void {}

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
