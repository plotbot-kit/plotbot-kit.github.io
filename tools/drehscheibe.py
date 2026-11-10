"""Builds the turntable frames img/drehscheibe/00.webp ... 35.webp from 36 pre-rendered views (run from the site root).

Usage: python3 -I tools/drehscheibe.py <source-dir> [<out-dir>]   (out-dir defaults to img/drehscheibe)

Assumptions about the source:
- It holds exactly 36 images (PNG/WebP/JPEG), one every 10 degrees, all the same size.
- Files sort "naturally" into rotation order (frame2 before frame10), and the first file is 0 degrees,
  i.e. the view closest to the static hero image img/roboter.png. Rotation direction follows the file order.
- Renders with alpha are only trimmed; opaque renders get their flat background (pixel 2,2) keyed out.

All frames are cropped with ONE common bounding box (union over all frames), so the robot does not jump,
then scaled to WIDTH px. The static hero image img/roboter.{png,webp} (HERO_W px wide) is cut from frame 0
with the same box, so the first swap from the static image to a frame shows no jump. Run this after
tools/cad_renders.py, which would otherwise overwrite img/roboter.*. Update width/height of the hero <img>
in de/ and en/index.html to the printed hero size. Fresh files carry no EXIF/XMP metadata.
"""
import os
import re
import sys
from PIL import Image

WIDTH, HERO_W, MARGIN, FRAMES = 600, 800, 12, 36
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
    """Union of all alpha bounding boxes plus margin."""
    boxes = [f.getchannel("A").getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    l, t = min(b[0] for b in boxes) - MARGIN, min(b[1] for b in boxes) - MARGIN
    r, b = max(b[2] for b in boxes) + MARGIN, max(b[3] for b in boxes) + MARGIN
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
    bw, bh = box[2] - box[0], box[3] - box[1]
    size = (WIDTH, round(WIDTH * bh / bw))
    os.makedirs(out, exist_ok=True)
    total = 0
    for i, (n, f) in enumerate(zip(names, frames)):
        path = os.path.join(out, f"{i:02d}.webp")
        f.crop(box).resize(size, Image.LANCZOS).save(path, "WEBP", quality=75, alpha_quality=80, method=6)
        total += os.path.getsize(path)
        print(f"{n} -> {path}")
    print(f"box {box}, frame size {size}, total {total / 1024:.0f} KiB")
    hero = frames[0].crop(box).resize((HERO_W, round(HERO_W * bh / bw)), Image.LANCZOS)
    hero.save("img/roboter.png", optimize=True)
    hero.save("img/roboter.webp", "WEBP", quality=82, alpha_quality=90, method=6)
    print(f"hero img/roboter.png + .webp, size {hero.size}")


if __name__ == "__main__":
    main()
