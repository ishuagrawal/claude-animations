// Act II — the squad, the bugs, the gag, the throw, the subagents.
// DNA: roster parade on speed-line BGs, villain-group pose, a held comedy gag, the wind-up and
// throw at the lens (smash chain), then the world opens up.
import { P, mix, rgba } from '../palette.js';
import { sky, cloud, speedBG, sunburst, bloom, texture } from '../bg.js';
import { trees, tufts } from '../land.js';
import { claude } from '../claude.js';
import { owl, dog, crab, octopus, dragon, fire } from '../squad.js';
import { centipede, beetle, moth } from '../bugs.js';
import { token } from '../props.js';
import { glint, ink, sweat, setLight } from '../cel.js';
import { PL } from '../plates.js';
import { nameStamp, outlined, setFont } from '../type.js';
import { puffs, bolt, ring, sparks } from '../fx.js';
import { speedLines } from '../draw.js';
import { vista, plate, motes } from './act1.js';
import { C, beat, bar } from '../timeline.js';
import { W, H, TAU, BEAT, BAR, ease, seg, key, clamp, lerp, rng, hash, onN } from '../core.js';

const full = ctx => ctx.fillRect(-50, -50, W + 100, H + 100);
const flashAt = (t, t0) => (t >= t0 && t < t0 + 1.5 / 24 ? 1 : 0);

