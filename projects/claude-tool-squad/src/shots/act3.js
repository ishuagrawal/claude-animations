// Act III — the dragon and the permission prompt, the rival beast, the team, the journey, the
// dream come true, the final throw into the lens, the logo, the button.
// DNA: warmth beat (hug), rival reveal, ensemble line-up, group walking a vast landscape,
// final throw at the lens → white flash → logo on a starburst, held deadpan button.
import { P, mix, rgba } from '../palette.js';
import { sky, cloud, ridge, texture, speedBG, sunburst, stars, bloom } from '../bg.js';
import { trees, mesa, tufts, ledge, farStadium } from '../land.js';
import { claude } from '../claude.js';
import { owl, dog, crab, octopus, dragon, fire } from '../squad.js';
import { centipede, beetle, moth, beast, marker } from '../bugs.js';
import { dev, duck, robot, cat } from '../cast.js';
import { token, boardContent } from '../props.js';
import { glint, ink, blush, setLight } from '../cel.js';
import { PL } from '../plates.js';
import { motes } from './act1.js';
import { nameStamp, outlined, setFont } from '../type.js';
import { puffs, bolt, ring, sparks, firework } from '../fx.js';
import { speedLines } from '../draw.js';
import { stadium } from './act1.js';
import { C, beat, bar } from '../timeline.js';
import { W, H, TAU, BEAT, BAR, ease, seg, key, clamp, lerp, rng, onN } from '../core.js';

const full = ctx => ctx.fillRect(-50, -50, W + 100, H + 100);
const flashAt = (t, t0) => (t >= t0 && t < t0 + 1.5 / 24 ? 1 : 0);

// ------------------------------------------------------------------ canyon set (dragon + beast)
function canyon(ctx, t, { dusk = 0, pan = 0 } = {}) {
  const k = dusk ? 'Dusk' : 'Day';
  ctx.drawImage(PL['canyonSky' + k], -200 - pan * 0.3, 0);
  ctx.drawImage(PL['canyonGround' + k], -240 - pan, 0);
}

