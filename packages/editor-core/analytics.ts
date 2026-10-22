export interface ChartProgressStorage { read(): string | null; write(value: string): void; remove?(): void }

export type AnalyticsValue = string | number | boolean;
export type AnalyticsParameters = Record<string, AnalyticsValue>;

/**
 * 共通の編集画面が送る製品イベントの受け口。
 *
 * Web版はGA4へ送る実装を渡す。iOS版は何も渡さず、`NO_ANALYTICS`のまま一切送らない。
 * 共通コードから外部スクリプトや通信を起こさないよう、送信の実装はここに置かない。
 */
export interface EditorAnalytics {
  track(name: string, parameters?: AnalyticsParameters): void;
  /** 最初の編集で1度だけ送る。2度目以降の呼び出しは実装側で捨てる。 */
  trackFirstEdit(): void;
  chartProgressStorage?(): ChartProgressStorage | undefined;
}

export const NO_ANALYTICS: EditorAnalytics = {
  track: () => {},
  trackFirstEdit: () => {},
};

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

/** 制作量と変更セル数に共通の粗い区分。 */
export function progressBucket(n: number): string {
  if (n < 1) return '0';
  if (n < 20) return '1-19';
  if (n < 100) return '20-99';
  if (n < 500) return '100-499';
  if (n < 2000) return '500-1999';
  return '2000+';
}
export function editDaysBucket(n: number): string {
  if (n <= 1) return '1';
  if (n < 3) return '2';
  if (n < 5) return '3-4';
  if (n < 10) return '5-9';
  return '10+';
}
export function gapDaysBucket(n: number): string {
  if (n <= 1) return '1';
  if (n < 7) return '2-6';
  if (n < 30) return '7-29';
  return '30+';
}
export function activeMinutesBucket(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '0';
  if (minutes < 5) return '1-4';
  if (minutes < 15) return '5-14';
  if (minutes < 60) return '15-59';
  return '60+';
}
export function exportLagBucket(n: number): string {
  if (n < 1) return '0';
  if (n < 7) return '1-6';
  if (n < 30) return '7-29';
  return '30+';
}
