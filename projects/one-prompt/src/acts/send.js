// SEND: you type, the words become one tiny capsule, and a colossal train is coupled in front of it.
import { bg, clamp, lerp, K, label, text, key, ease, spline, noise, lg, rg, rgba, glow, hash, ell, rr, TAU, ink, circ, sparkle } from '../ink.js';
import { gl } from '../gl.js';
import { spring, ring } from '../sim.js';
import { T, into, scr, REST, X1, HW, HE, DECK, G0, keyT } from './send_t.js';
import { train, capsule, tx, ty, tv, tp, coupler } from './send_train.js';
import { bay, track, portal, keys, glyphs, squeeze, enterKey, typeFx, updraft, papers } from './send_bay.js';
import { fibre, sea, camSea, XG, XT, yU, yD, J2 } from './send_sea.js';
import { steam, fx, lamp } from './send_fx.js';
import { robot, scarves, drawCap, capChain, lever, held, body, BT } from './send_cast.js';
const B0 = T.in - 0.1, B1 = T.fib + 0.3;
// ---- camera of the bay: [x, rail's screen y, zoom]
const CK = [[T.in, [0, 830, 1]], [T.enter - 0.3, [0, 830, 1]], [T.enter + 0.02, [0, 842, 0.96]], [T.catch, [60, 850, 1.04], ease.io2], [T.land + 0.12, [0, 856, 1.3], ease.io2], [T.rumble + 0.1, [0, 856, 1.36]], [T.eng - 0.3, [-120, 850, 1.1], ease.io2], [T.eng + 0.05, [-60, 850, 0.86]], [T.stop - 0.3, [900, 862, 0.5], ease.io2], [T.stop + 0.1, [1700, 884, 0.415]], [T.h2 - 0.5, [1560, 884, 0.42]], [T.h2 - 0.12, [1080, 878, 0.43], ease.io2], [T.h2 + 0.05, [760, 890, 0.455], ease.out2], [T.h2 + 0.26, [690, 890, 0.45]], [T.h2 + 0.62, [-40, 884, 0.42], ease.io2], [T.h3 - 0.35, [-300, 884, 0.42]], [T.h3 - 0.1, [-1150, 878, 0.44], ease.io2], [T.h3 + 0.05, [-1400, 890, 0.455], ease.out2], [T.h3 + 0.24, [-1480, 890, 0.45]], [T.h3 + 0.58, [-2260, 884, 0.42], ease.io2], [T.h4 - 0.3, [-2420, 884, 0.42]], [T.h4 - 0.1, [-3350, 878, 0.44], ease.io2], [T.h4 + 0.05, [-3580, 890, 0.455], ease.out2], [T.h4 + 0.22, [-3640, 890, 0.45]], [T.h4 + 0.5, [-4420, 884, 0.43], ease.io2], [BT.lv, [-4700, 884, 0.42]], [BT.gr + 0.04, [-5620, 850, 0.82], ease.io2], [T.tink - 0.04, [-5640, 830, 1.16], ease.io2], [T.tink + 0.16, [-5640, 830, 1.2]], [T.brake - 0.1, [-5480, 850, 0.8], ease.io2], [T.brake + 0.14, [-250, 830, 0.152], ease.io3], [T.go + 0.12, [-200, 830, 0.153]], [T.go + 0.34, [-5050, 830, 0.52], ease.io2], [T.go + 0.5, [-5000, 830, 0.56]], [T.fib, [-2200, 830, 0.56], ease.in2]];
const camF = spring(B0, B1, t => { const k = key(t, CK); return [k[0], k[1], Math.log(k[2])]; }, 15, 0.9);
const SHK = [[T.enter, 34], [BT.l0, 8], [BT.d3, 7], [HIT(0), 16], [T.h2, 30], [T.h3, 30], [T.h4, 30], [BT.st + 0.05, 12], [T.tink, 2.5], [BT.t1, 8], [BT.t2, 9], [T.brake + 0.05, 8]]; function HIT() { return T.stop; }
export function camB(t) { const q = camF(t), z = Math.exp(q[2]); let s = SHK.reduce((a, [h, k]) => a + (t > h ? Math.exp(-(t - h) * 7) * k : 0), 0); s += t > T.rumble && t < T.eng ? ease.in2((t - T.rumble) / (T.eng - T.rumble)) * 14 : t >= T.eng && t < T.stop ? 14 : 0; s += t > T.brake && t < T.go + 0.3 ? 4 : 0; const e = 0.02, vx = (camF(t + e)[0] - camF(t - e)[0]) / (2 * e); return { x: q[0], y: (540 - q[1]) / z, z, sx: noise(t * 27, 3) * s, sy: noise(t * 27, 9) * s, r: noise(t * 17, 5) * s * 0.0005 + clamp(-vx * 0.0000022, -0.02, 0.02), vx }; }
const FAST = [[T.eng - 0.1, T.stop - 0.1], [T.h2 - 0.2, T.h2 + 0.2], [T.h3 - 0.2, T.h3 + 0.25], [T.h4 - 0.2, T.h4 + 0.25], [T.go + 0.4, T.fib], [T.kick - 0.1, T.gate + 0.3], [T.oth - 0.2, T.scan + 0.1], [T.tail, T.rush + 0.2]];
export const samples = (t, n) => ((t > T.brake && t < T.brake + 0.22) || (t > T.go + 0.1 && t < T.go + 0.42) ? n * 3 : FAST.some(([a, b]) => t > a && t < b) ? n * 2 : n);
function bayShot(x, t) {
  const c = camB(t); bay(x, c, t); portal(x, c, t, 'back'); track(x, c, t);
  { const k = 0.13 + 0.2 * ease.io2(clamp((t - T.eng) / 0.9)) - 0.1 * clamp((t - T.brake) / 0.2); const g = x.createRadialGradient(960, 560, 120, 960, 560, 1150); g.addColorStop(0, rgba('#041450', k * 0.55)); g.addColorStop(1, rgba('#030a3a', k * 1.25)); x.fillStyle = g; x.fillRect(0, 0, 1920, 1080); if (t > T.eng) glow(x, 960, 600, 900, '#37f0b4', 0.16 * clamp((t - T.eng) / 0.8)); }
  { const k = Math.max(...[[T.l1, T.l1e], [T.h2, T.h3 - 0.1], [T.h3, T.h4], [T.h4, T.tink - 0.2]].map(([a, b]) => clamp((t - a) / 0.2) * (1 - clamp((t - b) / 0.2)))); if (k > 0) { x.fillStyle = rg(x, 420, 60, 760, [rgba('#020a30', 0.62 * k), rgba('#020a30', 0.3 * k), rgba('#020a30', 0)]); x.fillRect(0, 0, 1300, 700); } }
  if (t < T.burst + 1) updraft(x, t);
  if (t > T.eng - 0.2) steam(x, c, t);
  into(x, c, 0, () => train(x, t, c));
  lamp(x, c, t);
  into(x, c, 0, () => { lever(x, t); if (t < T.pop + 0.6) keys(x, t); });
  scarves(x, c, t);
  into(x, c, 0, () => { if (t < T.enter + 0.02) robot(x, t); if (t < T.pop + 0.6) { glyphs(x, t); squeeze(x, t); enterKey(x, t); } if (t >= T.enter + 0.02) { if (t < T.enter + 0.55) { x.save(); x.restore(); } robot(x, t); } if (!held(t)) drawCap(x, t); capChain(x, t); });
  portal(x, c, t, 'front');
  if (t > T.rumble) fx(x, c, t);
  if (t < T.catch + 1) typeFx(x, c, t);
  if (t < T.burst + 1) papers(x, t);
}
const sub = (x, s, px, py, t, t0, t1, align) => { const k = ease.out3(clamp((t - t0) / 0.28)) * (1 - clamp((t - t1) / 0.25)); if (k <= 0) return; x.save(); x.globalAlpha = k; x.shadowColor = 'rgba(4,6,50,0.85)'; x.shadowBlur = 26; text(x, s, px, py + (1 - k) * 14, '#e6fbff', 42, { w: 700, align }); x.restore(); };
// SEAM OUT: cyan-white rush to the right
function rush(x, t) { const u = clamp((t - T.rush) / (T.out - 0.3 - T.rush)), L = []; x.save(); x.fillStyle = lg(x, 0, 0, 1920, 0, [rgba('#c9f6ff', ease.in3(u) * 0.9), rgba('#eafcff', ease.in2(clamp(u * 1.3)))]); x.fillRect(0, 0, 1920, 1080); x.restore(); for (let i = 0; i < 120; i++) { const sp = 2600 + hash(i * 5) * 5200, per = 3400, px = 2300 - ((hash(i * 3) * per + (t - T.rush) * sp) % per), l = (60 + hash(i * 7) * 220) * (0.3 + u); L.push([px, hash(i * 11) * 1080, -l, 0, 1.5 + hash(i * 13) * 6 * u, 2, i % 3 ? '#ffffff' : '#7fe6ff', 0.75 * ease.out2(u)]); } const G = gl(); G.clear(); G.parts(L); G.to(x); if (u > 0.6) { x.fillStyle = rgba('#c9f6ff', ease.io2((u - 0.6) / 0.4)); x.fillRect(0, 0, 1920, 1080); G.to(x, 0.6); } }
export function draw(x, t) {
  if (t < T.fib) { bayShot(x, t); const k = ease.in2(clamp((t - T.fib + 0.16) / 0.16)); if (k > 0) { x.fillStyle = rgba('#d9fff2', k); x.fillRect(0, 0, 1920, 1080); } }
  else if (t < T.sea + 0.22) {
    const u = clamp((t - T.sea + 0.1) / 0.32), rad = ease.in2(u) * 1350; if (u <= 0) fibre(x, t);
    else { sea(x, t); x.save(); x.beginPath(); x.rect(-10, -10, 1940, 1100); x.arc(960, 430, rad, 0, TAU, true); x.clip('evenodd'); fibre(x, t); x.restore(); x.save(); x.globalCompositeOperation = 'lighter'; [[70, 0.25], [26, 0.6], [8, 1]].forEach(([w, a]) => { x.strokeStyle = rgba('#d9fbff', a); x.lineWidth = w; x.beginPath(); x.arc(960, 430, Math.max(1, rad), 0, TAU); x.stroke(); }); x.restore(); }
    const k = 1 - clamp((t - T.fib) / 0.16); if (k > 0) { x.fillStyle = rgba('#eafff9', k); x.fillRect(0, 0, 1920, 1080); }
  } else sea(x, t);
  if (t > T.rush) rush(x, t);
  const lab = (str, px, py, t0, t1, code) => { const k = 1 - clamp((t - t1) / 0.13); if (k <= 0 || t < t0) return; x.save(); x.globalAlpha = k; label(x, str, px, py, 74, t, t0, null, code); x.restore(); };
  lab('Your prompt', 960, 104, T.lp0, T.lp1, 'need'); lab('Tool instructions', 470, 112, T.stop - 0.12, T.h2 - 0.13, 'need'); lab('Conversation so far', 470, 112, T.h2 + 0.04, T.h3 - 0.13, 'need'); lab('Project details', 470, 112, T.h3 + 0.04, T.h4 - 0.13, 'need'); lab('Attachments', 470, 112, T.h4 + 0.04, T.tink - 0.2, 'choice');
  { const k = clamp((t - T.brake - 0.1) / 0.15) * (1 - clamp((t - T.go - 0.12) / 0.1)); if (k > 0) { const q = scr(camB(t), tx(5, t), -60); x.save(); x.globalAlpha = k; x.strokeStyle = '#d9fff2'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(q[0] + 6, q[1] + 40); x.quadraticCurveTo(q[0] + 20, q[1] + 78, q[0] + 66, q[1] + 84); x.stroke(); label(x, 'Your prompt', q[0] + 84, q[1] + 84, 60, t, T.brake + 0.06, null, 'need', { align: 'l' }); x.restore(); } }
  label(x, 'Cline', 1236, 84, 74, t, T.kick + 0.26, T.oth - 0.08, null, { align: 'r' }); sub(x, 'your own key: straight to the model', 1236, 152, t, T.kick + 0.4, T.oth - 0.08, 'right');
  label(x, 'Cursor', 960, 78, 74, t, T.scan + 0.2, T.tail - 0.2, null, { align: 'l' }); sub(x, 'through its servers, even with your own key', 960, 146, t, T.scan + 0.36, T.tail - 0.2, 'left');
  return { bloom: 0.3, vig: 0.25, grain: 0.03 };
}
