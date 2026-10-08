// Kinetic type in the reference's idiom: geometric sans, words rise in one by one behind a
// baseline mask, the key word turns the accent color and gets a drawn underline; exits rise out.
import { P, rgba } from './palette.js';
import { clamp, inv, ease, TAU } from './core.js';

export const SANS = '"Avenir Next", "Avenir", "Helvetica Neue", sans-serif';
export const MONO = '"SF Mono", "Menlo", ui-monospace, monospace';
export function setFont(ctx, size, weight = 700, fam = SANS, track = 0) {
  ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = track + 'px';
}

// o: { text, x, y, t0, t1, size, color, weight, align, hl:[words], hlColor, ulColor, stagger, lineH, track }
export function caption(ctx, t, o) {
  const { text, x, y, t0, t1 = Infinity, size = 64, color = P.navy, weight = 800, align = 'left',
    hl = [], hlColor = P.rose, ulColor = null, stagger = 0.07, lineH = 1.18, track = -0.5, dur = 0.5, fam = SANS } = o;
  if (t < t0) return;
  ctx.save();
  setFont(ctx, size, weight, fam, track);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const lines = text.split('\n').map(l => l.split(' '));
  const space = ctx.measureText(' ').width;
  let wi = 0;
  const nWords = lines.reduce((a, l) => a + l.length, 0);
  lines.forEach((words, li) => {
    const widths = words.map(w => ctx.measureText(w.replace(/_/g, ' ')).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const by = y + li * size * lineH;
    words.forEach((w, k) => {
      const label = w.replace(/_/g, ' ');
      const ta = t0 + wi * stagger;
      const p = ease.outExpo(clamp((t - ta) / dur));
      const te = t1 + wi * stagger * 0.6;
      const q = ease.inExpo(clamp((t - te) / 0.35));
      if (p > 0 && q < 1) {
        const isHl = hl.includes(label.replace(/[^\w/-]/g, '')) || hl.includes(label);
        ctx.save();
        // baseline mask: words rise from below the line
        ctx.beginPath(); ctx.rect(cx - 10, by - size * 1.1, widths[k] + 20, size * 1.42); ctx.clip();
        const dy = (1 - p) * size * 1.05 - q * size * 1.15;
        ctx.fillStyle = isHl ? hlColor : color;
        ctx.globalAlpha *= (1 - q);
        ctx.fillText(label, cx, by + dy);
        ctx.restore();
        if (isHl) {
          const u = ease.inOutSine(clamp((t - ta - 0.22) / 0.4)) * (1 - q);
          if (u > 0) {
            ctx.fillStyle = ulColor || hlColor;
            const uh = Math.max(4, size * 0.085);
            ctx.beginPath(); ctx.roundRect(cx, by + size * 0.16, widths[k] * u, uh, uh / 2); ctx.fill();
          }
        }
      }
      cx += widths[k] + space;
      wi++;
    });
  });
  ctx.restore();
  return nWords;
}

// Numbered step badge (circle pops with overshoot, digit rises)
export function badge(ctx, t, n, x, y, r, t0, { bg = P.butter, fg = P.navy, t1 = Infinity } = {}) {
  const p = ease.outBack(clamp((t - t0) / 0.45), 2.2) * (1 - ease.inBack(clamp((t - t1) / 0.3)));
  if (p <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(p, p);
  ctx.rotate((1 - clamp((t - t0) / 0.45)) * -0.6);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  setFont(ctx, r * 1.15, 800);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 0, r * 0.06);
  ctx.restore();
}

// Rounded pill label that pops in. Returns its width.
export function pill(ctx, t, text, x, y, { t0 = -1, t1 = Infinity, size = 30, bg = P.white, fg = P.navy, weight = 700, padX = 0.75, h = 1.7, align = 'center', fam = SANS, icon = null } = {}) {
  const p = ease.outBack(clamp((t - t0) / 0.4), 1.8) * (1 - ease.inBack(clamp((t - t1) / 0.3)));
  setFont(ctx, size, weight, fam);
  const tw = ctx.measureText(text).width + (icon ? size * 1.1 : 0);
  const W = tw + size * padX * 2, Hh = size * h;
  if (p <= 0) return W;
  ctx.save();
  const ox = align === 'center' ? 0 : align === 'left' ? W / 2 : -W / 2;
  ctx.translate(x + ox, y); ctx.scale(p, p);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-W / 2, -Hh / 2, W, Hh, Hh / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (icon) icon(ctx, -W / 2 + size * padX + size * 0.4, 0, size * 0.42);
  ctx.fillText(text, -W / 2 + size * padX + (icon ? size * 1.1 : 0), size * 0.05);
  ctx.restore();
  return W;
}

// typewriter substring
export const typed = (s, t, t0, cps = 24) => s.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
