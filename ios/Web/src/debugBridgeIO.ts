import { openDB } from 'idb';
import { bridgeMeasurementDocument, BRIDGE_MEASUREMENT_COUNTS } from '@knitting-editor/editor-core/storage/bridgeMeasurementData';

/** DEBUG bundleだけが動的importする。既存文書があれば拒否し、利用者のデータは変更しない。 */
export async function seedBridgeMeasurement(size: string): Promise<void> {
  if (!(Object.hasOwn(BRIDGE_MEASUREMENT_COUNTS, size))) throw new Error('計測サイズが不正です');
  // 通常のschema作成を共用する。initializeStorageより前なので空のまま検査できる。
  const { listDocuments } = await import('@knitting-editor/editor-core/storage/database');
  if ((await listDocuments()).length) throw new Error('計測には文書のない新規テスト用コンテナが必要です');
  const db = await openDB('knitting-editor-v2');
  try {
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');
    // 同時の起動処理が文書を追加していないことも同一トランザクションで確かめる。
    if (await store.count()) { tx.abort(); throw new Error('既存文書への計測データ追加を拒否しました'); }
    const count = BRIDGE_MEASUREMENT_COUNTS[size as keyof typeof BRIDGE_MEASUREMENT_COUNTS];
    for (let i = 0; i < count; i++) await store.add(bridgeMeasurementDocument(i));
    await tx.done;
  } finally { db.close(); }
}
