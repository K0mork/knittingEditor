#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO_ROOT=$(cd "$APP_ROOT/.." && pwd)
WEB_ROOT="$APP_ROOT/Web"
OUTPUT_ROOT="$APP_ROOT/AppResources/Web"
STAMP_PATH="$APP_ROOT/AppResources/.web-build.stamp"

if [[ ! -f "$REPO_ROOT/package-lock.json" ]]; then
  echo "Workspace package metadata is missing; run npm install at the repository root." >&2
  exit 1
fi

if [[ ! -x "$REPO_ROOT/node_modules/.bin/vite" ]]; then
  (cd "$REPO_ROOT" && npm ci --ignore-scripts)
fi

# ハッシュはこのビルドの入力だけを対象にする。リポジトリ全体を走査すると、
# `.git`やテスト成果物の更新でスタンプが毎回変わってスキップが効かず、
# 走査中に消えたファイルで`shasum`が失敗してビルドフェーズごと落ちる。
# テストとMarkdownはbundleに入らないので、変更されても作り直さない。
# 共通の`tsconfig.base.json`・`vite.shared.ts`はビルド設定そのものなので必ず含める。
input_hash="$(
  cd "$REPO_ROOT"
  LC_ALL=C find ./ios/Web ./ios/scripts/build-web.sh ./packages ./package.json ./package-lock.json ./tsconfig.base.json ./vite.shared.ts -type f \
    ! -path './ios/Web/dist/*' \
    ! -path './ios/Web/node_modules/*' \
    ! -path './packages/*/node_modules/*' \
    ! -name '*.tsbuildinfo' \
    ! -name '*.test.ts' \
    ! -name '*.test.tsx' \
    ! -name '*.md' \
    ! -name '.DS_Store' \
    -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 \
    | shasum -a 256 \
    | awk '{print $1}'
)"

if [[ -f "$STAMP_PATH" && -f "$OUTPUT_ROOT/index.html" && "$(<"$STAMP_PATH")" == "$input_hash" ]]; then
  echo "Local Web assets are up to date; skipping Web build"
  exit 0
fi

(cd "$WEB_ROOT" && "$REPO_ROOT/node_modules/.bin/tsc" -p tsconfig.app.json --noEmit && "$REPO_ROOT/node_modules/.bin/vite" build --config vite.config.ts)

mkdir -p "$OUTPUT_ROOT"
find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf {} +
cp -R "$WEB_ROOT/dist/." "$OUTPUT_ROOT/"
printf '%s\n' "$input_hash" > "$STAMP_PATH"

echo "Built local Web assets into $OUTPUT_ROOT"
