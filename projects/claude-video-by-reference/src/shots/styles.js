// ANY STYLE — push into the retro Claude from the new film, then the world (and Claude) flips
// through five styles on the beat: pixel art, anime, storybook watercolor, 3D clay, paper cut-out.
import { P, rgba, mix } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, lerp, TAU, rng, noise, onN, hash } from '../core.js';
import { claudePath, matrixOf } from '../claude.js';
import { drawRetro, RW, RH } from '../retro.js';
import { caption, pill, setFont } from '../type.js';
import { grain } from '../tex.js';
import { kiteT } from './deliver.js';

const STAGE = { x: 960, y: 900, s: 380 };     // Claude's feet + body width in every style
const NAMES = ['retro poster', 'pixel art', 'anime', 'storybook', '3D clay', 'paper cut-out'];

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const bobY = (t, a = 10) => Math.sin(t * Math.PI * 2) * a;

// ---------------------------------------------------------------- 1. pixel art (320x180, x6)
const PX = mk(320, 180), pxc = PX.getContext('2d');
function pixel(ctx, t) {
  const c = pxc, tt = onN(t, 3);
  c.imageSmoothingEnabled = false;
  const bands = ['#3b6fe0', '#4b80ee', '#5c94fc', '#74a6ff', '#8fb8ff', '#a6c8ff', '#bcd6ff'];
  c.fillStyle = bands[6]; c.fillRect(0, 0, 320, 180);
  bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * 22, 320, 22); });
  // dithered band edges
  for (let i = 1; i < 7; i++) for (let x = 0; x < 320; x += 2) { c.fillStyle = bands[i]; c.fillRect(x + (i % 2), i * 22 - 2, 1, 1); c.fillRect(x + ((i + 1) % 2), i * 22 - 1, 1, 1); }
  // sun + clouds
  c.fillStyle = '#ffe14d'; c.fillRect(240, 18, 24, 24); c.fillRect(236, 22, 32, 16); c.fillStyle = '#fff6a8'; c.fillRect(244, 22, 6, 6);
  const cloud = (x, y) => { c.fillStyle = '#ffffff'; c.fillRect(x, y + 4, 40, 8); c.fillRect(x + 8, y, 18, 6); c.fillRect(x + 22, y + 2, 10, 4); c.fillStyle = '#d6e6ff'; c.fillRect(x + 2, y + 10, 36, 2); };
  cloud(Math.round(30 + tt * 4) % 360 - 40, 26); cloud(Math.round(170 + tt * 4) % 360 - 40, 46);
  // hills
  const hill = (cx, r, col, dk) => { for (let y = -r; y <= 0; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); c.fillStyle = col; c.fillRect(cx - w, 140 + y, w * 2, 1); } c.fillStyle = dk; for (let k = 0; k < 6; k++) c.fillRect(cx - r * 0.6 + k * r * 0.24, 140 - r * 0.4 + (k % 2) * 6, 2, 2); };
  hill(60, 44, '#2fa84a', '#1f7a35'); hill(270, 56, '#38b85a', '#1f7a35'); hill(170, 30, '#2a9a44', '#1f7a35');
  // ground tiles
  for (let x = 0; x < 320; x += 16) { c.fillStyle = '#4fc35a'; c.fillRect(x, 140, 16, 5); c.fillStyle = '#c47a3a'; c.fillRect(x, 145, 16, 35); c.fillStyle = '#a3602a'; c.fillRect(x, 145, 1, 35); c.fillRect(x, 160, 16, 1); c.fillRect(x + 8, 145, 1, 15); c.fillStyle = '#39a346'; c.fillRect(x + 3, 144, 2, 2); c.fillRect(x + 11, 144, 2, 2); }
  // Claude sprite (mascot geometry at 64 px wide)
  const by = 140 - (Math.floor(tt * 4) % 2), bx = 128;
  c.fillStyle = P.coral;
  c.fillRect(bx, by - 63, 64, 47); c.fillRect(bx - 15, by - 48, 15, 16); c.fillRect(bx + 64, by - 48, 15, 16);
  [0, 16, 40, 56].forEach((lx, i) => c.fillRect(bx + lx, by - 16, 8, 16 - ((Math.floor(tt * 4) + i) % 2)));
  c.fillStyle = P.coralDk; c.fillRect(bx + 58, by - 63, 6, 47); c.fillRect(bx + 72, by - 48, 7, 16); c.fillRect(bx, by - 18, 64, 2);
  c.fillStyle = P.coralLt; c.fillRect(bx, by - 63, 58, 2); c.fillRect(bx - 15, by - 48, 15, 2);
  c.fillStyle = '#000'; c.fillRect(bx + 8, by - 56, 7, 7); c.fillRect(bx + 49, by - 56, 7, 7);
  // spinning coins
  [[96, 70], [216, 64]].forEach(([x, y], i) => { const f = Math.floor(tt * 8 + i * 2) % 4, w = [8, 6, 2, 6][f]; c.fillStyle = '#ffd23f'; c.fillRect(x - w / 2, y - 6 + bobY(onN(t, 4), 2) | 0, w, 12); c.fillStyle = '#c99700'; c.fillRect(x - w / 2 + w - 1, y - 6 + bobY(onN(t, 4), 2) | 0, 1, 12); });
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(PX, 0, 0, 1920, 1080); ctx.restore();
}

