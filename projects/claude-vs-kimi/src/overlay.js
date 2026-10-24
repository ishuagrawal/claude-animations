// 2D layers drawn on the 1920×1080 frame around the 3D render: comic posters (radial bursts, the VS card,
// impact frames) behind it, and the fighting-game HUD + callouts in front of it.
import { W, H, clamp, ease, lerp, rng, hash, onN, TAU } from './core.js';

export const F = {
  hud: '"Futura", "Avenir Next Condensed", sans-serif',
  round: '"Arial Rounded MT Bold", "Arial Rounded", "Futura", sans-serif',
  han: '"Songti SC", "STHeiti", "PingFang SC", serif',
};
export const COL = {
  ink: '#0c0a2b', navy: '#151642', red: '#e22f54', claude: '#da7758', claudeDk: '#8a2e2a',
  blue: '#2f7cf6', cyan: '#38d6ff', gold: '#f2c46a', cream: '#f6efd9', ice: '#e2edf6',
};

const pop = (t, t0, d = 0.22) => ease.outBack(clamp((t - t0) / d), 2.2);

// chunky outlined text with an offset shadow (reference: PERFECT!! — cream fill, colored outline, dark drop)
export function chunky(ctx, text, x, y, { size = 120, font = F.hud, weight = 800, italic = true, fill = COL.cream, stroke = '#e2622f', shadow = COL.ink, lw = 0.14, align = 'center', rot = -0.06, scale = 1, alpha = 1, grad = null, stretch = 'condensed', track = 0 } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  ctx.fontStretch = stretch;
  ctx.letterSpacing = `${track}px`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * lw * 2.2; ctx.strokeStyle = shadow;
  ctx.strokeText(text, size * 0.06, size * 0.09);
  ctx.fillStyle = shadow; ctx.fillText(text, size * 0.06, size * 0.09);
  ctx.lineWidth = size * lw * 1.6; ctx.strokeStyle = stroke; ctx.strokeText(text, 0, 0);
  if (grad) {
    const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
    grad.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// callout that pops in with overshoot, holds, then flies out
export function callout(ctx, t, t0, dur, text, opts = {}) {
  const k = t - t0;
  if (k < 0 || k > dur + 0.2) return;
  const s = pop(t, t0, 0.2) * (k > dur ? 1 - ease.in(clamp((k - dur) / 0.2)) : 1);
  const wob = Math.sin(onN(t, 2) * 30) * 0.01;
  chunky(ctx, text, opts.x ?? W / 2, opts.y ?? H / 2, { ...opts, scale: s * (opts.scale ?? 1), rot: (opts.rot ?? -0.06) + wob });
}

// nameplate slab: slides in from a side, the detail line lands ~0.45 s later
export function nameplate(ctx, t, t0, { side = 'left', name, sub, col, colDk, y = 820, hold = 2 } = {}) {
  const k = t - t0;
  if (k < 0) return;
  const out = k > hold ? ease.in(clamp((k - hold) / 0.25)) : 0;
  if (out >= 1) return;
  const dir = side === 'left' ? 1 : -1;
  const slide = ease.outExpo(clamp(k / 0.35));
  const x0 = side === 'left' ? 90 : W - 90;
  const x = x0 - dir * (1 - slide) * 900 - dir * out * 1200;
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  // slab
  const w = 760, h = 132;
  const sx = side === 'left' ? 0 : -w;
  ctx.fillStyle = COL.ink; ctx.fillRect(sx + dir * 14, 14, w, h);
  ctx.fillStyle = col; ctx.fillRect(sx, 0, w, h);
  ctx.fillStyle = colDk; ctx.fillRect(sx, h - 22, w, 22);
  // halftone strip
  ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < w; i += 14) for (let j = 0; j < h; j += 14) {
    const r = clamp((side === 'left' ? i / w : 1 - i / w)) * 4.2;
    ctx.beginPath(); ctx.arc(sx + i, j, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
  chunky(ctx, name, x + (side === 'left' ? 40 : -40), y + 56, { size: 104, align: side, fill: COL.cream, stroke: COL.ink, lw: 0.06, rot: 0, shadow: colDk, track: 2 });
  // sub-line
  const ks = clamp((k - 0.45) / 0.25);
  if (ks > 0 && sub) {
    const sw = 520, sy = y + h + 18;
    const sxx = x + (side === 'left' ? 30 : -30) + dir * (1 - ease.outExpo(ks)) * -300;
    ctx.save();
    ctx.globalAlpha = ks * (1 - out);
    ctx.translate(sxx, sy); ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.fillStyle = COL.ink; ctx.fillRect(side === 'left' ? 0 : -sw, 0, sw, 64);
    ctx.restore();
    chunky(ctx, sub, sxx + (side === 'left' ? 24 : -24), sy + 33, { size: 46, align: side, fill: col === COL.blue ? COL.cyan : COL.gold, stroke: COL.ink, lw: 0.02, rot: 0, shadow: COL.ink, track: 4, italic: false, alpha: ks * (1 - out) });
  }
}

// fighting-game health bars + names along the top
export function hud(ctx, { a = 1, claude = 1, kimi = 1, ghostC = null, ghostK = null, combo = null } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const bw = 760, bh = 40, y = 70;
  const bar = (x, dir, v, ghost, col, colDk, name) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, dir * -0.25, 1, 0, 0);
    ctx.fillStyle = COL.ink; ctx.fillRect(dir > 0 ? -8 : -bw - 8, -8, bw + 16, bh + 16);
    ctx.fillStyle = '#3a1630'; ctx.fillRect(dir > 0 ? 0 : -bw, 0, bw, bh);
    if (ghost !== null) { ctx.fillStyle = '#ffe6a8'; const gw = bw * clamp(ghost); ctx.fillRect(dir > 0 ? bw - gw : -bw, 0, gw, bh); }
    const vw = bw * clamp(v);
    const g = ctx.createLinearGradient(0, 0, 0, bh); g.addColorStop(0, col); g.addColorStop(1, colDk);
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? bw - vw : -bw, 0, vw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(dir > 0 ? bw - vw : -bw, 4, vw, 7);
    ctx.restore();
    chunky(ctx, name, x + (dir > 0 ? 10 : -10), y + bh + 46, { size: 46, align: dir > 0 ? 'left' : 'right', fill: COL.cream, stroke: COL.ink, lw: 0.08, rot: 0, shadow: COL.ink, track: 3 });
  };
  bar(W / 2 - 140 - bw, 1, claude, ghostC, COL.claude, COL.claudeDk, 'CLAUDE');
  bar(W / 2 + 140 + bw, -1, kimi, ghostK, '#4aa8ff', '#1d4fb8', 'KIMI');
  // centre medallion: the moon
  ctx.save();
  ctx.translate(W / 2, y + bh / 2);
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(-16, -8, 48, 0, TAU); ctx.fill();
  ctx.restore();
  chunky(ctx, '∞', W / 2 + 14, y + bh / 2 + 4, { size: 54, italic: false, fill: COL.cream, stroke: COL.ink, lw: 0.05, rot: 0, shadow: COL.ink });
  ctx.restore();
}

// comic radial burst (reference: speed-line / sunburst poster freezes)
export function burst(ctx, t, { cx = W / 2, cy = H / 2, c1 = '#e22f54', c2 = '#f2c46a', c3 = '#0c0a2b', n = 44, spin = 0.15, seed = 4 } = {}) {
  ctx.save();
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  const r = rng(seed);
  const ts = onN(t, 2);
  const R = 2400;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU + ts * spin + (r() - 0.5) * 0.05;
    const wd = (0.25 + r() * 0.55) * TAU / n;
    const inner = 120 + r() * 260;
    ctx.fillStyle = i % 3 === 0 ? c3 : c2;
    ctx.globalAlpha = i % 3 === 0 ? 0.55 : 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner);
    ctx.lineTo(cx + Math.cos(a0 - wd / 2) * R, cy + Math.sin(a0 - wd / 2) * R);
    ctx.lineTo(cx + Math.cos(a0 + wd / 2) * R, cy + Math.sin(a0 + wd / 2) * R);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // halftone vignette dots toward the edges
  ctx.fillStyle = c3;
  for (let y = 0; y < H; y += 18) for (let x = 0; x < W; x += 18) {
    const d = Math.hypot((x - cx) / W, (y - cy) / H);
    const rr = clamp((d - 0.32) * 2.2) * 9;
    if (rr > 0.4) { ctx.beginPath(); ctx.arc(x + (y / 18 % 2) * 9, y, rr, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// risograph grain: speckles of two inks (reference: red/blue noisy graphic panels)
export function riso(ctx, t, { a = 0.35, c1 = '#ff4d6d', c2 = '#38b6ff', seed = 1, x = 0, y = 0, w = W, h = H } = {}) {
  const r = rng(seed + Math.floor(onN(t, 2) * 12));
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.fillRect(x + r() * w, y + r() * h, 2 + r() * 3, 2 + r() * 3);
  }
  ctx.restore();
}

// speed lines (impact frames, launches)
export function speedLines(ctx, t, { cx = W / 2, cy = H / 2, col = '#ffffff', n = 70, inner = 380, a = 0.9, seed = 9 } = {}) {
  const r = rng(seed + Math.floor(onN(t, 2) * 24));
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ang = r() * TAU, wd = 0.004 + r() * 0.012, i0 = inner + r() * 260;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * i0, cy + Math.sin(ang) * i0);
    ctx.lineTo(cx + Math.cos(ang - wd) * 2400, cy + Math.sin(ang - wd) * 2400);
    ctx.lineTo(cx + Math.cos(ang + wd) * 2400, cy + Math.sin(ang + wd) * 2400);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// banner across the frame (DRAW / TIEBREAKER: PRICE / KIMI WINS)
export function banner(ctx, t, t0, dur, text, { y = H / 2, col = COL.gold, size = 190, sub = null, subCol = COL.cream, stroke = COL.ink, slab = COL.ink, slabA = 0.85 } = {}) {
  const k = t - t0;
  if (k < 0 || k > dur + 0.25) return;
  const inn = ease.outExpo(clamp(k / 0.3)), out = k > dur ? ease.in(clamp((k - dur) / 0.25)) : 0;
  ctx.save();
  ctx.globalAlpha = slabA * (1 - out);
  ctx.fillStyle = slab;
  const hh = size * 1.25 * inn;
  ctx.translate(0, y);
  ctx.transform(1, -0.04, 0, 1, 0, 0);
  ctx.fillRect(0, -hh / 2, W, hh);
  ctx.fillStyle = col; ctx.fillRect(0, -hh / 2, W, 8 * inn); ctx.fillRect(0, hh / 2 - 8 * inn, W, 8 * inn);
  ctx.restore();
  const s = pop(t, t0 + 0.05, 0.25) * (1 - out);
  chunky(ctx, text, W / 2, y + (sub ? -size * 0.12 : 0), { size, fill: col, stroke, lw: 0.07, scale: s, rot: -0.04, track: 6, shadow: '#000000' });
  if (sub) {
    const ks = clamp((k - 0.45) / 0.2);
    chunky(ctx, sub, W / 2, y + size * 0.52, { size: size * 0.32, fill: subCol, stroke, lw: 0.06, scale: ks * (1 - out), rot: -0.04, track: 8, italic: false, shadow: '#000000' });
  }
}

// flat impact frame: accent field + radial lines (the 3D renders on top as a silhouette)
export function impactField(ctx, t, { col = '#e22f54', lines = '#0c0a2b', cx = W / 2, cy = H / 2 } = {}) {
  ctx.fillStyle = col; ctx.fillRect(0, 0, W, H);
  speedLines(ctx, t, { cx, cy, col: lines, n: 90, inner: 160, a: 1, seed: 21 });
}

// Chinese brush characters as a graphic accent (reference: katakana ゴゴ in its VS card)
export function hanzi(ctx, text, x, y, { size = 220, col = COL.cream, rot = -0.1, alpha = 1, stroke = COL.ink, seed = 3 } = {}) {
  if (size <= 1) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `900 ${size}px ${F.han}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // manga-SFX lettering: fat ink outline + offset shadow, cream face, dry-brush speckle
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = stroke;
  ctx.strokeText(text, size * 0.05, size * 0.06);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  const r = rng(seed);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = stroke;
  for (let i = 0; i < 120; i++) { ctx.globalAlpha = alpha * 0.5; ctx.fillRect((r() - 0.5) * size * 2, (r() - 0.5) * size, 1 + r() * size * 0.05, 1 + r() * 2); }
  ctx.restore();
}
