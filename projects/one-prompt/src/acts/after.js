// AFTER: the laptop closes, the copies travel on. One continuous journey (see after_core.js for the map).
import { clamp, lerp, label, ease, hash } from '../ink.js';
import { S0, T, body, view, robot, scarves, at, apply, burst, flush, shock, shadow, hillY, CW, XP, LIP } from './after_core.js';
import { space, planet, carousel, mount, lasso } from './after_planet.js';
import { hillSky, hillBack, hill, storm, bolt } from './after_jars.js';
import * as cv from './after_cavern.js';
import * as pz from './after_plaza.js';
import * as st from './after_street.js';
import { AF, SG, DC, CH0 } from './after_core.js';
const whip = [[T.pull + 0.4, T.full], [T.yank, T.crash], [T.pop + 0.2, T.lip + 0.2], [T.jet, T.cor + 0.2], [T.sprint, T.grab + 0.1], [T.awn, T.awn + 0.4], [T.chute, T.disk], [T.fling, T.street], [T.slap - 0.15, T.slap + 0.2]];
export const samples = (t, n) => (n > 1 && whip.some(([a, b]) => t > a && t < b) ? n * 2 : n);
const rob = (x, t, w) => { if (t < T.out) return; scarves(x, t, w); at(x, w, () => robot(x, t)); };
// clip to a slab of the world, then draw in screen space
const region = (x, w, x0, x1, fn) => { const m = x.getTransform(); x.save(); apply(x, w); x.beginPath(); x.rect(x0, -9000, x1 - x0, 20000); x.setTransform(m); x.clip(); fn(); x.restore(); };
const NAMES = [['Saved conversations', 'extra', T.crash + 0.1, T.pop + 0.1], ['Training', 'extra', T.lip + 0.5, T.wheel + 0.02], ['Human review', 'extra', T.cor + 0.1, T.leap + 0.1], ['Shared links', 'choice', T.grab + 0.02, T.rel + 0.1], ['Cloud copies', 'choice', T.awn + 0.4, T.chute], ['Local transcripts', 'extra', T.disk - 0.05, T.fling + 0.1], ['Website visits', 'extra', T.street + 0.55, T.slap - 1.02], ['Billing', 'need', T.slap - 0.72, T.slap + 0.6, 1210], ['Support messages', 'choice', T.suck + 0.12, T.out2 - 0.42]];
const GROUND = ['hill', 'cry', 'wheel', 'slide', 'sneak', 'duck', 'sprint', 'run', 'brace'];
export function draw(x, t) {
  const w = view(t), L = [], b = body(t), xl = w.cx - 1060 / w.z, xr = w.cx + 1060 / w.z, sh = () => { if (!b.air && GROUND.includes(b.m)) at(x, w, () => shadow(x, b.x, b.y + 4, 130, 0.5)); };
  if (t < T.crash + 0.5) { // planet
    const k = (q0, q1) => ease.io2(clamp((w.z - q0) / (q1 - q0))) * (t > T.yank ? 1 : 0), kS = k(0.34, 0.74), kB = k(0.62, 0.88), kG = k(0.5, 0.86); if (kS < 1) { space(x, t, w); carousel(x, t, w, false); } if (kS > 0) { x.save(); x.globalAlpha = kS; hillSky(x, t, w); x.restore(); } if (kB > 0) { x.save(); x.globalAlpha = kB; hillBack(x, t, w); x.restore(); } if (kG < 1) planet(x, t, w); hill(x, t, w, L, kG);
    const back = b.m === 'orbit' && b.z < 0; if (t < T.crash + 0.1) { if (back) { mount(x, t, w); rob(x, t, w); lasso(x, t, w); } carousel(x, t, w, true); if (!back) { mount(x, t, w); lasso(x, t, w); rob(x, t, w); } } else { sh(); rob(x, t, w); }
  } else {
    if (t < T.lip + 1 && xl < 3080) region(x, w, -9000, 3080, () => { hillSky(x, t, w); cv.canyonSky(x, t, w); if (t < T.raft + 0.2) { x.save(); x.globalAlpha = 1 - clamp((t - T.raft + 0.25) / 0.4); hillBack(x, t, w); x.restore(); } cv.canyon(x, t, w); if (t < T.raft + 0.75) { storm(x, t, w, false); hill(x, t, w, L); } cv.rapidsBack(x, t, w); });
    if (t > T.raft && xr > 3040 && xl < CW && t < T.leap) region(x, w, 3040, CW, () => { cv.cavernBg(x, t, w); cv.gates(x, t, w, L); cv.basin(x, t, w, L); cv.crystal(x, t, w, L); cv.wheel(x, t, w, L); });
    if (t > T.land && xr > CW && xl < XP && t < T.rel) region(x, w, CW, XP, () => { cv.roomBg(x, t, w); cv.room(x, t, w, L); });
    if (t > T.sneak && xr > XP) {
      const inside = t > T.chute - 0.25 && t < T.slap - 1 && (t < T.street + 0.1 || xl < AF + 200), x1 = DC[0] + 1330;
      if (t < T.chute + 0.5 || t > T.disk) region(x, w, t < T.chute + 0.6 ? XP : AF, 1e6, () => { pz.eveSky(x, t, w); if (t < T.hook) pz.town(x, t, w, 3480); else if (t > T.fling - 0.2 && t < T.suck + 1.2) pz.town(x, t, w, SG); });
      if (t < T.awn + 0.9) { region(x, w, XP, 1e6, () => { pz.plaza(x, t, w, L); pz.chainLine(x, t, w); pz.trolley(x, t, w); pz.awning(x, t, w, L); }); }
      if (t > T.awn - 0.4 && t < T.disk + 0.3) pz.cloud(x, t, w, L);
      if (inside) { const m = x.getTransform(); x.save(); apply(x, w); x.beginPath(); x.rect(DC[0] - 2600, DC[1] - 962, AF - DC[0] + 2600, 4000); x.setTransform(m); x.clip(); pz.diskBg(x, t, w); x.restore(); }
      if (inside) { pz.casing(x, t, w); pz.chuteDraw(x, t, w, false); pz.disk(x, t, w, L); pz.diskCoin(x, t, w); if (t >= T.fling) pz.arm(x, t, w); }
      if (t > T.street - 0.9) { region(x, w, AF, 1e6, () => { st.night(x, t, w, L); st.clouds(x, t, w); if (t < T.suck + 1.3) st.streetBack(x, t, w, L); }); pz.appFrame(x, t, w, 'back'); st.tubeBack(x, t, w, L); st.trail(x, t, w); st.seesaw(x, t, w, L, false); st.browser(x, t, w, L); } else if (inside) pz.appFrame(x, t, w, 'back');
      if (inside) { if (b.m === 'disk' && b.z < -0.1) { rob(x, t, w); pz.diskCoin(x, t, w); pz.arm(x, t, w); } else if (t < T.fling) { if (b.m === 'disk' && b.a > 0 && Math.sin(b.a) < 0.45 && Math.cos(b.a) > 0) { rob(x, t, w); pz.arm(x, t, w); } else { pz.arm(x, t, w); rob(x, t, w); } } else { sh(); rob(x, t, w); } if (t < T.disk + 0.12) pz.chuteDraw(x, t, w, true); }
      else if (t > T.drop) pz.chuteDraw(x, t, w, false);
    }
    if (t > T.chute - 0.25 && t < T.slap - 1 && (t < T.street + 0.1 || xl < AF + 200)) { /* drawn with the disk */ }
    else if (t < T.raft + 0.02) { sh(); rob(x, t, w); } else { if (t < T.lip + 0.1) cv.raftDraw(x, t, w); else cv.raftDraw(x, t, w); sh(); rob(x, t, w); }
    if (t > T.chute - 0.25) { pz.appFrame(x, t, w, 'front'); if (t > T.street) { st.seesaw(x, t, w, L, true); st.help(x, t, w); st.tubeFront(x, t, w); st.streetFront(x, t, w); } } else if (t > T.hop) pz.chuteDraw(x, t, w, true);
    if (t < T.lip + 0.5) cv.rapidsFront(x, t, w, L);
    if (t > T.raft && xl < CW + 100 && t < T.leap) cv.shell(x, t, w);
    if (t > T.sneak && t < T.rel + 0.3 && xr > XP - 100) cv.exitWall(x, t, w);
    if (t < T.land) cv.rocks(x, t, w, L);
    if (t > T.lip + 0.1 && t < T.jet + 0.3) cv.cavernNear(x, t, w);
    if (t > T.cor - 0.1 && t < T.leap + 0.2) cv.roomFront(x, t, w);
  }
  if (t > T.crash) { burst(L, w, t, { t0: T.crash, p: [-60, hillY(-60)], n: 46, an: [Math.PI, Math.PI * 2], v: [120, 760], g: 900, life: 1, sz: 40, ty: 0, c: ['#b98bff', '#ff9a7a', '#ffd9a0'], a: 0.35, sd: 2 }); burst(L, w, t, { t0: T.crash, p: [-60, hillY(-60)], n: 34, an: [Math.PI * 1.05, Math.PI * 1.95], v: [300, 1100], g: 2200, life: 0.9, sz: 13, ty: [1, 5], c: ['#8f5bd6', '#ffd9a0', '#5c2fae'], sd: 3 }); }
  flush(x, L); if (t > T.crash && t < T.raft + 0.3) { storm(x, t, w, true); bolt(x, t, w); }
  NAMES.forEach(([s, c, a, e, px]) => label(x, s, px || 960, 96, 74, t, a, e, c));
  return { bloom: 0.32, vig: 0.3, grain: 0.034 };
}
