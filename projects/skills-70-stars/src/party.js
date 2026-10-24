// The party set (one frontal "dollhouse" elevation, like the reference's rooms), as primitives with color roles so
// any look can render it. Space: 1920×1080, floor at FLOOR_Y. `b` = build progress per prop group (0 → 1, eased
// by the caller); `t` drives idle motion (balloon bob, flame flicker, bunting sway).
import { FLOOR_Y } from './looks.js';
import { ease, clamp, lerp, hash, TAU, BEAT } from './core.js';

export const SPOT = { cx: 900, cy: 470 };
export const CLAUDE_X = 760;
export const TILE_AT = { x: 760, y: 250 }; // where the reference tile hangs (string attach = top center)

function starPts(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts;
}
function quadAt([a, c, b], t) { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }
function quadTan([a, c, b], t) { return [2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])]; }
function flamePts(x, y, h, w, sway) {
  // teardrop: tip at top
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = i / 16 * TAU;
    const r = 1;
    const px = Math.sin(a) * w * (0.55 + 0.45 * Math.cos(a / 2) ** 2) * (a < Math.PI ? 1 : 1);
    const py = -Math.cos(a) * h * 0.5;
    const k = (1 - (py / h + 0.5)); // 0 at bottom, 1 at top
    pts.push([x + px * (1 - k * 0.85) + sway * k * k, y + py - h * 0.5]);
  }
  return pts;
}

