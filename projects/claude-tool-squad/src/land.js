// The codebase land: painted set pieces with no outlines (BG layer). Folder-shaped mesas, tree
// clumps, grass tufts, rock ledges, a far stadium. All seeded, all functions of their inputs.
import { P, mix, rgba } from './palette.js';
import { texture } from './bg.js';
import { rng, TAU, noise } from './core.js';

// painted round-tree clump: dark base, lit top-right dabs, no lines
export function trees(ctx, x, y, s, seed, { n = 5, col = P.forest, lit = P.grass, dark = P.forestDk, haze = 0 } = {}) {
  const r = rng(seed);
  const C = haze ? c => mix(c, P.haze, haze) : c => c;
  const blobs = [];
  for (let i = 0; i < n; i++) blobs.push([x + (r() - 0.5) * s * 1.6, y - r() * s * 0.5, s * (0.35 + r() * 0.35)]);
  blobs.sort((a, b) => a[1] - b[1]);
  ctx.save();
  for (const [bx, by, br] of blobs) {
    ctx.fillStyle = C(dark); ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.fillStyle = C(col); ctx.beginPath(); ctx.arc(bx + br * 0.12, by - br * 0.12, br * 0.86, 0, TAU); ctx.fill();
    ctx.fillStyle = C(lit);
    for (let k = 0; k < 4; k++) { const a = -0.9 + r() * 0.9; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * br * 0.45, by + Math.sin(a) * br * 0.5 - br * 0.1, br * (0.18 + r() * 0.16), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// Folder-shaped mesa: a rock plateau whose top has a folder tab. Lit face + shadow face + strata.
export function mesa(ctx, x, y, w, h, { label = null, haze = 0, seed = 1, top = P.grass, side = P.rock, shade = P.rockDk } = {}) {
  const C = c => mix(c, P.haze, haze);
  const tabW = w * 0.38, tabH = h * 0.12, d = w * 0.16;
  ctx.save();
  // front face
  const face = new Path2D();
  face.moveTo(x, y); face.lineTo(x + w, y); face.lineTo(x + w + w * 0.04, y + h); face.lineTo(x - w * 0.04, y + h); face.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, C(side)); g.addColorStop(1, C(mix(side, shade, 0.6)));
  ctx.fillStyle = g; ctx.fill(face);
  // side (shadow) face
  const sideP = new Path2D(); sideP.moveTo(x + w, y); sideP.lineTo(x + w + d, y - d * 0.45); sideP.lineTo(x + w + d + w * 0.03, y + h - d * 0.45); sideP.lineTo(x + w + w * 0.04, y + h); sideP.closePath();
  ctx.fillStyle = C(shade); ctx.fill(sideP);
  // strata
  ctx.save(); ctx.clip(face);
  const r = rng(seed);
  ctx.strokeStyle = C(mix(side, shade, 0.45)); ctx.lineWidth = Math.max(1, h * 0.012);
  for (let i = 1; i < 6; i++) { const yy = y + h * (i / 6 + (r() - 0.5) * 0.04); ctx.beginPath(); ctx.moveTo(x - 10, yy); for (let k = 0; k <= 8; k++) ctx.lineTo(x + w * k / 8, yy + (r() - 0.5) * h * 0.02); ctx.stroke(); }
  texture(ctx, 0.18, 'overlay', 0.6);
  ctx.restore();
  // grassy top with folder tab
  const topP = new Path2D();
  topP.moveTo(x - 4, y + 4); topP.lineTo(x + d * 0.2, y - d * 0.4);
  topP.lineTo(x + d * 0.2, y - d * 0.4 - tabH); topP.lineTo(x + d * 0.2 + tabW, y - d * 0.4 - tabH); topP.lineTo(x + d * 0.2 + tabW + tabH * 0.8, y - d * 0.4);
  topP.lineTo(x + w + d, y - d * 0.45); topP.lineTo(x + w + 4, y + 4); topP.closePath();
  ctx.fillStyle = C(top); ctx.fill(topP);
  ctx.fillStyle = C(mix(top, P.white, 0.25)); ctx.fillRect(x + d * 0.2 + 4, y - d * 0.4 - tabH + 3, tabW - 8, tabH * 0.3);
  // grass lip hanging over the face
  ctx.fillStyle = C(mix(top, P.forest, 0.35));
  ctx.beginPath(); ctx.moveTo(x - 4, y + 4);
  for (let k = 0; k <= 12; k++) ctx.lineTo(x + w * k / 12, y + 4 + (k % 2 ? h * 0.05 : h * 0.015));
  ctx.lineTo(x + w + 4, y + 4); ctx.closePath(); ctx.fill();
  if (label) {
    ctx.fillStyle = C(mix(side, P.white, 0.55));
    ctx.font = `800 ${Math.round(h * 0.16)}px "SF Mono", Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h * 0.45);
  }
  ctx.restore();
}

// grass tufts along a line (sway on 2s by caller's t)
export function tufts(ctx, x0, x1, y, seed, t, { col = P.grassDk, lit = P.grass, h = 26, n = 30, wind = 1 } = {}) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * r(), hh = h * (0.6 + r() * 0.8), sway = Math.sin(t * 3 + i) * hh * 0.18 * wind;
    ctx.fillStyle = r() < 0.5 ? col : lit;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(x + k * hh * 0.18 - hh * 0.08, y); ctx.quadraticCurveTo(x + k * hh * 0.25, y - hh * 0.5, x + k * hh * 0.35 + sway, y - hh * (k ? 0.8 : 1)); ctx.lineTo(x + k * hh * 0.18 + hh * 0.08, y); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// Painted rock ledge (foreground ground the hero stands on)
export function ledge(ctx, pts, { top = P.grass, rock = P.rock, shade = P.rockDk, seed = 3, lip = 26 } = {}) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  ctx.save();
  const ys = pts.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rock); g.addColorStop(1, shade);
  ctx.fillStyle = g; ctx.fill(p);
  ctx.clip(p);
  // cracks + strata
  const r = rng(seed);
  ctx.strokeStyle = rgba(shade, 0.7); ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const x = Math.min(...pts.map(q => q[0])) + r() * 900, y = y0 + 40 + r() * (y1 - y0); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40 + r() * 80, y + (r() - 0.5) * 30); ctx.lineTo(x + 60 + r() * 120, y + (r() - 0.2) * 40); ctx.stroke(); }
  // grass cap as a thick band following the top edge
  ctx.fillStyle = top; ctx.strokeStyle = top; ctx.lineWidth = lip * 2; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.filter(q => q[1] <= y0 + 60).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.strokeStyle = mix(top, P.white, 0.3); ctx.lineWidth = 6;
  ctx.beginPath(); pts.filter(q => q[1] <= y0 + 60).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 4) : ctx.moveTo(x, y + 4))); ctx.stroke();
  texture(ctx, 0.28, 'overlay');
  ctx.restore();
  return p;
}

// Far-away stadium on the horizon (bowl + light towers)
export function farStadium(ctx, x, y, s, { haze = 0.45, lights = 0 } = {}) {
  const C = c => mix(c, P.haze, haze);
  ctx.save();
  ctx.fillStyle = C('#d9d2c4');
  ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.22, 0, Math.PI, TAU); ctx.lineTo(x + s * 0.92, y + s * 0.18); ctx.lineTo(x - s * 0.92, y + s * 0.18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C('#a99f91'); ctx.fillRect(x - s * 0.92, y + s * 0.02, s * 1.84, s * 0.16);
  ctx.fillStyle = C('#8d8274');
  for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * s * 0.26 - s * 0.02, y + s * 0.02, s * 0.04, s * 0.16);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = C('#9a8f80'); ctx.fillRect(x + sx * s * 0.8 - s * 0.015, y - s * 0.5, s * 0.03, s * 0.5);
    ctx.fillStyle = lights ? '#fff8d0' : C('#efe9da'); ctx.fillRect(x + sx * s * 0.8 - s * 0.07, y - s * 0.56, s * 0.14, s * 0.07);
  }
  ctx.restore();
}
