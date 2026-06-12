#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/Alchm.app"
DMG_PATH="$ROOT_DIR/src-tauri/target/release/bundle/dmg/Alchm_1.0.0_aarch64.dmg"
SIGNING_IDENTITY="${ALCHM_MACOS_SIGNING_IDENTITY:--}"
NOTARY_PROFILE="${ALCHM_NOTARY_PROFILE:-}"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/alchm-release.XXXXXX")"
MOUNT_POINT=""

cleanup() {
  if [[ -n "$MOUNT_POINT" ]]; then
    hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

if [[ ! -d "$APP_PATH" ]]; then
  echo "Missing Tauri app bundle: $APP_PATH" >&2
  exit 1
fi

copy_without_resource_forks() {
  local source_path="$1"
  local target_path="$2"

  if command -v ditto >/dev/null 2>&1; then
    ditto --norsrc "$source_path" "$target_path"
  else
    cp -R "$source_path" "$target_path"
  fi
}

strip_xattrs() {
  local target_path="$1"

  if command -v xattr >/dev/null 2>&1; then
    xattr -c "$target_path" >/dev/null 2>&1 || true
    xattr -cr "$target_path" >/dev/null 2>&1 || true
    xattr -d com.apple.FinderInfo "$target_path" >/dev/null 2>&1 || true
    xattr -d 'com.apple.fileprovider.fpfs#P' "$target_path" >/dev/null 2>&1 || true
  fi

  if command -v SetFile >/dev/null 2>&1 && [[ "$target_path" == *.app ]]; then
    SetFile -a b "$target_path" >/dev/null 2>&1 || true
  fi

  if command -v xattr >/dev/null 2>&1 && [[ "$target_path" == *.app ]]; then
    xattr -wx com.apple.FinderInfo \
      0000000000000000000000000000000000000000000000000000000000000000 \
      "$target_path" >/dev/null 2>&1 || true
    xattr -d com.apple.FinderInfo "$target_path" >/dev/null 2>&1 || true
    xattr -d 'com.apple.fileprovider.fpfs#P' "$target_path" >/dev/null 2>&1 || true
  fi
}

verify_app_bundle() {
  local app_path="$1"

  for _ in 1 2 3; do
    strip_xattrs "$app_path"
    if codesign --verify --deep --strict --verbose=2 "$app_path"; then
      return 0
    fi
    sleep 0.2
  done

  return 1
}

sign_app_bundle() {
  local app_path="$1"

  rm -rf "$app_path/Contents/_CodeSignature"
  strip_xattrs "$app_path"
  codesign --force --deep --sign "$SIGNING_IDENTITY" "$app_path"
  strip_xattrs "$app_path"
  verify_app_bundle "$app_path"
}

SIGNED_APP="$TMP_ROOT/Alchm.app"
STAGING_DIR="$TMP_ROOT/dmg"
TMP_DMG="$TMP_ROOT/Alchm_1.0.0_aarch64.dmg"

copy_without_resource_forks "$APP_PATH" "$SIGNED_APP"
sign_app_bundle "$SIGNED_APP"
rm -rf "$APP_PATH"
copy_without_resource_forks "$SIGNED_APP" "$APP_PATH"
strip_xattrs "$APP_PATH"
verify_app_bundle "$APP_PATH"

mkdir -p "$STAGING_DIR"
copy_without_resource_forks "$SIGNED_APP" "$STAGING_DIR/Alchm.app"
ln -s /Applications "$STAGING_DIR/Applications"
sign_app_bundle "$STAGING_DIR/Alchm.app"

rm -f "$DMG_PATH"
hdiutil create -volname "Alchm" -srcfolder "$STAGING_DIR" -ov -format UDZO "$TMP_DMG"
mkdir -p "$(dirname "$DMG_PATH")"
cp "$TMP_DMG" "$DMG_PATH"

if [[ "$SIGNING_IDENTITY" != "-" ]]; then
  codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"
  codesign --verify --deep --strict --verbose=2 "$DMG_PATH"
fi

hdiutil verify "$DMG_PATH"

MOUNT_OUTPUT="$(hdiutil attach -nobrowse -readonly "$DMG_PATH")"
MOUNT_POINT="$(echo "$MOUNT_OUTPUT" | awk -F '\t' '/\/Volumes\// {print $NF}' | tail -1)"
if [[ -z "$MOUNT_POINT" || ! -d "$MOUNT_POINT/Alchm.app" ]]; then
  echo "Unable to locate mounted Alchm.app in DMG." >&2
  exit 1
fi
verify_app_bundle "$MOUNT_POINT/Alchm.app"
hdiutil detach "$MOUNT_POINT" >/dev/null
MOUNT_POINT=""

if [[ -n "$NOTARY_PROFILE" ]]; then
  if [[ "$SIGNING_IDENTITY" == "-" ]]; then
    echo "ALCHM_NOTARY_PROFILE requires a Developer ID signing identity." >&2
    exit 1
  fi

  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
fi

strip_xattrs "$APP_PATH"
if ! verify_app_bundle "$APP_PATH"; then
  echo "Warning: local app bundle retained macOS metadata after packaging; the DMG-mounted app was verified." >&2
fi
strip_xattrs "$DMG_PATH"
du -sh "$DMG_PATH"
