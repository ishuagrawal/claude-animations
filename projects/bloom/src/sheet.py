"""Labelled contact sheet (system python3 + Pillow; falls back to ffmpeg xstack without labels).

    python3 src/sheet.py out.png COLS img1.png[=label] img2.png[=label] ...
"""
import os
import subprocess
import sys


def make(out, cols, items, width=None):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        paths = [p for p, _ in items]
        n = len(paths)
        lay = "|".join(f"{'+'.join(['w0'] * (i % cols)) or '0'}_{'+'.join(['h0'] * (i // cols)) or '0'}"
                       for i in range(n))
        args = sum([["-i", p] for p in paths], [])
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex",
                        "".join(f"[{i}]" for i in range(n)) + f"xstack=inputs={n}:layout={lay}:fill=black", out])
        return
    ims = [Image.open(p).convert("RGB") for p, _ in items]
    w = width or ims[0].width
    ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
    h = max(im.height for im in ims)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (18, 18, 20))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", max(14, w // 28))
    except Exception:
        font = ImageFont.load_default()
    d = ImageDraw.Draw(sheet)
    for i, (im, (_, label)) in enumerate(zip(ims, items)):
        x = 6 + (i % cols) * (w + 6)
        y = 6 + (i // cols) * (h + 6)
        sheet.paste(im, (x, y))
        if label:
            tw = d.textlength(label, font=font)
            d.rectangle([x + 6, y + 6, x + 14 + tw, y + 10 + font.size], fill=(0, 0, 0))
            d.text((x + 10, y + 7), label, fill=(240, 240, 235), font=font)
    sheet.save(out)


if __name__ == "__main__":
    out, cols = sys.argv[1], int(sys.argv[2])
    items = []
    for a in sys.argv[3:]:
        p, _, lab = a.partition("=")
        if os.path.exists(p):
            items.append((p, lab))
    make(out, cols, items)
