// The cast, modelled in detail.
// • Octocat, as a sleek product render: a smooth vinyl-toy body in GitHub charcoal lit by a purple
//   (left) and blue (right) rim light with a soft + crisp specular, a peach face with glossy eyes
//   (iris gradient, pupil, two catchlights, lid line), blush, pink inner ears, and five tube-shaded
//   tentacles with small suckers on the inside of each curl. The head is the Invertocat's own
//   (unit = head half-width) so the model lines up with the mark it emerges from.
// • Claude: built from refs/claude-mascot.png. The sprite is an 8×6 grid of 18.4 px cells (body
//   147×107 px) + 2×2 arms on rows 2–3 + four 1×2 legs (columns 0, 2, 5, 7) + 1×1 black eyes at (1,1)
//   and (6,1); colour #DA7758. Drawn as a smooth extruded slab: shaded front faces, lit top/side faces.
import { P, rgba, mix } from './palette.js';
import { TAU, clamp } from './core.js';

// ================================================================= Octocat
const headOutline = (() => {
  const pts = [], N = 160, ears = [-2.28, -0.86];
  for (let i = 0; i < N; i++) {
    const th = -Math.PI + i / N * TAU;
    let bump = 0;
    for (const e of ears) { const d = Math.atan2(Math.sin(th - e), Math.cos(th - e)); bump = Math.max(bump, Math.pow(Math.max(0, 1 - Math.abs(d) / 0.36), 1.7)); }
    const r = 1 + bump * 0.62;
    pts.push([Math.cos(th) * r, Math.sin(th) * 0.84 * r - bump * 0.05]);
  }
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
})();
const B = { hi: '#666e7d', mid: '#2c3139', lo: '#0b0d11' };
const RIM_L = '#b38cff', RIM_R = '#6fb8ff';

