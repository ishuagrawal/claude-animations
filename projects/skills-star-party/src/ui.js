// The Claude half, in the same light UI language as GitHub's repo card (white cards, hairline borders,
// soft shadows, Mona Sans + Monaspace Neon):
// - the Claude Code card: traffic lights, ✻ Claude Code, a prompt that takes /video-by-reference with an
//   attached reference.mp4, a shimmering status line, and a row of empty style slots;
// - the reference tile: the clip playing, then studied (a scan, the ball tracked, the frame sampled);
// - the style chips: four swatches, a motion curve and a sound wave, lifted out of the tile into the
//   slots, then launched to build the new world (sky, sun, hills, flowers, the logo, the soundtrack);
// - the pill the card docks into: ✻ [Made with] /video-by-reference, a progress tint, a live equalizer.
import { clamp, lerp, TAU } from './core.js';
import { C, SKILL } from './timeline.js';
import { sp, smooth, eio, eout, font, SANS, MONO } from './kit.js';
import { sky, ball, ballPos, surface, PAL, SUN } from './sky.js';
import { sparkle } from './fx.js';
import { mix, rgba } from './palette.js';
import { LOGO } from './short.js';

export const CLAY = '#da7758', CLAY_DK = '#bf5f3c';
export const CARD = { x: 380, y: 460, w: 840, h: 352, r: 30 };
export const TILE = { x: 1110, y: 226, w: 448, h: 252, r: 22, bez: 10 };
export const PILL = { x: 56, cy: 996, h: 72 };
const CMD = '/' + SKILL, FILE = 'reference.mp4';
// card-relative layout
const INPUT = { x: 28, y: 86, w: CARD.w - 56, h: 76 };
const ATT = { x: CARD.w - 28 - 11 - 232, y: 97, w: 232, h: 54 };
const THUMB = { x: ATT.x + 7, y: ATT.y + 6, w: 74, h: 42 };
const STATUS = { x: 46, y: 212 };
const slotXY = i => [CARD.x + 64 + i * 78, CARD.y + 292];
const SLOT_R = 27;

let meas = null;
const mctx = () => meas || (meas = document.createElement('canvas').getContext('2d'));

// ---------------------------------------------------------------- Claude's spark (✻)
const RAYS = [1, 0.74, 0.92, 0.68, 1, 0.8, 0.88, 0.7, 0.97, 0.76, 0.9, 0.72];
export function spark(ctx, x, y, r, rot = 0, color = CLAY) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) { // tapered rays, round ends
    const a = i * TAU / 12, L = r * RAYS[i], w = r * 0.13;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(r * 0.1, -w * 0.45); ctx.lineTo(L - w * 0.5, -w * 0.5); ctx.arc(L - w * 0.5, 0, w * 0.5, -Math.PI / 2, Math.PI / 2); ctx.lineTo(r * 0.1, w * 0.45); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the reference clip, in any rect
function reference(ctx, t, x, y, w, h, r) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.translate(x, y); ctx.scale(w / 1920, h / 1080); sky(ctx, t); ball(ctx, t);
  ctx.restore();
}

