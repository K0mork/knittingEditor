#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

METADATA="$REPO_ROOT/docs/APP_STORE_METADATA.md"
CHECKLIST="$REPO_ROOT/docs/APP_STORE_CHECKLIST.md"
REVIEW_NOTES="$REPO_ROOT/docs/APP_REVIEW_NOTES.md"
PRIVACY_POLICY="$REPO_ROOT/docs/PRIVACY_POLICY.md"
SCREENSHOTS="$REPO_ROOT/docs/SCREENSHOTS.md"
PERFORMANCE_BASELINE="$REPO_ROOT/docs/SIMULATOR_PERFORMANCE_BASELINE.md"

for required in "$METADATA" "$CHECKLIST" "$REVIEW_NOTES" "$PRIVACY_POLICY" "$SCREENSHOTS" "$PERFORMANCE_BASELINE"; do
  if [ ! -f "$required" ]; then
    echo "missing App Store document: $required" >&2
    exit 1
  fi
done

# 表の「| 項目 | 値 |」から項目名が完全に一致する行の値を出す。無ければ終了コード1。
# macOSのawkはUTF-8ロケールで文字列の比較に照合順序を使い、日本語の項目名を区別しないことがある
# （en_US.UTF-8では「項目」と「ホーム画面の表示名」が等しくなった）。perlの`eq`はロケールに依らない。
metadata_value() {
  perl -CSDA -ne '
    BEGIN { $key = shift @ARGV }
    if (/^\|([^|]*)\|([^|]*)\|/) {
      ($name, $value) = ($1, $2);
      s/^\s+|\s+$//g for $name, $value;
      if ($name eq $key) { print $value; $found = 1; last }
    }
    END { exit($found ? 0 : 1) }
  ' "$1" "$2"
}

metadata_value_is_nonempty() {
  key="$1"
  file="$2"
  value=$(metadata_value "$key" "$file") || {
    echo "metadata table value is missing: $key" >&2
    exit 1
  }
  [ -n "$value" ] || {
    echo "metadata table value is missing: $key" >&2
    exit 2
  }
}

metadata_value_within_limit() {
  key="$1"
  limit="$2"
  value=$(metadata_value "$key" "$METADATA") || value=''
  length=$(printf '%s\n' "$value" | perl -CS -ne 'chomp; print length($_)')
  if [ "$length" -gt "$limit" ]; then
    echo "metadata value exceeds App Store limit: $key (${length}/${limit})" >&2
    exit 1
  fi
}

metadata_value_is_nonempty "App名" "$METADATA"
metadata_value_is_nonempty "サブタイトル" "$METADATA"
metadata_value_is_nonempty "主カテゴリ" "$METADATA"
metadata_value_is_nonempty "副カテゴリ" "$METADATA"
metadata_value_is_nonempty "キーワード" "$METADATA"
metadata_value_is_nonempty "プロモーションテキスト" "$METADATA"
metadata_value_within_limit "App名" 30
metadata_value_within_limit "サブタイトル" 30
metadata_value_within_limit "キーワード" 100
metadata_value_within_limit "プロモーションテキスト" 170

# ホーム画面の表示名は、全角7文字以上だと文字サイズを大きくしたiPhoneで切れる（APP_STORE_METADATA.mdの実測）。
# 文書の値とInfo.plistの値がずれないよう、両方を照合する。plutilの無いLinuxでも動くようperlで読む。
metadata_value_is_nonempty "ホーム画面の表示名" "$METADATA"
metadata_value_within_limit "ホーム画面の表示名" 6
home_name=$(metadata_value "ホーム画面の表示名" "$METADATA")
for key in CFBundleDisplayName CFBundleName; do
  plist_name=$(perl -CSDA -0777 -ne '
    BEGIN { $key = shift @ARGV }
    print $1 if m{<key>\Q$key\E</key>\s*<string>([^<]*)</string>};
  ' "$key" "$REPO_ROOT/App/Info.plist")
  [ "$plist_name" = "$home_name" ] || {
    echo "App/Info.plist $key does not match the home screen name: ${plist_name:-<missing>} != $home_name" >&2
    exit 1
  }
done

grep -qE -- 'サポートURL: `https://knittingeditor\.com/support/`' "$METADATA" || {
  echo "support URL is missing or does not target the support page" >&2
  exit 1
}
grep -qE -- 'プライバシーポリシーURL候補: `https://github\.com/K0mork/knittingEditor/blob/main/ios/docs/PRIVACY_POLICY\.md`' "$METADATA" || {
  echo "privacy policy URL is missing or does not target the public repository" >&2
  exit 1
}

for required_text in \
  '機内モード' \
  'Files' \
  '.knit' \
  'Review guideline 4.2'; do
  grep -qF -- "$required_text" "$REVIEW_NOTES" || {
    echo "review notes are missing required text: $required_text" >&2
    exit 1
  }
done

grep -qE -- '^# ' "$PRIVACY_POLICY" || {
  echo "privacy policy has no title" >&2
  exit 1
}

for checked_item in \
  'iPhone 16／iPad (10th generation) Simulatorのスクリーンショット下書き' \
  '`App/PrivacyInfo.xcprivacy`' \
  'アプリ内ヘルプへプライバシーとサポート導線'; do
  grep -qF -- "- [x] $checked_item" "$CHECKLIST" || {
    echo "submission checklist does not record completed static item: $checked_item" >&2
    exit 1
  }
done

for submission_shot in app-store-iphone-6.9-editor.png app-store-iphone-6.9-launch.png app-store-ipad-13-editor.png; do
  grep -qF -- "$submission_shot" "$SCREENSHOTS" || {
    echo "App Store submission screenshot is not documented: $submission_shot" >&2
    exit 1
  }
done

grep -qE -- 'iphone-16-editor-simulator\.png' "$SCREENSHOTS" || {
  echo "iPhone simulator screenshot is not documented" >&2
  exit 1
}
grep -qE -- 'ipad-10-editor-simulator\.png' "$SCREENSHOTS" || {
  echo "iPad simulator screenshot is not documented" >&2
  exit 1
}
grep -qE -- 'ipad-10-editor-landscape-simulator\.png' "$SCREENSHOTS" || {
  echo "iPad landscape simulator screenshot is not documented" >&2
  exit 1
}
grep -qE -- 'iphone-16-launch-simulator\.png' "$SCREENSHOTS" || {
  echo "iPhone simulator launch screenshot is not documented" >&2
  exit 1
}
grep -qE -- 'ipad-10-launch-simulator\.png' "$SCREENSHOTS" || {
  echo "iPad simulator launch screenshot is not documented" >&2
  exit 1
}

grep -qF -- '# Simulator／Web基準値' "$PERFORMANCE_BASELINE" || {
  echo "Simulator performance baseline has no title" >&2
  exit 1
}

echo "App Store documents are structurally valid"
