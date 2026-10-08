// ④ COMPOSE — Claude (in headphones) conducts: notes land on a staff on the beat as a playhead
// sweeps the film's timeline, a waveform grows underneath, sound-effect icons pop on the action;
// then everything rolls up into one .mp4 card that whooshes off toward the viewer.
import { P, rgba, mix } from '../palette.js';
import { C, STAFF_MELODY, SFX_MARKS } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, rng, BEAT } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { caption, badge, setFont, MONO } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { thumbImg } from './animate.js';

const X0 = 470, X1 = 1770, PLAY0 = C.notes0, PLAY1 = C.notes0 + 3.75;
const STAFF = [338, 366, 394, 422, 450];
const TH = { w: 175, h: 98, gap: 12, y: 650 };
const WAVE_Y = 790;
export const MP4 = { x: 1110, y: 590 };
const xFor = t => X0 + (t - PLAY0) / (PLAY1 - PLAY0) * (X1 - X0);
const yFor = m => 452 - (m - 71) * 7.5;

export function mp4Card(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const w = 290, h = 350, f = 70;
  ctx.fillStyle = rgba('#000000', 0.2); ctx.beginPath(); ctx.roundRect(-w / 2 + 12, -h / 2 + 16, w, h, 26); ctx.fill();
  ctx.fillStyle = P.white;
  ctx.beginPath(); ctx.moveTo(-w / 2 + 26, -h / 2); ctx.lineTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2, -h / 2 + f); ctx.lineTo(w / 2, h / 2 - 26); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 26, h / 2); ctx.lineTo(-w / 2 + 26, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 26); ctx.lineTo(-w / 2, -h / 2 + 26); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 26, -h / 2); ctx.fill();
  ctx.fillStyle = P.ui; ctx.beginPath(); ctx.moveTo(w / 2 - f, -h / 2); ctx.lineTo(w / 2 - f, -h / 2 + f - 14); ctx.quadraticCurveTo(w / 2 - f, -h / 2 + f, w / 2 - f + 14, -h / 2 + f); ctx.lineTo(w / 2, -h / 2 + f); ctx.fill();
  ctx.fillStyle = P.cobalt; ctx.beginPath(); ctx.arc(0, -24, 74, 0, TAU); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(-22, -58); ctx.lineTo(36, -24); ctx.lineTo(-22, 10); ctx.closePath(); ctx.fill();
  setFont(ctx, 30, 700, MONO); ctx.fillStyle = P.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('my-film.mp4', 0, 110);
  ctx.fillStyle = P.rose; ctx.beginPath(); ctx.roundRect(-w / 2 + 22, -h / 2 + 22, 66, 34, 17); ctx.fill();
  setFont(ctx, 20, 800); ctx.fillStyle = P.white; ctx.textBaseline = 'middle'; ctx.fillText('HD', -w / 2 + 55, -h / 2 + 40);
  ctx.restore();
}

export function headphones(ctx, a, s) {
  // band over the head + cups at the sides, from the rig's anchors
  const [tx, ty] = a.top, k = a.k;
  const hw = 147 / 2 * k;
  ctx.save();
  ctx.strokeStyle = P.navy; ctx.lineWidth = 13 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(tx, ty + 30 * k, hw + 8 * k, 58 * k, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
  for (const sd of [-1, 1]) {
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(tx + sd * (hw + 2 * k) - 15 * k, ty + 14 * k, 30 * k, 50 * k, 12 * k); ctx.fill();
    ctx.fillStyle = P.butter; ctx.beginPath(); ctx.roundRect(tx + sd * (hw + 2 * k) - 9 * k, ty + 22 * k, 18 * k, 34 * k, 8 * k); ctx.fill();
  }
  ctx.restore();
}

function sfxIcon(ctx, kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.violet; ctx.fillStyle = P.violet; ctx.lineWidth = 6; ctx.lineCap = 'round';
  if (kind === 'whoosh') { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-20, -12 + k * 12); ctx.quadraticCurveTo(4, -22 + k * 12, 20 - k * 6, -10 + k * 12); ctx.stroke(); } }
  else if (kind === 'pop') { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); ctx.stroke(); } }
  else { ctx.beginPath(); ctx.moveTo(-16, 10); ctx.quadraticCurveTo(-16, -20, 0, -20); ctx.quadraticCurveTo(16, -20, 16, 10); ctx.closePath(); ctx.fill(); ctx.fillRect(-20, 8, 40, 6); ctx.beginPath(); ctx.arc(0, 18, 5, 0, TAU); ctx.fill(); }
  setFont(ctx, 22, 700); ctx.fillStyle = P.white; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(kind, 0, 46);
  ctx.restore();
}

