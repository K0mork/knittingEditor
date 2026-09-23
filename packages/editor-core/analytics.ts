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
