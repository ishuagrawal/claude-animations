// Ambient life (the reference never sits still): floating confetti — rings, dots, plus signs,
// squiggles, half-moons — drifting and rotating slowly; big soft field shapes for depth.
import { P, rgba, mix } from './palette.js';
import { TAU, clamp, ease, rng, noise } from './core.js';

// area = [x, y, w, h]; avoid = [x, y, w, h] rect kept clear (for the subject/captions)
export function confetti(ctx, t, { seed = 1, n = 22, colors = [P.butter, P.rose, P.sky, P.mint], area = [0, 0, 1920, 1080], avoid = null, t0 = -10, size = 1, alpha = 1, drift = 1 }) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    let x = area[0] + r() * area[2], y = area[1] + r() * area[3];
    const kind = Math.floor(r() * 6), col = colors[Math.floor(r() * colors.length)];
    const s = (10 + r() * 16) * size, ph = r() * TAU, rot0 = r() * TAU, spin = (r() - 0.5) * 1.2;
    const delay = r() * 0.6;
    if (avoid && x > avoid[0] && x < avoid[0] + avoid[2] && y > avoid[1] && y < avoid[1] + avoid[3]) continue;
    const p = ease.outBack(clamp((t - t0 - delay) / 0.5), 2);
    if (p <= 0) continue;
    x += Math.sin(t * 0.5 * drift + ph) * 18 * drift; y += Math.cos(t * 0.37 * drift + ph * 1.3) * 14 * drift;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y); ctx.rotate(rot0 + t * spin * drift); ctx.scale(p, p);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (kind) {
      case 0: ctx.lineWidth = s * 0.22; ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.stroke(); break; // ring
      case 1: ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, TAU); ctx.fill(); break; // dot
      case 2: ctx.lineWidth = s * 0.22; ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, 0); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.5); ctx.stroke(); break; // plus
      case 3: ctx.lineWidth = s * 0.2; ctx.beginPath(); for (let k = 0; k <= 16; k++) { const xx = -s + k * s / 8, yy = Math.sin(k / 16 * TAU * 1.5 + t * 2) * s * 0.22; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); break; // squiggle
      case 4: ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI); ctx.closePath(); ctx.fill(); break; // half moon
      default: ctx.lineWidth = s * 0.2; ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.48, s * 0.38); ctx.lineTo(-s * 0.48, s * 0.38); ctx.closePath(); ctx.stroke(); // triangle
    }
    ctx.restore();
  }
}

// Big soft organic shapes a shade off the field color, drifting slowly (depth on flat fields)
export function fieldShapes(ctx, t, field, { seed = 3, n = 4, k = 0.06, dark = false } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = mix(field, dark ? '#000000' : '#ffffff', k);
  for (let i = 0; i < n; i++) {
    const x = r() * 1920, y = r() * 1080, R = 220 + r() * 380, ph = r() * TAU;
    ctx.beginPath();
    for (let j = 0; j <= 48; j++) {
      const a = j / 48 * TAU;
      const rr = R * (1 + 0.12 * Math.sin(a * 3 + ph + t * 0.3) + 0.06 * Math.sin(a * 5 - t * 0.4));
      const xx = x + Math.cos(a) * rr + Math.sin(t * 0.2 + ph) * 30, yy = y + Math.sin(a) * rr;
      j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.fill();
  }
  ctx.restore();
}
