// The whole film: which squares are loaded, what the camera sees, captions, opening and ending.
import { FPS, clamp, lerp, seg, ease, key, hash, TAU, noise } from './core.js';
import { PanelSet, G } from './panel.js';
import { defaultKeys } from './light.js';
import { C, RING, BLANK, PANEL_DUR, panelStart, DURATION, BEAT, BAR } from './timeline.js';
import { HERO_TIPS, stringFigure } from './panels/parts.js';

const CW = 1920, CH = 1080, MED = [1920, 1080], CEN = [5760, 3240];
const MODS = {}; const sets = new Map(), low = new Map(); let HERO = 2.2;
const org = id => { if (id === 'medallion') return MED; const r = id === 'blank' ? BLANK : RING.find(q => q[0] === id); return [r[1] * CW, r[2] * CH]; };
const mats = new Int32Array(40);
export async function load(E, params) {
  HERO = +(params.get('bake') || (E.H > 1200 ? 2.8 : 2.1));
  for (const id of [...RING.map(r => r[0]), 'medallion', 'blank']) { try { MODS[id] = (await import(`./panels/${id}.js`)).default; } catch (e) { console.log('missing panel', id, String(e.message).slice(0, 120)); } }
  mats.fill(0); for (const [id, c, r] of RING) if (MODS[id]) mats[r * 6 + c] = MODS[id].mat | 0; mats[36] = 0;
  sets.seam = new PanelSet(E, { w: 1920, h: 40, bake(B) { B.sprite('seam', { w: 1920, h: 40, ox: 0, oy: 20, res: 1 }, A => { A.part([[[0, -15], [1920, -15], [1920, 15], [0, 15]]], { fill: ['#5a3414', '#3a1c0c'], halo: 0, noKnock: true }); for (let i = 0; i < 80; i++) { const x = i * 24 + 12; A.stroke([[x - 8, -9], [x + 8, 9]], { w: 4, color: '#d8a130', halo: 0, gold: 0.8, raise: 1 }); A.stroke([[x + 8, -9], [x - 8, 9]], { w: 4, color: '#d8a130', halo: 1.4, gold: 0.8, raise: 1 }); } }); } }, 1.4); await sets.seam.bake();
  sets.border = new PanelSet(E, { w: 1920, h: 360, bake(B) {
    B.sprite('edge', { w: 1920, h: 360, ox: 0, oy: 360, res: 1 }, A => {
      const C = { ink: '#1c0f08', red: '#8d1f16', deep: '#4d1410', gold: '#d8a130', cream: '#ecd9a8', ind: '#16294a', teal: '#23686a' };
      const bar = (y, h, c, o = {}) => A.part([[[0, y], [1920, y], [1920, y + h], [0, y + h]]], { fill: c, halo: 0, noKnock: true, ...o });
      bar(-360, 360, [C.deep, C.red]); bar(-352, 26, C.gold, { gold: 1, raise: 0.8 }); bar(-40, 24, C.gold, { gold: 1, raise: 0.8 }); bar(-12, 12, C.ink);
      for (let i = 0; i < 40; i++) { const x = i * 48; A.part([[[x, -326], [x + 24, -288], [x + 48, -326]]], { fill: C.cream, halo: 2 }); A.part([[[x, -40], [x + 24, -78], [x + 48, -40]]], { fill: C.cream, halo: 2 }); }
      for (let i = 0; i < 10; i++) { const x = 96 + i * 192, y = -183, c = [C.ind, C.teal][i % 2]; A.part([[[x - 84, y], [x, y - 92], [x + 84, y], [x, y + 92]]], { fill: c, halo: 4, raise: 0.6, lines: [{ strokes: [[[x - 60, y], [x, y - 66], [x + 60, y], [x, y + 66], [x - 60, y]].map(q => q)], w: 5 }] }); const sp = []; for (let k = 0; k <= 60; k++) { const u = k / 60, a = u * 15 + i, r = 46 * (1 - u) + 4; sp.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } sp.open = true; A.stroke(sp, { w: 9, color: C.gold, gold: 1, raise: 1, halo: 2, taper: 0.1 }); const t = []; for (const k of [-1, 1]) { const q = []; for (let j = 0; j <= 40; j++) { const u = j / 40, a = u * 10 * k + Math.PI / 2 * k, r = 40 * (1 - u) + 3; q.push([x + 96 + Math.cos(a) * r, y + k * 44 + Math.sin(a) * r]); } q.open = true; A.stroke(q, { w: 8, color: C.cream, halo: 2, taper: 0.1 }); } }
    });
    B.sprite('corner', { w: 360, h: 360, ox: 360, oy: 360, res: 1 }, A => { A.part([[[-360, -360], [0, -360], [0, 0], [-360, 0]]], { fill: ['#16294a', '#0f1d36'], halo: 0 }); for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + k * TAU / 16, r = k ? 90 : 150; A.part([[[-180, -180], [-180 + Math.cos(a - 0.22) * r * 0.6, -180 + Math.sin(a - 0.22) * r * 0.6], [-180 + Math.cos(a) * r, -180 + Math.sin(a) * r], [-180 + Math.cos(a + 0.22) * r * 0.6, -180 + Math.sin(a + 0.22) * r * 0.6]]], { fill: k ? '#ecd9a8' : '#d8a130', gold: k ? 0 : 1, raise: 0.8, halo: 4 }); } });
  } }, 0.9); await sets.border.bake();
}
// which hero sets are needed at time t
function need(t) {
  const n = []; if (t < C.panels + 0.4 || t > C.ring - 0.5) n.push('medallion');
  if (t > C.panels - 0.5 && t < C.montage + 0.5) { const f = (t - C.panels) / PANEL_DUR; for (const i of [Math.floor(f - 0.08), Math.floor(f), Math.floor(f + 0.08)]) if (i >= 0 && i < RING.length && !n.includes(RING[i][0])) n.push(RING[i][0]); }
  if (t >= C.montage && t < C.ring) n.push(MONTAGE[montIdx(t)][0]);
  if (t > C.glide - 0.1) n.push('blank');
  return n.filter(id => MODS[id]);
}
const MONTAGE = [['india', 0.45], ['asante', 0.45], ['china', 0.45], ['andes', 0.45], ['norse', 0.45], ['java', 0.45], ['arctic', 0.45], ['persia', 0.45]];
const montIdx = t => clamp(Math.floor((t - C.montage) / BEAT + 1e-4), 0, 7);
export async function prepare(E, t) {
  if (sets.stamp === undefined) sets.stamp = 0;
  const ids = need(t);
  for (const id of ids) if (!sets.has(id)) {
    const keep = new Set([...ids, ...(t > C.ring - 1 || t < C.panels + 1 ? ['medallion'] : [])]);
    for (const [k, v] of [...sets]) if (!keep.has(k) && sets.size >= 2) { v.free(); sets.delete(k); }
    const s = new PanelSet(E, MODS[id], MODS[id].bakeScale || HERO); try { await s.bake(); sets.set(id, s); } catch (e) { console.log('bake failed', id, e.message); delete MODS[id]; }
  }
  if (t > C.pull - 0.1) for (const [id] of RING) if (MODS[id] && !low.has(id)) { const s = new PanelSet(E, MODS[id], 0.5); try { await s.bake(); low.set(id, s); } catch (e) { console.log('bake failed', id, e.message); delete MODS[id]; } }
}
const L3 = (a, b, p) => { const o = {}; for (const k of ['x', 'y', 'w', 'tilt', 'yaw', 'roll', 'aperture', 'fov']) { const d = k === 'fov' ? 34 : 0; o[k] = lerp(a[k] ?? d, b[k] ?? d, p); } return o; };
const gcam = (id, c) => { const [ox, oy] = org(id); return { ...c, x: c.x + ox, y: c.y + oy }; };
function panelCam(i, lt) { const m = MODS[RING[i][0]]; if (!m) return gcam(RING[i][0], { x: 960, y: 540, w: 1900 }); const k = m.shots.findIndex(s => lt < s.end), j = k < 0 ? m.shots.length - 1 : k, st = j ? m.shots[j - 1].end : 0; return gcam(RING[i][0], m.shots[j].cam(clamp((lt - st) / (m.shots[j].end - st)), lt)); }
// squares start painting before the camera lands; story time rejoins screen time on the 1.25 s downbeat
export const ptime = lt => (lt < 1.25 ? Math.max(0, 0.42 + lt * (0.83 / 1.25)) : lt);
const WH = 0.27; // half-length of a whip, seconds

