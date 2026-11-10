"""Builds the turntable frames img/drehscheibe/00.webp ... 35.webp from 36 pre-rendered views (run from the site root).

Usage: python3 -I tools/drehscheibe.py <source-dir> [<out-dir>]   (out-dir defaults to img/drehscheibe)

Assumptions about the source:
- It holds exactly 36 images (PNG/WebP/JPEG), one every 10 degrees, all the same size.
- Files sort "naturally" into rotation order (frame2 before frame10), and the first file is 0 degrees,
  i.e. the view closest to the static hero image img/roboter.png. Rotation direction follows the file order.
- Renders with alpha are only trimmed; opaque renders get their flat background (pixel 2,2) keyed out.

All frames are cropped with ONE common bounding box (union over all frames), so the robot does not jump.
The box is padded to the aspect of the hero image (800 x 1021), so frames and static image line up,
then scaled to WIDTH px. Fresh WebP files carry no EXIF/XMP metadata.
"""
import os
import re
import sys
from PIL import Image

WIDTH, HERO_W, HERO_H, MARGIN, FRAMES = 600, 800, 1021, 12, 36
EXT = (".png", ".webp", ".jpg", ".jpeg")


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def alpha_of(im):
    """Alpha channel of the render; for opaque images, key out the flat background colour."""
    if im.mode in ("RGBA", "LA") or "transparency" in im.info:
        return im.convert("RGBA").getchannel("A")
    rgb = im.convert("RGB"); bg = rgb.getpixel((2, 2)); px = rgb.load()
    a = Image.new("L", rgb.size); ap = a.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            d = sum(abs(c - b) for c, b in zip(px[x, y], bg))
            ap[x, y] = 0 if d < 6 else (255 if d > 40 else int((d - 6) * 255 / 34))
    return a


def common_box(frames):
    """Union of all alpha bounding boxes plus margin, widened or heightened to the hero aspect."""
    boxes = [f.getchannel("A").getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    l, t = min(b[0] for b in boxes) - MARGIN, min(b[1] for b in boxes) - MARGIN
    r, b = max(b[2] for b in boxes) + MARGIN, max(b[3] for b in boxes) + MARGIN
    w, h = r - l, b - t
    if w / h < HERO_W / HERO_H:            # too narrow: add width on both sides
        extra = round(h * HERO_W / HERO_H) - w; l -= extra // 2; r += extra - extra // 2
    else:                                   # too wide: add height on both sides
        extra = round(w * HERO_H / HERO_W) - h; t -= extra // 2; b += extra - extra // 2
    return l, t, r, b                       # may reach outside the frame: crop pads with transparency


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "img/drehscheibe"
    names = sorted((n for n in os.listdir(src) if n.lower().endswith(EXT)), key=natural_key)
    if len(names) != FRAMES:
        sys.exit(f"expected {FRAMES} frames in {src}, found {len(names)}")
    frames = []
    for n in names:
        im = Image.open(os.path.join(src, n))
        rgba = im.convert("RGBA"); rgba.putalpha(alpha_of(im)); frames.append(rgba)
    box = common_box(frames)
    size = (WIDTH, round(WIDTH * HERO_H / HERO_W))
    os.makedirs(out, exist_ok=True)
    total = 0
    for i, (n, f) in enumerate(zip(names, frames)):
        path = os.path.join(out, f"{i:02d}.webp")
        f.crop(box).resize(size, Image.LANCZOS).save(path, "WEBP", quality=75, alpha_quality=80, method=6)
        total += os.path.getsize(path)
        print(f"{n} -> {path}")
    print(f"box {box}, frame size {size}, total {total / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
