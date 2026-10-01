import type { EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';

/**
 * iPhone・iPadのSafariへ共有シートで渡すかどうか。
 *
 * iOSのSafariは`<a download>`のPDFをダウンロードせず、編集中のタブをPDF表示へ置き換える。
 * 戻れば編集画面は戻るが、編み図が消えたように見えるので、共有シート（「ファイルに保存」・プリント）で渡す。
 * iPadOSのSafariはMacの名乗りをするため、タッチ点の数で見分ける。共有APIの無いアプリ内ブラウザでは従来どおりダウンロードする。
 */
export function prefersShareSheet(file: File, nav: Navigator = navigator): boolean {
  const appleTouch = /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
  return appleTouch && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
}

/**
 * Web版の`EditorPlatform`。
 *
 * 共有シートは利用者のタップの中でしか開けず、PNG・PDFの生成を待つ間にその権利が切れる。
 * そのため共有シートを使う端末では`offerShare`で「共有・保存」ボタンを出し、もう一度押してもらう。
 */
export function createWebPlatform(offerShare: (file: File) => void): EditorPlatform {
  return {
    saveFile: async (blob, filename) => {
      const file = new File([blob], filename, { type: blob.type });
      if (prefersShareSheet(file)) offerShare(file);
      else downloadBlob(blob, filename);
    },
  };
}
