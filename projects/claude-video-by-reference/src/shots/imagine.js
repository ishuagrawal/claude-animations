// ② IMAGINE — keep the style, not the story. A frame of the loved video goes into a sieve; three
// shakes sift its style (stripes, colors, waves) into a STYLE jar; the cat and its board don't fit
// through, so the cat surfs off home. A lightbulb → new storyboard sketches snap onto a beat rail.
import { P, rgba, mix } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, rng, BEAT } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { drawRetro, retroStill, drawCat } from '../retro.js';
import { caption, badge, setFont } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { THUMB_T } from './hook.js';

const SV = { x: 880, y: 395, rx: 260, ry: 165 };   // sieve bowl (rim centre)
export const JAR = { x: 880, y: 1010, w: 330, h: 255 };     // jar base centre
export const JAR_PARK = { x: 215, y: 1035, s: 0.55 };     // where the jar waits after the sift
const CL = { x: 1490, y: 1010, s: 280 };
export const KITE_T = 2.2;                          // the kite-story moment on storyboard card 2
export const PENCIL = '#6f8ff2';                    // storyboard pencil-line color
export const RAIL = { y: 520, xs: [470, 860, 1250], cw: 360, ch: 203 };

// the style bits that sift through
const BITS = (() => {
  const r = rng(77), out = [];
  for (let i = 0; i < 27; i++) {
    const kind = ['stripe', 'dot', 'wave', 'stripe', 'dot', 'sun'][i % 6];
    const col = kind === 'stripe' ? [P.rMustard, P.rOrange, P.rRust][i % 3] : kind === 'dot' ? [P.rCream, P.rMustard, P.rOrange, P.rRust, P.rTeal][i % 5] : kind === 'wave' ? [P.rTeal, P.rMint][i % 2] : P.rMustard;
    const batch = i % 3;
    out.push({ kind, col, batch, sx: (r() - 0.5) * 300, sy: -20 - r() * 70, rot: (r() - 0.5) * 1.2, dl: r() * 0.18,
      jx: (r() - 0.5) * 210, level: i, spin: (r() - 0.5) * 6 });
  }
  return out;
})();
function bitShape(ctx, b, x, y, rot, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = b.col; ctx.strokeStyle = b.col; ctx.lineCap = 'round';
  if (b.kind === 'stripe') { ctx.beginPath(); ctx.roundRect(-40, -9, 80, 18, 9); ctx.fill(); }
  else if (b.kind === 'dot') { ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fill(); if (b.col === P.rCream) { ctx.strokeStyle = P.rPeach; ctx.lineWidth = 3; ctx.stroke(); } }
  else if (b.kind === 'wave') { ctx.lineWidth = 15; ctx.beginPath(); for (let k = 0; k <= 12; k++) { const xx = -44 + k * 7.3, yy = Math.sin(k / 12 * TAU) * 9; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(0, 6, 26, Math.PI, TAU); ctx.fill(); ctx.fillStyle = P.rPeach; ctx.fillRect(-28, -6, 56, 5); }
  ctx.restore();
}

function sieveOffset(t) {
  let dy = 0, rot = 0;
  for (const s of C.shake) { const u = (t - s) / 0.42; if (u > 0 && u < 1) { const e = Math.sin(u * Math.PI * 2) * (1 - u); dy += -44 * e; rot += 0.07 * Math.sin(u * Math.PI * 3) * (1 - u); } }
  return { dy, rot };
}
function bitPos(b, t, sv) {
  const ts = C.shake[b.batch] + 0.08 + b.dl;
  const restIn = [sv.x + b.sx * 0.85, sv.y - 14 + b.sy * 0.55];
  if (t < ts) return { x: restIn[0], y: restIn[1], rot: b.rot, inSieve: true };
  const u = t - ts;
  const row = Math.floor(b.level / 5), col = b.level % 5;
  const land = { x: JAR.x - 120 + col * 60 + (row % 2) * 22, y: JAR.y - 30 - row * 32 };
  const y0 = sv.y + SV.ry * 0.85, g = 3600;
  const y = Math.min(land.y, y0 + 0.5 * g * u * u);
  const fallT = Math.sqrt(2 * (land.y - y0) / g);
  const k = clamp(u / fallT);
  const x = lerp(restIn[0] * 0.6 + sv.x * 0.4, land.x, ease.inOut(k));
  return { x, y, rot: b.rot + b.spin * Math.min(u, fallT) * (k < 1 ? 1 : 0) + (k >= 1 ? b.spin * fallT : 0), inSieve: false, landed: k >= 1 };
}

function sieveBack(ctx, sv) {
  ctx.save(); ctx.translate(sv.x, sv.y); ctx.rotate(sv.rot); ctx.scale(sv.s, sv.s);
  ctx.fillStyle = mix(P.white, P.lilac, 0.55);
  ctx.beginPath(); ctx.ellipse(0, 0, SV.rx, 34, 0, Math.PI, TAU); ctx.fill(); // inside back wall
  ctx.restore();
}
function sieveFront(ctx, t, sv) {
  ctx.save(); ctx.translate(sv.x, sv.y); ctx.rotate(sv.rot); ctx.scale(sv.s, sv.s);
  // handle toward Claude
  ctx.strokeStyle = P.navy; ctx.lineWidth = 30; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(SV.rx - 10, 0); ctx.lineTo(sv.hx, sv.hy); ctx.stroke();
  // bowl
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.ellipse(0, 0, SV.rx, SV.ry, 0, 0, Math.PI); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, SV.rx, SV.ry, 0, 0, Math.PI); ctx.clip();
  ctx.fillStyle = P.lilac; ctx.beginPath(); ctx.ellipse(40, 30, SV.rx, SV.ry, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.ellipse(-20, -10, SV.rx * 0.95, SV.ry * 0.98, 0, 0, Math.PI); ctx.fill();
  // holes
  ctx.fillStyle = P.mintDk;
  for (let row = 0; row < 4; row++) for (let c = -7; c <= 7; c++) {
    const x = c * 30 + (row % 2) * 15, y = 34 + row * 28;
    if ((x / (SV.rx - 22)) ** 2 + (y / (SV.ry - 18)) ** 2 < 1) { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // rim
  ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-SV.rx - 14, -12, SV.rx * 2 + 28, 24, 12); ctx.fill();
  ctx.fillStyle = P.navyLt; ctx.beginPath(); ctx.roundRect(-SV.rx - 6, -8, SV.rx * 2 + 12, 6, 3); ctx.fill();
  ctx.restore();
}

export function jarFull(ctx, t, x, y, s = 1, rot = 0) {
  // the jar with every bit settled (used later when it pours style into the canvas)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-JAR.x, -JAR.y);
  const sv = { x: SV.x, y: SV.y, rot: 0 };
  jar(ctx, t, JAR.x, JAR.y, 1, 0, () => { for (const b of BITS) { const p = bitPos(b, 99, sv); bitShape(ctx, b, p.x, p.y, p.rot); } });
  ctx.restore();
}
function jar(ctx, t, x, y, s, fillLevel, contents) {
  const { w, h } = JAR;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  sprayAt(ctx, P.mintDk, 0, 6, w * 0.7, 26, 0.9);
  // glass body
  const body = new Path2D(); body.roundRect(-w / 2, -h, w, h, [40, 40, 34, 34]);
  ctx.fillStyle = rgba('#ffffff', 0.32); ctx.fill(body);
  ctx.save(); ctx.clip(body); ctx.translate(-x / s, -y / s); contents(); ctx.restore();
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = rgba('#ffffff', 0.4); ctx.fillRect(-w / 2 + 22, -h + 30, 22, h - 70);
  ctx.fillRect(-w / 2 + 52, -h + 30, 8, h - 120);
  ctx.restore();
  ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 7; ctx.stroke(body);
  // lid
  ctx.fillStyle = P.butter; ctx.beginPath(); ctx.roundRect(-w / 2 + 14, -h - 40, w - 28, 46, 14); ctx.fill();
  ctx.fillStyle = P.butterDk; for (let k = 0; k < 9; k++) ctx.fillRect(-w / 2 + 34 + k * 26, -h - 34, 8, 34);
  // label
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-92, -h * 0.62, 184, 64, 14); ctx.fill();
  setFont(ctx, 38, 800, undefined, 3); ctx.fillStyle = P.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('STYLE', 0, -h * 0.62 + 34);
  ctx.restore();
}

function sketchCard(ctx, t, i, x, y, s, rot) {
  const { cw, ch } = RAIL;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = rgba(P.navy, 0.18); ctx.beginPath(); ctx.roundRect(-cw / 2 + 8, -ch / 2 + 12, cw, ch, 16); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-cw / 2 - 10, -ch / 2 - 10, cw + 20, ch + 20, 18); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(-cw / 2, -ch / 2, cw, ch); ctx.clip();
  const tt = [0.4, KITE_T, 3.6][i];
  const view = [[150, 330, 800, 450], null, [760, 40, 800, 450]][i];
  const so = { line: 1, fill: 0, lineColor: PENCIL, lineW: view ? 4.5 : 6, grain: 0, paper: P.white, view };
  if (i === 1 && t > C.zoom2) drawRetro(ctx, -cw / 2, -ch / 2, cw, ch, tt, 'kite', so); // vector while zooming in
  else ctx.drawImage(retroStill('kite', tt, cw * 2, ch * 2, so), -cw / 2, -ch / 2, cw, ch);
  ctx.restore();
  setFont(ctx, 22, 800); ctx.fillStyle = rgba(P.navy, 1 - seg(t, C.zoom2, C.zoom2 + 0.4)); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(String(i + 1), -cw / 2 + 8, -ch / 2 + 6);
  ctx.restore();
}
export { sketchCard };

