// One scene, four rendering models. Props are described once as geometric primitives with color ROLES; a look
// maps roles to its palette and draws the primitives in its own model:
//   soft  — the reference's soft-flat vector (airbrushed inner shading, soft drop shadows, radial wall light)
//   pixel — 320×180 pixel art, palette-locked, nearest-neighbour upscale
//   ink   — paper, off-register watercolor washes, boiling hand-drawn ink lines on 8s
//   neon  — night wall, synthwave floor grid, glowing tube outlines
import { P, rgba, mix, lighten, darken } from './palette.js';
import { soft, drop, inner } from './soft.js';
import { hash, rng, TAU } from './core.js';
import { setFont } from './type.js';

export const LOOKS = ['soft', 'pixel', 'ink', 'neon'];

const PX = { ink: '#1d1d22', white: '#fff1e8', teal: '#2f7c78', tealDk: '#1f5452', tealLt: '#58a69c', wood: '#ab5236', woodDk: '#7e2553', pink: '#ff77a8', sky: '#29adff', lime: '#00e436', gold: '#ffec27', orange: '#ffa300', red: '#ff004d', grey: '#c2c3c7', coral: P.coral, coralDk: P.coralDk, black: '#000000' };
export const PIXEL_PALETTE = Object.values(PX);

export const ROLES = {
  soft: {
    wall: P.mustard, floor: darken(P.mustard, 0.16), glow: P.mustardLt, metal: P.ink, shade: P.ink2, bulb: '#fff3c4',
    frame: '#8f5e33', mat: P.ink, star: P.gold, string: P.cream, flags: [P.cream, P.sky, P.pink, P.lime, P.lilac],
    wood: '#9a6537', woodDk: '#6f4423', frost: P.frost, drip: P.pink, candles: [P.sky, P.lime], flame: '#ffb53d',
    giftA: P.berry, giftB: P.sky, ribbon: P.goldLt, balloons: [P.pink, P.sky, P.lime], plate: '#ffffff', berry: P.berry,
  },
  pixel: {
    wall: PX.teal, floor: PX.tealDk, glow: PX.tealLt, metal: PX.ink, shade: PX.ink, bulb: PX.gold,
    frame: PX.wood, mat: PX.ink, star: PX.gold, string: PX.white, flags: [PX.white, PX.sky, PX.pink, PX.lime, PX.orange],
    wood: PX.wood, woodDk: PX.woodDk, frost: PX.white, drip: PX.pink, candles: [PX.sky, PX.lime], flame: PX.gold,
    giftA: PX.red, giftB: PX.sky, ribbon: PX.gold, balloons: [PX.pink, PX.sky, PX.lime], plate: PX.grey, berry: PX.red,
  },
  ink: {
    wall: P.paper, floor: darken(P.paper, 0.06), glow: '#fbf6ea', metal: P.ink, shade: '#8d8a82', bulb: '#f6dd9a',
    frame: '#c9a27a', mat: '#e9dfca', star: '#e8b84a', string: P.ink, flags: ['#e8c37a', '#9cc3d5', '#e7a3a3', '#b5c98e', '#c6b3d9'],
    wood: '#c9a27a', woodDk: '#a7825c', frost: '#fbf3e4', drip: '#e7a3a3', candles: ['#9cc3d5', '#b5c98e'], flame: '#f0b450',
    giftA: '#d98c8c', giftB: '#9cc3d5', ribbon: '#e8c37a', balloons: ['#e7a3a3', '#9cc3d5', '#b5c98e'], plate: '#ffffff', berry: '#c96a6a',
  },
  finale: {
    wall: P.blue, floor: darken(P.blue, 0.22), glow: P.blueLt, metal: P.ink, shade: P.ink2, bulb: '#fff3c4',
    frame: '#8f5e33', mat: P.ink, star: P.gold, string: P.cream, flags: [P.gold, P.cream, P.pink, P.lime, P.sky],
    wood: '#9a6537', woodDk: '#6f4423', frost: P.frost, drip: P.pink, candles: [P.sky, P.lime], flame: '#ffb53d',
    giftA: P.berry, giftB: P.gold, ribbon: P.cream, balloons: [P.pink, P.gold, P.lime], plate: '#ffffff', berry: P.berry,
  },
  neon: {
    wall: P.night, floor: '#140f30', glow: P.nightLt, metal: P.neonPink, shade: P.neonPink, bulb: P.neonGold,
    frame: P.neonCyan, mat: '#120d2a', star: P.neonGold, string: '#b98cff', flags: [P.neonGold, P.neonCyan, P.neonPink, P.neonLime, '#b98cff'],
    wood: P.neonCyan, woodDk: P.neonCyan, frost: P.neonPink, drip: P.neonPink, candles: [P.neonCyan, P.neonLime], flame: P.neonGold,
    giftA: P.neonPink, giftB: P.neonCyan, ribbon: P.neonGold, balloons: [P.neonPink, P.neonCyan, P.neonLime], plate: '#b98cff', berry: P.neonPink,
  },
};
export function roleColor(look, role) {
  const R = ROLES[look];
  const [k, i] = role.split('.');
  const v = R[k];
  return Array.isArray(v) ? v[(+i || 0) % v.length] : v;
}

