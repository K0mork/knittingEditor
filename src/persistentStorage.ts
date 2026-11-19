/**
 * 端末の空き容量が足りなくなったとき、Chromeは永続化を許可していないサイトのIndexedDBを
 * 消すことがある（#486）。`navigator.storage.persist()`で永続化を求め、バックアップしていない
 * 編み図が失われる可能性を減らす。Web版（`src/`）だけから呼び、iOS版には入れない。
 *
 * Chromeは確認を出さず、閲覧の頻度・ホーム画面への追加・ブックマークから許可を決める。
 * Firefoxは確認を出すため、ページ読み込みの直後ではなく最初の編み図の保存が終わった後で呼ぶ。
 * 拒否・未対応・失敗のときは何も表示せず、編集も止めない。
 */

/** `navigator.storage`（永続化の要求と状態の読み出し）。 */
export interface PersistentStorage {
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
}

// 1回のページ読み込みにつき1回だけ求める。保存は何度も成功するが、何度も要求しても意味がない。
let requested = false;

/**
 * 永続化を求める。`persist()`に対応していない、既に永続化されている、拒否された、失敗した
 * いずれの場合も、何も表示せずに終わる。エラーはここで飲み込むので、呼び出し側は待たなくてよい。
 */
export async function requestPersistentStorageOnce(storage: PersistentStorage | undefined = navigator.storage): Promise<void> {
  if (requested) return;
  requested = true;
  if (!storage?.persist) return;
  try {
    if (await storage.persisted()) return;
    await storage.persist();
  } catch {
    // 拒否された・何らかの理由で失敗した。編集には影響しないので何もしない。
  }
}
