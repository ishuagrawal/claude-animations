// Act I — the world, the hero, the dream.
// DNA: scale open (cosmos → world → one small hero), long slow hero reveal, the empty arena.
import { P, mix, rgba } from '../palette.js';
import { sunburst, stars, bloom } from '../bg.js';
import { PL } from '../plates.js';
import { claude } from '../claude.js';
import { token, monitor, crt, scoreboard, boardContent } from '../props.js';
import { glint, ink, setLight } from '../cel.js';
import { setFont, typed } from '../type.js';
import { C } from '../timeline.js';
import { W, H, TAU, ease, seg, key, clamp, lerp, rng } from '../core.js';
import { speedLines } from '../draw.js';

const full = ctx => { ctx.fillRect(-50, -50, W + 100, H + 100); };
// draw a 2400-wide plate with horizontal pan (px of the plate) and vertical offset
export const plate = (ctx, img, panX = 0, dy = 0, s = 1) => ctx.drawImage(img, -panX * s, dy, img.width * s, img.height * s);
// drifting dust / light motes (screen)
export function motes(ctx, t, n, seed, col = '#fff6d0', a = 0.6) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = (r() * W + t * (20 + r() * 40)) % W, y = (r() * H - t * (10 + r() * 30) + H) % H, s = 2 + r() * 5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 1. cosmos
const NODES = [[420, 300], [640, 210], [880, 330], [700, 470], [1040, 180], [1220, 360], [1000, 520], [1400, 250], [1560, 430], [1300, 600], [520, 620], [860, 700]];
const EDGES = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 5], [5, 6], [3, 6], [5, 7], [7, 8], [8, 9], [6, 9], [3, 10], [6, 11], [10, 11]];
function sCosmos(ctx, t) {
  const push = key(t, [[0, 1], [C.dive, 1.1, ease.inOut], [C.boot, 2.2, ease.in]]);
  ctx.fillStyle = '#03020a'; full(ctx);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(push, push); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(PL.space, -340 - t * 22, -210 - t * 8);
  stars(ctx, 5, 160, t, { w: W + 400, h: H + 300, x: -200, y: -150, a: 0.8 });
  // the dependency-graph constellation draws itself edge by edge
  EDGES.forEach(([a, b], i) => {
    const p = seg(t, 0.15 + i * 0.09, 0.45 + i * 0.09, ease.out);
    if (p <= 0) return;
    const [x0, y0] = NODES[a], [x1, y1] = NODES[b];
    ctx.save(); ctx.shadowColor = '#9fe6ff'; ctx.shadowBlur = 12;
    ctx.strokeStyle = rgba('#c8f2ff', 0.8); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, p), lerp(y0, y1, p)); ctx.stroke(); ctx.restore();
  });
  NODES.forEach(([x, y], i) => {
    const p = seg(t, 0.1 + i * 0.1, 0.3 + i * 0.1, ease.outBack);
    if (p <= 0) return;
    bloom(ctx, x, y, 60 * p, '#bfefff', 0.9);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7 * p, 0, TAU); ctx.fill();
    glint(ctx, x, y, 70 * p, 0.6, 0);
  });
  // comet = the prompt token, foreshadowing the throw
  const cp = seg(t, C.comet, C.comet + 0.85, ease.lin);
  if (cp > 0 && cp < 1) {
    const x = lerp(-250, 2150, cp), y = lerp(150, 640, cp);
    ctx.save();
    const g = ctx.createLinearGradient(x - 760, y - 155, x, y);
    g.addColorStop(0, 'rgba(255,170,130,0)'); g.addColorStop(0.7, 'rgba(255,200,170,0.6)'); g.addColorStop(1, 'rgba(255,240,220,0.95)');
    ctx.strokeStyle = g; ctx.lineWidth = 50; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 760, y - 155); ctx.lineTo(x, y); ctx.stroke();
    for (let i = 0; i < 18; i++) { const u = (i * 0.137 + t * 3) % 1; ctx.fillStyle = rgba('#fff0d8', 1 - u); ctx.fillRect(x - u * 600 + Math.sin(i) * 20, y - u * 125 + Math.cos(i * 3) * 30, 6, 6); }
    ctx.restore();
    token(ctx, x, y, 180, { rot: 0.2, glow: 1, spin: t * 18 });
  }
  ctx.restore();
  // the planet rises into view (camera dives)
  const rise = seg(t, C.dive - 0.25, C.boot, ease.inOut);
  if (rise > 0) {
    const sc = lerp(0.8, 1.9, rise * rise);
    const y = lerp(H + 100, -40, rise);
    ctx.save(); ctx.translate(W / 2, y); ctx.scale(sc, sc); ctx.drawImage(PL.planet, -1500, -60); ctx.restore();
  }
  // clouds rush past the camera into the next shot
  const rush = seg(t, C.boot - 0.5, C.boot, ease.in);
  if (rush > 0) {
    ctx.save(); ctx.globalAlpha = clamp(rush * 2.2);
    for (let i = 0; i < 3; i++) { const s = 1.5 + rush * (3 + i * 1.5); ctx.drawImage(PL.vistaSky, 0, 300 + i * 80, 2400, 360, W / 2 - 1200 * s / 2 + (i - 1) * 300 * s, H / 2 - 180 * s + i * 120, 2400 * s / 2, 360 * s / 2); }
    ctx.restore();
    ctx.fillStyle = rgba('#ffffff', clamp((rush - 0.55) * 2.4)); full(ctx);
  }
  return { vig: 0.35, ca: 1, bloom: 0.7 };
}

