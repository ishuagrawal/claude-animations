// The VS card (reference DNA: a flat split-screen poster with duotone fighters and a brush accent).
// Our surface: blue half for Claude, red half for Kimi (inverted, as the reference does), a gold crescent
// moon behind a giant VS, 对决 ("duel") brushed on the seam, and the GPTs trying to squeeze in.
import * as THREE from 'three';
import { W, H, clamp, seg, ease, lerp, onN, TAU } from '../core.js';
import { C } from '../timeline.js';
import { aim, RENDER } from '../gl/view.js';
import { solo } from '../world/world.js';
import { chunky, COL, F, riso, hanzi, speedLines } from '../overlay.js';
import { base, lightRig, poseClaude, poseKimi, V3 } from './common.js';
import { NAME } from './act1.js';

let bufA = null, bufB = null, tmp = null;
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

// map a render's luminance to two inks, keeping its alpha
function duotone(src, dark, light, contrast = 1.5) {
  tmp = tmp || mk();
  const x = tmp.getContext('2d');
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, W, H);
  x.filter = `grayscale(1) contrast(${contrast}) brightness(1.15)`;
  x.drawImage(src, 0, 0, W, H);
  x.filter = 'none';
  x.globalCompositeOperation = 'multiply'; x.fillStyle = light; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'screen'; x.fillStyle = dark; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  return tmp;
}

function renderSolo(w, objs, into) {
  if (RENDER.off) return;
  const restore = solo(w, objs);
  w.renderer.setClearColor(0x000000, 0);
  w.renderer.render(w.scene, w.camera);
  restore();
  const x = into.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.drawImage(w.canvas, 0, 0, W, H);
}

