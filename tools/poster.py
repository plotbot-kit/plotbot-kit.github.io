# Builds img/og.png from img/roboter.png (run from the site root).
# The film posters img/film-poster-de.webp and -en.webp are still frames from the films in media/ (local only):
#   ffmpeg -ss 19 -i media/verkaufsfilm-de.mp4 -frames:v 1 -vf scale=1280:720 -c:v libwebp -quality 80 img/film-poster-de.webp
from PIL import Image, ImageDraw
rob = Image.open("img/roboter.png").convert("RGBA")
def canvas(w, h, out, fmt):
    c = Image.new("RGBA", (w, h), (255, 246, 214, 255))
    r = rob.copy(); r.thumbnail((int(w*0.9), int(h*0.9)), Image.LANCZOS)
    c.alpha_composite(r, ((w-r.width)//2, (h-r.height)//2))
    c = c.convert("RGB")
    c.save(out, fmt, **({"quality": 85} if fmt != "PNG" else {"optimize": True}))
canvas(1200, 630, "img/og.png", "PNG")