// ------------------------------------------------------------------ 2. boot (hilltop terminal at dawn)
function sBoot(ctx, t) {
  const u = t - C.boot;
  setLight({ lx: -1, ly: -0.6, rim: '#ffc89a', rimK: 0.5 });
  const z = lerp(1, 1.1, seg(t, C.boot, C.burst, ease.inOut));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  plate(ctx, PL.dawn, 240, -120);
  bloom(ctx, 420, 520, 520, '#ffe0b0', 0.7);
  // shaky anticipation in the last beat: the screen bulges
  const bulge = seg(t, C.burst - 0.42, C.burst, ease.in);
  ctx.translate(Math.sin(t * 90) * 6 * bulge, Math.cos(t * 77) * 4 * bulge);
  // cables snaking off into the grass
  ctx.save(); ctx.strokeStyle = '#2a2430'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(1500, 1000); ctx.bezierCurveTo(1650, 1040, 1700, 980, 1980, 1060); ctx.stroke(); ctx.restore();
  const scr = monitor(ctx, W / 2 + 40, 560, 1240, { on: clamp(u / 0.2) });
  ctx.save(); ctx.clip(scr.clip);
  const pad = scr.w * 0.04;
  ctx.fillStyle = P.term; ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
  const vg = ctx.createRadialGradient(scr.x + scr.w / 2, scr.y + scr.h / 2, 50, scr.x + scr.w / 2, scr.y + scr.h / 2, scr.w * 0.7);
  vg.addColorStop(0, 'rgba(60,40,80,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = vg; ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
  setFont(ctx, 36, { fam: 'mono', weight: 600 });
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.strokeStyle = P.coral; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(scr.x + pad, scr.y + pad, scr.w * 0.62, 70, 12); ctx.stroke();
  ctx.save(); ctx.shadowColor = P.coral; ctx.shadowBlur = 10;
  ctx.fillStyle = P.coral; ctx.fillText(typed('✻ Welcome to Claude Code!', t, C.boot + 0.05, 40), scr.x + pad + 26, scr.y + pad + 17);
  ctx.restore();
  const sp = seg(t, C.sprite, C.sprite + 0.55, ease.lin);
  const look = t > C.spriteLook ? 1 : 0;
  const hop = t > C.spriteLook + 0.2 ? Math.abs(Math.sin((t - C.spriteLook - 0.2) * Math.PI * 4.8)) * 18 : 0;
  ctx.save(); ctx.shadowColor = P.coral; ctx.shadowBlur = 26;
  claude(ctx, { mode: 'pixel', x: scr.x + scr.w * 0.5, y: scr.y + scr.h * 0.78 - hop, s: 300, reveal: sp, lx: look });
  ctx.restore();
  ctx.fillStyle = P.termDim; ctx.fillText('>', scr.x + pad, scr.y + scr.h - pad - 40);
  if (Math.floor(t * 3.4) % 2 === 0) { ctx.fillStyle = '#e8e6f0'; ctx.fillRect(scr.x + pad + 34, scr.y + scr.h - pad - 42, 20, 40); }
  ctx.restore();
  crt(ctx, scr);
  if (bulge > 0) bloom(ctx, W / 2, 520, 900 * bulge, '#ffffff', 0.9 * bulge);
  // foreground grass (out of focus) frames the bottom edge
  ctx.save(); ctx.filter = 'blur(3px)'; ctx.drawImage(PL.fgGrass, -200, H - 330, 2400, 400); ctx.restore();
  ctx.restore();
  return { vig: 0.32, tint: [1.08, 0.96, 0.9], tintAmt: 0.1 };
}

// ------------------------------------------------------------------ 3. burst out (pixel → cel)
function sBurst(ctx, t) {
  const u = t - C.burst, p = seg(t, C.burst, C.eyes, ease.out);
  setLight({ lx: 0.6, ly: -1, rim: '#ffffff', rimK: 0.5 });
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 1300);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#bff0ff'); g.addColorStop(1, '#2f9fcf');
  ctx.fillStyle = g; full(ctx);
  speedLines(ctx, W / 2, H / 2, 160, 1500, 110, 3 + Math.floor(u * 12), rgba('#ffffff', 1), 0.026);
  speedLines(ctx, W / 2, H / 2, 300, 1500, 40, 9 + Math.floor(u * 12), rgba('#8fd8ff', 0.7), 0.02);
  // pixel shards scatter, each a little 3D cube
  const r = rng(77);
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, sp = 600 + r() * 1400, s = 14 + r() * 30;
    const d = sp * u + 40;
    ctx.save(); ctx.translate(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d); ctx.rotate(u * (r() - 0.5) * 8);
    ctx.globalAlpha = 1 - clamp(u / 0.8);
    ctx.fillStyle = mix(P.coral, '#ffd9c0', 0.4); ctx.fillRect(-s / 2 + s * 0.15, -s / 2 - s * 0.15, s, s);
    ctx.fillStyle = r() < 0.85 ? P.coral : P.term; ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) glint(ctx, W / 2 + Math.cos(i * 1.1) * 300 * (1 + u), H / 2 + Math.sin(i * 1.1) * 200 * (1 + u), 120, 1 - clamp(u / 0.8));
  const s = lerp(160, 1050, p);
  claude(ctx, { x: W / 2, y: H / 2 + s * 0.52, s, armL: 0.7, armR: 0.7, eyes: 'wide', legs: [8, 4, 4, 8], rot: lerp(-0.2, 0.05, p), yaw: lerp(-0.6, 0.25, p), pitch: 0.35 });
  return { flash: u < 1.5 / 24 ? 1 : 0, vig: 0.15, ca: 1.6, bloom: 0.8 };
}

