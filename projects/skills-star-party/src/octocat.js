// The official Octocat, drawn from the traced geometry in octo_geo.js (avatar pixel coordinates) with
// the official flat colours plus a light layer of polish: a soft sheen and rim on the black body, a
// gently graded face with the head's contact shadow, glossy eyes with catchlights, highlights on the
// nose, suckers and drip, and a puddle that mirrors the legs. Every part can animate in on its own.
import { OCTO } from './octo_geo.js';
import { clamp, TAU } from './core.js';
import { rgba } from './palette.js';

const K = OCTO.col;
const cache = new Map();
// smooth closed path through a traced polygon (quadratics through edge midpoints)
function shape(arr) {
  if (cache.has(arr)) return cache.get(arr);
  const p = new Path2D(), n = arr.length / 2;
  const X = i => arr[(i % n) * 2], Y = i => arr[(i % n) * 2 + 1];
  p.moveTo((X(0) + X(1)) / 2, (Y(0) + Y(1)) / 2);
  for (let i = 1; i <= n; i++) p.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
  p.closePath();
  cache.set(arr, p);
  return p;
}
const bbox = arr => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < arr.length; i += 2) { x0 = Math.min(x0, arr[i]); x1 = Math.max(x1, arr[i]); y0 = Math.min(y0, arr[i + 1]); y1 = Math.max(y1, arr[i + 1]); }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
const B = {
  head: bbox(OCTO.head), face: bbox(OCTO.face), torso: bbox(OCTO.torso), tail: bbox(OCTO.tail),
  legs: OCTO.legs.map(bbox), eyes: OCTO.eyes.map(e => ({ w: bbox(e.white), i: bbox(e.iris) })),
  nose: bbox(OCTO.nose), mouth: bbox(OCTO.mouth), drip: bbox(OCTO.drip),
};
export const GEO = {
  B, puddle: OCTO.puddle,
  headCenter: [B.head.cx, 166], tailRoot: [178, 282], tailTip: [B.tail.x0 + 6, B.tail.y0 + 6],
  legTop: 289, feet: 385,
};

// silhouette (body only) — used for the logo → mascot hand-off
export function silhouette(ctx, { legs = [1, 1, 1, 1], tailAng = 0, tailGrow = 1 } = {}) {
  ctx.save();
  tail(ctx, tailAng, tailGrow, null);
  ctx.restore();
  ctx.fillStyle = K.body;
  ctx.fill(shape(OCTO.torso));
  legsDraw(ctx, legs, K.body);
  ctx.fill(shape(OCTO.head));
}

function legsDraw(ctx, g, color) {
  OCTO.legs.forEach((leg, i) => {
    const k = g[i];
    if (k <= 0.001) return;
    ctx.save();
    ctx.translate(0, GEO.legTop); ctx.scale(1, k); ctx.translate(0, -GEO.legTop);
    ctx.fillStyle = color; ctx.fill(shape(leg));
    ctx.restore();
  });
}

function tail(ctx, ang, grow, o) {
  if (grow <= 0.001) return;
  const [rx, ry] = GEO.tailRoot;
  ctx.save();
  ctx.translate(rx, ry); ctx.rotate(ang); ctx.scale(grow, grow); ctx.translate(-rx, -ry);
  const p = shape(OCTO.tail);
  ctx.fillStyle = K.body; ctx.fill(p);
  if (o) {
    sheen(ctx, p, B.tail, 0.10);
    // suckers pop in from the root to the tip
    OCTO.suckers.forEach((s, i) => {
      const k = clamp(o.suckers * (OCTO.suckers.length + 2) - i);
      if (k <= 0) return;
      const b = bbox(s), e = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1;
      ctx.save();
      ctx.translate(b.cx, b.cy); ctx.scale(k * e, k * e); ctx.translate(-b.cx, -b.cy);
      ctx.fillStyle = K.mint; ctx.fill(shape(s));
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(b.cx - b.w * 0.15, b.cy - b.h * 0.18, b.w * 0.18, b.h * 0.14, 0, 0, TAU); ctx.fill();
      ctx.restore();
    });
  }
  ctx.restore();
}

// soft sheen on a black part: broad highlight from the upper left + a cool rim on the right edge
function sheen(ctx, p, b, k = 0.14) {
  ctx.save();
  ctx.clip(p);
  const g = ctx.createRadialGradient(b.x0 + b.w * 0.3, b.y0 + b.h * 0.22, 0, b.x0 + b.w * 0.3, b.y0 + b.h * 0.22, Math.max(b.w, b.h) * 0.75);
  g.addColorStop(0, `rgba(160,175,200,${k})`); g.addColorStop(1, 'rgba(160,175,200,0)');
  ctx.fillStyle = g; ctx.fillRect(b.x0 - 5, b.y0 - 5, b.w + 10, b.h + 10);
  const r = ctx.createLinearGradient(b.x1, 0, b.x1 - b.w * 0.25, 0);
  r.addColorStop(0, `rgba(140,170,220,${k * 1.4})`); r.addColorStop(1, 'rgba(140,170,220,0)');
  ctx.lineWidth = 6; ctx.strokeStyle = r; ctx.stroke(p);
  ctx.restore();
}

