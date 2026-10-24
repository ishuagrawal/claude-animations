// The reference: a little video tile (thumbnail + play button + progress bar) hanging on a string, like the
// reference's bead on a string. Each thumbnail is a tiny "film" in one of the four looks. With o.image the tile is
// a still instead: a white-bordered print with a picture badge and no play button or progress bar (the tease).
import { P, rgba } from './palette.js';
import { drop } from './soft.js';
import { TAU, clamp, ease, lerp } from './core.js';
import { ROLES } from './looks.js';

export const TILE = { w: 272, h: 176, r: 18 };

function thumb(ctx, i, w, h, t) {
  const R = ROLES[['soft', 'pixel', 'ink', 'neon'][i]];
  ctx.save();
  if (i === 0) { // soft flat: dusk hills + sun
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2c46a'); g.addColorStop(1, '#d7863a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.42, h * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8642c'; ctx.beginPath(); ctx.ellipse(w * 0.25, h * 1.05, w * 0.5, h * 0.45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8c4320'; ctx.beginPath(); ctx.ellipse(w * 0.85, h * 1.12, w * 0.55, h * 0.45, 0, 0, TAU); ctx.fill();
  } else if (i === 1) { // pixel: blocky mountains under a square sun
    const u = w / 24;
    ctx.fillStyle = '#29adff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffec27'; ctx.fillRect(u * 16, u * 3, u * 4, u * 4);
    ctx.fillStyle = '#1d6b5e';
    const hs = [9, 8, 7, 6, 6, 7, 8, 9, 10, 9, 8, 7, 7, 8, 9, 10, 11, 10, 9, 8, 8, 9, 10, 11];
    hs.forEach((v, k) => ctx.fillRect(k * u, v * u, u + 0.5, h));
    ctx.fillStyle = '#00e436'; ctx.fillRect(0, u * 13, w, h);
  } else if (i === 2) { // ink: sketched house + tree on paper
    ctx.fillStyle = '#f3ecdc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(156,195,213,0.7)'; ctx.fillRect(w * 0.18, h * 0.46, w * 0.32, h * 0.38);
    ctx.fillStyle = 'rgba(231,163,163,0.75)'; ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.48); ctx.lineTo(w * 0.34, h * 0.22); ctx.lineTo(w * 0.54, h * 0.48); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.strokeRect(w * 0.17, h * 0.45, w * 0.33, h * 0.4);
    ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.47); ctx.lineTo(w * 0.34, h * 0.2); ctx.lineTo(w * 0.56, h * 0.47); ctx.stroke();
    ctx.fillStyle = 'rgba(181,201,142,0.8)'; ctx.beginPath(); ctx.arc(w * 0.75, h * 0.48, h * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.75, h * 0.48, h * 0.2, 0.3, TAU - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.75, h * 0.68); ctx.lineTo(w * 0.75, h * 0.86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.86); ctx.lineTo(w * 0.96, h * 0.85); ctx.stroke();
  } else { // neon: grid + striped sun
    ctx.fillStyle = '#1a1438'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.arc(w * 0.5, h * 0.55, h * 0.3, Math.PI, 0); ctx.clip();
    const g = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.55); g.addColorStop(0, P.neonGold); g.addColorStop(1, P.neonPink);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1438'; for (let k = 0; k < 4; k++) ctx.fillRect(0, h * (0.4 + k * 0.04), w, 2 + k);
    ctx.restore();
    ctx.strokeStyle = P.neonCyan; ctx.lineWidth = 1.5; ctx.shadowColor = P.neonCyan; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(0, h * 0.56); ctx.lineTo(w, h * 0.56); ctx.stroke();
    for (let k = 1; k < 4; k++) { const yy = h * 0.56 + k * k * h * 0.035; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * 10, h * 0.56); ctx.lineTo(w / 2 + k * 50, h); ctx.stroke(); }
  }
  ctx.restore();
}