// ------------------------------------------------------------------ 4. eyes (the long reveal)
function sEyes(ctx, t) {
  const p = seg(t, C.eyes, C.cliff, ease.inOut);
  setLight({ lx: 0.4, ly: -1, rim: '#fff2b0', rimK: 0.35 });
  sunburst(ctx, W / 2, 260, 32, '#ffa514', '#ffd25c', t * 0.12);
  bloom(ctx, W / 2, 240, 800, '#fff3c0', 0.9);
  const s = lerp(1450, 1650, p);
  const k = s / 147;
  const open = t >= C.eyesOpen;
  const blink = open ? 1 - seg(t, C.eyesOpen, C.eyesOpen + 0.12, ease.out) : 1;
  const det = t > C.cliff - 0.75;
  const a = claude(ctx, { x: W / 2 - 40, y: 600 + (144 - 17 - 9) * k, s, eyes: det ? 'determined' : 'open', blink, line: 10, yaw: 0.12, pitch: 0.35 });
  if (open) {
    const gl = seg(t, C.eyesOpen + 0.05, C.eyesOpen + 0.35, ease.out) * (1 - seg(t, C.eyesOpen + 0.6, C.eyesOpen + 1.0));
    glint(ctx, a.eyeR[0] + 48 * k / 10, a.eyeR[1] - 50 * k / 10, 260, gl);
  }
  // wind streaks + motes
  for (let i = 0; i < 9; i++) {
    const x = ((i * 397 + t * 1800) % 2600) - 400, y = 100 + (i * 151) % 880;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 300 + (i % 3) * 120, y - 3); ctx.lineTo(x + 300 + (i % 3) * 120, y + 3); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  motes(ctx, t, 24, 5, '#fff3c0', 0.7);
  return { vig: 0.28, bloom: 0.6 };
}

