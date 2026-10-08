// Stunt props: wrecking-ball mouse, ~/ folder rack, commit dominoes, test scoreboard, database stack,
// wastebasket, GPU rockets, toy sandbox. Centimetres, y = 0 at the surface they stand on.
import { P, mix, rgba } from './palette.js';
import { LIGHTS, lit, tone } from './props.js';
import { rectP, rrP, circP, ellP, polyP, blobP, union, fill, solid, crescent, glow, text, sparkle, font } from './draw.js';
import { TAU, clamp, lerp, hash, rng, ease } from './core.js';

// ---------- computer mouse (side view), origin bottom-center ----------
export function mouse(ctx, L, x, y, s = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const body = new Path2D();
  body.moveTo(-5.6, 0); body.lineTo(5.2, 0);
  body.quadraticCurveTo(6.2, -0.2, 5.6, -1.6);
  body.bezierCurveTo(4.6, -3.6, 0.5, -4.4, -2.5, -3.7);
  body.bezierCurveTo(-5.2, -3.1, -6.2, -1.2, -5.6, 0);
  body.closePath();
  const l = lit(L, x, y - 2, 0.3);
  solid(ctx, body, tone(L, P.cream), { sh: [tone(L, '#a9a6c4'), l.sh[1], 0.25], rim: [L.rim, l.rim[1], l.rim[2]] });
  fill(ctx, rectP(-5.6, -0.7, 11.2, 0.7), tone(L, P.ink3));
  // button seam + wheel
  ctx.strokeStyle = tone(L, '#8b88a8'); ctx.lineWidth = 0.14;
  ctx.beginPath(); ctx.moveTo(1.2, -3.85); ctx.lineTo(4.4, -2.6); ctx.stroke();
  fill(ctx, rrP(2.2, -4.3, 1.4, 0.9, 0.4), tone(L, P.red));
  ctx.restore();
  // cable anchor (front tip) in caller space
  const a = [5.8, -1.2];
  return [x + (a[0] * Math.cos(rot) - a[1] * Math.sin(rot)) * s, y + (a[0] * Math.sin(rot) + a[1] * Math.cos(rot)) * s];
}

// cable: smooth sagging curve between points
export function cable(ctx, L, pts, w = 0.35, col = P.ink3) {
  ctx.save();
  ctx.strokeStyle = tone(L, col); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const lst = pts[pts.length - 1];
  ctx.lineTo(lst[0], lst[1]);
  ctx.stroke();
  ctx.strokeStyle = rgba(L.rim, 0.55); ctx.lineWidth = w * 0.3;
  ctx.stroke();
  ctx.restore();
}