function tentacle(ctx, x0, y0, base, len, w0, t, phase, curl) {
  const N = 22, pts = [];
  let x = x0, y = y0, a = base;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push([x, y, a]);
    a = base + curl * Math.pow(u, 1.5) * 2.6 + 0.26 * Math.sin(t * 2.6 + phase + u * 3) * u;
    x += Math.cos(a) * len / N; y += Math.sin(a) * len / N;
  }
  const W = u => w0 * (1 - u * 0.86) * 0.5;
  const left = [], right = [];
  pts.forEach(([px, py, pa], i) => { const w = W(i / N), nx = -Math.sin(pa), ny = Math.cos(pa); left.push([px + nx * w, py + ny * w]); right.push([px - nx * w, py - ny * w]); });
  const p = new Path2D();
  left.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)));
  const [ex, ey, ea] = pts[N];
  p.arc(ex, ey, W(1), ea + Math.PI / 2, ea - Math.PI / 2, true);
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
  p.closePath();
  ctx.fillStyle = B.mid; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  ctx.lineCap = 'round';
  // tube shading: lit band toward the key light (upper side), core shadow, thin specular
  const lit = Math.sin(base) > 0 ? 1 : -1;
  for (let i = 0; i < N; i++) {
    const [ax, ay, aa] = pts[i], [bx, by] = pts[i + 1], w = W(i / N), nx = -Math.sin(aa), ny = Math.cos(aa);
    const s = (ny < 0 ? 1 : -1); // side of the tube facing up
    ctx.strokeStyle = 'rgba(150,160,190,0.32)'; ctx.lineWidth = w * 0.7;
    ctx.beginPath(); ctx.moveTo(ax + nx * w * 0.4 * s, ay + ny * w * 0.4 * s); ctx.lineTo(bx + nx * w * 0.4 * s, by + ny * w * 0.4 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = w * 0.7;
    ctx.beginPath(); ctx.moveTo(ax - nx * w * 0.75 * s, ay - ny * w * 0.75 * s); ctx.lineTo(bx - nx * w * 0.75 * s, by - ny * w * 0.75 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = w * 0.14;
    ctx.beginPath(); ctx.moveTo(ax + nx * w * 0.45 * s, ay + ny * w * 0.45 * s); ctx.lineTo(bx + nx * w * 0.45 * s, by + ny * w * 0.45 * s); ctx.stroke();
  }
  ctx.restore();
  // rim light along the silhouette
  const rg = ctx.createLinearGradient(-1.2, 0, 1.2, 0);
  rg.addColorStop(0, rgba(RIM_L, 0.75)); rg.addColorStop(0.5, rgba(RIM_L, 0.15)); rg.addColorStop(1, rgba(RIM_R, 0.7));
  ctx.strokeStyle = rg; ctx.lineWidth = 0.016; ctx.stroke(p);
  // small suckers on the inside of the curl, toward the tip
  const inner = curl >= 0 ? 1 : -1;
  for (let i = 9; i < N - 1; i += 2) {
    const [px, py, pa] = pts[i], w = W(i / N), nx = -Math.sin(pa), ny = Math.cos(pa);
    const cx = px + nx * w * 0.55 * inner, cy = py + ny * w * 0.55 * inner, rr = w * 0.34;
    ctx.fillStyle = 'rgba(196,186,240,0.75)'; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.7, pa, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(80,72,140,0.9)'; ctx.beginPath(); ctx.ellipse(cx - nx * rr * 0.1 * inner, cy - ny * rr * 0.1 * inner, rr * 0.5, rr * 0.34, pa, 0, TAU); ctx.fill();
  }
  void lit;
  return [ex, ey];
}

// o: { rot, look:[x,y], blink 0..1, happy 0..1, mouth 0..1, t, cheer 0..1, wave 0..1, a, grow 0..1, squash }
export function octocat(ctx, x, y, s, o = {}) {
  const { rot = 0, look = [0, 0], blink = 0, happy = 0, mouth = 0, t = 0, cheer = 0, wave = 0, a = 1, grow = 1, squash = 0, body = 1 } = o;
  let tip = [0, 0];
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * (1 + squash * 0.08), s * (1 - squash * 0.08));
  // ---- tentacles (behind the torso)
  const roots = [[-0.36, 1.08, 2.25, 1], [-0.18, 1.16, 1.92, 1], [0, 1.2, 1.6, 0], [0.18, 1.16, 1.25, -1], [0.36, 1.08, 0.9, -1]];
  if (grow > 0.01 && body > 0) roots.forEach(([rx, ry, ang, side], i) => {
    const isWave = i === 4 && wave > 0;
    const raise = side * cheer * (i === 0 || i === 4 ? 1.35 : 0.5);
    let base = ang + raise, curl = (side || 1) * 0.6 * (0.4 + 0.6 * grow), len = 0.98;
    if (isWave) { base = ang + (-1.25 - ang) * wave + Math.sin(t * 9) * 0.22 * wave; curl = -0.75 - 0.35 * Math.sin(t * 9 + 1); len = 1.05; }
    const tp = tentacle(ctx, rx, ry, base, len * grow, 0.28 * (0.45 + 0.55 * grow), t, i * 1.7, curl);
    if (i === 4) tip = tp;
  });
  // ---- torso
  if (body > 0) {
    const torso = new Path2D();
    torso.moveTo(-0.46, 0.58); torso.bezierCurveTo(-0.64, 0.78, -0.62, 1.08, -0.45, 1.2);
    torso.quadraticCurveTo(0, 1.3, 0.45, 1.2); torso.bezierCurveTo(0.62, 1.08, 0.64, 0.78, 0.46, 0.58); torso.closePath();
    const tg = ctx.createRadialGradient(-0.22, 0.78, 0.02, 0, 0.9, 0.75);
    tg.addColorStop(0, B.hi); tg.addColorStop(0.5, B.mid); tg.addColorStop(1, B.lo);
    ctx.fillStyle = tg; ctx.fill(torso);
    ctx.save(); ctx.clip(torso);
    const ao = ctx.createLinearGradient(0, 0.58, 0, 0.82); ao.addColorStop(0, 'rgba(0,0,0,0.6)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ao; ctx.fillRect(-0.7, 0.5, 1.4, 0.4); // the head's contact shadow
    const rg = ctx.createLinearGradient(-0.65, 0, 0.65, 0);
    rg.addColorStop(0, rgba(RIM_L, 0.9)); rg.addColorStop(0.3, rgba(RIM_L, 0)); rg.addColorStop(0.7, rgba(RIM_R, 0)); rg.addColorStop(1, rgba(RIM_R, 0.8));
    ctx.strokeStyle = rg; ctx.lineWidth = 0.09; ctx.stroke(torso);
    ctx.restore();
  }
  // ---- head
  const g = ctx.createRadialGradient(-0.38, -0.52, 0.04, 0, 0.05, 1.35);
  g.addColorStop(0, B.hi); g.addColorStop(0.42, B.mid); g.addColorStop(1, B.lo);
  ctx.fillStyle = g; ctx.fill(headOutline);
  ctx.save(); ctx.clip(headOutline);
  // bounce light from below + rim lights (clipped strokes = crisp inner rims with soft falloff)
  const bl = ctx.createLinearGradient(0, 0.2, 0, 0.9); bl.addColorStop(0, 'rgba(137,87,229,0)'); bl.addColorStop(1, 'rgba(137,87,229,0.22)');
  ctx.fillStyle = bl; ctx.fillRect(-1.6, -1.4, 3.2, 2.6);
  for (const [lw, k] of [[0.34, 0.25], [0.11, 0.95]]) {
    const rg = ctx.createLinearGradient(-1.15, 0, 1.15, 0);
    rg.addColorStop(0, rgba(RIM_L, k)); rg.addColorStop(0.34, rgba(RIM_L, 0)); rg.addColorStop(0.66, rgba(RIM_R, 0)); rg.addColorStop(1, rgba(RIM_R, k * 0.85));
    ctx.strokeStyle = rg; ctx.lineWidth = lw; ctx.stroke(headOutline);
  }
  // vinyl specular: broad soft lobe + crisp kidney highlight
  const spg = ctx.createRadialGradient(-0.4, -0.6, 0, -0.4, -0.6, 0.55);
  spg.addColorStop(0, 'rgba(255,255,255,0.22)'); spg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spg; ctx.fillRect(-1.2, -1.4, 1.8, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-0.5, -0.66, 0.16, 0.055, -0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(-0.75, -1.02, 0.05, 0.1, -0.4, 0, TAU); ctx.fill(); // ear glint
  // inner ears
  for (const sx of [-1, 1]) {
    const ear = new Path2D();
    ear.moveTo(sx * 0.53, -0.68); ear.quadraticCurveTo(sx * 0.76, -0.98, sx * 0.92, -0.97); ear.quadraticCurveTo(sx * 0.98, -0.72, sx * 0.85, -0.52); ear.closePath();
    const eg = ctx.createLinearGradient(sx * 0.6, -1.15, sx * 0.75, -0.5);
    eg.addColorStop(0, '#ffc2d1'); eg.addColorStop(1, '#c9627c');
    ctx.fillStyle = eg; ctx.fill(ear);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.02; ctx.stroke(ear);
  }
  // face
  const fx = look[0] * 0.08, fy = look[1] * 0.06;
  const face = new Path2D();
  face.moveTo(-0.72 + fx, 0.0 + fy);
  face.bezierCurveTo(-0.7 + fx, -0.32 + fy, -0.36 + fx, -0.3 + fy, -0.2 + fx, -0.2 + fy);
  face.quadraticCurveTo(0 + fx, -0.12 + fy, 0.2 + fx, -0.2 + fy);
  face.bezierCurveTo(0.36 + fx, -0.3 + fy, 0.7 + fx, -0.32 + fy, 0.72 + fx, 0.0 + fy);
  face.bezierCurveTo(0.76 + fx, 0.52 + fy, 0.38 + fx, 0.74 + fy, 0 + fx, 0.74 + fy);
  face.bezierCurveTo(-0.38 + fx, 0.74 + fy, -0.76 + fx, 0.52 + fy, -0.72 + fx, 0.0 + fy);
  const fg = ctx.createRadialGradient(-0.18 + fx, 0.02 + fy, 0.05, fx, 0.25 + fy, 0.9);
  fg.addColorStop(0, '#ffe8d8'); fg.addColorStop(0.55, '#f4c6a8'); fg.addColorStop(1, '#d4917a');
  ctx.fillStyle = fg; ctx.fill(face);
  ctx.save(); ctx.clip(face);
  const brow = ctx.createLinearGradient(0, -0.3 + fy, 0, 0.05 + fy);
  brow.addColorStop(0, 'rgba(90,40,30,0.4)'); brow.addColorStop(1, 'rgba(90,40,30,0)');
  ctx.fillStyle = brow; ctx.fillRect(-1, -0.4, 2, 0.5);
  const jaw = ctx.createLinearGradient(0, 0.45 + fy, 0, 0.76 + fy);
  jaw.addColorStop(0, 'rgba(120,50,50,0)'); jaw.addColorStop(1, 'rgba(120,50,50,0.25)');
  ctx.fillStyle = jaw; ctx.fillRect(-1, 0.4, 2, 0.4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,30,25,0.35)'; ctx.lineWidth = 0.015; ctx.stroke(face);
  ctx.restore(); // head clip
  // cheeks
  for (const sx of [-1, 1]) {
    const cg = ctx.createRadialGradient(sx * 0.5 + fx, 0.42 + fy, 0, sx * 0.5 + fx, 0.42 + fy, 0.16);
    cg.addColorStop(0, `rgba(255,110,140,${0.42 + happy * 0.2})`); cg.addColorStop(1, 'rgba(255,110,140,0)');
    ctx.fillStyle = cg; ctx.fillRect(sx * 0.5 + fx - 0.17, 0.25 + fy, 0.34, 0.34);
  }
  // eyes
  const ex = look[0] * 0.07 + fx, ey = look[1] * 0.05 + fy;
  for (const sx of [-1, 1]) {
    const cx = sx * 0.32 + ex, cy = 0.14 + ey;
    if (happy > 0.5) {
      ctx.strokeStyle = '#2a1712'; ctx.lineWidth = 0.075; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy + 0.07, 0.12, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      continue;
    }
    const ry = 0.18;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, 0.135, ry, 0, 0, TAU); ctx.clip();
    const ig = ctx.createRadialGradient(cx + look[0] * 0.02, cy + 0.08, 0.01, cx, cy, 0.2);
    ig.addColorStop(0, '#93603f'); ig.addColorStop(0.45, '#4a2a1c'); ig.addColorStop(1, '#120907');
    ctx.fillStyle = ig; ctx.fillRect(cx - 0.2, cy - 0.2, 0.4, 0.4);
    ctx.fillStyle = '#080404'; ctx.beginPath(); ctx.ellipse(cx + look[0] * 0.025, cy + look[1] * 0.02 + 0.01, 0.068, 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(cx - 0.2, cy - 0.2, 0.4, 0.06); // lid shadow
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx + 0.045, cy - 0.07, 0.048, 0.056, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 0.05, cy + 0.075, 0.022, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(163,113,247,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + 0.15, 0.1, 0.04, 0, 0, TAU); ctx.fill(); // bounce in the lower iris
    if (blink > 0.02) { ctx.fillStyle = '#f0bea0'; ctx.fillRect(cx - 0.2, cy - 0.2, 0.4, 0.4 * blink * 1.02); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,18,12,0.65)'; ctx.lineWidth = 0.022;
    ctx.beginPath(); ctx.ellipse(cx, cy, 0.135, ry, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  // nose
  const ng = ctx.createLinearGradient(0, 0.3 + fy, 0, 0.42 + fy);
  ng.addColorStop(0, '#ff9fb0'); ng.addColorStop(1, '#d45f78');
  ctx.fillStyle = ng;
  ctx.beginPath(); ctx.moveTo(-0.075 + fx, 0.325 + fy); ctx.quadraticCurveTo(0 + fx, 0.295 + fy, 0.075 + fx, 0.325 + fy); ctx.quadraticCurveTo(0 + fx, 0.44 + fy, -0.075 + fx, 0.325 + fy); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-0.02 + fx, 0.323 + fy, 0.022, 0.011, 0, 0, TAU); ctx.fill();
  if (mouth > 0.05) {
    ctx.fillStyle = '#4a1a26';
    ctx.beginPath(); ctx.moveTo(-0.14 + fx, 0.44 + fy); ctx.quadraticCurveTo(0 + fx, 0.42 + fy, 0.14 + fx, 0.44 + fy);
    ctx.quadraticCurveTo(0.12 + fx, 0.44 + mouth * 0.2 + fy, 0 + fx, 0.46 + mouth * 0.22 + fy); ctx.quadraticCurveTo(-0.12 + fx, 0.44 + mouth * 0.2 + fy, -0.14 + fx, 0.44 + fy); ctx.fill();
    const tg2 = ctx.createRadialGradient(fx, 0.52 + mouth * 0.1 + fy, 0, fx, 0.52 + mouth * 0.1 + fy, 0.09);
    tg2.addColorStop(0, '#ffb3c0'); tg2.addColorStop(1, '#e0607a');
    ctx.fillStyle = tg2; ctx.beginPath(); ctx.ellipse(0 + fx, 0.5 + mouth * 0.13 + fy, 0.07, 0.04 * mouth + 0.012, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-0.05 + fx, 0.438 + fy, 0.1, 0.018);
  } else {
    ctx.strokeStyle = '#7a3f3a'; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0 + fx, 0.4 + fy); ctx.quadraticCurveTo(-0.06 + fx, 0.47 + fy, -0.12 + fx, 0.42 + fy);
    ctx.moveTo(0 + fx, 0.4 + fy); ctx.quadraticCurveTo(0.06 + fx, 0.47 + fy, 0.12 + fx, 0.42 + fy); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(150,80,65,0.45)';
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(sx * (0.2 + k * 0.06) + fx, 0.45 + (k % 2) * 0.04 + fy, 0.012, 0, TAU); ctx.fill(); }
  ctx.restore();
  const c = Math.cos(rot), sn = Math.sin(rot);
  return { tip: [x + (c * tip[0] - sn * tip[1]) * s, y + (sn * tip[0] + c * tip[1]) * s] };
}

// soft contact shadow for a character standing at y
export function contactShadow(ctx, x, y, w, a = 0.6) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, 0.18);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
  ctx.restore();
}

