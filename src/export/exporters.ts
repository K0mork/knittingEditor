export * from '@knitting-editor/editor-core/export/exporters';

import { webPlatform } from '../platform';

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  await webPlatform.saveFile(blob, filename);
}
