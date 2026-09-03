---
name: build-icon
description: Prepare source artwork and build, validate, preview, and integrate Apple application icons. Use when a user supplies PNG, JPEG, SVG, PDF, layered artwork, or an existing .icon package and asks to split or reconstruct layers, assemble an Icon Composer .icon package, create Default/Dark/Tinted appearances, compile a native macOS Assets.car with system masking and specular highlights, validate icon assets, or integrate an app icon into Xcode, Tauri, or Expo.
---

# Build Icon

Prepare existing artwork for Apple platforms. Preserve the supplied design; do not invent alternative concepts unless explicitly requested.

## Workflow

1. Inspect the input before changing it.
2. Determine target platforms.
3. Prepare and confirm layers when the source is flat or ambiguous.
4. Create a manifest and build the package.
5. Validate the package and render every supported preview.
6. For macOS, compile and integrate the native asset catalog plus an `.icns` fallback.
7. Return editable layers, the package, compiled artifacts, previews, and a validation summary.

## Inspect the input

Run:

```bash
node scripts/inspect-source.mjs <source...>
```

Classify each source:

- Separate SVG/PNG files: treat as explicit layers and confirm front-to-back order.
- Structured SVG: preserve paths, groups, masks, gradients, and blend modes; propose semantic groups without changing appearance.
- SVG containing only an embedded raster image: treat as raster.
- Flat PNG/JPEG: reconstruct layers; never claim to recover the original hidden pixels.
- Existing `.icon`: validate and render it before proposing changes.

Do not force vectorization. Prefer SVG for crisp geometric artwork. Preserve illustration, texture, mesh gradients, and photographic detail as lossless PNG. For mixed art, combine SVG and PNG layers.

Read [references/source-preparation.md](references/source-preparation.md) before splitting a flat source or restructuring SVG.

## Determine platforms

Infer platforms from an attached Xcode or Expo project when possible, then state the inference for confirmation. If only artwork is supplied and the user did not specify platforms, ask one concise question listing:

- iPhone/iPad
- Mac
- Apple Watch
- Apple TV
- Apple Vision Pro

Use `.icon` for iPhone, iPad, Mac, and Apple Watch. Treat tvOS and visionOS as separate asset-catalog/image-stack workflows; do not falsely package them into the same `.icon` path. Read [references/apple-platforms.md](references/apple-platforms.md) for platform rules.

## Prepare flat artwork

For PNG/JPEG, distinguish segmentation from vectorization:

1. Isolate background, principal symbol, and meaningful foreground elements.
2. Reconstruct only the pixels hidden by extracted objects.
3. Export raster layers as full-canvas transparent PNG files so alignment is stable.
4. Show every layer on a checkerboard plus a recomposed preview.
5. Mark reconstructed areas and obtain approval before package assembly.

Use image editing tools for visual separation. Use deterministic scripts only for inspection, packaging, and validation. Vectorize only when the artwork is geometrically suitable or the user requests editable paths.

## Build `.icon`

Copy [assets/manifest.example.json](assets/manifest.example.json) beside the prepared artwork and edit it. List artwork from front to back. Then run:

```bash
node scripts/build-icon.mjs manifest.json --output <directory>
```

The builder accepts SVG and PNG layers, creates appearance specializations, copies assets, and writes `<name>.icon/icon.json`. A dark layer is optional; when absent, the default artwork is reused in Dark. A tinted layer is optional; when absent, the default artwork receives automatic system fill.

Do not paint gloss, edge highlights, masks, or rounded corners into the source. Keep the artwork layered. On current macOS, the compiled icon stack lets the system apply masking, material, depth, and specular highlights. Use dedicated `dark` artwork only when the symbol or background must change for Dark appearance.

## Validate

Run:

```bash
node scripts/validate-icon.mjs <path/to/AppIcon.icon>
```

Treat structural failures as errors. Treat missing dedicated Dark art, raster dimensions below the target canvas, embedded raster content in SVG, and unsupported platform requests as warnings requiring explicit review.

## Render previews

Run:

```bash
scripts/render-previews.sh <path/to/AppIcon.icon> <output-directory> [platform...]
```

Render all renditions supported by the installed `ictool`, not merely a single default preview. Preserve the Xcode version and command results in `render-report.txt`.

Apple changes private or lightly documented `ictool` arguments between Xcode releases. If capability probing reports that `--export-image` is unavailable, do not pretend rendering succeeded. Report the incompatible Xcode version and use Icon Composer/Xcode interactively for visual verification until the script gains a tested adapter for that version.

## Compile native macOS assets

For a macOS target and Xcode 26 or newer, run:

```bash
scripts/compile-macos-native.sh <path/to/AppIcon.icon> <output-directory> \
  [--name AppIcon] [--minimum-deployment-target 13.0]
```

The script compiles the `.icon` through `actool` and outputs:

- `Assets.car`: native icon stack with appearance renditions and system effects;
- `<name>.icns`: fallback for older macOS and tools that do not read the icon stack;
- `partial-info.plist`: generated icon metadata;
- `asset-info.json` and `compile-report.txt`: validation evidence.

Treat `Assets.car` as required for native current-macOS presentation. An `.icns` alone cannot provide Icon Composer's dynamic system material or specular highlights. Keep `.icns` as fallback rather than replacing it.

Read [references/macos-native.md](references/macos-native.md) before integrating the compiled output into Tauri or Xcode. Verify a bundled `.app`; `tauri dev` may run a bare executable and is not sufficient evidence for Finder/Dock appearance.

## Completion criteria

Do not call the work complete until:

- target platforms are known;
- layer order and any reconstructed pixels are approved;
- `icon.json` and every referenced asset validate;
- every preview supported by the installed tool renders successfully, or the exact tool incompatibility is reported;
- macOS targets contain `Assets.car`, an `.icns` fallback, and icon metadata in the final `.app`;
- Default and Dark appearances have been reviewed, and Tinted has been reviewed when the target OS exposes it;
- system masking and highlights come from the compiled native icon stack, not baked source effects;
- outputs and remaining visual-review risks are listed.
