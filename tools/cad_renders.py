# Regenerates img/roboter*, img/elektronik* from the CAD renders in the zeichenroboter repo (run from the site root)
import sys
from PIL import Image
src = sys.argv[1].rstrip("/") + "/"   # path to cad/png in the robot repo
def key(name, out, crop=None, w=None):
    im = Image.open(src + name).convert("RGB")
    bg = im.getpixel((2, 2))
    px = im.load(); W, H = im.size
    a = Image.new("L", im.size)
    ap = a.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            d = abs(r-bg[0]) + abs(g-bg[1]) + abs(b-bg[2])
            ap[x, y] = 0 if d < 6 else (255 if d > 40 else int((d-6)*255/34))
    rgba = im.convert("RGBA"); rgba.putalpha(a)
    box = a.getbbox(); m = 12
    rgba = rgba.crop((max(box[0]-m,0), max(box[1]-m,0), min(box[2]+m,W), min(box[3]+m,H)))
    if w and rgba.width > w: rgba = rgba.resize((w, round(rgba.height*w/rgba.width)), Image.LANCZOS)
    rgba.save("img/" + out + ".webp", "WEBP", quality=88, method=6)   # fresh file: no EXIF/metadata
    rgba.save("img/" + out + ".png", optimize=True)
    print(out, rgba.size, bg)
key("baugruppe.png", "roboter", w=900)
key("baugruppe_vorne_links.png", "roboter-vorne", w=900)
key("elektroniktraeger_bestueckt.png", "elektronik", w=800)

