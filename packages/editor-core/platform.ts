/**
 * Host services the shared editor code depends on.
 *
 * 追加するのは、WebとiOSで実装が本当に分かれる操作だけにする。
 * 片方でしか呼ばれない、あるいは呼び出し元がない項目は置かない。
 */
export interface EditorPlatform {
  /** 生成したファイルを host へ渡す。Webはダウンロード、iOSは共有・Filesシート。 */
  saveFile(blob: Blob, filename: string): Promise<void>;
}