// ---------- the ~/ folder rack: stepped organizer with tabbed folders ----------
export const RACK_FOLDERS = [
  { tab: 'Pictures', col: P.lemon, tabCol: P.blue, h: 21, paper: 'photo' },
  { tab: 'Desktop', col: '#f7e08a', tabCol: P.red, h: 17, paper: 'paper' },
  { tab: 'Documents', col: P.lemon, tabCol: P.cream, h: 13, paper: 'thesis' },
];
export function folderRack(ctx, L, x, y, o = {}) {
  const { gone = 0, wobble = 0, w = 17 } = o;
  const l = lit(L, x, y - 10, 0.3);
  // back tiers of the wire rack
  const steps = [[0, 22], [1, 18], [2, 14]];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble);
  const frame = tone(L, P.ink3);
  steps.forEach(([i, h]) => {
    const fx = -w / 2 + i * 0.8;
    if (gone < 1) {
      const f = RACK_FOLDERS[i];
      const lift = gone > 0 ? 0 : 0;
      // paper peeking out
      if (f.paper === 'photo') {
        ctx.save(); ctx.translate(fx + 9, -f.h - 1.8 - lift); ctx.rotate(0.12);
        fill(ctx, rectP(0, 0, 5.2, 4), tone(L, P.cream)); photoArt(ctx, 0, 0, 5.2, 4, L); ctx.restore();
      } else if (f.paper === 'thesis') {
        ctx.save(); ctx.translate(fx + 3, -f.h - 2.8); ctx.rotate(-0.06);
        fill(ctx, rectP(0, 0, 8, 6), tone(L, P.paper));
        text(ctx, 'thesis_FINAL_v7', 0.6, 1.5, tone(L, P.navy), 0.95, { fam: 'mono', weight: 700 });
        for (let k = 0; k < 3; k++) fill(ctx, rectP(0.6, 2.4 + k * 0.9, 5 + hash(k) * 2, 0.3), tone(L, '#9aa0c8'));
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(fx + 5, -f.h - 2.2); ctx.rotate(0.05);
        fill(ctx, rectP(0, 0, 7, 5), tone(L, P.paper));
        text(ctx, 'taxes_2026.pdf', 0.5, 1.4, tone(L, P.redDk), 0.85, { fam: 'mono', weight: 700 });
        ctx.restore();
      }
      // folder body with tab
      const tabX = fx + 1.2 + i * 4.6, tabW = 7.2;
      const fp = polyP([[fx, 0], [fx, -f.h], [tabX, -f.h], [tabX + 0.6, -f.h - 1.6], [tabX + tabW - 0.6, -f.h - 1.6], [tabX + tabW, -f.h], [fx + w - 0.4, -f.h], [fx + w - 0.4, 0]]);
      solid(ctx, fp, tone(L, f.col), { sh: [tone(L, P.gold), -0.5, 0.4], rim: [L.rim, l.rim[1] * 0.8, -0.18] });
      fill(ctx, rrP(tabX + 0.5, -f.h - 1.35, tabW - 1, 1.2, 0.3), tone(L, f.tabCol));
      text(ctx, f.tab, tabX + tabW / 2, -f.h - 0.42, tone(L, f.tabCol === P.cream ? P.ink : P.cream), 0.92, { align: 'center', fam: 'cond', weight: 700 });
    }
    // wire tier
    fill(ctx, rectP(fx - 0.6, -h * 0.35, 0.35, h * 0.35), frame);
  });
  // front wire frame
  solid(ctx, polyP([[-w / 2 - 1, 0], [w / 2 + 1.6, 0], [w / 2 + 1.6, -7], [w / 2 + 1.1, -7], [w / 2 + 1.1, -0.6], [-w / 2 - 0.5, -0.6], [-w / 2 - 0.5, -10], [-w / 2 - 1, -10]]), frame, { rim: [L.rim, 0.15, -0.15] });
  for (let i = 0; i < 6; i++) fill(ctx, rectP(-w / 2 + i * 3.2, -6.5, 0.22, 6), mix(frame, L.rim, 0.25));
  fill(ctx, rectP(-w / 2 - 0.5, -6.6, w + 2, 0.3), mix(frame, L.rim, 0.35));
  // ~/ label plate
  fill(ctx, rrP(-3, -4.6, 6, 2.6, 0.4), tone(L, P.cream));
  text(ctx, '~/', 0, -2.65, tone(L, P.ink), 1.9, { align: 'center', fam: 'mono', weight: 800 });
  ctx.restore();
}
// tiny wedding photo illustration (two figures + heart), drawn into a w x h card at (x,y)
export function photoArt(ctx, x, y, w, h, L = null) {
  const T = c => (L ? tone(L, c) : c);
  const m = w * 0.08;
  fill(ctx, rectP(x + m, y + m, w - m * 2, h * 0.72), T(P.sky));
  fill(ctx, circP(x + w * 0.7, y + h * 0.28, w * 0.08), T(P.lemon));
  fill(ctx, rectP(x + m, y + h * 0.6, w - m * 2, h * 0.12 + m * 0.1), T('#7fb08a'));
  const fig = (fx, c, dress) => {
    fill(ctx, circP(fx, y + h * 0.33, w * 0.06), T(P.ink));
    fill(ctx, polyP(dress ? [[fx - w * 0.09, y + h * 0.72], [fx + w * 0.09, y + h * 0.72], [fx + w * 0.03, y + h * 0.4], [fx - w * 0.03, y + h * 0.4]] : [[fx - w * 0.06, y + h * 0.72], [fx + w * 0.06, y + h * 0.72], [fx + w * 0.06, y + h * 0.41], [fx - w * 0.06, y + h * 0.41]]), T(c));
  };
  fig(x + w * 0.38, P.navy, false);
  fig(x + w * 0.56, P.cream, true);
  sparkle(ctx, x + w * 0.47, y + h * 0.2, w * 0.05, T(P.red));
}

