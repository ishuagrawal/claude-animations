// One continuous take, like the reference: a floating window on a blurred gradient stage. The
// camera (zoom + focus point over the 1920×1080 rest frame) pushes in on whatever the cursor is
// doing, with depth of field (sharp layer masked around the focus over a blurred copy) and motion
// blur on scrolls and camera moves. Inside the window a milestone page scrolls hero → feature →
// stats → thank-you while a live cursor clicks, types and toggles.
import { W, H, key, clamp, lerp } from './core.js';
import { C, STARS } from './timeline.js';
import { PANEL, NAV_H, SEC, scrollAt, toRest, STAR_BTN, TERM_INPUT, COPY_BTN, cellRect, pipeRow } from './layout.js';
import { smooth, eio } from './kit.js';
import { stage, windowBack, windowFront } from './stage.js';
import { cursor, ripple } from './ui.js';
import { octocat } from './actors.js';
import * as intro from './sections/intro.js';
import * as hero from './sections/hero.js';
import * as feature from './sections/feature.js';
import * as stats from './sections/stats.js';
import * as cta from './sections/cta.js';

// ---------------------------------------------------------------- camera: [t, zoom, focusX, focusY]
const CAM = [
  [0, 1, 960, 540], [C.click - 0.3, 1, 960, 540],
  [C.alive + 0.1, 1.1, 960, 522],
  [C.openEnd + 0.15, 1, 960, 540],
  [C.push1, 1, 960, 540], [C.scroll1 - 0.05, 1.2, 760, 560],
  [C.scroll1 + 0.85, 1, 960, 540],
  [C.push2, 1, 960, 540], [C.type + 0.2, 1.34, 1090, 400],
  [C.out3, 1.36, 1150, 410], [C.out4 + 0.1, 1.3, 1290, 520],
  [C.doneRender - 0.2, 1.3, 1170, 640], [C.scroll2, 1.3, 1160, 650],
  [C.scroll2 + 0.85, 1, 960, 540],
  [C.grid0 + 0.1, 1, 960, 540], [C.tip + 0.25, 1.24, 720, 640], [C.scroll3, 1.25, 730, 640],
  [C.scroll3 + 0.85, 1, 960, 540],
  [C.copy - 0.5, 1.07, 960, 600], [C.pullOut, 1.08, 960, 596],
  [C.pullOut + 1.7, 0.8, 960, 560], [C.end, 0.78, 960, 560],
];
export function camAt(t) { const [z, x, y] = key(t, CAM.map(([tt, ...v]) => [tt, v])); return { z, x, y }; }
const toScreen = (cam, [x, y]) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];

// ---------------------------------------------------------------- depth of field: [t, amount, focusX, focusY]
const DOF = [
  [0, 0, 960, 540], [C.push1, 0, 760, 560], [C.push1 + 0.8, 0.45, 700, 560], [C.scroll1, 0.45, 700, 560], [C.scroll1 + 0.3, 0, 960, 540],
  [C.push2, 0, 1100, 400], [C.type, 1, 1090, 380], [C.out3, 1, 1140, 400], [C.out4 + 0.1, 1, 1300, 560],
  [C.doneRender - 0.2, 1, 1170, 660], [C.scroll2, 1, 1170, 660], [C.scroll2 + 0.3, 0, 960, 540],
  [C.grid0 + 0.1, 0, 760, 640], [C.tip + 0.2, 0.8, 690, 660], [C.scroll3, 0.8, 690, 660], [C.scroll3 + 0.3, 0, 960, 540],
];
const dofAt = t => key(t, DOF.map(([tt, ...v]) => [tt, v]));