// ------------------------------------------------------------------ 13. Bash vs the permission prompt
const PROMPT = [
  ['Bash command', 'title'],
  ['', ''],
  ['  rm -rf src/', 'cmd'],
  ['  Delete the src directory', 'dim'],
  ['', ''],
  ['Do you want to proceed?', 'q'],
  ['1. Yes', 'opt'],
  ["2. Yes, and don't ask again for rm commands", 'opt'],
  ['3. No, and tell Claude what to do differently', 'opt'],
];
function permissionPrompt(ctx, x, y, w, sel, a, sc = 1) {
  if (a <= 0) return;
  const lh = 46, h = PROMPT.length * lh + 60;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.scale(sc, sc);
  bloom(ctx, w / 2, h / 2, w * 0.8, '#ff9a6a', 0.25);
  const box = new Path2D(); box.roundRect(0, 0, w, h, 18);
  ctx.fillStyle = rgba('#14121c', 0.94); ctx.fill(box);
  ctx.strokeStyle = P.coral; ctx.lineWidth = 4; ctx.stroke(box);
  setFont(ctx, 34, { fam: 'mono', weight: 600 });
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  PROMPT.forEach(([s, kind], i) => {
    const ly = 40 + i * lh;
    const optI = kind === 'opt' ? i - 6 : -1;
    if (kind === 'title') { setFont(ctx, 34, { fam: 'mono', weight: 800 }); ctx.fillStyle = P.coral; }
    else if (kind === 'cmd') { setFont(ctx, 36, { fam: 'mono', weight: 800 }); ctx.fillStyle = '#ffffff'; }
    else if (kind === 'dim') { setFont(ctx, 32, { fam: 'mono', weight: 500 }); ctx.fillStyle = P.termDim; }
    else if (kind === 'q') { setFont(ctx, 34, { fam: 'mono', weight: 700 }); ctx.fillStyle = '#ffffff'; }
    else { setFont(ctx, 32, { fam: 'mono', weight: optI === sel ? 800 : 500 }); ctx.fillStyle = optI === sel ? '#8fc8ff' : '#c9c6d6'; }
    if (optI >= 0 && optI === sel) {
      ctx.save(); ctx.fillStyle = rgba('#8fc8ff', 0.14); ctx.fillRect(18, ly - lh / 2 + 4, w - 36, lh - 8); ctx.restore();
      ctx.fillText('❯', 34, ly);
    }
    ctx.fillText(s, kind === 'opt' ? 78 : 34, ly);
  });
  ctx.restore();
}
function srcFolder(ctx, x, y, s, t) {
  mesa(ctx, x, y, s, s * 0.55, { label: 'src/', seed: 14 });
  // bugs crawling on it
  for (let i = 0; i < 4; i++) { const bx = x + 40 + ((i * 97 + t * 40) % (s - 80)), by = y + s * 0.12 + (i % 2) * s * 0.22; beetle(ctx, { x: bx, y: by, s: 46, t, num: String(i + 1), run: t * 14 + i }); }
}
function sDragon(ctx, t) {
  setLight({ lx: 1, ly: -1, rim: '#fff0c8', rimK: 0.45 });
  canyon(ctx, t, { pan: seg(t, C.dragon, C.beast) * 60 });
  const gy = 990;
  srcFolder(ctx, 1380, 650, 480, t);
  const inhale = seg(t, C.inhale, C.prompt, ease.out);
  const fizz = t >= C.fizzle;
  const sulk = seg(t, C.fizzle, C.fizzle + 0.3, ease.out);
  const ds = 470, k = ds / 100, dx = 400;
  const dsy = 1 + inhale * 0.08 * (1 - sulk);
  const patT = seg(t, C.pat - 0.2, C.pat, ease.out), hugT = t >= C.hug;
  // Claude: holds the leash (left), hops in to pat, then hugs (drawn in front of Bash)
  const cx = hugT ? dx - 140 : lerp(150, dx - 150, patT);
  const hop = patT > 0 && patT < 1 ? Math.sin(patT * Math.PI) * 60 : 0;
  const cOpts = { x: cx, y: gy - hop, s: 250, eyes: hugT ? 'happy' : fizz ? 'open' : t > C.prompt ? 'wide' : 'determined', armR: hugT ? 0.5 : patT > 0 ? 1.5 : 0.3, armLenR: hugT ? 1.4 : 1, armL: hugT ? 0.5 : 0, lx: 1, blush: hugT ? 1 : 0, sweat: t > C.prompt && !fizz ? 1 : 0 };
  const hand = claude(ctx, { ...cOpts, dry: true }).handR;
  if (!hugT) {
    ctx.save(); ctx.strokeStyle = '#d0353f'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.quadraticCurveTo((hand[0] + dx - 12 * k) / 2, gy - 60, dx - 12 * k, gy - 55 * k * dsy); ctx.stroke(); ctx.restore();
  }
  const front = patT > 0;
  if (!front) claude(ctx, cOpts);
  dragon(ctx, { x: dx, y: gy, s: ds, sy: dsy, t, mouth: !fizz && t >= C.inhale ? 1 : 0, flap: t * 8 * (1 - sulk), sulk, eyes: hugT ? 'happy' : fizz ? 'closed' : 'open', look: [0.8, -0.1], puff: fizz ? seg(t, C.fizzle, C.fizzle + 0.8) : 0 });
  if (front) claude(ctx, cOpts);
  // the fire heads for src/… and stops dead at the prompt's edge
  const px = 860, py = 150;
  if (!fizz && t >= C.inhale) {
    const mx = dx + 36 * k, my = gy - 74 * k * dsy;
    const len = t < C.prompt ? 120 + inhale * 260 : px - mx + 20;
    ctx.save(); if (t >= C.prompt) { ctx.beginPath(); ctx.rect(0, 0, px + 6, H); ctx.clip(); }
    fire(ctx, mx, my, -0.08, len, onN(t, 2), 1);
    ctx.restore();
    if (t >= C.prompt) sparks(ctx, px, my - 30, onN((t - C.prompt) % 0.5, 2), { n: 10, speed: 400, len: 22, w: 5, grav: 300, life: 0.4, seed: Math.floor((t - C.prompt) / 0.5), dir: Math.PI, spread: 1.2, col: '#e8ff8a', col2: '#7dffa0' });
  }
  if (hugT) { blush(ctx, dx + 10 * k, gy - 70 * k, 20, 1); for (let i = 0; i < 3; i++) { const hx = dx - 60 + i * 70, hy = gy - 520 - ((t - C.hug) * 120 + i * 40) % 160; ctx.fillStyle = '#ff6f8a'; ctx.beginPath(); ctx.moveTo(hx, hy + 14); ctx.bezierCurveTo(hx - 24, hy - 6, hx - 8, hy - 22, hx, hy - 8); ctx.bezierCurveTo(hx + 8, hy - 22, hx + 24, hy - 6, hx, hy + 14); ctx.fill(); } }
  // the permission prompt stands between Bash and src/
  const pa = seg(t, C.prompt, C.prompt + 0.15, ease.outBack) * (1 - seg(t, C.pat - 0.3, C.pat));
  const sel = t >= C.promptNo + BEAT * 0.5 ? 2 : t >= C.promptNo ? 1 : 0;
  permissionPrompt(ctx, px, py, 1010, sel, clamp(pa), 0.9 + 0.1 * clamp(pa));
  return { flash: flashAt(t, C.prompt) * 0.25 };
}

