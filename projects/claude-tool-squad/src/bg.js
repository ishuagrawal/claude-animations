// Painted backgrounds: soft gradients + seeded brush texture, no outlines (the reference keeps
// lines for the cel layer only). Sprites (clouds, ridges) are generated once at load.
import { P, mix, rgba } from './palette.js';
import { W, H, TAU, rng, noise, hash, clamp, lerp } from './core.js';

let TEX = null;          // grayscale brush/paper texture
export const SPR = {};   // generated sprites

function valueNoiseCanvas(size, seed, octaves = 5) {
  const c = new OffscreenCanvas(size, size), x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const r = rng(seed);
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = 4 << o, g = new Float32Array((n + 1) * (n + 1));
    for (let i = 0; i < g.length; i++) g[i] = r();
    for (let i = 0; i <= n; i++) { g[i * (n + 1) + n] = g[i * (n + 1)]; g[n * (n + 1) + i] = g[i]; }
    grids.push({ n, g });
  }
  for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    let v = 0, amp = 1, tot = 0;
    for (const { n, g } of grids) {
      const fx = xx / size * n, fy = y / size * n, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * (n + 1) + ix], b = g[iy * (n + 1) + ix + 1], c2 = g[(iy + 1) * (n + 1) + ix], d = g[(iy + 1) * (n + 1) + ix + 1];
      v += lerp(lerp(a, b, sx), lerp(c2, d, sx), sy) * amp; tot += amp; amp *= 0.55;
    }
    v /= tot;
    const k = (y * size + xx) * 4, s = Math.round(clamp((v - 0.5) * 2.2 + 0.5) * 255);
    img.data[k] = img.data[k + 1] = img.data[k + 2] = s; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

// cumulus cloud sprite: overlapping puffs, lit top, blue-grey belly, soft painted edge
function makeCloud(seed, w, h, o = {}) {
  const pad = 30, c = new OffscreenCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
  const r = rng(seed);
  const puffs = [];
  const n = o.n || 9;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const rad = h * (0.22 + 0.3 * Math.sin(Math.PI * u) * (0.7 + r() * 0.5));
    puffs.push([pad + w * (0.08 + 0.84 * u) + (r() - 0.5) * w * 0.05, pad + h - rad * (0.75 + r() * 0.35) - h * 0.04, rad]);
  }
  // a few top puffs
  for (let i = 0; i < Math.floor(n / 2); i++) { const u = 0.25 + r() * 0.5; puffs.push([pad + w * u, pad + h * (0.35 + r() * 0.15), h * (0.2 + r() * 0.16)]); }
  // flat-ish bottom: a row of small puffs along the base
  for (let i = 0; i < n * 2; i++) { const u = 0.12 + 0.76 * (i / (n * 2 - 1)); puffs.push([pad + w * u, pad + h * 0.86, h * (0.1 + 0.05 * Math.sin(Math.PI * u) + r() * 0.03)]); }
  const shape = new Path2D();
  puffs.forEach(([px, py, pr]) => { shape.moveTo(px + pr, py); shape.arc(px, py, pr, 0, TAU); });
  x.filter = `blur(${o.blur ?? 1.6}px)`;
  x.fillStyle = o.lit || P.cloud; x.fill(shape);
  // belly shadow: the same puffs shifted down-left, clipped
  x.save(); x.clip(shape);
  x.filter = `blur(${(o.blur ?? 1.6) * 3}px)`;
  const sh = new Path2D();
  puffs.forEach(([px, py, pr]) => { sh.moveTo(px + pr, py + pr * 0.55); sh.arc(px - pr * 0.1, py + pr * 0.55, pr * 0.95, 0, TAU); });
  x.fillStyle = o.sh || P.cloudSh; x.fill(sh);
  x.fillStyle = o.sh2 || P.cloudSh2; x.globalAlpha = 0.55; x.fillRect(0, pad + h * 0.84, w + pad * 2, h);
  // sunlit rim dabs on the top puffs
  x.restore(); x.save(); x.clip(shape);
  x.globalAlpha = 0.9; x.filter = 'blur(2px)'; x.fillStyle = o.rim || '#ffffff';
  puffs.slice(0, n + Math.floor(n / 2)).forEach(([px, py, pr]) => { x.beginPath(); x.arc(px + pr * 0.25, py - pr * 0.35, pr * 0.45, 0, TAU); x.fill(); });
  x.restore();
  x.filter = 'none';
  return c;
}