// ------------------------------------------------------------------ 5. cliff over the codebase land
export function vista(ctx, t, pan = 0, dy = 0) {
  plate(ctx, PL.vistaSky, pan * 0.15 + 120, dy * 0.2);
  plate(ctx, PL.vistaFar, pan * 0.3 + 150, dy * 0.4);
  plate(ctx, PL.vistaMid, pan * 0.55 + 200, dy * 0.7);
  plate(ctx, PL.vistaNear, pan * 0.8 + 260, dy);
}
function sCliff(ctx, t) {
  const p = seg(t, C.cliff, C.dream, ease.inOut);
  setLight({ lx: 1, ly: -1, rim: '#fff4d8', rimK: 0.45 });
  vista(ctx, t, p * 160, 60);
  ctx.save(); ctx.translate(-p * 100, 0);
  ctx.drawImage(PL.vistaLedge, -120, 40);
  ctx.fillStyle = 'rgba(60,40,20,0.4)'; ctx.beginPath(); ctx.ellipse(480, 822, 170, 18, 0, 0, TAU); ctx.fill();
  claude(ctx, { x: 480, y: 824, s: 320, lx: 1, eyes: 'determined', yaw: 0.45, blink: Math.abs(t - (C.cliff + 0.9)) < 0.05 ? 1 : 0 });
  ctx.restore();
  // wind + foreground grass
  for (let i = 0; i < 6; i++) { const x = ((i * 521 + t * 1400) % 2600) - 400, y = 160 + (i * 173) % 600; ctx.fillStyle = rgba('#ffffff', 0.5); ctx.fillRect(x, y, 220 + (i % 3) * 90, 3); }
  ctx.save(); ctx.filter = 'blur(4px)'; ctx.drawImage(PL.fgGrass, -300 - p * 180, H - 240, 2400, 400); ctx.restore();
  glint(ctx, 1655 - p * 110, 640, 90, 0.5 + 0.5 * Math.sin(t * 4));
  return {};
}

