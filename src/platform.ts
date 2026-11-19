import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { isIPhoneOrIPad } from './appleDevice';

/** 共有シートへ添えるサイト名とURL（#474）。編み図の内容やファイル名は入れない。iOS版は`ShareCreditItemSource`が同じ文面を持つ。 */
export const SHARE_CREDIT: Pick<ShareData, 'title' | 'text'> = {
  title: '棒針編み図エディタ',
  text: '棒針編み図エディタで作成 https://knittingeditor.com/',
};

/**
 * `navigator.share`へ渡す`ShareData`。
 *
 * 文面は受け取った人がサイトへたどれるようにするためのもので、必ずファイルと一緒に渡す。
 * `canShare`は渡す内容そのもので確かめる。文面を一緒に渡せないブラウザでは、
 * 共有に失敗してダウンロードへ戻さないように、従来どおりファイルだけに戻す。
 */
export function shareData(file: File, nav: Navigator = navigator): ShareData {
  const withCredit: ShareData = { files: [file], ...SHARE_CREDIT };
  return typeof nav.canShare === 'function' && nav.canShare(withCredit) ? withCredit : { files: [file] };
}

/**
 * iPhone・iPadのSafariへ共有シートで渡すかどうか。
 *
 * iOSのSafariは`<a download>`のPDFをダウンロードせず、編集中のタブをPDF表示へ置き換える。
 * 戻れば編集画面は戻るが、編み図が消えたように見えるので、共有シート（「ファイルに保存」・プリント）で渡す。
 * iPadOSのSafariはMacの名乗りをするため、タッチ点の数で見分ける。共有APIの無いアプリ内ブラウザでは従来どおりダウンロードする。
 * 実際に共有する内容（`shareData`）で確かめるので、文面を渡せるかどうかもここで分かる。
 */
export function prefersShareSheet(file: File, nav: Navigator = navigator): boolean {
  return isIPhoneOrIPad(nav) && typeof nav.canShare === 'function' && nav.canShare(shareData(file, nav));
}

/**
 * Web版の`EditorPlatform`。
 *
 * 共有シートは利用者のタップの中でしか開けず、PNG・PDFの生成を待つ間にその権利が切れる。
 * そのため共有シートを使う端末では`offerShare`で「共有・保存」ボタンを出し、もう一度押してもらう。
 * `offerShare`は、共有したら`true`、閉じる・共有シートの取り消しなら`false`、
 * 共有できずダウンロードへ切り替えたら`undefined`を返す。ダウンロードは保存を終えたかが分からない。
 */
export function createWebPlatform(offerShare: (file: File) => Promise<boolean | undefined>): EditorPlatform {
  return {
    saveFile: async (blob, filename) => {
      const file = new File([blob], filename, { type: blob.type });
      if (prefersShareSheet(file)) return { saved: offerShare(file) };
      downloadBlob(blob, filename);
      return SAVE_RESULT_UNKNOWN;
    },
  };
}
