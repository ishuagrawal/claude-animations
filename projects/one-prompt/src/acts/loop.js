import { K, CODE, label, clamp, lerp, ease, lg, rgba } from '../ink.js';
import { streaks } from './loop_kit.js';
import { drawRun, T, view, speed } from './loop_run.js';
import { arena, arenaLabels, A0, A1 } from './loop_arena.js';
import { drawWeb, W, webSpeed } from './loop_web.js';
import { drawGold, GO, goldSpeed } from './loop_gold.js';
import { drawBrass, G, brassSpeed } from './loop_brass.js';
import { C } from '../timeline.js';
import { FPS } from '../core.js';
const LB = [
  ['File contents', 'need', 960, 96, T.rip + 0.02, T.m1 + 0.02], ['Command output', 'need', 590, 96, T.clunk + 0.04, T.m2 + 0.04],
  ['Web lookups', 'need', 960, 96, W.a - 0.02, W.s1 + 0.12], ['Connected tools', 'choice', 960, 96, W.grab + 0.04, W.tag1 + 0.1],
  ['Which tools ran', 'extra', 960, 96, G.b1 - 0.06, G.grab - 0.16], ['How long they took', 'extra', 1425, 150, G.grab + 0.02, G.slip + 0.2], ['Approvals & refusals', 'extra', 420, 120, G.ped + 0.1, G.com + 0.05, 64],
];
let buf = null; const layer = (x, fn, a) => { if (a <= 0) return; if (a >= 1) return fn(x); buf ??= new OffscreenCanvas(x.canvas.width, x.canvas.height); const g = buf.getContext('2d'); g.setTransform(x.getTransform()); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.save(); fn(g); g.restore(); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = a; x.drawImage(buf, 0, 0); x.restore(); };
export function draw(x, t0) {
  const fc = Math.round(t0 * FPS) / FPS, t = fc + (t0 - fc) * 0.55; // a crisper shutter: heroes stay readable at these speeds
  const a = clamp((t - A0 + 0.05) / 0.16) * (1 - clamp((t - A1 + 0.12) / 0.14));
  const wb = clamp((t - W.in) / 0.14);
  if (t < W.in + 0.16 && a < 1) drawRun(x, t); if (t > W.in && t < W.end) layer(x, g => drawWeb(g, t), wb);
  if (t > GO.in && t < GO.end) layer(x, g => drawGold(g, t), clamp((t - GO.in) / 0.12)); if (t > G.in) layer(x, g => drawBrass(g, t), clamp((t - G.in) / 0.18));
  layer(x, g => arena(g, fc + (t - fc) * 0.6), a); if (a > 0.5) arenaLabels(x, t);
  LB.forEach(([s, c, px, py, t0, t1, size]) => label(x, s, px, py, size || 74, t, t0, t1, c));
  const rush = 1 - ease.out2(clamp((t - C.d1 + 0.3) / 0.75)); if (rush > 0) { streaks(x, t, -1, rush, { n: 60, sp: 8000, c: '#c9f6ff', a: 0.7, w: 4 }); x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = lg(x, 0, 0, 1920, 0, [rgba('#c9f6ff', 0.6 * rush), rgba('#c9f6ff', 0.92 * rush), rgba('#dcfaff', rush)]); x.fillRect(0, 0, 1920, 1080); x.restore(); }
  const br = clamp((t - G.in) / 0.3) * (1 - clamp((t - G.tail) / 0.2));
  return { bloom: 0.28, vig: 0.26, grain: 0.03, sat: 1.04 + br * 0.1, con: 1.03 + br * 0.02 };
}
export function samples(t, n) { const v = t > G.in ? brassSpeed(t) : t > GO.in ? goldSpeed(t) : t > W.in ? webSpeed(t) : t > A0 && t < A1 ? (t < A0 + 0.4 || t > A1 - 0.4 ? 4000 : 1200) : speed(t); return Math.round(n * (t < C.d1 + 0.5 ? 2.5 : v > 3200 ? 2.5 : v > 1600 ? 2 : v > 700 ? 1.5 : 1)); }