// ---------- domino (face to camera), pivot at bottom-right corner, ang 0..~1.3 falling right ----------
export const DOM_W = 2.4, DOM_H = 5.0;
export function domino(ctx, L, x, y, ang, i, o = {}) {
  ctx.save();
  ctx.translate(x + DOM_W / 2, y);
  ctx.rotate(ang);
  const l = lit(L, x, y - 3, 0.18);
  const face = rrP(-DOM_W, -DOM_H, DOM_W, DOM_H, 0.3);
  const base = o.color || P.cream;
  solid(ctx, face, tone(L, base), { sh: [tone(L, mix(base, P.navy, 0.45)), -0.35, 0], rim: [L.rim, 0.18, -0.18] });
  fill(ctx, rectP(-DOM_W + 0.3, -DOM_H / 2 - 0.06, DOM_W - 0.6, 0.12), tone(L, P.ink3));
  // pips
  const r = rng(i * 7 + 3);
  const pip = (cx, cy) => fill(ctx, circP(cx, cy, 0.2), tone(L, P.ink));
  for (const half of [0, 1]) {
    const n = 1 + Math.floor(r() * 4);
    const cy = -DOM_H * (half ? 0.25 : 0.75), cx = -DOM_W / 2;
    const spots = [[0, 0], [-0.55, -0.55], [0.55, 0.55], [0.55, -0.55], [-0.55, 0.55]].slice(n % 2 ? 0 : 1, n % 2 ? n : n + 1);
    spots.forEach(([a, b]) => pip(cx + a, cy + b));
  }
  // commit hash, tiny
  if (o.hash) {
    ctx.save();
    ctx.translate(-DOM_W / 2, -DOM_H - 0.5);
    text(ctx, o.hash, 0, 0, tone(L, P.termDim), 0.62, { align: 'center', fam: 'mono', weight: 600 });
    ctx.restore();
  }
  ctx.restore();
}

// ---------- book stack used as steps ----------
export function books(ctx, L, x, y, list) {
  let yy = y;
  for (const [w, h, c, dx = 0] of list) {
    const l = lit(L, x + dx, yy - h / 2, 0.25);
    solid(ctx, rectP(x + dx - w / 2, yy - h, w, h), tone(L, c), { sh: [tone(L, mix(c, P.ink, 0.4)), 0, 0.5], rim: [L.rim, 0, -0.22] });
    fill(ctx, rectP(x + dx - w / 2 + 1, yy - h * 0.62, w - 2, h * 0.22), tone(L, mix(c, P.cream, 0.55)));
    yy -= h;
  }
}

// ---------- test scoreboard sitting on top of the monitor ----------
export function scoreboard(ctx, L, x, y, o = {}) {
  const { bulbs = [1, 1, 1], blink = 0, green = 0, passing = 212, failing = 3, t = 0 } = o;
  const w = 16, h = 7.5;
  const l = lit(L, x, y - 4, 0.25);
  solid(ctx, rrP(x - w / 2, y - h, w, h, 0.6), tone(L, P.ink2), { rim: [L.rim, l.rim[1] * 0.6, -0.2] });
  fill(ctx, rrP(x - w / 2 + 0.6, y - h + 0.6, w - 1.2, h - 1.2, 0.4), '#05040a');
  text(ctx, 'TESTS', x - w / 2 + 1.3, y - h + 2.3, P.termDim, 1.25, { fam: 'mono', weight: 700 });
  text(ctx, `✓ ${passing}`, x - w / 2 + 1.3, y - 1.6, green ? P.green : P.cream, 2.1, { fam: 'mono', weight: 700 });
  const fc = failing > 0 ? (blink ? P.red : P.redDk) : (green ? P.green : P.termDim);
  text(ctx, `✗ ${failing}`, x + w / 2 - 1.2, y - 1.6, fc, 2.1, { fam: 'mono', weight: 700, align: 'right' });
  if (green) {
    text(ctx, 'ALL PASSING', x + w / 2 - 1.2, y - h + 2.3, P.green, 1.15, { fam: 'mono', weight: 800, align: 'right' });
    glow(ctx, x, y - h / 2, 12, P.green, 0.25 * green);
  }
  // single status beacon on top
  const bx = x + w / 2 - 3, by = y - h;
  const col = green ? P.green : P.red;
  const on = green ? 1 : blink;
  fill(ctx, rrP(bx - 1.6, by - 0.9, 3.2, 0.9, 0.2), tone(L, P.ink3));
  const dome = new Path2D(); dome.moveTo(bx - 1.3, by - 0.9); dome.lineTo(bx - 1.3, by - 2.4); dome.arc(bx, by - 2.4, 1.3, Math.PI, 0); dome.lineTo(bx + 1.3, by - 0.9); dome.closePath();
  fill(ctx, dome, on ? col : mix(col, P.ink, 0.55));
  fill(ctx, ellP(bx - 0.45, by - 2.75, 0.32, 0.6, 0.3), rgba(P.cream, on ? 0.8 : 0.3));
  if (on) glow(ctx, bx, by - 2.2, 7, col, 0.55);
}

