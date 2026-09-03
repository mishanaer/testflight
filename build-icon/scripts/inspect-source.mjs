#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function pngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  return null;
}

function inspectSvg(text) {
  const svgTag = text.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const attr = (name) => svgTag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;
  return {
    width: attr("width"),
    height: attr("height"),
    viewBox: attr("viewBox"),
    groups: (text.match(/<g\b/gi) ?? []).length,
    paths: (text.match(/<path\b/gi) ?? []).length,
    images: (text.match(/<image\b/gi) ?? []).length,
    masks: (text.match(/<mask\b/gi) ?? []).length,
    clipPaths: (text.match(/<clipPath\b/gi) ?? []).length,
    textNodes: (text.match(/<text\b/gi) ?? []).length,
  };
}

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error("Usage: inspect-source.mjs <source...>");
  process.exit(2);
}

let failed = false;
const results = inputs.map((input) => {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    failed = true;
    return { path: resolved, error: "File does not exist" };
  }
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const isIcon = resolved.endsWith(".icon") && fs.existsSync(path.join(resolved, "icon.json"));
    return { path: resolved, type: isIcon ? "icon-package" : "directory", bytes: stat.size };
  }
  const extension = path.extname(resolved).toLowerCase();
  const buffer = fs.readFileSync(resolved);
  if (extension === ".svg") {
    const svg = inspectSvg(buffer.toString("utf8"));
    return { path: resolved, type: svg.images && !svg.paths ? "svg-with-raster" : "svg", bytes: stat.size, ...svg };
  }
  if (extension === ".png") return { path: resolved, type: "png", bytes: stat.size, ...pngSize(buffer) };
  if ([".jpg", ".jpeg"].includes(extension)) return { path: resolved, type: "jpeg", bytes: stat.size, ...jpegSize(buffer) };
  if (extension === ".pdf") return { path: resolved, type: "pdf", bytes: stat.size };
  return { path: resolved, type: extension.slice(1) || "unknown", bytes: stat.size };
});

console.log(JSON.stringify(results, null, 2));
if (failed) process.exitCode = 1;
