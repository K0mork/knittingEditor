import type { ChartDocument } from './database';

/** 同時刻は名前・作成日時・IDの順で決め、復元や再読み込みでも順序を安定させる。 */
export function compareDocuments(a: ChartDocument, b: ChartDocument): number {
  return b.updatedAt - a.updatedAt || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    || a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