// ---------------------------------------------------------------- the card
const typedN = t => Math.floor(clamp((t - C.type) / (C.typeEnd - C.type)) * CMD.length);
export const keyTimes = () => [...CMD].map((_, i) => C.type + (i + 0.5) * (C.typeEnd - C.type) / CMD.length);
function shimmer(ctx, text, x, y, t, base, hi) { // Claude Code's status shimmer: a highlight sweeps the words
  const w = ctx.measureText(text).width, p = ((t * 0.9) % 1.4) / 1.4, cx = x - 80 + p * (w + 160);
  const g = ctx.createLinearGradient(cx - 70, 0, cx + 70, 0);
  g.addColorStop(0, base); g.addColorStop(0.5, hi); g.addColorStop(1, base);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
}
function check(ctx, x, y, r, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = '#1f883d'; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.42, 0.02 * r); ctx.lineTo(-r * 0.1, r * 0.34); ctx.lineTo(r * 0.45, -r * 0.3); ctx.stroke();
  ctx.restore();
}
// frame rect R (the card, mid-morph); a = content alpha
export function cardContent(ctx, t, R, a) {
  if (a <= 0.002) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, R.r); ctx.clip();
  ctx.translate(R.x, R.y);
  // header: traffic lights, ✻ Claude Code, cwd
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath(); ctx.arc(34 + i * 25, 32, 7.5, 0, TAU); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  });
  font(ctx, 22, 600, SANS, -0.2); const tw = ctx.measureText('Claude Code').width, hx = CARD.w / 2 - (tw + 36) / 2;
  spark(ctx, hx + 12, 32, 13, 0.1);
  ctx.fillStyle = '#1f2328'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Claude Code', hx + 36, 33);
  font(ctx, 17, 500, MONO, 0); ctx.textAlign = 'right'; ctx.fillStyle = '#8c959f'; ctx.fillText('~/skills', CARD.w - 30, 33);
  ctx.fillStyle = '#eef1f4'; ctx.fillRect(0, 64, CARD.w, 1.5);
  // the prompt
  const I = INPUT, focus = smooth((t - C.type + 0.2) / 0.2) * (1 - smooth((t - C.enter - 0.05) / 0.3));
  const press = Math.max(0, 1 - Math.abs(t - C.enter) / 0.14);
  if (focus > 0) { ctx.beginPath(); ctx.roundRect(I.x - 4, I.y - 4, I.w + 8, I.h + 8, 22); ctx.fillStyle = rgba(CLAY, 0.16 * focus); ctx.fill(); }
  ctx.beginPath(); ctx.roundRect(I.x, I.y, I.w, I.h, 18); ctx.fillStyle = mix('#f6f8fa', '#fdf1ec', press * 0.8); ctx.fill();
  ctx.strokeStyle = mix('#d0d7de', CLAY, focus); ctx.lineWidth = 2; ctx.stroke();
  const my = I.y + I.h / 2;
  font(ctx, 30, 600, MONO, 0); ctx.textAlign = 'left'; ctx.fillStyle = CLAY; ctx.fillText('›', I.x + 24, my + 1);
  const ph = 1 - smooth((t - C.type) / 0.06);
  if (ph > 0) { font(ctx, 24, 600, SANS, 0); ctx.fillStyle = rgba('#8c959f', ph); ctx.fillText('Make a video like one you love', I.x + 60, my + 1); }
  const n = typedN(t), typed = CMD.slice(0, n);
  font(ctx, 27, 600, MONO, -0.3);
  const txw = ctx.measureText(typed).width;
  if (t > C.typeEnd + 0.04) { // recognised: the command gets its chip
    const k = clamp(sp(t, C.typeEnd + 0.04, 3, 0.6), 0, 1.1);
    ctx.beginPath(); ctx.roundRect(I.x + 52, my - 22 * k, txw + 16, 44 * k, 10); ctx.fillStyle = rgba(CLAY, 0.13); ctx.fill();
  }
  ctx.fillStyle = t > C.enter ? mix(CLAY_DK, '#8c959f', smooth((t - C.enter) / 0.3) * 0.35) : CLAY_DK;
  ctx.fillText(typed, I.x + 60, my + 1);
  const typing = t > C.type - 0.1 && t < C.typeEnd + 0.08;
  if (focus > 0.5 && t < C.enter && (typing || (t * 2.4) % 1 < 0.6)) { ctx.fillStyle = CLAY; ctx.fillRect(I.x + 62 + txw, my - 17, 3, 34); }
  // the attachment
  const ak = clamp(sp(t, C.attach, 2.2, 0.5), 0, 1.2);
  if (ak > 0.002) {
    ctx.save();
    ctx.translate(ATT.x + ATT.w / 2, ATT.y + ATT.h / 2); ctx.scale(ak, ak); ctx.translate(-ATT.x - ATT.w / 2, -ATT.y - ATT.h / 2);
    const m = ctx.getTransform().a;
    ctx.shadowColor = 'rgba(40,60,100,0.14)'; ctx.shadowBlur = 10 * m; ctx.shadowOffsetY = 3 * m;
    ctx.beginPath(); ctx.roundRect(ATT.x, ATT.y, ATT.w, ATT.h, 12); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#d0d7de'; ctx.lineWidth = 1.5; ctx.stroke();
    reference(ctx, t, THUMB.x, THUMB.y, THUMB.w, THUMB.h, 7);
    const out = t > C.tile && t < C.make + 0.1 ? 1 : 0; // while the clip is out in its tile, the thumb dims
    if (out) { ctx.beginPath(); ctx.roundRect(THUMB.x, THUMB.y, THUMB.w, THUMB.h, 7); ctx.fillStyle = 'rgba(246,248,250,0.7)'; ctx.fill(); }
    else { // play glyph
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath();
      const px = THUMB.x + THUMB.w / 2 + 2, py = THUMB.y + THUMB.h / 2;
      ctx.moveTo(px - 6, py - 8); ctx.lineTo(px + 8, py); ctx.lineTo(px - 6, py + 8); ctx.closePath(); ctx.fill();
    }
    font(ctx, 19, 600, SANS, 0); ctx.fillStyle = '#1f2328'; ctx.textAlign = 'left'; ctx.fillText(FILE, ATT.x + 92, ATT.y + 20);
    font(ctx, 15, 600, SANS, 0); ctx.fillStyle = '#8c959f'; ctx.fillText('0:04 · 1080p', ATT.x + 92, ATT.y + 39);
    ctx.restore();
  }
  // status line
  const S = STATUS;
  const line = (t0, draw) => { const k = eout((t - t0) / 0.25); if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 10); draw(); ctx.restore(); };
  font(ctx, 22, 600, SANS, -0.1); ctx.textAlign = 'left';
  if (t > C.enter + 0.05 && t < C.learned) line(C.enter + 0.05, () => {
    spark(ctx, S.x, S.y, 14, t * 3.2);
    shimmer(ctx, 'Studying reference.mp4' + '.'.repeat(1 + Math.floor(t * 4) % 3), S.x + 26, S.y + 1, t, '#8c959f', CLAY_DK);
  });
  else if (t >= C.learned && t < C.make) line(C.learned, () => {
    check(ctx, S.x, S.y, 13, clamp(sp(t, C.learned, 2.6, 0.45), 0, 1.3));
    ctx.fillStyle = '#1f2328'; ctx.fillText('Style learned', S.x + 26, S.y + 1);
    font(ctx, 18, 600, SANS, 0); ctx.fillStyle = '#8c959f'; ctx.fillText('palette · motion · sound', S.x + 186, S.y + 2);
  });
  else if (t >= C.make) line(C.make, () => {
    spark(ctx, S.x, S.y, 14, t * 3.2);
    shimmer(ctx, 'Making your video…', S.x + 26, S.y + 1, t, '#8c959f', CLAY_DK);
  });
  // empty style slots, waiting
  for (let i = 0; i < 6; i++) {
    const k = clamp(sp(t, C.enter + 0.12 + i * 0.04, 2.4, 0.6), 0, 1.2);
    if (k <= 0.002) continue;
    const [x, y] = slotXY(i);
    ctx.save(); ctx.translate(x - CARD.x, y - CARD.y); ctx.scale(k, k);
    ctx.beginPath(); ctx.arc(0, 0, SLOT_R, 0, TAU); ctx.fillStyle = '#f6f8fa'; ctx.fill();
    ctx.setLineDash([4, 5]); ctx.strokeStyle = '#c4ccd5'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the reference tile
const thumbScreen = () => ({ x: CARD.x + THUMB.x, y: CARD.y + THUMB.y, w: THUMB.w, h: THUMB.h });
const lerpRect = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });
const RETRACT = [C.learned + 0.08, C.make + 0.06];
function tileRect(t) {
  const k = clamp(sp(t, C.tile, 1.7, 0.62), 0, 1.25), back = eio((t - RETRACT[0]) / (RETRACT[1] - RETRACT[0]));
  let r = lerpRect(thumbScreen(), TILE, Math.min(1, k));
  if (k > 1) { const s = 1 + (k - 1) * 0.35, cx = r.x + r.w / 2, cy = r.y + r.h / 2; r = { x: cx - r.w * s / 2, y: cy - r.h * s / 2, w: r.w * s, h: r.h * s }; }
  if (back > 0) r = lerpRect(r, thumbScreen(), back);
  return { ...r, u: Math.min(1, k) * (1 - back), back };
}
const INNER = r => { const b = TILE.bez * r.u; return { x: r.x + b, y: r.y + b, w: r.w - 2 * b, h: r.h - 2 * b }; };
const refToTile = (r, [x, y]) => { const s = INNER(r); return [s.x + x * s.w / 1920, s.y + y * s.h / 1080]; };
// where each style chip is sampled from, in the reference's 1920×1080 frame
const SAMPLE = [t => [420, 170], t => SUN, t => [1260, 985], t => { const b = ballPos(t); return [b.x, b.y]; }, t => { const b = ballPos(t - 0.25); return [b.x, b.y]; }, t => [1500, 1020]];
export function tile(ctx, t) {
  if (t < C.tile || t > RETRACT[1]) return;
  const r = tileRect(t), I = INNER(r), m = ctx.getTransform().a;
  ctx.save();
  ctx.globalAlpha *= 1 - smooth((r.back - 0.7) / 0.3);
  ctx.shadowColor = 'rgba(40,60,100,0.24)'; ctx.shadowBlur = 44 * m * r.u; ctx.shadowOffsetY = 18 * m * r.u;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, lerp(7, TILE.r, r.u)); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(31,35,40,0.08)'; ctx.lineWidth = 1.5; ctx.stroke();
  reference(ctx, t, I.x, I.y, I.w, I.h, lerp(7, 13, r.u));
  const ui = smooth((r.u - 0.75) / 0.25);
  if (ui > 0.01) {
    ctx.save(); ctx.globalAlpha *= ui;
    ctx.beginPath(); ctx.roundRect(I.x, I.y, I.w, I.h, 13); ctx.clip();
    // the scan: an analysed tint behind a bright line
    const sc = (t - C.scan) / (C.scanEnd - C.scan);
    if (sc > 0) {
      const sx = I.x + I.w * Math.min(1, sc), fade = 1 - smooth((t - C.scanEnd) / 0.25);
      ctx.fillStyle = `rgba(9,105,218,${0.1 * fade})`; ctx.fillRect(I.x, I.y, sx - I.x, I.h);
      if (sc < 1) {
        const g = ctx.createLinearGradient(sx - 50, 0, sx + 4, 0);
        g.addColorStop(0, 'rgba(84,174,255,0)'); g.addColorStop(0.8, 'rgba(120,195,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g; ctx.fillRect(sx - 50, I.y, 54, I.h);
        for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx - 8, I.y + 14 + i * (I.h - 28) / 8, 6, 2); }
      }
    }
    // the ball, tracked: its arc as a dotted trail and a bracketed box
    const tr = smooth((t - C.scan - 0.15) / 0.2) * (1 - smooth((t - RETRACT[0]) / 0.15));
    if (tr > 0) {
      ctx.globalAlpha *= tr;
      for (let k = 1; k <= 14; k++) {
        const b = ballPos(t - k * 0.055), [px, py] = refToTile(r, [b.x, b.y]);
        ctx.beginPath(); ctx.arc(px, py, 2.6 * (1 - k / 18), 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = 'rgba(9,105,218,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      }
      const b = ballPos(t), [bx, by] = refToTile(r, [b.x, b.y]), s = I.w / 1920, hw = (b.r + 22) * s, hh = (b.r + 22) * s;
      ctx.strokeStyle = '#0969da'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const [sx2, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath(); ctx.moveTo(bx + sx2 * hw, by + sy2 * (hh - 7)); ctx.lineTo(bx + sx2 * hw, by + sy2 * hh); ctx.lineTo(bx + sx2 * (hw - 7), by + sy2 * hh); ctx.stroke();
      }
      font(ctx, 11, 700, SANS, 0.4); const lw = ctx.measureText('BALL').width;
      ctx.beginPath(); ctx.roundRect(bx - hw, by - hh - 17, lw + 10, 15, 4); ctx.fillStyle = '#0969da'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('BALL', bx - hw + 5, by - hh - 9);
      ctx.globalAlpha /= tr;
    }
    // the sound under the picture: a waveform strip
    const wv = smooth((t - C.scan - 0.25) / 0.2) * (1 - smooth((t - RETRACT[0]) / 0.15));
    if (wv > 0) {
      const y0 = I.y + I.h - 24;
      ctx.fillStyle = `rgba(20,30,50,${0.22 * wv})`; ctx.fillRect(I.x, y0 - 14, I.w, 38);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * wv})`;
      for (let i = 0; i < 52; i++) {
        const x = I.x + 12 + i * (I.w - 24) / 51, beat = Math.exp(-((t * 2 + i * 0.04) % 0.5) * 8);
        const h = 3 + 14 * Math.abs(Math.sin(i * 1.7 + 0.3) * Math.sin(i * 0.37)) * (0.5 + 0.5 * beat);
        ctx.beginPath(); ctx.roundRect(x - 1.5, y0 - h / 2, 3, h, 1.5); ctx.fill();
      }
    }
    // playhead with keyframe ticks on each bounce
    const by0 = I.y + I.h - 8, x0 = I.x + 12, x1 = I.x + I.w - 12, p = (t % 2.4) / 2.4;
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0, by0 - 1.5, x1 - x0, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, by0 - 1.5, (x1 - x0) * p, 3);
    const kt = smooth((t - C.scan - 0.1) / 0.3);
    if (kt > 0) for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,214,90,${kt})`; ctx.save(); ctx.translate(lerp(x0, x1, (i + 0.5) / 5), by0); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
    // sample rings where each chip is lifted out
    for (let i = 0; i < 6; i++) {
      const d = t - (C.chips + i * 0.07);
      if (d < -0.12 || d > 0.25) continue;
      const [px, py] = refToTile(r, SAMPLE[i](t)), e = eout((d + 0.12) / 0.37);
      ctx.strokeStyle = `rgba(255,255,255,${1 - e})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, 6 + 18 * e, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    // a heart: a video you love
    const hx = I.x + 24, hy = I.y + 24;
    ctx.save(); ctx.globalAlpha *= ui;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 8 * m; ctx.shadowOffsetY = 2 * m;
    ctx.beginPath(); ctx.arc(hx, hy, 15, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowColor = 'transparent';
    const beat = 1 + 0.12 * Math.max(0, Math.sin(t * Math.PI * 2)) ** 8;
    ctx.translate(hx, hy + 1); ctx.scale(beat * 0.62, beat * 0.62);
    ctx.fillStyle = '#ff5a6e';
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -10, -14, 0, -6); ctx.bezierCurveTo(10, -14, 14, -1, 0, 9); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the style chips
export const CHIPS = [
  { kind: 'swatch', col: PAL.skyTop }, { kind: 'swatch', col: PAL.sun }, { kind: 'swatch', col: PAL.hill },
  { kind: 'swatch', col: PAL.coral }, { kind: 'motion', col: '#8250df' }, { kind: 'sound', col: '#bf3989' },
];
export function chip(ctx, c, x, y, r, t, a = 1) {
  if (r <= 0.5 || a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(r / 30, r / 30);
  const m = ctx.getTransform().a;
  ctx.shadowColor = 'rgba(40,60,100,0.26)'; ctx.shadowBlur = 12 * m; ctx.shadowOffsetY = 4 * m;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(31,35,40,0.08)'; ctx.lineWidth = 1; ctx.stroke();
  if (c.kind === 'swatch') {
    const g = ctx.createRadialGradient(-7, -8, 1, 0, 0, 23);
    g.addColorStop(0, mix(c.col, '#ffffff', 0.55)); g.addColorStop(0.45, c.col); g.addColorStop(1, mix(c.col, '#000000', 0.08));
    ctx.beginPath(); ctx.arc(0, 0, 23, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-8, -10, 5, 3, -0.6, 0, TAU); ctx.fill();
  } else if (c.kind === 'motion') { // an ease curve with its handles
    ctx.strokeStyle = 'rgba(130,80,223,0.35)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-15, 11); ctx.lineTo(-2, 11); ctx.moveTo(15, -11); ctx.lineTo(2, -11); ctx.stroke();
    ctx.strokeStyle = c.col; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-15, 11); ctx.bezierCurveTo(-2, 11, 2, -11, 15, -11); ctx.stroke();
    ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(-15, 11, 3.6, 0, TAU); ctx.arc(15, -11, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-2, 11, 2.2, 0, TAU); ctx.arc(2, -11, 2.2, 0, TAU); ctx.fill();
  } else { // a live waveform
    ctx.fillStyle = c.col;
    [8, 18, 26, 14, 22, 10].forEach((h, j) => { const hh = h * (0.65 + 0.35 * Math.abs(Math.sin(t * 9 + j * 1.3))); ctx.beginPath(); ctx.roundRect(-16 + j * 6.2, -hh / 2, 3.8, hh, 1.9); ctx.fill(); });
  }
  ctx.restore();
}
// timing: lifted out of the tile, resting in the slots, launched at the world
export const chipLand = i => C.chips + i * 0.07 + 0.34;
export const chipLaunch = i => C.make + i * 0.04;
export const WIPE = [700, 300];
export const FLOWER_X = 1500;
export function chipTarget(i, t, pillEq) {
  return [WIPE, SUN, [960, 1010], [FLOWER_X, surface(FLOWER_X) - 6], [LOGO[0], LOGO[1] + 10], pillEq][i];
}
export const chipArrive = i => [C.wipe, C.sun, C.hills, C.flowers, C.mark, C.dockEnd][i];
// returns where chip i is at t ({x, y, r, a}) or null; pillEq() = the pill's equalizer position
export function chipState(i, t, pillEq, toCam = p => p) {
  const t0 = C.chips + i * 0.07;
  if (t < t0 || t > chipArrive(i) + 0.001) return null;
  const [sx, sy] = slotXY(i);
  if (t < chipLand(i)) { // out of the tile, arcing down into its slot
    const r0 = tileRect(t0), from = refToTile(r0, SAMPLE[i](t0)), u = eio((t - t0) / (chipLand(i) - t0));
    const cx = (from[0] + sx) / 2, cy = Math.min(from[1], sy) - 90, q = 1 - u;
    const k = clamp(sp(t, t0, 2.8, 0.5), 0, 1.25);
    return { x: q * q * from[0] + 2 * q * u * cx + u * u * sx, y: q * q * from[1] + 2 * q * u * cy + u * u * sy, r: SLOT_R * Math.min(1.25, 0.3 + k * 0.85), a: 1 };
  }
  const L = chipLaunch(i);
  if (t < L) { // resting; a settle bounce when it lands, a dip before launch
    const d = t - chipLand(i), land = 0.12 * Math.exp(-d * 9) * Math.sin(d * 26);
    const pre = smooth((t - L + 0.08) / 0.08) * 0.12;
    return { x: sx, y: sy + land * 30 + pre * 20, r: SLOT_R * (1 + land - pre), a: 1 };
  }
  const A = chipArrive(i), T = toCam(chipTarget(i, t, pillEq), A), u = eio((t - L) / (A - L)), q = 1 - u;
  const up = i === 2 ? 60 : 230, cx = (sx + T[0]) / 2, cy = Math.min(sy, T[1]) - up;
  return { x: q * q * sx + 2 * q * u * cx + u * u * T[0], y: q * q * sy + 2 * q * u * cy + u * u * T[1], r: SLOT_R * (1 + 0.35 * Math.sin(Math.PI * u)), a: 1, flying: u };
}
// drawn in the camera's space; toCam(p, time) maps a world point into it
export function chips(ctx, t, pillEq, toCam) {
  CHIPS.forEach((c, i) => {
    const s = chipState(i, t, pillEq, toCam);
    if (!s) return;
    if (s.flying !== undefined) for (let k = 1; k <= 6; k++) { // a soft streak behind it
      const p = chipState(i, t - k * 0.016, pillEq, toCam);
      if (!p || p.flying === undefined) break;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k / 8), 0, TAU); ctx.fillStyle = rgba(c.col, 0.16 * (1 - k / 7)); ctx.fill();
    }
    chip(ctx, c, s.x, s.y, s.r, t, s.a);
  });
}
// a pop where each one arrives (the sky's is the wipe itself), in world space
export function chipPops(ctx, t, pillEq) {
  CHIPS.forEach((c, i) => {
    if (i === 0) return;
    const d = t - chipArrive(i);
    if (d < 0 || d > 0.45) return;
    const [x, y] = chipTarget(i, t, pillEq), e = eout(d / 0.45);
    ctx.save(); ctx.globalAlpha *= 1 - e; ctx.strokeStyle = c.col; ctx.lineWidth = 5 * (1 - e) + 1;
    ctx.beginPath(); ctx.arc(x, y, 16 + 70 * e, 0, TAU); ctx.stroke(); ctx.restore();
    for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + i, dd = 20 + 80 * e; sparkle(ctx, x + Math.cos(a) * dd, y + Math.sin(a) * dd, 10 * (1 - e), j % 2 ? '#ffffff' : c.col, a, 1); }
  });
}
// the sky chip at the wipe origin: grows into the opening circle
export function wipeR(t) { const u = (t - C.wipe) / 0.44; return u <= 0 ? 0 : u >= 1 ? 9999 : 30 + 1600 * eout(u); }

// ---------------------------------------------------------------- the pill
const MADE = 'Made with ';
export function pillWidth(t) {
  const c = mctx();
  font(c, 28, 600, SANS, 0); const mw = c.measureText(MADE).width;
  font(c, 28, 600, MONO, -0.3); const cw = c.measureText(CMD).width;
  return 26 + 38 + 16 + mw * eio((t - C.credit) / 0.4) + cw + 22 + 34 + 28;
}
export const eqPos = R => [R.x + R.w - 28 - 17, R.y + R.h / 2];
export function pillContent(ctx, t, R, a) {
  if (a <= 0.002) return;
  const cy = R.y + R.h / 2;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, R.h / 2); ctx.clip();
  // making: a clay tint fills the pill until the star lands; then it flashes and clears
  const p = clamp((t - C.dockEnd) / (C.hit - C.dockEnd)), done = t > C.hit ? 1 - smooth((t - C.hit - 0.1) / 0.6) : 1;
  ctx.fillStyle = rgba(CLAY, 0.1 * done + (t > C.hit ? 0.12 * Math.max(0, 1 - (t - C.hit) / 0.3) : 0));
  ctx.fillRect(R.x, R.y, R.w * p, R.h);
  // ✻ spins while making, settles when done, pulses on the hit
  const spin = t < C.hit ? t * 3.2 : C.hit * 3.2 + (1 - Math.exp(-(t - C.hit) * 4)) * 0.8;
  const pulse = t > C.hit ? 1 + 0.35 * Math.exp(-(t - C.hit) * 6) * Math.sin((t - C.hit) * 18) : 1;
  spark(ctx, R.x + 26 + 19, cy, 18 * pulse, spin);
  let x = R.x + 26 + 38 + 16;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const mk = eio((t - C.credit) / 0.4);
  if (mk > 0) {
    font(ctx, 28, 600, SANS, 0); const mw = ctx.measureText(MADE).width;
    ctx.save(); ctx.beginPath(); ctx.rect(x, R.y, mw * mk, R.h); ctx.clip();
    ctx.globalAlpha *= mk; ctx.fillStyle = '#59636e'; ctx.fillText(MADE, x - (1 - mk) * 20, cy + 1); ctx.restore();
    x += mw * mk;
  }
  font(ctx, 28, 600, MONO, -0.3); ctx.fillStyle = CLAY_DK; ctx.fillText(CMD, x, cy + 1);
  // the soundtrack, live (the sound chip lands here)
  const [ex, ey] = eqPos(R), ek = clamp(sp(t, C.dockEnd, 2.4, 0.5), 0, 1.2);
  if (ek > 0.01) {
    ctx.fillStyle = '#bf3989';
    for (let j = 0; j < 5; j++) {
      const beat = Math.exp(-((t + 1e-3) % 0.5) * 7), h = ek * (6 + 18 * Math.abs(Math.sin(t * (5 + j * 0.9) + j * 1.7)) * (0.55 + 0.45 * beat));
      ctx.beginPath(); ctx.roundRect(ex - 14 + j * 7, ey - h / 2, 4, h, 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the frame (card ↔ pill) and the stage
export function shell(ctx, R) {
  const m = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(40,60,100,0.2)'; ctx.shadowBlur = Math.min(50, R.h * 0.35) * m; ctx.shadowOffsetY = Math.min(20, R.h * 0.14) * m;
  ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, R.r); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(31,35,40,0.10)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
// before the world: a soft light stage with a faint dot grid and two coloured glows
export function stage(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, '#f7f9fc'); g.addColorStop(1, '#e6ecf5');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  for (const [x, y, r, c] of [[800, 640, 900, 'rgba(218,119,88,0.10)'], [1400, 300, 800, 'rgba(110,170,255,0.13)'], [300, 200, 600, 'rgba(255,255,255,0.7)']]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let y = 18; y < 1080; y += 36) for (let x = 18 + ((y / 36) % 2) * 0; x < 1920; x += 36) {
    const d = Math.hypot(x - 860, (y - 560) * 1.4), a = 0.09 * Math.max(0, 1 - d / 1300);
    if (a < 0.01) continue;
    ctx.fillStyle = `rgba(60,80,120,${a})`; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
}
export { CMD };
