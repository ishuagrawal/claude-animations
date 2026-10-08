// Type: anime name stamps (heavy italic, thick dark outline, slam-in), terminal mono.
import { P, mix, rgba } from './palette.js';
import { clamp, ease, inv } from './core.js';

export const FAM = {
  display: '"Futura", "Avenir Next Condensed", "Arial Black", sans-serif',
  heavy: '"Avenir Next Condensed", "Futura", "Arial Black", sans-serif',
  mono: '"SF Mono", "Menlo", ui-monospace, monospace',
  round: '"Arial Rounded MT Bold", "Avenir Next", sans-serif',
};
export function setFont(ctx, size, { fam = 'display', weight = 800, italic = false, stretch = 'normal', track = 0 } = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FAM[fam] || fam}`;
  ctx.fontStretch = stretch;
  ctx.letterSpacing = track + 'px';
}

// Outlined display text (fill + thick outline + hard drop shadow)
export function outlined(ctx, s, x, y, size, { fill = P.lemon, line = P.line, lw = 0.16, shadow = P.line, sh = 0.08, fam = 'display', italic = true, stretch = 'condensed', weight = 800, align = 'left', base = 'alphabetic', track = 0, grad = null } = {}) {
  setFont(ctx, size, { fam, weight, italic, stretch, track });
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  if (shadow) {
    ctx.strokeStyle = shadow; ctx.lineWidth = size * lw; ctx.fillStyle = shadow;
    ctx.strokeText(s, x + size * sh, y + size * sh); ctx.fillText(s, x + size * sh, y + size * sh);
  }
  ctx.strokeStyle = line; ctx.lineWidth = size * lw;
  ctx.strokeText(s, x, y);
  if (grad) {
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y);
    grad.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}

// Name stamp: NAME slams in (overshoot), the descriptor slides in 0.35 s later.
// t is local time since the stamp's cue; dur = how long it stays.
export function nameStamp(ctx, t, { name, sub, x, y, size = 150, col = P.lemon, subCol = P.white, subBg = P.line, dur = 1.6, align = 'left', rot = -0.06, subDelay = 0.35, fadeOut = true }) {
  if (t < 0 || t > dur) return;
  const pin = clamp(t / 0.12), out = fadeOut ? inv(dur - 0.12, dur, t) : 0;
  const sc = pin < 1 ? 1.6 - 0.6 * ease.outBack(pin, 2.2) : 1;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.globalAlpha *= (1 - out);
  outlined(ctx, name, 0, 0, size, { fill: col, align, grad: [[0, mix(col, P.white, 0.55)], [0.55, col], [1, mix(col, P.brown, 0.35)]] });
  if (sub && t > subDelay) {
    const p = ease.out(clamp((t - subDelay) / 0.2));
    setFont(ctx, size * 0.3, { fam: 'heavy', weight: 700, italic: true, stretch: 'normal', track: 1 });
    const w = ctx.measureText(sub).width;
    const bx = align === 'left' ? size * 0.08 : align === 'right' ? -w - size * 0.3 : -w / 2 - size * 0.1;
    const by = size * 0.22;
    ctx.save();
    ctx.translate((1 - p) * -120, 0);
    ctx.globalAlpha *= p;
    ctx.fillStyle = subBg;
    ctx.beginPath(); ctx.moveTo(bx - size * 0.05, by); ctx.lineTo(bx + w + size * 0.25, by); ctx.lineTo(bx + w + size * 0.18, by + size * 0.42); ctx.lineTo(bx - size * 0.12, by + size * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = subCol; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(sub, bx + size * 0.06, by + size * 0.215);
    ctx.restore();
  }
  ctx.restore();
}

// typed text helper
export const typed = (s, t, t0, cps = 24) => s.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