function draw(ctx, t) {
  ctx.fillStyle = P.violet; ctx.fillRect(0, 0, 1920, 1080);
  fieldShapes(ctx, t, P.violet, { seed: 31, n: 5, k: 0.06 });
  confetti(ctx, t, { seed: 66, n: 22, size: 1.2, colors: [P.butter, P.white, P.rose, P.mintLt], area: [-40, 220, 2000, 900], avoid: [380, 260, 1460, 640], t0: C.score - 0.2, alpha: 0.85 });

  const roll = seg(t, C.rollUp, C.mp4 - 0.05, ease.inBack);
  const tl = (x, y) => [lerp(x, MP4.x, roll), lerp(y, MP4.y, roll)];
  const sc = 1 - roll;
  const build = ease.out(clamp((t - C.score) / 0.6));
  const play = clamp((t - PLAY0) / (PLAY1 - PLAY0));
  const px = lerp(X0, X1, play);

  if (sc > 0.01) {
    ctx.save();
    ctx.translate(MP4.x, MP4.y); ctx.scale(sc, sc); ctx.translate(-MP4.x, -MP4.y);
    // staff
    ctx.strokeStyle = rgba(P.white, 0.7); ctx.lineWidth = 3;
    STAFF.forEach((y, k) => { ctx.beginPath(); ctx.moveTo(X0 - 40, y); ctx.lineTo(lerp(X0 - 40, X1 + 30, ease.inOut(clamp(build * 1.2 - k * 0.05))), y); ctx.stroke(); });
    ctx.fillStyle = P.butter; ctx.beginPath(); ctx.arc(X0 - 80, 394, 30 * build, 0, TAU); ctx.fill();
    setFont(ctx, 40, 800); ctx.fillStyle = P.violet; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', X0 - 82, 398);
    // notes land on the beat as the playhead passes
    STAFF_MELODY.forEach(([tn, m], i) => {
      const p = ease.outBack(clamp((t - tn) / 0.28), 2.6);
      if (p <= 0) return;
      const x = xFor(tn), y = yFor(m), col = [P.butter, P.white, P.rose, P.mintLt][i % 4];
      const drop = (1 - clamp((t - tn) / 0.18)) * -40;
      ctx.save(); ctx.translate(x, y + drop); ctx.scale(p, p); ctx.rotate(-0.35);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 14 * p, y + drop); ctx.lineTo(x + 14 * p, y + drop - 66 * p); ctx.stroke();
      // a little burst when it lands
      const bu = clamp((t - tn) / 0.35);
      if (bu > 0 && bu < 1) { ctx.strokeStyle = rgba(col, 1 - bu); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 20 + bu * 34, 0, TAU); ctx.stroke(); }
    });
    // film timeline
    for (let i = 0; i < 7; i++) {
      const x = X0 + i * (TH.w + TH.gap) + TH.w / 2;
      const p = ease.outBack(clamp((t - C.score - 0.15 - i * 0.05) / 0.35), 1.6);
      if (p <= 0) continue;
      ctx.save(); ctx.translate(x, TH.y); ctx.scale(p, p);
      ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.roundRect(-TH.w / 2 + 5, -TH.h / 2 + 8, TH.w, TH.h, 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(-TH.w / 2, -TH.h / 2, TH.w, TH.h, 8); ctx.clip();
      ctx.drawImage(thumbImg([0, 3, 4, 5, 7, 9, 11][i]), -TH.w / 2, -TH.h / 2, TH.w, TH.h);
      ctx.restore(); ctx.restore();
    }
    // waveform grows behind the playhead
    const r = rng(9);
    for (let x = X0; x < X1; x += 11) {
      const tt = PLAY0 + (x - X0) / (X1 - X0) * (PLAY1 - PLAY0);
      const amp = r();
      if (x > px) continue;
      const onBeat = Math.exp(-(((tt - PLAY0) % BEAT) / BEAT) * 4);
      const h = (14 + 56 * amp * (0.45 + 0.55 * onBeat)) * ease.out(clamp((t - tt) / 0.2));
      ctx.fillStyle = x % 2 ? P.white : P.butter;
      ctx.beginPath(); ctx.roundRect(x, WAVE_Y - h / 2, 6, Math.max(1, h), 3); ctx.fill();
    }
    ctx.strokeStyle = rgba(P.white, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X0, WAVE_Y); ctx.lineTo(X1, WAVE_Y); ctx.stroke();
    // sound-effect icons pop on the action
    SFX_MARKS.forEach((mk, i) => {
      const p = ease.outBack(clamp((t - mk.t) / 0.3), 2.2);
      if (p > 0) sfxIcon(ctx, mk.kind, xFor(mk.t), 520, p);
    });
    // playhead
    if (t > PLAY0 - 0.2) {
      const a = clamp((t - PLAY0 + 0.2) / 0.2);
      ctx.strokeStyle = rgba(P.butter, a); ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, 300); ctx.lineTo(px, 840); ctx.stroke();
      ctx.fillStyle = rgba(P.butter, a); ctx.beginPath(); ctx.moveTo(px - 16, 286); ctx.lineTo(px + 16, 286); ctx.lineTo(px, 306); ctx.fill();
    }
    ctx.restore();
  }
  // the .mp4 card
  const mp = ease.outBack(clamp((t - C.mp4) / 0.4), 1.8);
  const away = seg(t, C.deliver - 0.4, C.deliver + 0.1, ease.in);
  if (mp > 0) {
    // spinning sparkle ring as it forms
    const sp = clamp((t - C.mp4) / 0.6);
    if (sp < 1) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + sp * 2; ctx.fillStyle = [P.butter, P.rose, P.mintLt, P.white][k % 4]; ctx.beginPath(); ctx.arc(MP4.x + Math.cos(a) * (180 + sp * 120), MP4.y + Math.sin(a) * (180 + sp * 120), 12 * (1 - sp), 0, TAU); ctx.fill(); }
    mp4Card(ctx, MP4.x + away * 1000, MP4.y - away * 800 + Math.sin(t * 3) * 6, mp * (1 - away * 0.5), Math.sin(t * 2) * 0.03 + away * 0.6);
  }

  // Claude with headphones, bobbing on the beat and conducting
  const enter = ease.outBack(clamp((t - C.score - 0.3) / 0.5), 1.4);
  const beatPh = ((t - C.notes0) / BEAT) % 1, onB = t > C.notes0 && t < C.rollUp ? Math.exp(-beatPh * 5) : 0;
  const cheer = hop(t, C.mp4 + 0.05, 0.45, 110);
  const x = 255, y = 1010 + (1 - enter) * 450 + cheer.y;
  sprayAt(ctx, P.violetDk, x, 1016, 160, 24, 0.9);
  const a = claude(ctx, { x, y, s: 235, sx: (1 + onB * 0.05) * cheer.sx, sy: (1 - onB * 0.07) * cheer.sy, rot: Math.sin(t * Math.PI * 2 / (BEAT * 2)) * 0.05 * (t > C.notes0 && t < C.rollUp ? 1 : 0),
    armR: t < C.rollUp ? 0.5 + Math.sin((t - C.notes0) * Math.PI * 2 / BEAT) * 0.35 : 1.2, armL: t > C.mp4 ? 1.2 : 0.2 + onB * 0.2, eyes: t > C.notes0 && t < C.rollUp ? 'happy' : (t > C.mp4 ? 'sparkle' : 'open'), blush: 0.6, lx: 1, ly: -0.4, blink: blinkAt(t, [C.score + 0.9]) });
  headphones(ctx, a);
  // baton
  if (t < C.rollUp + 0.2) { const [hx, hy] = a.handR; const ang = -0.9 + Math.sin((t - C.notes0) * Math.PI * 2 / BEAT) * 0.5; ctx.strokeStyle = P.white; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * 90, hy + Math.sin(ang) * 90); ctx.stroke(); ctx.fillStyle = P.rose; ctx.beginPath(); ctx.arc(hx + Math.cos(ang) * 92, hy + Math.sin(ang) * 92, 9, 0, TAU); ctx.fill(); }

  badge(ctx, t, 4, 160, 150, 46, C.badge4, { t1: C.deliver - 0.4, bg: P.butter });
  caption(ctx, t, { text: 'Composes the soundtrack', x: 232, y: 176, t0: C.cap4, t1: C.deliver - 0.4, size: 74, color: P.white, hl: ['soundtrack'], hlColor: P.butter });
  return { vig: 0, grain: 0 };
}

export const compose = [{ name: 'compose', start: C.score, end: C.deliver, draw }];
