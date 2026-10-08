// ③ ANIMATE — the storyboard sketch becomes a canvas: Claude types code, clean ink lines draw over
// the pencil, the STYLE jar pours the colors in, the shot comes alive, then it becomes a contact
// sheet that Claude reviews (finds a cropped kite, fixes it, everything gets a check).
import { P, rgba, mix } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, rng } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { drawRetro, retroStill } from '../retro.js';
import { caption, badge, setFont, MONO } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { KITE_T, PENCIL, jarFull, JAR } from './imagine.js';

export const CV = { x: 1215, y: 560, w: 1180, h: 664 };
const CODE = { x: 300, y: 470, w: 400, h: 430 };
const CL = { x: 300, y: 1015, s: 220 };
const G = { cols: 4, rows: 3, tw: 266, th: 150, gap: 22 };
const FLAW = 6;
export const GRID = G;

function thumbRect(i) {
  const gw = G.cols * G.tw + (G.cols - 1) * G.gap, gh = G.rows * G.th + (G.rows - 1) * G.gap;
  const c = i % G.cols, r = Math.floor(i / G.cols);
  return { x: CV.x - gw / 2 + c * (G.tw + G.gap) + G.tw / 2, y: CV.y - gh / 2 + r * (G.th + G.gap) + G.th / 2 };
}
const VIEWS = [null, [150, 330, 800, 450], [760, 40, 800, 450], null, [300, 420, 700, 394], null, null, [820, 120, 720, 405], [100, 300, 900, 506], null, [600, 200, 800, 450], null];
export function thumbImg(i, fixed = true) {
  let view = VIEWS[i];
  if (i === FLAW) view = fixed ? [560, 90, 1000, 562] : [560, 268, 1000, 562]; // kite cropped off the top when flawed
  return retroStill('kite', 0.3 + i * 0.37, G.tw * 2, G.th * 2, view ? { view } : {});
}
export { thumbRect };

function codeCard(ctx, t, a) {
  if (a <= 0) return;
  const { x, y, w, h } = CODE;
  ctx.save(); ctx.translate(x, y); ctx.scale(a, a);
  ctx.fillStyle = rgba('#000000', 0.2); ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 14, w, h, 26); ctx.fill();
  ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.fill();
  ctx.fillStyle = P.navyLt; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, 58, [26, 26, 0, 0]); ctx.fill();
  [P.rose, P.butter, P.mint].forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-w / 2 + 30 + k * 26, -h / 2 + 29, 8, 0, TAU); ctx.fill(); });
  setFont(ctx, 22, 700, MONO); ctx.fillStyle = P.lilac; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('film.js  </>', w / 2 - 22, -h / 2 + 30);
  // typed lines (syntax-colored placeholder bars, like the reference's UI text)
  const r = rng(5), L = 11, cps = 4.2;
  const typedN = (t - C.code) * cps;
  let cursor = null;
  for (let i = 0; i < L; i++) {
    const ind = [0, 1, 2, 2, 1, 2, 3, 3, 2, 1, 0][i];
    const segs = []; let n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) segs.push({ w: 30 + r() * 70, c: [P.rose, P.butter, P.sky, P.mint, P.lilac][Math.floor(r() * 5)] });
    const prog = clamp(typedN - i);
    if (prog <= 0) break;
    let xx = -w / 2 + 34 + ind * 26, yy = -h / 2 + 92 + i * 30;
    const total = segs.reduce((s2, g) => s2 + g.w + 10, 0);
    let budget = total * prog;
    for (const g of segs) {
      const ww = Math.min(g.w, budget); if (ww <= 0) break;
      ctx.fillStyle = g.c; ctx.beginPath(); ctx.roundRect(xx, yy - 6, ww, 12, 6); ctx.fill();
      xx += g.w + 10; budget -= g.w + 10;
    }
    cursor = [Math.min(xx, -w / 2 + 34 + ind * 26 + total * prog), yy];
  }
  if (cursor && Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = P.white; ctx.fillRect(cursor[0] + 2, cursor[1] - 11, 4, 22); }
  ctx.restore();
}

function keyboard(ctx, x, y, s, t, typing) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.roundRect(-150, -24, 300, 64, 14); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-150, -34, 300, 62, 14); ctx.fill();
  for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 10; c++) {
    const lit = typing && Math.floor(t * 12 + c * 3 + r2 * 7) % 17 === 0;
    ctx.fillStyle = lit ? P.butter : P.ui;
    ctx.beginPath(); ctx.roundRect(-138 + c * 27.5, -26 + r2 * 17, 22, 12, 3); ctx.fill();
  }
  ctx.restore();
}

