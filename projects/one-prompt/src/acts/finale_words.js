// The four words as heavy physical letters over the lake; they light, sprout, and fuse into one line of code.
import { K, CODE, ink, rr, circ, ell, blob, rgba, mix, lg, rg, glow, text, tw, font, cached, sparkle, TAU, clamp, lerp, hash, ease } from '../ink.js';
import { gl } from '../gl.js';
import { ring } from '../sim.js';
import { T, WL, BASE } from './finale_time.js';
import { proj, dots } from './finale_sky.js';
import { LINE } from './finale_tree.js';
export const FS = 196, BL = 806, PHRASE = 'fix the login bug';
let L = null;
export function letters(x) { if (L) return L; x.save(); font(x, FS, { w: 900 }); x.textAlign = 'left'; x.textBaseline = 'alphabetic'; const W = x.measureText(PHRASE).width, x0 = 960 - W / 2; L = []; let w = 0; [...PHRASE].forEach((c, i) => { if (c === ' ') { w++; return; } const m = x.measureText(c), px = x0 + x.measureText(PHRASE.slice(0, i + 1)).width - m.width; L.push({ c, i, w, id: L.length, x: px + m.width / 2, w2: m.width, top: BL - m.actualBoundingBoxAscent, up: m.actualBoundingBoxAscent }); }); x.restore(); for (let q = 0; q < 4; q++) { const g = L.filter(l => l.w === q); g.forEach(l => (l.wc = (g[0].x + g[g.length - 1].x) / 2)); } return L; }
export const groundAt = px => { if (!L) return 670; let y = 720; L.forEach(l => { if (Math.abs(px - l.x) < l.w2 / 2 + 6) y = Math.min(y, l.top); }); return y; };
function glyphArt(g, c, size, st) {
  const m = g.getTransform(), k = m.a, w = g.canvas.width, h = g.canvas.height, off = () => { const o = new OffscreenCanvas(w, h), q = o.getContext('2d'); q.setTransform(m); font(q, size, { w: 900 }); q.textAlign = 'center'; q.textBaseline = 'alphabetic'; return [o, q]; };
  font(g, size, { w: 900 }); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (let i = 20; i > 0; i--) { g.fillStyle = mix(st.ex[0], st.ex[1], i / 20); g.fillText(c, 0, i * 0.9); }
  const [F, f] = off(); f.fillStyle = lg(f, 0, -size * 0.78, 0, size * 0.2, st.f); f.fillText(c, 0, 0);
  const [I, q] = off(); q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.fillStyle = '#000'; q.fillRect(0, 0, w, h); q.restore(); q.globalCompositeOperation = 'destination-out'; q.fillText(c, 0, 0);
  st.sh.forEach(([col, bl, dx, dy]) => { const [Tn, n] = off(); n.setTransform(1, 0, 0, 1, 0, 0); n.drawImage(I, 0, 0); n.globalCompositeOperation = 'source-in'; n.fillStyle = col; n.fillRect(0, 0, w, h); f.save(); f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop'; f.filter = `blur(${bl * k}px)`; f.drawImage(Tn, dx * k, dy * k); f.restore(); });
  f.save(); f.globalCompositeOperation = 'source-atop'; f.fillStyle = lg(f, 0, -size * 0.8, 0, -size * 0.2, ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']); f.beginPath(); f.ellipse(-size * 0.1, -size * 0.66, size * 0.6, size * 0.26, -0.12, 0, TAU); f.fill(); f.restore();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(F, 0, 0); g.restore();
}
const ST = { off: { ex: ['#4a32b8', '#0c0540'], f: ['#8a74f0', '#4a34bd', '#23127c'], sh: [['rgba(8,2,60,0.9)', 12, -7, -9], ['rgba(225,214,255,0.95)', 5, 4, 5], ['rgba(120,220,255,0.5)', 10, 0, -7]] }, on: { ex: ['#0aa07c', '#03343c'], f: ['#ffffff', '#b8ffdf', '#3df5b0', '#0fc48e'], sh: [['rgba(0,110,90,0.85)', 12, -7, -9], ['rgba(255,255,255,1)', 5, 4, 5], ['rgba(190,255,120,0.55)', 12, 0, -7]] } };
export function glyph(x, c, on, size = FS) { const b = [-size * 0.5, -size * 0.95, size, size * 1.35]; if (on < 1) cached(x, 'finG0' + c, ...b, g => glyphArt(g, c, size, ST.off), 2); if (on > 0) { x.save(); x.globalAlpha *= on; cached(x, 'finG1' + c, ...b, g => glyphArt(g, c, size, ST.on), 2); x.restore(); } }
// impacts on the letters: [time, x, strength]
export const THUDS = []; // filled by the duel
const CW = 31 * 0.6; // mono advance at 31 px, refined on first draw
let chars = null; function codeChars(x) { if (chars) return chars; const fs = 31, adv = tw(x, 'mmmmmmmmmm', fs, { mono: true, w: 800 }) / 10, x0 = BASE[0] - adv * LINE.length / 2; chars = [...LINE].map((c, i) => ({ c, x: x0 + adv * (i + 0.5), i })).filter(c => c.c !== ' '); return chars; }
export function words(x, t, cam) {
  letters(x); if (t > T.line + 0.25) return; const Pj = proj(cam), S = cam.zoom, G = gl(), CC = codeChars(x);
  // soft contact light on the water
  L.forEach(l => { const on = clamp((t - T.hit[l.w]) / 0.1); if (on > 0 && t < T.line) { const q = Pj(l.x, WL - 60); glow(x, q[0], q[1], 190 * S, '#2ff0a6', 0.16 * on); } });
  L.forEach(l => {
    const th = T.hit[l.w], q = t - th, on = clamp(q / 0.09), dth = Math.abs(l.x - l.wc) / 900; let dy = Math.sin(t * 1.5 + l.id * 0.7) * 3, rot = Math.sin(t * 1.1 + l.id) * 0.008, sq = 0; THUDS.forEach(([t0, px, k]) => { const f = Math.exp(-(((l.x - px) / 150) ** 2)), d = Math.abs(l.x - px) / 2200; dy += ring(t, t0 + d, 2.8, 4.2) * k * f; rot += ring(t, t0 + d, 3.1, 4.5) * k * 0.0016 * f * Math.sign(px - l.x || 1); });
    dy += ring(t, th + dth, 2.6, 4) * 46; rot += ring(t, th + dth, 3, 4.5) * 0.12 * Math.sign(l.x - l.wc || 1) * -1; sq = ring(t, th, 3.4, 6) * 0.22; const pulse = t > T.four ? ring(t, T.four + l.w * 0.05, 2, 4) * 0.05 : 0;
    // fuse: letter arcs into its place in the line
    const fu = clamp((t - T.fuse - l.id * 0.011) / (T.line - T.fuse - 0.15)), ant = Math.sin(clamp((t - T.fuse + 0.16) / 0.2) * Math.PI) * (fu > 0 ? 0 : 1), tgt = CC[Math.round(l.id * (CC.length - 1) / (L.length - 1))], e = ease.io3(fu), px = lerp(l.x, tgt.x, e) + (960 - l.x) * -0.04 * ant, py = lerp(BL + dy, BASE[1] - 2, ease.in2(fu)) - Math.sin(fu * Math.PI) * 150 + ant * 12, k = 1 / lerp(1, 1 / 0.16, Math.pow(e, 1.3)), flip = Math.cos(e * Math.PI * 2); const p = Pj(px, py);
    if (fu >= 1) return; x.save(); x.translate(p[0], p[1]); x.rotate(rot * (1 - e) + e * (l.x < 960 ? 1 : -1) * 0.0); x.scale(S * k * (1 + sq * 0.5 + pulse) * (Math.abs(flip) < 0.08 ? 0.08 : flip), S * k * (1 - sq + pulse)); if (on > 0) { x.save(); glow(x, 0, -60, 170, '#2ff0a6', 0.35 * on + Math.exp(-Math.max(0, q) * 5) * 0.6 * (q > 0 ? 1 : 0)); x.restore(); } glyph(x, l.c, on); x.restore();
    // sprouts
    const sg = ease.out3(clamp((t - th - 0.22 - hash(l.id * 3) * 0.25) / 0.5)) * (1 - ease.in2(clamp((t - T.fuse + 0.12) / 0.16))); if (sg > 0.01 && l.c !== 'g' || (sg > 0.01 && l.id === 8)) { const h0 = (46 + hash(l.id * 5) * 54) * sg, dir = hash(l.id * 7) > 0.5 ? 1 : -1, sway = Math.sin(t * 2.4 + l.id) * 5; const A = Pj(l.x + dir * 4, l.top + dy + 6), tip = Pj(l.x + dir * (14 + 16 * sg) + sway, l.top + dy - h0), mid = Pj(l.x - dir * 12, l.top + dy - h0 * 0.5); x.save(); x.lineCap = 'round'; x.strokeStyle = lg(x, 0, A[1], 0, tip[1], ['#0fb487', '#b8ffdf']); x.lineWidth = 6.5 * S; x.beginPath(); x.moveTo(A[0], A[1]); x.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); x.stroke(); [[0.5, -dir], [0.72, dir]].forEach(([u, d], j) => { const v = 1 - u, bx = v * v * A[0] + 2 * u * v * mid[0] + u * u * tip[0], by = v * v * A[1] + 2 * u * v * mid[1] + u * u * tip[1], s = clamp(sg * 1.6 - 0.4 - j * 0.15) * S; if (s <= 0) return; x.save(); x.translate(bx, by); x.rotate(d * (0.9 + Math.sin(t * 3 + l.id + j) * 0.08)); x.scale(s, s); ink(x, blob([[0, 0], [-9, -14], [-4, -32], [0, -38], [5, -30], [9, -13]]), { f: ['#d6ffee', '#2ff0a6', '#0a8a70'], sh: [['rgba(0,80,70,0.6)', 7, -3, -3]] }); x.restore(); }); const bud = clamp(sg * 2 - 1); glow(x, tip[0], tip[1], 46 * S * bud, [K.extra, K.need, K.choice][l.id % 3], 0.8); ink(x, circ(tip[0], tip[1], 8 * S * bud), { f: ['#ffffff', [K.extra, K.need, K.choice][l.id % 3]], r: [0.4, 0.35, 0.8] }); x.restore(); }
  });
  // the code line assembling
  if (t > T.fuse + 0.1) { CC.forEach((c, j) => { const t0 = T.line - 0.2 + Math.abs(c.x - 960) / 1400, a = clamp((t - t0) / 0.16); if (a <= 0) return; const q = Pj(c.x, BASE[1] - 10), b = ease.back(a, 2.2); x.save(); x.translate(q[0], q[1]); x.scale(b * S, b * S); glow(x, 0, 0, 40, '#2ff0a6', 0.5 * (1 - clamp((t - t0 - 0.2) / 0.4))); text(x, c.c, 0, 0, '#fff', 31, { mono: true, w: 800 }); x.restore(); }); }
}
