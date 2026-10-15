// Product-UI kit in the reference's language (a marketing site's UI recreated as motion graphics):
// GitHub Primer dark palette, layered cards with two-stage shadows + hairline borders + top sheen,
// gradient mono pill tags, buttons, toggles, avatars, macOS traffic lights, the live cursor and
// click ripples, odometer-rolling numbers and syntax-coloured mono code.
import { TAU, clamp, lerp } from './core.js';
import { SANS, MONO, font, icon } from './kit.js';
import { rgba, mix } from './palette.js';

// Primer dark (github.com dark theme) + the film's brand accents
export const G = {
  canvas: '#0d1117', subtle: '#161b22', inset: '#010409', overlay: '#1c2128', raised: '#21262d',
  border: '#30363d', borderMuted: '#21262d', hair: 'rgba(240,246,252,0.10)',
  fg: '#e6edf3', muted: '#8b949e', faint: '#6e7681',
  accent: '#2f81f7', accentFg: '#58a6ff', green: '#238636', greenFg: '#3fb950',
  purple: '#8957e5', purpleFg: '#a371f7', pink: '#db61a2', magenta: '#bf3989',
  star: '#e3b341', gold: '#f2cc60', orange: '#f0883e', red: '#f85149',
  clay: '#da7758',
};

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// transform-aware shadow (canvas shadows ignore the CTM; scale them so push-ins stay consistent)
export function shadow(ctx, blur, oy, color) {
  const m = ctx.getTransform(), k = Math.hypot(m.a, m.b);
  ctx.shadowColor = color; ctx.shadowBlur = blur * k; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy * k;
}
export function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

// Layered card: ambient + contact shadow, fill, top sheen, hairline border, inner top highlight.
export function card(ctx, x, y, w, h, o = {}) {
  const { r = 14, fill = G.subtle, border = G.hair, sh = 0.55, a = 1, sheen = 1, light = false } = o;
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= a;
  if (sh > 0) {
    rr(ctx, x, y, w, h, r);
    shadow(ctx, 60, 30, `rgba(1,4,9,${sh})`); ctx.fillStyle = fill; ctx.fill();
    shadow(ctx, 8, 2, `rgba(1,4,9,${sh * 0.7})`); ctx.fill();
    noShadow(ctx);
  }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 220));
  g.addColorStop(0, `rgba(255,255,255,${(light ? 0.0 : 0.04) * sheen})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = border;
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (!light) { // inner top highlight (catches the key light)
    const hg = ctx.createLinearGradient(x, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.3, `rgba(255,255,255,${0.12 * sheen})`);
    hg.addColorStop(0.7, `rgba(255,255,255,${0.12 * sheen})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = hg; ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.stroke();
  }
  ctx.restore();
}

// Text with font shorthand: returns advance width
export function txt(ctx, s, x, y, { size = 16, weight = 400, fam = SANS, color = G.fg, align = 'left', base = 'alphabetic', track = 0, a = 1 } = {}) {
  if (a <= 0.002) return 0;
  font(ctx, size, weight, fam, track);
  ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color;
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = ga;
  return ctx.measureText(s).width;
}
export function tw(ctx, s, size, weight = 400, fam = SANS, track = 0) { font(ctx, size, weight, fam, track); return ctx.measureText(s).width; }

// Gradient mono pill tag ("MILESTONE_") with blinking underscore; (x, y) = centre-left anchor per align.
export function pill(ctx, x, y, label, { t = 0, a = 1, c0 = G.magenta, c1 = G.purple, align = 'left', size = 15, blink = true } = {}) {
  if (a <= 0.002) return 0;
  const w = tw(ctx, label + '_', size, 600, MONO, 1.5) + 30, h = size + 17;
  const x0 = align === 'center' ? x - w / 2 : x;
  ctx.save(); ctx.globalAlpha *= a;
  rr(ctx, x0, y - h / 2, w, h, 8);
  shadow(ctx, 22, 8, rgba(c0, 0.45));
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill(); noShadow(ctx);
  const hg = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.04)'); hg.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; rr(ctx, x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 7.5); ctx.stroke();
  const lw = txt(ctx, label, x0 + 15, y + 1, { size, weight: 600, fam: MONO, color: '#ffffff', base: 'middle', track: 1.5 });
  if (!blink || Math.floor(t * 2.2) % 2 === 0) txt(ctx, '_', x0 + 15 + lw, y + 1, { size, weight: 600, fam: MONO, color: '#ffffff', base: 'middle' });
  ctx.restore();
  return w;
}

