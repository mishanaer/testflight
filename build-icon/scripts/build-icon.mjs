#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`build-icon: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const manifest = argv[0];
  const outputIndex = argv.indexOf("--output");
  return { manifest, output: outputIndex >= 0 ? argv[outputIndex + 1] : process.cwd() };
}

function safeName(value) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
}

function srgb(hex) {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) fail(`Invalid color ${hex}; use #RRGGBB or #RRGGBBAA`);
  const raw = match[1];
  const alpha = match[2] ?? "ff";
  const values = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16) / 255);
  values.push(parseInt(alpha, 16) / 255);
  return `extended-srgb:${values.map((value) => value.toFixed(5)).join(",")}`;
}

function opacity(appearance, includeDark) {
  if (appearance === "default") {
    const result = [{ value: 1 }];
    if (includeDark) result.push({ appearance: "dark", value: 0 });
    result.push({ appearance: "tinted", value: 0 });
    return result;
  }
  if (appearance === "dark") return [{ value: 0 }, { appearance: "dark", value: 1 }, { appearance: "tinted", value: 0 }];
  return [{ value: 0 }, { appearance: "tinted", value: 1 }];
}

const { manifest: manifestArg, output: outputArg } = parseArgs(process.argv.slice(2));
if (!manifestArg) fail("Usage: build-icon.mjs <manifest.json> --output <directory>");
const manifestPath = path.resolve(manifestArg);
if (!fs.existsSync(manifestPath)) fail(`Manifest does not exist: ${manifestPath}`);

let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
catch (error) { fail(`Cannot parse manifest: ${error.message}`); }

if (!manifest.name || !Array.isArray(manifest.layers) || !manifest.layers.length) fail("Manifest requires name and at least one layer");
const supported = new Set(["ios", "ipados", "macos", "watchos"]);
const platforms = manifest.platforms ?? ["ios"];
const unsupported = platforms.filter((item) => !supported.has(item));
if (unsupported.length) fail(`Unsupported .icon platforms: ${unsupported.join(", ")}. Route tvOS and visionOS through asset catalogs.`);

const manifestRoot = path.dirname(manifestPath);
const iconRoot = path.join(path.resolve(outputArg), `${safeName(manifest.name)}.icon`);
const assetsRoot = path.join(iconRoot, "Assets");
fs.mkdirSync(assetsRoot, { recursive: true });

let assetCounter = 0;
function copyAsset(relativePath, label) {
  const source = path.resolve(manifestRoot, relativePath);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) fail(`Missing ${label}: ${source}`);
  const extension = path.extname(source).toLowerCase();
  if (![".svg", ".png"].includes(extension)) fail(`${label} must be SVG or PNG: ${source}`);
  assetCounter += 1;
  const destinationName = `${String(assetCounter).padStart(2, "0")}-${safeName(path.basename(source, extension))}${extension}`;
  fs.copyFileSync(source, path.join(assetsRoot, destinationName));
  return destinationName;
}

function buildGroup(layer) {
  if (!layer.name || !layer.default) fail("Every layer requires name and default asset");
  const hasDark = Boolean(layer.dark);
  const defaultName = copyAsset(layer.default, `${layer.name}.default`);
  const layers = [{
    glass: Boolean(layer.glass), hidden: false, "image-name": defaultName,
    name: `${layer.name} · Default`, "opacity-specializations": opacity("default", hasDark),
  }];
  if (hasDark) {
    const darkName = copyAsset(layer.dark, `${layer.name}.dark`);
    layers.push({ glass: Boolean(layer.glass), hidden: false, "image-name": darkName,
      name: `${layer.name} · Dark`, "opacity-specializations": opacity("dark", true) });
  }
  const tintedName = layer.tinted ? copyAsset(layer.tinted, `${layer.name}.tinted`) : defaultName;
  layers.push({
    "blend-mode-specializations": [{ value: "normal" }, { appearance: "tinted", value: "screen" }],
    fill: "automatic", glass: Boolean(layer.glass), hidden: false, "image-name": tintedName,
    name: `${layer.name} · Tinted`, "opacity-specializations": opacity("tinted", hasDark),
  });
  const group = { hidden: false, layers, name: layer.name,
    translucency: { enabled: Boolean(layer.translucency), value: Number(layer.translucency ?? 0.2) } };
  if (layer.shadowOpacity !== undefined) group.shadow = { kind: "neutral", opacity: Number(layer.shadowOpacity) };
  return group;
}

const groups = manifest.layers.map(buildGroup);
const darkBackground = manifest.background?.dark;
if (darkBackground) {
  const darkSvgName = "00-dark-background.svg";
  fs.writeFileSync(path.join(assetsRoot, darkSvgName), `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="${darkBackground}"/></svg>\n`);
  groups.push({ hidden: false, name: "Background", translucency: { enabled: false, value: 0 }, layers: [{
    glass: false, hidden: false, "image-name": darkSvgName, name: "Background · Dark",
    "opacity-specializations": opacity("dark", true),
  }] });
}

const squares = platforms.some((item) => item !== "watchos");
const circles = platforms.includes("watchos");
const document = {
  features: ["refractivity"],
  fill: { solid: srgb(manifest.background?.default ?? "#FFFFFF") },
  groups,
  "supported-platforms": {
    ...(circles ? { circles: ["watchOS"] } : {}),
    ...(squares ? { squares: "shared" } : {}),
  },
};

fs.writeFileSync(path.join(iconRoot, "icon.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ icon: iconRoot, assets: assetCounter + (darkBackground ? 1 : 0), platforms }, null, 2));
