#!/usr/bin/env python3
"""季節背景（#231 後段①）の生 PNG を背景用にぼかし処理する。

立夏マスターと同じ処理＝中程度のガウスぼかし＋わずかに暗く＋downscale＋webp。
部屋・季節は分かるが文字とは競合しない、暗い夜の collector 部屋の地になる。

使い方:
  uv run python3 scripts/season-bg-blur.py public/weather/season-geshi-raw.png public/weather/season-geshi.webp
"""

import sys

from PIL import Image, ImageEnhance, ImageFilter


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: season-bg-blur.py <src.png> <dst.webp>")
    src, dst = sys.argv[1], sys.argv[2]
    img = Image.open(src).convert("RGB")
    w, h = img.size
    small = img.resize((1200, round(1200 * h / w)), Image.LANCZOS)
    blur = small.filter(ImageFilter.GaussianBlur(7))
    blur = ImageEnhance.Brightness(blur).enhance(0.9)
    blur.save(dst, "WEBP", quality=82)
    print(f"wrote {dst} ({blur.size[0]}x{blur.size[1]})")


if __name__ == "__main__":
    main()
