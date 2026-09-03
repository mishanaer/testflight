# Native macOS icon integration

## What creates the native appearance

Compile the Icon Composer `.icon` with Xcode's `actool`. The resulting `Assets.car` contains the icon stack and appearance renditions used by current macOS for system masking, depth, material, and specular edge highlights. Do not simulate these effects in SVG or PNG.

Keep the generated `.icns` beside it as a compatibility fallback. An `.icns` by itself is static and cannot reproduce the current native material.

## Requirements

- macOS with Xcode 26 or newer selected by `xcode-select`, or set `DEVELOPER_DIR` for the command;
- a valid layered `.icon` whose internal name matches `--name`;
- Default artwork; dedicated Dark and Tinted artwork when the design requires it.

## Tauri 2

Compile before bundling, not only once by hand. A project-local wrapper may call `compile-macos-native.sh` from `beforeBundleCommand`.

Keep the fallback in the regular bundle icon list:

```json
{
  "bundle": {
    "icon": ["icons/AppIcon.icns"]
  }
}
```

Add the compiled catalog and fallback to the macOS bundle resources, preferably in a macOS-specific Tauri config:

```json
{
  "bundle": {
    "macOS": {
      "files": {
        "Resources/Assets.car": "./icons/macos-native/Assets.car",
        "Resources/AppIcon.icns": "./icons/macos-native/AppIcon.icns"
      }
    }
  }
}
```

Merge these keys into `src-tauri/Info.plist` without removing existing privacy descriptions:

```xml
<key>CFBundleIconName</key>
<string>AppIcon</string>
<key>CFBundleIconFile</key>
<string>AppIcon</string>
```

Use the same icon name for the `.icon` package, `actool --app-icon`, `CFBundleIconName`, and fallback filename. Tauri's `bundle.icon` entry alone does not embed the native icon stack.

## Xcode target

Add the `.icon` document to the target and select its name as the App Icon source. Confirm the built product contains `Contents/Resources/Assets.car` and that the generated Info.plist contains `CFBundleIconName` with the same name.

## Verification

Build a real `.app`, then check:

```bash
test -f MyApp.app/Contents/Resources/Assets.car
plutil -p MyApp.app/Contents/Info.plist | grep -E 'CFBundleIcon(Name|File)'
xcrun assetutil --info MyApp.app/Contents/Resources/Assets.car > asset-info.json
```

Review the app in Finder, Dock, Spotlight, and the app switcher in both Light and Dark appearances. Clear or restart Dock/Finder caches only when the bundle is correct but an old icon persists.

`tauri dev` can launch a bare executable, so its Dock icon is not a reliable acceptance test for the bundled native icon.