// ---------------------------------------------------------------- state at time t
export function state(t) {
  const s = { cam: null, env: {}, panels: [], med: null, blank: null, caption: null, whip: 0 };
  // squares
  if (t > C.panels - WH && t < C.montage + WH) {
    const i = clamp(Math.floor((t - C.panels) / PANEL_DUR + 1e-6), 0, RING.length - 1), lt = t - panelStart(i);
    s.panels.push([i, lt]); s.cam = panelCam(i, clamp(lt, 0, PANEL_DUR)); s.main = i;
    const cross = (a, b, p) => { const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, c = L3(a, b, e); c.w *= 1 + 0.22 * Math.sin(p * Math.PI); c.aperture *= 1 - Math.sin(p * Math.PI); s.whip = Math.sin(p * Math.PI); return c; };
    if (lt < WH && i > 0) { s.panels.unshift([i - 1, PANEL_DUR + lt]); s.cam = cross(panelCam(i - 1, PANEL_DUR), panelCam(i, lt), (lt + WH) / (2 * WH)); }
    if (lt > PANEL_DUR - WH && i < RING.length - 1) { s.panels.push([i + 1, lt - PANEL_DUR]); s.cam = cross(panelCam(i, lt), panelCam(i + 1, 0), (lt - PANEL_DUR + WH) / (2 * WH)); }
    if (i === 0 && lt < WH) { s.med = titleMed(t); s.cam = cross(openCam(C.panels), panelCam(0, Math.max(0, lt)), (lt + WH) / (2 * WH)); }
    if (i === RING.length - 1 && lt > PANEL_DUR - 0.0) { s.main = i; }
    const m = MODS[RING[s.main][0]]; const [lox, loy] = org(RING[s.main][0]), lcam = { ...s.cam, x: s.cam.x - lox, y: s.cam.y - loy }; s.env = m ? { ...(typeof m.env === 'function' ? m.env(clamp(lt, 0, 5), lcam) : m.env || {}) } : {};
    if (s.env.keys) { const [ox, oy] = org(RING[s.main][0]); s.env.keys = s.env.keys.map(k => ({ ...k, x: k.x + ox, y: k.y + oy })); if (s.whip > 0.05) s.env.keys = null; }
    if (m && m.caption) s.caption = { m, lt };
    return s;
  }
  if (t < C.panels) return opening(t, s);
  if (t < C.ring) return montage(t, s);
  return finale(t, s);
}
// ---------------------------------------------------------------- opening
function openCam(t) {
  const c = (dx, dy, w, o = {}) => ({ x: CEN[0] + dx, y: CEN[1] + dy, w, tilt: 0, yaw: 0, roll: 0, aperture: 0, fov: 34, ...o });
  if (t < C.spin) { const p = t / C.spin; return c(0, lerp(20, 0, p), lerp(760, 560, p), { tilt: 0.3, aperture: 4 }); }
  if (t < C.bloom) { const p = (t - C.spin) / (C.bloom - C.spin); return c(lerp(-40, 60, p), -30, lerp(300, 380, p), { tilt: 0.5, yaw: lerp(-0.25, 0.1, p), aperture: 6 }); }
  if (t < C.hunt) { const p = (t - C.bloom) / (C.hunt - C.bloom); return c(0, lerp(-40, -10, p), lerp(620, 2500, ease.out(p)), { tilt: lerp(0.3, 0.08, p), roll: lerp(-0.25, 0.05, p), aperture: 2 }); }
  if (t < C.figure) { const p = (t - C.hunt) / (C.figure - C.hunt); return c(lerp(-260, 260, p), -760, lerp(1500, 1380, p), { tilt: 0.42, roll: lerp(0.12, -0.12, p), aperture: 4 }); }
  if (t < C.title) { const p = (t - C.figure) / (C.title - C.figure); return c(0, lerp(-20, -40, p), lerp(1900, 1500, ease.out2(p)), { tilt: 0.14, aperture: 2 }); }
  const p = clamp((t - C.title) / (C.panels - C.title)); return c(lerp(0, 20, p), -20, lerp(1760, 1660, p), { tilt: 0.1, aperture: 1 });
}
function titleMed(t) { return { fire: 1, core: 1, first: 1, beasts: 1, main: clamp((t - C.hunt) / 3), bg: 0, dancers: 0 }; }
function opening(t, s) {
  s.cam = openCam(t); const flick = 0.85 + 0.1 * Math.sin(t * 13) + 0.08 * Math.sin(t * 23.7 + 1);
  const fl = k => (t >= k ? Math.exp(-(t - k) * 5) : 0), flash = fl(C.spark1) * 0.9 + fl(C.spark2) * 1.2;
  const em = seg(t, C.ember - 0.1, C.ember + 1.4, ease.out2), bl = seg(t, C.bloom, C.bloom + 1.2, ease.out), k = flash + em * 0.55 * flick * (1 - bl) + bl * 0.62 * flick;
  const dim = lerp(1, 0.5, seg(t, C.figure - 0.3, C.figure + 0.4)) * lerp(1, 0.3, seg(t, C.title - 0.4, C.title + 0.25));
  const R = lerp(230, 1500, bl) * (0.9 + 0.1 * flick);
  s.env = { keys: [{ x: CEN[0], y: CEN[1] - 10, z: lerp(120, 520, bl), R, col: [1.75 * k * dim, 1.12 * k * dim, 0.52 * k * dim] }, { x: s.cam.x - s.cam.w * 0.3, y: s.cam.y - s.cam.w * 0.3, z: s.cam.w * 0.35, R: s.cam.w * 0.8, col: [0.9 * bl, 0.74 * bl, 0.5 * bl].map(v => v * 0.62 * dim) }], amb: [0.03 + 0.07 * bl * dim, 0.022 + 0.05 * bl * dim, 0.016 + 0.04 * bl * dim], vig: 0.95, scorch: 0.8, exposure: 0.95, relief: lerp(1.5, 1, bl), wear: 0.12, bloom: 0.8, stain: 1.2 };
  s.med = { fire: t < C.bloom ? 0.0 : lerp(0.12, 1, ease.outBack(clamp((t - C.bloom) / 0.9))) * lerp(1, 0.0, seg(t, C.title - 0.35, C.title + 0.25)), core: seg(t, C.bloom + 0.15, C.bloom + 2.3, ease.out2), first: seg(t, C.bloom + 0.5, C.bloom + 2.6), beasts: seg(t, C.hunt - 0.3, C.hunt + 1.4), main: clamp((t - C.hunt) / 3), bg: 0, dancers: 0 };
  s.open = true; s.text = t < C.hunt; return s;
}
function drawOpening(E, g, t, s) { // extra elements over the medallion (local coords of medallion)
  const cx = 3840, cy = 2160;
  // flint sparks
  for (const [k, n] of [[C.spark1, 60], [C.spark2, 110]]) { g.burst(cx - 10, cy, k, { n, speed: 560, life: 1.0, size: 1.7, col: [6, 3, 1], seed: n, grav: 260, dir: -1.2, spread: 2.6, z: 14 }); }
  // ember bed
  if (t > C.ember - 0.1 && t < C.hunt) { const e = seg(t, C.ember - 0.1, C.ember + 1.2) * (1 - 0.6 * seg(t, C.bloom, C.bloom + 1)); for (let i = 0; i < 46; i++) { const a = hash(i * 3) * TAU, r = Math.sqrt(hash(i * 5 + 1)) * 54, pul = 0.5 + 0.5 * Math.sin(t * (3 + hash(i) * 5) + i); g.part(cx + Math.cos(a) * r * 1.3, cy + 34 + Math.sin(a) * r * 0.7, 2 + hash(i + 9) * 4, 3 + hash(i + 2) * 5, 2.2 * e * pul, 0.55 * e * pul, 0.1 * e * pul, 0.7 * e, 0); } for (let i = 0; i < 90; i++) { const life = 1.2 + hash(i) * 1.6, ph = ((t - C.ember) / life + hash(i * 7)) % 1; if (t < C.ember) continue; const x = cx + (hash(i + 4) - 0.5) * 120 + Math.sin(ph * 5 + i) * 24, y = cy - ph * 180 * hash(i + 11) + 20, z = 10 + ph * 220 * (0.4 + hash(i + 5)); const k = (1 - ph) * e; g.part(x, y, z, 1.6 + hash(i + 6) * 1.8, 4 * k, 1.7 * k, 0.5 * k, k, 0); } }
  // fibres spin into the first thread
  if (t > C.spin - 0.1 && t < C.bloom + 0.6) {
    const p = (t - C.spin) / (C.bloom - C.spin), twist = t * 5.2, head = lerp(cx - 40, cx + 170, clamp(p)), fade = 1 - seg(t, C.bloom, C.bloom + 0.5);
    for (let i = 0; i < 26; i++) { const pts = [], a0 = i / 26 * TAU; for (let k = 0; k <= 44; k++) { const u = k / 44, x = head + u * 260, sp = Math.pow(u, 1.25), rad = 2 + sp * (34 + 30 * hash(i)), ang = a0 + twist * (1 - u * 0.5) - u * 4; pts.push([x, cy - 34 + Math.sin(ang) * rad * 0.8 + (hash(i + 3) - 0.5) * 60 * sp * sp, 30 + Math.cos(ang) * rad * 0.7 + 8]); } g.thread(pts, { w: 2.4, color: i % 3 ? '#b98a4a' : '#8a2a14', gold: 0.2, shadow: 0.35, alpha: fade }); }
    const th = []; for (let k = 0; k <= 60; k++) { const u = k / 60; th.push([lerp(cx - 420, head + 6, u), cy - 34 + Math.sin(u * 9 + t) * 3 * (1 - u), 34]); } g.thread(th, { w: 11, hero: 1, spark: 0.25, headLen: 26, glow: 0.6, alpha: fade });
    for (let i = 0; i < 34; i++) { const ph = (t * 1.3 + hash(i)) % 1, a = hash(i + 2) * TAU; g.part(head + 8 + Math.cos(a) * 30 * ph, cy - 34 + Math.sin(a) * 24 * ph, 40 + 30 * ph, 1.4, 3 * (1 - ph) * fade, 1.5 * (1 - ph) * fade, 0.5 * (1 - ph), (1 - ph) * fade, 0); }
  }
  if (t > C.bloom - 0.05) g.burst(cx, cy, C.bloom, { n: 160, speed: 900, life: 1.8, size: 4, seed: 77, grav: 20, z: 40 });
  // blown ochre: puffs on eighth notes as the hands appear
  for (let j = 0; j < 8; j++) { const k = C.bloom + 0.3 + j * BEAT / 2, a = hash(j * 13 + 2) * TAU; if (t > k && t < k + 1.4) { const u = (t - k) / 1.4; for (let i = 0; i < 22; i++) { const b = a + (hash(i + j * 40) - 0.5) * 0.3, r = 700 + hash(i * 3 + j) * 190; g.part(cx + Math.cos(b) * r * 1.27 + (hash(i + 5) - 0.5) * 60 * u, cy + Math.sin(b) * r, 20 + 60 * u * hash(i), 30 + 60 * u, 0.5, 0.16, 0.06, 0.22 * (1 - u), 3, i, 0, 0); } } }
  if (t > C.bloom) g.drift({ n: 120, x: cx - 1300, y: cy - 800, w: 2600, h: 1500, vx: 10, vy: -60, z0: 20, z1: 300, size: 3, col: [2.2, 1.0, 0.3], a: 0.8 * seg(t, C.bloom, C.bloom + 1), seed: 8 });
  // the two hands and the first string figure
  if (t > C.figure - 0.05 && t < C.title + 0.7) {
    const inn = seg(t, C.figure - 0.05, C.figure + 0.55, ease.out) * (1 - seg(t, C.title - 0.25, C.title + 0.35, ease.in)), S = 0.86, lx = lerp(cx - 1500, cx - 540, inn), rx = lerp(cx + 1500, cx + 540, inn), hy = cy + 300 + Math.sin(t * 2) * 6; const bs = sets.get('medallion');
    for (const [nm, x, f, r] of [['handA', lx, true, 0.2], ['handB', rx, false, -0.2]]) { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.sprite(nm, { x: x + Math.cos(a) * 6, y: hy + Math.sin(a) * 6, s: S, flip: f, r, tint: '#c98a3a', tintA: 1, raise: 0, gold: 0 }); } g.sprite(nm, { x, y: hy, s: S, flip: f, r, lift: 40 }); }
    const tip = (hx, f, r, n) => { const [a, b] = HERO_TIPS[n], X = a * S * f, Y = (b + 46) * S; return [hx + X * Math.cos(r) - Y * Math.sin(r), hy + X * Math.sin(r) + Y * Math.cos(r), 44]; };
    const op = ease.outBack(clamp((t - C.figure - 0.45) / 0.5)), slip = seg(t, C.title - 0.35, C.title + 0.1, ease.in); const li = tip(lx, -1, 0.2, 'index'), ll = tip(lx, -1, 0.2, 'thumb'), ri = tip(rx, 1, -0.2, 'index'), rl = tip(rx, 1, -0.2, 'thumb');
    const beat = Math.floor((t - C.figure) / BEAT), dia = [2, 4, 6, 8][clamp(beat, 0, 3)], ym = (li[1] + ll[1]) / 2, hh = (ll[1] - li[1]) / 2 * op; const sg = (a, b, n, sag = 0) => Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n) + Math.sin(i / n * Math.PI) * sag, 44 + Math.sin(i / n * Math.PI) * 6]);
    const pop = Math.exp(-((t - C.figure) % BEAT) * 7) * 14 * (beat > 0 ? 1 : 0); if (op > 0) { g.thread(sg(li, ri, 40, 24 * op + pop), { w: 10, hero: 1, glow: 1.6, f1: 1 - slip }); g.thread(sg(ll, rl, 40, -24 * op - pop), { w: 10, hero: 1, glow: 1.6, f1: 1 - slip }); for (const k of [-1, 1]) { const p = []; for (let i = 0; i <= dia; i++) { const u = i / dia, e = i === 0 || i === dia; p.push(e ? [(i ? (k > 0 ? rl : ri) : (k > 0 ? ll : li))[0], (i ? (k > 0 ? rl : ri) : (k > 0 ? ll : li))[1], 44] : [lerp(Math.max(li[0], ll[0]), Math.min(ri[0], rl[0]), u), ym + (i % 2 ? -k : k) * hh * 0.84, 44 + (i % 2 ? 9 : -5) * k]); } const q = []; for (let i = 0; i < dia; i++) q.push(...sg(p[i], p[i + 1], 10).slice(0, -1)); q.push(p[dia]); g.thread(q, { w: 10, hero: 1, glow: 1.6, f1: clamp(op) * (1 - slip) }); } }
    for (let j = 0; j < 4; j++) if (op > 0) g.burst(cx, ym, C.figure + BEAT * (j + 1), { n: 24, speed: 240, seed: 90 + j, z: 60, size: 2.6 });
  }
  if (t > C.title - 0.2) drawTitle(g, t, cx, cy);
}
// the title is written by the thread: single-stroke capitals
const GLYPH = { O: [[[50, 0], [14, 14], [0, 60], [14, 106], [50, 120], [86, 106], [100, 60], [86, 14], [50, 0], [40, 2]]], N: [[[0, 120], [0, 0], [84, 120], [84, 0]]], E: [[[74, 0], [0, 0], [0, 120], [76, 120]], [[2, 60], [58, 60]]], T: [[[0, 0], [92, 0]], [[46, 2], [46, 120]]], H: [[[0, 0], [0, 120]], [[2, 60], [82, 60]], [[84, 0], [84, 120]]], R: [[[0, 120], [0, 0], [52, 0], [78, 14], [80, 44], [52, 62], [4, 62]], [[40, 62], [84, 120]]], A: [[[0, 120], [47, 0], [94, 120]], [[18, 78], [76, 78]]], D: [[[0, 120], [0, 0], [42, 0], [80, 20], [92, 60], [80, 100], [42, 120], [0, 120]]] };
const ADV = { O: 100, N: 84, E: 76, T: 92, H: 84, R: 84, A: 94, D: 92, ' ': 10 };
function titlePaths() { const txt = 'ONE THREAD', gap = 46; let x = 0; const out = []; for (const ch of txt) { if (ch === 'A') x -= 20; if (ch !== ' ') for (const st of GLYPH[ch]) out.push([st.map(([a, b]) => [x + a, b]), ch]); x += ADV[ch] + gap; } const W = x - gap; return { out, W }; }
const TP = titlePaths();
function drawTitle(g, t, cx, cy) {
  const S = 1.2, x0 = cx - TP.W * S / 2, y0 = cy - 92, d = (C.titleSet - C.title); const n = TP.out.length;
  TP.out.forEach(([st, ch], i) => { const a = C.title + d * (i / n) * 0.92, p = seg(t, a, a + d * 0.22, ease.inOut2); if (p <= 0) return; const pts = []; const sm = 'ODR'.includes(ch) && st.length > 3; for (let k = 0; k < st.length - 1; k++) { const A = st[k], B = st[k + 1]; for (let j = 0; j < 10; j++) pts.push([lerp(A[0], B[0], j / 10), lerp(A[1], B[1], j / 10)]); } pts.push(st[st.length - 1]); let q = pts; for (let it = 0; it < (sm ? 5 : 1); it++) q = q.map((v, k) => k === 0 || k === q.length - 1 ? v : [(q[k - 1][0] + 2 * v[0] + q[k + 1][0]) / 4, (q[k - 1][1] + 2 * v[1] + q[k + 1][1]) / 4]); const z = 26 + 10 * (1 - p); g.thread(q.map(([a, b], k) => [x0 + a * S + Math.sin(t * 1.4 + i + k * 0.05) * 1.2, y0 + b * S + Math.sin(i * 1.3 + t * 1.1) * 1.4, z + Math.sin(k * 0.4 + i) * 3]), { w: 20, hero: 1, ply: 4, f1: p, spark: 0.9 * (1 - seg(t, a + d * 0.2, a + d * 0.5)), headLen: 40, glow: 1.5, shadow: 1 }); g.burst(x0 + st[st.length - 1][0] * S, y0 + st[st.length - 1][1] * S, a + d * 0.22, { n: 14, speed: 160, seed: i + 300, z: 40, size: 2.4 }); });
  // the thread that leaves for the first square
  const lv = seg(t, C.panels - 0.7, C.panels + 0.1, ease.in); if (lv > 0) { const pts = []; for (let i = 0; i <= 80; i++) { const u = i / 80; pts.push([lerp(x0 + TP.W * S, cx - 3840 - 960, u) + Math.sin(u * 8) * 120 * (1 - u), lerp(y0 + 110, cy - 2160 + 120, u) + Math.sin(u * 5 + 1) * 160 * u * (1 - u) * 4, 40 + 60 * Math.sin(u * 3.1)]); } g.thread(pts, { w: 13, hero: 1, f0: Math.max(0, lv - 0.35), f1: lv, spark: 1.6, glow: 1.2 }); }
}
// ---------------------------------------------------------------- montage + finale
function montage(t, s) { const i = montIdx(t), [id] = MONTAGE[i], p = ((t - C.montage) / BEAT) % 1, m = MODS[id]; const sh = m ? (m.macro || m.shots[Math.min(1, m.shots.length - 1)].cam(0.5, 3.6)) : { x: 960, y: 540, w: 900 }; const c = gcam(id, { ...sh, w: Math.min(sh.w, 760) * lerp(1.0, 0.9, p), tilt: 0.3, yaw: lerp(-0.12, 0.12, p) * (i % 2 ? 1 : -1), aperture: 4, x: sh.x + lerp(-70, 70, p), y: sh.y }); s.cam = c; s.main = RING.findIndex(r => r[0] === id); s.panels.push([s.main, 3.6 + p * 0.6]); s.env = m ? { ...(typeof m.env === 'function' ? m.env(3.6, c) : m.env || {}) } : {}; s.env.keys = null; s.mont = { id, p, c }; s.env.exposure = (s.env.exposure ?? 0.9) * (1 + 0.55 * Math.exp(-p * 9)); return s; }
function finaleCam(t) {
  const c = (x, y, w, o = {}) => ({ x, y, w, tilt: 0, yaw: 0, roll: 0, aperture: 0, fov: 34, ...o });
  if (t < C.ring + BEAT * 4) { const p = (t - C.ring) / (BEAT * 4); return c(CEN[0] + lerp(-560, 520, p), CEN[1] - 1612, lerp(1300, 1180, p), { tilt: 0.34, roll: lerp(0.06, -0.06, p), aperture: 4 }); }
  if (t < C.pull) { const p = (t - C.ring - BEAT * 4) / (C.pull - C.ring - BEAT * 4); return c(CEN[0] + lerp(-200, 120, p), CEN[1] - lerp(880, 640, p), lerp(2500, 3000, p), { tilt: 0.42, roll: lerp(-0.1, 0.08, p), aperture: 3 }); }
  if (t < C.glide) { const p = clamp((t - C.pull) / (C.whole - C.pull)), e = ease.inOut2(p), h = clamp((t - C.whole) / (C.glide - C.whole)); return c(CEN[0], CEN[1] - lerp(500, 0, e), lerp(2700, 13000, Math.pow(e, 1.5)) + h * 260, { tilt: lerp(0.34, 0.0, e) + 0.05 * Math.sin(h * 2), roll: lerp(0.16, 0, e), aperture: lerp(2, 0, e) }); }
  const g = ease.inOut(clamp((t - C.glide) / (C.hands - C.glide))), d = clamp((t - C.hands) / (C.end - C.hands)); const a = c(CEN[0], CEN[1], 13260, {}), b = c(960 + lerp(0, 0, d), 1080 + 590, lerp(2080, 1960, d), { tilt: 0.1, aperture: 1.2 }); const o = L3(a, b, g); o.w = Math.exp(lerp(Math.log(a.w), Math.log(b.w), g)); const gx = 1 - (o.w - b.w) / (a.w - b.w); o.x = lerp(a.x, b.x, Math.pow(gx, 0.9)); o.y = lerp(a.y, b.y, Math.pow(gx, 0.9)); return o;
}
function finale(t, s) {
  s.cam = finaleCam(t); const wide = clamp((s.cam.w - 2500) / 8000); const sw = clamp((t - C.whole) / (C.glide - C.whole));
  s.med = { fire: 1, core: 1, first: 1, beasts: 1, main: 1, bg: 1, dancers: 1, fields: 1, spin: (t - C.ring) * 0.0105 };
  s.fin = true; const f = 1 + 0.02 * Math.sin(t * 6);
  const cam = s.cam; s.env = { keys: [{ x: cam.x - cam.w * lerp(0.26, 0.2, wide), y: cam.y - cam.w * 0.26, z: cam.w * 0.34, R: cam.w * lerp(0.7, 0.95, wide), col: [2.0 * f, 1.74 * f, 1.32 * f] }, { x: CEN[0], y: CEN[1], z: 500, R: 900, col: [0.9, 0.5, 0.2] }, { x: raceAt(raceP(t))[0], y: raceAt(raceP(t))[1], z: 1300, R: 1500, col: [1.9, 1.35, 0.7].map(v => v * wide * Math.sin(Math.PI * clamp(raceP(t) * 1.02)) ** 0.4) }], wear: lerp(0.08, 0.02, wide), stain: lerp(0.8, 0.4, wide), sat: lerp(1.04, 1.1, wide), vig: lerp(0.85, 0.6, wide), scorch: lerp(0.6, 0.35, wide), exposure: lerp(0.92, 1.0, wide), waves: wide > 0.02 ? [[0.0011, 0.0004, 70 * wide, t * 0.9], [-0.0004, 0.0014, 60 * wide, t * 0.7 + 1], [0.0026, 0.0019, 18 * wide, t * 1.3]] : [], foldMargin: 60 + 400 * wide, bloom: 0.55 };
  if (t > C.glide) { s.blank = { hands: seg(t, C.hands - 0.6, C.hands + 1.1, ease.out), figure: seg(t, C.hands + 0.9, C.hands + 2.0), rows: 0.36 + 0.12 * clamp((t - C.hands) / 12), loose: 1 }; }
  else if (t > C.pull + 2) s.blank = { hands: 0, figure: 0, rows: 0.36, loose: 0 };
  if (t > C.glide + 2) { const u = seg(t, C.glide + 2, C.hands); s.env.keys[0].col = [2.0, 1.74, 1.32].map(v => v * lerp(1, 0.8, u)); s.env.keys[1] = { x: 960, y: 1080 + 640, z: 420, R: 900, col: [0.9 * u, 0.5 * u, 0.22 * u] }; }
  s.env.fade = seg(t, C.out, C.end - 0.15, ease.inOut2); s.endText = t > C.held - 0.2; return s;
}
// ---------------------------------------------------------------- drawing
function drawBorder(E) { const X1 = 6 * CW, Y1 = 6 * CH, b = 360, ed = sets.border.sprites.edge.frames[0], co = sets.border.sprites.corner.frames[0]; const far = 20000, blk = (x, y, w, h) => E.rectDraw(null, x, y, w, h, { flat: '#030201' });
  blk(-far, -far, far * 3, far - b); blk(-far, Y1 + b, far * 3, far); blk(-far, -b, far - b, Y1 + 2 * b); blk(X1 + b, -b, far, Y1 + 2 * b);
  for (let i = 0; i < 6; i++) { E.sprite(ed, { x: i * CW, y: 0 }); E.sprite(ed, { x: (i + 1) * CW, y: Y1, r: Math.PI }); E.sprite(ed, { x: 0, y: (i + 1) * CH, r: -Math.PI / 2, s: CH / CW, sy: CW / CH }); E.sprite(ed, { x: X1, y: i * CH, r: Math.PI / 2, s: CH / CW, sy: CW / CH }); }
  E.sprite(co, { x: 0, y: 0 }); E.sprite(co, { x: X1, y: 0, r: Math.PI / 2 }); E.sprite(co, { x: X1, y: Y1, r: Math.PI }); E.sprite(co, { x: 0, y: Y1, r: -Math.PI / 2 }); }
