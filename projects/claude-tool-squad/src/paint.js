// Painted background brushes (BG layer: no outlines, like the reference's poster-colour BGs).
// Everything is drawn once at load into offscreen plates from fixed seeds — thousands of dabs and
// strokes per plate — then reused by the shots. Light comes from the upper right.
import { rng, noise, clamp, lerp, TAU } from './core.js';
import { mix, rgba, P } from './palette.js';

export const OC = (w, h) => { const c = new OffscreenCanvas(Math.round(w), Math.round(h)); return [c, c.getContext('2d')]; };
export function fbm(x, seed, oct = 4) { let v = 0, a = 1, t = 0, f = 1; for (let i = 0; i < oct; i++) { v += noise(x * f, seed + i * 17) * a; t += a; a *= 0.5; f *= 2.07; } return v / t; }

// ---------------------------------------------------------------- primitive brushes
export function dab(x, cx, cy, rx, ry, rot, col, a = 1) {
  x.globalAlpha = a; x.fillStyle = col;
  x.beginPath(); x.ellipse(cx, cy, Math.max(0.3, rx), Math.max(0.3, ry), rot, 0, TAU); x.fill();
}
// tapered brush stroke along points
export function stroke(x, pts, w0, w1, col, a = 1) {
  if (pts.length < 2) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const ang = Math.atan2(q[1] - o[1], q[0] - o[0]) + Math.PI / 2;
    const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    L.push([p[0] + Math.cos(ang) * w, p[1] + Math.sin(ang) * w]); R.push([p[0] - Math.cos(ang) * w, p[1] - Math.sin(ang) * w]);
  }
  x.globalAlpha = a; x.fillStyle = col;
  x.beginPath(); [...L, ...R.reverse()].forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
}
// clump of leaves: dark mass, mid dabs, lit dabs top-right, sparkle highlights
export function leafClump(x, cx, cy, r, pal, rnd, k = 1) {
  const n = Math.round(10 * k + r * 0.12);
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.75; dab(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, r * (0.28 + rnd() * 0.22), r * (0.22 + rnd() * 0.16), rnd() * 3, pal.dark); }
  for (let i = 0; i < n; i++) { const a = -0.6 + (rnd() - 0.5) * 2.6, d = rnd() * r * 0.6; dab(x, cx + Math.cos(a) * d + r * 0.06, cy + Math.sin(a) * d - r * 0.1, r * (0.2 + rnd() * 0.18), r * (0.16 + rnd() * 0.12), rnd() * 3, pal.mid); }
  for (let i = 0; i < n * 0.7; i++) { const a = -0.8 + (rnd() - 0.5) * 1.4, d = r * (0.25 + rnd() * 0.45); dab(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d - r * 0.12, r * (0.1 + rnd() * 0.12), r * (0.08 + rnd() * 0.08), rnd() * 3, pal.lit); }
  for (let i = 0; i < n * 0.25; i++) { const a = -0.7 + (rnd() - 0.5) * 1.0, d = r * (0.45 + rnd() * 0.3); dab(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d - r * 0.15, r * 0.06, r * 0.045, rnd() * 3, pal.hi || mix(pal.lit, '#ffffff', 0.4)); }
  for (let i = 0; i < n * 0.3; i++) { const a = 2.2 + (rnd() - 0.5) * 1.6, d = r * (0.3 + rnd() * 0.4); dab(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.07, r * 0.05, rnd() * 3, pal.deep || mix(pal.dark, '#000000', 0.35)); }
  x.globalAlpha = 1;
}
// a whole tree: trunk + branches + canopy clumps
export function tree(x, cx, by, h, pal, seed, o = {}) {
  const rnd = rng(seed);
  const tw = h * (o.trunk ?? 0.07);
  // trunk (tapered, lit on the right)
  stroke(x, [[cx, by], [cx + h * 0.02, by - h * 0.35], [cx - h * 0.01, by - h * 0.6]], tw * 1.4, tw * 0.6, pal.bark);
  stroke(x, [[cx + tw * 0.25, by], [cx + tw * 0.3 + h * 0.02, by - h * 0.35], [cx + tw * 0.2, by - h * 0.58]], tw * 0.45, tw * 0.15, pal.barkLit);
  for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, y0 = by - h * (0.35 + i * 0.07); stroke(x, [[cx, y0], [cx + s * h * 0.12, y0 - h * 0.1], [cx + s * h * 0.2, y0 - h * 0.16]], tw * 0.5, tw * 0.12, pal.bark); }
  // canopy
  const cy = by - h * 0.68, cw = h * (o.wide ?? 0.42);
  const clumps = [];
  for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()); clumps.push([cx + Math.cos(a) * d * cw, cy + Math.sin(a) * d * cw * 0.7, cw * (0.32 + rnd() * 0.2)]); }
  clumps.sort((p, q) => q[1] - p[1] + (q[0] - p[0]) * 0.2);
  for (const [px, py, r] of clumps) leafClump(x, px, py, r, pal, rnd, 1.2);
}
// distant treeline band: bumpy top, three tones, hazy
export function treeline(x, x0, x1, y, h, pal, seed, density = 1) {
  const rnd = rng(seed);
  const step = h * 0.32 / density;
  for (let px = x0; px < x1; px += step * (0.6 + rnd() * 0.6)) {
    const th = h * (0.55 + fbm(px * 0.004, seed) * 0.6 + rnd() * 0.3);
    dab(x, px, y - th * 0.5, step * 1.1, th * 0.6, 0, pal.dark);
    dab(x, px, y + h * 0.1, step * 1.2, h * 0.5, 0, pal.dark);
  }
  for (let px = x0; px < x1; px += step * (0.5 + rnd() * 0.5)) {
    const th = h * (0.5 + fbm(px * 0.004, seed) * 0.6 + rnd() * 0.25);
    dab(x, px + step * 0.25, y - th * 0.55, step * 0.55, th * 0.32, 0, pal.mid, 0.95);
    dab(x, px + step * 0.4, y - th * 0.72, step * 0.28, th * 0.14, 0, pal.lit, 0.9);
  }
  x.globalAlpha = 1;
}
// grass field with blade strokes, sun patches and cloud shadows
export function grassField(x, x0, y0, w, h, pal, seed, o = {}) {
  const rnd = rng(seed);
  const g = x.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, pal.far); g.addColorStop(1, pal.near);
  x.fillStyle = g; x.fillRect(x0, y0, w, h);
  // soft sun patches + cloud shadows
  x.save(); x.filter = 'blur(18px)';
  for (let i = 0; i < 10; i++) dab(x, x0 + rnd() * w, y0 + rnd() * h, w * (0.06 + rnd() * 0.1), h * (0.05 + rnd() * 0.08), 0, rnd() < 0.5 ? pal.sun : pal.shade, 0.35);
  x.restore();
  const n = Math.round((o.density ?? 1) * w * h / 220);
  for (let i = 0; i < n; i++) {
    const v = Math.pow(rnd(), 0.7), py = y0 + v * h, px = x0 + rnd() * w;
    const len = lerp(3, o.blade ?? 26, v) * (0.6 + rnd() * 0.8), lean = (rnd() - 0.4) * 0.5;
    const c = rnd(); const col = c < 0.35 ? pal.dark : c < 0.8 ? pal.mid : pal.lit;
    stroke(x, [[px, py], [px + lean * len * 0.5, py - len * 0.6], [px + lean * len, py - len]], lerp(1, 4, v), 0.3, col, 0.85);
  }
  x.globalAlpha = 1;
}
// cumulus cloud: shadow mass → mid → lit puffs → rim, flat base; soft painted edges
export function cumulus(dst, cx, cy, w, h, seed, pal) {
  const rnd = rng(seed);
  const pad = h * 0.4, CW = w * 1.15 + pad * 2, CH = h * 1.5 + pad;
  const [c, x] = OC(CW, CH);
  const ox = CW / 2 - cx, oy = h * 1.25 + pad * 0.5 - cy; // local origin shift
  x.translate(ox, oy);
  const puffs = [];
  const n = 14 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), hp = Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * u)), 0.8);
    puffs.push([cx + (u - 0.5) * w * 0.9 + (rnd() - 0.5) * w * 0.04, cy - h * 0.18 - hp * h * (0.35 + rnd() * 0.3), h * (0.16 + hp * 0.2) * (0.8 + rnd() * 0.4)]);
  }
  for (let i = 0; i < n * 0.6; i++) { const u = 0.2 + rnd() * 0.6; puffs.push([cx + (u - 0.5) * w * 0.8, cy - h * (0.55 + rnd() * 0.3), h * (0.14 + rnd() * 0.16)]); }
  for (let i = 0; i < n; i++) { const u = i / (n - 1); puffs.push([cx + (u - 0.5) * w * 0.86, cy - h * 0.12, h * (0.12 + rnd() * 0.06)]); }
  x.save();
  x.beginPath(); x.rect(cx - w, cy - h * 2, w * 2, h * 2 + 2); x.clip(); // flat base
  x.filter = 'blur(1.5px)';
  for (const [px, py, r] of puffs) dab(x, px, py, r, r * 0.92, 0, pal.sh);
  for (const [px, py, r] of puffs) dab(x, px + r * 0.12, py - r * 0.16, r * 0.86, r * 0.8, 0, pal.mid);
  for (const [px, py, r] of puffs) if (py < cy - h * 0.22) dab(x, px + r * 0.22, py - r * 0.3, r * 0.62, r * 0.58, 0, pal.lit);
  x.filter = 'blur(0.8px)';
  for (const [px, py, r] of puffs) if (py < cy - h * 0.3) { x.globalAlpha = 0.9; x.strokeStyle = pal.rim; x.lineWidth = r * 0.08; x.beginPath(); x.arc(px + r * 0.15, py - r * 0.2, r * 0.7, -1.9, -0.3); x.stroke(); }
  // belly shading (only over the cloud: source-atop on this cloud's own canvas)
  x.filter = 'blur(6px)';
  const g = x.createLinearGradient(0, cy - h * 0.35, 0, cy); g.addColorStop(0, rgba(pal.sh2, 0)); g.addColorStop(1, rgba(pal.sh2, 0.75));
  x.globalAlpha = 1; x.fillStyle = g; x.globalCompositeOperation = 'source-atop'; x.fillRect(cx - w, cy - h * 0.35, w * 2, h * 0.4);
  x.restore();
  dst.drawImage(c, -ox, -oy);
}
// wispy streak clouds (the reference's skies have long brushed streaks)
export function wisps(x, x0, y0, w, h, n, seed, col, a = 0.5) {
  const rnd = rng(seed);
  x.save(); x.filter = 'blur(5px)';
  for (let i = 0; i < n; i++) {
    const px = x0 + rnd() * w, py = y0 + rnd() * h, L = 160 + rnd() * 460, th = 10 + rnd() * 26;
    stroke(x, [[px, py + th * 0.3], [px + L * 0.3, py - th * 0.2], [px + L * 0.7, py - L * 0.02], [px + L, py - L * 0.05]], th * 0.4, th * 0.15, col, a * (0.25 + rnd() * 0.4));
    stroke(x, [[px + L * 0.1, py], [px + L * 0.5, py - th * 0.3], [px + L * 0.8, py - L * 0.03]], th, th * 0.3, col, a * (0.15 + rnd() * 0.25));
  }
  x.restore(); x.globalAlpha = 1;
}
// mountain range: peaks, lit facets, gullies, snow, haze, forested foot
export function mountains(x, x0, base, w, h, seed, pal, o = {}) {
  const rnd = rng(seed);
  const peaks = [];
  const np = o.peaks ?? 6;
  for (let i = 0; i < np; i++) peaks.push([x0 + (i + 0.2 + rnd() * 0.6) / np * w, base - h * (0.45 + rnd() * 0.55), 0.9 + rnd() * 0.9]);
  const ridgeY = px => { let y = base; for (const [qx, qy, sl] of peaks) y = Math.min(y, qy + Math.abs(px - qx) * sl * (h / w) * np * 0.55); return y + fbm(px * 0.01, seed) * h * 0.06; };
  const pts = []; for (let px = x0 - 10; px <= x0 + w + 10; px += 6) pts.push([px, ridgeY(px)]);
  const sil = new Path2D(); sil.moveTo(x0 - 10, base + 4); pts.forEach(([px, py]) => sil.lineTo(px, py)); sil.lineTo(x0 + w + 10, base + 4); sil.closePath();
  const g = x.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, pal.top); g.addColorStop(1, pal.bottom);
  x.save(); x.fillStyle = g; x.fill(sil); x.clip(sil);
  // lit facets: from each peak, the right-hand slope in a lighter tone, broken by gullies
  for (const [qx, qy, sl] of peaks) {
    for (let k = 0; k < 7; k++) {
      const dx = (k + 1) * (w / np) * 0.07 * (0.6 + rnd() * 0.8);
      const fx = qx + dx * 0.4, fy = qy + dx * 0.25;
      const pl = [[qx, qy], [qx + dx * 3, ridgeY(qx + dx * 3)], [fx + dx * 1.5, base], [fx - dx * 0.2, base]];
      x.filter = 'blur(3px)';
      x.globalAlpha = 0.35 + rnd() * 0.25; x.fillStyle = k % 2 ? pal.lit : mix(pal.lit, pal.top, 0.4);
      x.beginPath(); pl.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill();
      x.filter = 'none';
    }
    // gullies: soft dark ravines with a lit edge, branching down from the ridges
    x.filter = 'blur(1.5px)';
    for (let k = 0; k < 5; k++) {
      const sx = qx + (rnd() - 0.45) * (w / np) * 0.45, sy = ridgeY(sx) + 6;
      const L = (base - sy) * (0.35 + rnd() * 0.45), dir = -0.35 + (rnd() - 0.5) * 0.25;
      const pts = [[sx, sy], [sx + dir * L * 0.3 + (rnd() - 0.5) * 10, sy + L * 0.35], [sx + dir * L * 0.65, sy + L * 0.7], [sx + dir * L, sy + L]];
      stroke(x, pts, 7 + rnd() * 9, 1, pal.gully, 0.32);
      stroke(x, pts.map(([a, b]) => [a + 6, b + 2]), 4 + rnd() * 4, 0.6, pal.lit, 0.35);
    }
    x.filter = 'none';
    if (o.snow && qy < base - h * 0.75) { // snow cap
      x.globalAlpha = 0.95; x.fillStyle = pal.snow;
      x.beginPath(); x.moveTo(qx, qy - 2); for (let k = 0; k <= 8; k++) { const px = qx - h * 0.12 + k * h * 0.03; x.lineTo(px, Math.max(ridgeY(px), qy + h * 0.06 + (k % 2) * h * 0.04)); } x.lineTo(qx + h * 0.14, ridgeY(qx + h * 0.14)); x.closePath(); x.fill();
    }
  }
  x.globalAlpha = 1;
  // haze toward the base
  const hz = x.createLinearGradient(0, base - h * 0.5, 0, base); hz.addColorStop(0, rgba(pal.haze, 0)); hz.addColorStop(1, rgba(pal.haze, o.hazeA ?? 0.75));
  x.fillStyle = hz; x.fillRect(x0 - 20, base - h * 0.5, w + 40, h * 0.5 + 6);
  x.restore();
  if (o.forest) treeline(x, x0 - 20, x0 + w + 20, base + 6, h * 0.14, o.forest, seed + 5, 1.4);
  return ridgeY;
}
// painted rock (BG): light-direction gradient, soft planes, directional brush texture, cracks
// with lit lips, top-edge highlight, bottom occlusion, optional moss
export function rock(x, poly, pal, seed, o = {}) {
  const rnd = rng(seed);
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), W0 = x1 - x0, H0 = y1 - y0;
  const shape = new Path2D(); poly.forEach(([px, py], i) => (i ? shape.lineTo(px, py) : shape.moveTo(px, py))); shape.closePath();
  x.save(); x.clip(shape);
  const g = x.createLinearGradient(x1, y0, x0, y1); g.addColorStop(0, pal.lit); g.addColorStop(0.45, pal.mid); g.addColorStop(1, pal.dark);
  x.fillStyle = g; x.fillRect(x0 - 5, y0 - 5, W0 + 10, H0 + 10);
  // soft planes
  x.filter = 'blur(2.5px)';
  for (let i = 0; i < (o.planes ?? 6); i++) {
    const px = x0 + rnd() * W0, py = y0 + rnd() * H0, pw = W0 * (0.15 + rnd() * 0.3), ph = H0 * (0.2 + rnd() * 0.4);
    x.globalAlpha = 0.14 + rnd() * 0.14; x.fillStyle = rnd() < 0.45 ? pal.lit : pal.dark;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + pw * 0.4, py - ph * 0.1); x.lineTo(px + pw * 0.3, py + ph); x.lineTo(px - pw * 0.1, py + ph * 0.9); x.closePath(); x.fill();
  }
  x.filter = 'none';
  // directional brush texture
  const nT = Math.round(W0 * H0 / 260);
  for (let i = 0; i < nT; i++) {
    const px = x0 + rnd() * W0, py = y0 + rnd() * H0, v = (py - y0) / H0, hx = (px - x0) / W0;
    const lit = (1 - v) * 0.7 + hx * 0.5 + (rnd() - 0.5) * 0.6;
    const col = lit > 0.85 ? pal.lit : lit > 0.45 ? pal.mid : pal.dark;
    const L = 8 + rnd() * 26, ang = Math.PI / 2 + (rnd() - 0.5) * 0.7;
    stroke(x, [[px, py], [px + Math.cos(ang) * L, py + Math.sin(ang) * L]], 2 + rnd() * 5, 0.8, col, 0.22 + rnd() * 0.3);
  }
  // cracks with a lit lip on the right
  for (let i = 0; i < (o.cracks ?? 6); i++) {
    const px = x0 + rnd() * W0, py = y0 + H0 * (0.15 + rnd() * 0.7), L = H0 * (0.15 + rnd() * 0.35);
    const pts = [[px, py]]; for (let k = 1; k <= 4; k++) pts.push([pts[k - 1][0] + (rnd() - 0.5) * L * 0.35, pts[k - 1][1] + L / 4]);
    stroke(x, pts, 3.5, 0.6, pal.crack, 0.85);
    stroke(x, pts.map(([a, b]) => [a + 3, b]), 2, 0.4, pal.edge, 0.5);
  }
  // bottom occlusion
  const og = x.createLinearGradient(0, y1 - H0 * 0.35, 0, y1); og.addColorStop(0, rgba(pal.dark, 0)); og.addColorStop(1, rgba(pal.dark, 0.6));
  x.globalAlpha = 1; x.fillStyle = og; x.fillRect(x0 - 5, y1 - H0 * 0.35, W0 + 10, H0 * 0.35 + 5);
  x.restore();
  // lit top edges
  x.save(); x.lineCap = 'round'; x.strokeStyle = pal.edge; x.lineWidth = 3; x.globalAlpha = 0.85;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]) * 1.2 && a[1] < y0 + H0 * 0.4 && b[1] < y0 + H0 * 0.4) { x.beginPath(); x.moveTo(a[0], a[1] + 2.5); x.lineTo(b[0], b[1] + 2.5); x.stroke(); } }
  x.restore();
  if (o.moss) for (let i = 0; i < 40; i++) { const a = poly[Math.floor(rnd() * poly.length)]; if (a[1] < y0 + H0 * 0.3) dab(x, a[0] + (rnd() - 0.5) * 30, a[1] + rnd() * 14, 6 + rnd() * 10, 4 + rnd() * 6, 0, rnd() < 0.5 ? o.moss.mid : o.moss.lit, 0.9); }
  x.globalAlpha = 1;
}
// strata wall (canyon): horizontal bands + erosion streaks + light/shadow planes
export function strata(x, poly, pal, seed) {
  const rnd = rng(seed);
  const shape = new Path2D(); poly.forEach(([px, py], i) => (i ? shape.lineTo(px, py) : shape.moveTo(px, py))); shape.closePath();
  const ys = poly.map(p => p[1]), xs = poly.map(p => p[0]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys), x0 = Math.min(...xs), x1 = Math.max(...xs);
  x.save(); x.fillStyle = pal.mid; x.fill(shape); x.clip(shape);
  let y = y0;
  while (y < y1) { const hh = 10 + rnd() * 40; x.fillStyle = [pal.mid, pal.band1, pal.band2, pal.mid][Math.floor(rnd() * 4)]; x.globalAlpha = 0.7; x.beginPath(); x.moveTo(x0, y); for (let px = x0; px <= x1; px += 40) x.lineTo(px, y + fbm(px * 0.01, seed + y) * 12); x.lineTo(x1, y + hh); x.lineTo(x0, y + hh); x.closePath(); x.fill(); y += hh; }
  // erosion streaks
  for (let i = 0; i < (x1 - x0) / 12; i++) { const px = x0 + rnd() * (x1 - x0), py = y0 + rnd() * (y1 - y0) * 0.6, L = 40 + rnd() * 200; stroke(x, [[px, py], [px + 2, py + L * 0.5], [px - 2, py + L]], 2 + rnd() * 6, 0.5, rnd() < 0.6 ? pal.dark : pal.lit, 0.35 + rnd() * 0.3); }
  // shadow plane on the left side of each buttress
  for (let i = 0; i < 6; i++) { const px = x0 + (i + rnd()) * (x1 - x0) / 6; x.globalAlpha = 0.45; x.fillStyle = pal.dark; x.beginPath(); x.moveTo(px, y0 - 20); x.lineTo(px + 30 + rnd() * 60, y0 - 20); x.lineTo(px + 10 + rnd() * 40, y1 + 20); x.lineTo(px - 20, y1 + 20); x.closePath(); x.fill(); }
  x.restore(); x.globalAlpha = 1;
}
// soft painted vertical gradient sky with brushed variation
export function skyPlate(x, w, h, stops, seed) {
  const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const rnd = rng(seed);
  x.save(); x.filter = 'blur(30px)';
  for (let i = 0; i < 24; i++) dab(x, rnd() * w, rnd() * h * 0.8, 200 + rnd() * 400, 40 + rnd() * 80, 0, rnd() < 0.5 ? '#ffffff' : stops[0][1], 0.08);
  x.restore(); x.globalAlpha = 1;
}
// pebbles / stones scattered on a ground band
export function pebbles(x, x0, y0, w, h, n, pal, seed) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) {
    const v = rnd(), px = x0 + rnd() * w, py = y0 + v * h, r = lerp(2, 12, v) * (0.5 + rnd());
    dab(x, px + r * 0.3, py + r * 0.4, r * 1.1, r * 0.5, 0, pal.dark, 0.5);
    dab(x, px, py, r, r * 0.62, 0, pal.mid);
    dab(x, px + r * 0.25, py - r * 0.2, r * 0.45, r * 0.25, 0, pal.lit);
  }
  x.globalAlpha = 1;
}
// flowers in grass
export function flowers(x, x0, y0, w, h, n, seed, cols = ['#ffffff', '#ffe46b', '#ff9ab0']) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) { const v = rnd(), px = x0 + rnd() * w, py = y0 + v * h, r = lerp(1.5, 6, v); const c = cols[Math.floor(rnd() * cols.length)]; for (let k = 0; k < 5; k++) dab(x, px + Math.cos(k * 1.26) * r, py + Math.sin(k * 1.26) * r * 0.7, r * 0.7, r * 0.5, k * 1.26, c); dab(x, px, py, r * 0.45, r * 0.45, 0, '#f2a030'); }
  x.globalAlpha = 1;
}