// ---------------------------------------------------------------- geometry → paths
export function geomPath(g) {
  const p = new Path2D();
  if (g.k === 'rect') p.rect(g.x, g.y, g.w, g.h);
  else if (g.k === 'rrect') p.roundRect(g.x, g.y, g.w, g.h, g.r);
  else if (g.k === 'ellipse') p.ellipse(g.x, g.y, Math.max(0.01, g.rx), Math.max(0.01, g.ry), g.rot || 0, 0, TAU);
  else if (g.k === 'poly') { g.pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
  else if (g.k === 'line') { g.pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); }
  else if (g.k === 'quad') { p.moveTo(g.pts[0][0], g.pts[0][1]); p.quadraticCurveTo(g.pts[1][0], g.pts[1][1], g.pts[2][0], g.pts[2][1]); }
  return p;
}
function bounds(g) {
  if (g.k === 'rect' || g.k === 'rrect') return [g.x, g.y, g.x + g.w, g.y + g.h];
  if (g.k === 'ellipse') return [g.x - g.rx, g.y - g.ry, g.x + g.rx, g.y + g.ry];
  if (g.k === 'text') return [g.x - g.size * 0.4, g.y - g.size * 0.75, g.x + g.size * 0.4, g.y];
  const xs = g.pts.map(p => p[0]), ys = g.pts.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
// hand-drawn outline: bowed, overshooting strokes; seed changes on each boil frame
function sketchPath(g, seed, amt = 2.4) {
  const j = i => (hash(seed * 131 + i * 7) - 0.5) * 2 * amt;
  const p = new Path2D();
  const edge = (a, b, i) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ov = Math.min(L * 0.12, 3 + hash(seed + i) * 5);
    p.moveTo(a[0] - ux * ov + j(i * 5), a[1] - uy * ov + j(i * 5 + 1));
    p.quadraticCurveTo((a[0] + b[0]) / 2 - uy * j(i * 5 + 2) * 1.5, (a[1] + b[1]) / 2 + ux * j(i * 5 + 2) * 1.5, b[0] + ux * ov + j(i * 5 + 3), b[1] + uy * ov + j(i * 5 + 4));
  };
  if (g.k === 'rect' || g.k === 'rrect') {
    const q = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]];
    for (let i = 0; i < 4; i++) edge(q[i], q[(i + 1) % 4], i);
  } else if (g.k === 'poly') {
    for (let i = 0; i < g.pts.length; i++) edge(g.pts[i], g.pts[(i + 1) % g.pts.length], i);
  } else if (g.k === 'line' || g.k === 'quad') {
    const pts = g.k === 'quad' ? quadPts(g.pts, 16) : g.pts;
    pts.forEach(([x, y], i) => (i ? p.lineTo(x + j(i) * 0.5, y + j(i + 50) * 0.5) : p.moveTo(x, y)));
  } else if (g.k === 'ellipse') {
    const n = 28, a0 = hash(seed) * TAU, turn = 1.06;
    for (let i = 0; i <= n; i++) {
      const a = a0 + i / n * TAU * turn, w = 1 + j(i) * 0.012;
      const x = g.x + Math.cos(a) * g.rx * w, y = g.y + Math.sin(a) * g.ry * w;
      const c = Math.cos(g.rot || 0), s = Math.sin(g.rot || 0);
      const X = g.x + (x - g.x) * c - (y - g.y) * s, Y = g.y + (x - g.x) * s + (y - g.y) * c;
      i ? p.lineTo(X, Y) : p.moveTo(X, Y);
    }
  }
  return p;
}
function quadPts([a, c, b], n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
  return out;
}

