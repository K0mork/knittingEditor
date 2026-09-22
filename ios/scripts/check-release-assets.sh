#!/bin/sh
set -eu

APP_PATH="${1:-}"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "usage: $0 /path/to/knittingEditor.app" >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

"$SCRIPT_DIR/check-app-bundle.sh" "$APP_PATH"
"$SCRIPT_DIR/check-app-store-docs.sh"

INFO_PLIST="$APP_PATH/Info.plist"
ICON_PATH="$REPO_ROOT/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
LAUNCH_COLORSET_PATH="$REPO_ROOT/App/Assets.xcassets/LaunchBackground.colorset/Contents.json"

for required in "$INFO_PLIST" "$ICON_PATH" \
  "$LAUNCH_COLORSET_PATH" \
  "$REPO_ROOT/docs/APP_STORE_METADATA.md" \
  "$REPO_ROOT/docs/APP_REVIEW_NOTES.md" \
  "$REPO_ROOT/docs/PRIVACY_POLICY.md" \
  "$REPO_ROOT/docs/APP_STORE_CHECKLIST.md"; do
  if [ ! -f "$required" ]; then
    echo "missing release asset or document: $required" >&2
    exit 1
  fi
done

plutil -lint "$INFO_PLIST" >/dev/null
bundle_id=$(plutil -extract CFBundleIdentifier raw -o - "$INFO_PLIST")
short_version=$(plutil -extract CFBundleShortVersionString raw -o - "$INFO_PLIST")
build_version=$(plutil -extract CFBundleVersion raw -o - "$INFO_PLIST")
display_name=$(plutil -extract CFBundleDisplayName raw -o - "$INFO_PLIST")

[ "$bundle_id" = "com.k0mork.knittingEditor" ] || {
  echo "unexpected bundle identifier: $bundle_id" >&2
  exit 1
}
[ -n "$short_version" ] && [ -n "$build_version" ] && [ -n "$display_name" ] || {
  echo "bundle version or display name is missing" >&2
  exit 1
}

launch_color_name=$(plutil -extract UILaunchScreen.UIColorName raw -o - "$INFO_PLIST" 2>/dev/null || true)
[ "$launch_color_name" = "LaunchBackground" ] || {
  echo "unexpected launch screen color asset: ${launch_color_name:-<missing>}" >&2
  exit 1
}
jq -e '.colors | type == "array" and any(.[]; .idiom == "universal" and .color["color-space"] == "srgb")' "$LAUNCH_COLORSET_PATH" >/dev/null

icon_width=$(sips -g pixelWidth "$ICON_PATH" | awk '/pixelWidth:/ { print $2; exit }')
icon_height=$(sips -g pixelHeight "$ICON_PATH" | awk '/pixelHeight:/ { print $2; exit }')
[ "$icon_width" = "1024" ] && [ "$icon_height" = "1024" ] || {
  echo "AppIcon source must be 1024x1024: ${icon_width}x${icon_height}" >&2
  exit 1
}

check_screenshot() {
  path="$1"
  expected_width="$2"
  expected_height="$3"
  width=$(sips -g pixelWidth "$path" | awk '/pixelWidth:/ { print $2; exit }')
  height=$(sips -g pixelHeight "$path" | awk '/pixelHeight:/ { print $2; exit }')
  [ "$width" = "$expected_width" ] && [ "$height" = "$expected_height" ] || {
    echo "unexpected screenshot size for $path: ${width}x${height}" >&2
    exit 1
  }
}

# App Store Connectが要求する提出サイズ。
check_screenshot "$REPO_ROOT/docs/screenshots/app-store-iphone-6.9-editor.png" 1320 2868
check_screenshot "$REPO_ROOT/docs/screenshots/app-store-iphone-6.9-launch.png" 1320 2868
check_screenshot "$REPO_ROOT/docs/screenshots/app-store-ipad-13-editor.png" 2064 2752

# 解像度確認用の旧下書き。
check_screenshot "$REPO_ROOT/docs/screenshots/iphone-16-editor-simulator.png" 1179 2556
check_screenshot "$REPO_ROOT/docs/screenshots/ipad-10-editor-simulator.png" 1640 2360
check_screenshot "$REPO_ROOT/docs/screenshots/ipad-10-editor-landscape-simulator.png" 2360 1640
check_screenshot "$REPO_ROOT/docs/screenshots/iphone-16-launch-simulator.png" 1179 2556
check_screenshot "$REPO_ROOT/docs/screenshots/ipad-10-launch-simulator.png" 1640 2360

echo "release assets are valid: bundle=$bundle_id version=$short_version($build_version) display=$display_name"