// Button. kind: 'default' (GitHub grey), 'primary' (light), 'green', 'ghost'.
export function button(ctx, x, y, w, h, label, o = {}) {
  const { kind = 'default', iconName = null, iconColor = null, hover = 0, press = 0, a = 1, size = 17, weight = 600, count = null, countText = null, r = 10 } = o;
  if (a <= 0.002) return;
  const S = {
    default: { f: G.raised, fh: '#30363d', b: 'rgba(240,246,252,0.14)', c: G.fg },
    primary: { f: '#f0f6fc', fh: '#ffffff', b: 'rgba(255,255,255,0.6)', c: '#0d1117' },
    green: { f: G.green, fh: '#2ea043', b: 'rgba(240,246,252,0.12)', c: '#ffffff' },
    ghost: { f: 'rgba(0,0,0,0)', fh: 'rgba(177,186,196,0.12)', b: 'rgba(240,246,252,0.14)', c: G.fg },
  }[kind];
  ctx.save(); ctx.globalAlpha *= a;
  const cx = x + w / 2, cy = y + h / 2, k = 1 - press * 0.05;
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  rr(ctx, x, y, w, h, r);
  shadow(ctx, 14, 4, kind === 'primary' ? 'rgba(240,246,252,0.18)' : 'rgba(1,4,9,0.5)');
  ctx.fillStyle = hover > 0 ? mixAny(S.f, S.fh, hover) : S.f; ctx.fill(); noShadow(ctx);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = S.b; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); ctx.stroke();
  // content: [icon] label [| count]
  const cw = count !== null ? tw(ctx, countText ?? String(count), size - 2, 600, SANS) + 22 : 0;
  const iw = iconName ? size + 9 : 0;
  const lw = tw(ctx, label, size, weight, SANS);
  let px = x + (w - cw - iw - lw) / 2;
  if (iconName) { icon(ctx, iconName, px + size / 2, cy, size, iconColor || S.c); px += iw; }
  txt(ctx, label, px, cy + 1, { size, weight, color: S.c, base: 'middle' });
  if (count !== null) {
    const sx = x + w - cw;
    ctx.strokeStyle = S.b; ctx.beginPath(); ctx.moveTo(sx + 0.5, y + 1); ctx.lineTo(sx + 0.5, y + h - 1); ctx.stroke();
    // count bubble
    const bw = cw - 14, bx = sx + 7, bh = size + 6;
    rr(ctx, bx, cy - bh / 2, bw, bh, bh / 2); ctx.fillStyle = 'rgba(110,118,129,0.4)'; ctx.fill();
    if (typeof count === 'function') count(bx + bw / 2, cy);
    else txt(ctx, countText ?? String(count), bx + bw / 2, cy + 1, { size: size - 2, weight: 600, color: S.c, align: 'center', base: 'middle' });
  }
  ctx.restore();
}
function mixAny(a, b, t) { return a.startsWith('#') && b.startsWith('#') ? mix(a, b, clamp(t)) : (t > 0.5 ? b : a); }

// iOS-style toggle; on ∈ [0,1] animates the knob + track colour
export function toggle(ctx, x, y, on, { w = 46, h = 26, color = G.greenFg, a = 1 } = {}) {
  ctx.save(); ctx.globalAlpha *= a;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = mix('#30363d', color, clamp(on)); ctx.fill();
  const ig = ctx.createLinearGradient(0, y, 0, y + h); ig.addColorStop(0, 'rgba(0,0,0,0.25)'); ig.addColorStop(0.5, 'rgba(0,0,0,0)');
  ctx.fillStyle = ig; ctx.fill();
  ctx.strokeStyle = 'rgba(240,246,252,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  const kx = x + h / 2 + (w - h) * on, ky = y + h / 2, kr = h / 2 - 3;
  ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU);
  shadow(ctx, 6, 2, 'rgba(0,0,0,0.45)'); ctx.fillStyle = '#ffffff'; ctx.fill(); noShadow(ctx);
  const kg = ctx.createLinearGradient(0, ky - kr, 0, ky + kr); kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#dfe3e8');
  ctx.fillStyle = kg; ctx.fill();
  ctx.restore();
}

export function avatar(ctx, cx, cy, r, label, c0, c1, { a = 1, ring = G.canvas } = {}) {
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, TAU); ctx.fillStyle = ring; ctx.fill();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  const hg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r);
  hg.addColorStop(0, 'rgba(255,255,255,0.35)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.fill();
  if (label) txt(ctx, label, cx, cy + 1, { size: r * 0.8, weight: 600, color: '#ffffff', align: 'center', base: 'middle' });
  ctx.restore();
}

export function traffic(ctx, x, y, s = 12) {
  [['#ff5f57', '#e0443e'], ['#febc2e', '#dea123'], ['#28c840', '#1aab29']].forEach(([c, d], i) => {
    const cx = x + i * (s + 8) + s / 2;
    ctx.beginPath(); ctx.arc(cx, y, s / 2, 0, TAU); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = d; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - s * 0.12, y - s * 0.14, s * 0.22, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  });
}

