#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
PROJECT="$REPO_ROOT/knittingEditor.xcodeproj"
SCHEME="knittingEditor"
TEAM_OVERRIDE=${KNITTING_EDITOR_DEVELOPMENT_TEAM:-}
# 機内モード試験のようにケーブル接続が必須の作業では 1 を指定する。
REQUIRE_WIRED=${KNITTING_EDITOR_REQUIRE_WIRED:-}

if ! command -v xcodebuild >/dev/null 2>&1 || ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required" >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to inspect device connections" >&2
  exit 2
fi

if [ -n "$TEAM_OVERRIDE" ]; then
  case "$TEAM_OVERRIDE" in
    *[!A-Z0-9]*|'')
      echo 'ERROR: KNITTING_EDITOR_DEVELOPMENT_TEAM must contain only uppercase letters and digits.' >&2
      exit 2
      ;;
  esac
  if [ "${#TEAM_OVERRIDE}" -ne 10 ]; then
    echo 'ERROR: KNITTING_EDITOR_DEVELOPMENT_TEAM must be a 10-character Apple Team ID.' >&2
    exit 2
  fi
  settings=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showBuildSettings DEVELOPMENT_TEAM="$TEAM_OVERRIDE" 2>/dev/null)
else
  settings=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showBuildSettings 2>/dev/null)
fi
bundle_id=$(printf '%s\n' "$settings" | awk -F ' = ' '$1 ~ /^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*$/ { print $2; exit }')
team=$(printf '%s\n' "$settings" | awk -F ' = ' '$1 ~ /^[[:space:]]*DEVELOPMENT_TEAM[[:space:]]*$/ { print $2; exit }')

printf 'Bundle ID: %s\n' "${bundle_id:-<missing>}"
if [ -n "${team:-}" ] && [ "$team" != '$(DEVELOPMENT_TEAM)' ]; then
  printf 'Development Team: %s\n' "$team"
  if [ -n "$TEAM_OVERRIDE" ]; then
    echo 'Development Team source: KNITTING_EDITOR_DEVELOPMENT_TEAM (not stored in the project)'
  fi
else
  echo 'Development Team: <missing>'
  team=''
fi

# 接続状態は devicectl の JSON から読む。
#
# `devicectl device info ...` が応答したことを接続の根拠にしてはいけない。
# Wi-Fi ペアリング（transportType=localNetwork）でも成功し、しかも問い合わせ
# 自体が tunnelState を connected へ変えるため、ケーブルの有無を判断できない。
# 機内モードでは Wi-Fi が切れて localNetwork の端末へ到達できなくなるので、
# 機内モード試験には transportType=wired が必要である。
devices_json=$(mktemp)
trap 'rm -f "$devices_json"' EXIT
if ! xcrun devicectl list devices --json-output "$devices_json" >/dev/null 2>&1; then
  echo 'ERROR: devicectl could not list devices.' >&2
  exit 1
fi

physical=$(jq -r '
  .result.devices[]
  | select(.hardwareProperties.reality == "physical")
  | [
      .deviceProperties.name,
      (.hardwareProperties.marketingName // "?"),
      (.deviceProperties.osVersionNumber // "?"),
      .hardwareProperties.udid,
      (.connectionProperties.tunnelState // "?"),
      (.connectionProperties.transportType // "?"),
      (.deviceProperties.developerModeStatus // "?")
    ] | @tsv
' "$devices_json")

if [ -z "$physical" ]; then
  echo 'Physical devices: <none paired>'
else
  echo 'Physical devices:'
  printf '%s\n' "$physical" | while IFS="$(printf '\t')" read -r name marketing os udid state transport devmode; do
    printf '  %s (%s, iOS %s) udid=%s state=%s transport=%s developerMode=%s\n' \
      "$name" "$marketing" "$os" "$udid" "$state" "$transport" "$devmode"
  done
fi

usable=$(printf '%s\n' "$physical" | awk -F "\t" '$5 == "connected" && $7 == "enabled"' | wc -l | tr -d ' ')
wired=$(printf '%s\n' "$physical" | awk -F "\t" '$5 == "connected" && $7 == "enabled" && $6 == "wired"' | wc -l | tr -d ' ')

ready=1
if [ -z "${bundle_id:-}" ] || [ "$bundle_id" = '$(PRODUCT_BUNDLE_IDENTIFIER)' ]; then
  echo 'ERROR: Bundle ID could not be resolved.' >&2
  ready=0
fi
if [ -z "$team" ]; then
  echo 'ERROR: Set an Apple Developer Team in Signing & Capabilities before device testing.' >&2
  ready=0
fi
if [ "$usable" -eq 0 ]; then
  echo 'ERROR: No connected device with Developer Mode enabled. Connect and unlock an iPhone or iPad, trust this Mac, then rerun this check.' >&2
  ready=0
fi
if [ -n "$REQUIRE_WIRED" ] && [ "$wired" -eq 0 ]; then
  echo 'ERROR: KNITTING_EDITOR_REQUIRE_WIRED is set but no device is connected by cable. Wi-Fi (localNetwork) connections drop in airplane mode.' >&2
  ready=0
fi

if [ "$ready" -ne 1 ]; then
  exit 1
fi

printf 'Device release preflight is ready: connected=%s wired=%s\n' "$usable" "$wired"
