// The Tool Squad: Claude Code's built-in tools as companion creatures (cel layer, outlined).
// All drawn in local units where 100 = the creature's height; origin = ground under its centre.
// Read (owl, reads files) · WebFetch (retriever, fetches pages) · Edit (scissor-crab, targeted
// edits) · Write (octopus, creates files) · Bash (little dragon on a leash, runs shell commands).
import { P, mix, rgba } from './palette.js';
import { cel, ink, clipFill, band } from './cel.js';
import { TAU, clamp, lerp } from './core.js';

const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const ell = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); return p; };
const poly = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const LW = s => clamp(s / 100 * 3.6, 1.6, 7);

function begin(ctx, o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot || 0);
  ctx.scale((o.s / 100) * (o.flip ? -1 : 1) * (o.sx || 1), (o.s / 100) * (o.sy || 1));
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
}

// eye: white oval + pupil + catchlight; look = [-1..1, -1..1]
function eye(ctx, x, y, rx, ry, look = [0, 0], lw, o = {}) {
  const e = ell(x, y, rx, ry);
  if (o.closed) { ctx.save(); ctx.lineWidth = rx * 0.5; ctx.strokeStyle = P.line; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.quadraticCurveTo(x, y - ry * 0.6, x + rx, y); ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = o.white || '#ffffff'; ctx.fill(e);
  const px = x + look[0] * rx * 0.35, py = y + look[1] * ry * 0.3;
  ctx.save(); ctx.clip(e);
  ctx.fillStyle = o.iris || P.line; ctx.beginPath(); ctx.ellipse(px, py, rx * (o.pr || 0.62), ry * (o.pr || 0.66), 0, 0, TAU); ctx.fill();
  if (o.slit) { ctx.fillStyle = P.line; ctx.beginPath(); ctx.ellipse(px, py, rx * 0.16, ry * 0.6, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px + rx * 0.22, py - ry * 0.25, rx * 0.24, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(px - rx * 0.2, py + ry * 0.25, rx * 0.1, 0, TAU); ctx.fill();
  ctx.restore();
  ink(ctx, e, lw * 0.8);
}

// ------------------------------------------------------------------ READ: owl with glasses
export function owl(ctx, o) {
  o = { x: 0, y: 0, s: 200, t: 0, look: [0, 0], book: 1, page: 0, bob: 0, glint: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  ctx.translate(0, -Math.abs(Math.sin(o.bob)) * 3);
  const base = P.mauve, sh = P.mauveDk;
  // feet
  for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) cel(ctx, poly([[sx * 9 + k * 4 - 2, -4], [sx * 9 + k * 4 + 2, -4], [sx * 9 + k * 5.2, 2.5]]), P.orange, { line: lw * 0.7, depth: 0 });
  // ear tufts
  for (const sx of [-1, 1]) cel(ctx, poly([[sx * 14, -78], [sx * 33, -98], [sx * 30, -72]]), base, { sh, depth: 2, line: lw });
  // body
  const body = ell(0, -45, 34, 44);
  cel(ctx, body, base, { sh, depth: 5, line: 0 });
  const belly = ell(0, -33, 22, 28);
  clipFill(ctx, body, belly, P.peach);
  ctx.save(); ctx.clip(belly); ctx.strokeStyle = mix(P.peach, P.brown, 0.4); ctx.lineWidth = 1.6;
  for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) { const x = c * 8 + (r % 2) * 4, y = -48 + r * 9; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y + 3); ctx.lineTo(x + 3, y); ctx.stroke(); }
  ctx.restore();
  ink(ctx, body, lw);
  // facial disc (lighter mask around the eyes)
  clipFill(ctx, body, ell(0, -63, 30, 19), mix(base, P.peach, 0.45));
  ctx.save(); ctx.clip(body); ctx.strokeStyle = mix(base, sh, 0.6); ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26, -63 + Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * 30, -63 + Math.sin(a) * 18); ctx.stroke(); }
  ctx.restore();
  // wings with layered feather scallops
  for (const sx of [-1, 1]) {
    const w = ell(sx * 30, -42, 9, 24, sx * 0.25);
    cel(ctx, w, mix(base, sh, 0.35), { sh, depth: 3, line: lw });
    ctx.save(); ctx.clip(w); ctx.strokeStyle = mix(sh, P.line, 0.3); ctx.lineWidth = 1.3;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const fx = sx * 30 + (c - 0.5) * 7, fy = -54 + r * 8; ctx.beginPath(); ctx.arc(fx, fy, 4, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.fillStyle = mix(base, '#ffffff', 0.2); for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.ellipse(sx * 30 + 3, -58 + r * 9, 2.4, 1.2, 0.3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // brow tufts
  for (const sx of [-1, 1]) cel(ctx, poly([[sx * 4, -78], [sx * 22, -84], [sx * 18, -76]]), mix(base, sh, 0.2), { sh, depth: 1, line: lw * 0.7 });
  // glasses (big round lenses) + eyes
  for (const sx of [-1, 1]) {
    const lens = ell(sx * 13, -64, 14, 14);
    ctx.fillStyle = '#fffdf2'; ctx.fill(lens);
    eye(ctx, sx * 13, -64, 9, 10, o.look, lw, { pr: 0.6 });
    ctx.save(); ctx.lineWidth = 3.4; ctx.strokeStyle = P.brownDk; ctx.stroke(lens); ctx.restore();
    ink(ctx, ell(sx * 13, -64, 15.7, 15.7), lw * 0.7);
  }
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = P.brownDk; ctx.beginPath(); ctx.moveTo(-1.5, -66); ctx.quadraticCurveTo(0, -69, 1.5, -66); ctx.stroke(); ctx.restore();
  if (o.glint > 0) { ctx.save(); ctx.globalAlpha *= o.glint; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, -74); ctx.lineTo(22, -62); ctx.lineTo(18, -58); ctx.lineTo(4, -70); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // beak
  cel(ctx, poly([[-5, -52], [5, -52], [0, -43]]), P.gold, { depth: 0, line: lw * 0.8 });
  // the book (open, code lines)
  if (o.book > 0) {
    ctx.save(); ctx.globalAlpha *= o.book;
    const cover = rr(-30, -32, 60, 26, 3);
    cel(ctx, cover, '#8a3f2a', { depth: 0, line: lw });
    for (const sx of [-1, 1]) {
      const pg = poly([[0, -30], [sx * 27, -33 + (sx > 0 ? o.page * 4 : 0)], [sx * 27, -9], [0, -8]]);
      cel(ctx, pg, P.paper, { sh: '#e3dcc4', depth: 2, line: lw * 0.7 });
      ctx.save(); ctx.clip(pg);
      const cols = ['#3f7fd0', '#c0504a', '#3f9a50', '#7a5cc0'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[(i + (sx > 0 ? 2 : 0)) % 4]; ctx.fillRect(sx > 0 ? 4 + (i % 2) * 3 : -24 + (i % 3) * 2, -27 + i * 4, 12 + ((i * 7) % 9), 1.8); }
      ctx.restore();
    }
    // wing-tips holding the book
    for (const sx of [-1, 1]) cel(ctx, ell(sx * 27, -20, 6, 8), mix(base, sh, 0.35), { depth: 0, line: lw * 0.8 });
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ WEBFETCH: retriever (faces right)
export function dog(ctx, o) {
  o = { x: 0, y: 0, s: 200, t: 0, run: 0, wag: 0, page: 1, look: [0.6, 0], ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = '#e8b764', sh = '#b9813c', dark = '#a8692e';
  const ph = o.run;
  const bob = o.run ? Math.sin(ph * 2) * 3 : 0;
  ctx.translate(0, bob);
  // far legs
  const leg = (x, a, far) => {
    const p = new Path2D(); p.addPath(rr(-5, 0, 10, 26, 5), new DOMMatrix().translate(x, -30).rotate(a * 57.3));
    cel(ctx, p, far ? sh : base, { sh: dark, depth: 2, line: lw });
  };
  leg(-24, Math.sin(ph) * 0.6 * (o.run ? 1 : 0.1), true); leg(22, -Math.sin(ph) * 0.6 * (o.run ? 1 : 0.1), true);
  // tail
  const ta = -0.6 + Math.sin(o.wag) * 0.35;
  const tail = new Path2D(); tail.addPath(poly([[0, -5], [34, -12], [36, -2], [0, 5]]), new DOMMatrix().translate(-38, -50).rotate((Math.PI + ta) * 57.3));
  cel(ctx, tail, base, { sh: dark, depth: 3, line: lw });
  // body
  const body = ell(0, -46, 42, 21);
  cel(ctx, body, base, { sh, depth: 6, line: lw, shapes: [ell(-6, -32, 30, 9)] });
  // near legs
  leg(-18, -Math.sin(ph) * 0.6 * (o.run ? 1 : 0.1), false); leg(28, Math.sin(ph) * 0.6 * (o.run ? 1 : 0.1), false);
  // fur strands along the back and chest
  ctx.save(); ctx.clip(body); ctx.lineCap = 'round';
  ctx.strokeStyle = mix(base, '#ffffff', 0.4); ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) { const fx = -16 + i * 7; ctx.beginPath(); ctx.moveTo(fx, -64); ctx.quadraticCurveTo(fx + 2.5, -61, fx + 1.5, -58); ctx.stroke(); }
  ctx.strokeStyle = mix(base, sh, 0.6); ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) { const fx = -30 + i * 9; ctx.beginPath(); ctx.moveTo(fx, -30); ctx.quadraticCurveTo(fx + 2, -28, fx + 1, -26); ctx.stroke(); }
  ctx.restore();
  // chest ruff (zigzag fur)
  cel(ctx, poly([[30, -56], [40, -48], [36, -44], [42, -38], [34, -34], [36, -28], [26, -32], [22, -46]]), mix(base, '#fff3d6', 0.4), { sh, depth: 1.5, line: lw * 0.8 });
  // collar + tag (HTTP 200)
  cel(ctx, rr(24, -64, 9, 24, 3), '#3f7fd0', { depth: 0, line: lw * 0.8 });
  cel(ctx, ell(31, -36, 5.5, 5.5), P.gold, { depth: 0, line: lw * 0.6 });
  ctx.save(); ctx.fillStyle = P.line; ctx.font = '900 4.6px "Futura", "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('200', 31, -35.6); ctx.restore();
  // head
  const head = ell(44, -72, 19, 18);
  cel(ctx, head, base, { sh, depth: 4, line: lw });
  const snout = ell(60, -65, 13, 9);
  cel(ctx, snout, mix(base, '#fff3d6', 0.35), { sh, depth: 2, line: lw });
  cel(ctx, ell(71, -68, 5, 4), P.line, { depth: 0, line: 0 });
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(72.5, -69.5, 1.6, 1, 0, 0, TAU); ctx.fill();
  if (!o.page) { const tg = poly([[60, -60], [66, -60], [65, -50], [61, -51]]); cel(ctx, tg, '#ff7a8a', { depth: 1, line: lw * 0.6 }); }
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(71, -64); ctx.quadraticCurveTo(66, -59, 58, -60); ctx.stroke(); ctx.restore();
  eye(ctx, 50, -77, 5, 6, o.look, lw);
  // ear
  const ear = poly([[34, -86], [44, -86], [38, -58], [28, -62]]);
  cel(ctx, ear, dark, { depth: 0, line: lw });
  // the web page in its mouth
  if (o.page > 0) {
    ctx.save(); ctx.translate(74, -56); ctx.rotate(0.25);
    const pg = rr(-6, -4, 34, 40, 2);
    cel(ctx, pg, P.paper, { sh: '#ddd5bd', depth: 2, line: lw * 0.8 });
    ctx.fillStyle = '#3f7fd0'; ctx.fillRect(-3, -1, 28, 5);
    ctx.strokeStyle = '#3f7fd0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(11, 15, 8, 0, TAU); ctx.moveTo(3, 15); ctx.lineTo(19, 15); ctx.moveTo(11, 7); ctx.quadraticCurveTo(5, 15, 11, 23); ctx.moveTo(11, 7); ctx.quadraticCurveTo(17, 15, 11, 23); ctx.stroke();
    ctx.fillStyle = '#9a9488'; for (let i = 0; i < 3; i++) ctx.fillRect(0, 26 + i * 3.5, 22 - i * 4, 1.6);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ EDIT: scissor-crab
export function crab(ctx, o) {
  o = { x: 0, y: 0, s: 200, t: 0, snip: 0, look: [0, 0], walk: 0, raise: 0.5, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = P.skyMid, sh = '#2b7a8c', blade = '#e4e8ef', bladeSh = '#9aa3b2';
  // legs
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const a = sx * (0.5 + i * 0.35) + Math.sin(o.walk + i) * 0.15;
    const p = new Path2D(); p.addPath(rr(-3, 0, 6, 22, 3), new DOMMatrix().translate(sx * (22 + i * 6), -26).rotate(-a * 57.3));
    cel(ctx, p, sh, { depth: 0, line: lw * 0.8 });
  }
  // claws: arm + scissor blades
  for (const sx of [-1, 1]) {
    const ang = sx * (0.9 + o.raise * 0.5);
    const am = new DOMMatrix().translate(sx * 38, -40).rotate(ang * 57.3);
    const arm = new Path2D(); arm.addPath(rr(-5, -30, 10, 32, 5), am);
    cel(ctx, arm, base, { sh, depth: 2, line: lw });
    const open = 0.15 + 0.5 * (1 - o.snip);
    const tip = am.translate(0, -30);
    for (const bs of [-1, 1]) {
      const bm = tip.rotate(bs * open * 28.6);
      const b = new Path2D(); b.addPath(poly([[-4, 0], [4, 0], [bs * 2, -34], [bs * 0.5 - 1, -36]]), bm);
      cel(ctx, b, blade, { sh: bladeSh, depth: 1.5, line: lw * 0.85 });
    }
    const pv = new Path2D(); pv.addPath(ell(0, 0, 3.4, 3.4), tip);
    cel(ctx, pv, P.gold, { depth: 0, line: lw * 0.6 });
  }
  // shell
  const shell = ell(0, -38, 42, 25);
  cel(ctx, shell, base, { sh, depth: 6, line: 0, hlShapes: [ell(14, -54, 12, 4, -0.2)], hl: '#bdf0f8' });
  ctx.save(); ctx.clip(shell); ctx.fillStyle = mix(base, sh, 0.5);
  for (const [x, y, r] of [[-20, -44, 4], [-8, -52, 3], [20, -38, 3.5], [-26, -30, 3], [28, -48, 2.5], [6, -40, 2], [-32, -40, 2.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#bdf0f8'; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.35, r * 0.35, 0, TAU); ctx.fill(); ctx.fillStyle = mix(base, sh, 0.5); }
  // shell rim ridge
  ctx.strokeStyle = mix(base, sh, 0.65); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -34, 36, 16, 0, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.restore();
  ink(ctx, shell, lw);
  // eye stalks
  for (const sx of [-1, 1]) {
    cel(ctx, rr(sx * 12 - 2.5, -76, 5, 20, 2.5), sh, { depth: 0, line: lw * 0.8 });
    eye(ctx, sx * 12, -80, 7, 8, o.look, lw);
  }
  // mouth
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.quadraticCurveTo(0, -26, 6, -30); ctx.stroke(); ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ WRITE: ink octopus with a quill
function tentacle(ctx, x0, y0, len, w0, curl, t, ph, base, sh, lw) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, a = Math.PI / 2 + curl * u * u * 2.2 + Math.sin(t * 3 + ph + u * 3) * 0.35 * u;
    const prev = pts[i - 1] || [x0, y0, Math.PI / 2];
    const step = len / 14;
    pts.push(i ? [prev[0] + Math.cos(a) * step, prev[1] + Math.sin(a) * step, a] : [x0, y0, a]);
  }
  const L = [], R = [];
  pts.forEach(([x, y, a], i) => { const w = w0 * (1 - i / 15); L.push([x + Math.cos(a + Math.PI / 2) * w, y + Math.sin(a + Math.PI / 2) * w]); R.push([x - Math.cos(a + Math.PI / 2) * w, y - Math.sin(a + Math.PI / 2) * w]); });
  const p = poly([...L, ...R.reverse()]);
  cel(ctx, p, base, { sh, depth: 2.5, line: lw * 0.9 });
  ctx.fillStyle = mix(base, '#ffffff', 0.45);
  pts.forEach(([x, y, a], i) => { if (i % 3 === 1 && i < 12) { ctx.beginPath(); ctx.arc(x - Math.cos(a + Math.PI / 2) * w0 * 0.45 * (1 - i / 15), y - Math.sin(a + Math.PI / 2) * w0 * 0.45 * (1 - i / 15), w0 * 0.22 * (1 - i / 15), 0, TAU); ctx.fill(); } });
  return pts[pts.length - 1];
}
export function octopus(ctx, o) {
  o = { x: 0, y: 0, s: 200, t: 0, look: [0, 0], write: 0, happy: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = P.violet, sh = P.purple;
  const curls = [-1.4, -0.8, -0.3, 0.3, 0.8, 1.4];
  curls.forEach((c, i) => { if (i !== 5) tentacle(ctx, -20 + i * 7.2, -36, 30, 8, c * 1.2, o.t, i, base, sh, lw); });
  // head
  const head = new Path2D(); head.ellipse(0, -62, 30, 33, 0, 0, TAU);
  cel(ctx, head, base, { sh, depth: 5, line: 0, hlShapes: [ell(12, -82, 8, 4, -0.5)], hl: '#c9a7f0' });
  ctx.save(); ctx.clip(head); ctx.fillStyle = mix(base, sh, 0.55);
  for (const [x, y, r] of [[-16, -80, 4], [-22, -64, 3], [18, -66, 3.5], [6, -88, 2.5], [-6, -90, 2], [22, -78, 2.2], [-26, -74, 2], [14, -54, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#e0c8ff'; ctx.beginPath(); ctx.ellipse(16, -86, 3, 1.6, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
  ink(ctx, head, lw);
  eye(ctx, -11, -58, 7, 9, o.look, lw, { closed: o.happy > 0.5 });
  eye(ctx, 11, -58, 7, 9, o.look, lw, { closed: o.happy > 0.5 });
  ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -45); ctx.quadraticCurveTo(0, -41, 5, -45); ctx.stroke(); ctx.restore();
  // writing tentacle raised, holding a quill
  const tip = tentacle(ctx, 24, -42, 40, 7, -1.15 + Math.sin(o.write * 9) * 0.12, o.t * 0.3, 7, base, sh, lw);
  ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(-0.6 + Math.sin(o.write * 9) * 0.2);
  const quill = poly([[0, 0], [5, -10], [10, -40], [2, -30], [-2, -12]]);
  cel(ctx, quill, '#ffffff', { sh: '#c9d2e0', depth: 1.5, line: lw * 0.7 });
  cel(ctx, poly([[-1, 2], [1, 2], [0, 8]]), '#2a2a3a', { depth: 0, line: lw * 0.5 });
  ctx.restore();
  ctx.restore();
  return tip;
}

// ------------------------------------------------------------------ BASH: little terminal dragon
export function dragon(ctx, o) {
  o = { x: 0, y: 0, s: 200, t: 0, look: [0.5, 0], mouth: 0, flap: 0, sulk: 0, leash: true, eyes: 'open', puff: 0, ...o };
  const lw = LW(o.s);
  begin(ctx, o);
  const base = '#3b4560', sh = '#262d40', belly = '#7f8fb5', green = P.termGreen;
  const sulk = o.sulk;
  // tail
  const tail = new Path2D(); tail.moveTo(-24, -30); tail.quadraticCurveTo(-56, -26, -62, -48 + sulk * 30); tail.lineTo(-56, -50 + sulk * 30); tail.quadraticCurveTo(-50, -34, -22, -40); tail.closePath();
  cel(ctx, tail, base, { sh, depth: 3, line: lw });
  cel(ctx, poly([[-62, -48 + sulk * 30], [-74, -58 + sulk * 30], [-60, -60 + sulk * 30]]), green, { depth: 0, line: lw * 0.8 });
  // wings (behind)
  const fa = Math.sin(o.flap) * 0.4 - sulk * 0.6;
  for (const sx of [-1, 1]) {
    const wm = new DOMMatrix().translate(sx * 10 - 6, -64).rotate((sx * -0.3 - fa * sx) * 57.3);
    const w = new Path2D(); w.addPath(poly([[0, 0], [sx * 30, -26], [sx * 34, -6], [sx * 22, -4], [sx * 18, 6]]), wm);
    cel(ctx, w, mix(green, sh, 0.55), { sh: mix(green, sh, 0.75), depth: 2, line: lw });
    const v = new Path2D(); v.addPath((() => { const q = new Path2D(); q.moveTo(0, 0); q.lineTo(sx * 30, -26); q.moveTo(0, 0); q.lineTo(sx * 34, -6); q.moveTo(0, 0); q.lineTo(sx * 22, -4); return q; })(), wm);
    ctx.save(); ctx.strokeStyle = mix(green, sh, 0.85); ctx.lineWidth = 1.6; ctx.stroke(v); ctx.restore();
  }
  // legs + claws
  for (const sx of [-1, 1]) { cel(ctx, rr(sx * 12 - 7, -16, 14, 16, 5), base, { sh, depth: 2, line: lw }); for (let k = 0; k < 3; k++) cel(ctx, poly([[sx * 12 - 5 + k * 4, -1], [sx * 12 - 3 + k * 4, -1], [sx * 12 - 4 + k * 4, 2.5]]), '#f2ead0', { depth: 0, line: lw * 0.5 }); }
  // body
  const body = ell(0, -38, 26, 26);
  cel(ctx, body, base, { sh, depth: 5, line: 0 });
  const bel = ell(4, -32, 15, 18);
  clipFill(ctx, body, bel, belly);
  ctx.save(); ctx.clip(bel); ctx.strokeStyle = mix(belly, sh, 0.5); ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-12, -46 + i * 6); ctx.quadraticCurveTo(4, -43 + i * 6, 20, -46 + i * 6); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.clip(body); ctx.fillStyle = mix(base, '#7f8fb5', 0.25);
  for (const [x, y] of [[-18, -50], [-20, -38], [-14, -58], [-22, -28], [-10, -20], [14, -58]]) { ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.8, 0.3, 0, TAU); ctx.fill(); }
  ctx.restore();
  ink(ctx, body, lw);
  // the $ prompt on its belly
  ctx.save(); ctx.fillStyle = green; ctx.shadowColor = green; ctx.shadowBlur = 8;
  ctx.font = '800 20px "SF Mono", Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 4, -30);
  ctx.restore();
  // collar + leash ring
  cel(ctx, rr(-14, -62, 32, 7, 3), '#d0353f', { depth: 0, line: lw * 0.8 });
  cel(ctx, ell(-12, -55, 3.6, 3.6), P.gold, { depth: 0, line: lw * 0.6 });
  // head
  const hy = -76 + sulk * 6;
  const head = new Path2D(); head.ellipse(6, hy, 22, 18, 0, 0, TAU);
  const snout = ell(22, hy + 6, 13, 10);
  for (const sx of [-1, 1]) cel(ctx, poly([[sx * 8 + 2, hy - 14], [sx * 12 + 4, hy - 30 + sulk * 8], [sx * 14 + 6, hy - 12]]), '#d9d2b8', { sh: '#a9a288', depth: 1.5, line: lw * 0.8 });
  // spikes
  for (let i = 0; i < 3; i++) cel(ctx, poly([[-8 - i * 9, hy + 6 + i * 10], [-16 - i * 9, hy + i * 10], [-12 - i * 9, hy + 12 + i * 10]]), green, { depth: 0, line: lw * 0.7 });
  cel(ctx, head, base, { sh, depth: 4, line: lw });
  cel(ctx, snout, base, { sh, depth: 2.5, line: lw });
  // mouth (open = fire)
  if (o.mouth > 0) {
    const m = poly([[16, hy + 8], [36, hy + 4 - o.mouth * 4], [36, hy + 12 + o.mouth * 6]]);
    cel(ctx, m, '#5a1f2a', { depth: 0, line: lw * 0.8 });
    for (let k = 0; k < 3; k++) cel(ctx, poly([[22 + k * 4.5, hy + 6.5 - k * 0.6], [25 + k * 4.5, hy + 6.2 - k * 0.6], [23.5 + k * 4.5, hy + 9.5 - k * 0.6]]), '#ffffff', { depth: 0, line: lw * 0.4 });
  }
  // brow ridge
  cel(ctx, poly([[0, hy - 12], [16, hy - 10], [14, hy - 7], [2, hy - 8]]), mix(base, sh, 0.4), { depth: 0, line: lw * 0.6 });
  ctx.fillStyle = P.line; ctx.beginPath(); ctx.arc(30, hy + 2, 1.6, 0, TAU); ctx.fill();
  if (o.eyes === 'closed' || o.eyes === 'happy') eye(ctx, 8, hy - 3, 6, 7, o.look, lw, { closed: true });
  else eye(ctx, 8, hy - 3, 6.5, 8, o.look, lw, { iris: '#f2c230', pr: 0.7, slit: true });
  if (o.puff > 0) {
    ctx.save(); ctx.globalAlpha *= clamp(1 - o.puff);
    for (let i = 0; i < 4; i++) { const r = 4 + o.puff * 10 + i * 2; ctx.fillStyle = mix('#c8c8d0', '#ffffff', i / 4); ctx.beginPath(); ctx.arc(34 + o.puff * 20 + i * 6, hy - 6 - o.puff * 18 - i * 5, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
}

// Green terminal fire (local to caller): a cone of flame tongues from (x,y) toward angle a
export function fire(ctx, x, y, a, len, t, k = 1) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  const tongues = 9;
  for (let i = 0; i < tongues; i++) {
    const ph = i * 1.7 + Math.floor(t * 12) * 0.9;
    const l = len * k * (0.55 + 0.45 * Math.abs(Math.sin(ph)));
    const w = len * 0.14 * (1 - Math.abs(i - tongues / 2) / tongues);
    const yy = (i - tongues / 2) * len * 0.035 * k;
    const p = new Path2D(); p.moveTo(0, yy); p.quadraticCurveTo(l * 0.5, yy - w, l, yy + Math.sin(ph) * w); p.quadraticCurveTo(l * 0.5, yy + w, 0, yy); p.closePath();
    ctx.fillStyle = i % 3 === 0 ? '#e8ff8a' : i % 3 === 1 ? '#7dffa0' : '#3fd27a';
    ctx.fill(p);
  }
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha *= 0.8;
  ctx.beginPath(); ctx.ellipse(len * 0.18 * k, 0, len * 0.2 * k, len * 0.06 * k, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
