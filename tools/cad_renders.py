# Regenerates img/roboter-vorne*, img/elektronik* from the renders in the robot repo (run from the site root).
# Usage: python3 -I tools/cad_renders.py <dir with baugruppe_vorne_links.png, elektroniktraeger_bestueckt.png>
# The hero image img/roboter* comes from tools/drehscheibe.py (cut from turntable frame 0), not from here.
# Renders with an alpha channel (Three.js) are only trimmed and scaled; opaque renders (old OpenSCAD preview) get their background keyed out.
import sys
from PIL import Image

src = sys.argv[1].rstrip("/") + "/"


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


def render(name, out, w):
    im = Image.open(src + name)
    rgba = im.convert("RGBA"); rgba.putalpha(alpha_of(im))
    box = rgba.getchannel("A").getbbox(); m = 12
    rgba = rgba.crop((max(box[0] - m, 0), max(box[1] - m, 0), min(box[2] + m, rgba.width), min(box[3] + m, rgba.height)))
    if rgba.width > w:
        rgba = rgba.resize((w, round(rgba.height * w / rgba.width)), Image.LANCZOS)
    rgba.save("img/" + out + ".webp", "WEBP", quality=88, method=6)   # fresh files: no EXIF/metadata
    rgba.save("img/" + out + ".png", optimize=True)
    print(out, rgba.size)


render("baugruppe_vorne_links.png", "roboter-vorne", 800)
render("elektroniktraeger_bestueckt.png", "elektronik", 1000)
