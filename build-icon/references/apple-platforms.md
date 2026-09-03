# Apple platform routing

Apple's current app-icon guidance distinguishes two packaging families.

## Icon Composer `.icon`

Use one layered `.icon` document for:

- iOS and iPadOS: square 1024×1024 layout with system masking.
- macOS: square 1024×1024 layout with system masking.
- watchOS: square 1088×1088 layout with circular system masking.

Icon Composer provides Default, Dark, and monochrome/tinted appearance controls. Exact command-line rendition names depend on the installed Xcode version and must be tested rather than assumed.

For macOS distribution, compile the `.icon` with Xcode 26 or newer into `Assets.car` and keep the generated `.icns` fallback. The native catalog enables system masking, materials, and specular highlights; a standalone `.icns` does not. See [macos-native.md](macos-native.md).

## Asset catalog image stacks

Route these separately:

- tvOS: 800×480 rectangular layered/parallax icon.
- visionOS: 1024×1024 circularly masked 3D layered icon.

Do not pre-mask source layers. Keep primary content centered and allow the system to apply platform shape and effects.

## Primary sources

- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Icon Composer: https://developer.apple.com/icon-composer/
- Xcode workflow: https://developer.apple.com/documentation/Xcode/creating-your-app-icon-using-icon-composer
