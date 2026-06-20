#!/usr/bin/env python3
"""雨の水滴素材（#231 段階2）を黒地→透明の透過 PNG/WebP にする。

codex（gpt-image-2）には「純黒地に水滴のフチの光だけ」を描かせてある（中央は黒＝透明＝
奥の暗い部屋が透ける＝透明感）。これを alpha = 輝度に変換すると、暖色 glint と楕円のフチを
保ったまま前面に重ねられる透過素材になる（gpt-image-1.5 不要・section 5 の輝度キー）。

既定値は本番素材（rain-glass.webp / rain-glass-heavy.webp）を再現する値。フラグ無しで実行すれば
コミット済みの透過素材と同じ変換になる。

オプション（alpha=輝度 にかける後処理）:
  --gamma G   alpha に G 乗のカーブ。**G<1 で中明度（水滴の細いフチ）を持ち上げ**、強い glint との
              差を詰めて「楕円の輪」を残す（既定 0.5）。逆に G>1 は薄い点を沈めて密度を抑える向き。
  --floor F   輝度 F 未満（0-255）は完全透明に切り捨て（微小ノイズ除去。既定 2）
  --resize N  先に N×N へ縮小（既定 1254＝原寸維持。細フチがサブピクセルで消えないよう下げすぎない）
  --dilate D  alpha を MaxFilter で D px 膨張＝細フチを太らせ小スケールで消えないようにする（既定 1）

使い方（フラグ無しで本番素材を再現）:
  uv run python3 scripts/weather-droplet-alpha.py public/weather/rain-glass-raw.png public/weather/rain-glass-rgba.png
"""

import argparse

from PIL import Image, ImageFilter


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    # 既定は本番素材を再現する値（gamma<1 でフチを持ち上げ・floor 微小ノイズ除去・原寸維持・1px 太らせ）。
    ap.add_argument("--gamma", type=float, default=0.5)
    ap.add_argument("--floor", type=int, default=2)
    ap.add_argument("--resize", type=int, default=1254)
    # 細い水滴のフチ（一周する白線）が小スケールでサブピクセル化して消えるのを防ぐため、
    # alpha を MaxFilter で太らせる（kako-jun: ふちはもっと）。0 で無効。
    ap.add_argument("--dilate", type=int, default=1)
    args = ap.parse_args()

    img = Image.open(args.src).convert("RGB")
    if args.resize:
        img = img.resize((args.resize, args.resize), Image.LANCZOS)

    # 輝度 = alpha の素。黒地は透明、明るいフチ・glint ほど不透明。
    lum = img.convert("L")
    gamma = args.gamma
    floor = args.floor

    def curve(v: int) -> int:
        if v < floor:
            return 0  # 微小ノイズは完全透明（密度を抑える）
        return int(round(255 * (v / 255) ** gamma))

    alpha = lum.point(curve)
    if args.dilate > 0:
        # MaxFilter で明るい alpha を膨張＝細フチを太らせる（奇数カーネル）。
        alpha = alpha.filter(ImageFilter.MaxFilter(2 * args.dilate + 1))
    rgba = img.copy()
    rgba.putalpha(alpha)
    rgba.save(args.dst, "PNG")
    print(
        f"wrote {args.dst} ({rgba.size[0]}x{rgba.size[1]}, RGBA, "
        f"gamma={gamma}, floor={floor}, dilate={args.dilate})"
    )


if __name__ == "__main__":
    main()
