// TIPS (how to get the best results) + END CARD (/video-by-reference, tagline, P.S. wink).
import { P, rgba, mix } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, BEAT } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { caption, setFont, MONO, SANS } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { heart } from '../hands.js';

const TIPS = [
  { x: 470, col: P.butter, l1: 'Bring a video', l2: 'you love', sub: 'a bold, clear style works best' },
  { x: 960, col: P.mint, l1: 'Tell it', l2: 'your idea', sub: 'the story, length and mood' },
  { x: 1450, col: P.rose, l1: 'Give notes', l2: 'to polish', sub: '“slower”, “more detail”…' },
];
const IY = 470, IR = 118;

function icon(ctx, i, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = P.navy; ctx.strokeStyle = P.navy; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (i === 0) { // video card with a heart
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-r * 0.55, -r * 0.36, r * 1.1, r * 0.72, r * 0.1); ctx.fill();
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.18); ctx.lineTo(r * 0.2, 0); ctx.lineTo(-r * 0.12, r * 0.18); ctx.fill();
    heart(ctx, r * 0.5, -r * 0.36, r * 0.5, P.rose, 0.2);
  } else if (i === 1) { // lightbulb
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.36, 0, TAU); ctx.fill();
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-r * 0.17, r * 0.24, r * 0.34, r * 0.24, r * 0.06); ctx.fill();
    ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.07;
    for (let k = -2; k <= 2; k++) { const a = -Math.PI / 2 + k * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, -r * 0.12 + Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(a) * r * 0.66, -r * 0.12 + Math.sin(a) * r * 0.66); ctx.stroke(); }
  } else { // two chat bubbles
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-r * 0.58, -r * 0.42, r * 0.8, r * 0.5, r * 0.16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.06); ctx.lineTo(-r * 0.48, r * 0.22); ctx.lineTo(-r * 0.22, r * 0.06); ctx.fill();
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-r * 0.12, -r * 0.08, r * 0.7, r * 0.46, r * 0.16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.36, r * 0.36); ctx.lineTo(r * 0.46, r * 0.52); ctx.lineTo(r * 0.18, r * 0.36); ctx.fill();
    ctx.fillStyle = P.white; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(r * (0.08 + k * 0.15), r * 0.15, r * 0.045, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function tips(ctx, t) {
  ctx.fillStyle = P.navy; ctx.fillRect(0, 0, 1920, 1080);
  fieldShapes(ctx, t, P.navy, { seed: 41, n: 5, k: 0.05 });
  confetti(ctx, t, { seed: 88, n: 24, size: 1.2, colors: [P.butter, P.rose, P.mint, P.sky], area: [-40, 120, 2000, 980], avoid: [250, 220, 1420, 760], t0: C.tips, alpha: 0.85 });
  const col = seg(t, C.collapse, C.end, ease.inBack);
  // dotted connector draws through the three icons
  const ln = seg(t, C.tip[0] + 0.2, C.tip[2] + 0.2, ease.inOut) * (1 - col);
  if (ln > 0) { ctx.save(); ctx.strokeStyle = rgba(P.lilac, 0.6); ctx.lineWidth = 7; ctx.setLineDash([2, 20]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(TIPS[0].x, IY); ctx.lineTo(lerp(TIPS[0].x, TIPS[2].x, ln), IY); ctx.stroke(); ctx.restore(); }
  TIPS.forEach((tp, i) => {
    const p = ease.outBack(clamp((t - C.tip[i]) / 0.45), 1.8);
    if (p <= 0) return;
    const x = lerp(tp.x, 960, col), y = lerp(IY, 470, col), s = p * (1 - col);
    if (s <= 0.01) return;
    const pulse = 1 + 0.04 * Math.sin((t - C.tip[i]) * Math.PI * 2 / (BEAT * 2));
    ctx.save(); ctx.translate(x, y); ctx.scale(s * pulse, s * pulse);
    ctx.fillStyle = rgba('#000000', 0.25); ctx.beginPath(); ctx.arc(8, 14, IR, 0, TAU); ctx.fill();
    ctx.fillStyle = tp.col; ctx.beginPath(); ctx.arc(0, 0, IR, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, IR + 22, -2.2, 0.4); ctx.stroke();
    icon(ctx, i, 0, 0, IR);
    // step number
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(-IR * 0.72, -IR * 0.72, 30, 0, TAU); ctx.fill();
    setFont(ctx, 34, 800); ctx.fillStyle = P.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), -IR * 0.72, -IR * 0.72 + 2);
    ctx.restore();
    caption(ctx, t, { text: tp.l1 + '\n' + tp.l2, x: tp.x, y: IY + IR + 92, t0: C.tip[i] + 0.15, t1: C.collapse - 0.2, size: 50, align: 'center', color: P.white, lineH: 1.15, stagger: 0.05 });
    caption(ctx, t, { text: tp.sub, x: tp.x, y: IY + IR + 92 + 118, t0: C.tip[i] + 0.4, t1: C.collapse - 0.25, size: 30, weight: 600, align: 'center', color: P.lilac, stagger: 0.03 });
  });
  caption(ctx, t, { text: 'For the best results', x: 960, y: 190, t0: C.capTips, t1: C.collapse - 0.1, size: 76, align: 'center', color: P.white, hl: ['best'], hlColor: P.butter });
  // Claude nods along from the corner
  const en = ease.outBack(clamp((t - C.tips - 0.3) / 0.5), 1.4) * (1 - seg(t, C.collapse - 0.2, C.collapse + 0.2, ease.inBack));
  if (en > 0) {
    const nod = C.tip.reduce((a, tt) => a + Math.max(0, Math.sin(clamp((t - tt - 0.1) / 0.3) * Math.PI)) * 0.06, 0);
    sprayAt(ctx, P.navyDk, 1745, 1062, 130, 18, 0.9 * en);
    claude(ctx, { x: 1745, y: 1060 + (1 - en) * 300, s: 190, sy: 1 - nod, sx: 1 + nod * 0.5, eyes: 'happy', blush: 0.6, lx: -1, ly: -0.6, armL: 0.6 + Math.sin(t * 4) * 0.1, armR: 0.2, blink: 0 });
  }
  // iris out: a cream disc grows from where the tips collapsed
  const ir = seg(t, C.end - 0.38, C.end, ease.in);
  if (ir > 0) { ctx.fillStyle = P.cream; ctx.beginPath(); ctx.arc(960, 470, 20 + ir * 1150, 0, TAU); ctx.fill(); }
}

