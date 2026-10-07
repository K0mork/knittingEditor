import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { saveBlobWithNativeBridge } from './nativeBridge';

export const iosPlatform: EditorPlatform = {
  // ネイティブの保存画面・共有シートは、利用者が保存したか取りやめたかをWebへ返さない（#122）。結果が分からないので、渡した時点を書き出した日時とする。
  saveFile: async (blob, filename) => {
    if (!(await saveBlobWithNativeBridge(blob, filename))) downloadBlob(blob, filename);
    return SAVE_RESULT_UNKNOWN;
  },
};
