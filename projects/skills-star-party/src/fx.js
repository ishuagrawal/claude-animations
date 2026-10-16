// Celebration pieces: a faceted gold star (ten facets lit by their 3D normals against a fixed key light,
// ridge lines, rim, glints), soft light rays, sparkles, and confetti (two-tone flipping papers, dots,
// little stars and curling streamers on drag + gravity + flutter).
import { TAU, clamp, rng } from './core.js';
import { rgba } from './palette.js';

const GOLD = { d: [176, 104, 10], m: [236, 170, 40], l: [255, 214, 92], h: [255, 247, 214], rim: '#a35f06' };
const L = [-0.45, -0.62, 0.64];
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function star(ctx, x, y, r, { rot = 0, a = 1, shadow = 1 } = {}) {
  if (r <= 0.5 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const V = [];
  for (let i = 0; i < 10; i++) {
    const an = -Math.PI / 2 + i * Math.PI / 5 + rot, rr = i % 2 ? r * 0.47 : r;
    V.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]);
  }
  const outline = () => { ctx.beginPath(); V.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  if (shadow > 0) { // soft drop shadow
    ctx.save(); ctx.translate(r * 0.04, r * 0.12); outline();
    ctx.shadowColor = `rgba(150,95,10,${0.35 * shadow})`; ctx.shadowBlur = r * 0.35 * ctx.getTransform().a; ctx.fillStyle = 'rgba(150,95,10,0.01)'; ctx.fill();
    ctx.restore();
  }
  ctx.lineJoin = 'round';
  const hgt = r * 0.36;
  for (let i = 0; i < 10; i++) {
    const p = V[i], q = V[(i + 1) % 10];
    const ax = p[0] - x, ay = p[1] - y, bx = q[0] - x, by = q[1] - y;
    let nx = ay * -hgt - -hgt * by, ny = -hgt * bx - ax * -hgt, nz = ax * by - ay * bx;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const spec = Math.pow(Math.max(0, 2 * dif * nz - L[2]), 18);
    let c = dif < 0.55 ? mixc(GOLD.d, GOLD.m, dif / 0.55) : mixc(GOLD.m, GOLD.l, (dif - 0.55) / 0.45);
    c = mixc(c, GOLD.h, spec * 0.8);
    const cs = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    ctx.fillStyle = cs; ctx.strokeStyle = cs; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.6, r * 0.02);
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(130,60,0,0.3)' : 'rgba(255,250,225,0.6)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(V[i][0], V[i][1]); ctx.stroke();
  }
  outline(); ctx.lineWidth = Math.max(1, r * 0.045); ctx.strokeStyle = GOLD.rim; ctx.stroke();
  ctx.lineWidth = Math.max(0.6, r * 0.016); ctx.strokeStyle = 'rgba(255,246,210,0.65)'; ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.12, 0, x - r * 0.1, y - r * 0.12, r * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  sparkle(ctx, V[8][0] + (x - V[8][0]) * 0.2, V[8][1] + (y - V[8][1]) * 0.2, r * 0.36, '#fffbe8', 0.3, 0.95);
  ctx.restore();
}

export function sparkle(ctx, x, y, r, color, rot = 0, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.beginPath();
  const k = 0.14;
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * k, -r * k, r, 0); ctx.quadraticCurveTo(r * k, r * k, 0, r);
  ctx.quadraticCurveTo(-r * k, r * k, -r, 0); ctx.quadraticCurveTo(-r * k, -r * k, 0, -r); ctx.fill();
  ctx.restore();
}