// ---------- database cylinder (the classic DB icon), origin bottom-center ----------
export function dbDisc(ctx, L, x, y, label, o = {}) {
  const { w = 6.4, h = 3.2, rot = 0, col = P.blue } = o;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const ry = w * 0.16;
  const body = new Path2D();
  body.moveTo(-w / 2, -h); body.lineTo(-w / 2, 0); body.ellipse(0, 0, w / 2, ry, 0, Math.PI, 0, true); body.lineTo(w / 2, -h); body.closePath();
  const l = lit(L, x, y - 2, 0.3);
  solid(ctx, body, tone(L, col), { sh: [tone(L, mix(col, P.ink, 0.45)), l.sh[1] * 0.8, 0], rim: [L.rim, l.rim[1] * 0.8, 0] });
  fill(ctx, ellP(0, -h, w / 2, ry), tone(L, mix(col, P.cream, 0.55)));
  fill(ctx, ellP(0, -h, w / 2 - 0.5, ry - 0.2), tone(L, mix(col, P.cream, 0.3)));
  text(ctx, label, 0, -h * 0.28, tone(L, P.cream), 1.05, { align: 'center', fam: 'mono', weight: 800 });
  ctx.restore();
}

// ---------- wastebasket (mesh). part: 'back' | 'front' ----------
export function bin(ctx, L, x, y, part) {
  const wt = 15, wb = 11, h = 19;
  const poly = polyP([[x - wt / 2, y - h], [x + wt / 2, y - h], [x + wb / 2, y], [x - wb / 2, y]]);
  if (part === 'back') {
    fill(ctx, poly, tone(L, '#0b0a1c'));
    fill(ctx, ellP(x, y - h, wt / 2, 1.4), tone(L, '#05040d'));
    return;
  }
  ctx.save();
  ctx.clip(poly);
  ctx.strokeStyle = tone(L, '#3d3a82'); ctx.lineWidth = 0.22;
  for (let i = -12; i < 12; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * 1.4 - 8, y - h); ctx.lineTo(x + i * 1.4 + 8, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + i * 1.4 + 8, y - h); ctx.lineTo(x + i * 1.4 - 8, y); ctx.stroke();
  }
  ctx.restore();
  crescent(ctx, poly, rgba(L.rim, 0.8), 0.35, 0);
  solid(ctx, rrP(x - wt / 2 - 0.4, y - h - 0.6, wt + 0.8, 1.2, 0.5), tone(L, P.ink3), { rim: [L.rim, 0, -0.25] });
  fill(ctx, rrP(x - wb / 2 - 0.2, y - 1, wb + 0.4, 1, 0.3), tone(L, P.ink3));
}

// ---------- GPU rocket ----------
export function rocket(ctx, L, x, y, s = 1, rot = 0, o = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const body = rrP(-0.75, -4.2, 1.5, 4.2, 0.2);
  solid(ctx, body, tone(L, P.cream), { sh: [tone(L, '#a9a6c4'), -0.35, 0], rim: [L.rim, 0.2, 0] });
  fill(ctx, polyP([[-0.75, -4.2], [0, -6.2], [0.75, -4.2]]), tone(L, P.red));
  fill(ctx, polyP([[-0.75, -1.6], [-1.6, 0.2], [-0.75, 0]]), tone(L, P.red));
  fill(ctx, polyP([[0.75, -1.6], [1.6, 0.2], [0.75, 0]]), tone(L, P.red));
  fill(ctx, rectP(-0.75, -3.1, 1.5, 1.0), tone(L, P.ink2));
  text(ctx, 'GPU', 0, -2.35, P.lemon, 0.62, { align: 'center', fam: 'mono', weight: 800 });
  if (o.fuse !== false) { ctx.strokeStyle = tone(L, P.ink3); ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.6, 0.8, 0.2, 1.4); ctx.stroke(); }
  ctx.restore();
}

// ---------- toy sandbox (epilogue) ----------
export function sandbox(ctx, L, x, y, w = 40, part = 'back') {
  const h = 5.5;
  if (part === 'back') {
    solid(ctx, rectP(x - w / 2, y - h - 1.2, w, 1.4), tone(L, '#b0763e'), { rim: [L.rim, 0, -0.25] });
    fill(ctx, rectP(x - w / 2 + 0.8, y - h, w - 1.6, h), tone(L, '#f2d27a'));
    return;
  }
  const front = rectP(x - w / 2, y - h + 1.2, w, h - 1.2);
  solid(ctx, front, tone(L, '#c98a4b'), { sh: [tone(L, '#8a5528'), 0, 0.7], rim: [L.rim, 0, -0.25] });
  for (let i = 1; i < 4; i++) fill(ctx, rectP(x - w / 2, y - h + 1.2 + i * 1.05, w, 0.12), tone(L, '#a56f38'));
  fill(ctx, rectP(x - w / 2 + 1, y - h + 2, 0.5, 0.5), tone(L, P.ink3));
  fill(ctx, rectP(x + w / 2 - 1.5, y - h + 2, 0.5, 0.5), tone(L, P.ink3));
}