// ================================================================= Claude (extruded pixel slab)
const BODY = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) BODY.push([c, r]);
const LEGS = [[0, 6], [0, 7], [2, 6], [2, 7], [5, 6], [5, 7], [7, 6], [7, 7]];
const EYES = [[1, 1], [6, 1]];
const DX = 0.5, DY = -0.36; // extrusion (cells) toward the upper right
const C_TOP = '#f4ad8f', C_SIDE = '#a24b2c', C_SIDE2 = '#8a3e24';

// one smooth front face (soft vertical-diagonal gradient + bevel light/shadow edges)
function face(ctx, x, y, w, h, dark = false) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, dark ? '#d97a5b' : '#ec9374'); g.addColorStop(0.55, dark ? '#c4664a' : P.clay); g.addColorStop(1, dark ? '#a9533a' : '#c9643f');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = 'rgba(255,228,210,0.55)';
  ctx.beginPath(); ctx.moveTo(x + 0.04, y + h); ctx.lineTo(x + 0.04, y + 0.04); ctx.lineTo(x + w, y + 0.04); ctx.stroke();
  ctx.strokeStyle = 'rgba(110,40,20,0.35)';
  ctx.beginPath(); ctx.moveTo(x + w - 0.04, y + 0.1); ctx.lineTo(x + w - 0.04, y + h - 0.04); ctx.lineTo(x + 0.1, y + h - 0.04); ctx.stroke();
}
function eye(ctx, x, y, happy, eyesOpen) {
  if (happy > 0.5) { // pixel chevron eyes: ^
    ctx.fillStyle = '#18100d';
    for (const [px, py] of [[0, 2], [1, 1], [2, 2]]) ctx.fillRect(x + px / 3 + 0.02, y + py / 3 - 0.1, 0.3, 0.3);
    return;
  }
  const h = Math.max(0.18, eyesOpen);
  const g = ctx.createLinearGradient(0, y, 0, y + 1);
  g.addColorStop(0, '#000000'); g.addColorStop(1, '#2a1a16');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 0.06, y + 0.06 + (1 - h) * 0.45, 0.88, 0.88 * h, 0.1); ctx.fill();
  if (h > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x + 0.2, y + 0.2, 0.22, 0.22); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 0.6, y + 0.62, 0.12, 0.12); }
}
function slabSides(ctx, cells, off = [0, 0]) {
  const has = new Set(cells.map(([c, r]) => c + ',' + r));
  for (const [c, r] of cells) {
    const x = c + off[0], y = r + off[1];
    if (!has.has(c + ',' + (r - 1))) { // top face
      ctx.fillStyle = C_TOP; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y); ctx.lineTo(x + 1 + DX, y + DY); ctx.lineTo(x + DX, y + DY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,230,0.5)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x + DX, y + DY); ctx.lineTo(x + 1 + DX, y + DY); ctx.stroke();
    }
    if (!has.has((c + 1) + ',' + r)) { // right face
      const g = ctx.createLinearGradient(x + 1, y, x + 1 + DX, y + 1);
      g.addColorStop(0, C_SIDE); g.addColorStop(1, C_SIDE2);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1 + DX, y + DY); ctx.lineTo(x + 1 + DX, y + 1 + DY); ctx.lineTo(x + 1, y + 1); ctx.closePath(); ctx.fill();
    }
  }
}
function armBlock(ctx, px, py, ang, side) {
  // 2×2 block rotated about its inner-top corner (px, py); extrusion stays world-aligned
  const x0 = side < 0 ? -2 : 0;
  const corners = [[x0, 0], [x0 + 2, 0], [x0 + 2, 2], [x0, 2]]; // clockwise (y down)
  // side faces: for each rotated edge facing the extrusion direction
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const rot = ([u, v]) => [px + u * ca - v * sa, py + u * sa + v * ca];
  const pts = corners.map(rot);
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const nx = ey, ny = -ex; // outward normal for clockwise order
    if (nx * DX + ny * DY <= 0) continue;
    const up = -ny / Math.hypot(nx, ny);
    ctx.fillStyle = up > 0.5 ? C_TOP : C_SIDE;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0] + DX, b[1] + DY); ctx.lineTo(a[0] + DX, a[1] + DY); ctx.closePath(); ctx.fill();
  }
  ctx.save();
  ctx.translate(px, py); ctx.rotate(ang);
  face(ctx, x0, 0, 2, 2);
  ctx.restore();
}