function applyTf(ctx, tf) {
  if (!tf) return;
  ctx.translate(tf.x || 0, tf.y || 0);
  if (tf.ax !== undefined) {
    ctx.translate(tf.ax, tf.ay);
    if (tf.r) ctx.rotate(tf.r);
    if (tf.s !== undefined) ctx.scale(tf.sx ?? tf.s, tf.sy ?? tf.s);
    ctx.translate(-tf.ax, -tf.ay);
  }
}

// ---------------------------------------------------------------- renderers
// prim: { g, role, cast, line (stroke width for line/quad), a (alpha), tf, k (shading scale), glow (soft light) }
function drawText(ctx, g, mode, col, seed) {
  setFont(ctx, g.size, { fam: 'display', weight: 900, stretch: g.stretch || 'normal' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (mode === 'fill') { ctx.fillStyle = col; ctx.fillText(g.s, g.x, g.y); }
  else { ctx.strokeStyle = col; ctx.strokeText(g.s, g.x, g.y); }
}

export function renderPrims(ctx, prims, lookName, t, o = {}) {
  const look = lookName === 'finale' ? 'soft' : lookName;
  const seed = Math.floor(t * 8 + 1e-6); // ink boil on 8s
  for (const pr of prims) {
    if ((pr.a ?? 1) <= 0) continue;
    const col = pr.color || roleColor(lookName, pr.role);
    ctx.save();
    ctx.globalAlpha *= pr.a ?? 1;
    applyTf(ctx, pr.tf);
    const g = pr.g;
    const isLine = g.k === 'line' || g.k === 'quad';
    if (look === 'soft') {
      if (isLine) { ctx.strokeStyle = col; ctx.lineWidth = pr.line || 3; ctx.lineCap = 'round'; ctx.stroke(geomPath(g)); }
      else if (g.k === 'text') {
        if (pr.cast) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 8; drawText(ctx, g, 'fill', col); ctx.restore(); }
        drawText(ctx, g, 'fill', col);
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
      } else {
        const path = geomPath(g), bb = bounds(g), [, y0, , y1] = bb;
        if (pr.cast) drop(ctx, path, { dx: 16, dy: 12, blur: 22, a: 0.2 * (pr.cast === true ? 1 : pr.cast) });
        soft(ctx, path, col, { k: pr.k ?? 1, b: bb, grad: pr.grad ?? 0.08, sa: pr.sa ?? 0.75, la: pr.la ?? 0.5 });
      }
    } else if (look === 'pixel') {
      if (isLine) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(6, pr.line || 3); ctx.stroke(geomPath(g)); }
      else if (g.k === 'text') drawText(ctx, g, 'fill', col);
      else {
        ctx.fillStyle = col; ctx.fill(geomPath(g));
        // one hard shade step on the lower edge (pixel-art shading)
        if (!pr.noShade && g.k !== 'line') { ctx.save(); ctx.clip(geomPath(g)); const [x0, y0, x1, y1] = bounds(g); const sh = Math.max(6, (y1 - y0) * 0.16); ctx.fillStyle = darken(col, 0.28); ctx.fillRect(x0 - 2, y1 - sh, x1 - x0 + 4, sh + 2); ctx.restore(); }
      }
    } else if (look === 'ink') {
      const s2 = seed * 977 + (pr.id || 0) * 31;
      if (isLine) {
        ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(2.4, (pr.line || 3) * 0.9); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke(sketchPath(g, s2, 1.6));
      } else if (g.k === 'text') {
        ctx.save(); ctx.translate(5, 4); ctx.globalAlpha *= 0.85; drawText(ctx, g, 'fill', col); ctx.restore();
        ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.save(); ctx.translate((hash(s2) - 0.5) * 2, (hash(s2 + 1) - 0.5) * 2); drawText(ctx, g, 'stroke', P.ink); ctx.restore();
      } else {
        const path = geomPath(g);
        ctx.save(); ctx.translate(5 + (hash(pr.id || 0) - 0.5) * 3, 4); ctx.fillStyle = rgba(col, 0.88); ctx.fill(path);
        // watercolor edge darkening
        inner(ctx, path, darken(col, 0.18), 5, -2, -2, 0.7, bounds(g));
        ctx.restore();
        if (pr.cast && !pr.noHatch) hatch(ctx, g, s2);
        ctx.strokeStyle = P.ink; ctx.lineWidth = pr.inkW || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke(sketchPath(g, s2, 2.2));
      }
    } else if (look === 'neon') {
      const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b);
      const tube = (path, w) => {
        for (const [ww, a, bl] of [[w * 3.2, 0.28, 34], [w * 1.7, 0.75, 14], [w * 0.75, 1, 0]]) {
          ctx.shadowColor = rgba(col, a); ctx.shadowBlur = bl * sc;
          ctx.strokeStyle = ww === w * 0.75 ? lighten(col, 0.6) : rgba(col, a);
          ctx.lineWidth = ww; ctx.stroke(path);
        }
      };
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (isLine) tube(geomPath(g), (pr.line || 3) * 0.9);
      else if (g.k === 'text') {
        setFont(ctx, g.size, { fam: 'display', weight: 900 });
        ctx.textAlign = 'center';
        ctx.fillStyle = mix(P.night, col, 0.18); ctx.fillText(g.s, g.x, g.y);
        for (const [ww, a, bl] of [[12, 0.3, 30], [6, 0.8, 12], [2.5, 1, 0]]) { ctx.shadowColor = rgba(col, a); ctx.shadowBlur = bl * sc; ctx.strokeStyle = ww === 2.5 ? lighten(col, 0.6) : rgba(col, a); ctx.lineWidth = ww; ctx.strokeText(g.s, g.x, g.y); }
      } else {
        const path = geomPath(g);
        if (!pr.noFill) { ctx.fillStyle = mix(P.night, col, pr.fillMix ?? 0.14); ctx.fill(path); }
        tube(path, pr.neonW || 4);
      }
    }
    ctx.restore();
  }
}