// ---------------------------------------------------------------- 2. anime (cel + ink line)
function anime(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, '#7ec8ff'); g.addColorStop(0.65, '#ffc0dc'); g.addColorStop(1, '#ff9ec7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  // sunburst + speed lines
  ctx.save(); ctx.translate(STAGE.x, 640); ctx.rotate(t * 0.15);
  for (let k = 0; k < 24; k++) { ctx.fillStyle = k % 2 ? rgba('#ffffff', 0.22) : rgba('#ffffff', 0.08); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, k / 24 * TAU, (k + 1) / 24 * TAU); ctx.fill(); }
  ctx.restore();
  const r = rng(3 + Math.floor(t * 12));
  ctx.fillStyle = rgba('#ffffff', 0.85);
  for (let k = 0; k < 40; k++) { const a = r() * TAU, w = 0.004 + r() * 0.01, r0 = 520 + r() * 200; ctx.beginPath(); ctx.moveTo(STAGE.x + Math.cos(a) * r0, 640 + Math.sin(a) * r0); ctx.lineTo(STAGE.x + Math.cos(a - w) * 1500, 640 + Math.sin(a - w) * 1500); ctx.lineTo(STAGE.x + Math.cos(a + w) * 1500, 640 + Math.sin(a + w) * 1500); ctx.fill(); }
  // ground shadow
  ctx.fillStyle = rgba('#b0306a', 0.25); ctx.beginPath(); ctx.ellipse(STAGE.x, STAGE.y + 8, 260, 34, 0, 0, TAU); ctx.fill();
  const o = { x: STAGE.x, y: STAGE.y + bobY(onN(t, 2) * 0.9, 8), s: STAGE.s, sx: 1, sy: 1, rot: 0, shear: 0, legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1, armL: 0.5 + Math.sin(onN(t, 2) * 6) * 0.15, armR: 0.5 - Math.sin(onN(t, 2) * 6) * 0.15, armLenL: 1, armLenR: 1 };
  const m = matrixOf(o), { shape } = claudePath(o);
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(m));
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a1830'; ctx.lineWidth = 5.2;
  ctx.stroke(shape);
  ctx.fillStyle = '#f08a63'; ctx.fill(shape);
  ctx.save(); ctx.clip(shape);
  ctx.fillStyle = '#c4553c'; ctx.beginPath(); ctx.moveTo(30, -150); ctx.lineTo(120, -150); ctx.lineTo(120, 10); ctx.lineTo(-90, 10); ctx.lineTo(-90, -44); ctx.lineTo(10, -44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd2bd'; ctx.fillRect(-80, -144, 100, 7); ctx.fillRect(-108, -110, 30, 5);
  ctx.restore();
  ctx.stroke(shape);
  // big glossy anime eyes
  for (const sd of [-1, 1]) {
    const cx = sd * 44, cy = -112;
    const eg = ctx.createLinearGradient(0, cy - 20, 0, cy + 20); eg.addColorStop(0, '#1a1036'); eg.addColorStop(1, '#4d6bff');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.roundRect(cx - 13, cy - 19, 26, 38, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx - 4, cy - 9, 6.5, 8, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy + 9, 3.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff6f9c'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(cx - 14 + j * 9 + sd * 6, cy + 30); ctx.lineTo(cx - 20 + j * 9 + sd * 6, cy + 38); ctx.stroke(); }
  }
  ctx.restore();
  // sparkles
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.4, d = 330 + 20 * Math.sin(t * 6 + k), s = 18 + 10 * Math.abs(Math.sin(t * 5 + k * 1.3)); star(ctx, STAGE.x + Math.cos(a) * d * 1.3, 700 + Math.sin(a) * d * 0.8, s, '#ffffff'); }
}
function star(ctx, x, y, r, col) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath(); const k = 0.2; ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * k, -r * k, r, 0); ctx.quadraticCurveTo(r * k, r * k, 0, r); ctx.quadraticCurveTo(-r * k, r * k, -r, 0); ctx.quadraticCurveTo(-r * k, -r * k, 0, -r); ctx.fill(); ctx.restore(); }