// ridge / hill layer sprite (painted, gradient + texture)
function makeRidge(seed, w, h, top, bot, o = {}) {
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
  const p = new Path2D();
  p.moveTo(0, h);
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = h * (o.base ?? 0.45) - (noise(u * (o.freq ?? 4), seed) * 0.5 + noise(u * (o.freq ?? 4) * 3.1, seed + 3) * 0.18) * h * (o.amp ?? 0.5);
    p.lineTo(u * w, y);
  }
  p.lineTo(w, h); p.closePath();
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  x.filter = 'blur(1.2px)';
  x.fillStyle = g; x.fill(p);
  x.filter = 'none';
  if (TEX) { x.save(); x.clip(p); x.globalAlpha = o.tex ?? 0.12; x.globalCompositeOperation = 'overlay'; x.drawImage(TEX, 0, 0, w, h); x.restore(); }
  return c;
}

// nebula: blurred colour clouds + dust, for the cosmic open
function makeNebula(w, h, seed) {
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
  const r = rng(seed);
  x.filter = 'blur(60px)';
  const cols = ['#ff5fa2', '#7a4cff', '#2fb6ff', '#ff9a4c', '#3fe0d0', '#c04cff'];
  // a diagonal milky band of colour, dark space either side
  for (let i = 0; i < 34; i++) {
    const u = r(), cx = w * u, cy = h * 0.5 + (u - 0.5) * h * 0.55 + (r() - 0.5) * h * 0.22, rad = 60 + r() * 170;
    x.globalAlpha = 0.1 + r() * 0.22; x.fillStyle = cols[Math.floor(r() * cols.length)];
    x.beginPath(); x.ellipse(cx, cy, rad * 1.8, rad, 0.45, 0, TAU); x.fill();
  }
  x.filter = 'blur(28px)'; x.globalAlpha = 0.35; x.fillStyle = '#fff0f8';
  for (let i = 0; i < 18; i++) { const u = r(), cx = w * u, cy = h * 0.5 + (u - 0.5) * h * 0.55 + (r() - 0.5) * 80; x.beginPath(); x.ellipse(cx, cy, 90 + r() * 120, 30 + r() * 30, 0.45, 0, TAU); x.fill(); }
  x.filter = 'blur(6px)'; x.globalAlpha = 0.5; x.fillStyle = '#ffffff';
  for (let i = 0; i < 160; i++) { const u = r(), cx = w * u, cy = h * 0.5 + (u - 0.5) * h * 0.55 + (r() - 0.5) * h * 0.3; x.globalAlpha = 0.3 + r() * 0.4; x.beginPath(); x.arc(cx, cy, 1.5 + r() * 5, 0, TAU); x.fill(); }
  x.filter = 'none';
  if (TEX) { x.globalAlpha = 0.25; x.globalCompositeOperation = 'overlay'; x.drawImage(TEX, 0, 0, w, h); }
  return c;
}

export async function loadBG() {
  TEX = valueNoiseCanvas(512, 77);
  SPR.clouds = [0, 1, 2, 3, 4, 5].map(i => makeCloud(100 + i, 520 + i * 60, 210 + (i % 3) * 30));
  SPR.cloudsWarm = [0, 1, 2].map(i => makeCloud(300 + i, 560 + i * 70, 220, { lit: '#ffe9c4', sh: '#e09a86', sh2: '#a8708a' }));
  SPR.cloudsDark = [0, 1, 2].map(i => makeCloud(500 + i, 600 + i * 80, 240, { lit: '#5d4a7c', sh: '#3a2b55', sh2: '#24183a', rim: '#7a65a0' }));
  SPR.nebula = makeNebula(2400, 1400, 41);
}

// Draw the brush texture over the current clip region (call inside save/clip)
export function texture(ctx, a = 0.1, op = 'overlay', sc = 1) {
  if (!TEX) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.globalCompositeOperation = op;
  const s = 512 * sc;
  for (let y = -s; y < H + s; y += s) for (let x = -s; x < W + s; x += s) ctx.drawImage(TEX, x, y, s, s);
  ctx.restore();
}

// vertical sky gradient over the full frame
export function sky(ctx, stops) {
  ctx.save();
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
  texture(ctx, 0.035, 'soft-light');
  ctx.restore();
}

