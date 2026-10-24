// Type: the bar-built wordmark (the reference builds its brand mark from dropping bars), the star button, and
// shared font helpers. Fonts are OFL variable fonts installed from npm (see index.html).
import { P, rgba, mix } from './palette.js';
import { drop } from './soft.js';


export const FONTS = {
  display: '"Archivo Variable", "Archivo", "Arial Black", sans-serif',
  ui: '"Inter Variable", "Inter", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", Menlo, monospace',
};
export function setFont(ctx, size, { fam = 'ui', weight = 700, stretch = 'normal', track = 0 } = {}) {
  ctx.font = `${weight} ${stretch === 'normal' ? '' : stretch + ' '}${size}px ${FONTS[fam] || fam}`;
  ctx.fontStretch = stretch;
  ctx.letterSpacing = track + 'px';
}
export async function loadFonts() {
  await Promise.all([
    document.fonts.load(`900 expanded 100px ${FONTS.display}`, 'skıl70+'),
    document.fonts.load(`700 100px ${FONTS.ui}`, 'Star 0123456789'),
    document.fonts.load(`500 100px ${FONTS.mono}`, '/skills:video-by-reference'),
  ]);
}

// ---------------------------------------------------------------- wordmark built from bars
// Measures each glyph's ink box and its stem (the bar it is built from) by scanning rendered pixels once.
const WM = { size: 0, items: null };
export function wordmark(text, size, cx, baseline, { track = -4 } = {}) {
  const key = text + '|' + size + '|' + cx + '|' + baseline;
  if (WM.key === key) return WM.items;
  const c = new OffscreenCanvas(size * 2, size * 2), x = c.getContext('2d', { willReadFrequently: true });
  setFont(x, size, { fam: 'display', weight: 900, stretch: 'expanded', track: 0 });
  const adv = [...text].map(ch => x.measureText(ch).width);
  const total = adv.reduce((a, b) => a + b, 0) + track * (text.length - 1);
  let pen = cx - total / 2;
  const items = [];
  let stemW = 0;
  [...text].forEach((ch, i) => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    setFont(x, size, { fam: 'display', weight: 900, stretch: 'expanded', track: 0 });
    x.fillStyle = '#000';
    const ox = size * 0.3, oy = size * 1.4;
    x.fillText(ch, ox, oy);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const colN = new Array(c.width).fill(0);
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
      if (d[(yy * c.width + xx) * 4 + 3] > 128) { colN[xx]++; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    const h = y1 - y0 + 1;
    // stem = first run of columns covering ≥ 88% of the glyph height
    let s0 = -1, s1 = -1;
    for (let xx = x0; xx <= x1; xx++) {
      if (colN[xx] >= h * 0.88) { if (s0 < 0) s0 = xx; s1 = xx; } else if (s0 >= 0) break;
    }
    if (s0 >= 0) stemW = Math.max(stemW, s1 - s0 + 1);
    items.push({ ch, adv: adv[i], pen, box: { x: pen + (x0 - ox), y: baseline + (y0 - oy), w: x1 - x0 + 1, h }, stem: s0 >= 0 ? { x: pen + (s0 - ox), w: s1 - s0 + 1 } : null });
    pen += adv[i] + track;
  });
  for (const it of items) {
    if (!it.stem || it.stem.w < stemW * 0.6) it.stem = { x: it.box.x + it.box.w / 2 - stemW / 2, w: stemW };
    it.bar = { x: it.stem.x, y: it.box.y, w: it.stem.w, h: it.box.h };
  }
  WM.key = key; WM.items = items;
  return items;
}
// ---------------------------------------------------------------- star button
export function starPath(cx, cy, R, r = R * 0.45, rot = 0) {
  const p = new Path2D();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + i * Math.PI / 5, rr = i % 2 ? r : R;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    i ? p.lineTo(px, py) : p.moveTo(px, py);
  }
  p.closePath();
  return p;
}

// GitHub-style star button, drawn from scratch: [☆ Star | count]. (x, y) = center. o.press 0..1 sinks it,
// o.fill 0..1 fills the star gold, o.count: {from, to, p} rolls the number, o.glow adds a celebratory halo.
export const PILL = { w: 520, h: 124, split: 322, r: 26 };
export function starButton(ctx, x, y, o = {}) {
  const { press = 0, fill = 0, count = { from: 66, to: 66, p: 1 }, scale = 1, alpha = 1, glow = 0, label = 'Star' } = o;
  if (alpha <= 0 || scale <= 0) return;
  const { w, h, split, r } = PILL;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  const lip = 10, dy = press * lip * 0.8;
  const outer = new Path2D(); outer.roundRect(-w / 2, -h / 2, w, h, r);
  if (glow > 0) {
    const g = ctx.createRadialGradient(-w / 2 + 92, 0, 0, -w / 2 + 92, 0, 420);
    g.addColorStop(0, rgba(P.goldLt, 0.85 * glow)); g.addColorStop(1, rgba(P.goldLt, 0));
    ctx.fillStyle = g; ctx.fillRect(-700, -500, 1400, 1000);
  }
  drop(ctx, outer, { dx: 10, dy: 16 + lip, blur: 26, a: 0.22 });
  // pressable lip
  const lipP = new Path2D(); lipP.roundRect(-w / 2, -h / 2 + lip, w, h, r);
  ctx.fillStyle = P.ink; ctx.fill(lipP);
  ctx.translate(0, dy);
  ctx.fillStyle = P.cream; ctx.fill(outer);
  // counter segment
  ctx.save(); ctx.clip(outer);
  ctx.fillStyle = mix(P.cream, P.gold, 0.28 + 0.5 * fill);
  ctx.fillRect(-w / 2 + split, -h / 2, w - split, h);
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = P.ink; ctx.stroke(outer);
  ctx.beginPath(); ctx.moveTo(-w / 2 + split, -h / 2); ctx.lineTo(-w / 2 + split, h / 2); ctx.stroke();
  // star icon
  const sx = -w / 2 + 92, sy = 2;
  const st = starPath(sx, sy, 38, 18);
  ctx.lineJoin = 'round';
  if (fill > 0) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, fill * 1.5);
    ctx.fillStyle = P.gold; ctx.fill(st);
    ctx.restore();
  }
  ctx.lineWidth = 7; ctx.strokeStyle = P.ink; ctx.stroke(st);
  // label
  setFont(ctx, 56, { fam: 'ui', weight: 700, track: -0.5 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
  ctx.fillText(label, -w / 2 + 150, 4);
  // rolling count
  const cx = -w / 2 + split + (w - split) / 2;
  ctx.save();
  const win = new Path2D(); win.rect(-w / 2 + split + 3, -h / 2 + 3, w - split - 6, h - 6);
  ctx.clip(win);
  setFont(ctx, 62, { fam: 'ui', weight: 800, track: -1 });
  ctx.textAlign = 'center';
  const p = count.p;
  if (p < 1 && count.from !== count.to) {
    ctx.fillText(String(count.from), cx, 4 - p * h);
    ctx.fillText(String(count.to), cx, 4 + (1 - p) * h);
  } else ctx.fillText(String(p >= 1 ? count.to : count.from), cx, 4);
  ctx.restore();
  ctx.restore();
  return { star: [x + (sx) * scale, y + (sy + dy) * scale] };
}
