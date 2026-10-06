/**
 * 編み図一覧に出す更新日時と、読み上げ用の説明。ReactにもDOMにも依存しない。
 *
 * 日時は端末の時刻で書く。一覧では短く、今日・昨日は日付を省き、今年は年を省く。
 * - 今日: 「今日 14:05」
 * - 昨日: 「昨日 9:30」
 * - 今年: 「10月6日 14:05」
 * - それより前: 「2025年10月6日 14:05」
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatUpdatedAt(time: number, now: number = Date.now()): string {
  const date = new Date(time);
  const today = new Date(now);
  const clock = `${date.getHours()}:${pad(date.getMinutes())}`;
  const dayStart = startOfDay(date);
  const todayStart = startOfDay(today);
  if (dayStart === todayStart) return `今日 ${clock}`;
  // 夏時間の切り替え日でも1日前を取り違えないよう、正午を基準に前日を求める。
  if (dayStart === startOfDay(new Date(todayStart - DAY_MS / 2))) return `昨日 ${clock}`;
  if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${clock}`;
}

/**
 * 次の日（端末の時刻の0時）になるまでのミリ秒。一覧を開いたまま日付が変わったときに
 * 「今日」「昨日」を書き直すために使う。夏時間の切り替え日でも`Date`に日付を組み立てさせる。
 */
export function msUntilNextDay(now: number = Date.now()): number {
  const today = new Date(now);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() - now;
}

export interface DocumentSummary { name: string; rows: number; cols: number; updatedAt: number }

/**
 * 一覧の項目を読み上げるときの名前。名前を先頭に置く。iOSのUIテストは名前の前方一致で
 * 項目を探し、読み上げでも最初に何の編み図かが分かる。
 */
export function documentAccessibleName(document: DocumentSummary, now: number = Date.now()): string {
  return `${document.name}、${document.rows}段×${document.cols}目、更新 ${formatUpdatedAt(document.updatedAt, now)}`;
}