// ------------------------------------------------------------------ the parade (one bar each)
const PARADE = [
  { at: 'pRead', name: 'READ', sub: 'reads your files', bg: ['#4b2f6a', '#a88682'], ang: -0.35, side: -1, col: '#ffe46b' },
  { at: 'pFetch', name: 'WEBFETCH', sub: 'fetches web pages', bg: ['#c2651a', '#f9b017'], ang: 0, side: 1, col: '#fff3c0' },
  { at: 'pEdit', name: 'EDIT', sub: 'makes targeted edits', bg: ['#14607a', '#44abc2'], ang: 0.35, side: -1, col: '#ffe46b' },
  { at: 'pWrite', name: 'WRITE', sub: 'creates new files', bg: ['#3e1f6e', '#c06fd0'], ang: -0.3, side: 1, col: '#c8f7ff' },
  { at: 'pBash', name: 'BASH', sub: 'runs shell commands', bg: ['#0e1420', '#2f3d55'], ang: 0.2, side: -1, col: '#9dffb8' },
];
function sParade(ctx, t) {
  const i = Math.min(4, Math.floor((t - C.parade) / BAR));
  const d = PARADE[i], t0 = C[d.at], u = t - t0;
  setLight({ lx: -d.side * 0.8, ly: -1, rim: mix(d.bg[1], '#ffffff', 0.55), rimK: 0.55 });
  speedBG(ctx, t, { a: d.bg[0], b: d.bg[1], ang: d.ang, seed: 10 + i, line: i === 4 ? '#7dffa0' : '#ffffff', alpha: i === 4 ? 0.35 : 0.5 });
  // creature slides in from its side with an overshoot, then acts
  const inP = ease.outBack(clamp(u / 0.28), 1.4);
  const cx = W / 2 + d.side * 400 + d.side * (1 - inP) * 900;
  const z = lerp(1, 1.08, clamp(u / BAR));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  const gy = 1010;
  ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.ellipse(cx, gy + 4, 300, 30, 0, 0, TAU); ctx.fill();
  if (i === 0) {
    const look = u < BEAT * 2 ? [Math.sin(u * 9) * 0.8, 0.6] : [0, -0.2];
    owl(ctx, { x: cx, y: gy, s: 880, t, look, page: Math.sin(u * 6) > 0.6 ? 1 : 0, glint: seg(t, t0 + BEAT * 2, t0 + BEAT * 2.3) * (1 - seg(t, t0 + BEAT * 3, t0 + BEAT * 3.4)) });
  } else if (i === 1) {
    dog(ctx, { x: cx - 60, y: gy, s: 680, t, run: u * 14, wag: u * 20 });
    for (let k = 0; k < 6; k++) { const x = cx - 380 - ((k * 137 + u * 900) % 500), y = gy - 120 - k * 50; ctx.fillStyle = rgba('#ffffff', 0.8); ctx.fillRect(x, y, 140, 6); }
  } else if (i === 2) {
    const sn = (Math.floor(u / BEAT) % 2 === 1) ? 1 : 0;
    crab(ctx, { x: cx, y: gy, s: 700, t, snip: sn, raise: 0.6, look: [0.2, -0.3] });
    if (sn) for (const sx of [-1, 1]) { const px = cx + sx * 410, py = gy - 650; sparks(ctx, px, py, onN(u % BEAT, 2), { n: 8, speed: 500, len: 30, w: 6, grav: 0, life: 0.25, seed: 7 + sx, col: '#ffffff' }); }
  } else if (i === 3) {
    const tip = octopus(ctx, { x: cx - 120, y: gy, s: 780, t, write: u, look: [0.6, -0.4] });
    // a new file appears, written line by line
    const fx = cx + 200, fy = gy - 700;
    const card = new Path2D(); card.roundRect(fx, fy, 300, 360, 14);
    ctx.save(); ctx.globalAlpha = clamp(u / 0.2);
    ctx.fillStyle = P.paper; ctx.fill(card); ink(ctx, card, 5);
    ctx.fillStyle = '#7a5cc0'; ctx.fillRect(fx, fy, 300, 50); ink(ctx, card, 5);
    setFont(ctx, 28, { fam: 'mono', weight: 700 }); ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText('new_file.js', fx + 20, fy + 26);
    const lines = Math.floor(clamp((u - 0.2) / 1.1) * 7);
    const cols = ['#3f7fd0', '#c0504a', '#3f9a50', '#7a5cc0', '#c0a030'];
    for (let k = 0; k < lines; k++) { ctx.fillStyle = cols[k % 5]; ctx.fillRect(fx + 24 + (k % 3) * 18, fy + 80 + k * 38, 120 + ((k * 53) % 110), 12); }
    ctx.restore();
  } else {
    const puff = seg(t, t0 + BEAT, t0 + BEAT * 2.2, ease.out);
    const dx = cx - 140, ds = 760, k = ds / 100;
    // the leash runs off-screen: someone is holding it
    ctx.save(); ctx.strokeStyle = '#d0353f'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx - 12 * k, gy - 55 * k); ctx.quadraticCurveTo(dx - 300, gy - 150, dx - 700, gy - 80); ctx.stroke(); ctx.restore();
    dragon(ctx, { x: dx, y: gy, s: ds, t, mouth: puff > 0 && puff < 1 ? 1 : 0, flap: u * 10, look: [0.7, -0.1] });
    if (puff > 0 && puff < 1) fire(ctx, dx + 36 * k, gy - 74 * k, -0.15, 620, onN(t, 2), Math.sin(puff * Math.PI));
  }
  ctx.restore();
  // name stamp opposite the creature
  const sx = d.side > 0 ? 130 : W - 130;
  nameStamp(ctx, u - 0.06, { name: d.name, sub: d.sub, x: sx, y: 330, size: 190, col: d.col, align: d.side > 0 ? 'left' : 'right', dur: BAR, subDelay: 0.18, fadeOut: false });
  return { flash: 0 };
}

