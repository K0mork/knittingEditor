export * from '@knitting-editor/editor-core/export/exporters';

import { iosPlatform } from '../platform';

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  await iosPlatform.saveFile(blob, filename);
}