// macOS cursor (arrow / I-beam), tip at (x, y). press 0..1 dips the scale.
const ARROW = (() => {
  const p = new Path2D();
  [[0, 0], [0, 17.2], [4.1, 13.3], [6.9, 19.9], [9.7, 18.7], [6.9, 12.3], [12.4, 12.3]].forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
  p.closePath();
  return p;
})();
export function cursor(ctx, x, y, { kind = 'arrow', press = 0, a = 1, s = 1.75 } = {}) {
  if (a <= 0.002) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y);
  const k = s * (1 - press * 0.14);
  ctx.scale(k, k);
  if (kind === 'beam') {
    ctx.lineCap = 'round';
    const beam = () => { ctx.beginPath(); ctx.moveTo(-3.2, -9); ctx.quadraticCurveTo(0, -9, 0, -7); ctx.lineTo(0, 7); ctx.quadraticCurveTo(0, 9, -3.2, 9); ctx.moveTo(3.2, -9); ctx.quadraticCurveTo(0, -9, 0, -7); ctx.moveTo(3.2, 9); ctx.quadraticCurveTo(0, 9, 0, 7); };
    beam(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.4; ctx.stroke();
    beam(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.3; ctx.stroke();
  } else {
    shadow(ctx, 5, 2, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = '#000000'; ctx.fill(ARROW);
    noShadow(ctx);
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(ARROW);
  }
  ctx.restore();
}
// click ripple: expanding ring + fading disc, u = seconds since the click
export function ripple(ctx, x, y, u, { color = '#ffffff', r = 34 } = {}) {
  if (u < 0 || u > 0.6) return;
  const e = 1 - Math.pow(1 - u / 0.6, 3);
  ctx.save();
  ctx.globalAlpha *= 1 - u / 0.6;
  ctx.beginPath(); ctx.arc(x, y, r * e, 0, TAU);
  ctx.fillStyle = rgba(color, 0.14); ctx.fill();
  ctx.strokeStyle = rgba(color, 0.7); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// Odometer number: v is continuous (e.g. 69.4 rolling to 70); digits slide vertically in a clip.
// (x, y) = right edge, alphabetic baseline. Returns width.
export function odometer(ctx, v, x, y, { size = 40, weight = 600, color = G.fg, digits = 0, fill = null } = {}) {
  font(ctx, size, weight, SANS, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width * 1.02, lh = size * 1.12;
  const n = Math.max(digits, String(Math.floor(Math.max(0, v) + 1e-6)).length);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - dw * n - 4, y - size * 0.95, dw * n + 8, size * 1.22); ctx.clip();
  ctx.fillStyle = fill || color;
  for (let i = 0; i < n; i++) {
    const place = Math.pow(10, i);
    // continuous digit: the lower places carry smoothly only during their last unit
    const below = v % place, base = Math.floor(v / place);
    const carry = i === 0 ? v - Math.floor(v) : clamp((below - (place - 1)) / 1);
    const d = base % 10, f = i === 0 ? v - Math.floor(v) : carry;
    const cx = x - dw * (i + 0.5);
    const lead = i > 0 && Math.floor(v / place) === 0; // a leading zero: only the incoming digit shows
    if (!lead) ctx.fillText(String(d), cx, y - f * lh);
    if (f > 0.001) ctx.fillText(String((d + 1) % 10), cx, y + (1 - f) * lh);
  }
  ctx.restore();
  return dw * n;
}

// syntax-coloured mono line: tokens [[text, color], ...]; returns end x
export function code(ctx, tokens, x, y, { size = 17, weight = 400, a = 1 } = {}) {
  let px = x;
  for (const [s, c] of tokens) px += txt(ctx, s, px, y, { size, weight, fam: MONO, color: c, a });
  return px;
}

// rounded "check" bullet (GitHub success)
export function checkDot(ctx, cx, cy, r, { on = 1, color = G.greenFg } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = rgba(color, 0.16 * on + 0.04); ctx.fill();
  ctx.strokeStyle = rgba(color, 0.5 * on + 0.1); ctx.lineWidth = 1; ctx.stroke();
  if (on > 0.01) {
    ctx.globalAlpha *= on;
    icon(ctx, 'check', cx, cy, r * 1.25, color);
  }
  ctx.restore();
}

// soft reveal helper: slide up + fade (product-site stagger)
export function rise(ctx, u, d = 18) {
  const e = 1 - Math.pow(1 - clamp(u), 4);
  ctx.translate(0, (1 - e) * d);
  return e;
}
export { lerp };
