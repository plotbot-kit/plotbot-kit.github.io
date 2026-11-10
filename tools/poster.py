# Builds img/film-poster.webp and img/og.png from img/roboter.png (run from the site root)
from PIL import Image, ImageDraw
rob = Image.open("img/roboter.png").convert("RGBA")
def canvas(w, h, out, fmt):
    c = Image.new("RGBA", (w, h), (255, 246, 214, 255))
    r = rob.copy(); r.thumbnail((int(w*0.9), int(h*0.9)), Image.LANCZOS)
    c.alpha_composite(r, ((w-r.width)//2, (h-r.height)//2))
    c = c.convert("RGB")
    c.save(out, fmt, **({"quality": 85} if fmt != "PNG" else {"optimize": True}))
canvas(1280, 720, "img/film-poster.webp", "WEBP")
canvas(1200, 630, "img/og.png", "PNG")