// a still picture: dawn sky, a sun and two mountains — the universal "image" glyph, painted
function still(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fc9f2'); g.addColorStop(1, '#f7d7c2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(w * 0.72, h * 0.32, h * 0.13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7a9fd1'; ctx.beginPath(); ctx.moveTo(-10, h); ctx.lineTo(w * 0.32, h * 0.38); ctx.lineTo(w * 0.62, h); ctx.fill();
  ctx.fillStyle = '#5b7fb6'; ctx.beginPath(); ctx.moveTo(w * 0.36, h); ctx.lineTo(w * 0.68, h * 0.52); ctx.lineTo(w + 10, h); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(w * 0.32, h * 0.38); ctx.lineTo(w * 0.385, h * 0.48); ctx.lineTo(w * 0.33, h * 0.46); ctx.lineTo(w * 0.27, h * 0.48); ctx.fill();
}
function imageBadge(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const b = new Path2D(); b.roundRect(-22, -18, 44, 36, 7);
  ctx.fillStyle = rgba(P.cream, 0.96); ctx.fill(b);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-14, -11, 28, 22, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, 9); ctx.lineTo(-3, -1); ctx.lineTo(3, 5); ctx.lineTo(7, 1); ctx.lineTo(12, 9); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(6, -5, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// (x, y) = where the string meets the tile's top; o: ref (0-3, may be fractional during a flip), swing (rad),
// play 0..1 (progress), flip 0..1 (card spin that swaps the thumbnail at 0.5), s (scale), stringTop
export function tile(ctx, x, y, o = {}) {
  const { ref = 0, nextRef = ref, swing = 0, play = 0, flip = 0, s = 1, stringTop = -40, alpha = 1, shadow = true, image = false, flash = 0 } = o;
  if (alpha <= 0) return;
  const { w, h, r } = TILE;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // string
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
  const ax = x + Math.sin(swing) * 0, ay = y;
  ctx.beginPath(); ctx.moveTo(x - Math.sin(swing) * (y - stringTop), stringTop); ctx.lineTo(ax, ay); ctx.stroke();
  ctx.translate(ax, ay);
  ctx.rotate(swing);
  ctx.scale(s, s);
  const fx = Math.cos(flip * Math.PI);
  const showRef = flip < 0.5 ? ref : nextRef;
  ctx.scale(Math.max(0.02, Math.abs(fx)), 1);
  // ring + card
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 4, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(0, 4, 4, 0, TAU); ctx.fill();
  const card = new Path2D(); card.roundRect(-w / 2, 12, w, h, r);
  if (shadow) drop(ctx, card, { dx: 14, dy: 16, blur: 22, a: 0.24 });
  if (image) {
    // a print: white border, the still, a picture badge — no play button, no progress bar
    const print = new Path2D(); print.roundRect(-w / 2, 12, w, h, 6);
    ctx.fillStyle = '#fffdf8'; ctx.fill(print);
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 14, 26, w - 28, h - 28); ctx.clip();
    ctx.translate(-w / 2 + 14, 26); still(ctx, w - 28, h - 28);
    ctx.restore();
    imageBadge(ctx, -w / 2 + 44, 12 + h - 38, 1);
    if (flash > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rgba('#ffffff', flash); ctx.fill(print);
      ctx.restore();
    }
    ctx.restore();
    return { center: [x, y + (12 + h / 2) * s], bottom: y + (12 + h) * s };
  }
  ctx.fillStyle = P.ink; ctx.fill(card);
  const inset = new Path2D(); inset.roundRect(-w / 2 + 9, 21, w - 18, h - 18, r - 7);
  ctx.save(); ctx.clip(inset);
  ctx.translate(-w / 2 + 9, 21);
  thumb(ctx, showRef, w - 18, h - 18, 0);
  // gloss
  const gl = ctx.createLinearGradient(0, 0, w, h); gl.addColorStop(0, 'rgba(255,255,255,0.18)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
  // progress bar
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, h - 18 - 14, w - 18, 14);
  ctx.fillStyle = P.cream; ctx.fillRect(10, h - 18 - 9, (w - 38) * clamp(play), 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(10 + (w - 38) * clamp(play), h - 18 - 9, (w - 38) * (1 - clamp(play)), 4);
  ctx.restore();
  // play button (fades as it plays)
  const pa = 1 - clamp(play * 6);
  if (pa > 0) {
    ctx.save(); ctx.globalAlpha *= pa;
    ctx.translate(0, 12 + h / 2 - 6);
    ctx.fillStyle = rgba(P.cream, 0.95); ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(17, 0); ctx.lineTo(-10, 15); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // card back darkening while edge-on
  if (Math.abs(fx) < 0.6) { ctx.fillStyle = rgba(P.ink, (0.6 - Math.abs(fx)) * 0.8); ctx.fill(card); }
  ctx.restore();
  return { center: [x, y + (12 + h / 2) * s], bottom: y + (12 + h) * s };
}

// palette chips popping out of the tile and flying (arc) to targets; returns nothing
export function swatches(ctx, t, starts, from, targets, colors, o = {}) {
  const { dur = 0.42, size = 54 } = o;
  starts.forEach((t0, i) => {
    const dt = t - t0;
    if (dt < 0 || dt > dur + 0.12) return;
    const p = clamp(dt / dur);
    const e = ease.inOut2(p);
    const [x0, y0] = from, [x1, y1] = targets[i];
    const x = lerp(x0, x1, e), y = lerp(y0, y1, e) - Math.sin(p * Math.PI) * 180;
    const sc = dt < 0.1 ? ease.outBack(dt / 0.1) : p > 0.85 ? 1 - (p - 0.85) / 0.15 * 0.6 : 1;
    const a = dt > dur ? 1 - (dt - dur) / 0.12 : 1;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y); ctx.rotate((p - 0.5) * 1.6 * (i % 2 ? 1 : -1)); ctx.scale(sc, sc);
    const c = new Path2D(); c.roundRect(-size / 2, -size / 2, size, size, 10);
    drop(ctx, c, { dx: 8, dy: 10, blur: 12, a: 0.25 });
    ctx.fillStyle = P.cream; ctx.fill(c);
    const in2 = new Path2D(); in2.roundRect(-size / 2 + 6, -size / 2 + 6, size - 12, size - 12, 6);
    ctx.fillStyle = colors[i]; ctx.fill(in2);
    ctx.restore();
  });
}
