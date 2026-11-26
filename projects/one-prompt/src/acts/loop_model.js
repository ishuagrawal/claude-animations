// THE MODEL: stacked lens-plates around a column of light. Origin = centre of its base on the ground; ~900 px tall.
import { K, CODE, ink, inner, rr, circ, ell, poly, blob, union, rgba, mix, lg, rg, glow, beam, text, tw, sparkle, cached, TAU, clamp, lerp, hash, rng, ease, key, noise } from '../ink.js';
import { gl } from '../gl.js';
import { ring } from '../sim.js';
import { bolt, hit } from './loop_kit.js';
export const PL = [[-182, 222], [-286, 306], [-392, 372], [-500, 402], [-606, 356], [-706, 278], [-798, 190]].map(([y, R], i) => ({ y, R, i, k: 0.145 })), TH = 30, TOP = -880;
const CY = '#8ff2ff', MG = '#ff5fd0';
// one glass lens plate, drawn once. centre (0,0) = top face centre
function plateSprite(g, R, k, i) {
  const ry = R * k, side = new Path2D(); side.ellipse(0, 0, R, ry, 0, 0, Math.PI); side.lineTo(-R, TH); side.ellipse(0, TH, R, ry, 0, Math.PI, 0, true); side.lineTo(R, 0); side.closePath(); side.b = [-R, 0, R * 2, ry + TH];
  ink(g, side, { f: [[0, '#5b2be0'], [0.1, '#c9a8ff'], [0.24, '#f4feff'], [0.4, '#7fe6ff'], [0.6, '#4a6cf5'], [0.82, '#a43cf0'], [0.94, '#ff8fe6'], [1, '#7a1fc0']], g: [0, 0, 1, 0], sh: [['rgba(30,0,110,0.75)', 22, 0, -12], ['rgba(255,255,255,0.95)', 7, 0, 4]] });
  const face = ell(0, 0, R, ry); face.b = [-R, -ry, R * 2, ry * 2]; g.save(); g.scale(1, k); g.fillStyle = rg(g, 0, 0, R, [[0, '#ffffff'], [0.16, '#eafdff'], [0.3, 'rgba(150,240,255,0.94)'], [0.55, 'rgba(86,120,255,0.9)'], [0.8, 'rgba(96,48,220,0.92)'], [0.93, 'rgba(60,18,150,0.95)'], [1, '#3a0f9a']]); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  // fresnel grooves
  for (let q = 0; q < 7; q++) { const rr2 = R * (0.3 + q * 0.095); g.lineWidth = 3.2; g.strokeStyle = `rgba(255,255,255,${0.42 - q * 0.04})`; g.beginPath(); g.arc(0, 0, rr2, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(40,0,130,0.35)'; g.beginPath(); g.arc(0, 4, rr2 + 4, 0, TAU); g.stroke(); }
  // caustic wedge
  g.globalCompositeOperation = 'lighter'; [[-2.5, 0.5, '#ffffff', 0.5], [0.3, 0.36, MG, 0.5], [2.2, 0.28, CY, 0.4]].forEach(([a, w, c, al]) => { g.fillStyle = rg(g, 0, 0, R, [rgba(c, 0), rgba(c, al * 0.6), rgba(c, al)]); g.beginPath(); g.moveTo(Math.cos(a) * R * 0.24, Math.sin(a) * R * 0.24); g.arc(0, 0, R * 0.95, a, a + w); g.closePath(); g.fill(); }); g.restore();
  // bevelled lip
  g.lineWidth = 11; g.strokeStyle = lg(g, -R, 0, R, 0, ['#8a5cff', '#ffffff', '#bff6ff', '#6f8cff', '#c24bf0', '#ffb0f0', '#8a2be0']); g.beginPath(); g.ellipse(0, 0, R - 5, ry - 2, 0, 0, TAU); g.stroke(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(40,0,120,0.5)'; g.beginPath(); g.ellipse(0, 0, R - 13, ry - 6, 0, 0, TAU); g.stroke(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(0, 0, R - 1, ry, 0, Math.PI * 0.85, Math.PI * 1.75); g.stroke();
  // throat
  ink(g, ell(0, 0, 66, 66 * k + 3), { f: ['#ffffff', '#d6fbff'] }); g.lineWidth = 5; g.strokeStyle = lg(g, -66, 0, 66, 0, ['#7fe6ff', '#ffffff', '#ff9ae8']); g.beginPath(); g.ellipse(0, 0, 68, 68 * k + 3, 0, 0, TAU); g.stroke();
}
// rose window behind (circular tracery), 1500 px
export function rose(x, t, cx, cy, R, a = 1) {
  x.save(); x.globalAlpha *= a; x.translate(cx, cy); x.rotate(t * 0.02); x.scale(R / 700, R / 700);
  cached(x, 'lpRose', -760, -760, 1520, 1520, g => {
    g.fillStyle = rg(g, 0, 0, 740, [[0, 'rgba(255,255,255,0.95)'], [0.2, 'rgba(160,236,255,0.75)'], [0.55, 'rgba(120,90,255,0.5)'], [0.85, 'rgba(255,80,200,0.35)'], [1, 'rgba(255,80,200,0)']]); g.beginPath(); g.arc(0, 0, 740, 0, TAU); g.fill();
    const petal = (n, r0, r1, w, c0, c1, off) => { for (let i = 0; i < n; i++) { g.save(); g.rotate((i + off) * TAU / n); const p = blob([[0, -r0], [w * 0.55, -r0 - (r1 - r0) * 0.3], [w, -r0 - (r1 - r0) * 0.72], [w * 0.5, -r1], [0, -r1 - 10], [-w * 0.5, -r1], [-w, -r0 - (r1 - r0) * 0.72], [-w * 0.55, -r0 - (r1 - r0) * 0.3]]); g.fillStyle = lg(g, 0, -r0, 0, -r1, [rgba(c0, 0.85), rgba(c1, 0.7)]); g.fill(p); g.lineWidth = 5; g.strokeStyle = 'rgba(240,252,255,0.8)'; g.stroke(p); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(0, -r0); g.lineTo(0, -r1); g.stroke(); g.restore(); } };
    const lens = (n, r0, r1, w, cs, off) => { for (let i = 0; i < n; i++) { g.save(); g.rotate((i + off) * TAU / n); const m = -(r0 + r1) / 2, p = new Path2D(); p.moveTo(0, -r0); p.quadraticCurveTo(w, m, 0, -r1); p.quadraticCurveTo(-w, m, 0, -r0); g.fillStyle = lg(g, -w, -r0, w, -r1, i % 2 ? cs : cs.slice().reverse()); g.fill(p); g.lineWidth = 6; g.strokeStyle = 'rgba(245,252,255,0.9)'; g.stroke(p); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(0, -r0); g.lineTo(0, -r1); g.stroke(); g.restore(); } };
    for (let i = 0; i < 24; i++) { const a0 = i * TAU / 24, a1 = (i + 1) * TAU / 24; [[130, 346, ['#8ff2ff', '#4a7cff']], [346, 530, ['#6a5cff', '#a04cf5']], [530, 676, ['#d048f0', '#ff7fd8']]].forEach(([r0, r1, c], q) => { g.fillStyle = rgba(c[(i + q) % 2], 0.34); g.beginPath(); g.arc(0, 0, r0, a0, a1); g.arc(0, 0, r1, a1, a0, true); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(235,245,255,0.4)'; g.stroke(); }); }
    lens(12, 134, 344, 74, ['rgba(255,255,255,0.75)', 'rgba(110,220,255,0.6)', 'rgba(70,110,255,0.6)'], 0); lens(24, 350, 528, 46, ['rgba(140,200,255,0.65)', 'rgba(140,90,255,0.6)'], 0.5); lens(24, 534, 674, 56, ['rgba(255,170,240,0.75)', 'rgba(210,70,240,0.6)'], 0); for (let i = 0; i < 12; i++) { const an = (i + 0.5) * TAU / 12 - Math.PI / 2; g.fillStyle = rg(g, Math.cos(an) * 290, Math.sin(an) * 290, 34, ['rgba(255,255,255,0.95)', 'rgba(255,150,235,0.7)']); g.beginPath(); g.arc(Math.cos(an) * 290, Math.sin(an) * 290, 30, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke(); }
    [130, 346, 530, 676].forEach((q, i) => { g.lineWidth = [8, 6, 8, 14][i]; g.strokeStyle = lg(g, -q, -q, q, q, ['#ffffff', '#a8e8ff', '#c08cff', '#ff9ae8']); g.beginPath(); g.arc(0, 0, q, 0, TAU); g.stroke(); }); for (let i = 0; i < 48; i++) { const an = i * TAU / 48; g.fillStyle = i % 2 ? '#ffffff' : '#ffb0f0'; g.beginPath(); g.arc(Math.cos(an) * 700, Math.sin(an) * 700, i % 4 ? 5 : 9, 0, TAU); g.fill(); }
  }, 1, 3); x.restore();
}
const TOK = ['if', '{', 'auth', '()', 'login', '=>', 'fix', 'user', ';', 'const', 'bug', '}', 'the', '==', 'pass', 'db', '0.3', 'api', '…', 'let'];
// o: {charge, evs: [[t, strength]], flash, calm (no tokens text), sq (0..1 stack squash), pour 0..1}
export function model(x, t, o = {}) {
  const evs = o.evs || [], ch = o.charge || 0, sq = o.sq || 0, pour = o.pour ?? 1, base = -118;
  const wob = i => evs.reduce((a, [t0, k]) => a + ring(t, t0 + i * 0.028, 3.4, 4.2) * k, 0), Y = PL.map(p => (p.y - base) * (1 - sq * 0.3) + base + Math.sin(t * 1.9 + p.i * 0.8) * 5 + wob(p.i) * 20), topY = Y[6] - 80, fl = Math.min(0.75, (o.flash || 0) * 0.6 + evs.reduce((a, [t0, k]) => a + hit(t, t0, 6) * k * 0.4, 0));
  glow(x, 0, -440, 900, '#8fe6ff', 0.3 + ch * 0.25 + fl * 0.2); glow(x, 120, -380, 700, '#ff5fd0', 0.22);
  // light shaft up
  x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = lg(x, 0, topY - 900, 0, topY, [rgba('#8fe6ff', 0), rgba('#c9f6ff', 0.5 + ch * 0.3)]); x.beginPath(); x.moveTo(-190, topY - 900); x.lineTo(190, topY - 900); x.lineTo(46, topY); x.lineTo(-46, topY); x.fill(); x.fillStyle = lg(x, 0, topY - 900, 0, topY, [rgba('#ffffff', 0), rgba('#ffffff', 0.7)]); x.beginPath(); x.moveTo(-60, topY - 900); x.lineTo(60, topY - 900); x.lineTo(24, topY); x.lineTo(-24, topY); x.fill(); x.restore();
  // ribs (outer cage) : back pair first
  const rib = (s, W, cols, back) => { x.save(); x.lineCap = 'round'; const P = () => { x.beginPath(); x.moveTo(s * 250, base + 34); x.bezierCurveTo(s * (560 * W), base - 120, s * (520 * W), Y[4] - 60, s * 96, topY - 18); }; cols.forEach(([w, c]) => { x.lineWidth = w; x.strokeStyle = c; P(); x.stroke(); }); x.restore(); };
  [-1, 1].forEach(s => rib(s, 0.62, [[22, '#2a0f8a'], [12, rgba('#8f7bff', 0.8)]], true));
  // pedestal
  const tier = (y, R, h, cols, k = 0.2) => { const ry = R * k, p = new Path2D(); p.ellipse(0, y, R, ry, 0, 0, Math.PI); p.lineTo(-R * 0.94, y - h); p.ellipse(0, y - h, R * 0.94, ry * 0.94, 0, Math.PI, 0, true); p.closePath(); const full = new Path2D(); full.addPath(p); p.b = [-R, y - h, R * 2, h + ry]; ink(x, p, { f: cols, g: [0, 0, 1, 0], sh: [['rgba(20,0,90,0.7)', 30, 0, -16], ['rgba(255,255,255,0.8)', 8, 0, 5]] }); x.fillStyle = lg(x, -R, 0, R, 0, ['#4a22c8', '#c9b4ff', '#eafdff', '#7fb0ff', '#7a3ae8', '#ff8fe6']); x.beginPath(); x.ellipse(0, y - h, R * 0.94, ry * 0.94, 0, 0, TAU); x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.ellipse(0, y - h, R * 0.94, ry * 0.94, 0, 0, TAU); x.stroke(); };
  const MET = [[0, '#2c0f92'], [0.12, '#8a5cff'], [0.28, '#efe6ff'], [0.42, '#8fb0ff'], [0.62, '#3a2cc8'], [0.86, '#8a2be0'], [0.95, '#ff9ae8'], [1, '#5a12a0']];
  x.save(); x.fillStyle = rg(x, 0, 10, 470, [rgba('#9af2ff', 0.75), rgba('#6a5cff', 0.25), rgba('#6a5cff', 0)]); x.scale(1, 0.26); x.beginPath(); x.arc(0, 40, 470, 0, TAU); x.fill(); x.restore();
  tier(0, 350, 44, MET); for (let i = 0; i < 40; i++) { const a = i * TAU / 40 + t * 0.5; if (Math.sin(a) < 0.04) continue; const on = (Math.floor(t * 9) + i) % 5 < 2; x.fillStyle = on ? '#ffffff' : rgba(CY, 0.5); x.beginPath(); x.ellipse(Math.cos(a) * 346, Math.sin(a) * 69 - 22, 5.5 * Math.abs(Math.sin(a)) + 1.5, 6, 0, 0, TAU); x.fill(); }
  tier(-44, 290, 34, MET); tier(-78, 236, 40, MET);
  x.save(); x.globalCompositeOperation = 'lighter'; x.lineWidth = 6; x.strokeStyle = rgba(CY, 0.8); x.beginPath(); x.ellipse(0, -60, 276, 56, 0, 0, Math.PI); x.stroke(); x.restore();
  // column + plates bottom to top
  const colSeg = (y0, y1, w0, w1) => { x.save(); x.fillStyle = lg(x, -w0, 0, w0, 0, [rgba('#7fe6ff', 0.0), rgba('#8ff2ff', 0.85), '#ffffff', '#ffffff', rgba('#ffb0f4', 0.85), rgba('#ff5fd0', 0)]); x.beginPath(); x.moveTo(-w0, y0); x.lineTo(-w1, y1); x.lineTo(w1, y1); x.lineTo(w0, y0); x.fill(); x.restore(); };
  const toks = []; const N = 46; for (let i = 0; i < N; i++) { const sp = 0.3 + hash(i * 3) * 0.16, q = (t * sp + hash(i * 7)) % 1; if (hash(i * 13) > pour) continue; const y = lerp(topY - 700, base, Math.pow(q, 1.25)), a = hash(i * 5) * TAU + q * 13, inTop = clamp((topY - y) / 700), R = y < topY ? lerp(70, 320, inTop * inTop) : 52 + 26 * Math.sin(q * 20 + i); toks.push({ i, y, x: Math.cos(a) * R, z: Math.sin(a), s: TOK[i % TOK.length], c: i % 4 }); }
  const drawTok = (q, dim) => { const s = q.y < topY ? 1 : 0.72; x.save(); x.translate(q.x, q.y); x.rotate(Math.sin(q.i + t * 2) * 0.3); x.scale(s, s); const w = 20 + q.s.length * 17; x.globalAlpha *= (q.z > 0 ? 1 : 0.7); const TC = [['#8a5cff', '#3412b8'], ['#3fb4ff', '#1a3cd8'], ['#ff7fe0', '#a01ab0'], ['#6a3cf5', '#2a0f9c']][q.c]; x.fillStyle = 'rgba(255,255,255,0.85)'; x.fill(rr(-w / 2 - 4, -24, w + 8, 48, 15)); x.fillStyle = lg(x, 0, -20, 0, 20, TC); x.fill(rr(-w / 2, -20, w, 40, 12)); text(x, q.s, 0, 1, '#fff', 27, { mono: true, w: 800 }); x.restore(); };
  toks.filter(q => q.y < topY && q.z < 0).forEach(q => drawTok(q));
  colSeg(base + 10, Y[0] + 20, 120, 64);
  PL.forEach((p, i) => {
    const y = Y[i], R = p.R, ry = R * p.k, passing = toks.reduce((a, q) => a + Math.max(0, 1 - Math.abs(q.y - y) / 34) * 0.16, 0), hot = clamp(passing + fl * 0.8 + ch * (0.4 + 0.4 * Math.sin(t * 30 - i)));
    // shadow/light pool onto plate below is baked by the column; draw plate
    x.save(); x.translate(0, y); cached(x, 'lpPl' + i, -R - 20, -ry - 30, R * 2 + 40, ry * 2 + TH + 60, g => plateSprite(g, R, p.k, i), 2);
    // spinning studs on the rim and on the face
    const dir = i % 2 ? -1 : 1, n = 10 + i % 3 * 2; for (let j = 0; j < n; j++) { const a = j * TAU / n + t * dir * (0.7 + i * 0.09 + ch * 3); const s = Math.sin(a), c = Math.cos(a); if (s > 0.05) { x.fillStyle = j % 3 ? 'rgba(255,255,255,0.9)' : '#ff9af0'; x.beginPath(); x.ellipse(c * (R - 1), s * ry + TH * 0.52, 8 * s + 1, 8, 0, 0, TAU); x.fill(); } x.globalAlpha = 0.65; x.fillStyle = '#eafdff'; x.beginPath(); x.ellipse(c * R * 0.86, s * ry * 0.86, 6.5, 3, 0, 0, TAU); x.fill(); x.globalAlpha = 1; }
    if (hot > 0.02) { x.save(); x.globalCompositeOperation = 'lighter'; x.scale(1, p.k); x.fillStyle = rg(x, 0, 0, R, [rgba('#ffffff', 0.8 * hot), rgba(CY, 0.5 * hot), rgba(MG, 0.12 * hot)]); x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill(); x.restore(); }
    x.restore();
    const y1 = i < 6 ? Y[i + 1] + TH + 4 : topY + 6, w0 = 62, w1 = i < 6 ? 62 : 34; toks.filter(q => q.y >= y1 - 10 && q.y < y && q.z < 0).forEach(q => drawTok(q)); colSeg(y + 4, y1, w0, w1); toks.filter(q => q.y >= y1 - 10 && q.y < y && q.z >= 0).forEach(q => drawTok(q));
    // plate's own glow spilling up the column
    glow(x, 0, y, R * 0.8, '#9af2ff', 0.1 + hot * 0.3);
  });
  // the light itself, seen through the glass
  x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = lg(x, -120, 0, 120, 0, [rgba('#7fe6ff', 0), rgba('#8ff2ff', 0.3), rgba('#f4feff', 0.8), rgba('#f4feff', 0.8), rgba('#ffb0f4', 0.3), rgba('#ff5fd0', 0)]); x.beginPath(); x.moveTo(-96, base); x.lineTo(-66, Y[3]); x.lineTo(-48, topY); x.lineTo(48, topY); x.lineTo(66, Y[3]); x.lineTo(96, base); x.fill(); x.restore();
  toks.filter(q => q.y >= topY && q.z > 0.1).forEach(q => drawTok(q));
  // crown lens
  x.save(); x.translate(0, topY); ink(x, poly([[-104, 34], [104, 34], [76, -10], [-76, -10]], 14), { f: MET, g: [0, 0, 1, 0], sh: [['rgba(20,0,90,0.6)', 14, 0, -8], ['rgba(255,255,255,0.9)', 6, 0, 4]] }); ink(x, blob([[-70, -8], [-66, -50], [0, -84], [66, -50], [70, -8], [0, 4]]), { f: ['#ffffff', '#bff6ff', '#7a8cff', '#c24bf0'], r: [0.36, 0.3, 0.9], sh: [['rgba(60,0,160,0.5)', 20, -9, -8], ['rgba(255,255,255,1)', 10, 5, 6]] }); glow(x, 0, -40, 240, '#dffbff', 0.8); x.restore();
  toks.filter(q => q.y < topY && q.z >= 0).forEach(q => drawTok(q));
  // front ribs with clamps, outside the silhouette
  [-1, 1].forEach(s => { rib(s, 1, [[40, 'rgba(20,0,90,0.55)'], [34, s < 0 ? '#e9e2ff' : '#a06cff'], [22, s < 0 ? '#b59cff' : '#6a2ee0'], [7, s < 0 ? '#ffffff' : '#ffb4f4']]); PL.forEach((p, i) => { if (i % 2 === 0) return; const px = s * (p.R + 18), py = Y[i] + TH / 2; ink(x, rr(px - 30, py - 25, 60, 50, 16), { f: ['#ffffff', '#b59cff', '#4a22c8'], g: [0.2, 0, 0.8, 1], sh: [['rgba(20,0,100,0.6)', 12, -6, -6], ['rgba(255,255,255,0.95)', 6, 3, 4]], drop: ['rgba(10,0,60,0.5)', 14, 0, 8] }); x.fillStyle = s < 0 ? CY : MG; x.beginPath(); x.arc(px, py, 10, 0, TAU); x.fill(); glow(x, px, py, 60, s < 0 ? CY : MG, 0.7); }); });
  // arcs
  for (let i = 0; i < 4 + ch * 4; i++) { const fr = Math.floor(t * 9 + i * 0.37), u = (t * 9 + i * 0.37) % 1; if (hash(fr * 31 + i * 7) > 0.5 + ch * 0.4) continue; const a = Math.floor(hash(fr * 3 + i) * 5), s = hash(fr * 5 + i) > 0.5 ? 1 : -1, b = Math.min(6, a + 1 + Math.floor(hash(fr + i) * 2)); x.save(); x.globalAlpha *= 1 - u * u; bolt(x, [s * PL[a].R * 0.97, Y[a] + 10], [s * PL[b].R * (0.4 + hash(fr) * 0.55), Y[b] + TH], t, i, s < 0 ? CY : MG, 5, 24); x.restore(); }
  if (ch > 0) { glow(x, 0, Y[3], 460 * ch, '#8ff2ff', 0.55 * ch); glow(x, 0, Y[3], 170 * ch, '#ffffff', 0.9 * ch); }
  return { Y, topY };
}
