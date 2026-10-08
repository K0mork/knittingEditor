import { SAVE_RESULT_UNKNOWN, type EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { saveBlobWithNativeBridge } from './nativeBridge';

export const iosPlatform: EditorPlatform = {
  // ネイティブの保存画面・共有シートは、保存・共有を終えたか取りやめたかを返す（#122）。
  // ブリッジが無い（ブラウザで開いた）ときはダウンロードし、結果は分からない。
  saveFile: async (blob, filename) => {
    const outcome = await saveBlobWithNativeBridge(blob, filename);
    if (outcome) return outcome;
    downloadBlob(blob, filename);
    return SAVE_RESULT_UNKNOWN;
  },
};
