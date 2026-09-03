#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const iconArg = process.argv[2];
if (!iconArg) {
  console.error("Usage: validate-icon.mjs <AppIcon.icon>");
  process.exit(2);
}

const iconRoot = path.resolve(iconArg);
const jsonPath = path.join(iconRoot, "icon.json");
const assetsRoot = path.join(iconRoot, "Assets");
const errors = [];
const warnings = [];

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
if (!iconRoot.endsWith(".icon")) warnings.push("Package directory does not end in .icon");
if (!fs.existsSync(jsonPath)) errors.push("Missing icon.json");
if (!fs.existsSync(assetsRoot)) errors.push("Missing Assets directory");

let document;
if (!errors.length) {
  try { document = JSON.parse(fs.readFileSync(jsonPath, "utf8")); }
  catch (error) { errors.push(`Invalid icon.json: ${error.message}`); }
}

if (document) {
  if (!Array.isArray(document.groups) || !document.groups.length) errors.push("icon.json has no groups");
  const targetsWatch = document["supported-platforms"]?.circles?.includes("watchOS");
  const minimumRasterSize = targetsWatch ? 1088 : 1024;
  const names = new Set();
  for (const group of document.groups ?? []) {
    if (!Array.isArray(group.layers) || !group.layers.length) errors.push(`Group ${group.name ?? "<unnamed>"} has no layers`);
    const hasDark = (group.layers ?? []).some((layer) =>
      (layer["opacity-specializations"] ?? []).some((item) => item.appearance === "dark" && item.value > 0));
    if (!hasDark && group.name !== "Background") warnings.push(`Group has no dedicated Dark artwork: ${group.name ?? "<unnamed>"}`);
    for (const layer of group.layers ?? []) {
      const name = layer["image-name"];
      if (!name) { errors.push(`Layer ${layer.name ?? "<unnamed>"} has no image-name`); continue; }
      names.add(name);
      const assetPath = path.join(assetsRoot, name);
      if (!fs.existsSync(assetPath)) { errors.push(`Missing asset: ${name}`); continue; }
      if (path.extname(name).toLowerCase() === ".svg") {
        const svg = fs.readFileSync(assetPath, "utf8");
        if (!/<svg\b/i.test(svg)) errors.push(`Invalid SVG root: ${name}`);
        if (/<image\b/i.test(svg)) warnings.push(`SVG contains embedded raster image: ${name}`);
        if (/<text\b/i.test(svg)) warnings.push(`SVG contains live text: ${name}`);
      }
      if (path.extname(name).toLowerCase() === ".png") {
        const size = pngSize(fs.readFileSync(assetPath));
        if (!size) errors.push(`Invalid PNG header: ${name}`);
        else if (size.width < minimumRasterSize || size.height < minimumRasterSize) {
          warnings.push(`Raster asset ${name} is ${size.width}×${size.height}; target canvas is at least ${minimumRasterSize}×${minimumRasterSize}`);
        }
      }
    }
  }
  const files = fs.existsSync(assetsRoot) ? fs.readdirSync(assetsRoot).filter((name) => !name.startsWith(".")) : [];
  for (const file of files) if (!names.has(file)) warnings.push(`Unreferenced asset: ${file}`);
  if (!document["supported-platforms"]) errors.push("Missing supported-platforms");
}

console.log(JSON.stringify({ icon: iconRoot, valid: errors.length === 0, errors, warnings }, null, 2));
if (errors.length) process.exitCode = 1;