// ---------------------------------------------------------------- 3. storybook watercolor
const PAPER = (() => { const c = mk(960, 540), x = c.getContext('2d'), r = rng(91); x.fillStyle = '#f6eedd'; x.fillRect(0, 0, 960, 540); for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.08)'; x.fillRect(r() * 960, r() * 540, 1 + r() * 2, 1 + r() * 2); } return c; })();
function wash(ctx, path, col, edge, blur = 6) {
  ctx.save(); ctx.globalAlpha *= 0.82; ctx.fillStyle = col; ctx.fill(path); ctx.restore();
  ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.strokeStyle = edge; ctx.globalAlpha *= 0.55; ctx.lineWidth = 10; ctx.stroke(path); ctx.restore();
}
function blobPath(cx, cy, rx, ry, seed, wob = 0.08) { const p = new Path2D(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, k = 1 + wob * (noise(a * 2.2, seed) + 0.5 * noise(a * 6, seed + 3)); const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); return p; }
function hillPath(y0, amp, f, ph, seed) { const p = new Path2D(); p.moveTo(-50, 1130); for (let x = -50; x <= 1970; x += 30) p.lineTo(x, y0 + Math.sin(x / 1920 * TAU * f + ph) * amp + noise(x / 90, seed) * 10); p.lineTo(1970, 1130); p.closePath(); return p; }
function storybook(ctx, t) {
  ctx.drawImage(PAPER, 0, 0, 1920, 1080);
  const sky = ctx.createLinearGradient(0, 0, 0, 700); sky.addColorStop(0, 'rgba(120,170,220,0.55)'); sky.addColorStop(1, 'rgba(160,200,230,0.05)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1920, 760);
  wash(ctx, blobPath(1460, 300, 120, 120, 5), '#f7c95a', '#e0a23a', 8);
  wash(ctx, blobPath(420, 240, 170, 46, 9, 0.18), 'rgba(255,255,255,0.9)', 'rgba(140,170,200,0.6)', 6);
  wash(ctx, hillPath(720, 40, 1.1, 0.5, 2), '#a9cf8f', '#79a866', 7);
  wash(ctx, hillPath(820, 34, 0.8, 2.5, 4), '#7fb27a', '#557f55', 7);
  wash(ctx, hillPath(930, 20, 1.6, 1, 6), '#5f9a66', '#3f6f4a', 7);
  // flowers
  const r = rng(12); for (let k = 0; k < 18; k++) { const x = r() * 1920, y = 900 + r() * 160; wash(ctx, blobPath(x, y, 10, 10, k, 0.2), ['#f49ab0', '#fff4c0', '#c9a0e8'][k % 3], 'rgba(150,90,110,0.5)', 2); }
  // Claude as a painted wash + loose ink
  const o = { x: STAGE.x, y: STAGE.y + bobY(t * 0.8, 6), s: STAGE.s, sx: 1, sy: 1, rot: Math.sin(t * 2) * 0.015, shear: 0, legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1, armL: 0.3, armR: 0.35 + Math.sin(t * 3) * 0.1, armLenL: 1, armLenR: 1 };
  const m = matrixOf(o), { shape } = claudePath(o);
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(m));
  ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#e48a68'; ctx.fill(shape); ctx.restore();
  ctx.save(); ctx.clip(shape); ctx.globalAlpha = 0.5; ctx.fillStyle = '#c86a4a'; ctx.beginPath(); ctx.ellipse(50, -40, 90, 70, 0.4, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff1e0'; ctx.beginPath(); ctx.ellipse(-40, -120, 60, 22, -0.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5; const pat = ctx.createPattern(grain('#9a5a3a'), 'repeat'); ctx.fillStyle = pat; ctx.fillRect(-150, -170, 300, 190); ctx.restore();
  ctx.save(); ctx.filter = 'blur(2.2px)'; ctx.strokeStyle = 'rgba(170,70,45,0.6)'; ctx.lineWidth = 5; ctx.stroke(shape); ctx.restore();
  ctx.strokeStyle = '#4b2e24'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(1.5, -1); ctx.stroke(shape); ctx.restore();
  ctx.fillStyle = '#2e1d18'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 46, -110, 7.5, 9, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(240,120,140,0.45)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 46, -88, 12, 6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.6; ctx.drawImage(PAPER, 0, 0, 1920, 1080); ctx.restore();
}

// ---------------------------------------------------------------- 4. 3D clay
function clay(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, '#f6dbe9'); g.addColorStop(0.62, '#ead2f3'); g.addColorStop(0.62, '#f3e3f7'); g.addColorStop(1, '#e4cdee');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  // clay props: a ball and a cube
  const ball = (x, y, r, col) => { ctx.save(); ctx.filter = 'blur(14px)'; ctx.fillStyle = 'rgba(90,40,90,0.25)'; ctx.beginPath(); ctx.ellipse(x + 20, y + r * 0.95, r * 1.1, r * 0.25, 0, 0, TAU); ctx.fill(); ctx.restore(); const rg = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.1); rg.addColorStop(0, mix(col, '#ffffff', 0.55)); rg.addColorStop(0.6, col); rg.addColorStop(1, mix(col, '#000000', 0.35)); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  ball(470, 840 + bobY(t * 0.7, 6), 70, '#7dc4ff'); ball(1450, 860, 52, '#ffd166');
  // Claude, extruded
  const o = { x: STAGE.x, y: STAGE.y + bobY(t * 0.8, 5), s: STAGE.s, sx: 1, sy: 1, rot: 0, shear: 0, legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1, armL: 0.25 + Math.sin(t * 3) * 0.08, armR: 0.25 - Math.sin(t * 3) * 0.08, armLenL: 1, armLenR: 1 };
  const m = matrixOf(o), { shape } = claudePath(o);
  ctx.save(); ctx.filter = 'blur(18px)'; ctx.fillStyle = 'rgba(90,40,90,0.3)'; ctx.beginPath(); ctx.ellipse(STAGE.x + 40, STAGE.y + 12, 300, 50, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(m));
  ctx.lineJoin = 'round';
  for (let d = 16; d > 0; d -= 1) { ctx.save(); ctx.translate(d * 0.9, -d * 0.55); ctx.fillStyle = mix('#b6553a', '#8f3f2c', d / 16); ctx.fill(shape); ctx.restore(); }
  const fg = ctx.createLinearGradient(-110, -150, 110, 20); fg.addColorStop(0, '#f6a383'); fg.addColorStop(0.5, '#e07a58'); fg.addColorStop(1, '#c25d3f');
  ctx.fillStyle = fg; ctx.fill(shape);
  ctx.save(); ctx.clip(shape);
  const hl = ctx.createRadialGradient(-40, -130, 4, -40, -130, 90); hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(-160, -200, 320, 240);
  ctx.strokeStyle = 'rgba(120,40,20,0.12)'; ctx.lineWidth = 1.4; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(40, -60, 10 + k * 5, 0.2, 2.6); ctx.stroke(); }
  ctx.restore();
  for (const sd of [-1, 1]) {
    const eg = ctx.createRadialGradient(sd * 46 - 3, -114, 1, sd * 46, -110, 12); eg.addColorStop(0, '#5b5b6b'); eg.addColorStop(1, '#0d0d14');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(sd * 46, -110, 10.5, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sd * 46 - 3.5, -115, 3.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 5. paper cut-out (12 fps)
function torn(y0, amp, f, ph, seed) { const p = new Path2D(); p.moveTo(-50, 1130); for (let x = -50; x <= 1970; x += 14) p.lineTo(x, y0 + Math.sin(x / 1920 * TAU * f + ph) * amp + (hash(Math.floor(x / 14) * 7 + seed) - 0.5) * 9); p.lineTo(1970, 1130); p.closePath(); return p; }
const KRAFT = (() => { const c = mk(960, 540), x = c.getContext('2d'), r = rng(44); x.fillStyle = '#3aa6a0'; x.fillRect(0, 0, 960, 540); for (let i = 0; i < 9000; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,40,40,0.06)'; x.lineWidth = 1; const xx = r() * 960, yy = r() * 540; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (r() - 0.5) * 14, yy + (r() - 0.5) * 6); x.stroke(); } return c; })();
function paperLayer(ctx, path, col, dx = 8, dy = 10) {
  ctx.save(); ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(0,30,40,0.35)'; ctx.translate(dx, dy); ctx.fill(path); ctx.restore();
  ctx.save(); ctx.fillStyle = '#ffffff'; ctx.translate(0, -3); ctx.fill(path); ctx.restore();
  ctx.fillStyle = col; ctx.fill(path);
}
function paper(ctx, t) {
  const tt = onN(t, 3); // stop-motion: everything on 3s (10 fps) with jitter
  ctx.drawImage(KRAFT, 0, 0, 1920, 1080);
  const j = k => (hash(Math.floor(tt * 10) * 13 + k) - 0.5);
  const sun = new Path2D(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, rr = 110 + (hash(i * 3) - 0.5) * 8; i ? sun.lineTo(1480 + Math.cos(a) * rr, 280 + Math.sin(a) * rr) : sun.moveTo(1480 + Math.cos(a) * rr, 280 + Math.sin(a) * rr); }
  paperLayer(ctx, sun, '#ffd166');
  ctx.save(); ctx.translate(j(1) * 4, j(2) * 3); paperLayer(ctx, torn(700, 50, 1.2, 0.4, 3), '#f6efe0'); ctx.restore();
  ctx.save(); ctx.translate(j(3) * 4, j(4) * 3); paperLayer(ctx, torn(800, 40, 0.9, 2.2, 5), '#2e5e8c'); ctx.restore();
  ctx.save(); ctx.translate(j(5) * 3, j(6) * 3); paperLayer(ctx, torn(915, 26, 1.7, 1.2, 9), '#f2a33a'); ctx.restore();
  // Claude: cut paper with a drop shadow, jittering like stop-motion
  const o = { x: STAGE.x + j(7) * 6, y: STAGE.y - 10 + j(8) * 5 + (Math.floor(tt * 10) % 4 < 2 ? 0 : -14), s: STAGE.s, sx: 1, sy: 1, rot: j(9) * 0.03, shear: 0, legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1, armL: 0.3 + j(10) * 0.3, armR: 0.3 + j(11) * 0.3, armLenL: 1, armLenR: 1 };
  const m = matrixOf(o), { shape } = claudePath(o);
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(m));
  ctx.save(); ctx.filter = 'blur(4px)'; ctx.fillStyle = 'rgba(0,30,40,0.4)'; ctx.translate(9, 8); ctx.fill(shape); ctx.restore();
  ctx.fillStyle = '#fff6ec'; ctx.save(); ctx.translate(-1.5, -1.5); ctx.fill(shape); ctx.restore();
  ctx.fillStyle = P.coral; ctx.fill(shape);
  ctx.save(); ctx.clip(shape); ctx.globalAlpha = 0.25; const pat = ctx.createPattern(grain('#7a3a20'), 'repeat'); ctx.fillStyle = pat; ctx.fillRect(-160, -170, 320, 190); ctx.restore();
  for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 46, -110); ctx.rotate(j(12 + sd) * 0.15); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-7, -7, 17, 17); ctx.fillStyle = '#141414'; ctx.fillRect(-9, -9, 17, 17); ctx.restore(); }
  ctx.restore();
}

const RENDER = [null, pixel, anime, storybook, clay, paper];

// ---------------------------------------------------------------- shot
function retroPush(ctx, t) {
  // push from the full new-film frame into its Claude
  const p = seg(t, C.styles, C.style[0] - 0.05, ease.inOut);
  const z = lerp(1, 2.15, p);
  const fx = 470 * 1920 / RW, fy = 700 * 1080 / RH; // Claude centre in the full frame
  const cx = lerp(960, fx, p), cy = lerp(540, fy - 120, p);
  ctx.save(); ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-cx, -cy);
  drawRetro(ctx, 0, 0, 1920, 1080, kiteT(t), 'kite', { grain: 0.16 });
  ctx.restore();
}