export function vsCard(ctx, t, w) {
  bufA = bufA || mk(); bufB = bufB || mk();
  base(w, t);
  const k = t - C.vs;
  const inn = ease.outExpo(clamp(k / 0.32));
  // fighters (posed for the poster, rendered alone)
  lightRig({ key: [-0.5, 0.8, 0.5], rimA: '#ffffff', rimB: '#ffffff', rimW: 1.3 });
  const breathe = Math.sin(onN(t, 2) * 9) * 0.02;
  poseClaude(w.claude, { x: 0, y: 0, z: 0, ry: 0.12, armLz: 0.35, armRz: 0.9, lean: -0.05, sq: 1 + breathe, eyes: { slant: 0.95 } });
  aim(w.camera, [0.1, 0.32, 3.7], [0.0, 0.52, 0], 40, 0.08, null, true);
  renderSolo(w, [w.claude.root], bufA);
  poseKimi(w.kimi, { x: 0, y: 0, z: 0, ry: -0.12, sq: 0.9 - breathe, look: [-0.2, 0.04], slant: 0.8 });
  aim(w.camera, [-0.1, 0.35, 3.2], [0, 0.46, 0], 40, -0.08, null, true);
  renderSolo(w, [w.kimi.root], bufB);

  ctx.save();
  // halves, sliding in along the diagonal seam
  const seamX = W / 2, tilt = 160;
  const half = (side, fill) => {
    ctx.save();
    const off = (1 - inn) * W * 0.7 * side;
    ctx.translate(off, 0);
    ctx.beginPath();
    if (side < 0) { ctx.moveTo(-50, 0); ctx.lineTo(seamX + tilt, 0); ctx.lineTo(seamX - tilt, H); ctx.lineTo(-50, H); }
    else { ctx.moveTo(seamX + tilt, 0); ctx.lineTo(W + 50, 0); ctx.lineTo(W + 50, H); ctx.lineTo(seamX - tilt, H); }
    ctx.closePath(); ctx.clip();
    fill(off);
    ctx.restore();
  };
  half(-1, off => {
    const g = ctx.createLinearGradient(0, 0, W / 2, H); g.addColorStop(0, '#2f5fe0'); g.addColorStop(1, '#0c1660');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    riso(ctx, t, { a: 0.5, c1: '#38b6ff', c2: '#0c0a2b', seed: 3, w: W / 2 + tilt });
    stripes(ctx, t, '#4a7cff', -1);
    // Claude, duotone terracotta
    const img = duotone(bufA, '#3a0c18', '#ffd2b4', 1.3);
    ctx.drawImage(img, -640 + (1 - inn) * -200, 0, W, H);
    chunky(ctx, NAME.claude, 120, H - 130, { size: 120, align: 'left', fill: COL.cream, stroke: COL.ink, shadow: '#0c1660', lw: 0.06, rot: -0.05, track: 4 });
  });
  half(1, off => {
    const g = ctx.createLinearGradient(W / 2, 0, W, H); g.addColorStop(0, '#ff3b5c'); g.addColorStop(1, '#6e0a2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    riso(ctx, t, { a: 0.5, c1: '#ffb0b8', c2: '#3a0616', seed: 5, x: W / 2 - tilt, w: W / 2 + tilt });
    stripes(ctx, t, '#ff6a7e', 1);
    const img = duotone(bufB, '#06248f', '#a8f2ff', 1.45);
    ctx.drawImage(img, 580 + (1 - inn) * 200, 10, W, H);
    chunky(ctx, NAME.kimi, W - 120, H - 130, { size: 120, align: 'right', fill: COL.cream, stroke: COL.ink, shadow: '#6e0a2a', lw: 0.06, rot: -0.05, track: 4 });
  });
  // glowing seam
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [wd, a] of [[46, 0.25], [18, 0.6], [6, 1]]) {
    ctx.strokeStyle = `rgba(255,250,235,${a * inn})`; ctx.lineWidth = wd;
    ctx.beginPath(); ctx.moveTo(seamX + tilt, -10); ctx.lineTo(seamX - tilt, H + 10); ctx.stroke();
  }
  ctx.restore();
  // GPTs try to squeeze in at the bottom of the seam, and get popped out
  gptSqueeze(ctx, t, seamX - tilt * 0.62, H - 120);
  // gold crescent + VS
  const vk = ease.outBack(clamp((k - 0.3) / 0.22), 2.5);
  if (vk > 0) {
    ctx.save();
    ctx.translate(W / 2, H / 2 - 30); ctx.scale(vk, vk);
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(8, 12, 250, 0, TAU); ctx.fill();
    ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.arc(0, 0, 250, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0a2b'; ctx.beginPath(); ctx.arc(-70, -36, 225, 0, TAU); ctx.fill();
    // halftone inside the dark disc
    ctx.save(); ctx.beginPath(); ctx.arc(-70, -36, 225, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1d1f5a';
    for (let y = -280; y < 220; y += 16) for (let x = -320; x < 180; x += 16) { const d = Math.hypot(x + 70, y + 36) / 225; const r = d * 6.5; ctx.beginPath(); ctx.arc(x + (y / 16 % 2) * 8, y, r, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.restore();
    chunky(ctx, 'VS', W / 2 + 6, H / 2 - 20, { size: 300, scale: vk, fill: COL.gold, stroke: COL.ink, shadow: '#000000', lw: 0.07, rot: -0.08, grad: [[0, '#fff3c4'], [0.55, '#f2c46a'], [1, '#e2622f']] });
  }
  // 对决 stamped on the seam
  const hk = ease.outBack(clamp((k - 0.55) / 0.18), 3);
  if (hk > 0) hanzi(ctx, '对决', W / 2 + 300, 190, { size: 150 * hk, col: COL.cream, rot: -0.12, stroke: COL.ink });
  // FIGHT!
  const fk = t - C.fight;
  if (fk >= 0) {
    ctx.fillStyle = `rgba(12,10,43,${0.55 * clamp(fk / 0.08)})`; ctx.fillRect(0, 0, W, H);
    speedLines(ctx, t, { col: '#fff3c4', n: 80, inner: 420, a: 0.8 });
    chunky(ctx, 'FIGHT!', W / 2, H / 2, { size: 330, scale: ease.outBack(clamp(fk / 0.18), 2.4) * (1 + fk * 0.12), fill: COL.cream, stroke: COL.red, shadow: COL.ink, lw: 0.08, rot: -0.07, grad: [[0, '#ffffff'], [0.6, '#ffe6a8'], [1, '#f2c46a']] });
  }
  ctx.restore();
  return { flash: clamp(1 - fk / 0.1) * (fk >= 0 ? 0.8 : 0) + clamp(1 - k / 0.08) * 0.6, flashCol: [1, 1, 1], ca: 1.4, vig: 0.2 };
}

function stripes(ctx, t, col, dir) {
  ctx.save();
  ctx.globalAlpha = 0.35; ctx.fillStyle = col;
  const sh = (onN(t, 2) * 260 * dir) % 120;
  for (let i = -20; i < 40; i++) {
    const x = i * 120 + sh;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 40 - 300, H); ctx.lineTo(x - 300, H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// tiny 2D Astra (star) and Sol (sun) popping up between the halves
function gptSqueeze(ctx, t, x, y) {
  const k = t - (C.vs + 0.85);
  if (k < 0 || k > 0.95) return;
  const up = ease.outBack(clamp(k / 0.18), 2) * (k > 0.55 ? 1 - ease.in(clamp((k - 0.55) / 0.12)) : 1);
  const ejected = k > 0.6;
  const ej = Math.max(0, k - 0.6);
  const draw = (cx, cy, kind, rot) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = COL.ink;
    if (kind === 'star') {
      ctx.fillStyle = '#dfe4fa';
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 22 : 50; ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
      ctx.closePath(); ctx.stroke(); ctx.fill();
    } else {
      ctx.fillStyle = '#ffd774';
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-9, -36); ctx.lineTo(0, -54); ctx.lineTo(9, -36); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.stroke(); ctx.fill();
    }
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.ellipse(-10, 0, 4.5, 6.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 0, 4.5, 6.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  if (!ejected) {
    draw(x - 40, y + 140 - up * 140, 'star', -0.15);
    draw(x + 50, y + 150 - up * 140, 'sun', 0.1);
  } else {
    draw(x - 40 - ej * 1400, y - 20 - ej * 900 + ej * ej * 1600, 'star', -ej * 18);
    draw(x + 50 + ej * 1200, y - 10 - ej * 1000 + ej * ej * 1600, 'sun', ej * 16);
  }
}