// ------------------------------------------------------------------ the bug gang (villain pose)
function sGang(ctx, t) {
  const u = t - C.gang;
  setLight({ lx: 0.6, ly: -1, rim: '#c8a8ff', rimK: 0.6, shadowTint: '#1a1030' });
  plate_(ctx, PL.storm, 240 + u * 30, 0);
  const strike = [C.gang, C.gBonk];
  for (const s of strike) if (t >= s && t < s + 0.16) bolt(ctx, 1500 + (s === C.gang ? 0 : -1100), -40, 1300 + (s === C.gang ? 0 : -1000), 520, Math.floor(t * 12), { w: 14, col: '#d9c8ff', glowCol: '#a080ff', glowA: 0.7 });
  for (const s of strike) if (t >= s && t < s + 0.2) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgba('#8a70c8', 0.35); full(ctx); ctx.restore(); }
  const z = lerp(1.05, 1, seg(t, C.gang, C.gag, ease.out));
  ctx.save(); ctx.translate(W / 2, H); ctx.scale(z, z); ctx.translate(-W / 2, -H);
  // centipede (left), twins (centre), moth (right)
  centipede(ctx, { x: 640, y: 930, s: 520, t, wiggle: t * 4, look: [0.6, 0] });
  const bonk = seg(t, C.gBonk - 0.25, C.gBonk, ease.in), after = t >= C.gBonk;
  const swap = Math.floor((t - C.gRace) / (BEAT / 2)) % 2 === 1 && !after && t > C.gRace;
  const twinX = [after ? 930 : lerp(860, 970, bonk), after ? 1150 : lerp(1240, 1110, bonk)];
  beetle(ctx, { x: swap ? twinX[1] : twinX[0], y: 935, s: 300, t, num: swap ? '2' : '1', run: t * 16, dizzy: after ? 1 : 0, look: [1, 0] });
  beetle(ctx, { x: swap ? twinX[0] : twinX[1], y: 935, s: 300, t, num: swap ? '1' : '2', run: t * 16 + 1, dizzy: after ? 1 : 0, flip: true, look: [1, 0] });
  if (t >= C.gBonk && t < C.gBonk + 0.2) { ctx.save(); ctx.translate(1040, 820); speedLines(ctx, 0, 0, 30, 240, 20, 3, '#ffffff', 0.08); ctx.restore(); }
  const vis = t < C.gFlaky ? 1 : (Math.floor((t - C.gFlaky) * 12) % 5 === 3 ? 0.15 : 1);
  moth(ctx, { x: 1560, y: 850 + Math.sin(t * 5) * 14, s: 520, t, flap: t * 22, vis });
  ctx.restore();
  // labels accumulate above each bug
  const lab = (t0, s, x, y, col) => nameStamp(ctx, t - t0, { name: s, x, y, size: 92, col, align: 'center', dur: 99, rot: -0.04, fadeOut: false });
  lab(C.gOff, 'OFF-BY-ONE', 440, 640, '#e7b8ff');
  lab(C.gRace, 'RACE CONDITION', 1010, 560, '#ffe46b');
  lab(C.gFlaky, 'FLAKY TEST', 1580, 230, '#ff9aa6');
  ctx.save(); ctx.filter = 'blur(4px)'; ctx.globalAlpha = 0.9; ctx.drawImage(PL.fgGrass, -200, H - 200, 2400, 400); ctx.restore();
  return { vig: 0.5, flash: flashAt(t, C.gang) * 0.6, flashCol: [0.85, 0.8, 1], bloom: 0.6 };
}

