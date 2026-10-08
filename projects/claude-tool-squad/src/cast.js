// Supporting cast for the ensemble line-up (cel layer): the developer, a rubber duck, the CI
// robot, the reviewer cat. Local units: 100 = height; origin = ground under the centre.
import { P, mix } from './palette.js';
import { cel, ink, clipFill, blush } from './cel.js';
import { TAU, clamp } from './core.js';

const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const ell = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); return p; };
const poly = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const LW = s => clamp(s / 100 * 3.2, 1.6, 7);
function begin(ctx, o) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale((o.s / 100) * (o.flip ? -1 : 1), o.s / 100); }

function animeEye(ctx, x, y, w, h, lw, iris = '#3a5a8a', happy = false) {
  if (happy) { ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = w * 0.35; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - w * 0.6, y + h * 0.1); ctx.quadraticCurveTo(x, y - h * 0.5, x + w * 0.6, y + h * 0.1); ctx.stroke(); ctx.restore(); return; }
  const e = ell(x, y, w * 0.55, h * 0.55);
  ctx.fillStyle = '#ffffff'; ctx.fill(e);
  ctx.save(); ctx.clip(e);
  ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(x, y + h * 0.08, w * 0.42, h * 0.48, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = P.line; ctx.beginPath(); ctx.ellipse(x, y + h * 0.1, w * 0.2, h * 0.26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + w * 0.15, y - h * 0.15, w * 0.14, h * 0.16, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.lineWidth = w * 0.16; ctx.strokeStyle = P.line; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - h * 0.4); ctx.quadraticCurveTo(x, y - h * 0.72, x + w * 0.62, y - h * 0.42); ctx.stroke(); ctx.restore();
}

// The developer: hoodie, messy hair, laptop under one arm. Never a cap.
export function dev(ctx, o) {
  o = { x: 0, y: 0, s: 400, t: 0, happy: 0, wave: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const skin = '#f6d2b0', skinSh = '#d9a684', hood = '#2f8c8a', hoodSh = '#1f6463', pants = '#3a3f5a', pantsSh = '#262a40', hair = '#3b2a2a', hairSh = '#22171a';
  // legs + shoes
  for (const sx of [-1, 1]) {
    cel(ctx, rr(sx * 8 - 6.5, -36, 13, 34, 4), pants, { sh: pantsSh, depth: 2, line: lw });
    cel(ctx, rr(sx * 9 - 8, -5, 16, 6, 3), '#f2f0ea', { sh: '#c9c6bd', depth: 1, line: lw });
  }
  // torso (hoodie)
  const torso = poly([[-18, -68], [18, -68], [21, -34], [-21, -34]]);
  cel(ctx, torso, hood, { sh: hoodSh, depth: 4, line: lw, shapes: [rr(-12, -46, 24, 8, 3)] });
  ctx.save(); ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -66); ctx.lineTo(-5, -54); ctx.moveTo(4, -66); ctx.lineTo(5, -54); ctx.stroke(); ctx.restore();
  // left arm holding a laptop
  cel(ctx, rr(-26, -66, 9, 28, 4), hood, { sh: hoodSh, depth: 2, line: lw });
  cel(ctx, rr(-34, -46, 20, 14, 2), '#b9bfcc', { sh: '#8a90a0', depth: 1.5, line: lw });
  ctx.fillStyle = P.coral; ctx.fillRect(-27, -41, 5, 4);
  // right arm (waves)
  const wa = -0.2 - o.wave * 2.2 + Math.sin(o.t * 12) * 0.3 * o.wave;
  const am = new DOMMatrix().translate(21, -64).rotate(wa * 57.3);
  const arm = new Path2D(); arm.addPath(rr(-4.5, 0, 9, 27, 4), am);
  cel(ctx, arm, hood, { sh: hoodSh, depth: 2, line: lw });
  const hand = new Path2D(); hand.addPath(ell(0, 29, 5, 5), am);
  cel(ctx, hand, skin, { sh: skinSh, depth: 1, line: lw });
  // neck + head
  cel(ctx, rr(-4, -74, 8, 8, 2), skin, { sh: skinSh, depth: 1, line: lw });
  const face = ell(0, -86, 15, 16);
  cel(ctx, face, skin, { sh: skinSh, depth: 2.5, line: lw });
  // hood behind the neck
  cel(ctx, poly([[-15, -72], [15, -72], [10, -66], [-10, -66]]), hoodSh, { depth: 0, line: lw * 0.8 });
  // hair: messy spikes
  const hairP = poly([[-17, -84], [-19, -96], [-12, -104], [-6, -100], [-2, -108], [5, -102], [11, -106], [14, -98], [19, -94], [16, -84], [10, -94], [2, -92], [-6, -95], [-12, -90]]);
  cel(ctx, hairP, hair, { sh: hairSh, depth: 2, line: lw, hlShapes: [ell(6, -100, 5, 1.6, -0.3)], hl: '#6a4a4a' });
  animeEye(ctx, -6, -84, 7, 9, lw, '#3f6a9a', o.happy > 0.5);
  animeEye(ctx, 6, -84, 7, 9, lw, '#3f6a9a', o.happy > 0.5);
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); if (o.happy > 0.5) { ctx.moveTo(-4, -76); ctx.quadraticCurveTo(0, -72, 4, -76); } else { ctx.moveTo(-3, -75.5); ctx.lineTo(3, -75.5); } ctx.stroke(); ctx.restore();
  blush(ctx, -10, -79, 2.6, 0.7); blush(ctx, 10, -79, 2.6, 0.7);
  ctx.restore();
}