function endCard(ctx, t) {
  ctx.fillStyle = P.cream; ctx.fillRect(0, 0, 1920, 1080);
  fieldShapes(ctx, t, P.cream, { seed: 5, n: 5, k: 0.035, dark: true });
  confetti(ctx, t, { seed: 99, n: 38, size: 1.4, colors: [P.butter, P.rose, P.sky, P.mint, P.violetLt], area: [-80, -60, 2080, 1200], avoid: [330, 120, 1260, 840], t0: C.pill + 0.05 });
  // the pill
  const pp = ease.outBack(clamp((t - C.pill) / 0.5), 1.7);
  const PY = 560;
  let pillTop = PY;
  if (pp > 0) {
    ctx.save(); ctx.translate(960, PY); ctx.scale(pp, pp);
    setFont(ctx, 78, 700, MONO);
    const label = 'video-by-reference', sw = ctx.measureText('/').width, lw = ctx.measureText(label).width;
    const Wd = sw + lw + 100, Hh = 140;
    ctx.fillStyle = rgba(P.navy, 0.16); ctx.beginPath(); ctx.roundRect(-Wd / 2 + 10, -Hh / 2 + 16, Wd, Hh, Hh / 2); ctx.fill();
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-Wd / 2, -Hh / 2, Wd, Hh, Hh / 2); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = P.butter; ctx.fillText('/', -Wd / 2 + 50, 4);
    ctx.fillStyle = P.white; ctx.fillText(label, -Wd / 2 + 50 + sw, 4);
    ctx.restore();
    pillTop = PY - 70;
  }
  // Claude hops up onto the pill, waves, winks
  if (t > C.hopOn - 0.2) {
    const hp = hop(t, C.hopOn, 0.5, 0);
    const e = clamp((t - C.hopOn) / 0.5);
    const x0 = lerp(1780, 960, ease.inOut(e)), y0 = lerp(1260, pillTop, e) - Math.sin(e * Math.PI) * 420;
    const wave = t > C.hopOn + 0.6 ? Math.sin((t - C.hopOn) * 10) * 0.35 : 0;
    const wink = t > C.wink && t < C.wink + 0.7;
    const bb = t > C.hopOn + 0.6 ? Math.sin((t - C.hopOn) * Math.PI * 2 / (BEAT * 2)) * 0.02 : 0;
    claude(ctx, { x: x0, y: y0, rot: (1 - e) * -0.3 * (e > 0 ? 1 : 0), s: 250, sx: hp.sx * (1 - bb * 0.5), sy: hp.sy * (1 + bb), armR: 1.1 + wave, armL: 0.25, eyes: 'happy', eyeR: wink ? 'happy' : null, eyeL: wink ? 'open' : null, blush: 0.8, ly: -0.2, blink: 0 });
    if (wink) { const sp = clamp((t - C.wink) / 0.5); ctx.save(); ctx.globalAlpha = 1 - sp; ctx.fillStyle = P.butter; for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.5; ctx.beginPath(); ctx.arc(1090 + Math.cos(a) * (40 + sp * 60), pillTop - 200 + Math.sin(a) * (40 + sp * 60), 8, 0, TAU); ctx.fill(); } ctx.restore(); }
  }
  caption(ctx, t, { text: 'Show it a video. Get a film.', x: 960, y: 760, t0: C.tagline, size: 66, align: 'center', color: P.navy, hl: ['film.'], hlColor: P.rose, stagger: 0.09 });
  caption(ctx, t, { text: 'P.S. This video was made with it.', x: 960, y: 960, t0: C.ps, size: 38, weight: 600, align: 'center', color: rgba(P.navy, 0.7), stagger: 0.05 });
  // fade to cream at the very end
  const f = seg(t, C.fin - 0.45, C.fin, ease.in);
  if (f > 0) { ctx.fillStyle = rgba(P.cream, f); ctx.fillRect(0, 0, 1920, 1080); }
}

export const outro = [
  { name: 'tips', start: C.tips, end: C.end, draw: (ctx, t) => (tips(ctx, t), { vig: 0, grain: 0 }) },
  { name: 'end', start: C.end, end: C.fin, draw: (ctx, t) => (endCard(ctx, t), { vig: 0, grain: 0 }) },
];
