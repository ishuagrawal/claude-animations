// The bugs (cel layer). Local units: 100 = the creature's height; origin = ground under it.
// Off-by-One (centipede with one segment too many, tagged "+1") · Race Condition (beetle twins
// "1" and "2" who never arrive in order) · Flaky Test (a moth with a ✓ wing and a ✗ wing that
// flickers in and out) · Merge Conflict (two-headed beast; its spine is the ======= separator).
import { P, mix, rgba } from './palette.js';
import { cel, ink, clipFill } from './cel.js';
import { TAU, clamp, lerp, hash } from './core.js';

const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const ell = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); return p; };
const poly = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const LW = s => clamp(s / 100 * 3.6, 1.6, 7);
function begin(ctx, o) {
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0);
  ctx.scale((o.s / 100) * (o.flip ? -1 : 1), o.s / 100);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
}
function angryEye(ctx, x, y, r, lw, look = [0, 0], side = 1, mood = 'angry') {
  const e = ell(x, y, r, r * 1.1);
  ctx.fillStyle = mood === 'dizzy' ? '#ffffff' : '#fff6a0'; ctx.fill(e);
  ctx.save(); ctx.clip(e);
  ctx.fillStyle = P.line; ctx.beginPath(); ctx.arc(x + look[0] * r * 0.35, y + look[1] * r * 0.3 + r * 0.15, r * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + look[0] * r * 0.35 + r * 0.18, y - r * 0.05, r * 0.16, 0, TAU); ctx.fill();
  if (mood === 'angry') { ctx.fillStyle = mix(P.purpleDk, P.line, 0.3); ctx.beginPath(); ctx.moveTo(x - r * 1.2, y - r * 1.2 + (side > 0 ? r * 0.9 : 0)); ctx.lineTo(x + r * 1.2, y - r * 1.2 + (side > 0 ? 0 : r * 0.9)); ctx.lineTo(x + r * 1.2, y - r * 1.4); ctx.lineTo(x - r * 1.2, y - r * 1.4); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ink(ctx, e, lw * 0.8);
}

// ------------------------------------------------------------------ OFF-BY-ONE: centipede
export function centipede(ctx, o) {
  o = { x: 0, y: 0, s: 160, t: 0, n: 8, look: [0, 0], wiggle: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = '#7a4bb0', sh = '#4e2c7a', leg = '#2e1c45';
  const segs = [];
  for (let i = 0; i <= o.n; i++) {
    const u = i / o.n;
    segs.push([-i * 17, -24 - Math.sin(u * Math.PI * 1.6 + o.wiggle) * 10 * u - (i === 0 ? 14 : 0), i === 0 ? 20 : 15 - u * 3]);
  }
  // legs first
  segs.forEach(([x, y, r], i) => {
    if (i === 0) return;
    for (const sx of [-1, 1]) {
      const a = sx * 0.35 + Math.sin(o.t * 14 + i * 1.3) * 0.25;
      const p = new Path2D(); p.addPath(rr(-1.8, 0, 3.6, 18, 1.8), new DOMMatrix().translate(x + sx * 4, y + r * 0.5).rotate(a * 57.3));
      cel(ctx, p, leg, { depth: 0, line: lw * 0.6 });
    }
  });
  // segments back to front
  for (let i = segs.length - 1; i >= 0; i--) {
    const [x, y, r] = segs[i];
    const p = ell(x, y, r, r * 0.95);
    cel(ctx, p, i === segs.length - 1 ? '#c95fd0' : base, { sh, depth: 3, line: lw, hlShapes: [ell(x + r * 0.35, y - r * 0.5, r * 0.3, r * 0.14, -0.4)], hl: '#b48ae0' });
    if (i === segs.length - 1) { // the extra segment, tagged
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.font = `900 ${r * 1.1}px "Futura", "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', x, y + 1); ctx.restore();
    }
  }
  // head: antennae + eyes + fangs
  const [hx, hy] = segs[0];
  for (const sx of [-1, 1]) { ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(hx + sx * 6, hy - 16); ctx.quadraticCurveTo(hx + sx * 14 + 6, hy - 34, hx + sx * 22 + 8, hy - 30); ctx.stroke(); ctx.restore(); }
  angryEye(ctx, hx - 7 + 4, hy - 5, 6, lw, o.look, -1); angryEye(ctx, hx + 7 + 4, hy - 5, 6, lw, o.look, 1);
  for (const sx of [-1, 1]) cel(ctx, poly([[hx + 4 + sx * 5, hy + 10], [hx + 4 + sx * 2, hy + 10], [hx + 4 + sx * 4, hy + 18]]), '#ffffff', { depth: 0, line: lw * 0.5 });
  ctx.restore();
}

// ------------------------------------------------------------------ RACE CONDITION: beetle twins
export function beetle(ctx, o) {
  o = { x: 0, y: 0, s: 90, t: 0, num: '1', look: [1, 0], run: 0, dizzy: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = P.gold, sh = '#c27f0a';
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
    const a = Math.sin(o.run + i * 2 + (sx > 0 ? Math.PI : 0)) * 0.5;
    const p = new Path2D(); p.addPath(rr(-2, 0, 4, 16, 2), new DOMMatrix().translate(-14 + i * 14, -18).rotate(a * 57.3));
    cel(ctx, p, P.line, { depth: 0, line: 0 });
  }
  const shell = ell(-4, -36, 34, 26);
  cel(ctx, shell, base, { sh, depth: 5, line: 0, hlShapes: [ell(6, -54, 12, 4, -0.2)], hl: '#ffe08a' });
  clipFill(ctx, shell, rr(-40, -42, 80, 9, 0), P.line); // racing stripe
  ink(ctx, shell, lw);
  ctx.save(); ctx.fillStyle = '#ffffff'; ctx.font = `900 30px "Futura", "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = P.line; ctx.lineWidth = 5; ctx.strokeText(o.num, -8, -48 + 10); ctx.fillText(o.num, -8, -48 + 10); ctx.restore();
  const head = ell(30, -34, 14, 13);
  cel(ctx, head, '#3a2a1a', { depth: 2, line: lw });
  // goggles
  cel(ctx, rr(24, -44, 20, 9, 4), '#7fd0ff', { depth: 0, line: lw * 0.7 });
  angryEye(ctx, 34, -30, 4.5, lw, o.look, 1, o.dizzy > 0.5 ? 'dizzy' : 'angry');
  for (const sx of [0, 1]) { ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(36, -46); ctx.quadraticCurveTo(44 + sx * 8, -64, 52 + sx * 10, -58 - sx * 4); ctx.stroke(); ctx.restore(); }
  if (o.dizzy > 0) { // bonk stars
    for (let i = 0; i < 3; i++) { const a = o.t * 6 + i * TAU / 3; ctx.save(); ctx.fillStyle = P.lemon; ctx.translate(30 + Math.cos(a) * 18, -62 + Math.sin(a) * 6); ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? 2.5 : 6; ctx.lineTo(Math.cos(k * Math.PI / 5) * rr2, Math.sin(k * Math.PI / 5) * rr2); } ctx.closePath(); ctx.fill(); ink(ctx, (() => { const p = new Path2D(); for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? 2.5 : 6; k ? p.lineTo(Math.cos(k * Math.PI / 5) * rr2, Math.sin(k * Math.PI / 5) * rr2) : p.moveTo(rr2, 0); } p.closePath(); return p; })(), 2); ctx.restore(); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ FLAKY TEST: ✓/✗ moth
export function moth(ctx, o) {
  o = { x: 0, y: 0, s: 150, t: 0, flap: 0, vis: 1, look: [0, 0], ...o };
  if (o.vis <= 0) return;
  const lw = LW(o.s);
  begin(ctx, o);
  ctx.globalAlpha *= o.vis;
  const fl = 0.6 + 0.4 * Math.cos(o.flap);
  // wings: left ✓ (green), right ✗ (red)
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(0, -60); ctx.scale(sx * fl, 1);
    const w = new Path2D(); w.moveTo(0, -4); w.bezierCurveTo(22, -40, 58, -36, 50, -6); w.bezierCurveTo(56, 14, 30, 26, 0, 6); w.closePath();
    const col = sx < 0 ? '#3fc27a' : '#e8505a', shc = sx < 0 ? '#23935a' : '#ad2a3a';
    cel(ctx, w, col, { sh: shc, depth: 3, line: LW(o.s) });
    ctx.save(); ctx.clip(w); ctx.fillStyle = mix(col, '#ffffff', 0.35); ctx.beginPath(); ctx.ellipse(28, -10, 15, 13, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    if (sx < 0) { ctx.moveTo(20, -10); ctx.lineTo(27, -3); ctx.lineTo(38, -18); } else { ctx.moveTo(21, -18); ctx.lineTo(35, -3); ctx.moveTo(35, -18); ctx.lineTo(21, -3); }
    ctx.stroke();
    ctx.restore();
  }
  const body = ell(0, -56, 9, 24);
  cel(ctx, body, '#8a8094', { sh: '#5f566a', depth: 2, line: lw });
  for (let i = 0; i < 3; i++) clipFill(ctx, body, rr(-10, -50 + i * 8, 20, 3, 0), '#5f566a');
  const head = ell(0, -84, 10, 9);
  cel(ctx, head, '#8a8094', { sh: '#5f566a', depth: 2, line: lw });
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx * 4, -92); ctx.quadraticCurveTo(sx * 10, -108, sx * 18, -106); ctx.stroke(); ctx.restore();
    angryEye(ctx, sx * 4.5, -84, 3.8, lw, o.look, sx, 'sly');
  }
  ctx.restore();
}

// ------------------------------------------------------------------ MERGE CONFLICT: two-headed beast
// heads: HEAD (left, red) and main (right, blue); the ======= separator is its spine.
export function beast(ctx, o) {
  o = { x: 0, y: 0, s: 600, t: 0, roar: 0, merge: 0, split: 0, look: [0, 0], calm: 0, ...o };
  const lw = LW(o.s) * 1.1;
  begin(ctx, o);
  const m = clamp(o.merge);
  const body = '#6a3d5a', bodySh = '#43243b';
  // legs
  for (const sx of [-1, 1]) cel(ctx, rr(sx * 26 - 9, -22, 18, 22, 6), body, { sh: bodySh, depth: 3, line: lw });
  // body
  const b = ell(0, -36, 42, 26);
  cel(ctx, b, body, { sh: bodySh, depth: 5, line: 0 });
  // the ======= spine
  ctx.save(); ctx.clip(b);
  ctx.fillStyle = '#ffe9a0'; for (let i = 0; i < 2; i++) ctx.fillRect(-36, -50 + i * 6, 72, 3);
  ctx.restore();
  ink(ctx, b, lw);
  // necks + heads (merge brings them together into one calm head)
  const heads = m >= 1 ? [0] : [-1, 1];
  for (const sx of heads) {
    const hx = sx * lerp(24, 0, m) + (sx ? Math.sin(o.t * 5 + sx) * 2 * (1 - o.calm) : 0);
    const hy = -78 - o.roar * 6 + (sx ? Math.cos(o.t * 4 + sx) * 2 * (1 - o.calm) : 0);
    const col = sx < 0 ? '#c4404c' : sx > 0 ? '#3f6fd0' : '#8a6fc0';
    const csh = sx < 0 ? '#86202e' : sx > 0 ? '#244a96' : '#5d4890';
    const neck = poly([[sx * 8 - 8, -50], [sx * 8 + 8, -50], [hx + 7, hy + 10], [hx - 7, hy + 10]]);
    cel(ctx, neck, col, { sh: csh, depth: 2, line: lw });
    const head = ell(hx, hy, 17, 14);
    // horns
    for (const hs of [-1, 1]) cel(ctx, poly([[hx + hs * 8, hy - 10], [hx + hs * 16, hy - 26], [hx + hs * 13, hy - 8]]), '#efe6cf', { sh: '#b9ad90', depth: 1.5, line: lw * 0.8 });
    cel(ctx, head, col, { sh: csh, depth: 3, line: lw });
    // jaw
    const jaw = poly([[hx - 12, hy + 4], [hx + 12, hy + 4], [hx + 9, hy + 6 + o.roar * 12], [hx - 9, hy + 6 + o.roar * 12]]);
    cel(ctx, jaw, o.roar > 0.1 ? '#3a0f1a' : col, { depth: 0, line: lw * 0.8 });
    if (o.roar > 0.1) for (let k = -2; k <= 2; k++) cel(ctx, poly([[hx + k * 4 - 1.6, hy + 5], [hx + k * 4 + 1.6, hy + 5], [hx + k * 4, hy + 9]]), '#ffffff', { depth: 0, line: 0 });
    const mood = o.calm > 0.5 ? 'calm' : 'angry';
    if (mood === 'calm') {
      for (const es of [-1, 1]) { ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx + es * 7 - 4, hy - 1); ctx.quadraticCurveTo(hx + es * 7, hy - 5, hx + es * 7 + 4, hy - 1); ctx.stroke(); ctx.restore(); }
    } else {
      angryEye(ctx, hx - 6, hy - 2, 4.2, lw, [sx ? -sx : 0, 0], -1); angryEye(ctx, hx + 6, hy - 2, 4.2, lw, [sx ? -sx : 0, 0], 1);
    }
  }
  ctx.restore();
}

// conflict-marker banner floating over a head (screen-space caller draws with its own transform)
export function marker(ctx, x, y, text, col, size, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.font = `700 ${size}px "SF Mono", Menlo, monospace`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = '#14121c'; ctx.beginPath(); ctx.roundRect(x - w / 2 - size * 0.4, y - size * 0.75, w + size * 0.8, size * 1.5, size * 0.3); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = size * 0.1; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + size * 0.05);
  ctx.restore();
}