function hatch(ctx, g, seed) {
  const [x0, y0, x1, y1] = bounds(g);
  ctx.save();
  ctx.clip(geomPath(g));
  ctx.strokeStyle = rgba(P.ink, 0.5); ctx.lineWidth = 2; ctx.lineCap = 'round';
  const w = x1 - x0, h = y1 - y0;
  const n = Math.max(3, Math.floor(w / 16));
  for (let i = 0; i < n; i++) {
    const xx = x0 + w * 0.55 + i * 14 + (hash(seed + i) - 0.5) * 4;
    ctx.beginPath(); ctx.moveTo(xx, y1 + 4); ctx.lineTo(xx + h * 0.5, y1 - h * 0.6); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- walls
let paperTex = null;
function paper() {
  if (paperTex) return paperTex;
  const c = new OffscreenCanvas(512, 512), x = c.getContext('2d');
  const img = x.createImageData(512, 512), r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 34;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // fibers
  x.globalAlpha = 0.12; x.strokeStyle = '#000';
  for (let i = 0; i < 260; i++) { x.beginPath(); const a = r() * TAU, px = r() * 512, py = r() * 512, L = 6 + r() * 18; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
  paperTex = c;
  return c;
}

export const FLOOR_Y = 805;
export function wall(ctx, lookName, o = {}) {
  const R = ROLES[lookName];
  const look = lookName === 'finale' ? 'soft' : lookName;
  const { cx = 900, cy = 470, floorY = FLOOR_Y } = o;
  if (look === 'soft' || look === 'pixel') {
    ctx.fillStyle = darken(R.wall, 0.05); ctx.fillRect(0, 0, 1920, 1080);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1050);
    if (look === 'soft') { g.addColorStop(0, rgba(R.glow, 1)); g.addColorStop(0.42, rgba(mix(R.glow, R.wall, 0.6), 1)); g.addColorStop(1, rgba(R.wall, 0)); }
    else { g.addColorStop(0, R.glow); g.addColorStop(0.3, R.glow); g.addColorStop(0.31, R.wall); g.addColorStop(1, R.wall); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, floorY);
    ctx.fillStyle = R.floor; ctx.fillRect(0, floorY, 1920, 1080 - floorY);
    if (look === 'soft') {
      const fg = ctx.createLinearGradient(0, floorY, 0, floorY + 60);
      fg.addColorStop(0, 'rgba(0,0,0,0.18)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(0, floorY, 1920, 60);
      const fl = ctx.createRadialGradient(cx, floorY + 30, 0, cx, floorY + 30, 900);
      fl.addColorStop(0, rgba(lighten(R.floor, 0.2), 0.8)); fl.addColorStop(1, rgba(R.floor, 0));
      ctx.fillStyle = fl; ctx.fillRect(0, floorY, 1920, 1080 - floorY);
    } else {
      ctx.fillStyle = darken(R.floor, 0.25); ctx.fillRect(0, floorY, 1920, 12);
      // floorboards
      ctx.fillStyle = darken(R.floor, 0.15);
      for (let i = 0; i < 6; i++) ctx.fillRect(((i * 397) % 1920), floorY + 70 + (i % 3) * 70, 220, 8);
    }
  } else if (look === 'ink') {
    ctx.fillStyle = R.wall; ctx.fillRect(0, 0, 1920, 1080);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.16;
    ctx.fillStyle = ctx.createPattern(paper(), 'repeat'); ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
    // a loose wash behind the subject + a sketched floor line
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 760);
    g.addColorStop(0, 'rgba(240, 200, 150, 0.32)'); g.addColorStop(1, 'rgba(240, 200, 150, 0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    const seed = Math.floor((o.t || 0) * 8);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.stroke(sketchPath({ k: 'line', pts: [[40, floorY], [700, floorY + 2], [1300, floorY - 1], [1880, floorY + 1]] }, seed, 2));
    ctx.strokeStyle = rgba(P.ink, 0.35); ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const yy = floorY + 40 + i * 34; ctx.beginPath(); ctx.moveTo(60 + i * 30 + hash(seed + i) * 8, yy); ctx.lineTo(1860 - i * 40, yy + (hash(seed * 3 + i) - 0.5) * 4); ctx.stroke(); }
  } else if (look === 'neon') {
    ctx.fillStyle = R.wall; ctx.fillRect(0, 0, 1920, 1080);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1000);
    g.addColorStop(0, rgba(R.glow, 1)); g.addColorStop(1, rgba(R.wall, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, floorY);
    ctx.fillStyle = R.floor; ctx.fillRect(0, floorY, 1920, 1080 - floorY);
    // synthwave grid
    ctx.save();
    ctx.shadowColor = rgba(P.neonPink, 0.9); ctx.shadowBlur = 12;
    ctx.strokeStyle = rgba(P.neonPink, 0.75); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(1920, floorY); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(P.neonPink, 0.45);
    const scroll = ((o.t || 0) * 0.9) % 1;
    for (let i = 0; i < 8; i++) { const z = (i + scroll) / 8; const yy = floorY + Math.pow(z, 2) * (1080 - floorY); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(1920, yy); ctx.stroke(); }
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(960 + i * 60, floorY); ctx.lineTo(960 + i * 330, 1080); ctx.stroke(); }
    ctx.restore();
    // stars on the wall
    const r = rng(5);
    for (let i = 0; i < 70; i++) { const x = r() * 1920, y = r() * (floorY - 40); const tw = 0.4 + 0.6 * Math.abs(Math.sin((o.t || 0) * (1 + r() * 3) + i)); ctx.fillStyle = rgba('#ffffff', 0.25 * tw); ctx.fillRect(x, y, 3, 3); }
  }
}