export function duck(ctx, o) {
  o = { x: 0, y: 0, s: 120, t: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const y = '#ffd23a', ys = '#e0a20a';
  cel(ctx, ell(0, -30, 42, 28), y, { sh: ys, depth: 4, line: lw, hlShapes: [ell(10, -46, 14, 5, -0.2)], hl: '#fff0a0' });
  cel(ctx, ell(-22, -34, 16, 10, 0.4), mix(y, ys, 0.3), { sh: ys, depth: 2, line: lw });
  cel(ctx, ell(18, -66, 22, 21), y, { sh: ys, depth: 3, line: lw });
  cel(ctx, poly([[34, -64], [56, -60], [34, -54]]), P.orange, { sh: '#c06a3a', depth: 1.5, line: lw });
  ctx.fillStyle = P.line; ctx.beginPath(); ctx.arc(24, -72, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(25.5, -73.5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}

export function robot(ctx, o) {
  o = { x: 0, y: 0, s: 300, t: 0, green: 1, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const m = '#9aa9c0', ms = '#6c7a92';
  for (const sx of [-1, 1]) { cel(ctx, rr(sx * 10 - 5, -22, 10, 20, 3), ms, { depth: 0, line: lw }); cel(ctx, rr(sx * 10 - 8, -4, 16, 5, 2), '#4a5468', { depth: 0, line: lw }); }
  for (const sx of [-1, 1]) cel(ctx, rr(sx * 26 - 4, -58, 8, 26, 4), ms, { sh: '#4a5468', depth: 1.5, line: lw });
  const body = rr(-22, -62, 44, 42, 6);
  cel(ctx, body, m, { sh: ms, depth: 4, line: lw, hlShapes: [rr(-16, -59, 30, 3, 2)], hl: '#d0dbea' });
  // traffic-light chest panel
  cel(ctx, rr(-9, -56, 18, 30, 4), '#2a2f3d', { depth: 0, line: lw * 0.8 });
  [['#e23a3a', 0], ['#f2c230', 1], [P.green, 2]].forEach(([c, i]) => { const on = (i === 2) === !!o.green; ctx.fillStyle = on ? c : mix(c, '#2a2f3d', 0.75); ctx.beginPath(); ctx.arc(0, -50 + i * 9, 3.4, 0, TAU); ctx.fill(); });
  const head = rr(-17, -88, 34, 24, 6);
  cel(ctx, head, m, { sh: ms, depth: 3, line: lw });
  cel(ctx, rr(-13, -84, 26, 15, 4), '#1d2230', { depth: 0, line: lw * 0.7 });
  ctx.save(); ctx.strokeStyle = P.greenLt; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 6 - 3.5, -75); ctx.lineTo(sx * 6, -79); ctx.lineTo(sx * 6 + 3.5, -75); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, -97); ctx.stroke(); ctx.restore();
  cel(ctx, ell(0, -99, 3.4, 3.4), P.green, { depth: 0, line: lw * 0.6 });
  ctx.restore();
}

// Reviewer cat holding an LGTM sign
export function cat(ctx, o) {
  o = { x: 0, y: 0, s: 260, t: 0, sign: 1, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const f = '#d9cbb8', fs = '#a8967e', st = '#8a7a66';
  // tail
  const tail = new Path2D(); tail.moveTo(16, -8); tail.quadraticCurveTo(40, -10 + Math.sin(o.t * 3) * 4, 34, -40); tail.lineTo(28, -38); tail.quadraticCurveTo(32, -14, 12, -14); tail.closePath();
  cel(ctx, tail, f, { sh: fs, depth: 2, line: lw });
  const body = ell(0, -28, 22, 28);
  cel(ctx, body, f, { sh: fs, depth: 4, line: lw, shapes: [rr(-22, -40, 44, 4, 0), rr(-22, -30, 44, 3, 0)] });
  for (const sx of [-1, 1]) cel(ctx, poly([[sx * 6, -76], [sx * 20, -92], [sx * 20, -70]]), f, { sh: fs, depth: 1.5, line: lw });
  const head = ell(0, -66, 22, 18);
  cel(ctx, head, f, { sh: fs, depth: 3, line: lw, shapes: [rr(-3, -84, 6, 8, 2)] });
  // half-lidded reviewing eyes
  for (const sx of [-1, 1]) {
    const e = ell(sx * 9, -66, 5, 5);
    ctx.fillStyle = '#c9e86a'; ctx.fill(e);
    ctx.fillStyle = P.line; ctx.beginPath(); ctx.ellipse(sx * 9, -65, 1.6, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = f; ctx.fillRect(sx * 9 - 6, -72, 12, 5);
    ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(sx * 9 - 6, -67); ctx.lineTo(sx * 9 + 6, -67); ctx.stroke(); ctx.restore();
  }
  cel(ctx, poly([[-2.4, -60], [2.4, -60], [0, -57]]), '#e88a9a', { depth: 0, line: lw * 0.5 });
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(sx * 6, -58 + k * 3); ctx.lineTo(sx * 20, -60 + k * 5); ctx.stroke(); } ctx.restore();
  if (o.sign > 0) {
    ctx.save(); ctx.translate(-4, -30); ctx.rotate(-0.08);
    cel(ctx, rr(-2, 0, 4, 30, 1), '#b07a48', { depth: 0, line: lw * 0.7 });
    const board = rr(-24, -14, 48, 22, 3);
    cel(ctx, board, P.paper, { sh: '#ddd5bd', depth: 1.5, line: lw });
    ctx.fillStyle = P.green; ctx.font = '900 13px "Futura", "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LGTM', 0, -2.5);
    ctx.restore();
    for (const sx of [-1, 1]) cel(ctx, ell(sx * 8 - 4, -22, 5, 4), f, { sh: fs, depth: 1, line: lw });
  }
  ctx.restore();
}