// ---------------------------------------------------------------- cursor: [t, x, y] (rest coords)
let CUR = null;
function cursorPath() {
  if (CUR) return CUR;
  const star = toRest(STAR_BTN.x + 46, STAR_BTN.y + 31, C.star);
  const term = toRest(TERM_INPUT.x + 250, SEC.feature + TERM_INPUT.y - 7, C.type);
  const tg = pipeRow(3), tog = toRest(tg.tx + 34, SEC.feature + tg.y + 13, C.out4);
  const cr = cellRect(STARS - 1), cell = toRest(cr.x + cr.w * 0.62, SEC.stats + cr.y + cr.h * 0.62, C.tip);
  const cp = toRest(COPY_BTN.x + COPY_BTN.w * 0.55, SEC.cta + COPY_BTN.y + COPY_BTN.h * 0.6, C.copy);
  CUR = [
    [0, 1640, 1040], [C.cursorIn, 1640, 1040], [C.click - 0.08, 1022, 590], [C.click + 0.5, 1026, 596],
    [C.alive + 0.8, 1330, 905], [C.toStar, 1290, 880], [C.star - 0.1, ...star], [C.star + 0.5, star[0] + 8, star[1] + 6],
    [C.scroll1 + 0.4, star[0] + 60, star[1] - 40], [C.toTerm, 760, 560], [C.toTerm + 0.65, ...term], [C.enter + 0.25, term[0] + 4, term[1]],
    [C.enter + 0.9, tog[0] - 70, tog[1] - 120], [C.out4 - 0.12, ...tog], [C.out4 + 0.4, tog[0] + 6, tog[1] + 5],
    [C.scroll2 + 0.2, tog[0] - 40, tog[1] + 60], [C.tip - 0.35, ...cell], [C.tip + 0.5, cell[0] + 4, cell[1] + 3],
    [C.scroll3 + 0.5, cell[0] + 120, cell[1] + 80], [C.copy - 0.1, ...cp], [C.copy + 0.5, cp[0] + 6, cp[1] + 6],
    [C.pullOut + 0.8, cp[0] + 260, cp[1] + 260],
  ];
  return CUR;
}
const CLICKS = [C.click, C.star, C.out4, C.copy];
function cursorAt(t) {
  const P = cursorPath();
  let i = 0;
  while (i < P.length - 1 && t > P[i + 1][0]) i++;
  const a = P[i], b = P[Math.min(i + 1, P.length - 1)];
  const u = b[0] > a[0] ? eio((t - a[0]) / (b[0] - a[0])) : 1;
  // gentle arc on longer moves (hand motion is never a straight line)
  const dx = b[1] - a[1], dy = b[2] - a[2], arc = Math.sin(Math.PI * u) * Math.min(60, Math.hypot(dx, dy) * 0.08);
  const L = Math.hypot(dx, dy) || 1;
  return [lerp(a[1], b[1], u) - dy / L * arc, lerp(a[2], b[2], u) + dx / L * arc];
}

// ---------------------------------------------------------------- layers
let L = null, Lc = null, S = null, Sc = null;
function layers(base) {
  if (!L) {
    L = document.createElement('canvas'); L.width = base.width; L.height = base.height; Lc = L.getContext('2d');
    S = document.createElement('canvas'); S.width = Math.ceil(base.width / 4); S.height = Math.ceil(base.height / 4); Sc = S.getContext('2d');
  }
}

function drawWindow(ctx, t, cam) {
  const R = intro.panelRect(t), ik = intro.iconK(t), sc = scrollAt(t);
  const pageA = smooth((t - C.open - 0.25) / 0.6);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  windowBack(ctx, R, ik);
  // ---- the page, clipped to the window
  ctx.save();
  ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, R.r); ctx.clip();
  intro.drawMarkBack(ctx, t);
  if (pageA > 0) {
    ctx.save();
    ctx.globalAlpha = pageA;
    ctx.translate(PANEL.x, PANEL.y - sc);
    if (sc < SEC.feature + 10) hero.drawBack(ctx, t);
    if (sc > 10 && sc < SEC.stats + 10) feature.draw(ctx, t, SEC.feature);
    if (sc > SEC.feature + 10 && sc < SEC.cta + 10) stats.draw(ctx, t, SEC.stats);
    if (sc > SEC.stats + 10) cta.draw(ctx, t, SEC.cta);
    ctx.restore();
  }
  // ---- the Octocat (unclipped while it climbs out of the icon)
  const open = t >= C.openEnd;
  if (!open) ctx.restore();
  intro.setCursor(cursorAt(t));
  if (t >= C.click && sc < SEC.feature) {
    const p = intro.octoPose(t), lit = smooth((t - C.click) / 0.45);
    ctx.save();
    intro.markClip(ctx, t);
    ctx.globalAlpha *= lit;
    octocat(ctx, p.x, p.y, p.s, p.o);
    ctx.restore();
  }
  intro.drawMarkFront(ctx, t);
  if (open && pageA > 0) {
    ctx.save(); ctx.globalAlpha = pageA; ctx.translate(PANEL.x, PANEL.y - sc);
    if (sc < SEC.feature) hero.drawFront(ctx, t);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = pageA; ctx.translate(PANEL.x, PANEL.y);
    hero.drawNav(ctx, t, clamp(sc / 200));
    ctx.restore();
  }
  if (open) ctx.restore();
  windowFront(ctx, R, ik);
  intro.drawLabel(ctx, t);
  // ---- cursor + click ripples
  const ca = smooth((t - C.cursorIn) / 0.3) * (1 - smooth((t - C.pullOut - 0.3) / 0.4));
  const [cx, cy] = cursorAt(t);
  for (const tc of CLICKS) ripple(ctx, cx, cy, t - tc);
  const press = Math.max(0, ...CLICKS.map(tc => 1 - Math.abs(t - tc) / 0.08));
  const beam = t > C.toTerm + 0.45 && t < C.enter + 0.35;
  cursor(ctx, cx, cy, { kind: beam ? 'beam' : 'arrow', press, a: ca });
  ctx.restore();
  // after the window: the repo caption on the stage
  cta.drawCaption(ctx, t, cam);
}

