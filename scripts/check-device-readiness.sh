#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
PROJECT="$REPO_ROOT/knittingEditor.xcodeproj"
SCHEME="knittingEditor"

if ! command -v xcodebuild >/dev/null 2>&1 || ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required" >&2
  exit 2
fi

settings=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showBuildSettings 2>/dev/null)
bundle_id=$(printf '%s\n' "$settings" | awk -F ' = ' '$1 ~ /^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER[[:space:]]*$/ { print $2; exit }')
team=$(printf '%s\n' "$settings" | awk -F ' = ' '$1 ~ /^[[:space:]]*DEVELOPMENT_TEAM[[:space:]]*$/ { print $2; exit }')

printf 'Bundle ID: %s\n' "${bundle_id:-<missing>}"
if [ -n "${team:-}" ] && [ "$team" != '$(DEVELOPMENT_TEAM)' ]; then
  printf 'Development Team: %s\n' "$team"
else
  echo 'Development Team: <missing>'
  team=''
fi

online_ios_devices=$(xcrun xctrace list devices 2>/dev/null | awk '
  /^== Devices ==$/ { online = 1; next }
  /^== Devices Offline ==$/ { online = 0 }
  online && $0 ~ /\([0-9]+\.[0-9]+\)/ { print }
')

if [ -n "$online_ios_devices" ]; then
  echo 'Online iOS devices:'
  printf '%s\n' "$online_ios_devices"
else
  echo 'Online iOS devices: <none>'
fi

ready=1
if [ -z "${bundle_id:-}" ] || [ "$bundle_id" = '$(PRODUCT_BUNDLE_IDENTIFIER)' ]; then
  echo 'ERROR: Bundle ID could not be resolved.' >&2
  ready=0
fi
if [ -z "$team" ]; then
  echo 'ERROR: Set an Apple Developer Team in Signing & Capabilities before device testing.' >&2
  ready=0
fi
if [ -z "$online_ios_devices" ]; then
  echo 'ERROR: Connect and trust an iPhone or iPad, then rerun this check.' >&2
  ready=0
fi

if [ "$ready" -ne 1 ]; then
  exit 1
fi

echo 'Device release preflight is ready.'
