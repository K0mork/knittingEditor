/**
 * Host services the shared editor code depends on.
 *
 * 追加するのは、WebとiOSで実装が本当に分かれる操作だけにする。
 * 片方でしか呼ばれない、あるいは呼び出し元がない項目は置かない。
 */
export interface EditorPlatform {
  /**
   * 生成したファイルを host へ渡す。Webはダウンロード（iPhone・iPadのSafariは共有シート）、iOSは共有・Filesシート。
   * ファイルを渡し終えた時点で解決する。利用者が保存・共有を終えたかは`saved`で後から分かる。
   */
  saveFile(blob: Blob, filename: string): Promise<SaveFileOutcome>;
}

export interface SaveFileOutcome {
  /**
   * 利用者が保存・共有を終えたら`true`、取りやめたら`false`。
   * hostが結果を返さないとき（ダウンロード、iOS版のネイティブ画面）は`undefined`。
   * 確認ダイアログや共有シートを閉じるまで解決しないので、処理中の表示はこれを待たずに消す。
   */
  saved: Promise<boolean | undefined>;
}

/** 結果を返さないhost向けの`SaveFileOutcome`。 */
export const SAVE_RESULT_UNKNOWN: SaveFileOutcome = { saved: Promise.resolve(undefined) };
