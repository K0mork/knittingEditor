// 配信物の`asset-history.json`：本番の`/assets/`に残している版と、そのファイルの一覧（新しい順）。
// `retain-previous-assets.mjs`が書き、`check-dist.mjs`と`check-live-site.mjs`が確かめる。
//   { "version": 1, "generations": [{ "commit": "<SHA>" | null, "deployedAt": "<ISO 8601>" | null, "files": ["index-*.js", ...] }] }
// generations[0]がその配信の版。commitとdeployedAtは、この仕組みより前の版では分からないことがあるのでnullを許す。

export const ASSET_HISTORY_FILE = 'asset-history.json';

const ASSET_NAME = /^[\w-][\w.-]*$/;

/** 配信物に残すファイルか。ソースマップは動作に要らず大きいので、前の版の分は残さない。 */
export function isRetainedAsset(name) {
  return !name.endsWith('.map');
}

/** `asset-history.json`の内容を検証して返す。形が違えばErrorを投げる。 */
export function parseAssetHistory(text) {
  const history = JSON.parse(text);
  if (history?.version !== 1 || !Array.isArray(history.generations) || history.generations.length === 0) {
    throw new Error(`${ASSET_HISTORY_FILE} の形式が違います`);
  }
  for (const generation of history.generations) {
    const { commit, deployedAt, files } = generation ?? {};
    if (commit !== null && typeof commit !== 'string') throw new Error(`${ASSET_HISTORY_FILE}: commitが文字列ではありません`);
    if (deployedAt !== null && (typeof deployedAt !== 'string' || Number.isNaN(Date.parse(deployedAt)))) {
      throw new Error(`${ASSET_HISTORY_FILE}: deployedAtが日時ではありません: ${deployedAt}`);
    }
    if (!Array.isArray(files) || files.length === 0) throw new Error(`${ASSET_HISTORY_FILE}: filesが空です`);
    for (const file of files) {
      if (typeof file !== 'string' || !ASSET_NAME.test(file) || !isRetainedAsset(file)) {
        throw new Error(`${ASSET_HISTORY_FILE}: ファイル名が不正です: ${file}`);
      }
    }
  }
  return history;
}

/** 一覧に載っているファイル名をすべて返す。 */
export function assetHistoryFiles(history) {
  return new Set(history.generations.flatMap((generation) => generation.files));
}