function draw(ctx, t) {
  let idx = 0;
  C.style.forEach((s, i) => { if (t >= s) idx = i + 1; });
  const paint = i => (i === 0 ? retroPush(ctx, t) : RENDER[i](ctx, t));
  paint(idx);
  // diagonal wipe in from the right for the first 0.28 s of each style, white leading edge
  const ts = idx > 0 ? C.style[idx - 1] : -1, u = clamp((t - ts) / 0.28);
  if (idx > 0 && u < 1) {
    const e = ease.outExpo(u), edge = lerp(2400, -500, e);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(2000, 0); ctx.lineTo(2000, 1080); ctx.lineTo(edge - 360, 1080); ctx.closePath(); ctx.clip();
    // show the previous style under the not-yet-wiped area: we drew the new one, so paint old on the far side
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-100, 0); ctx.lineTo(edge, 0); ctx.lineTo(edge - 360, 1080); ctx.lineTo(-100, 1080); ctx.closePath(); ctx.clip();
    paint(idx - 1);
    ctx.restore();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(edge, 0); ctx.lineTo(edge + 40, 0); ctx.lineTo(edge - 320, 1080); ctx.lineTo(edge - 360, 1080); ctx.closePath(); ctx.fill();
  }
  // style name
  const lt = idx > 0 ? C.style[idx - 1] + 0.12 : 99;
  if (idx > 0) pill(ctx, t, NAMES[idx], 960, 1010, { t0: lt, t1: (idx < 5 ? C.style[idx] : C.splash4) - 0.08, size: 38, bg: P.white, fg: P.navy });
  // caption banner on top of every style
  const bn = ease.outBack(clamp((t - C.capAny + 0.1) / 0.4), 1.4) * (1 - ease.inBack(clamp((t - C.splash4 - 0.15) / 0.3)));
  if (bn > 0) {
    ctx.save(); ctx.translate(960, 150); ctx.scale(bn, bn);
    ctx.fillStyle = rgba('#000000', 0.15); ctx.beginPath(); ctx.roundRect(-690 + 8, -66 + 10, 1380, 132, 66); ctx.fill();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-690, -66, 1380, 132, 66); ctx.fill();
    ctx.restore();
  }
  caption(ctx, t, { text: 'Works with any style you can show it', x: 960, y: 172, t0: C.capAny + 0.15, t1: C.splash4 + 0.1, size: 64, align: 'center', hl: ['any', 'style'], hlColor: P.rose });
  return { vig: 0, grain: 0 };
}

export const styles = [{ name: 'styles', start: C.styles, end: C.tips, draw }];