function puddle(ctx, o) {
  const P = OCTO.puddle;
  const k = o.puddle;
  if (k <= 0.001) return;
  ctx.save();
  ctx.translate(P.cx, P.cy); ctx.scale(k, k * (o.puddleSquash ?? 1)); ctx.translate(-P.cx, -P.cy);
  ctx.beginPath(); ctx.ellipse(P.cx, P.cy, P.rx, P.ry, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, P.cy - P.ry, 0, P.cy + P.ry);
  g.addColorStop(0, '#a6e0f3'); g.addColorStop(1, '#8fd2ec');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // the legs' reflection (mirrored about the feet), as in the official art
  if (o.reflect > 0) {
    ctx.globalAlpha *= o.reflect;
    ctx.translate(0, GEO.feet * 2); ctx.scale(1, -1);
    legsDraw(ctx, o.legs, K.reflect);
  }
  ctx.restore();
  // ripples from the drip
  for (const r of o.ripples || []) {
    if (r < 0 || r > 1.2) continue;
    const e = 1 - Math.pow(1 - r / 1.2, 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - r / 1.2)})`; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(o.rippleX ?? 120, P.cy - 4, 6 + 46 * e, (6 + 46 * e) * P.ry / P.rx, 0, 0, TAU); ctx.stroke();
  }
  // rim highlight on the near edge
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(P.cx, P.cy, P.rx - 2, P.ry - 2, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  ctx.restore();
}

function eye(ctx, i, o) {
  const E = OCTO.eyes[i], b = B.eyes[i];
  const k = o.eyes;
  if (k <= 0.001) return;
  ctx.save();
  ctx.translate(b.w.cx, b.w.cy); ctx.scale(k, k * (1 - 0.92 * o.blink)); ctx.translate(-b.w.cx, -b.w.cy);
  const wp = shape(E.white);
  ctx.fillStyle = K.white; ctx.fill(wp);
  ctx.save(); ctx.clip(wp);
  const sg = ctx.createLinearGradient(0, b.w.y0, 0, b.w.y0 + b.w.h * 0.4);
  sg.addColorStop(0, 'rgba(120,90,80,0.22)'); sg.addColorStop(1, 'rgba(120,90,80,0)');
  ctx.fillStyle = sg; ctx.fillRect(b.w.x0, b.w.y0, b.w.w, b.w.h);
  // iris (follows the look direction a little)
  ctx.translate(o.look[0] * 4, o.look[1] * 4);
  const ip = shape(E.iris), ib = b.i;
  const ig = ctx.createRadialGradient(ib.cx - ib.w * 0.1, ib.cy + ib.h * 0.15, 1, ib.cx, ib.cy, ib.h * 0.62);
  ig.addColorStop(0, '#c0726a'); ig.addColorStop(0.6, K.iris); ig.addColorStop(1, '#8a4239');
  ctx.fillStyle = ig; ctx.fill(ip);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.ellipse(ib.cx + ib.w * 0.18, ib.cy - ib.h * 0.22, ib.w * 0.16, ib.h * 0.12, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(ib.cx - ib.w * 0.2, ib.cy + ib.h * 0.24, ib.w * 0.07, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// o: legs[4] 0..1, tailAng, tailGrow, suckers 0..1, face 0..1, eyes 0..1, blink 0..1, look [x,y],
//    nose 0..1, mouth 0..1, whiskers 0..1, puddle 0..1, reflect 0..1, drip {y, s} | null, ripples [ages]
export function octocat(ctx, o) {
  o = { legs: [1, 1, 1, 1], tailAng: 0, tailGrow: 1, suckers: 1, face: 1, eyes: 1, blink: 0, look: [0, 0], nose: 1, mouth: 1, whiskers: 1, puddle: 1, reflect: 1, drip: null, ripples: [], ...o };
  puddle(ctx, o);
  // drip falling from the tail tip
  if (o.drip) {
    const b = B.drip;
    ctx.save();
    ctx.translate(b.cx, b.y0 + o.drip.y); ctx.scale(o.drip.s, o.drip.s * (o.drip.stretch ?? 1)); ctx.translate(-b.cx, -b.y0);
    ctx.fillStyle = K.water; ctx.fill(shape(OCTO.drip));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(b.cx - b.w * 0.18, b.cy + b.h * 0.12, b.w * 0.14, b.h * 0.16, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // whiskers behind the head
  if (o.whiskers > 0) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = K.whisker; ctx.lineWidth = 2.1;
    for (const [x0, y0, cx, cy, x1, y1] of OCTO.whiskers) {
      // draw from the head outward: the end nearer the head is the start
      const inner = Math.abs(x0 - 228) < Math.abs(x1 - 228);
      const [ax, ay, bx, by] = inner ? [x0, y0, x1, y1] : [x1, y1, x0, y0];
      const hx = ax + (ax < 228 ? 20 : -20);
      ctx.beginPath(); ctx.moveTo(hx, ay);
      const N = 24, u1 = o.whiskers;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * u1, q = 1 - u;
        ctx.lineTo(q * q * ax + 2 * q * u * cx + u * u * bx, q * q * ay + 2 * q * u * cy + u * u * by);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  tail(ctx, o.tailAng, o.tailGrow, o);
  ctx.fillStyle = K.body;
  ctx.fill(shape(OCTO.torso));
  legsDraw(ctx, o.legs, K.body);
  OCTO.legs.forEach((leg, i) => { if (o.legs[i] > 0.98) sheen(ctx, shape(leg), B.legs[i], 0.08); });
  const hp = shape(OCTO.head);
  ctx.fillStyle = K.body; ctx.fill(hp);
  sheen(ctx, hp, B.head, 0.16);
  // face
  if (o.face > 0.001) {
    const f = B.face, fp = shape(OCTO.face);
    ctx.save();
    // the face opens as a soft iris wipe from its centre, with a slight overshoot in size
    if (o.face < 1) { ctx.beginPath(); ctx.ellipse(f.cx, f.cy + 4, f.w * 0.62 * o.face, f.h * 0.75 * o.face, 0, 0, TAU); ctx.clip(); }
    else { const k = o.face; ctx.translate(f.cx, f.cy); ctx.scale(k, k); ctx.translate(-f.cx, -f.cy); }
    const g = ctx.createRadialGradient(f.cx - f.w * 0.05, f.cy - f.h * 0.05, 4, f.cx, f.cy, f.w * 0.62);
    g.addColorStop(0, '#f8d6c3'); g.addColorStop(0.7, K.face); g.addColorStop(1, '#eab79c');
    ctx.fillStyle = g; ctx.fill(fp);
    ctx.save(); ctx.clip(fp);
    const s = ctx.createLinearGradient(0, f.y0, 0, f.y0 + 16);
    s.addColorStop(0, 'rgba(90,40,25,0.30)'); s.addColorStop(1, 'rgba(90,40,25,0)');
    ctx.fillStyle = s; ctx.fillRect(f.x0, f.y0, f.w, 16);
    // cheeks
    for (const cx of [f.x0 + f.w * 0.17, f.x1 - f.w * 0.17]) {
      const cg = ctx.createRadialGradient(cx, f.y0 + f.h * 0.72, 0, cx, f.y0 + f.h * 0.72, 22);
      cg.addColorStop(0, `rgba(235,120,120,${0.2 + 0.15 * (o.happy || 0)})`); cg.addColorStop(1, 'rgba(235,120,120,0)');
      ctx.fillStyle = cg; ctx.fillRect(cx - 24, f.y0 + f.h * 0.72 - 24, 48, 48);
    }
    ctx.restore();
    eye(ctx, 0, o); eye(ctx, 1, o);
    if (o.nose > 0.001) {
      const n = B.nose;
      ctx.save(); ctx.translate(n.cx, n.cy); ctx.scale(o.nose, o.nose); ctx.translate(-n.cx, -n.cy);
      ctx.fillStyle = K.iris; ctx.fill(shape(OCTO.nose));
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(n.cx - n.w * 0.15, n.cy - n.h * 0.2, n.w * 0.18, n.h * 0.12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (o.mouth > 0.001) { // smile draws out from the centre
      const m = B.mouth;
      ctx.save();
      ctx.beginPath(); ctx.rect(m.cx - m.w / 2 * o.mouth - 1, m.y0 - 2, m.w * o.mouth + 2, m.h + 4); ctx.clip();
      ctx.translate(m.cx, m.y0); ctx.scale(1 + (o.grin || 0) * 0.25, 1 + (o.grin || 0) * 0.35); ctx.translate(-m.cx, -m.y0);
      ctx.fillStyle = K.iris; ctx.fill(shape(OCTO.mouth));
      ctx.restore();
    }
    ctx.restore();
  }
}
export { rgba };