// Origin at the feet (bottom centre); s = body width in px (8 cells).
// o: { squash, arms 0..1, t, eyes 0..1 (open), happy 0..1, lean, a, look }
export function claude(ctx, x, y, s, o = {}) {
  const { squash = 0, arms = 0, t = 0, eyes = 1, happy = 0, lean = 0, a = 1, look = 0 } = o;
  const cell = s / 8;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.scale(cell * (1 + squash * 0.12), cell * (1 - squash * 0.12));
  ctx.transform(1, 0, -lean * 0.15, 1, 0, 0);
  ctx.translate(-4, -8); // grid origin: body top-left
  // faint warm bounce so the clay reads on dark UI
  const hg = ctx.createRadialGradient(4, 4, 1, 4, 4, 8);
  hg.addColorStop(0, 'rgba(255,150,110,0.10)'); hg.addColorStop(1, 'rgba(255,150,110,0)');
  ctx.fillStyle = hg; ctx.fillRect(-6, -4, 16, 16);
  // legs (with a little kick when hopping)
  const kick = squash < 0 ? -squash * 0.3 : 0;
  slabSides(ctx, LEGS.map(([c, r]) => [c, r]), [0, 0]);
  for (const c of [0, 2, 5, 7]) { ctx.save(); ctx.translate(0, (c === 0 || c === 7) ? kick : -kick * 0.5); face(ctx, c, 6, 1, 2, true); ctx.restore(); }
  // arms behind the body edge, rotating about the shoulder corner
  const wav = k => arms > 0 ? Math.sin(t * 14 + k) * 0.18 * arms : 0;
  armBlock(ctx, 0, 2, arms * 1.25 + wav(0), -1);    // +angle lifts the left arm (y down)
  armBlock(ctx, 8, 2, -(arms * 1.25 + wav(1.2)), 1); // −angle lifts the right arm
  // body slab
  slabSides(ctx, BODY);
  face(ctx, 0, 0, 8, 6);
  for (const [c, r] of EYES) {
    ctx.save(); ctx.translate(look * 0.08, 0);
    eye(ctx, c, r, happy, eyes);
    ctx.restore();
  }
  // top-left specular glint + subtle ambient occlusion where the legs meet the body
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0.25, 0.22, 0.5, 0.12);
  const ao = ctx.createLinearGradient(0, 6, 0, 6.6);
  ao.addColorStop(0, 'rgba(60,20,10,0.5)'); ao.addColorStop(1, 'rgba(60,20,10,0)');
  ctx.fillStyle = ao;
  for (const c of [0, 2, 5, 7]) ctx.fillRect(c + 0.03, 6, 0.94, 0.6);
  ctx.restore();
}