// ------------------------------------------------------------------ 14–15. the Merge Conflict beast
function sBeast(ctx, t) {
  setLight({ lx: -0.8, ly: -1, rim: '#ffb08a', rimK: 0.55, shadowTint: '#2a1030' });
  canyon(ctx, t, { dusk: 1 });
  const roar = seg(t, C.roar, C.roar + 0.15, ease.out) * (1 - seg(t, C.snip - 0.3, C.snip));
  const shake = roar > 0 ? Math.sin(t * 80) * 10 * roar : 0;
  ctx.save(); ctx.translate(shake, 0);
  if (t >= C.beast && t < C.beast + 0.18) bolt(ctx, 300, -40, 420, 600, Math.floor(t * 12), { w: 14, col: '#ffd9c8', glowCol: '#ff9a7a' });
  const bx = W / 2 + 160, by = 1030, bs = 760, k = bs / 100;
  beast(ctx, { x: bx, y: by, s: bs, t, roar });
  marker(ctx, bx - 24 * k - 330, by - 86 * k, '<<<<<<< HEAD', '#ff8a90', 46);
  marker(ctx, bx + 24 * k + 330, by - 86 * k, '>>>>>>> main', '#8ab4ff', 46);
  ctx.restore();
  // the squad faces it (foreground, backs to camera = dark rim-lit silhouettes)
  claude(ctx, { x: 300, y: 1110, s: 300, eyes: 'determined', lx: 1, ly: -1, yaw: 0.45, sweat: roar > 0.5 ? 1 : 0 });
  crab(ctx, { x: 560, y: 1120, s: 220, t, snip: Math.floor(t * 6) % 2, raise: 0.7 });
  nameStamp(ctx, t - C.roar, { name: 'MERGE CONFLICT', x: 90, y: 170, size: 120, col: '#ff9aa6', align: 'left', dur: 99, fadeOut: false });
  return { vig: 0.4 };
}
function sSnip(ctx, t) {
  setLight({ lx: -0.8, ly: -1, rim: '#ffb08a', rimK: 0.55, shadowTint: '#2a1030' });
  canyon(ctx, t, { dusk: 1, pan: 40 });
  const bx = W / 2 + 160, by = 1030, bs = 760, k = bs / 100;
  const cut = t >= C.snipCut;
  const mg = seg(t, C.merged - 0.3, C.merged, ease.inOut);
  beast(ctx, { x: bx, y: by, s: bs, t, merge: mg, calm: cut ? 1 : 0, roar: cut ? 0 : 0.6 });
  // the markers are snipped: halves fall away
  const fall = clamp((t - C.snipCut) / 0.8);
  for (const [sx, text, col] of [[-1, '<<<<<<< HEAD', '#ff8a90'], [1, '>>>>>>> main', '#8ab4ff']]) {
    const mx = bx + sx * (24 * k + 330), my = by - 86 * k;
    if (!cut) marker(ctx, mx, my, text, col, 46);
    else if (fall < 1) { ctx.save(); ctx.translate(mx + sx * fall * 160, my + fall * fall * 700); ctx.rotate(sx * fall * 1.6); marker(ctx, 0, 0, text, col, 46, 1 - fall); ctx.restore(); }
  }
  // Edit leaps in: snip!
  const leap = seg(t, C.snip, C.snipCut, ease.out);
  const cx = lerp(420, bx, leap), cy = lerp(1100, by - 52 * k, leap) - Math.sin(leap * Math.PI) * 200;
  if (t < C.merged) crab(ctx, { x: cx, y: cy, s: 300, t, snip: cut ? 1 : 0, raise: 1, rot: leap * 0.2 });
  if (t >= C.snipCut && t < C.snipCut + 0.25) { speedLines(ctx, bx, by - 80 * k, 60, 500, 30, 5, '#ffffff', 0.05); }
  if (t >= C.merged) {
    // resolved: one calm head, sparkles, and a green banner
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t; glint(ctx, bx + Math.cos(a) * 240, by - 78 * k + Math.sin(a) * 110, 90, 0.7); }
    marker(ctx, bx, by - 118 * k + 10, '✓ merged', P.greenLt, 56, seg(t, C.merged, C.merged + 0.2));
    crab(ctx, { x: 520, y: 1060, s: 260, t, snip: 1, raise: 1, look: [0.6, -0.5] });
    claude(ctx, { x: 260, y: 1060, s: 240, eyes: 'happy', armL: 1, armR: 1, legs: [Math.sin(t * 20) > 0 ? 10 : 0, 0, 0, Math.sin(t * 20) > 0 ? 10 : 0] });
  }
  return { flash: flashAt(t, C.snipCut) * 0.5 };
}