function drawSeams(E, g) { const s = sets.seam; const fr = s.sprites.seam.frames[0]; const r = E.rect; const c0 = Math.max(0, Math.floor(r[0] / CW)), c1 = Math.min(6, Math.ceil((r[0] + r[2]) / CW)), r0 = Math.max(0, Math.floor(r[1] / CH)), r1 = Math.min(6, Math.ceil((r[1] + r[3]) / CH)); const inMed = (x, y) => x > 1 && x < 5 && y > 1 && y < 5;
  for (let y = r0; y <= r1; y++) for (let x = c0; x < Math.min(6, c1); x++) { if (inMed(x + 0.5, y) ) continue; E.sprite(fr, { x: x * CW, y: y * CH }); }
  for (let x = c0; x <= c1; x++) for (let y = r0; y < Math.min(6, r1); y++) { if (inMed(x, y + 0.5)) continue; E.sprite(fr, { x: x * CW, y: y * CH, r: Math.PI / 2, s: CH / CW, sy: CW / CH }); } }
function render(E, t, camT, opt) {
  const s = state(t); if (opt && opt.mb) { const a = state(t - opt.mb / 2).cam, b = state(t + opt.mb / 2).cam; s.env.mb = [(b.x - a.x) / s.cam.w * 1.15, -(b.y - a.y) / s.cam.w * 16 / 9 * 1.15]; } if (opt && opt.cam) s.cam = { ...s.cam, ...opt.cam };
  const env = s.env; if (!env.keys) env.keys = defaultKeys(s.cam, t); env.bumps = []; if (s.whip > 0) { env.vig = lerp(env.vig ?? 0.85, 0.5, s.whip); }
  E.begin(s.cam, env, mats); E.bumps = env.bumps;
  if (s.fin) { // ground of the whole cloth
    const wide = s.cam.w > 3300; if (wide) for (const [id, c, r] of RING) { const ls = low.get(id); if (!ls) continue; if (!E.sees(c * CW, r * CH, (c + 1) * CW, (r + 1) * CH)) continue; const g = new G(E, ls, c * CW, r * CH, 2.6 + (t * 0.35 + c * 0.4 + r * 0.7) % 1.9, { rv: 1, fx: false }); try { MODS[id].draw(g, g.t, 5); } catch (e) { console.log(id, e.message); } }
  }
  if (s.med && sets.has('medallion')) { const g = new G(E, sets.get('medallion'), MED[0], MED[1], t); MODS.medallion.draw(g, t, s.med); if (t < C.panels + WH) { const hb = sets.get('medallion'); drawOpening(E, g, t, s); } if (s.fin && t > C.ring && t < C.glide + 1) { g.drift({ n: 160, x: s.cam.x - MED[0] - s.cam.w * 0.5, y: s.cam.y - MED[1] - s.cam.w * 0.3, w: s.cam.w, h: s.cam.w * 0.6, vx: 8, vy: -40, z0: 30, z1: s.cam.w * 0.15, size: s.cam.w * 0.0016, col: [2.0, 1.0, 0.35], a: 0.7, seed: 12 }); } }
  for (const [i, lt] of s.panels) { const [id, c, r] = RING[i], set = sets.get(id); if (!set) continue; const pt = ptime(lt), g = new G(E, set, c * CW, r * CH, pt, {}); MODS[id].draw(g, pt, PANEL_DUR); }
  if (s.mont) { const { c, p } = s.mont, pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60; pts.push([c.x + lerp(-0.7, 0.7, u) * c.w, c.y + Math.sin(u * 5 + s.main) * c.w * 0.07 + (s.main % 3 - 1) * 30, 26 + Math.sin(u * 9 + s.main) * 16]); } E.thread(pts, { w: c.w * 0.015, color: '#b0160c', color2: '#cf8c26', gold: 0.9, glow: 0.7, f1: ease.out2(clamp(p * 1.25)), spark: 1.4 }); }
  if (s.blank && sets.has('blank')) { const g = new G(E, sets.get('blank'), BLANK[1] * CW, BLANK[2] * CH, t, { fx: t > C.glide }); MODS.blank.draw(g, t, s.blank); if (t > C.hands - 2) { g.drift({ n: 50, vy: -14, vx: 6, size: 2.4, col: [1.3, 0.9, 0.45], a: 0.5, seed: 40 }); } const gl = seg(t, C.glide + 1.2, C.hands - 0.2, ease.inOut2); if (gl > 0 && t < C.hands + 2) { const pts = []; for (let i = 0; i <= 70; i++) { const u = i / 70; pts.push([lerp(960, 900, u) + Math.sin(u * 7 + t) * 60 * u, lerp(1200, 560, u), 20 + 24 * Math.sin(u * 8 + t)]); } g.thread(pts, { w: 9, hero: 1, f1: gl, spark: 1.2, glow: 0.8, alpha: 1 - seg(t, C.hands + 0.9, C.hands + 1.7) }); } }
  if (s.fin) { drawBorder(E); if (t > C.whole - 1) drawRace(E, t, s.cam.w); }
  drawSeams(E);
  overlay(E, t, s);
  E.end();
}
// the one thread, seen whole: out of the fire, through every square, into the empty one
const RACE = (() => { const pts = [[CEN[0], CEN[1]]], ctr = ([, c, r]) => [(c + 0.5) * CW, (r + 0.5) * CH]; const q = [...RING.map(ctr)]; q.push([BLANK[1] * CW + 960, BLANK[2] * CH + 1080]); pts.push([CEN[0] - 1500, CEN[1] - 1300], [CEN[0] - 3300, CEN[1] - 2150]); for (const p of q) pts.push(p); const o = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 24; k++) { const u = k / 24; o.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]); } o.push(pts[pts.length - 1]); let z = o; for (let it = 0; it < 14; it++) z = z.map((v, i) => i === 0 || i === z.length - 1 ? v : [(z[i - 1][0] + 2 * v[0] + z[i + 1][0]) / 4, (z[i - 1][1] + 2 * v[1] + z[i + 1][1]) / 4]); return z; })();
const raceP = t => seg(t, C.whole - 0.9, C.whole + 4.1, ease.inOutSine);
const raceAt = p => RACE[Math.min(RACE.length - 1, Math.round(p * (RACE.length - 1)))];
function drawRace(E, t, w) { const p = raceP(t); if (p <= 0) return; const a = 1 - seg(t, C.glide + 0.9, C.hands - 0.4); if (a <= 0) return; const pts = RACE.map(([x, y], i) => [x + Math.sin(i * 0.31 + t * 0.8) * 26, y + Math.sin(i * 0.23 + 1 + t * 0.7) * 26, 150]); E.thread(pts, { w: lerp(22, 74, clamp(w / 12000)), color: '#c01a0c', color2: '#f0b64a', gold: 0.9, glow: 1.7, f1: p, spark: 2.6, headLen: 900, alpha: a, shadow: 0.9 }); const h = raceAt(p); if (p < 1) for (let i = 0; i < 60; i++) { const u = hash(i) , b = raceAt(Math.max(0, p - u * 0.05)); E.part(b[0] + (hash(i + 5) - 0.5) * 260 * (0.3 + u), b[1] + (hash(i + 9) - 0.5) * 260 * (0.3 + u), 200 + hash(i + 2) * 300, 18 + hash(i + 3) * 26, 3 * (1 - u), 1.5 * (1 - u), 0.4 * (1 - u), (1 - u), 0); } }
// ---------------------------------------------------------------- captions and text
const CREAM = '#f4e3bd';
function overlay(E, t, s) {
  const x = E.ox; if (s.caption && s.caption.m.word) {
    const { m, lt } = s.caption, a = seg(lt, 0.5, 0.95, ease.out2) * (1 - seg(lt, 4.45, 4.75)); if (a > 0.003) {
      E.overUsed = true; const X = 88, Y = 918, w = m.word; x.save();
      const gr = x.createRadialGradient(0, 0, 20, 0, 0, 680); gr.addColorStop(0, `rgba(12,6,1,${0.8 * a})`); gr.addColorStop(0.45, `rgba(12,6,1,${0.5 * a})`); gr.addColorStop(1, 'rgba(12,6,1,0)'); x.save(); x.translate(X + 210, Y + 14); x.scale(1, 0.42); x.fillStyle = gr; x.fillRect(-700, -700, 1400, 1400); x.restore();
      x.globalAlpha = a; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.shadowColor = 'rgba(10,4,0,.85)'; x.shadowBlur = 14; x.fillStyle = CREAM;
      const vertical = w.native && /[᠀-᢯]/.test(w.native); const latin = w.native === w.roman; let nx = X;
      x.font = `${latin ? 'italic 74px "Hoefler Text","Baskerville"' : `72px ${w.font},"Optima"`}`;
      if (vertical) { x.save(); x.font = `58px ${w.font}`; const vw = x.measureText(w.native).width; x.translate(X + 8, Y + 4 - vw); x.rotate(Math.PI / 2); x.fillText(w.native, 0, 0); x.restore(); nx = X + 74; } else { x.fillText(w.native, X, Y); nx = X + x.measureText(w.native).width + 26; }
      if (!latin) { x.font = 'italic 43px "Hoefler Text","Baskerville"'; x.fillStyle = '#e9c98a'; x.fillText(w.roman, nx, Y); nx += x.measureText(w.roman).width + 18; }
      x.font = 'italic 31px "Hoefler Text","Baskerville"'; x.fillStyle = 'rgba(244,227,189,.82)'; x.fillText(w.gloss, nx + 4, Y);
      const b = seg(lt, 0.75, 1.3, ease.inOut2); x.shadowBlur = 8; x.strokeStyle = '#c8321c'; x.lineWidth = 2.6; x.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60 * b; x[i ? 'lineTo' : 'moveTo'](X + u * 640, Y + 26 + Math.sin(u * 18 + lt * 2) * 1.6); } x.stroke(); x.strokeStyle = '#f0b64a'; x.lineWidth = 1; x.setLineDash([6, 7]); x.stroke(); x.setLineDash([]);
      const c = seg(lt, 0.95, 1.4); x.globalAlpha = a * c; x.font = '600 25px "Optima"'; x.letterSpacing = '4.2px'; x.fillStyle = CREAM; x.fillText(`${m.caption.place.toUpperCase()}`, X, Y + 68); const pw = x.measureText(m.caption.place.toUpperCase()).width; x.font = '25px "Optima"'; x.letterSpacing = '2px'; x.fillStyle = '#f0d49a'; x.fillText(m.caption.tech, X + pw + 24, Y + 68); x.letterSpacing = '0px'; x.restore();
    }
  }
  const center = (str, y, size, a, o = {}) => { if (a <= 0.003) return; E.overUsed = true; x.save(); x.globalAlpha = a; if (o.plate !== 0) { const gr = x.createRadialGradient(0, 0, 10, 0, 0, 420); gr.addColorStop(0, 'rgba(10,5,1,.42)'); gr.addColorStop(1, 'rgba(10,5,1,0)'); x.save(); x.translate(960, y - size * 0.3 + (o.py || 0)); x.scale(1.3, o.ps || 0.3); x.fillStyle = gr; x.fillRect(-500, -500, 1000, 1000); x.restore(); } x.textAlign = 'center'; x.font = `${o.it === false ? '' : 'italic '}${size}px "Hoefler Text","Baskerville"`; x.letterSpacing = o.sp || '1px'; x.shadowColor = 'rgba(8,3,0,.95)'; x.shadowBlur = 22; x.fillStyle = o.col || CREAM; x.fillText(str, 960, y); x.shadowBlur = 10; x.fillText(str, 960, y); x.restore(); };
  if (t < C.hunt) { const o = 1 - seg(t, C.bloom + 1.0, C.bloom + 1.5); center('Every people on Earth', 846, 50, seg(t, C.text0, C.text0 + 0.6) * o, { py: 30, ps: 0.4 }); center('has a word for thread.', 914, 50, seg(t, C.text0 + BEAT * 1.5, C.text0 + BEAT * 1.5 + 0.6) * o, { plate: 0 }); }
  if (s.endText) { const o = 1; center('One thread.', 250, 76, seg(t, C.held, C.held + 0.9) * o, { py: 40, ps: 0.42 }); center('Still weaving.', 340, 50, seg(t, C.line2, C.line2 + 0.9) * o, { col: '#f0d49a', plate: 0 }); }
}
const acc = { cv: null, x: null };
export function draw(E, t, opt = {}) {
  const s = state(t); let n = 1; if (s.whip > 0.12) n = opt.fast ? 1 : Math.round(lerp(4, 9, s.whip));
  if (n === 1) { render(E, t, t, opt); return null; }
  if (!acc.cv) { acc.cv = new OffscreenCanvas(E.W, E.H); acc.x = acc.cv.getContext('2d'); }
  for (let i = 0; i < n; i++) { const ts = t + ((i + 0.5) / n - 0.5) * 0.62 / FPS; render(E, ts, t, { ...opt, mb: 0.62 / FPS / n }); acc.x.globalAlpha = 1 / (i + 1); acc.x.drawImage(E.gl.canvas, 0, 0); } acc.x.globalAlpha = 1; return acc.cv;
}