// ------------------------------------------------------------------ the gag: the flaky moth
const plate_ = (ctx, img, panX = 0, dy = 0) => ctx.drawImage(img, -panX, dy);
function forest(ctx, t, pan = 0) {
  plate_(ctx, PL.forestBack, 200 + pan * 0.3, 0);
  plate_(ctx, PL.forestMid, 240 + pan * 0.6, 0);
  plate_(ctx, PL.forestFloor, 240 + pan, 0);
}
function sGag(ctx, t) {
  setLight({ lx: 1, ly: -1, rim: '#fff8d0', rimK: 0.45 });
  const pan = seg(t, C.gag, C.windup, ease.inOut) * 80;
  forest(ctx, t, pan);
  // camera: closer on the action (characters fill the frame like the reference)
  ctx.save(); ctx.translate(960, 700); ctx.scale(1.22, 1.22); ctx.translate(-960, -700);
  const gy = 900;
  // Claude: creep → pounce (arc) → faceplant → lie there
  const creep = seg(t, C.gag, C.pounce, ease.inOut);
  const jump = seg(t, C.pounce, C.faceplant, ease.lin);
  let x = lerp(380, 640, creep), y = gy, rot = 0, sx = 1, sy = 1, eyes = 'determined', legs = [0, 0, 0, 0], armL = 0, armR = 0;
  if (t < C.pounce) { sy = 0.86 + Math.sin(t * 20) * 0.02; sx = 1.08; legs = [Math.max(0, Math.sin(t * 16)) * 8, 0, Math.max(0, -Math.sin(t * 16)) * 8, 0]; }
  if (t >= C.pounce) {
    x = lerp(640, 1240, jump); y = gy - Math.sin(Math.PI * jump) * 300; rot = lerp(-0.2, 1.0, jump); sx = 1.1; sy = 0.95; armL = 0.9; armR = 0.9; eyes = 'wide';
  }
  if (t >= C.faceplant) { x = 1270; y = gy + 6; rot = 1.25; sx = 1.15; sy = 0.82; armL = -0.2; armR = 0.9; eyes = 'x'; legs = [10, 6, 14, 4]; }
  const sweatA = t >= C.flakyBlink ? 1 : 0;
  if (t >= C.flakyBlink) eyes = 'tiny';
  ctx.fillStyle = rgba('#244a2a', 0.35); ctx.beginPath(); ctx.ellipse(x, gy + 6, 120, 14, 0, 0, TAU); ctx.fill();
  claude(ctx, { x, y, s: 230, rot, sx, sy, eyes, legs, armL, armR, sweat: sweatA, lx: t >= C.flakyBack ? -1 : 1 });
  if (t >= C.faceplant) puffs(ctx, 1230, gy, onN(t - C.faceplant, 2), { n: 9, dir: -Math.PI / 2, spread: 1.3, speed: 260, size: 34, life: 0.8, seed: 5, col: '#f3ead2', shCol: '#c9b998' });
  // the moth: hovers, flickers out at the pounce, reappears behind Claude
  let mv = 1, mx = 1240, my = 560 + Math.sin(t * 6) * 18;
  if (t >= C.vanish - 0.12 && t < C.flakyBack) mv = Math.floor(t * 24) % 2 && t < C.vanish ? 1 : 0;
  if (t >= C.flakyBack) { mx = 1120; my = 600 + Math.sin(t * 6) * 10; mv = t < C.flakyBack + 0.25 ? (Math.floor(t * 24) % 2 ? 0.2 : 1) : 1; }
  moth(ctx, { x: mx, y: my, s: 230, t, flap: t * 22, vis: mv, look: [-0.5, 0.8] });
  if (t >= C.flakyBlink && t < C.flakyBlink + 0.5) { ctx.save(); setFont(ctx, 70, { fam: 'heavy', weight: 800 }); outlined(ctx, '!?', 1340, 640, 110, { fill: '#ffffff', align: 'center' }); ctx.restore(); }
  ctx.restore();
  // foreground leaves frame the shot
  ctx.drawImage(PL.forestFront, -240 - pan * 1.4, -20);
  return { bloom: 0.5 };
}

// ------------------------------------------------------------------ the throw (smash chain)
function sThrow(ctx, t) {
  if (t < C.release) {
    // wind-up: low angle, arm back, token glints
    setLight({ lx: 1, ly: -0.6, rim: '#e8ffb0', rimK: 0.5 });
    speedBG(ctx, t, { a: '#1d5a3a', b: '#7cc25a', ang: -0.6, seed: 31, alpha: 0.45, speed: 1200 });
    const p = seg(t, C.windup, C.release, ease.out);
    const a = claude(ctx, { x: W / 2 + 60, y: 1180, s: 760, shear: -0.12 * p, armR: lerp(0.4, 1.9, p), armL: -0.3, eyes: 'determined', sy: 1 - 0.05 * p, line: 8 });
    token(ctx, a.handR[0] + 30, a.handR[1] - 40, 220, { rot: -0.5, glow: 0.3 });
    const gl = seg(t, C.windup + BEAT, C.windup + BEAT * 1.3) * (1 - seg(t, C.windup + BEAT * 1.6, C.release));
    glint(ctx, a.handR[0] + 60, a.handR[1] - 70, 260, gl);
    return { vig: 0.3 };
  }
  if (t < C.tokenCam) {
    // release: smear + streaks
    setLight({ lx: 1, ly: -0.6, rim: '#ffffff', rimK: 0.5 });
    speedBG(ctx, t, { a: '#123c8a', b: '#4fb4e8', ang: 0.4, seed: 32, line: '#ffffff', alpha: 0.6, speed: 4000 });
    const p = seg(t, C.release, C.tokenCam, ease.out);
    const a = claude(ctx, { x: W / 2 - 120, y: 1150, s: 700, shear: 0.18, armR: lerp(1.9, -0.6, ease.out(clamp(p * 2.5))), armLenR: 1.6, armL: 0.4, eyes: 'determined', line: 8 });
    token(ctx, lerp(a.handR[0] + 80, W / 2 + 700, p), lerp(a.handR[1] - 60, 320, p), lerp(220, 320, p), { rot: p * 6, glow: 1, spin: p * 20 });
    return { vig: 0.25, flash: flashAt(t, C.release) * 0.4 };
  }
  // the token rushes the lens
  const p = seg(t, C.tokenCam, C.split, ease.in);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1200); g.addColorStop(0, '#ffffff'); g.addColorStop(1, P.coral);
  ctx.fillStyle = g; full(ctx);
  speedLines(ctx, W / 2, H / 2, 200, 1500, 80, Math.floor(t * 12), rgba('#ffffff', 0.9), 0.025);
  token(ctx, W / 2, H / 2, lerp(260, 2600, p), { rot: lerp(-0.4, 0.2, p), glow: 1, spin: p * 6 });
  return { vig: 0.2, ca: 2 };
}

