// PWA 用アイコン生成: public の SVG から PNG を作る。
//
// iOS の A2HS や一部の旧 Android は SVG マスクアブルを installable と認めず
// ラスタ PNG（192/512）を要求するため、SVG から PNG を生成しておく。
//
// 実行: node scripts/generate-icons.mjs
//   要 sharp（npm i -D sharp）。アイコンを変えたら public の SVG を編集してから再実行する。
//
// 生成物（public/ 直下）:
//   icon-192.png / icon-512.png            … purpose=any（全面塗りの icon.svg 由来。角丸は OS に任せる #472）
//   icon-maskable-192.png / -512.png       … purpose=maskable（全面塗りの icon-maskable.svg 由来）
//   apple-touch-icon.png（180）            … iOS A2HS 用（OS がマスクするので全面塗り由来）

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const anySvg = readFileSync(join(pub, "icon.svg"));
const maskableSvg = readFileSync(join(pub, "icon-maskable.svg"));

const jobs = [
  [anySvg, "icon-192.png", 192],
  [anySvg, "icon-512.png", 512],
  [maskableSvg, "icon-maskable-192.png", 192],
  [maskableSvg, "icon-maskable-512.png", 512],
  [maskableSvg, "apple-touch-icon.png", 180],
];

for (const [svg, name, size] of jobs) {
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(pub, name));
  console.log("wrote", name, `${size}x${size}`);
}
