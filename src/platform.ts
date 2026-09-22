import type { EditorPlatform } from '@knitting-editor/editor-core/platform';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';

export const webPlatform: EditorPlatform = {
  saveFile: async (blob, filename) => downloadBlob(blob, filename),
};
