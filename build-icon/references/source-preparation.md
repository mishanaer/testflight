# Source preparation

## Decision table

| Input | Default treatment | Approval needed |
| --- | --- | --- |
| Multiple named SVG/PNG files | Preserve as layers and confirm z-order | Only for ambiguous order |
| SVG with meaningful groups | Preserve vectors and normalize groups | Before merging or splitting groups |
| SVG with ungrouped paths | Cluster by visual object, paint order, clipping, and shared styling | Yes |
| SVG containing `<image>` | Treat embedded image as raster | Yes if reconstructing layers |
| Flat PNG/JPEG | Segment into full-canvas raster layers and reconstruct occluded pixels | Always |
| Existing `.icon` | Validate and render without rebuilding first | Only before corrective edits |

## Raster reconstruction rules

- Preserve the original dimensions and color profile when possible.
- Prefer lossless PNG for prepared layers.
- Keep every layer on the same full-size canvas with transparent unused pixels.
- Preserve a copy of the untouched source.
- Produce a recomposition diff against the source.
- Describe inferred or inpainted regions as reconstructed, never recovered.
- Do not vectorize texture, noise, mesh gradients, painted edges, or photographic content by default.

## SVG rules

- Preserve `viewBox` and aspect ratio.
- Preserve masks, clipping paths, gradients, opacity, and blend modes.
- Convert text to outlines only with user approval and a known correct font.
- Detect `<image>` elements and external references.
- Prefer semantic layer names such as `Symbol`, `Detail`, and `Background`.
- Keep Icon Composer ordering front-to-back.

## Review artifacts

Before assembly after reconstruction, show:

1. Untouched source.
2. Each isolated layer on a checkerboard.
3. Reconstructed background by itself.
4. Recomposed artwork.
5. Difference overlay or a concise description of deviations.
