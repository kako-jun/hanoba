// PWA 用アイコン生成: public の icon.svg から PNG を作る。
//
// manifest（astro.config.mjs）には purpose:"any" の PNG（192/512）だけを載せる。
// SVG や maskable を manifest に持たせると Android スプラッシュで板／マスクの枠が出るため
// 外した（#513/#514）。生成元は icon.svg 1本に統一し、全て全面塗り由来にする。
//
// 実行: node scripts/generate-icons.mjs
//   要 sharp（npm i -D sharp）。アイコンを変えたら public/icon.svg を編集してから再実行する。
//
// 生成物（public/ 直下）: ファイル名に -v3 サフィックス。アイコンの中身を変えても URL が同じだと
//   Android の WebAPK が焼き直されず古いスプラッシュが残るため、中身を更新したら必ず URL も上げる
//   （-v3 → -v4 …）。manifest（astro.config.mjs）と <head>（MainLayout.astro）の参照も同時に上げる（#478）。
//   icon-192-v3.png / icon-512-v3.png … purpose=any（icon.svg 由来。角丸は OS に任せる）
//   apple-touch-icon-v3.png（180）    … iOS A2HS 用（icon.svg 由来。OS がマスクする）

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const anySvg = readFileSync(join(pub, "icon.svg"));

const jobs = [
  [anySvg, "icon-192-v3.png", 192],
  [anySvg, "icon-512-v3.png", 512],
  [anySvg, "apple-touch-icon-v3.png", 180],
];

for (const [svg, name, size] of jobs) {
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(pub, name));
  console.log("wrote", name, `${size}x${size}`);
}