function camAt(t) {
  const zp = seg(t, C.zoom2, C.animate, ease.inOut);
  let x = 960, y = 540, z = 1;
  if (zp > 0) {
    const zEnd = 1920 / RAIL.cw;
    z = Math.exp(lerp(0, Math.log(zEnd), zp));
    x = lerp(960, RAIL.xs[1], ease.inOut(clamp(zp * 1.15))); y = lerp(540, RAIL.y, ease.inOut(clamp(zp * 1.15)));
  }
  return { x, y, z };
}

function draw(ctx, t) {
  const cam = camAt(t);
  ctx.fillStyle = P.mint; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.translate(960, 540); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  fieldShapes(ctx, t, P.mint, { seed: 14, n: 5, k: 0.07 });
  confetti(ctx, t, { seed: 44, n: 26, size: 1.3, colors: [P.butter, P.white, P.navy, P.rose], area: [-60, 200, 2040, 900], avoid: [520, 230, 1300, 780], t0: C.imagine - 0.2, alpha: 0.85 });

  // ---- sieve + jar exit before the storyboard
  const gone = Math.min(1, seg(t, C.bulb - 0.3, C.bulb + 0.15, ease.in) * 1.0001);
  const park = seg(t, C.bulb - 0.3, C.bulb + 0.3, ease.inOut);
  const so = sieveOffset(t);
  const svIn = ease.outBack(clamp((t - C.imagine + 0.1) / 0.5), 1.3);
  const sv = { x: SV.x, y: SV.y + so.dy - (1 - svIn) * 700, rot: so.rot, hx: 0, hy: 0, s: 1 - gone };

  // Claude (holds the handle with its left arm)
  const shakeSq = C.shake.reduce((a, s) => a + Math.max(0, Math.sin(clamp((t - s) / 0.3) * Math.PI)) * 0.08, 0);
  const jmp = hop(t, C.bulb + 0.05, 0.42, 80);
  const enter = ease.outBack(clamp((t - C.imagine - 0.15) / 0.5), 1.4);
  const clx = CL.x + (1 - enter) * 700;
  let eyes = 'open', lx = -0.9, ly = 0.2, blush = 0;
  if (t < C.shake[0]) { eyes = 'squint'; }
  else if (t < C.catLift) { eyes = 'squint'; ly = 0.6; }
  else if (t < C.bulb) { eyes = 'happy'; lx = -1; blush = 0.6; }
  else { eyes = 'sparkle'; lx = -0.6; ly = -0.6; blush = 0.7; }
  const holding = gone < 0.35;
  const waveBye = t > C.catAway && t < C.bulb ? Math.sin((t - C.catAway) * 14) * 0.25 : 0;
  sprayAt(ctx, P.mintDk, clx, CL.y + 6, 170, 24, 0.9);
  const a = claude(ctx, { x: clx, y: CL.y + jmp.y, s: CL.s, sx: (1 + shakeSq * 0.6) * jmp.sx, sy: (1 - shakeSq) * jmp.sy, armL: holding ? 0.62 + so.dy * -0.004 : 0.2, armR: t > C.catAway && t < C.bulb ? 1.1 + waveBye : (t > C.bulb ? 1.25 : 0.25), eyes, lx, ly, blush, blink: blinkAt(t, [C.imagine + 1.0, C.cards[2] + 0.5]) });
  // handle end at Claude's hand, expressed in the sieve's local frame
  const hx = a.handL[0] - sv.x, hy = a.handL[1] - sv.y;
  sv.hx = hx * Math.cos(-sv.rot) - hy * Math.sin(-sv.rot); sv.hy = hx * Math.sin(-sv.rot) + hy * Math.cos(-sv.rot);

  // ---- jar with sifted contents
  const jarIn = ease.outBack(clamp((t - C.imagine - 0.25) / 0.5), 1.4);
  const jarX = lerp(JAR.x, JAR_PARK.x, park), jarY = lerp(JAR.y, JAR_PARK.y, park) + (1 - jarIn) * 500, jarS = lerp(1, JAR_PARK.s, park);
  if (t < C.zoom2 + 0.4) {
    ctx.save(); ctx.translate(jarX, jarY); ctx.scale(jarS, jarS); ctx.translate(-JAR.x, -JAR.y);
    jar(ctx, t, JAR.x, JAR.y, 1, 0, () => {
      for (const b of BITS) { const p = bitPos(b, t, sv); if (p.landed) bitShape(ctx, b, p.x, p.y, p.rot); }
    });
    ctx.restore();
  }
  if (gone < 0.999) {
    sieveBack(ctx, sv);
    // falling bits (between sieve and jar) + bits still in the sieve
    for (const b of BITS) {
      const p = bitPos(b, t, sv);
      if (p.inSieve) { if (t > C.frameDrop + 0.45) bitShape(ctx, b, p.x, p.y + so.dy * 0.4, p.rot + sv.rot, ease.outBack(clamp((t - C.frameDrop - 0.45) / 0.3))); }
      else if (!p.landed) bitShape(ctx, b, p.x, p.y, p.rot);
    }
  }
  // the cat, on its board, inside the sieve until it hops out and surfs away
  const catIn = t > C.frameDrop + 0.45;
  if (catIn) {
    const ju = clamp((t - C.catLift) / 0.55);
    let cx = sv.x - 20, cy = sv.y + 18 + so.dy * 0.2, tilt = sv.rot + Math.sin(t * 6) * 0.04, sc = 0.62;
    if (t > C.catLift) {
      const land = { x: 330, y: 930 };
      cx = lerp(sv.x - 20, land.x, ju); cy = lerp(sv.y + 18, land.y, ju) - Math.sin(ju * Math.PI) * 260; tilt = -0.3 * Math.sin(ju * Math.PI);
      if (ju >= 1) { const ride = t - C.catLift - 0.55; cx = land.x - ride * ride * 900 - ride * 200; cy = land.y + Math.sin(ride * 9) * 6; tilt = -0.08; }
      // the little wave it rides home
      const wv = clamp((t - C.catLift - 0.35) / 0.3) * (1 - clamp((t - C.catAway - 0.9) / 0.3));
      if (wv > 0) {
        ctx.save(); ctx.fillStyle = P.rTeal; ctx.globalAlpha *= wv;
        ctx.beginPath(); ctx.moveTo(cx - 260, 1100); for (let k = 0; k <= 20; k++) { const xx = cx - 260 + k * 26; ctx.lineTo(xx, 950 + Math.sin(k * 0.8 + t * 8) * 10 - Math.exp(-(((xx - cx - 60) / 120) ** 2)) * 30); } ctx.lineTo(cx + 260, 1100); ctx.fill();
        ctx.fillStyle = P.rCream; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(cx - 220 + k * 60, 950 + Math.sin(k * 1.6 + t * 8) * 8, 14, 6, 0, Math.PI, TAU); ctx.fill(); }
        ctx.restore();
      }
    }
    if (cx > -400) drawCat(ctx, { x: cx, y: cy, tilt, t }, 1, {});
    // the cat's "bye!" bubble
    const by = ease.outBack(clamp((t - C.catLift - 0.6) / 0.3), 2) * (1 - clamp((t - C.catAway - 0.6) / 0.25));
    if (by > 0 && cx > -100) {
      ctx.save(); ctx.translate(cx + 40, cy - 250); ctx.scale(by, by);
      ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-58, -34, 116, 64, 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-20, 26); ctx.lineTo(-34, 50); ctx.lineTo(4, 28); ctx.fill();
      setFont(ctx, 32, 800); ctx.fillStyle = P.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('bye!', 0, 0);
      ctx.restore();
    }
  }
  // the dropped frame (falls into the sieve, bursts into pieces)
  const fd = (t - C.frameDrop) / 0.45;
  if (fd > 0 && fd < 1.25) {
    const y = fd < 1 ? lerp(-200, sv.y - 40, ease.in(fd)) : sv.y - 40;
    const s = fd < 1 ? 1 : 1 + (fd - 1) * 1.2, a2 = fd < 1 ? 1 : 1 - (fd - 1) / 0.25;
    ctx.save(); ctx.globalAlpha *= a2; ctx.translate(sv.x, y); ctx.rotate(-0.12 + fd * 0.1); ctx.scale(s, s);
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-200, -116, 400, 232, 16); ctx.fill();
    ctx.drawImage(retroStill('surf', THUMB_T, 768, 432), -184, -103.5, 368, 207);
    ctx.restore();
  }
  if (gone < 0.999) sieveFront(ctx, t, sv);

  // ---- lightbulb + storyboard cards on a beat rail
  const bu = ease.outBack(clamp((t - C.bulb) / 0.4), 2.2);
  const top = [a.top[0], a.top[1] - 110];
  if (bu > 0) {
    const glow = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.save(); ctx.translate(top[0], top[1]); ctx.scale(bu, bu);
    ctx.strokeStyle = P.butter; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const ang = -Math.PI / 2 + (k - 3) * 0.42; ctx.beginPath(); ctx.moveTo(Math.cos(ang) * (72 + glow * 6), Math.sin(ang) * (72 + glow * 6)); ctx.lineTo(Math.cos(ang) * (98 + glow * 10), Math.sin(ang) * (98 + glow * 10)); ctx.stroke(); }
    ctx.fillStyle = P.butter; ctx.beginPath(); ctx.arc(0, -6, 48, 0, TAU); ctx.fill();
    ctx.fillStyle = mix(P.butter, '#ffffff', 0.55); ctx.beginPath(); ctx.arc(-14, -20, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-22, 36, 44, 30, 8); ctx.fill();
    ctx.restore();
  }
  // rail
  const rl = seg(t, C.bulb + 0.2, C.cards[0] + 0.3, ease.inOut);
  if (rl > 0) {
    const ry = RAIL.y + RAIL.ch / 2 + 50, x0 = RAIL.xs[0] - RAIL.cw / 2 - 40, x1 = RAIL.xs[2] + RAIL.cw / 2 + 40;
    ctx.strokeStyle = P.navy; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(lerp(x0, x1, rl), ry); ctx.stroke();
    const nT = 16;
    for (let k = 0; k <= nT; k++) {
      const x = lerp(x0, x1, k / nT); if (x > lerp(x0, x1, rl)) break;
      const big = k % 4 === 0, ph = ((t - C.cards[0]) / BEAT) % 1, pulse = big ? 1 + 0.4 * Math.exp(-ph * 6) * clamp(t - C.cards[0]) : 1;
      ctx.fillStyle = big ? P.navy : rgba(P.navy, 0.45);
      ctx.beginPath(); ctx.arc(x, ry + 26, (big ? 8 : 5) * pulse, 0, TAU); ctx.fill();
    }
  }
  RAIL.xs.forEach((x, i) => {
    const t0 = C.cards[i], u = clamp((t - t0 + 0.35) / 0.35);
    if (u <= 0) return;
    const e = ease.out(u), land = ease.outBack(clamp((t - t0) / 0.3), 2.5);
    const cx = lerp(top[0], x, e), cy = lerp(top[1], RAIL.y, e) - Math.sin(u * Math.PI) * 120;
    sketchCard(ctx, t, i, cx, cy, lerp(0.2, 1, e) * (t > t0 ? 0.92 + 0.08 * land : 1), (1 - e) * 0.5 + Math.sin(t * 1.4 + i) * 0.015 * (1 - seg(t, C.zoom2 - 0.3, C.zoom2)));
  });
  ctx.restore();

  badge(ctx, t, 2, 160, 150, 46, C.badge2, { t1: C.zoom2 - 0.2, bg: P.white, fg: P.mintDk });
  caption(ctx, t, { text: 'Keeps the style…', x: 232, y: 176, t0: C.cap2a, t1: C.cap2b - 0.45, size: 74, color: P.navy, hl: ['style…'], hlColor: P.white, ulColor: P.navy });
  caption(ctx, t, { text: '…invents a new story', x: 232, y: 176, t0: C.cap2b, t1: C.zoom2 - 0.2, size: 74, color: P.navy, hl: ['new', 'story'], hlColor: P.white, ulColor: P.navy });
  return { vig: 0, grain: 0 };
}

export const imagine = [{ name: 'imagine', start: C.imagine, end: C.animate, draw }];
