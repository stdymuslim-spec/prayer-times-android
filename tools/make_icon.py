#!/usr/bin/env python3
"""Draws the app icon: a teal crescent moon on dark green-black.

    python3 tools/make_icon.py

Writes assets/icon.png, the Android adaptive-icon layers, and the splash image.
Needs Pillow (pip install pillow). Everything is drawn at 4x and scaled down so
the edges are smooth.
"""
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

TEAL = (34, 193, 175, 255)   # #22C1AF
DARK = (15, 21, 18, 255)     # #0F1512, the app's dark background
ASSETS = Path(__file__).resolve().parent.parent / "assets"
SS = 4  # supersampling


def crescent_mask(size, height_fraction, tilt_degrees=45):
    """A crescent as an 'L' mask, centred on the canvas, `height_fraction` of its height."""
    big = size * SS
    r_out = big * height_fraction / 2
    r_in = r_out * 0.80
    offset = r_out * 0.42
    # Cut the inner circle out towards the right, then tilt the shape so it opens up and to the right.
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    cx = cy = big / 2
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=255)
    cut = Image.new("L", (big, big), 0)
    ImageDraw.Draw(cut).ellipse(
        [cx + offset - r_in, cy - offset * 0.0 - r_in, cx + offset + r_in, cy + r_in], fill=255
    )
    mask = ImageChops.subtract(mask, cut)
    mask = mask.rotate(tilt_degrees, resample=Image.BICUBIC, center=(cx, cy))
    # Re-centre by the shape's own bounding box so it sits in the middle optically.
    box = mask.getbbox()
    shift_x = round(big / 2 - (box[0] + box[2]) / 2)
    shift_y = round(big / 2 - (box[1] + box[3]) / 2)
    moved = Image.new("L", (big, big), 0)
    moved.paste(mask, (shift_x, shift_y))
    return moved.resize((size, size), Image.LANCZOS)


def layer(size, colour, height_fraction, background=None):
    base = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    base.paste(Image.new("RGBA", (size, size), colour), (0, 0), crescent_mask(size, height_fraction))
    return base


def main():
    # Full icon (iOS-style, also used by Expo's own checks): moon on the dark background.
    layer(1024, TEAL, 0.62, DARK).save(ASSETS / "icon.png")
    # Android adaptive icon: the launcher crops to a circle or squircle, keeping the middle ~61%.
    layer(1024, TEAL, 0.50).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), DARK).save(ASSETS / "android-icon-background.png")
    # Themed (monochrome) icon: the system tints the opaque pixels.
    layer(1024, (255, 255, 255, 255), 0.50).save(ASSETS / "android-icon-monochrome.png")
    # Splash image.
    layer(512, TEAL, 0.62).save(ASSETS / "splash-icon.png")
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
