// Room -> app -> title -> wake -> chase.
import { C, at, word } from '../timeline.js';
import { clamp, lerp, ease } from '../ink.js';
import { room, CAM } from '../shots/room.js';
import { ui, dark } from '../shots/title.js';
import { wake, EYE, ROB } from '../shots/wake.js';
import { surf } from '../shots/surf.js';
const T = { dive: word('r1', 6.2), ui: word('r1', 8.2), term: word('r1', 8.8), type: word('r1', 10.4), dark: C.r2 - 0.25, o: C.rt + 2.95, wake: C.a1 + 0.75, leave: C.a3 - 0.6, zoom: 1.85 }; T.eyeZ = ROB.s * T.zoom; T.eyeY = EYE[1];
let cur = { x: 600, y: 420, w: 52, h: 100 };
export const samples = (t, n) => ((t > T.dive + 0.55 && t < T.ui + 0.05) || (t > T.dark + 0.2 && t < T.dark + 0.6) ? n * 4 : n);
export function draw(x, t) {
  if (t < T.ui) { const cam = CAM(t, C, T.dive, T.ui), w4 = word('r1', 4); room(x, t, cam, { err: t > w4 ? 1 : 0, worry: clamp((t - w4) / 0.4), shake: Math.sin((t - w4) * 50) * 16 * Math.max(0, 1 - Math.abs(t - w4 - 0.25) * 3) }); return { bloom: lerp(0.34, 0.12, ease.in3(cam.u)), vig: lerp(0.36, 0.1, cam.u), grain: 0.035, fade: 1 - clamp(t / 0.9) }; }
  if (t < T.dark) { ui(x, t, T); return { bloom: 0.12, vig: 0.12, grain: 0.03 }; }
  if (t < T.o) { const u = clamp((t - T.dark) / 0.55); let bgA = 1; if (u < 1) { x.save(); const c0 = ui(x, T.dark, T, true); if (c0) cur = c0; const px = cur.x + cur.w / 2, py = cur.y + cur.h / 2, k = 1 + ease.in3(u) * 9; x.translate(px, py); x.scale(k, k); x.translate(-px, -py); ui(x, T.dark, T, true); x.restore(); bgA = clamp((u - 0.5) / 0.5); } dark(x, t, T, cur, bgA); return { bloom: t > C.rt - 0.2 ? 0.3 : 0.45, vig: 0.3, grain: 0.04 }; }
  const m0 = T.leave + 0.05, k = ease.io2(clamp((t - m0) / 0.6)); if (k < 1) wake(x, t, T, t > m0);
  if (k > 0) surf(x, t, T, k < 1 ? c => { c.beginPath(); const e = -260 + k * 2500; c.moveTo(-10, -10); c.lineTo(e, -10); for (let i = 0; i <= 30; i++) { const y = i / 30 * 1100; c.lineTo(e - Math.sin(y * 0.006 + t * 3) * 90 - (y - 540) * 0.18, y); } c.lineTo(-10, 1100); c.clip(); } : null, clamp((t - m0) / 0.75), { x: ROB.x, y: ROB.y, s: ROB.s });
  return { bloom: 0.3, vig: 0.26, grain: 0.032 };
}