// ------------------------------------------------------------------ the split: subagents fan out
const FAN = [[-1, -0.55], [-0.55, -0.95], [0, -1], [0.55, -0.95], [1, -0.55]];
function sSplit(ctx, t) {
  const u = t - C.split;
  vista(ctx, t, 60, 0);
  const bx = W / 2, by = 330;
  // the token bursts open
  const op = seg(t, C.split, C.split + 0.25, ease.out);
  bloom(ctx, bx, by, 900 * (1 - seg(t, C.split + 0.3, C.panels)), '#fff3e0', 1);
  ring(ctx, bx, by, onN(u, 2), { r0: 30, r1: 900, life: 0.7, w: 26, col: '#ffffff' });
  if (u < 0.35) token(ctx, bx, by, 260 * (1 + op * 0.3), { glow: 1, rot: u * 3 });
  // five mini-Claudes pop out (on the fan beat) and arc away, each with a coral trail
  FAN.forEach(([dx, dy], i) => {
    const tt = t - C.fan - i * 0.05;
    if (tt < 0) return;
    const p = clamp(tt / 1.05);
    const d = ease.out(p) * 900;
    const x = bx + dx * d, y = by + dy * d * 0.55 + p * p * 340;
    ctx.save(); ctx.strokeStyle = rgba(P.coralLt, 0.7); ctx.lineWidth = 18; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + dx * d * 0.5, by + dy * d * 0.4, x, y); ctx.stroke(); ctx.restore();
    claude(ctx, { x, y: y + 60, s: lerp(60, 140, ease.out(p)), armL: 0.8, armR: 0.8, eyes: 'happy', rot: dx * 0.2 });
  });
  nameStamp(ctx, t - C.fan - 0.1, { name: 'SUBAGENTS', sub: 'five at once, in parallel', x: W / 2, y: 900, size: 150, col: '#ffe46b', align: 'center', dur: 99, subDelay: 0.25, fadeOut: false });
  return { flash: flashAt(t, C.split) };
}