export const film = {
  duration: C.end,
  render: { supersample: 1.25 },
  // motion blur where the page moves fast on screen (scrolls, camera moves, the window opening)
  blurAt(t) {
    const d = 1 / 120;
    const pts = [[PANEL.x + 200, PANEL.y + 200], [PANEL.x + PANEL.w - 200, PANEL.y + PANEL.h - 200]];
    let v = 0;
    const a = camAt(t - d), b = camAt(t + d), sa = scrollAt(t - d), sb = scrollAt(t + d);
    for (const [x, y] of pts) {
      const p = toScreen(a, [x, y - sa]), q = toScreen(b, [x, y - sb]);
      v = Math.max(v, Math.hypot(q[0] - p[0], q[1] - p[1]));
    }
    if (t > C.open && t < C.openEnd + 0.2) { const r0 = intro.panelRect(t - d), r1 = intro.panelRect(t + d); v = Math.max(v, Math.abs(r1.w - r0.w) / 2); }
    // v = px moved per 1/60 s; a 0.5 shutter smears v/2 → enough subframes to keep steps ≤ 5 px
    return Math.min(14, Math.max(1, Math.ceil(v * 0.5 / 5)));
  },
  async load() {
    await Promise.all(['400 40px "Mona Sans"', '500 40px "Mona Sans"', '600 40px "Mona Sans"', '700 40px "Mona Sans"',
      '400 40px "Monaspace Neon"', '500 40px "Monaspace Neon"', '600 40px "Monaspace Neon"'].map(f => document.fonts.load(f)));
  },
  draw(ctx, t) {
    const cam = camAt(t);
    const gold = Math.max(0, 1 - Math.abs(t - C.star - 0.5) / 1.5) * smooth((t - C.star) / 0.2);
    const green = smooth((t - C.grid0) / 1) * (1 - smooth((t - C.scroll3) / 1));
    stage(ctx, t, cam, { gold, green });
    const [amt, fx, fy] = dofAt(t);
    if (amt < 0.02) drawWindow(ctx, t, cam);
    else {
      layers(ctx.canvas);
      const m = ctx.getTransform();
      Lc.setTransform(1, 0, 0, 1, 0, 0); Lc.globalCompositeOperation = 'source-over'; Lc.globalAlpha = 1;
      Lc.clearRect(0, 0, L.width, L.height);
      Lc.setTransform(m);
      drawWindow(Lc, t, cam);
      // blurred copy (quarter res)
      Sc.setTransform(1, 0, 0, 1, 0, 0); Sc.clearRect(0, 0, S.width, S.height);
      Sc.filter = `blur(${(amt * 10 * m.a / 4).toFixed(2)}px)`;
      Sc.drawImage(L, 0, 0, S.width, S.height);
      Sc.filter = 'none';
      // keep the sharp layer only around the focus
      const [sx, sy] = toScreen(cam, [fx, fy]);
      Lc.setTransform(m);
      Lc.globalCompositeOperation = 'destination-in';
      Lc.save(); Lc.translate(sx, sy); Lc.scale(1.25, 1);
      const g = Lc.createRadialGradient(0, 0, 180, 0, 0, 780);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      Lc.fillStyle = g; Lc.fillRect(-3000, -3000, 6000, 6000);
      Lc.restore();
      Lc.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(S, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(L, 0, 0);
      ctx.restore();
    }
    // fade in from black at the top, out at the end
    const f = Math.max(1 - smooth(t / 0.3), smooth((t - C.fadeOut) / (C.end - C.fadeOut)));
    if (f > 0) { ctx.fillStyle = `rgba(4,5,8,${f})`; ctx.fillRect(0, 0, W, H); }
    return { vig: 0.28, grain: 0.018, contrast: 1.03, saturation: 1.05 };
  },
};
export { NAV_H };
