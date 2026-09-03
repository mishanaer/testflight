#!/usr/bin/env bash
set -u

if [ "$#" -lt 2 ]; then
  echo "Usage: render-previews.sh <AppIcon.icon> <output-directory> [platform...]" >&2
  exit 2
fi

ICON_PATH="$1"
OUTPUT_DIR="$2"
shift 2
PLATFORMS=("$@")
if [ "${#PLATFORMS[@]}" -eq 0 ]; then
  PLATFORMS=(iOS macOS watchOS)
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is unavailable; install/select Xcode" >&2
  exit 1
fi
ICON_TOOL_PATH=$(xcrun --find ictool 2>/dev/null || true)
if [ -z "$ICON_TOOL_PATH" ]; then
  echo "ictool is unavailable in the selected Xcode" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
REPORT_PATH="$OUTPUT_DIR/render-report.txt"
XCODE_VERSION=$(xcodebuild -version 2>/dev/null | tr '\n' ' ' || true)
{
  echo "tool=$ICON_TOOL_PATH"
  echo "xcode=$XCODE_VERSION"
  echo "icon=$ICON_PATH"
} > "$REPORT_PATH"

PROBE_OUTPUT="$OUTPUT_DIR/.probe.png"
PROBE_TEXT=$("$ICON_TOOL_PATH" "$ICON_PATH" --export-image --output-file "$PROBE_OUTPUT" --platform iOS --rendition Default --width 32 --height 32 --scale 1 2>&1)
PROBE_STATUS=$?
rm -f "$PROBE_OUTPUT"
if [ "$PROBE_STATUS" -ne 0 ]; then
  {
    echo "status=incompatible-cli"
    echo "$PROBE_TEXT"
  } >> "$REPORT_PATH"
  echo "Installed ictool does not support the tested --export-image interface. See $REPORT_PATH" >&2
  exit 3
fi

RENDITIONS=(Default Dark TintedLight TintedDark)
FAILED=0
for PLATFORM_NAME in "${PLATFORMS[@]}"; do
  PLATFORM_DIR="$OUTPUT_DIR/$PLATFORM_NAME"
  mkdir -p "$PLATFORM_DIR"
  CANVAS_SIZE=1024
  if [ "$PLATFORM_NAME" = "watchOS" ]; then CANVAS_SIZE=1088; fi
  for RENDITION_NAME in "${RENDITIONS[@]}"; do
    OUTPUT_FILE="$PLATFORM_DIR/$RENDITION_NAME.png"
    EXTRA_ARGS=()
    if [ "$RENDITION_NAME" = "TintedLight" ]; then EXTRA_ARGS=(--tint-color 0.65 --tint-strength 0.65); fi
    if [ "$RENDITION_NAME" = "TintedDark" ]; then EXTRA_ARGS=(--tint-color 0.08 --tint-strength 0.75); fi
    if "$ICON_TOOL_PATH" "$ICON_PATH" --export-image --output-file "$OUTPUT_FILE" \
      --platform "$PLATFORM_NAME" --rendition "$RENDITION_NAME" --width "$CANVAS_SIZE" --height "$CANVAS_SIZE" --scale 1 \
      "${EXTRA_ARGS[@]}" >> "$REPORT_PATH" 2>&1; then
      echo "$PLATFORM_NAME/$RENDITION_NAME=ok" >> "$REPORT_PATH"
    else
      echo "$PLATFORM_NAME/$RENDITION_NAME=failed" >> "$REPORT_PATH"
      FAILED=1
    fi
  done
done

if [ "$FAILED" -ne 0 ]; then
  echo "One or more previews failed; see $REPORT_PATH" >&2
  exit 1
fi
echo "Previews: $OUTPUT_DIR"