export function partyPrims(t, b = {}, o = {}) {
  const F = FLOOR_Y;
  const P = [];
  let id = 0;
  const add = (g, role, extra = {}) => P.push({ g, role, id: ++id, ...extra });
  const B = k => clamp(b[k] ?? 1);
  const bob = (i, amp = 8) => Math.sin(t * TAU / (BEAT * 2) + i * 1.7) * amp;

  // lamp (slides in from the left)
  const pl = B('lamp');
  if (pl > 0) {
    const tf = { x: lerp(-520, 0, pl) };
    add({ k: 'rrect', x: 244, y: F - 16, w: 112, h: 16, r: 7 }, 'metal', { tf, cast: 0.6, k: 0.5 });
    add({ k: 'rect', x: 296, y: 420, w: 8, h: F - 436 }, 'metal', { tf, k: 0.3, noShade: true, inkW: 3, neonW: 3 });
    add({ k: 'poly', pts: [[230, 474], [370, 474], [336, 398], [264, 398]] }, 'shade', { tf, cast: true, k: 0.8 });
    add({ k: 'ellipse', x: 300, y: 475, rx: 50, ry: 9 }, 'bulb', { tf, noShade: true, k: 0.3, la: 0, sa: 0.2 });
  }
  // wall frame with a star poster (pops)
  const pf = B('frame');
  if (pf > 0) {
    const tf = { ax: 540, ay: 435, s: pf };
    add({ k: 'rrect', x: 452, y: 330, w: 176, h: 210, r: 6 }, 'frame', { tf, cast: true, k: 0.8 });
    add({ k: 'rect', x: 472, y: 350, w: 136, h: 170 }, 'mat', { tf, k: 0.6, sa: 0.5, la: 0.15, noHatch: true });
    add({ k: 'poly', pts: starPts(540, 438, 50, 22) }, 'star', { tf, k: 0.5, noShade: true });
  }
  // bunting (drops from the top, sways)
  const pb = B('bunting');
  if (pb > 0) {
    const sway = Math.sin(t * TAU / (BEAT * 4)) * 10;
    const q = [[60, 110], [960, 330 + sway], [1860, 110]];
    const tf = { y: lerp(-420, 0, pb) };
    add({ k: 'quad', pts: q }, 'string', { tf, line: 4 });
    const N = 15;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const [x, y] = quadAt(q, u), [tx, ty] = quadTan(q, u), L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L;
      const w = 38, h = 92, nx = -uy, ny = ux;
      const flap = Math.sin(t * 5 + i) * 0.04;
      const tip = [x + nx * h * (1 - flap) + ux * flap * h, y + ny * h];
      add({ k: 'poly', pts: [[x - ux * w, y - uy * w], [x + ux * w, y + uy * w], tip] }, 'flags.' + i, { tf, k: 0.5, cast: 0.5 });
    }
  }
  // table (rises from the floor)
  const pt = B('table');
  if (pt > 0) {
    const tf = { ax: 1210, ay: F, s: 1, sx: 1, sy: ease.outBack(pt) };
    add({ k: 'rect', x: 1040, y: 686, w: 24, h: F - 686 }, 'woodDk', { tf, cast: true, k: 0.4 });
    add({ k: 'rect', x: 1356, y: 686, w: 24, h: F - 686 }, 'woodDk', { tf, cast: true, k: 0.4 });
    add({ k: 'rect', x: 1022, y: 664, w: 376, h: 24 }, 'woodDk', { tf, k: 0.5 });
    add({ k: 'rrect', x: 1000, y: 640, w: 420, h: 28, r: 7 }, 'wood', { tf, cast: true, k: 0.6 });
  }
  // cake on a stand (drops onto the table) + number candles 7 and 0
  const pc = B('cake');
  if (pc > 0) {
    const sq = o.cakeSquash || 0;
    const tf = { y: lerp(-760, 0, pc), ax: 1210, ay: 640, s: 1, sx: 1 + sq * 0.12, sy: 1 - sq * 0.12 };
    add({ k: 'rect', x: 1190, y: 618, w: 40, h: 22 }, 'plate', { tf, k: 0.4 });
    add({ k: 'rrect', x: 1080, y: 602, w: 260, h: 18, r: 9 }, 'plate', { tf, cast: true, k: 0.5 });
    add({ k: 'rrect', x: 1100, y: 470, w: 220, h: 134, r: 16 }, 'frost', { tf, cast: true, k: 1 });
    // drip band
    const pts = [[1104, 478], [1110, 470], [1310, 470], [1316, 478], [1316, 500]];
    const drips = [0.08, 0.2, 0.33, 0.47, 0.6, 0.74, 0.88];
    for (let i = drips.length - 1; i >= 0; i--) {
      const x = 1316 - (1 - drips[i]) * 0 - (1 - drips[i]) * 212 + 0;
      const L = 18 + hash(i * 9 + 1) * 34;
      pts.push([x + 13, 502], [x + 11, 502 + L], [x + 3, 508 + L + 4], [x - 5, 502 + L], [x - 7, 504]);
    }
    pts.push([1104, 500]);
    add({ k: 'poly', pts }, 'drip', { tf, k: 0.6 });
    add({ k: 'ellipse', x: 1146, y: 560, rx: 10, ry: 10 }, 'berry', { tf, k: 0.2, la: 0.6 });
    add({ k: 'ellipse', x: 1210, y: 574, rx: 10, ry: 10 }, 'berry', { tf, k: 0.2, la: 0.6 });
    add({ k: 'ellipse', x: 1274, y: 560, rx: 10, ry: 10 }, 'berry', { tf, k: 0.2, la: 0.6 });
    const pk = B('candles');
    if (pk > 0) {
      const ct = { ...tf, ax: 1210, ay: 470, s: ease.outBack(pk) };
      ['7', '0'].forEach((ch, i) => {
        const x = i ? 1258 : 1162;
        add({ k: 'line', pts: [[x, 386], [x + 1, 366]] }, 'metal', { tf: ct, line: 4 });
        add({ k: 'text', s: ch, x, y: 470, size: 122 }, 'candles.' + i, { tf: ct, cast: true });
      });
      if (b.flames !== 0) {
        ['7', '0'].forEach((ch, i) => {
          const x = i ? 1259 : 1163;
          const fl = Math.sin(t * 23 + i * 2) * 0.12 + Math.sin(t * 37 + i) * 0.08;
          const h = 40 * (1 + fl) * (b.flames ?? 1), sway = Math.sin(t * 9 + i * 3) * 4;
          add({ k: 'poly', pts: flamePts(x, 366, h, 13 * (b.flames ?? 1), sway) }, 'flame', { tf: ct, k: 0.25, noShade: true, glow: true, la: 0.8, sa: 0.3 });
        });
      }
    }
  }
  // gifts (drop and bounce)
  const pg = B('gifts');
  if (pg > 0) {
    const tf = { y: lerp(-900, 0, pg) };
    add({ k: 'rrect', x: 1470, y: 690, w: 160, h: F - 690, r: 6 }, 'giftA', { tf, cast: true, k: 1 });
    add({ k: 'rect', x: 1538, y: 690, w: 24, h: F - 690 }, 'ribbon', { tf, k: 0.3, noShade: true });
    add({ k: 'rrect', x: 1460, y: 676, w: 180, h: 28, r: 5 }, 'giftA', { tf, cast: 0.5, k: 0.6 });
    add({ k: 'rect', x: 1538, y: 676, w: 24, h: 28 }, 'ribbon', { tf, k: 0.3, noShade: true });
    const t2 = { y: lerp(-1100, 0, clamp(pg * 1.1)) };
    add({ k: 'rrect', x: 1495, y: 586, w: 110, h: 90, r: 6 }, 'giftB', { tf: t2, cast: true, k: 0.8 });
    add({ k: 'rect', x: 1538, y: 586, w: 24, h: 90 }, 'ribbon', { tf: t2, k: 0.3, noShade: true });
    add({ k: 'rrect', x: 1487, y: 574, w: 126, h: 24, r: 5 }, 'giftB', { tf: t2, k: 0.5 });
    add({ k: 'ellipse', x: 1531, y: 560, rx: 24, ry: 13, rot: -0.5 }, 'ribbon', { tf: t2, k: 0.3 });
    add({ k: 'ellipse', x: 1569, y: 560, rx: 24, ry: 13, rot: 0.5 }, 'ribbon', { tf: t2, k: 0.3 });
    add({ k: 'ellipse', x: 1550, y: 567, rx: 9, ry: 9 }, 'ribbon', { tf: t2, k: 0.2 });
  }
  // balloons (inflate, then bob on the beat)
  const pB = B('balloons');
  if (pB > 0) {
    const knotTo = [1550, 566];
    const balloons = [[1700, 318, 64, 78], [1812, 286, 58, 72], [1756, 430, 58, 70]];
    balloons.forEach(([x, y, rx, ry], i) => {
      const s = ease.outBack(clamp(pB * 1.25 - i * 0.12));
      if (s <= 0) return;
      const yy = y + bob(i) - (1 - s) * 60;
      const kx = x, ky = yy + ry;
      add({ k: 'quad', pts: [[kx, ky + 8], [lerp(kx, knotTo[0], 0.5) + 30 * (i - 1), lerp(ky, knotTo[1], 0.5) + 40], knotTo] }, 'string', { line: 3, a: s });
      add({ k: 'poly', pts: [[kx - 9, ky + 12], [kx + 9, ky + 12], [kx, ky - 2]] }, 'balloons.' + i, { k: 0.2, tf: { ax: kx, ay: ky, s } });
      add({ k: 'ellipse', x, y: yy, rx, ry }, 'balloons.' + i, { cast: true, k: 1.2, la: 0.9, tf: { ax: kx, ay: ky, s } });
    });
  }
  return P;
}

// Claude's party moves: a little dance on the beat (bounce, alternating arms, step legs, looks around)
export function danceClaude(t, t0, o = {}) {
  const dt = t - t0;
  const ph = (dt / BEAT) % 1, n = Math.floor(dt / BEAT);
  const bounce = Math.abs(Math.sin(ph * Math.PI));
  const side = n % 2 ? 1 : -1;
  return {
    y: -bounce * 26,
    sy: 1 + (1 - bounce) * 0.05 - (ph < 0.12 ? (0.12 - ph) * 1.2 : 0),
    sx: 1 - (1 - bounce) * 0.03 + (ph < 0.12 ? (0.12 - ph) * 0.9 : 0),
    arms: side > 0 ? [0.2, 0.6 + bounce * 0.9] : [0.6 + bounce * 0.9, 0.2],
    legs: side > 0 ? [0, 0, 0, bounce * 10] : [bounce * 10, 0, 0, 0],
    look: [side * 0.6, -0.2],
    lean: side * 0.04 * bounce,
  };
}
