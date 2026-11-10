# Draws img/blume|stern|spirale|haus.svg (run from the site root)
import math, sys
# Re-implements the demo programs from firmware/web/programme.js (start in field centre, heading 90 = up, "drehe" = right turn)
class T:
    def __init__(s, cx=40, cy=40):
        s.x, s.y, s.r, s.down = cx, cy, 90.0, True
        s.lines, s.cur = [], [(cx, cy)]
    def _brk(s):
        if len(s.cur) > 1: s.lines.append(s.cur)
        s.cur = [(s.x, s.y)]
    def vor(s, d):
        a = math.radians(s.r); s.x += d*math.cos(a); s.y += d*math.sin(a)
        (s.cur.append((s.x, s.y)) if s.down else None)
        if not s.down: s.cur = [(s.x, s.y)]
    def drehe(s, w): s.r = (s.r - w) % 360
    def auf(s): s._brk(); s.down = False
    def ab(s): s.down = True; s.cur = [(s.x, s.y)]
    def zu(s, x, y):
        s.x, s.y = x, y
        if s.down: s.cur.append((x, y))
        else: s.cur = [(x, y)]
    def svg(s, name, colour, sw=1.1):
        s._brk(); pts = [p for l in s.lines for p in l]
        x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
        y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
        m = 4; w = x1-x0+2*m; h = y1-y0+2*m
        paths = "".join('<path d="M%s"/>' % " L".join("%.2f %.2f" % (x-x0+m, (y1-y)+m) for x, y in l) for l in s.lines)
        open(f"img/{name}.svg", "w").write(
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" role="img"><g fill="none" stroke="{colour}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{paths}</g></svg>\n')
def rep(n, f):
    for _ in range(n): f()
t = T(); rep(8, lambda: (rep(2, lambda: (rep(18, lambda: (t.vor(1.6), t.drehe(5))), t.drehe(90))), t.drehe(45))); t.svg("blume", "#d6336c")
t = T(); t.auf(); t.zu(15, 45); t.ab(); t.drehe(90); rep(5, lambda: (t.vor(50), t.drehe(144))); t.svg("stern", "#e67700")
t = T(); i = 2
while i <= 60: t.vor(i); t.drehe(90); i += 2
t.svg("spirale", "#1971c2", 0.9)
t = T(); t.auf(); t.zu(25, 15); t.ab(); rep(4, lambda: (t.vor(30), t.drehe(90))); t.zu(25, 45); t.zu(40, 62); t.zu(55, 45)
t.auf(); t.zu(36, 15); t.ab(); t.zu(36, 28); t.zu(44, 28); t.zu(44, 15); t.svg("haus", "#2f9e44")