// ------------------------------------------------------------------ 16. the team line-up
function sTeam(ctx, t) {
  setLight({ lx: 0.7, ly: -1, rim: '#ffffff', rimK: 0.5 });
  sunburst(ctx, W / 2, 620, 24, '#5fc0e0', '#8fd8ee', t * 0.08);
  bloom(ctx, W / 2, 560, 700, '#ffffff', 0.6);
  const u = t - C.team;
  const pop = i => ease.outBack(clamp((u - i * 0.06) / 0.2), 1.6);
  const gy = 1040;
  ctx.fillStyle = rgba('#1d4a6a', 0.25); ctx.beginPath(); ctx.ellipse(W / 2, gy, 900, 40, 0, 0, TAU); ctx.fill();
  // back row
  robot(ctx, { x: 330, y: gy - 60 * (1 - pop(0)), s: 520, t });
  dev(ctx, { x: 960, y: gy - 40 * (1 - pop(1)), s: 820, t, happy: 1, wave: 1 });
  octopus(ctx, { x: 1580, y: gy - 120 - 40 * (1 - pop(2)), s: 340, t, happy: 1 });
  duck(ctx, { x: 960 + 230, y: gy - 640 - 30 * (1 - pop(3)), s: 120, t });
  // front row: the squad around Claude
  crab(ctx, { x: 150, y: gy, s: 230, t, snip: Math.floor(t * 4) % 2, raise: 1 });
  owl(ctx, { x: 560, y: gy, s: 320, t, book: 0, look: [0.3, 0] });
  claude(ctx, { x: 920, y: gy, s: 300, eyes: 'happy', armL: 1, armR: 1, blush: 1 });
  dragon(ctx, { x: 1240, y: gy, s: 290, t, eyes: 'happy', flap: t * 10, flip: true });
  dog(ctx, { x: 1480, y: gy, s: 250, t, wag: t * 20, page: 0, flip: true });
  cat(ctx, { x: 1750, y: gy, s: 420, t });
  return { vig: 0.2 };
}