// soft rotating light rays (behind the star)
export function rays(ctx, x, y, r, t, a, color = '#ffd56b') {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.25);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  g.addColorStop(0, rgba(color, 0.55 * a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  for (let i = 0; i < 14; i++) {
    const an = i * TAU / 14, w = 0.075;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, an - w, an + w); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// confetti burst from (x, y) toward `dir`; u = seconds since launch
const PAL = [['#2da44e', '#1a7f37'], ['#0969da', '#0550ae'], ['#8250df', '#6639ba'], ['#bf3989', '#99286e'], ['#e3b341', '#bb8009'], ['#da7758', '#b2593c'], ['#54aeff', '#218bff']];
export function confetti(ctx, x, y, u, { n = 70, seed = 1, dir = -Math.PI / 2, spread = 0.5, speed = 1500, grav = 1100, drag = 1.5, life = 4, size = 15, streamers = 6 } = {}) {
  if (u < 0 || u > life) return;
  const R = rng(seed);
  const fade = 1 - clamp((u - life * 0.75) / (life * 0.25));
  ctx.save(); ctx.globalAlpha *= fade;
  const path = () => {
    const a = dir + (R() - 0.5) * 2 * spread, v = speed * (0.45 + R() * 0.7), k = drag * (0.7 + R() * 0.7);
    return tt => { const e = (1 - Math.exp(-k * tt)) / k; return [x + Math.cos(a) * v * e, y + Math.sin(a) * v * e + (grav / k) * (tt - e)]; };
  };
  for (let i = 0; i < n; i++) {
    const p = path(), ph = R() * TAU, spin = 4 + R() * 8, [c1, c2] = PAL[Math.floor(R() * PAL.length)], kind = R();
    const w = size * (0.6 + R() * 0.7), h = w * (0.4 + R() * 0.25);
    let [px, py] = p(u);
    px += Math.sin(u * (2 + R() * 3) + ph) * 22 * Math.min(1, u);
    const s = u * spin + ph, flip = Math.cos(s * 1.6);
    ctx.save(); ctx.translate(px, py); ctx.rotate(s); ctx.scale(1, Math.max(0.1, Math.abs(flip)));
    ctx.fillStyle = flip > 0 ? c1 : c2;
    if (kind < 0.15) { ctx.beginPath(); ctx.arc(0, 0, w * 0.36, 0, TAU); ctx.fill(); }
    else if (kind < 0.27) { ctx.restore(); star(ctx, px, py, w * 0.55, { rot: s, shadow: 0 }); continue; }
    else {
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.25); ctx.fill();
      ctx.fillStyle = flip > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h * 0.28);
    }
    ctx.restore();
  }
  // curling streamers: ribbons trailing their own flight, twisting two-tone
  ctx.lineCap = 'round';
  for (let i = 0; i < streamers; i++) {
    const p = path(), [c1, c2] = PAL[Math.floor(R() * PAL.length)], ph = R() * TAU, wd = 5 + R() * 3, len = 0.3 + R() * 0.15;
    for (let k = 0; k < 16; k++) {
      const t0 = u - len * k / 16, t1 = u - len * (k + 1) / 16;
      if (t1 <= 0) break;
      const [ax, ay] = p(t0), [bx, by] = p(t1);
      const s0 = Math.sin(t0 * 13 + ph) * 13, s1 = Math.sin(t1 * 13 + ph) * 13, tw = Math.cos(t0 * 8 + k * 0.8 + ph);
      ctx.strokeStyle = tw > 0 ? c1 : c2; ctx.lineWidth = wd * (0.3 + 0.7 * Math.abs(tw));
      ctx.beginPath(); ctx.moveTo(ax + s0, ay); ctx.lineTo(bx + s1, by); ctx.stroke();
    }
  }
  ctx.restore();
}

// gentle confetti rain over a w×h area (no cannons): pieces drift down with sway, flip and spin.
// u = seconds since it started.
export function confettiRain(ctx, u, { n = 60, seed = 5, w = 1920, h = 1080, life = 6, size = 15, speed = 260 } = {}) {
  if (u < 0 || u > life) return;
  const R = rng(seed);
  ctx.save();
  ctx.globalAlpha *= 1 - clamp((u - life + 1) / 1);
  for (let i = 0; i < n; i++) {
    const x0 = R() * w, delay = R() * 1.2, v = speed * (0.7 + R() * 0.6), sway = 20 + R() * 40, ph = R() * TAU, spin = 3 + R() * 6;
    const [c1, c2] = PAL[Math.floor(R() * PAL.length)], kind = R(), s = size * (0.6 + R() * 0.7);
    const tt = u - delay;
    if (tt < 0) continue;
    const y = -40 + v * tt, x = x0 + Math.sin(tt * 2.2 + ph) * sway;
    if (y > h + 40) continue;
    const a = tt * spin + ph, flip = Math.cos(a * 1.4);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * 0.6); ctx.scale(1, Math.max(0.12, Math.abs(flip)));
    ctx.fillStyle = flip > 0 ? c1 : c2;
    if (kind < 0.18) { ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.fill(); }
    else if (kind < 0.3) { ctx.restore(); star(ctx, x, y, s * 0.5, { rot: a, shadow: 0 }); continue; }
    else { ctx.beginPath(); ctx.roundRect(-s / 2, -s * 0.2, s, s * 0.4, s * 0.1); ctx.fill(); ctx.fillStyle = flip > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(-s / 2 + 1, -s * 0.2 + 1, s - 2, s * 0.12); }
    ctx.restore();
  }
  ctx.restore();
}
