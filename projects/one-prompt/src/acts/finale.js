// Two agents, four words, one line, and all of it.
import { K, CODE, ink, rr, circ, ell, poly, blob, rgba, mix, lg, rg, glow, text, tw, label, cached, TAU, clamp, lerp, hash, ease, spline, key, noise } from '../ink.js';
import { gl } from '../gl.js';
import { spring, ring, record } from '../sim.js';
import { T, WL, BASE, CORE } from './finale_time.js';
import { sky, lake, proj, apply } from './finale_sky.js';
import { words, letters } from './finale_words.js';
import { bots, logos, sparks, camY, RIPPLES } from './finale_duel.js';
import { room, inRoom, outside } from './finale_room.js';
import { tree, codeLine, GROUPS } from './finale_tree.js';
const dawnAt = () => 0; // the night holds to the end
const STOP = [[352, 640, 2.06], [442, 288, 1.94], [812, 262, 2.08], [1140, 282, 2.04], [1478, 288, 1.94], [1568, 640, 2.06]]; // Open, Read, Send, Work, Answer, After
const SHAKES = [[T.land, 30, 7], [T.turn + 0.38, 10, 8], [T.sneeze, 40, 5.5], ...T.hit.map(h => [h, 11, 8]), [T.line, 8, 8], [T.burst, 34, 5]];
const groundZ = spring(T.in - 0.2, T.burst + 0.4, t => key(t, [[T.land - 0.02, 1.0], [T.land + 0.05, 1.07, ease.out3], [T.land + 0.5, 1.0], [T.clasp, 1.0], [T.tick, 1.02, ease.io2], [T.sneeze - 0.05, 1.045, ease.io2], [T.sneeze + 0.06, 0.95, ease.out3], [T.sneeze + 0.5, 1.0], [T.hit[0], 1.06, ease.io2], [T.four, 1.1], [T.fuse, 1.12], [T.line, 2.05, ease.io3], [T.erupt, 2.16], [T.burst - 0.06, 1.3, ease.io2]]), 13, 0.75);
const groundY = spring(T.in - 0.2, T.burst + 0.4, t => key(t, [[T.sneeze + 0.15, 540], [T.hit[0] - 0.1, 630, ease.io2], [T.four, 655], [T.fuse, 660], [T.line, 768, ease.io3], [T.erupt, 766], [T.burst - 0.1, 500, ease.io2]]), 13, 0.85);
export function camAt(t) {
  let x = 960, y = 540, zoom = 1, r = 0;
  if (t < T.land + 0.8) { y = camY(t); zoom = groundZ(t); }
  else if (t < T.burst) { y = groundY(t); zoom = groundZ(t); }
  else {
    const z0 = groundZ(T.burst), y0 = groundY(T.burst), P0 = [960, y0, z0], go = (A, B, e) => A.map((q, j) => (j === 2 ? 1 / lerp(1 / q, 1 / B[j], e) : lerp(q, B[j], e)));
    const drift = (k, q) => { const s = STOP[k]; return [s[0] + (q - 0.5) * 14, s[1] - (q - 0.5) * 8, s[2] * (1 + (q - 0.5) * 0.012)]; }, whip = u => (u < 0.5 ? 8 * u ** 4 : 1 - 8 * (1 - u) ** 4);
    let v; if (t < T.A[0]) v = go(P0, drift(0, 0), ease.io3(clamp((t - T.burst) / (T.A[0] - T.burst)))); else { const k = Math.max(0, T.A.findLastIndex(q => t >= q)); if (t <= T.D[k]) v = drift(k, (t - T.A[k]) / (T.D[k] - T.A[k])); else if (k < 5) v = go(drift(k, 1), drift(k + 1, 0), whip(clamp((t - T.D[k]) / (T.A[k + 1] - T.D[k])))); else v = go(drift(5, 1), [960, 540, 1.028], ease.io3(clamp((t - T.D[5]) / (T.wide - T.D[5])))); }
    [x, y, zoom] = v;
  }
  if (t > T.wide - 0.001) { const d = clamp((t - T.wide) / (T.pull - T.wide)), k = 1 - d; zoom = lerp(1.028, 1, d * d * (3 - 2 * d) * 0.35 + d * 0.65); x += Math.sin((t - T.wide) * 0.8) * 7 * ease.io2(clamp(k * 2)); y += Math.sin((t - T.wide) * 0.62) * 5 * ease.io2(clamp(k * 2)); }
  let s = 0; SHAKES.forEach(([h, k, d]) => { if (t > h) s += Math.exp(-(t - h) * d) * k; });
  return { x, y, zoom, r: r + noise(t * 17, 5) * s * 0.0004, sx: noise(t * 25, 3) * s, sy: noise(t * 25, 9) * s };
}
export const samples = (t, n) => (t < T.land + 0.05 ? n * 2 : t > T.erupt && t < T.wide - 0.2 ? n * 3 : t > T.pull + 0.2 && t < T.room + 0.2 ? n * 2 : n);
export function draw(x, t) {
  const R = inRoom(t), cam = R ? outside(t) : camAt(t), dawn = dawnAt(t), P = proj(cam), Yw = P(960, WL)[1], vy = (camAt(t + 0.01).y - camAt(t - 0.01).y) / 0.02; letters(x);
  x.fillStyle = '#070426'; x.fillRect(-20, -20, 1960, 1120); // never let the previous frame show through
  {
  sky(x, t, cam, { dawn, neb: lerp(0.15, 1, clamp((t - T.in) / 1.2)), vy: t < T.land ? vy : 0 });
  if (t < T.burst + 0.5) { logos(x, t, cam, false); words(x, t, cam); bots(x, t, cam); logos(x, t, cam, true); }
  if (t > T.line) codeLine(x, t, cam, { dawn, k: clamp((t - T.line) / 0.2) * (1 - clamp((t - T.pull - 0.2) / 0.5)) }); tree(x, t, cam);
  const rings = RIPPLES(t).map(([px, t0, k, w]) => [P(w ? letters(x).find(l => l.w === px).wc : px, WL)[0], t0, k, cam.zoom]); lake(x, t, Yw, { dawn, rings });
  sparks(x, t, cam);
  }
  if (R) room(x, t);
  const m = ease.io2(clamp((t - T.pull) / 1.2)); return { bloom: lerp(0.32, 0.3, m), vig: lerp(0.28, 0.2, m), grain: 0.032, ca: lerp(0.003, 0.001, m), tint: [lerp(1, 1.03, m), 1, lerp(1, 0.95, m)], fadeC: [0, 0, 0], fade: clamp((t - T.end + 0.5) / 0.5) };
}