// ------------------------------------------------------------------ 17. the road (git graph) to the stadium
function sRoad(ctx, t) {
  const p = seg(t, C.road, C.finale, ease.inOut);
  setLight({ lx: 1, ly: -0.5, rim: '#ffd890', rimK: 0.6, shadowTint: '#3a2050' });
  ctx.drawImage(PL.sunsetSky, -200 - p * 60, 0);
  ctx.save(); ctx.translate(-p * 120, 0);
  farStadium(ctx, 1500, 640, 150, { haze: 0.25, lights: 1 });
  glint(ctx, 1500 - 120, 556, 80, 0.8); glint(ctx, 1500 + 120, 556, 80, 0.8);
  ctx.restore();
  ctx.save(); ctx.translate(-p * 260, 0);
  ctx.drawImage(PL.sunsetLand, -200, 0);
  // the git-graph road: a main line with a branch that splits off and merges back
  const road = (pts, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  const main = [[-200, 1060], [300, 960], [700, 880], [1050, 800], [1300, 740], [1450, 690]];
  const branch = [[300, 960], [520, 1010], [860, 930], [1050, 800]];
  road(main, 70, '#e8d3a0'); road(branch, 46, '#e8d3a0');
  road(main, 8, '#c9a870'); road(branch, 6, '#c9a870');
  for (const [x, y] of [[300, 960], [700, 880], [1050, 800], [520, 1010], [860, 930], [1300, 740]]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, 28, 16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = P.coral; ctx.lineWidth = 6; ctx.stroke(); }
  ctx.restore();
  // the team walks the main line (silhouettes rim-lit by the sunset), on 2s
  const walk = onN(t, 2);
  const along = (f) => { const i = Math.min(main.length - 2, Math.floor(f * (main.length - 1))); const q = f * (main.length - 1) - i; return [lerp(main[i][0], main[i + 1][0], q), lerp(main[i][1], main[i + 1][1], q)]; };
  ctx.save(); ctx.translate(-p * 260, 0);
  const members = [['claude', 0.0], ['owl', -0.035], ['dog', -0.07], ['crab', -0.1], ['dev', -0.14], ['oct', -0.175], ['dragon', -0.21]];
  members.reverse().forEach(([m, off]) => {
    const f = clamp(0.4 + p * 0.2 + off * 0.9);
    const [x, y] = along(f);
    const sc = lerp(1.7, 0.8, f);
    const bob = Math.abs(Math.sin(walk * 9 + off * 40)) * 6;
    if (m === 'claude') claude(ctx, { x, y: y - bob, s: 90 * sc, line: 2.2, lx: 1 });
    if (m === 'owl') owl(ctx, { x, y: y - bob, s: 120 * sc, t, book: 0 });
    if (m === 'dog') dog(ctx, { x, y: y - bob, s: 100 * sc, t, run: walk * 8, page: 0 });
    if (m === 'crab') crab(ctx, { x, y: y - bob, s: 80 * sc, t, walk: walk * 10 });
    if (m === 'dev') dev(ctx, { x, y: y - bob, s: 190 * sc, t });
    if (m === 'oct') octopus(ctx, { x, y: y - bob, s: 110 * sc, t });
    if (m === 'dragon') dragon(ctx, { x, y: y - bob, s: 110 * sc, t, flap: walk * 10 });
  });
  ctx.restore();
  return { tint: [1.1, 0.95, 0.85], tintAmt: 0.12 };
}

// ------------------------------------------------------------------ 18. the dream comes true
export const FIREWORKS = [0, 1, 2, 3, 3.5].map((b, i) => [C.fireworks + b * BEAT, [560, 1380, 900, 1600, 320][i], [260, 220, 160, 300, 200][i], ['#ffd36b', '#8ff0a4', '#ff8a9a', '#8fd0ff', '#f7a283'][i]]);
function sFinale(ctx, t) {
  setLight({ lx: 0.3, ly: -1, rim: '#fff5c8', rimK: 0.6 });
  const pass = seg(t, C.flip, C.flip + BEAT * 1.5, ease.lin);
  const pb = seg(t, C.flip + BEAT * 1.6, C.fireworks + BEAT * 1.5, ease.inOut);
  const z = lerp(2.4, 1.08, pb), fy = lerp(450 + 390 * 2.4, 660, pb);
  const crowd = t >= C.flip ? 1 : 0.6;
  stadium(ctx, t, {
    pass, crowd, z, fy,
    hero: c => {
      const jump = t >= C.flip ? Math.abs(Math.sin((t - C.flip) * Math.PI * 2.4)) * 40 : 0;
      c.fillStyle = rgba('#000000', 0.3); c.beginPath(); c.ellipse(W / 2, 902, 260, 18, 0, 0, TAU); c.fill();
      owl(c, { x: W / 2 - 230, y: 900 - jump * 0.6, s: 120, t, book: 0 });
      dog(c, { x: W / 2 + 200, y: 900, s: 100, t, wag: t * 20, page: 0, flip: true });
      crab(c, { x: W / 2 - 120, y: 905, s: 80, t, snip: Math.floor(t * 6) % 2, raise: 1 });
      octopus(c, { x: W / 2 + 300, y: 900 - jump * 0.5, s: 110, t, happy: 1 });
      dragon(c, { x: W / 2 + 100, y: 905, s: 100, t, eyes: 'happy', flap: t * 10 });
      claude(c, { x: W / 2, y: 900 - jump, s: 110, eyes: t >= C.flip ? 'happy' : 'wide', armL: t >= C.flip ? 1.1 : 0, armR: t >= C.flip ? 1.1 : 0, ly: -1, line: 3 });
    },
  });
  for (const [t0, x, y, col] of FIREWORKS) firework(ctx, x, y, onN(t - t0, 2), { size: 260, life: 1.6, seed: Math.round(x), cols: [col, '#ffffff'], n: 40 });
  return { flash: flashAt(t, C.flip) * 0.35, flashCol: [0.7, 1, 0.75] };
}

// ------------------------------------------------------------------ 19. the final throw
function sThrow2(ctx, t) {
  setLight({ lx: 1, ly: -0.7, rim: '#ffe0a0', rimK: 0.55 });
  if (t < C.release2) {
    sunburst(ctx, W / 2 + 300, 300, 26, '#f08a3a', '#ffb24a', t * 0.2);
    const p = seg(t, C.throw2, C.release2, ease.out);
    const a = claude(ctx, { x: W / 2 - 80, y: 1180, s: 800, shear: -0.12 * p, armR: lerp(0.4, 2.0, p), armL: -0.4, eyes: 'determined', line: 8, sy: 1 - 0.04 * p });
    token(ctx, a.handR[0] + 30, a.handR[1] - 40, 230, { rot: -0.5, glow: 0.5 });
    glint(ctx, a.handR[0] + 60, a.handR[1] - 70, 280, seg(t, C.throw2 + BEAT, C.throw2 + BEAT * 1.3));
    return { vig: 0.3 };
  }
  const p = seg(t, C.release2, C.logo, ease.in);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1200); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f9b017');
  ctx.fillStyle = g; full(ctx);
  speedLines(ctx, W / 2, H / 2, 200, 1500, 90, Math.floor(t * 12), rgba('#ffffff', 0.9), 0.025);
  token(ctx, W / 2, H / 2, lerp(300, 3400, p), { rot: lerp(0.3, 0, p), glow: 1, spin: p * 5 });
  const fl = t >= C.flash2 ? clamp((t - C.flash2) / (C.logo - C.flash2)) : 0;
  return { vig: 0.2, ca: 2, flash: fl };
}