// ------------------------------------------------------------------ split screen: parallel work
function panelPath(i) {
  const w = W / 5, sk = 70;
  const x0 = i * w, x1 = (i + 1) * w;
  const p = new Path2D();
  p.moveTo(x0 + (i ? sk : -10), -10); p.lineTo(x1 + (i < 4 ? sk : 10), -10); p.lineTo(x1 - (i < 4 ? sk : -10), H + 10); p.lineTo(x0 - (i ? sk : 10), H + 10); p.closePath();
  return p;
}
const PANEL_BG = [['#4b2f6a', '#a88682'], ['#c2651a', '#f9b017'], ['#14607a', '#44abc2'], ['#3e1f6e', '#c06fd0'], ['#7a5a10', '#f9d040']];
function sPanels(ctx, t) {
  ctx.fillStyle = '#ffffff'; full(ctx);
  for (let i = 0; i < 5; i++) {
    const t0 = C.panelIn[i];
    if (t < t0) continue;
    const u = t - t0, inP = ease.out(clamp(u / 0.18));
    const done = t >= C.checks[i];
    const cx = (i + 0.5) * W / 5;
    const p = panelPath(i);
    ctx.save();
    ctx.translate(0, (1 - inP) * (i % 2 ? -H : H));
    ctx.clip(p);
    speedBG(ctx, t, { a: PANEL_BG[i][0], b: PANEL_BG[i][1], ang: Math.PI / 2 + (i % 2 ? 0.2 : -0.2), seed: 40 + i, alpha: 0.4, n: 40 });
    const gy = 860;
    ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.ellipse(cx, gy + 4, 170, 18, 0, 0, TAU); ctx.fill();
    const mini = (x, eyes, extra = {}) => claude(ctx, { x, y: gy, s: 120, eyes, ...extra });
    if (i === 0) { owl(ctx, { x: cx + 60, y: gy, s: 260, t, look: done ? [0, -0.3] : [Math.sin(t * 9), 0.6] }); mini(cx - 110, done ? 'happy' : 'open', { lx: 1 }); }
    if (i === 1) { dog(ctx, { x: cx + 40, y: gy, s: 220, t, run: done ? 0 : t * 14, wag: t * 20 }); mini(cx - 120, done ? 'happy' : 'open', { lx: 1, armR: done ? 1 : 0 }); }
    if (i === 2) {
      const cut = done;
      centipede(ctx, { x: cx + 120, y: gy, s: 150, t, n: cut ? 7 : 8, wiggle: t * 3 });
      if (cut) { const fl = clamp((t - C.checks[i]) / 0.5); ctx.save(); ctx.translate(cx - 30 - fl * 80, gy - 60 - Math.sin(fl * Math.PI) * 120); ctx.rotate(fl * 6); ctx.fillStyle = '#c95fd0'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); ink(ctx, (() => { const q = new Path2D(); q.arc(0, 0, 18, 0, TAU); return q; })(), 3); ctx.restore(); }
      crab(ctx, { x: cx - 60, y: gy - 10, s: 200, t, snip: cut ? 1 : (Math.floor(t * 6) % 2), raise: 0.8 });
    }
    if (i === 3) { octopus(ctx, { x: cx + 50, y: gy, s: 250, t, write: t }); mini(cx - 120, done ? 'happy' : 'open', { lx: 1 });
      ctx.save(); ctx.translate(cx + 30, 330); ctx.rotate(0.06); const card = new Path2D(); card.roundRect(-70, -60, 140, 120, 8); ctx.fillStyle = P.paper; ctx.fill(card); ink(ctx, card, 4); setFont(ctx, 26, { fam: 'mono', weight: 800 }); ctx.fillStyle = '#3f9a50'; ctx.textAlign = 'center'; ctx.fillText('test()', 0, -10); for (let k = 0; k < 3; k++) { ctx.fillStyle = '#9a94a8'; ctx.fillRect(-50, 14 + k * 14, 100 - k * 20, 6); } ctx.restore(); }
    if (i === 4) {
      // the race twins, made to queue: 1 then 2
      const q = done ? 1 : 0;
      beetle(ctx, { x: cx + (q ? 90 : 20 + Math.sin(t * 9) * 40), y: gy, s: 120, t, num: '1', run: t * 16 });
      beetle(ctx, { x: cx + (q ? -40 : 60 - Math.sin(t * 9) * 40), y: gy, s: 120, t, num: '2', run: t * 16 + 2 });
      mini(cx - 150, done ? 'happy' : 'determined', { armR: 1.2 });
    }
    if (done) {
      const k = ease.outBack(clamp((t - C.checks[i]) / 0.2), 2);
      ctx.save(); ctx.translate(cx + (i % 2 ? -20 : 20), 230); ctx.scale(k, k);
      const c = new Path2D(); c.arc(0, 0, 90, 0, TAU);
      ctx.fillStyle = P.green; ctx.fill(c); ink(ctx, c, 7);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-42, 2); ctx.lineTo(-10, 34); ctx.lineTo(46, -32); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // panel border
    ctx.save(); ctx.translate(0, (1 - inP) * (i % 2 ? -H : H)); ink(ctx, p, 10, P.line); ctx.restore();
  }
  return { vig: 0.15 };
}

export const act2 = [
  { name: 'parade', start: C.parade, end: C.gang, draw: sParade },
  { name: 'gang', start: C.gang, end: C.gag, draw: sGang },
  { name: 'gag', start: C.gag, end: C.windup, draw: sGag },
  { name: 'throw', start: C.windup, end: C.split, draw: sThrow },
  { name: 'split', start: C.split, end: C.panels, draw: sSplit },
  { name: 'panels', start: C.panels, end: C.dragon, draw: sPanels },
];
