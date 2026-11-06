# 6 Nov 2026: the animated bars in the result email (lib/emailParts.ts animatedBill).
# Writes public/email/bars/bill.gif and best-30.gif ... best-100.gif (every 2%).
# Plays once, then holds the last frame. Transparent, so it sits on light or dark mail.
# Run: python3 scripts/make-email-bars.py
import os
from PIL import Image, ImageDraw

W, H, R = 520, 28, 14            # drawn at 2x; shown at 260 x 14
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "email", "bars")
BILL, BEST, GAP = (232, 89, 12), (21, 128, 61), (244, 177, 131)
os.makedirs(OUT, exist_ok=True)

def ease(t): return 1 - (1 - t) ** 3

def frame(parts):
    """parts: [(x0, x1, colour, round_left, round_right)] in pixels."""
    im = Image.new("P", (W, H), 0)
    im.putpalette([255, 255, 255] + list(BILL) + list(BEST) + list(GAP) + [0, 0, 0] * 252)
    d = ImageDraw.Draw(im)
    idx = {BILL: 1, BEST: 2, GAP: 3}
    for x0, x1, col, rl, rr in parts:
        if x1 - x0 < 2: continue
        c = idx[col]
        d.rounded_rectangle([x0, 0, x1 - 1, H - 1], radius=min(R, (x1 - x0) // 2), fill=c)
        if not rl: d.rectangle([x0, 0, min(x0 + R, x1 - 1), H - 1], fill=c)
        if not rr: d.rectangle([max(x0, x1 - 1 - R), 0, x1 - 1, H - 1], fill=c)
    return im

def save(name, frames, durs):
    frames[0].save(os.path.join(OUT, name), save_all=True, append_images=frames[1:], duration=durs,
                   transparency=0, disposal=2, optimize=False)

GROW = 16
# Your bill: the full width.
fr = [frame([(0, max(2, round(W * ease(i / GROW))), BILL, True, True)]) for i in range(1, GROW + 1)]
save("bill.gif", fr, [40] * (GROW - 1) + [60000])

# The cheapest plan: green to its share, then the gap (what you'd save) sweeps in.
for pct in range(30, 101, 2):
    g = round(W * pct / 100)
    fr, du = [frame([])] , [320]
    for i in range(1, GROW + 1):
        fr.append(frame([(0, max(2, round(g * ease(i / GROW))), BEST, True, True)])); du.append(40)
    if pct < 100:
        for i in range(1, 9):
            x = g + round((W - g) * ease(i / 8))
            fr.append(frame([(0, g, BEST, True, False), (g, x, GAP, False, True)])); du.append(45)
    du[-1] = 60000
    save(f"best-{pct}.gif", fr, du)
print("wrote", len(os.listdir(OUT)), "files to", os.path.normpath(OUT))
