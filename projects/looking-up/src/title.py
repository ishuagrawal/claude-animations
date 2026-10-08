"""Title cards in the reference's style: heavy geometric sans, warm golden yellow, a painterly brushed fill and a soft
glow. Writes out/title/title.png (main title) and out/title/end.png (end card), 1920x1080 RGBA (letterbox-aware)."""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out", "title")
FONT = "/System/Library/Fonts/Supplemental/Futura.ttc"


def futura(size, index=None):
    # pick the boldest face in the collection (Futura Bold / Condensed ExtraBold)
    best = None
    for i in range(8):
        try:
            f = ImageFont.truetype(FONT, size, index=i)
        except Exception:
            break
        name = " ".join(f.getname())
        if "Bold" in name and "Condensed" not in name:
            return f
        if "ExtraBold" in name:
            best = f
    return best or ImageFont.truetype(FONT, size)


def card(text, size, y_center, path, tracking=0.08, sub=None):
    W, H = 1920, 1080
    font = futura(size)
    # layout with tracking
    widths = [font.getbbox(ch)[2] - font.getbbox(ch)[0] if ch != " " else size * 0.32 for ch in text]
    track = size * tracking
    total = sum(widths) + track * (len(text) - 1)
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    x = (W - total) / 2
    asc = font.getbbox("H")
    th = asc[3] - asc[1]
    y = y_center - th / 2 - asc[1]
    for ch, w in zip(text, widths):
        if ch != " ":
            bb = font.getbbox(ch)
            d.text((x - bb[0], y), ch, font=font, fill=255)
        x += w + track
    m = np.asarray(mask).astype(np.float32) / 255.0
    # painterly fill: golden yellow with brushed value variation and a warmer lower half
    rng = np.random.default_rng(3)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    streaks = np.sin(xx * 0.045 + np.sin(yy * 0.03) * 2.0) * 0.5 + np.sin(xx * 0.11 + yy * 0.07) * 0.25
    noise = np.asarray(Image.fromarray((rng.random((H // 8, W // 8)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)) / 255.0
    v = 1.0 + 0.06 * streaks + 0.08 * (noise - 0.5)
    grad = np.clip((yy - (y_center - th / 2)) / max(th, 1), 0, 1)
    base = np.array([1.0, 0.80, 0.22])
    low = np.array([0.98, 0.62, 0.12])
    col = (base[None, None, :] * (1 - grad[..., None]) + low[None, None, :] * grad[..., None]) * v[..., None]
    # rough brushed edge
    edge_noise = np.asarray(Image.fromarray((rng.random((H // 3, W // 3)) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)) / 255.0
    m2 = np.clip((np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255.0
                  - 0.5 + (edge_noise - 0.5) * 0.25) * 3.0 + 0.5, 0, 1)
    # glow + soft dark shadow for legibility
    glow = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size * 0.18))) / 255.0
    shadow = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size * 0.06))) / 255.0
    rgb = np.zeros((H, W, 3), np.float32)
    a = np.zeros((H, W), np.float32)
    # shadow (offset down a little)
    sh = np.roll(shadow, int(size * 0.04), axis=0) * 0.45
    rgb += np.array([0.06, 0.03, 0.02]) * sh[..., None]
    a = np.maximum(a, sh)
    # glow
    g = glow * 0.35
    rgb = rgb * (1 - g[..., None]) + np.array([1.0, 0.7, 0.3]) * g[..., None]
    a = np.maximum(a, g)
    rgb = rgb * (1 - m2[..., None]) + np.clip(col, 0, 1) * m2[..., None]
    a = np.maximum(a, m2)
    img = np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((img * 255).astype(np.uint8), "RGBA").save(path)
    print(path)


if __name__ == "__main__":
    card("LOOKING UP", 140, 790, os.path.join(OUT, "title.png"))
    card("LOOKING UP", 92, 884, os.path.join(OUT, "end.png"))
