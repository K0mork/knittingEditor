#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

METADATA="$REPO_ROOT/docs/APP_STORE_METADATA.md"
CHECKLIST="$REPO_ROOT/docs/APP_STORE_CHECKLIST.md"
REVIEW_NOTES="$REPO_ROOT/docs/APP_REVIEW_NOTES.md"
PRIVACY_POLICY="$REPO_ROOT/docs/PRIVACY_POLICY.md"
SCREENSHOTS="$REPO_ROOT/docs/SCREENSHOTS.md"

for required in "$METADATA" "$CHECKLIST" "$REVIEW_NOTES" "$PRIVACY_POLICY" "$SCREENSHOTS"; do
  if [ ! -f "$required" ]; then
    echo "missing App Store document: $required" >&2
    exit 1
  fi
done

metadata_value_is_nonempty() {
  key="$1"
  file="$2"
  awk -F '|' -v key="$key" '
    function trim(value) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      return value
    }
    trim($2) == key {
      found = 1
      if (trim($3) == "") {
        exit 2
      }
    }
    END {
      if (!found) {
        exit 1
      }
    }
  ' "$file" || {
    status=$?
    echo "metadata table value is missing: $key" >&2
    exit "$status"
  }
}

metadata_value_is_nonempty "App名" "$METADATA"
metadata_value_is_nonempty "サブタイトル" "$METADATA"
metadata_value_is_nonempty "主カテゴリ" "$METADATA"
metadata_value_is_nonempty "副カテゴリ" "$METADATA"
metadata_value_is_nonempty "キーワード" "$METADATA"

rg -q 'サポートURL: `https://github\.com/K0mork/knittingEditor_app/issues`' "$METADATA" || {
  echo "support URL is missing or does not target the public repository" >&2
  exit 1
}
rg -q 'プライバシーポリシーURL候補: `https://github\.com/K0mork/knittingEditor_app/blob/main/docs/PRIVACY_POLICY\.md`' "$METADATA" || {
  echo "privacy policy URL is missing or does not target the public repository" >&2
  exit 1
}

for required_text in \
  '機内モード' \
  'Files' \
  '.knit' \
  'Review guideline 4.2'; do
  rg -q --fixed-strings "$required_text" "$REVIEW_NOTES" || {
    echo "review notes are missing required text: $required_text" >&2
    exit 1
  }
done

rg -q '^# ' "$PRIVACY_POLICY" || {
  echo "privacy policy has no title" >&2
  exit 1
}

for checked_item in \
  'iPhone 16／iPad (10th generation) Simulatorのスクリーンショット下書き' \
  '`App/PrivacyInfo.xcprivacy`' \
  'アプリ内ヘルプへプライバシーとサポート導線'; do
  rg -q --fixed-strings -- "- [x] $checked_item" "$CHECKLIST" || {
    echo "submission checklist does not record completed static item: $checked_item" >&2
    exit 1
  }
done

rg -q 'iphone-16-editor-simulator\.png' "$SCREENSHOTS" || {
  echo "iPhone simulator screenshot is not documented" >&2
  exit 1
}
rg -q 'ipad-10-editor-simulator\.png' "$SCREENSHOTS" || {
  echo "iPad simulator screenshot is not documented" >&2
  exit 1
}

echo "App Store documents are structurally valid"
