// The developer, front bust. Origin: chin. pose: {tilt, look, blink, brow, mouth -1..1, lens(ctx, r) draws the reflection inside a lens of radius r centred at 0,0, key (screen light colour), keyA, warm, t}
import { K, ink, inner, rr, circ, ell, blob, poly, union, rgba, mix, lg, rg, glow, clamp, lerp, TAU, rng } from './ink.js';
const SKIN = ['#f3b48a', '#d98a6c', '#a85a5e'], HAIR = ['#5a2fae', '#331478', '#1a0850'];
export const LENS = [-57, -128], LENS_R = 58;
export function dev(x, px, py, s, p = {}) {
  const key = p.key || '#8fb8ff', kA = p.keyA ?? 1, warm = p.warm ?? 1, t = p.t ?? 0, lk = p.look || [0, 0.4];
  x.save(); x.translate(px, py); x.scale(s, s);
  // hood behind neck
  ink(x, blob([[-150, 70], [-176, 10], [-120, -46], [0, -62], [120, -46], [176, 10], [150, 70], [0, 110]]), { f: ['#f0686a', '#b8306a', '#6a145e'], sh: [['rgba(60,4,60,0.75)', 40, 0, -26], [rgba('#ffd39a', 0.6 * warm), 16, -8, 8]] });
  // shoulders
  const body = blob([[-78, 46], [-212, 78], [-306, 170], [-344, 330], [-356, 560], [356, 560], [344, 330], [306, 170], [212, 78], [78, 46]]);
  ink(x, body, { f: ['#ff9160', '#f0576a', '#b02a72', '#5c1566'], g: [0.1, 0, 0.7, 1], sh: [['rgba(60,4,80,0.7)', 80, -50, -24], [rgba(key, 0.5 * kA), 60, 0, -40], [rgba('#ffd39a', 0.75 * warm), 34, 16, 12]], rim: [rgba('#ffd9a8', 0.8 * warm), 5, 1, 0.3], grain: 0.14 });
  x.save(); x.clip(body); x.lineCap = 'round'; [[[-190, 180], [-150, 300], [-176, 460]], [[196, 176], [150, 290], [184, 470]], [[-70, 150], [-40, 260], [-60, 400]], [[84, 150], [52, 250], [76, 380]]].forEach(q => { x.strokeStyle = 'rgba(70,6,80,0.32)'; x.lineWidth = 14; x.beginPath(); x.moveTo(...q[0]); x.quadraticCurveTo(...q[1], ...q[2]); x.stroke(); x.strokeStyle = 'rgba(255,190,150,0.22)'; x.lineWidth = 5; x.beginPath(); x.moveTo(q[0][0] - 9, q[0][1]); x.quadraticCurveTo(q[1][0] - 9, q[1][1], q[2][0] - 9, q[2][1]); x.stroke(); }); x.restore();
  // neck
  ink(x, rr(-56, -52, 112, 150, 44), { f: ['#c97a64', '#9a4c58'], sh: [['rgba(60,6,60,0.75)', 34, 0, 34]] });
  // collar
  const col = blob([[-100, 36], [-148, 66], [-120, 128], [0, 164], [120, 128], [148, 66], [100, 36], [62, 92], [0, 108], [-62, 92]]); ink(x, col, { f: ['#ffa874', '#e2506c', '#96246c'], sh: [['rgba(60,4,80,0.55)', 26, -12, -14], ['rgba(255,220,180,0.7)', 14, 5, 7]], drop: ['rgba(50,4,70,0.5)', 24, 0, 10], grain: 0.12 });
  [-40, 40].forEach((q, i) => { x.strokeStyle = lg(x, 0, 120, 0, 240, ['#fff0dc', '#ffc99a']); x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(q, 132); x.quadraticCurveTo(q * 1.5, 180, q * 1.25 + Math.sin(t * 1.4 + i) * 4, 222); x.stroke(); ink(x, rr(q * 1.25 - 7 + Math.sin(t * 1.4 + i) * 4, 218, 14, 24, 6), { f: ['#fff', '#ffb27a'] }); });
  x.save(); x.rotate(p.tilt ?? 0);
  // back hair
  const BK = [[-138, -140, 70], [138, -140, 70], [-150, -206, 66], [150, -206, 66], [-128, -270, 70], [128, -270, 70], [-74, -318, 74], [76, -318, 74], [0, -338, 78]]; x.fillStyle = '#2a1070'; BK.forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); }); x.beginPath(); x.ellipse(0, -220, 150, 130, 0, 0, TAU); x.fill(); BK.forEach(([a, b, r]) => ink(x, circ(a, b, r), { f: HAIR, r: [0.4, 0.3, 0.9], sh: [['rgba(10,0,40,0.65)', 34, a * -0.12, 20], [rgba(a < 0 ? '#a9b8ff' : '#ffb07a', a < 0 ? 0.6 : 0.55 * warm), 16, a < 0 ? 8 : -8, 7]] }));
  // ears
  [-1, 1].forEach(q => { ink(x, ell(q * 124, -118, 25, 35), { f: SKIN, sh: [['rgba(110,20,60,0.6)', 14, q * -8, -6]] }); x.strokeStyle = 'rgba(130,40,70,0.5)'; x.lineWidth = 5; x.beginPath(); x.arc(q * 124, -118, 13, q > 0 ? -1 : 2.1, q > 0 ? 1.6 : 4.4); x.stroke(); });
  // face
  const face = blob([[-122, -236], [-132, -150], [-120, -70], [-72, 2], [0, 28], [72, 2], [120, -70], [132, -150], [122, -236], [0, -286]]);
  ink(x, face, { f: SKIN, r: [0.42, 0.42, 0.75], sh: [['rgba(120,22,70,0.5)', 46, -26, -8], [rgba(key, 0.62 * kA), 60, 0, -40], [rgba('#ffd9a0', 0.8 * warm), 26, -14, 2], ['rgba(255,235,210,0.5)', 30, 12, 16]], grain: 0.1 });
  x.save(); x.clip(face); [-1, 1].forEach(q => { x.fillStyle = rg(x, q * 80, -62, 46, ['rgba(255,86,96,0.5)', 'rgba(255,86,96,0)']); x.fillRect(q * 80 - 50, -112, 100, 100); }); x.fillStyle = lg(x, 0, -290, 0, -210, ['rgba(50,10,90,0.6)', 'rgba(50,10,90,0)']); x.fillRect(-140, -300, 280, 96); x.restore();
  // mouth, nose
  const m = p.mouth ?? 0; x.strokeStyle = '#7a2450'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(-26, -30 - m * 5); x.quadraticCurveTo(0, -30 + m * 22, 26, -30 - m * 5); x.stroke(); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fill(ell(0, -14, 20, 5));
  ink(x, blob([[-20, -84], [-22, -66], [0, -56], [22, -66], [20, -84], [0, -104]]), { f: ['#ffc59a', '#cf7c68'], sh: [['rgba(120,20,60,0.5)', 10, -5, -6], ['rgba(255,240,220,0.8)', 7, 3, 4]] });
  // eyes
  const br = p.brow ?? 0; [-1, 1].forEach(q => { const ex = q * 57, ey = -128; x.save(); x.translate(ex, ey - 64 - br * 10); x.rotate(q * br * -0.2 + q * 0.04); ink(x, blob([[-38, 4], [-30, -10], [10, -14], [40, -4], [34, 8], [0, 2]]), { f: ['#4a248e', '#210c5c'] }); x.restore();
    const eye = ell(ex, ey + 4, 26, 28 * (p.blink ?? 1)); x.save(); x.fillStyle = '#fffaf2'; x.fill(eye); x.clip(eye); const ix = ex + lk[0] * 10, iy = ey + 6 + lk[1] * 9; x.fillStyle = rg(x, ix, iy + 6, 21, ['#a46bff', '#5a2bb8', '#2a0f6e']); x.fill(circ(ix, iy, 20)); x.fillStyle = '#14063e'; x.fill(circ(ix, iy, 11)); x.fillStyle = '#fff'; x.fill(circ(ix - 7, iy - 8, 6.5)); x.fill(circ(ix + 7, iy + 7, 3)); x.fillStyle = 'rgba(90,20,80,0.32)'; x.fillRect(ex - 30, ey - 30, 60, 22); x.restore();
    x.strokeStyle = '#3a1256'; x.lineWidth = 7; x.beginPath(); x.ellipse(ex, ey + 4, 28, 30 * (p.blink ?? 1), 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); });
  // glasses
  [-1, 1].forEach(q => { const ex = q * 57, ey = -128; x.save(); x.translate(ex, ey); const lens = circ(0, 0, LENS_R); x.save(); x.clip(lens); x.globalAlpha = p.lensA ?? 0.5; p.lens?.(x, LENS_R); x.globalAlpha = 1; x.fillStyle = lg(x, -50, -50, 30, 40, ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.02)']); x.beginPath(); x.moveTo(-70, -60); x.lineTo(4, -60); x.lineTo(-40, 60); x.lineTo(-90, 60); x.fill(); x.restore(); x.lineWidth = 12; x.strokeStyle = lg(x, -50, -60, 50, 60, ['#4a2a9e', '#150640']); x.stroke(circ(0, 0, LENS_R + 2)); x.lineWidth = 2.5; x.strokeStyle = 'rgba(200,180,255,0.75)'; x.beginPath(); x.arc(0, 0, LENS_R + 6, 3.5, 4.9); x.stroke(); x.restore(); });
  x.strokeStyle = '#2a0f66'; x.lineWidth = 11; x.beginPath(); x.arc(0, -124, 13, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  // fringe curls
  const C = [[-112, -232, 46], [-72, -270, 56], [-16, -288, 62], [46, -280, 60], [98, -248, 50], [126, -206, 34], [-132, -196, 34]]; C.forEach(([a, b, r]) => ink(x, circ(a, b, r), { f: ['#7a4be0', '#45209c', '#220c62'], r: [0.35, 0.3, 0.85], sh: [['rgba(14,0,50,0.5)', 22, -10, -12], ['rgba(190,160,255,0.55)', 12, 5, 6]] })); C.slice(0, 5).forEach(([a, b, r], i) => { x.strokeStyle = 'rgba(214,190,255,0.55)'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.arc(a, b, r * 0.58, Math.PI * 1.1, Math.PI * 1.65); x.stroke(); });
  x.restore(); x.restore();
}
