#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: compile-macos-native.sh <AppIcon.icon> <output-directory> [--name AppIcon] [--minimum-deployment-target 13.0]" >&2
}

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

icon_path="$1"
output_dir="$2"
shift 2

icon_name="$(basename "$icon_path" .icon)"
minimum_target="13.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      icon_name="$2"
      shift 2
      ;;
    --minimum-deployment-target)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      minimum_target="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Native macOS icon compilation requires macOS." >&2
  exit 1
fi

if [[ ! -d "$icon_path" || ! -f "$icon_path/icon.json" ]]; then
  echo "Invalid .icon package: $icon_path" >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is unavailable. Install and select Xcode 26 or newer." >&2
  exit 1
fi

xcode_version="$(xcodebuild -version 2>/dev/null | head -n 1 || true)"
xcode_major="$(printf '%s' "$xcode_version" | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
if [[ -z "$xcode_major" || "$xcode_major" -lt 26 ]]; then
  echo "Xcode 26 or newer is required; selected: ${xcode_version:-unknown}." >&2
  exit 1
fi

icon_path="$(cd "$(dirname "$icon_path")" && pwd)/$(basename "$icon_path")"
mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/build-icon-native.XXXXXX")"

cleanup() {
  rm -rf "$temporary_dir"
}
trap cleanup EXIT

mkdir -p "$temporary_dir/output"
report_path="$output_dir/compile-report.txt"

{
  echo "xcode=$xcode_version"
  echo "icon=$icon_path"
  echo "name=$icon_name"
  echo "minimum_deployment_target=$minimum_target"
} > "$report_path"

xcrun actool \
  --compile "$temporary_dir/output" \
  --platform macosx \
  --minimum-deployment-target "$minimum_target" \
  --target-device mac \
  --app-icon "$icon_name" \
  --output-partial-info-plist "$temporary_dir/partial-info.plist" \
  "$icon_path" >> "$report_path" 2>&1

assets_car="$temporary_dir/output/Assets.car"
fallback_icns="$temporary_dir/output/$icon_name.icns"

if [[ ! -s "$assets_car" ]]; then
  echo "actool did not produce Assets.car. See $report_path" >&2
  exit 1
fi
if [[ ! -s "$fallback_icns" ]]; then
  echo "actool did not produce $icon_name.icns. See $report_path" >&2
  exit 1
fi

cp "$assets_car" "$output_dir/Assets.car"
cp "$fallback_icns" "$output_dir/$icon_name.icns"
cp "$temporary_dir/partial-info.plist" "$output_dir/partial-info.plist"

xcrun assetutil --info "$output_dir/Assets.car" > "$output_dir/asset-info.json"

if ! grep -Eqi 'icon.?stack|multi.?layer|app.?icon' "$output_dir/asset-info.json"; then
  echo "warning: assetutil output does not identify an icon stack; review $output_dir/asset-info.json" | tee -a "$report_path" >&2
fi

{
  echo "assets_car=$output_dir/Assets.car"
  echo "fallback_icns=$output_dir/$icon_name.icns"
  echo "partial_info=$output_dir/partial-info.plist"
  echo "asset_info=$output_dir/asset-info.json"
  echo "status=ok"
} >> "$report_path"

echo "Native macOS icon compiled: $output_dir"