export function cloud(ctx, i, x, y, s = 1, set = 'clouds', a = 1) {
  const c = SPR[set][i % SPR[set].length];
  ctx.save(); ctx.globalAlpha *= a;
  ctx.drawImage(c, x - c.width * s / 2, y - c.height * s, c.width * s, c.height * s);
  ctx.restore();
}

// Generic painted ridge drawn across the screen (cached per key)
const ridgeCache = new Map();
export function ridge(ctx, key, x, y, w, h, top, bot, o = {}) {
  let c = ridgeCache.get(key);
  if (!c) { c = makeRidge(o.seed ?? 1, Math.round(w), Math.round(h), top, bot, o); ridgeCache.set(key, c); }
  ctx.drawImage(c, x, y, w, h);
}

// Anime speed-line background: painted two-tone gradient with a hot core, soft wide streaks,
// thin sharp streaks and glints (held on 2s by the caller)
export function speedBG(ctx, t, { a = P.skyDeep, b = P.sky, line = P.white, ang = 0, seed = 1, n = 70, speed = 2600, alpha = 0.55 } = {}) {
  ctx.save();
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.45, W * 0.6);
  rg.addColorStop(0, rgba(mix(b, '#ffffff', 0.5), 0.55)); rg.addColorStop(1, rgba(b, 0));
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  texture(ctx, 0.06, 'soft-light');
  ctx.translate(W / 2, H / 2); ctx.rotate(ang);
  const r = rng(seed);
  const streak = (xx, yy, len, th) => { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + len * 0.5, yy - th * 0.5, xx + len, yy - th / 2); ctx.lineTo(xx + len, yy + th / 2); ctx.quadraticCurveTo(xx + len * 0.5, yy + th * 0.5, xx, yy); ctx.closePath(); ctx.fill(); };
  // soft wide streaks
  ctx.save(); ctx.filter = 'blur(8px)'; ctx.fillStyle = line;
  for (let i = 0; i < n * 0.35; i++) {
    const yy = (r() - 0.5) * H * 1.6, len = 500 + r() * 900, th = 20 + r() * 50, sp = speed * (0.5 + r() * 0.5);
    const xx = ((r() * 4000 - t * sp) % 4000 + 4000) % 4000 - 2000;
    ctx.globalAlpha = alpha * 0.35 * (0.4 + r() * 0.6); streak(xx, yy, len, th);
  }
  ctx.restore();
  ctx.fillStyle = line;
  for (let i = 0; i < n; i++) {
    const yy = (r() - 0.5) * H * 1.6, len = 300 + r() * 900, th = 2 + r() * 9, sp = speed * (0.6 + r() * 0.8);
    const xx = ((r() * 4000 - t * sp) % 4000 + 4000) % 4000 - 2000;
    ctx.globalAlpha = alpha * (0.35 + r() * 0.65); streak(xx, yy, len, th);
  }
  ctx.restore();
}

// Radial sunburst (alternating rays) — hero poses and the logo
export function sunburst(ctx, cx, cy, n, colA, colB, rot = 0, R = 2600) {
  ctx.save();
  ctx.fillStyle = colA; ctx.fillRect(-W, -H, W * 3, H * 3);
  ctx.fillStyle = colB;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i / n * TAU, a1 = a0 + TAU / n / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Starfield (deterministic) with twinkle
export function stars(ctx, seed, n, t, o = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = r() * (o.w ?? W), y = r() * (o.h ?? H), s = 0.6 + r() * r() * 3.2, ph = r() * TAU;
    const tw = 0.55 + 0.45 * Math.sin(t * (2 + r() * 3) + ph);
    ctx.globalAlpha = tw * (o.a ?? 1);
    ctx.fillStyle = r() < 0.15 ? '#ffe9b0' : r() < 0.3 ? '#bfe2ff' : '#ffffff';
    ctx.fillRect((o.x ?? 0) + x - s / 2, (o.y ?? 0) + y - s / 2, s, s);
    if (s > 2.6) { ctx.fillRect(x - s * 2, y - 0.5, s * 4, 1); ctx.fillRect(x - 0.5, y - s * 2, 1, s * 4); }
  }
  ctx.restore();
}

// soft radial glow (screen)
export function bloom(ctx, x, y, r, color, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.4, rgba(color, a * 0.4)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export { mix };