// ------------------------------------------------------------------ 6. the dream: empty stadium
export function stadium(ctx, t, { pass = 0, lights = 1, crowd = 0, hero = null, boardFn = null, z = 1, fx = W / 2, fy = 640 } = {}) {
  ctx.save();
  ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-W / 2, -640);
  const g = ctx.createLinearGradient(0, -400, 0, 700); g.addColorStop(0, '#04071c'); g.addColorStop(1, '#1d2a5e');
  ctx.fillStyle = g; ctx.fillRect(-1200, -1200, W + 2400, 2400);
  stars(ctx, 12, 220, t, { w: W + 800, h: 600, x: -400, y: -300, a: 0.8 });
  ctx.drawImage(PL.stadium, -240, 0);
  // crowd (finale): dabs that bounce
  if (crowd > 0) {
    const r = rng(31);
    for (let i = 0; i < 1400; i++) {
      const row = Math.floor(r() * 14), w = 1500 + row * 150, a = Math.PI + (0.04 + r() * 0.92) * Math.PI;
      const x = W / 2 + Math.cos(a) * w / 2 * 0.97, y = 330 + row * 24 + 280 + Math.sin(a) * 280 * 0.97, ph = r() * TAU;
      ctx.globalAlpha = crowd;
      ctx.fillStyle = ['#f7d36b', '#ff8a7a', '#9fd0ff', '#ffffff', '#b8f0a0', '#e7b8ff'][i % 6];
      const j = Math.max(0, Math.sin(t * 10 + ph)) * 7 * crowd;
      ctx.beginPath(); ctx.ellipse(x, y - 8 - j, 5, 7, 0, 0, TAU); ctx.fill();
      if (i % 7 === 0) { ctx.fillRect(x - 1, y - 30 - j, 2, 16); ctx.fillStyle = ['#ff5a5a', '#5ab0ff', '#ffe05a'][i % 3]; ctx.fillRect(x + 1, y - 30 - j, 14, 9); }
    }
    ctx.globalAlpha = 1;
  }
  // scoreboard (cel prop) above the far stand
  scoreboard(ctx, W / 2, 250, 560, 250, (c, r) => (boardFn ? boardFn(c, r) : boardContent(c, r, pass)));
  bloom(ctx, W / 2, 250, 420, pass >= 1 ? '#7dffa0' : '#ff4040', 0.25);
  // light towers + volumetric cones
  for (const sx of [-1, 1]) {
    const x = W / 2 + sx * 900;
    ctx.fillStyle = '#2a3456'; ctx.fillRect(x - 14, 40, 28, 560);
    for (let k = 0; k < 10; k++) { ctx.strokeStyle = '#3d4a78'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, 60 + k * 52); ctx.lineTo(x + 14, 86 + k * 52); ctx.stroke(); }
    ctx.fillStyle = lights ? '#fffbe0' : '#6a7390'; ctx.fillRect(x - 80, 20, 160, 56);
    ctx.fillStyle = '#c8b870'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 76 + k * 40, 24, 32, 48);
    ctx.fillStyle = lights ? '#ffffff' : '#7a8098'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 72 + k * 40, 28, 24, 40);
    if (lights) {
      bloom(ctx, x, 48, 320, '#fff6c8', 0.9);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(10px)';
      const cg = ctx.createLinearGradient(x, 70, W / 2, 900);
      cg.addColorStop(0, rgba('#fff5c8', 0.5)); cg.addColorStop(1, rgba('#fff5c8', 0.1));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(x - 40, 60); ctx.lineTo(x + 40, 60); ctx.lineTo(W / 2 - sx * 40 + 200, 980); ctx.lineTo(W / 2 - sx * 40 - 200, 980); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if (lights) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(8px)'; ctx.fillStyle = rgba('#fff3c0', 0.4); ctx.beginPath(); ctx.ellipse(W / 2, 905, 260, 70, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (hero) hero(ctx);
  ctx.restore();
}
function sDream(ctx, t) {
  setLight({ lx: 0.3, ly: -1, rim: '#fff5c8', rimK: 0.6 });
  const z = lerp(1, 1.22, seg(t, C.dream, C.board, ease.inOut));
  stadium(ctx, t, {
    pass: 0, z, fy: 720,
    hero: c => {
      c.fillStyle = rgba('#000000', 0.4); c.beginPath(); c.ellipse(W / 2, 902, 50, 9, 0, 0, TAU); c.fill();
      claude(c, { x: W / 2, y: 900, s: 64, ly: -1, line: 2.6, yaw: 0.2 });
    },
  });
  motes(ctx, t, 30, 8, '#fff6d0', 0.5);
  return { vig: 0.45, tint: [0.8, 0.85, 1.1], tintAmt: 0.12, bloom: 0.7 };
}

// ------------------------------------------------------------------ 7. the board, close
function sBoard(ctx, t) {
  const p = seg(t, C.board, C.parade, ease.inOut);
  setLight({ lx: 0, ly: -1, rim: '#ff5a4a', rimK: 0.7 });
  ctx.fillStyle = '#05071a'; full(ctx);
  stars(ctx, 13, 120, t, { a: 0.6 });
  ctx.save();
  const z = lerp(1, 1.06, p);
  ctx.translate(W / 2, 470); ctx.scale(z, z); ctx.translate(-W / 2, -470);
  scoreboard(ctx, W / 2, 440, 1440, 680, (c, r) => boardContent(c, r, 0));
  ctx.restore();
  bloom(ctx, W / 2, 440, 1000, '#ff3b3b', 0.22);
  claude(ctx, { x: 1530, y: 1130, s: 330, eyes: 'none', sil: 0.82, silColor: '#1a0c14', rot: -0.05, line: 3, yaw: -0.3, pitch: 0.4 });
  return { vig: 0.45, bloom: 0.8 };
}

export const act1 = [
  { name: 'cosmos', start: C.cosmos, end: C.boot, draw: sCosmos },
  { name: 'boot', start: C.boot, end: C.burst, draw: sBoot },
  { name: 'burst', start: C.burst, end: C.eyes, draw: sBurst },
  { name: 'eyes', start: C.eyes, end: C.cliff, draw: sEyes },
  { name: 'cliff', start: C.cliff, end: C.dream, draw: sCliff },
  { name: 'dream', start: C.dream, end: C.board, draw: sDream },
  { name: 'board', start: C.board, end: C.parade, draw: sBoard },
];
