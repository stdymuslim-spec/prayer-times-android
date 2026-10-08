#!/usr/bin/env python3
"""Draws the widget picker preview pictures used by phones older than Android 12.

    python3 tools/make_widget_previews.py

Newer phones build their preview from res/layout/*_preview.xml instead. Needs Pillow and
macOS's Arial; change FONT_DIR to run it elsewhere.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
OUT = Path(__file__).resolve().parent.parent / "modules/prayer-widget/android/src/main/res/drawable-nodpi"
SS = 3  # supersampling
CARD = (16, 26, 21, 242)
WHITE = (255, 255, 255, 255)
SOFT = (221, 232, 225, 255)
TEAL = (111, 214, 176, 255)


def font(bold, size):
    return ImageFont.truetype(str(FONT_DIR / ("Arial Bold.ttf" if bold else "Arial.ttf")), size * SS)


def draw(width, height, rows):
    img = Image.new("RGBA", (width * SS, height * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, width * SS - 1, height * SS - 1], radius=36 * SS, fill=CARD)
    for text, x, y, size, bold, colour, anchor in rows:
        d.text((x * SS, y * SS), text, font=font(bold, size), fill=colour, anchor=anchor)
    return img.resize((width, height), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    left, right = 40, 920
    top = [
        ("Thu, 8 Oct 2026", left, 24, 44, True, SOFT, "la"),
        ("26 Rabiulakhir 1448H", left, 78, 34, False, TEAL, "la"),
        ("Subuh in 6h 48m", right, 40, 50, True, WHITE, "ra"),
    ]
    draw(960, 150, top).save(OUT / "prayer_widget_preview.png")
    events = top + [
        ("Israk Mikraj", left, 168, 38, True, WHITE, "la"),
        ("27 Rejab 1448H", left, 214, 30, False, TEAL, "la"),
        ("Wed 6 Jan · in 90 days", right, 190, 34, False, SOFT, "ra"),
        ("Nisfu Syaaban", left, 270, 38, True, WHITE, "la"),
        ("15 Syaaban 1448H", left, 316, 30, False, TEAL, "la"),
        ("Sun 24 Jan · in 108 days", right, 292, 34, False, SOFT, "ra"),
    ]
    draw(960, 370, events).save(OUT / "prayer_keydates_widget_preview.png")
    print("previews written to", OUT)


if __name__ == "__main__":
    main()