// ------------------------------------------------------------------ 20–21. logo + button
function logo(ctx, t, slam) {
  sunburst(ctx, W / 2, 470, 30, '#f6efdc', '#ffd9a0', t * 0.1);
  bloom(ctx, W / 2, 470, 800, '#ffffff', 0.7);
  ctx.save();
  ctx.translate(W / 2, 470);
  ctx.scale(slam, slam);
  ctx.rotate(-0.04);
  outlined(ctx, 'CLAUDE CODE', 0, 60, 230, { align: 'center', line: P.line, lw: 0.2, sh: 0.06, grad: [[0, '#ffd0b0'], [0.45, P.coral], [1, P.coralDk]], track: 4 });
  ctx.restore();
  return ctx;
}
function sLogo(ctx, t) {
  setLight({ lx: 0.6, ly: -1, rim: '#ffffff', rimK: 0.45 });
  const slam = t < C.logo + 0.15 ? 1.8 - 0.8 * ease.outBack(clamp((t - C.logo) / 0.15), 2) : 1;
  logo(ctx, t, slam);
  // ribbon
  const rp = ease.outBack(clamp((t - C.ribbon) / 0.2), 1.6);
  if (rp > 0) {
    ctx.save(); ctx.translate(W / 2, 640); ctx.scale(rp, 1); ctx.rotate(-0.04);
    const rb = new Path2D(); rb.moveTo(-430, -52); rb.lineTo(430, -52); rb.lineTo(470, 0); rb.lineTo(430, 52); rb.lineTo(-430, 52); rb.lineTo(-470, 0); rb.closePath();
    ctx.fillStyle = P.skyDeep; ctx.fill(rb); ink(ctx, rb, 9);
    outlined(ctx, 'THE TOOL SQUAD', 0, 26, 76, { align: 'center', fill: '#ffffff', lw: 0.16, sh: 0.05, track: 6, italic: true });
    ctx.restore();
  }
  // glints across the letters
  glint(ctx, W / 2 - 520, 380, 160, seg(t, C.logo + 0.2, C.logo + 0.4) * (1 - seg(t, C.logo + 0.6, C.logo + 0.9)));
  glint(ctx, W / 2 + 560, 420, 200, seg(t, C.ribbon + 0.3, C.ribbon + 0.5) * (1 - seg(t, C.ribbon + 0.7, C.ribbon + 1.0)));
  // Claude pops up beside the ribbon
  const cp = ease.outBack(clamp((t - C.ribbon - 0.4) / 0.25), 1.8);
  if (cp > 0) claude(ctx, { x: W / 2 + 640, y: 760 + (1 - cp) * 200, s: 200, eyes: 'happy', armR: 1.3 + Math.sin(t * 14) * 0.25, armL: 0.2, blush: 1 });
  return { vig: 0.18, flash: t < C.logo + 1.5 / 24 ? 0.8 : 0 };
}
function sButton(ctx, t) {
  setLight({ lx: 0.6, ly: -1, rim: '#ffffff', rimK: 0.45 });
  logo(ctx, t, 1);
  ctx.save(); ctx.translate(W / 2, 640); ctx.rotate(-0.04);
  const rb = new Path2D(); rb.moveTo(-430, -52); rb.lineTo(430, -52); rb.lineTo(470, 0); rb.lineTo(430, 52); rb.lineTo(-430, 52); rb.lineTo(-470, 0); rb.closePath();
  ctx.fillStyle = P.skyDeep; ctx.fill(rb); ink(ctx, rb, 9);
  outlined(ctx, 'THE TOOL SQUAD', 0, 26, 76, { align: 'center', fill: '#ffffff', lw: 0.16, sh: 0.05, track: 6, italic: true });
  ctx.restore();
  // a tiny bug strolls along the top of the letters…
  const bp = seg(t, C.bugIn, C.black, ease.lin);
  beetle(ctx, { x: lerp(300, 1240, bp), y: 352 - (lerp(300, 1240, bp) - W / 2) * 0.04, s: 110, t, num: '3', run: t * 18 });
  // …and Claude's eyes slide toward it
  const look = seg(t, C.eyesSlide, C.eyesSlide + 0.15, ease.out);
  claude(ctx, { x: W / 2 + 640, y: 760, s: 200, eyes: look > 0 ? 'open' : 'happy', lx: -look, ly: -look * 0.6, blush: 1 - look });
  if (t >= C.black) { ctx.fillStyle = '#000000'; full(ctx); return { vig: 0, grain: 0 }; }
  return { vig: 0.18 };
}

export const act3 = [
  { name: 'dragon', start: C.dragon, end: C.beast, draw: sDragon },
  { name: 'beast', start: C.beast, end: C.snip, draw: sBeast },
  { name: 'snip', start: C.snip, end: C.team, draw: sSnip },
  { name: 'team', start: C.team, end: C.road, draw: sTeam },
  { name: 'road', start: C.road, end: C.finale, draw: sRoad },
  { name: 'finale', start: C.finale, end: C.throw2, draw: sFinale },
  { name: 'throw2', start: C.throw2, end: C.logo, draw: sThrow2 },
  { name: 'logo', start: C.logo, end: C.button, draw: sLogo },
  { name: 'button', start: C.button, end: C.end, draw: sButton },
];
