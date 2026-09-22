import type { EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { saveBlobWithNativeBridge } from './nativeBridge';

export const iosPlatform: EditorPlatform = {
  saveFile: async (blob, filename) => {
    if (!(await saveBlobWithNativeBridge(blob, filename))) downloadBlob(blob, filename);
  },
};
