// Brand marks: a soft glossy medallion carrying the real logo, with a courier halo and little jets.
import { LOGOS } from './logos.js';
import { K, ink, circ, rr, ell, rgba, mix, lg, rg, glow, clamp, lerp, TAU, text } from './ink.js';
const P = new Map(); const paths = n => { if (!P.has(n)) P.set(n, LOGOS[n].d.map(d => new Path2D(d))); return P.get(n); };
// logo only, centred, size = box side
export function logo(x, n, cx, cy, size, o = {}) { const L = LOGOS[n], k = size / 24; x.save(); x.translate(cx, cy); if (o.rot) x.rotate(o.rot); x.scale(k, k); x.translate(-12, -12); paths(n).forEach((p, i) => { x.fillStyle = o.c || (Array.isArray(L.color) ? L.color[i] : L.color); x.fill(p, 'evenodd'); }); x.restore(); }
const FACE = { claude: ['#ffa27a', '#e0663c', '#a8381f'], codex: ['#5b6cff', '#3a2fd6', '#1c1192'], openai: ['#3de0b4', '#0d9a82', '#065a5c'], cursor: ['#4a4a66', '#23233a', '#0c0c1c'], copilot: ['#a77bff', '#6a3cf0', '#34169c'], github: ['#5a5a80', '#2c2c48', '#12121f'], grok: ['#4a4a5e', '#1e1e2c', '#08080f'], gemini: ['#8fc0ff', '#4d7dff', '#2a3cc8'], antigravity: ['#8fd0ff', '#4b84ff', '#2d3bd0'], google: ['#ffffff', '#f1ecff', '#cfc4f2'], cline: ['#ff8fd0', '#d63aa8', '#7a1a86'], kilo: ['#5a5560', '#2a2730', '#121014'], opencode: ['#6a6478', '#35303f', '#16131c'], goose: ['#ffb05e', '#ef6a2c', '#a02c16'], devin: ['#6af0d0', '#17a58e', '#0a5560'], amp: ['#ff9a8a', '#f04a3c', '#9a1c28'], zed: ['#7fb4ff', '#2d6bf0', '#143a9c'] };
const MARK = { claude: '#fff4e8', zed: '#ffffff', antigravity: '#ffffff' }; // brand marks whose own colour is too close to the coin face
export function coin(x, n, cx, cy, R, t, o = {}) {
  const [c0, c1, c2] = FACE[n] || FACE.cursor, wob = Math.sin(t * 1.7 + R) * 0.1; x.save(); x.translate(cx, cy); x.rotate(wob * 0.4 + (o.rot || 0)); glow(x, 0, 0, R * 2.1, c0, 0.28 * (o.glow ?? 1));
  // jets
  if (o.jets !== false) [-1, 1].forEach(q => { const f = 0.75 + 0.25 * Math.sin(t * 30 + q), jx = q * R * 0.62, jy = R * 0.86; glow(x, jx, jy + R * 0.25, R * 0.5 * f, K.cyan, 0.5 * (o.jet ?? 1)); x.fillStyle = lg(x, 0, jy, 0, jy + R * 0.7 * f, ['#ffffff', rgba(K.cyan, 0.7), rgba(K.cyan, 0)]); x.beginPath(); x.moveTo(jx - R * 0.1, jy); x.quadraticCurveTo(jx, jy + R * 1.1 * f * (o.jet ?? 1), jx + R * 0.1, jy); x.fill(); ink(x, rr(jx - R * 0.15, jy - R * 0.16, R * 0.3, R * 0.22, R * 0.08), { f: ['#b9a6ff', '#4a34bd'], sh: [['rgba(16,4,80,0.6)', R * 0.1, -R * 0.05, -R * 0.05]] }); });
  ink(x, circ(0, 0, R * 1.1), { f: ['#ffffff', '#cbbcff', '#6f57dc'], g: [0.1, 0, 0.8, 1], sh: [['rgba(40,14,140,0.6)', R * 0.18, -R * 0.08, -R * 0.08]], drop: ['rgba(6,2,40,0.5)', R * 0.35, 0, R * 0.16] });
  ink(x, circ(0, 0, R * 0.97), { f: [c0, c1, c2], g: [0.2, 0, 0.75, 1], sh: [['rgba(6,0,40,0.55)', R * 0.42, -R * 0.2, -R * 0.2], ['rgba(255,255,255,0.55)', R * 0.16, R * 0.07, R * 0.1]], grain: 0.12 });
  x.save(); x.shadowColor = 'rgba(8,0,40,0.5)'; x.shadowBlur = R * 0.14 * x.getTransform().a; x.shadowOffsetY = R * 0.06 * x.getTransform().a; x.save(); x.transform(Math.cos(wob), 0, wob * 0.12, 1, 0, 0); logo(x, n, 0, 0, R * (o.k ?? 1.06), { c: o.c || MARK[n] }); x.restore(); x.restore();
  x.save(); x.clip(circ(0, 0, R * 0.97)); x.fillStyle = lg(x, 0, -R, 0, R * 0.1, ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']); x.fill(ell(-R * 0.12, -R * 0.52, R * 0.8, R * 0.42, -0.15)); x.restore();
  // courier ring
  x.lineCap = 'round'; x.strokeStyle = rgba('#ffffff', 0.9); x.lineWidth = R * 0.045; x.beginPath(); x.arc(0, 0, R * 1.3, t * 1.4, t * 1.4 + 1.5); x.stroke(); x.strokeStyle = rgba(c0, 0.9); x.beginPath(); x.arc(0, 0, R * 1.3, t * 1.4 + 2.2, t * 1.4 + 4.4); x.stroke(); const a = t * 1.4 + 1.5; x.fillStyle = '#fff'; x.beginPath(); x.arc(Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3, R * 0.07, 0, TAU); x.fill();
  if (o.name) text(x, o.name, 0, R * 1.78, '#fff', R * 0.36, { w: 800 }); x.restore();
}