function checkMark(ctx, x, y, r, p, col = P.mint) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(ease.outBack(clamp(p * 2), 2.5), ease.outBack(clamp(p * 2), 2.5));
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const q = clamp(p * 2 - 0.6);
  ctx.beginPath(); ctx.moveTo(-r * 0.42, 0); ctx.lineTo(-r * 0.1, r * 0.32); if (q > 0.4) ctx.lineTo(-r * 0.1 + r * 0.55 * clamp((q - 0.4) / 0.6), r * 0.32 - r * 0.62 * clamp((q - 0.4) / 0.6)); ctx.stroke();
  ctx.restore();
}

function draw(ctx, t) {
  // camera: from the storyboard sketch (full screen) back to the canvas
  const pb = seg(t, C.animate, C.animate + 0.9, ease.inOut);
  const z = Math.exp(lerp(Math.log(1920 / CV.w), 0, pb));
  const cx = lerp(CV.x, 960, pb), cy = lerp(CV.y, 540, pb);
  ctx.fillStyle = P.cobalt; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-cx, -cy);
  fieldShapes(ctx, t, P.cobalt, { seed: 21, n: 5, k: 0.06 });
  confetti(ctx, t, { seed: 55, n: 22, size: 1.2, colors: [P.butter, P.sky, P.rose, P.white], area: [-40, 200, 2000, 900], avoid: [100, 200, 1760, 760], t0: C.animate + 0.5, alpha: 0.8 });

  // ---------------- the canvas → contact sheet
  const toGrid = seg(t, C.grid, C.grid + 0.7, ease.inOut);
  const tr5 = thumbRect(5);
  const cvx = lerp(CV.x, tr5.x, toGrid), cvy = lerp(CV.y, tr5.y, toGrid), cvw = lerp(CV.w, G.tw, toGrid), cvh = lerp(CV.h, G.th, toGrid);
  // other thumbnails pop in around it
  if (toGrid > 0) {
    const fixP = clamp((t - C.fix) / 0.35);
    for (let i = 0; i < 12; i++) {
      if (i === 5) continue;
      const d = Math.hypot(i % 4 - 1, Math.floor(i / 4) - 1);
      const p = ease.outBack(clamp((t - C.grid - 0.25 - d * 0.08) / 0.35), 1.8);
      if (p <= 0) continue;
      const r = thumbRect(i);
      ctx.save(); ctx.translate(r.x, r.y); ctx.scale(p, p);
      ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.roundRect(-G.tw / 2 + 6, -G.th / 2 + 9, G.tw, G.th, 10); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(-G.tw / 2, -G.th / 2, G.tw, G.th, 10); ctx.clip();
      if (i === FLAW && fixP > 0 && fixP < 1) {
        ctx.drawImage(thumbImg(i, false), -G.tw / 2, -G.th / 2, G.tw, G.th);
        ctx.beginPath(); ctx.rect(-G.tw / 2, -G.th / 2, G.tw * ease.inOut(fixP), G.th); ctx.clip();
        ctx.drawImage(thumbImg(i, true), -G.tw / 2, -G.th / 2, G.tw, G.th);
        ctx.restore();
        ctx.fillStyle = P.white; ctx.fillRect(-G.tw / 2 + G.tw * ease.inOut(fixP) - 3, -G.th / 2, 6, G.th);
      } else {
        ctx.drawImage(thumbImg(i, i !== FLAW || t >= C.fix), -G.tw / 2, -G.th / 2, G.tw, G.th);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  // the main canvas (white card)
  ctx.save();
  ctx.fillStyle = rgba('#000000', 0.2); ctx.beginPath(); ctx.roundRect(cvx - cvw / 2 + 12 * (1 - toGrid) + 6, cvy - cvh / 2 + 18 * (1 - toGrid) + 9, cvw, cvh, lerp(18, 10, toGrid) * pb); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cvx - cvw / 2, cvy - cvh / 2, cvw, cvh, lerp(18, 10, toGrid) * pb); ctx.clip();
  const inkP = seg(t, C.lines, C.fill - 0.25, ease.inOut);
  const fillP = seg(t, C.fill, C.alive - 0.1, ease.lin);
  const live = KITE_T + Math.max(0, t - C.alive);
  if (toGrid < 0.5 || fillP < 1) {
    // paper + pencil rough (fades as the ink goes down) + flood fills + ink lines (fade once colored)
    if (fillP < 1) {
      ctx.fillStyle = P.white; ctx.fillRect(cvx - cvw / 2, cvy - cvh / 2, cvw, cvh);
      drawRetro(ctx, cvx - cvw / 2, cvy - cvh / 2, cvw, cvh, KITE_T, 'kite', { line: 1, fill: 0, lineColor: PENCIL, lineW: 6, grain: 0, paper: null, lineAlpha: 1 - 0.75 * inkP });
    }
    drawRetro(ctx, cvx - cvw / 2, cvy - cvh / 2, cvw, cvh, live, 'kite', { line: inkP, fill: fillP, lineColor: P.line, lineW: 4.2, paper: null, lineAlpha: 1 - seg(t, C.alive - 0.4, C.alive + 0.1) });
  } else {
    ctx.drawImage(thumbImg(5), cvx - cvw / 2, cvy - cvh / 2, cvw, cvh);
  }
  ctx.restore();
  // play badge when it comes alive
  const pl = ease.outBack(clamp((t - C.alive) / 0.35), 2) * (1 - clamp((t - C.grid) / 0.25));
  if (pl > 0) {
    ctx.save(); ctx.translate(CV.x - CV.w / 2 + 70, CV.y - CV.h / 2 + 60); ctx.scale(pl, pl);
    ctx.fillStyle = P.rose; ctx.beginPath(); ctx.roundRect(-44, -26, 120, 52, 26); ctx.fill();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(-22, -12); ctx.lineTo(-2, 0); ctx.lineTo(-22, 12); ctx.fill();
    setFont(ctx, 24, 800); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('play', 6, 2);
    ctx.restore();
  }

  // ---------------- the STYLE jar flies in and pours its colors into the canvas
  const jIn = seg(t, C.fill - 0.75, C.fill - 0.25, ease.out), jOut = seg(t, C.alive - 0.1, C.alive + 0.35, ease.in);
  if (jIn > 0 && jOut < 1) {
    const tilt = -lerp(0, 2.15, seg(t, C.fill - 0.35, C.fill, ease.inOut)) * (1 - jOut);
    const jx = lerp(2150, CV.x + CV.w / 2 - 60, jIn) + jOut * 300, jy = lerp(1300, CV.y - CV.h / 2 - 20, jIn) - jOut * 500;
    // stream of colored stripes from the mouth down into the canvas
    const pourA = clamp((t - C.fill) / 0.15) * (1 - clamp((t - C.alive + 0.4) / 0.2));
    if (pourA > 0) {
      const mx = jx + Math.sin(tilt) * JAR.h * 0.42 * 0.55, my = jy - Math.cos(tilt) * JAR.h * 0.42 * 0.55;
      const cols = [P.rMustard, P.rOrange, P.rRust, P.rTeal, P.rMint];
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = cols[k]; ctx.lineWidth = 16 * pourA; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = 0; j <= 20; j++) { const u = j / 20; const xx = mx - 40 - u * 260 + (k - 2) * 12 + Math.sin(u * 9 + t * 14 + k) * 8, yy = my + 10 + u * u * 300 + (k - 2) * 4; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      }
    }
    jarFull(ctx, t, jx, jy + JAR.h * 0.42 * 0.55, 0.55, tilt);
  }

  // ---------------- code card + Claude typing
  const ccIn = ease.outBack(clamp((t - C.animate - 0.5) / 0.45), 1.5) * (1 - seg(t, C.grid - 0.1, C.grid + 0.3, ease.inBack));
  codeCard(ctx, t, ccIn);
  const typing = t > C.code && t < C.fill;
  const step = hop(t, C.grid + 0.15, 0.4, 70), jmp = hop(t, C.checks + 0.2, 0.4, 110);
  const clIn = ease.outBack(clamp((t - C.animate - 0.6) / 0.5), 1.4);
  const clX = lerp(CL.x, 430, seg(t, C.grid + 0.15, C.grid + 0.55, ease.inOut));
  let eyes = typing ? 'squint' : 'open', lx = 1, ly = -0.3, blush = 0;
  if (t > C.fill && t < C.alive + 0.4) { eyes = 'sparkle'; ly = -0.6; blush = 0.5; }
  else if (t > C.alive + 0.4 && t < C.flaw) { eyes = 'open'; ly = -0.5; }
  else if (t > C.flaw && t < C.fix) { eyes = 'worried'; ly = -0.5; }
  else if (t >= C.fix) { eyes = 'happy'; blush = 0.7; }
  const tapL = typing ? Math.max(0, Math.sin(t * 22)) * 0.25 : 0, tapR = typing ? Math.max(0, Math.sin(t * 22 + 2)) * 0.25 : 0;
  sprayAt(ctx, P.cobaltDk, clX, CL.y + 6, 150, 22, 0.9);
  claude(ctx, { x: clX, y: CL.y + (1 - clIn) * 400 + step.y + jmp.y, s: CL.s, sx: step.sx * jmp.sx, sy: step.sy * jmp.sy, armL: typing ? 0.1 - tapL : (t >= C.fix ? 1.1 : 0.2), armR: typing ? 0.1 - tapR : (t >= C.fix ? 1.1 : 0.25), eyes, lx, ly, blush, blink: blinkAt(t, [C.animate + 1.6, C.loupe + 1.0]) });
  const kb = (1 - seg(t, C.fill - 0.2, C.fill + 0.2, ease.inBack));
  if (kb > 0 && clIn > 0) keyboard(ctx, CL.x, CL.y - 70 + (1 - clIn) * 400, 0.85 * kb, t, typing);

  // ---------------- review: loupe scans, flags the cropped kite, fix, checks ripple
  if (t > C.loupe - 0.1 && t < C.splash3 + 0.5) {
    const path = [thumbRect(0), thumbRect(1), thumbRect(2), thumbRect(5), thumbRect(FLAW)];
    const u = clamp((t - C.loupe) / (C.flaw - C.loupe));
    const seg2 = u * (path.length - 1), i0 = Math.min(path.length - 2, Math.floor(seg2)), f = ease.inOut(seg2 - i0);
    let lx2 = lerp(path[i0].x, path[i0 + 1].x, f), ly2 = lerp(path[i0].y, path[i0 + 1].y, f);
    const away = seg(t, C.checks - 0.1, C.checks + 0.3, ease.inBack);
    const la = ease.outBack(clamp((t - C.loupe + 0.1) / 0.3), 2) * (1 - away);
    if (la > 0) {
      ctx.save(); ctx.translate(lx2 + 40, ly2 + 30); ctx.scale(la, la);
      ctx.strokeStyle = P.butter; ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(62, 62); ctx.lineTo(120, 120); ctx.stroke();
      ctx.fillStyle = rgba(P.sky, 0.25); ctx.beginPath(); ctx.arc(0, 0, 80, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.white; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 80, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 58, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.restore();
    }
    // flag on the flawed thumb
    const fr = thumbRect(FLAW);
    const fl = ease.outBack(clamp((t - C.flaw) / 0.3), 2.5);
    if (fl > 0 && t < C.fix + 0.2) {
      ctx.save(); ctx.translate(fr.x + G.tw / 2 - 10, fr.y - G.th / 2 + 10); ctx.scale(fl, fl); ctx.rotate(Math.sin(t * 20) * 0.1 * (t < C.fix ? 1 : 0));
      ctx.fillStyle = P.rose; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
      setFont(ctx, 38, 900); ctx.fillStyle = P.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 2);
      ctx.restore();
      ctx.strokeStyle = P.rose; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(fr.x - G.tw / 2 - 5, fr.y - G.th / 2 - 5, G.tw + 10, G.th + 10, 13); ctx.globalAlpha = fl * (1 - clamp((t - C.fix) / 0.3)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 12; i++) {
      const r = thumbRect(i), d = Math.hypot(i % 4 - 2, Math.floor(i / 4) - 1);
      const p = i === FLAW ? clamp((t - C.fix - 0.3) / 0.4) : clamp((t - C.checks - d * 0.07) / 0.4);
      checkMark(ctx, r.x + G.tw / 2 - 10, r.y - G.th / 2 + 10, 22, p);
    }
  }
  ctx.restore();

  badge(ctx, t, 3, 160, 150, 46, C.badge3, { t1: C.splash3 + 0.2, bg: P.butter });
  caption(ctx, t, { text: 'Animates it in code', x: 232, y: 176, t0: C.cap3a, t1: C.cap3aOut, size: 74, color: P.white, hl: ['code'], hlColor: P.butter });
  caption(ctx, t, { text: '…and checks its work', x: 232, y: 176, t0: C.cap3b, t1: C.splash3 + 0.2, size: 74, color: P.white, hl: ['checks'], hlColor: P.butter });
  return { vig: 0, grain: 0 };
}

export const animate = [{ name: 'animate', start: C.animate, end: C.score, draw }];
