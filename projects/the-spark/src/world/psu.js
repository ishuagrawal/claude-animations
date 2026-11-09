// Inside the power supply: a dim violet cavern. The switching transformer is the monument (ferrite E-core, copper
// windings, yellow polyester tape); bulk capacitors stand like trunks, heat-sinks like cliffs, a fan grille on the
// back wall lets in a little dusty light, and the output loom leaves through a grommet toward the motherboard.
// Units ~ millimetres. +x = toward the exit, +z = toward the first camera. Everything is a pure function of t.
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, Ribbon, shaftMat, fxMesh } from '../gl/fx.js';
import { rbox, cyl, mesh, inst, merge, at, V3 } from '../gl/geo.js';
import { canvasTexture } from '../gl/tex.js';
import { strike } from '../chars/spark.js';
import { rng, TAU, clamp, lerp, hash2, smooth, FPS } from '../core.js';

// ---- layout shared with the shots
export const TS = 1.35;                                                  // the transformer is modelled at 1:1 and scaled up
export const COIL = { r: 14 * TS, y0: 11.5 * TS, y1: 36.5 * TS, c: V3(0, 24 * TS, 0) };   // the winding (vertical axis through the origin)
export const INLET = V3(-46, 8.2, 54);                                    // live terminal: where the Spark arrives
export const HEAD = V3(72, 26, 30);                                       // crest of the output loom (first cable tie)
export const EXIT = V3(142, 30, 39);                                      // the grommet in the case wall
const FAN = V3(-119, 86, 74);                                             // fan grille on the left wall
const RAIL = [[54, 9, 24], [62, 21.5, 27], [72, 26, 30], [88, 23.8, 32], [106, 21.8, 34.2], [123, 24.8, 37], [136, 29, 38.6], [150, 30, 39.4], [186, 30, 40]];

function pcbTexture() {
  return canvasTexture(2048, 2048, (c, S) => {
    const r = rng(1107);
    c.fillStyle = '#1b1438'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 34; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '44,30,92' : '12,8,30'},${0.25 + r() * 0.3})`;
      const w = 200 + r() * 600, h = 140 + r() * 460; c.fillRect(r() * S - w / 2, r() * S - h / 2, w, h);
    }
    const wrap = fn => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { c.save(); c.translate(ox, oy); fn(); c.restore(); } };
    const poly = n => { let x = r() * S, y = r() * S, d = Math.floor(r() * 8); const pts = [[x, y]];
      for (let k = 0; k < n; k++) { const len = 110 + r() * 420; x += Math.cos(d * Math.PI / 4) * len; y += Math.sin(d * Math.PI / 4) * len; pts.push([x, y]); d = (d + (r() < 0.5 ? 1 : 7)) % 8; }
      return pts; };
    const path = pts => { c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); };
    // fat power traces under the solder mask, lighter edge where the mask rides over the copper
    for (let b = 0; b < 40; b++) {
      const pts = poly(2 + Math.floor(r() * 3)), w = 18 + r() * 44, hot = r() < 0.22;
      wrap(() => {
        c.lineJoin = c.lineCap = 'round';
        c.strokeStyle = hot ? '#7a4f9a' : '#4a3890'; c.lineWidth = w + 7; path(pts); c.stroke();
        c.strokeStyle = hot ? '#5a3478' : '#33266c'; c.lineWidth = w; path(pts); c.stroke();
        for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
          c.fillStyle = '#cdaacc'; c.beginPath(); c.arc(x, y, w * 0.62 + 6, 0, TAU); c.fill();
          c.fillStyle = '#0c0818'; c.beginPath(); c.arc(x, y, w * 0.2 + 3, 0, TAU); c.fill();
        }
      });
    }
    // signal traces in small buses
    for (let b = 0; b < 70; b++) {
      const pts = poly(2 + Math.floor(r() * 4)), n = 1 + Math.floor(r() * 4);
      wrap(() => { for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 12;
        c.strokeStyle = 'rgba(96,74,170,0.9)'; c.lineWidth = 5; c.lineJoin = c.lineCap = 'round';
        c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(x + o * 0.7, y - o * 0.7) : c.moveTo(x + o * 0.7, y - o * 0.7))); c.stroke();
        const [ex, ey] = pts[pts.length - 1];
        c.fillStyle = 'rgba(214,180,214,0.95)'; c.beginPath(); c.arc(ex + o * 0.7, ey - o * 0.7, 7, 0, TAU); c.fill();
        c.fillStyle = '#0c0818'; c.beginPath(); c.arc(ex + o * 0.7, ey - o * 0.7, 2.6, 0, TAU); c.fill(); } });
    }
    // silkscreen: footprints, polarity marks, reference designators
    c.font = '600 30px InterUI, Helvetica, Arial, sans-serif'; c.textBaseline = 'middle';
    const names = ['C', 'R', 'D', 'L', 'Q', 'T', 'F', 'CX', 'CY', 'ZD', 'BD', 'NTC'];
    for (let i = 0; i < 64; i++) {
      const x = r() * S, y = r() * S, k = r();
      wrap(() => {
        c.strokeStyle = 'rgba(222,208,255,0.62)'; c.fillStyle = 'rgba(222,208,255,0.7)'; c.lineWidth = 3.5;
        if (k < 0.4) { const rad = 26 + r() * 60; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, rad, -0.6, 0.6); c.lineTo(x + rad * 0.5, y); c.fill(); }
        else if (k < 0.8) { const w = 50 + r() * 150, h = 30 + r() * 70; c.strokeRect(x - w / 2, y - h / 2, w, h); c.fillRect(x - w / 2 - 14, y - 3, 10, 6); }
        else { for (let q = 0; q < 6; q++) { c.fillStyle = 'rgba(206,172,208,0.95)'; c.fillRect(x + q * 22, y, 12, 26); } c.fillStyle = 'rgba(222,208,255,0.7)'; }
        c.fillText(names[Math.floor(r() * names.length)] + (1 + Math.floor(r() * 48)), x + 30 + r() * 40, y - 54 - r() * 30);
      });
    }
  });
}
// electrolytic sleeve: mid-grey so the instance colour is the sleeve, with a lighter polarity stripe and print
function sleeveTexture() {
  return canvasTexture(1024, 512, (c, W, H) => {
    c.fillStyle = '#8d8d8d'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f4f4f4'; c.fillRect(W * 0.40, 0, W * 0.2, H);
    c.fillStyle = '#4a4a4a'; for (let i = 0; i < 6; i++) c.fillRect(W * 0.455, 40 + i * 76, W * 0.09, 20);
    c.fillStyle = 'rgba(245,245,245,0.9)'; c.font = '700 54px InterUI, Helvetica, Arial, sans-serif';
    c.save(); c.translate(W * 0.74, H * 0.5); c.rotate(-Math.PI / 2); c.textAlign = 'center';
    c.fillText('470µF  400V', 0, -40); c.font = '500 34px InterUI, Helvetica, Arial, sans-serif'; c.fillText('105°C   VENT   (M)', 0, 16); c.restore();
    c.save(); c.translate(W * 0.2, H * 0.5); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.font = '500 34px InterUI, Helvetica, Arial, sans-serif';
    c.fillText('LOW ESR  •  SERIES KX', 0, 0); c.restore();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, H * 0.86, W, 7);    // crimp groove near the base (v = 0 is the bottom)
  });
}
function capTopTexture() {
  return canvasTexture(256, 256, (c, S) => {
    c.fillStyle = '#d9d6e6'; c.fillRect(0, 0, S, S);
    const g = c.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(60,50,90,0.35)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.lineCap = 'round';
    for (const [w, col] of [[9, 'rgba(40,30,70,0.85)'], [3, 'rgba(255,255,255,0.5)']]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; c.moveTo(S / 2 + (w < 5 ? 3 : 0), S / 2 - (w < 5 ? 3 : 0)); c.lineTo(S / 2 + Math.cos(a) * 92 + (w < 5 ? 3 : 0), S / 2 + Math.sin(a) * 92 - (w < 5 ? 3 : 0)); }
      c.stroke();
    }
  });
}
function labelTexture(lines, w = 512, h = 192) {
  return canvasTexture(w, h, c => {
    c.fillStyle = '#e9e2f4'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2a2140'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#2a2140'; c.textBaseline = 'middle';
    lines.forEach(([txt, size, y, wt = 700]) => { c.font = `${wt} ${size}px InterUI, Helvetica, Arial, sans-serif`; c.fillText(txt, 28, y); });
  });
}

// unlit, painted in the world layer (so they get brushed and occluded like everything else)
const WALL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
function fanMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uRot: { value: 0 }, uGain: { value: 1 } }, vertexShader: WALL_VS,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uRot, uGain;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
        vec3 wall = vec3(0.030, 0.018, 0.058) * (0.7 + 0.5 * vUv.y);
        // dusty daylight behind the blades: lavender, a little rosier low on the left
        vec3 day = mix(vec3(0.50, 0.30, 1.05), vec3(1.25, 0.78, 1.30), smoothstep(0.9, -0.7, p.y - p.x * 0.4));
        float f = fract((a + uRot - r * 1.15) * 7.0 / 6.2831853);
        float gap = smoothstep(0.56, 0.66, f) * smoothstep(1.0, 0.93, f);
        float ann = smoothstep(0.27, 0.31, r) * smoothstep(0.90, 0.87, r);
        vec3 col = day * (0.05 + 0.95 * gap) * ann;
        col += vec3(0.05, 0.03, 0.09) * smoothstep(0.31, 0.27, r);                     // hub
        col = mix(col, vec3(0.16, 0.10, 0.26), smoothstep(0.035, 0.02, abs(r - 0.2)) * 0.8);
        float ring = smoothstep(0.075, 0.03, abs(fract(r * 6.5 + 0.25) - 0.5));        // wire grille
        float strut = smoothstep(0.03, 0.012, abs(sin(a * 2.0 + 0.6)) * r);
        col *= 1.0 - 0.8 * max(ring, strut) * step(r, 0.93);
        float inside = smoothstep(0.93, 0.90, r);
        vec2 q = abs(p); float bez = smoothstep(1.0, 0.97, max(q.x, q.y));
        vec3 frame = wall * (1.0 + 1.6 * bez) + vec3(0.05, 0.03, 0.09) * smoothstep(0.06, 0.03, length(q - 0.88)) ;
        gl_FragColor = vec4(mix(frame, col * uGain, inside), 1.0); }`,
  });
}
function ventMaterial(cells, light, wall = [0.028, 0.017, 0.052]) {
  return new THREE.ShaderMaterial({
    uniforms: { uCells: { value: new THREE.Vector2(...cells) }, uLight: { value: new THREE.Color().setRGB(...light) }, uWall: { value: new THREE.Color().setRGB(...wall) } },
    vertexShader: WALL_VS,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform vec2 uCells; uniform vec3 uLight, uWall;
      float hd(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 uv = vUv * uCells, rr = vec2(1.0, 1.7320508), h = rr * 0.5;
        vec2 a = mod(uv, rr) - h, b = mod(uv - h, rr) - h; vec2 gv = dot(a, a) < dot(b, b) ? a : b; vec2 id = uv - gv;
        float hole = smoothstep(0.34, 0.27, hd(gv));
        vec2 e = abs(vUv - 0.5) * 2.0; float panel = smoothstep(0.97, 0.93, max(e.x, e.y));
        float glow = (0.35 + 0.65 * hh(floor(id * 0.37))) * (0.45 + 0.75 * vUv.y);
        vec3 col = uWall * (0.8 + 0.5 * vUv.y) * (1.0 + 0.5 * (1.0 - panel));
        col = mix(col, uLight * glow, hole * panel);
        gl_FragColor = vec4(col, 1.0); }`,
  });
}

// a toroid: core ring (in its local XY plane) with copper turns over part of the circle
function toroid(R, tubeR, turns, wire, arc, coreMat, copperMat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(R, tubeR, 14, 56), coreMat));
  const ring = at(new THREE.TorusGeometry(tubeR + wire * 0.8, wire, 7, 22), 0, 0, 0, Math.PI / 2, 0, 0), items = [];
  for (let i = 0; i < turns; i++) { const a = -arc / 2 + arc * (i / (turns - 1)) + Math.PI / 2; items.push({ p: [R * Math.cos(a), R * Math.sin(a), 0], r: [0, 0, a] }); }
  g.add(inst(ring, copperMat, items));
  return g;
}
function quad(a0, a1, b0, b1) {     // shaft card: v = 0 at the source edge a0-a1, v = 1 at the far edge
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a0.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  return g;
}

export function buildPsu() {
  const scene = new THREE.Scene();
  const R = rng(2311);
  scene.fog = new THREE.FogExp2(0x2a1650, 0.0036);
  scene.userData.clear = 0x07040f;
  const cam = new THREE.PerspectiveCamera(36, 1920 / 804, 1, 560);

  // ---- light: dusty lavender through the fan (the only shadow caster), the field's magenta glow, violet ambient
  // the key is a spot through the fan grille: a pool of dusty rose light on the transformer, the corners left dark
  const key = new THREE.SpotLight(0xffc4dc, 1.6, 0, 0.33, 0.9, 0);
  key.position.copy(FAN).add(V3(-6, 0, 0)); key.target.position.set(-6, 24, 6);
  const kd = key.target.position.clone().sub(key.position).normalize();
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.4;
  key.shadow.camera.near = 30; key.shadow.camera.far = 440;
  const hemi = new THREE.HemisphereLight(0x4a2f8e, 0x120826, 0.1);
  const fieldF = new THREE.PointLight(0xb23fd6, 30, 190, 1.25); fieldF.position.set(0, 30, 3);
  const fieldB = new THREE.PointLight(0x9a3fe0, 22, 170, 1.25); fieldB.position.set(6, 40, -40);
  const gold = new THREE.PointLight(0xffb45a, 0, 120, 1.0); gold.position.set(EXIT.x - 10, EXIT.y + 1, EXIT.z);
  const fill = new THREE.PointLight(0xc04fd8, 0, 200, 1.0); fill.position.set(26, 30, 60);
  scene.add(key, key.target, hemi, fieldF, fieldB, gold, fill);

  // ---- materials
  const ferrite = paint(0x3d3658, { scale: 0.03, stroke: 0.2, rim: 1.5, broken: 0.8 });
  const copper = paint(0xd08658, { scale: 0.05, stroke: 0.16, rim: 1.6, broken: 0.6, shade: 5, emissive: 0xff5f8a, emissiveIntensity: 0 });
  const copperS = paint(0xdc8452, { scale: 0.08, stroke: 0.4, rim: 1.5 });
  const tape = paint(0xe2ac60, { scale: 0.045, stroke: 0.14, rim: 1.8, broken: 0.5, shade: 4.5, emissive: 0xf08a6a, emissiveIntensity: 0.05 });
  const tape2 = paint(0xd09a50, { scale: 0.045, stroke: 0.14, rim: 1.8, broken: 0.5, shade: 4.5, emissive: 0xf08a6a, emissiveIntensity: 0.05 });
  const bobbin = paint(0x4a3a62, { scale: 0.05, stroke: 0.4, rim: 1.3 });
  const alu = paint(0xb4aed6, { scale: 0.02, stroke: 0.4, rim: 1.4 });
  const aluD = paint(0x7c78a8, { scale: 0.02, stroke: 0.4, rim: 1.3 });
  const tin = paint(0xcfc4de, { scale: 0.1, stroke: 0.3, rim: 1.5 });
  const black = paint(0x1c1728, { scale: 0.05, stroke: 0.45, rim: 1.5 });
  const rubber = paint(0x15111f, { scale: 0.04, stroke: 0.4, rim: 1.2 });
  const wallM = paint(0x1d1630, { scale: 0.01, stroke: 0.45, rim: 0.5 });

  // ---- floor
  const tex = pcbTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2.7, 2.1);
  const ground = mesh(new THREE.PlaneGeometry(520, 400), paint(0xffffff, { map: tex, scale: 0.018, stroke: 0.4, rim: 0.12 }), { cast: false });
  ground.rotation.x = -Math.PI / 2; ground.position.set(12, 0, -4); scene.add(ground);

  // ---- the transformer
  const tr = new THREE.Group(); tr.scale.setScalar(TS); scene.add(tr);
  tr.add(mesh(merge([
    at(rbox(59, 8.6, 20, 0.7, 3), 0, 5.7, 0), at(rbox(59, 10, 20, 0.7, 3), 0, 43, 0),
    ...[-1, 1].flatMap(s => [at(rbox(8, 13.9, 20, 0.6, 3), 25.5 * s, 17, 0), at(rbox(8, 13.9, 20, 0.6, 3), 25.5 * s, 31, 0)]),
    at(cyl(8.5, 8.5, 28, 28), 0, 24, 0),
  ]), ferrite));
  // windings: one lathe with a round-wire scallop per turn
  const prof = [], pitch = 0.44, turns = Math.round(25 / pitch);
  for (let i = 0; i < turns; i++) for (const f of [0, 0.14, 0.32, 0.5, 0.68, 0.86]) prof.push(new THREE.Vector2(13.75 + 0.3 * Math.sqrt(1 - (2 * f - 1) ** 2), 11.5 + (i + f) * pitch));
  prof.push(new THREE.Vector2(13.7, 11.5 + turns * pitch));
  const coil = mesh(new THREE.LatheGeometry(prof, 72), copper); tr.add(coil);
  tr.add(mesh(new THREE.CylinderGeometry(14.5, 14.5, 9.6, 72, 1, true), tape, { y: 26.2 }));
  tr.add(mesh(new THREE.CylinderGeometry(14.64, 14.64, 4.4, 72, 1, true, 0.4, TAU * 0.93), tape2, { y: 28.5 }));
  tr.add(mesh(merge([at(cyl(15.9, 15.9, 1.3, 56), 0, 10.85, 0), at(cyl(15.9, 15.9, 1.3, 56), 0, 37.15, 0),
    at(rbox(34, 3.2, 5.4, 0.5, 2), 0, 2.4, 17.8), at(rbox(34, 3.2, 5.4, 0.5, 2), 0, 2.4, -17.8)]), bobbin));
  const pins = [], leads = [];
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) pins.push({ p: [-14 + i * 3.5, 2.6, s * 18.6], s: [0.5, 5.6, 0.5] });
  tr.add(inst(cyl(1, 1, 1, 8), tin, pins, { cast: false }));
  for (const [x, s] of [[-10.5, 1], [-3.5, 1], [7, 1], [10.5, 1], [-7, -1], [3.5, -1]]) {
    const c = new THREE.CatmullRomCurve3([V3(x * 0.8, 13, s * 14.2), V3(x * 0.9, 9.2, s * 16.6), V3(x, 6, s * 18.4), V3(x, 4, s * 18.6)]);
    leads.push(new THREE.TubeGeometry(c, 10, 0.45, 6));
  }
  tr.add(mesh(merge(leads), copperS));
  // tape round the core holding the two E halves, and the label
  tr.add(mesh(merge([at(rbox(59.5, 0.3, 9, 0.1, 1), 0, 48.05, 0), at(rbox(0.3, 46.8, 9, 0.1, 1), 29.6, 24.6, 0), at(rbox(0.3, 46.8, 9, 0.1, 1), -29.6, 24.6, 0)]), tape2));
  const label = mesh(new THREE.PlaneGeometry(17, 6.4), paint(0xffffff, { map: labelTexture([['TR1   EE-57/28', 44, 62], ['PRI 230V~   SEC 12V  18A', 30, 126, 500]]), scale: 0.06, stroke: 0.25 }), { cast: false, x: -15.5, y: 43, z: 10.06 });
  tr.add(label);

  // ---- capacitors: sleeves (instance colour), scored aluminium tops, rolled sleeve edge
  const caps = [], tops = [], rolls = [];
  const cap = (x, z, r, h, c, ry = R() * TAU) => {
    caps.push({ p: [x, h / 2, z], s: [r, h, r], r: [0, ry, 0], c }); tops.push({ p: [x, h - 0.12, z], s: [r * 0.86, 0.5, r * 0.86], r: [0, ry, 0] }); rolls.push({ p: [x, h - 0.1, z], s: r }); };
  const SL = [0x5b49c4, 0x7a3fa6, 0x3f4bb0, 0x4a3a8c, 0x8a4a9c, 0x3a2f6e];
  cap(-74, -42, 11, 62, SL[0]); cap(-48, -56, 11, 62, SL[3]);              // bulk pair behind the transformer
  cap(-1.5, 109, 8.5, 56, 0x3a2a70, 2.2);                                              // foreground trunk for the awe shot
  cap(56, -38, 5, 27, SL[2]); cap(68, -41, 5, 27, SL[2]); cap(80, -37, 5, 29, SL[4]);
  for (const [x, z, r, h, c] of [[84, 4, 4.4, 16, 1], [96, 7, 4.4, 16, 1], [108, 4, 4.4, 16, 0], [120, 9, 4.4, 18, 4], [92, 56, 4.6, 12, 2], [128, 62, 5.2, 25, 3], [116, 66, 5.2, 25, 3], [112, 20, 3, 10, 5], [124, 23, 3, 10, 5],
    [-98, 30, 3.4, 14, 5], [-100, -14, 3.4, 14, 4], [132, 14, 3.4, 13, 1], [76, 72, 3.4, 12, 4], [-10, -52, 3.6, 15, 1], [24, -58, 3.6, 15, 2], [-104, 72, 4.2, 17, 3]]) cap(x, z, r, h, SL[c]);
  scene.add(inst(cyl(1, 1, 1, 36), paint(0xffffff, { map: sleeveTexture(), scale: 0.03, stroke: 0.5, rim: 1.6 }), caps));
  scene.add(inst(cyl(1, 1, 1, 36), paint(0xffffff, { map: capTopTexture(), scale: 0.05, stroke: 0.3, rim: 1.3 }), tops, { cast: false }));
  scene.add(inst(at(new THREE.TorusGeometry(0.955, 0.055, 8, 40), 0, 0, 0, Math.PI / 2), black, rolls, { cast: false }));

  // ---- heat-sinks: A = finned cliff behind-left, B = flat face with bolted transistors behind-right
  const hs = new THREE.Group(); scene.add(hs);
  hs.add(mesh(merge([at(rbox(84, 84, 3, 0.4, 1), -62, 42.5, -88), at(rbox(84, 3, 14, 0.4, 1), -62, 2, -82)]), alu));
  const fins = []; for (let i = 0; i < 20; i++) fins.push({ p: [-102 + i * 4.2, 42.5 + (i % 5 === 2 ? -4 : 0), -81], s: [1.4, 84 - (i % 5 === 2 ? 8 : 0), 12] });
  hs.add(inst(rbox(1, 1, 1, 0.12, 1), alu, fins));
  hs.add(mesh(merge([at(rbox(76, 58, 3, 0.4, 1), 86, 29.5, -62), at(rbox(76, 3, 15, 0.4, 1), 86, 59.5, -56)]), aluD));
  const finsB = []; for (let i = 0; i < 18; i++) finsB.push({ p: [50 + i * 4.24, 29.5, -68.5], s: [1.4, 58, 10] });
  hs.add(inst(rbox(1, 1, 1, 0.12, 1), aluD, finsB));
  hs.add(mesh(at(rbox(3, 46, 40, 0.4, 1), 126, 23.5, -40), aluD));
  const finsC = []; for (let i = 0; i < 10; i++) finsC.push({ p: [118.5, 23.5 - (i % 3 === 1 ? 2 : 0), -58 + i * 4], s: [13, 46 - (i % 3 === 1 ? 4 : 0), 1.3] });
  hs.add(inst(rbox(1, 1, 1, 0.12, 1), aluD, finsC));
  const tos = [], tabs = [], screws = [], legs = [];
  for (const x of [60, 84, 108]) {
    tos.push({ p: [x, 14, -58.9], s: [13, 16, 4] }); tabs.push({ p: [x, 25, -59.7], s: [13, 7, 1.6] }); screws.push({ p: [x, 25.2, -58.6], r: [Math.PI / 2, 0, 0], s: [2.5, 1.4, 2.5] });
    for (const o of [-4, 0, 4]) legs.push({ p: [x + o, 3, -58.6], s: [0.65, 6, 0.45] });
  }
  hs.add(inst(rbox(1, 1, 1, 0.08, 2), black, tos)); hs.add(inst(rbox(1, 1, 1, 0.1, 1), tin, tabs)); hs.add(inst(cyl(1, 1, 1, 12), tin, screws, { cast: false })); hs.add(inst(new THREE.BoxGeometry(1, 1, 1), tin, legs, { cast: false }));

  // ---- toroidal chokes
  const t1 = toroid(8.6, 3.4, 40, 0.42, 4.9, paint(0x6d6ad6, { scale: 0.06, stroke: 0.4, rim: 1.4 }), copperS);
  t1.position.set(-70, 12.4, 20); t1.rotation.set(0, 0.8, 0); scene.add(t1);
  const t2 = toroid(10.5, 4.2, 15, 1.0, 4.4, paint(0xcdb24a, { scale: 0.06, stroke: 0.4, rim: 1.4 }), copperS);
  t2.position.set(108, 5.4, 78); t2.rotation.set(Math.PI / 2, 0, 0.4); scene.add(t2);
  const t3 = toroid(7, 3, 30, 0.42, 5.2, paint(0x8a6ad0, { scale: 0.06, stroke: 0.4, rim: 1.4 }), copperS);
  t3.position.set(44, 3.3, 70); t3.rotation.set(Math.PI / 2, 0, 0.6); scene.add(t3);

  // ---- rectifier bridge, fuse, terminal block and the incoming mains cable (left)
  const rect = new THREE.Group(); rect.position.set(-92, 0, -8); rect.rotation.y = 0.6; scene.add(rect);
  rect.add(mesh(merge([at(rbox(22, 18, 4.6, 0.5, 2), 0, 14.5, 0), ...[-7.5, -2.5, 2.5, 7.5].map(x => at(rbox(1.3, 6, 0.6, 0.1, 1), x, 3, 0))]), black));
  rect.add(mesh(new THREE.PlaneGeometry(15, 6), paint(0xffffff, { map: labelTexture([['GBU8K', 64, 60], ['+   ~   ~   −', 52, 132]], 512, 192), scale: 0.06, stroke: 0.2 }), { cast: false, y: 15, z: 2.34 }));
  const term = new THREE.Group(); term.position.set(INLET.x, 0, INLET.z); term.rotation.y = 0.5; scene.add(term);
  term.add(mesh(merge([at(rbox(21, 6.4, 9, 0.6, 2), 0, 3.2, 0), ...[-7, 0, 7].map(x => at(rbox(0.5, 9, 9.4, 0.15, 1), x - 3.5, 4.5, 0)), at(rbox(0.5, 9, 9.4, 0.15, 1), 10.5, 4.5, 0)]), paint(0x2e2a6a, { scale: 0.06, stroke: 0.4, rim: 1.4 })));
  const tsc = [-7, 0, 7].map(x => ({ p: [x, 6.7, 0], s: [2.3, 0.9, 2.3] }));
  term.add(inst(cyl(1, 1, 1, 14), tin, tsc, { cast: false }));
  const mains = new THREE.Group(); scene.add(mains);
  const sheath = new THREE.CatmullRomCurve3([V3(-124, 34, 60), V3(-108, 30, 61), V3(-90, 17, 62), V3(-76, 10, 62.5), V3(-66, 8.8, 62)]);
  mains.add(mesh(new THREE.TubeGeometry(sheath, 40, 3.3, 12), rubber));
  mains.add(mesh(at(cyl(4.8, 4.8, 3, 20), -118, 33, 60.4, 0, 0, 1.35), black));
  [[0x8a4a3a, 7], [0x3a56c8, 0], [0x9aa844, -7]].forEach(([c, lx], i) => {
    const end = V3(lx, 7.2, 0).applyEuler(term.rotation).add(term.position);
    const cv = new THREE.CatmullRomCurve3([V3(-67.5, 8.8, 62.1), V3(-63, 9.8 + i * 0.8, 61.5 - i * 0.8), V3(end.x - 5, 13 - i, end.z + 5), V3(end.x - 0.5, 10.8, end.z + 0.5), end]);
    mains.add(mesh(new THREE.TubeGeometry(cv, 20, 1.05, 8), paint(c, { scale: 0.1, stroke: 0.4, rim: 1.5 })));
  });
  const fuse = new THREE.Group(); fuse.position.set(-66, 0, 38); fuse.rotation.y = 0.5; scene.add(fuse);
  fuse.add(mesh(at(cyl(1.9, 1.9, 13, 16), 0, 3.4, 0, 0, 0, Math.PI / 2), paint(0xb9b4e6, { scale: 0.1, stroke: 0.3, rim: 2.2, emissive: 0x3a2a80, emissiveIntensity: 0.5 })));
  fuse.add(mesh(merge([at(cyl(2.05, 2.05, 3.4, 16), -6.6, 3.4, 0, 0, 0, Math.PI / 2), at(cyl(2.05, 2.05, 3.4, 16), 6.6, 3.4, 0, 0, 0, Math.PI / 2),
    at(rbox(2.6, 3.2, 5, 0.3, 1), -6.6, 1.5, 0), at(rbox(2.6, 3.2, 5, 0.3, 1), 6.6, 1.5, 0)]), tin));

  // ---- small parts: ceramic discs, film boxes, axial resistors
  const discs = [], dlegs = [], boxes = [], res = [], rlegs = [];
  const clear = (x, z) => !(Math.abs(x) < 50 && Math.abs(z) < 36) && Math.hypot(x - INLET.x, z - INLET.z) > 18 && !(x > 46 && x < 78 && z > 10 && z < 36) && !(z > 34 && x < 46) && Math.hypot(x + 70, z - 20) > 14;
  for (let i = 0; i < 110; i++) {
    const x = Math.round((-104 + R() * 240) / 7) * 7, z = Math.round((-48 + R() * 128) / 6) * 6, k = R(), ry = Math.floor(R() * 2) * Math.PI / 2 + (R() - 0.5) * 0.12;
    if (!clear(x, z)) continue;
    if (k < 0.22) { discs.push({ p: [x, 4.6, z], r: [0, ry, 0], s: [2.0, 2.0, 0.75], c: [0x4d5ad6, 0x7a4fc0, 0x3f6ac8][i % 3] }); for (const o of [-0.8, 0.8]) dlegs.push({ p: [x + Math.cos(ry) * o, 1.4, z - Math.sin(ry) * o], s: [0.16, 2.8, 0.16] }); }
    else if (k < 0.42) { const w = 5 + R() * 5, h = 3.6 + R() * 4; boxes.push({ p: [x, h / 2 + 0.3, z], r: [0, ry, 0], s: [w, h, 2.4 + R() * 1.6], c: [0xa8843c, 0x8a3a5c, 0x4a44a8, 0x6a3a8c][i % 4] }); }
    else { res.push({ p: [x, 1.2, z], r: [0, ry, Math.PI / 2], s: [0.95, 4.2, 0.95], c: [0x8f9ee0, 0xb88ad0, 0x6a78c8][i % 3] }); rlegs.push({ p: [x, 1.15, z], r: [0, ry, Math.PI / 2], s: [0.18, 8, 0.18] }); }
  }
  const small = paint(0xffffff, { scale: 0.12, stroke: 0.35, rim: 1.5 });
  scene.add(inst(new THREE.SphereGeometry(1, 16, 12), small, discs)); scene.add(inst(cyl(1, 1, 1, 6), tin, dlegs, { cast: false }));
  scene.add(inst(rbox(1, 1, 1, 0.12, 2), small, boxes)); scene.add(inst(new THREE.CapsuleGeometry(1, 1, 4, 12).scale(1, 0.5, 1), small, res)); scene.add(inst(cyl(1, 1, 1, 6), tin, rlegs, { cast: false }));

  // ---- output loom: nine ATX-coloured wires rising from the board, tied, leaving through the grommet
  const rail = new THREE.CatmullRomCurve3(RAIL.map(p => V3(...p)), false, 'catmullrom', 0.5);
  const WIRES = [0x18141f, 0xb08a3a, 0x8a2a4a, 0x18141f, 0xa85a3a, 0x6a3aa0, 0xb08a3a, 0x2c3f98, 0x18141f];
  const loom = new THREE.Group(); scene.add(loom);
  const up = V3(0, 1, 0), tg = V3(), sd = V3(), nn = V3();
  WIRES.forEach((c, i) => {
    const a0 = i === 0 ? 0 : (i - 1) / 8 * TAU, rr = i === 0 ? 0 : 2.15, pts = [];
    const fx = 51 + (i % 3) * 5.2, fz = 17 + Math.floor(i / 3) * 5.4;
    pts.push(V3(fx, -1, fz), V3(fx, 6 + (i % 3) * 1.6, fz + 0.3));
    for (let k = 0; k <= 26; k++) {
      const u = 0.115 + (k / 26) * 0.885; rail.getPoint(u, nn); rail.getTangent(u, tg); sd.crossVectors(tg, up).normalize(); const vv = V3().crossVectors(sd, tg);
      const a = a0 + u * 5.0, spread = 1 + 1.1 * (1 - smooth(0.115, 0.24, u));
      pts.push(nn.clone().addScaledVector(sd, Math.cos(a) * rr * spread).addScaledVector(vv, Math.sin(a) * rr * spread));
    }
    loom.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), 96, 1.06, 8), paint(c, { scale: 0.09, stroke: 0.4, rim: 1.6 })));
  });
  const ties = [0.205, 0.5, 0.72].map(u => { const p = rail.getPoint(u), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), rail.getTangent(u));
    return new THREE.TorusGeometry(3.3, 0.5, 6, 20).applyQuaternion(q).translate(p.x, p.y, p.z); });
  loom.add(mesh(merge(ties), black));
  const pads = WIRES.map((_, i) => ({ p: [51 + (i % 3) * 5.2, 0.25, 17 + Math.floor(i / 3) * 5.4], s: [2.1, 0.5, 2.1] }));
  scene.add(inst(cyl(1, 0.8, 1, 14), tin, pads, { cast: false }));

  // ---- walls: back (fan grille + vents), left, right (the grommet toward the motherboard)
  const back = mesh(new THREE.PlaneGeometry(420, 200), wallM, { cast: false, x: 10, y: 92, z: -114 }); scene.add(back);
  const fanMat = fanMaterial();
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(104, 104), fanMat); fan.position.set(FAN.x - 0.6, FAN.y, FAN.z); fan.rotation.y = Math.PI / 2; scene.add(fan);
  const ventB = new THREE.Mesh(new THREE.PlaneGeometry(150, 56), ventMaterial([30, 19], [0.10, 0.05, 0.26])); ventB.position.set(40, 104, -113.4); scene.add(ventB);
  const left = mesh(new THREE.PlaneGeometry(300, 200), wallM, { cast: false, x: -121, y: 92, z: 20 }); left.rotation.y = Math.PI / 2; scene.add(left);
  const ventL = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), ventMaterial([16, 15], [0.09, 0.045, 0.24])); ventL.position.set(-120.4, 60, -72); ventL.rotation.y = Math.PI / 2; scene.add(ventL);
  const rr = (s, w, h, r, cx, cy) => { s.moveTo(cx - w + r, cy - h); s.lineTo(cx + w - r, cy - h); s.absarc(cx + w - r, cy - h + r, r, -Math.PI / 2, 0, false); s.lineTo(cx + w, cy + h - r); s.absarc(cx + w - r, cy + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(cx - w + r, cy + h); s.absarc(cx - w + r, cy + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(cx - w, cy - h + r); s.absarc(cx - w + r, cy - h + r, r, Math.PI, Math.PI * 1.5, false); return s; };
  const ws = new THREE.Shape(); ws.moveTo(-150, -10); ws.lineTo(160, -10); ws.lineTo(160, 190); ws.lineTo(-150, 190); ws.closePath();
  ws.holes.push(rr(new THREE.Path(), 13, 8.5, 6, EXIT.z, EXIT.y));
  const right = mesh(new THREE.ShapeGeometry(ws, 16), wallM, { cast: false, x: EXIT.x }); right.rotation.y = -Math.PI / 2; scene.add(right);
  const gs = rr(new THREE.Shape(), 16, 11.5, 8, EXIT.z, EXIT.y); gs.holes.push(rr(new THREE.Path(), 12.4, 7.9, 5.6, EXIT.z, EXIT.y));
  const grom = mesh(new THREE.ExtrudeGeometry(gs, { depth: 3.2, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 3, curveSegments: 14 }), rubber, { cast: false, x: EXIT.x + 1.2 });
  grom.rotation.y = -Math.PI / 2; scene.add(grom);
  const ventR = new THREE.Mesh(new THREE.PlaneGeometry(96, 40), ventMaterial([22, 16], [0.10, 0.05, 0.26])); ventR.position.set(EXIT.x - 0.5, 86, 0); ventR.rotation.y = -Math.PI / 2; scene.add(ventR);
  const ventR2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), ventMaterial([10, 11], [0.10, 0.05, 0.26])); ventR2.position.set(EXIT.x - 0.5, 30, -26); ventR2.rotation.y = -Math.PI / 2; scene.add(ventR2);
  // the world beyond: golden hour on the motherboard
  const beyondMat = new THREE.ShaderMaterial({ uniforms: { uGain: { value: 0.2 } }, vertexShader: WALL_VS,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uGain;
      void main(){ vec2 p = vUv - vec2(0.5, 0.56); float r = length(p * vec2(1.0, 1.5));
        vec3 c = mix(vec3(2.9, 2.2, 1.25), vec3(1.9, 0.9, 0.3), smoothstep(0.02, 0.2, r)); c = mix(c, vec3(1.0, 0.36, 0.12), smoothstep(0.16, 0.36, r));
        c *= 1.0 - 0.3 * smoothstep(0.5, 0.36, vUv.y);
        gl_FragColor = vec4(c * uGain, 1.0); }` });
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), beyondMat); beyond.position.set(EXIT.x + 9, EXIT.y, EXIT.z); beyond.rotation.y = -Math.PI / 2; scene.add(beyond);

  // ---- FX: light through the fan, the opening's gold, the field, dust
  const fx = new THREE.Group(); scene.add(fx);
  const fanShaft = shaftMat(0xd08ae0, { gain: 0.05, mode: 1, streak: 2.5, pow: 1.1, soft: 10, fadeTop: 0.03, fadeBot: 0.8 });
  const sideF = V3().crossVectors(kd, V3(0, 1, 0)).normalize(), upF = V3().crossVectors(sideF, kd).normalize();
  for (let i = 0; i < 7; i++) {
    const o = (i - 3) * 11 + (hash2(i, 4) - 0.5) * 6, w = 9 + hash2(i, 8) * 14, v = (hash2(i, 2) - 0.5) * 50, len = 200 + hash2(i, 6) * 60;
    const a = FAN.clone().addScaledVector(sideF, o).addScaledVector(upF, v), b = a.clone().addScaledVector(kd, len);
    const tw = V3().copy(sideF).applyAxisAngle(kd, (hash2(i, 12) - 0.5) * 1.4);
    fx.add(fxMesh(quad(a.clone().addScaledVector(tw, -w / 2), a.clone().addScaledVector(tw, w / 2), b.clone().addScaledVector(tw, -w * 1.5), b.clone().addScaledVector(tw, w * 1.5)), fanShaft));
  }
  const goldShaft = shaftMat(0xffb060, { gain: 0, mode: 1, streak: 2.2, pow: 1.2, soft: 8, fadeTop: 0.02, fadeBot: 0.85 });
  for (let i = 0; i < 5; i++) {
    const a = EXIT.clone().add(V3(1, (hash2(i, 31) - 0.5) * 9, (i - 2) * 4.2)), d = V3(-1, -0.16 + (hash2(i, 33) - 0.5) * 0.2, (i - 2) * 0.1 - 0.12).normalize();
    const b = a.clone().addScaledVector(d, 86 + hash2(i, 35) * 30), tw = V3(0, 1, 0).applyAxisAngle(d, (hash2(i, 37) - 0.5) * 2.2), w = 5 + hash2(i, 39) * 6;
    fx.add(fxMesh(quad(a.clone().addScaledVector(tw, -w / 2), a.clone().addScaledVector(tw, w / 2), b.clone().addScaledVector(tw, -w * 2.2), b.clone().addScaledVector(tw, w * 2.2)), goldShaft));
  }
  const goldGlow = new Sprites(3, { shape: 'dot', core: 0.0, soft: 6 }); fx.add(goldGlow.mesh);

  // the field: dipole-like loops out of the core's crown, down around the windings and into the board
  const NL = 22, NP = 44, loops = [];
  for (let i = 0; i < NL; i++) {
    const col = [0xb03fd0, 0xd04fc8, 0x8a48f0, 0xb03fd0][i % 4];
    const wide = i % 3 === 0, g0 = wide ? 0.8 : 1.5;
    const rb = new Ribbon(NP, { color: col, gain: g0, core: wide ? 0.0 : 0.3, soft: 3 }); fx.add(rb.mesh);
    loops.push({ rb, g0, wide, pts: Array.from({ length: NP }, () => V3()), az: (i / NL) * TAU + hash2(i, 1) * 0.5, L: 34 + hash2(i, 2) * 42, H: 37 + hash2(i, 3) * 20, R0: 7 + hash2(i, 4) * 8, sw: (hash2(i, 11) - 0.5) * 1.5,
      w: wide ? 7 + hash2(i, 5) * 9 : 0.9 + hash2(i, 5) * 1.5, a: wide ? 0.4 + hash2(i, 6) * 0.3 : 0.45 + hash2(i, 6) * 0.55, sp: 0.5 + hash2(i, 7) * 0.9, ph: hash2(i, 8) * TAU, n: 1 + Math.floor(hash2(i, 9) * 2.99), om: (0.05 + hash2(i, 10) * 0.1) * (i % 2 ? 1 : -0.6) });
  }
  let swirl = 0;
  const loopPoint = (lp, k, t, tw, out) => {
    const th = Math.PI * (0.03 + 0.94 * k), s = Math.sin(th), az = lp.az + t * lp.om - tw * (0.6 + 0.4 * lp.a) + lp.sw * Math.sin(th * 2 + lp.ph + t * 0.7) * 0.5 + swirl * s * s * (0.6 + 0.8 * lp.a);
    const L = lp.L * (1 + 0.07 * Math.sin(t * 1.3 + lp.ph) + 0.06 * Math.sin(k * 11 + t * 2.3 + lp.ph * 3)), h = lp.R0 + (L - lp.R0) * Math.pow(s, 1.45);
    return out.set(Math.cos(az) * h, COIL.c.y + 1 + lp.H * Math.cos(th), Math.sin(az) * h);
  };
  const curtains = [[46, 0xb03fd0, 0.9, 0.13, 12], [58, 0x7c42f0, 2.6, -0.09, 9], [74, 0xd050c0, 4.6, 0.06, 14], [52, 0x9a40e0, 5.6, -0.16, 10]].map(([rad, col, a0, om, st]) => {
    const m = shaftMat(col, { gain: 0.1, mode: 1, streak: st, pow: 1.3, soft: 5, fadeTop: 0.16, fadeBot: 0.78 });
    const c = fxMesh(new THREE.CylinderGeometry(rad * 0.86, rad, 96, 40, 1, true, 0, 1.7), m); c.position.set(0, 54, 0); fx.add(c);
    return { c, m, a0, om };
  });
  const halo = fxMesh(new THREE.SphereGeometry(1, 28, 18), shaftMat(0xa83cd8, { gain: 0.1, mode: 0, streak: 1, pow: 2.4, soft: 8, fadeTop: 0.25, fadeBot: 0.3 }));
  halo.position.copy(COIL.c); halo.scale.set(44, 52, 44); fx.add(halo);
  const sparkle = new Sprites(96, { shape: 'star', core: 1.0, soft: 2 }); fx.add(sparkle.mesh);
  // arcs from the Spark to the windings, re-struck on twos
  const arcs = [0, 1, 2].map(() => ({ rb: new Ribbon(9, { color: 0x7fe9ff, gain: 2.4, core: 1.7, soft: 1.5 }), pts: [] }));
  arcs.forEach(a => fx.add(a.rb.mesh));
  const hits = new Sprites(16, { shape: 'star', core: 1.0, soft: 1.5 }); fx.add(hits.mesh);
  // dust in the fan light, a few soft motes near the lens
  const dust = new Sprites(520, { shape: 'dot', core: 0.25, soft: 3, drift: [3.2, 0.24, 0.6] });
  for (let i = 0; i < 520; i++) { const inBeam = R() < 0.4, k = R();
    const p = inBeam ? FAN.clone().addScaledVector(kd, 20 + k * 170).add(V3((R() - 0.5) * 30, (R() - 0.5) * 50, (R() - 0.5) * (40 + k * 50))) : V3(-112 + R() * 248, 2 + R() * 90, -100 + R() * 210);
    dust.set(i, p.x, Math.max(1.5, p.y), p.z, 0.3 + R() * 0.8, 0.8, 0.6, 1.0, (inBeam ? 0.34 : 0.16) + R() * 0.3, R()); }
  dust.commit(); fx.add(dust.mesh);
  const dustA = Float32Array.from({ length: 520 }, (_, i) => dust.col[i * 4 + 3]);
  const burst = new Sprites(30, { shape: 'star', core: 1.0, soft: 1.2 }); fx.add(burst.mesh);
  const ring = new Sprites(4, { shape: 'ring', core: 0.3, soft: 2 }); fx.add(ring.mesh);

  const _p = V3(), _q = V3(), _s = V3();
  const sprayAt = (S0, base, origin, age, n, speed, cr, cg, cb) => {
    for (let i = 0; i < n; i++) {
      const h0 = hash2(i + base, 51), h1 = hash2(i + base, 52), h2 = hash2(i + base, 53), life = 0.35 + h2 * 0.5;
      const k = age / life, th = h0 * TAU, el = 0.2 + h1 * 1.1, v = speed * (0.4 + h2 * 0.8), drag = (1 - Math.exp(-3.2 * age)) / 3.2;
      const on = age >= 0 && k < 1 ? 1 : 0;
      S0.set(base + i, origin.x + Math.cos(th) * Math.cos(el) * v * drag, origin.y + Math.sin(el) * v * drag - 26 * age * age, origin.z + Math.sin(th) * Math.cos(el) * v * drag,
        (0.7 + h1 * 1.1) * (1 - k * 0.6), cr, cg, cb, on * (1 - k) * (1 - k) * 1.4, h0);
    }
  };

  return {
    scene, cam, rail, key, hemi, fieldF, fieldB, copper,
    // S: { field 0..1.6, twist (rad, drags the loops round), spark: Vector3, arc 0..1, gold 0..1, fanGain, arriveAge, landAge, swirl, fill: { p, i, c } | null }
    update(t, camera, S) {
      const F = S.field ?? 0.4, hum = 1 + 0.08 * Math.sin(t * 9.4) + 0.05 * Math.sin(t * 23.1), tw = S.twist ?? 0, sp = S.spark;
      fanMat.uniforms.uRot.value = t * 1.25; fanMat.uniforms.uGain.value = S.fanGain ?? 1;
      fanShaft.uniforms.uGain.value = 0.03 * (S.fanGain ?? 1) * (S.shafts ?? 1);
      fieldF.intensity = (50 + 45 * F) * hum; fieldB.intensity = (40 + 45 * F) * hum;
      copper.emissiveIntensity = 0.045 + 0.1 * F * F * hum; tape.emissiveIntensity = tape2.emissiveIntensity = 0.04 + 0.06 * F * F;
      const fl = S.fill; fill.intensity = fl ? fl.i : (8 + 16 * F) * hum; fill.color.set(fl ? fl.c : 0xc04fd8); fl ? fill.position.set(...fl.p) : fill.position.set(26, 30, 60);
      // loops
      swirl = S.swirl ?? 0;
      for (const lp of loops) {
        for (let j = 0; j < NP; j++) loopPoint(lp, j / (NP - 1), t, tw, lp.pts[j]);
        const amp = lp.a * (0.1 + 0.9 * F) * hum; lp.rb.u.uGain.value = lp.g0 * (0.8 + 0.5 * F); lp.rb.u.uCore.value = lp.wide ? 0.02 * F : 0.12 + 0.2 * F;
        lp.rb.update(lp.pts, camera, (i, k) => lp.w * (0.45 + 1.1 * Math.sin(k * Math.PI)) * (1 + 0.5 * F),
          (i, k) => amp * Math.pow(Math.sin(k * Math.PI), 0.6) * (0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.sin(k * TAU * lp.n - t * (2.2 + 3.5 * F) * lp.sp + lp.ph), 2)) * smooth(7, 30, camera.position.distanceTo(lp.pts[i])));
      }
      curtains.forEach(({ c, m, a0, om }, i) => { c.rotation.y = a0 + t * om - tw * (0.25 + 0.08 * i); m.uniforms.uGain.value = (0.004 + 0.026 * F) * hum * (S.curtain ?? 1); });
      halo.material.uniforms.uGain.value = (0.008 + 0.028 * F) * hum;
      for (let i = 0; i < 96; i++) {
        const lp = loops[i % NL], h = hash2(i, 71), k = (h + t * (0.1 + 0.18 * hash2(i, 72)) * (1 + 1.6 * F)) % 1;
        loopPoint(lp, k, t, tw, _p); const twk = hash2(i, Math.floor(t * FPS / 2));
        sparkle.set(i, _p.x, _p.y, _p.z, (0.5 + h * 0.9) * (0.7 + 0.6 * F), 1.0, 0.62, 1.0, Math.sin(k * Math.PI) * (0.25 + 0.75 * twk) * (0.25 + 0.75 * F) * 0.9, h);
      }
      sparkle.commit();
      // arcs to the copper
      const fs = Math.floor(t * FPS / 2 + 1e-6), arcAmt = S.arc ?? 0; let nh = 0;
      arcs.forEach((a, i) => {
        const live = sp && hash2(fs * 7 + i, 3) < arcAmt;
        a.rb.mesh.visible = !!live; if (!live) return;
        const ang = Math.atan2(sp.z, sp.x) + (hash2(fs, i * 5 + 1) - 0.5) * 1.1, y = clamp(sp.y + (hash2(fs, i * 5 + 2) - 0.5) * 10, COIL.y0 + 0.5, COIL.y1 - 0.5);
        _q.set(Math.cos(ang) * (COIL.r + 0.7), y, Math.sin(ang) * (COIL.r + 0.7));
        strike(sp, _q, 9, 0.7 + 0.06 * sp.distanceTo(_q), fs * 31 + i * 7, a.pts);
        a.rb.update(a.pts, camera, (j, k) => 0.55 * (1.2 - 0.6 * k), 1);
        hits.set(nh++, _q.x, _q.y, _q.z, 3.2, 0.6, 0.95, 1.0, 1.0, i); hits.set(nh++, _q.x, _q.y, _q.z, 7, 0.3, 0.75, 1.0, 0.35, i);
      });
      hits.commit(nh);
      // arrival at the terminal, landing on the loom
      const aa = S.arriveAge ?? -1;
      sprayAt(burst, 0, INLET, aa, 16, 60, 0.7, 0.95, 1.0);
      const la = S.landAge ?? -1; _s.copy(HEAD); _s.y += 3.6;
      sprayAt(burst, 16, _s, la, 14, 54, 0.7, 0.95, 1.0);
      burst.commit();
      const rk = clamp(la / 0.26), ak = clamp(aa / 0.28);
      ring.set(0, _s.x, _s.y - 1.5, _s.z, la >= 0 ? 3 + 13 * (1 - Math.pow(1 - rk, 3)) : 0, 0.5, 0.92, 1.0, la >= 0 ? (1 - rk) * (1 - rk) * 0.8 : 0, 0);
      ring.set(1, INLET.x, INLET.y, INLET.z, aa >= 0 ? 3 + 15 * (1 - Math.pow(1 - ak, 3)) : 0, 0.6, 0.9, 1.0, aa >= 0 ? (1 - ak) * (1 - ak) * 0.8 : 0, 0);
      ring.set(2, 0, -99, 0, 0, 0, 0, 0, 0, 0);
      ring.set(3, 0, -99, 0, 0, 0, 0, 0, 0, 0);
      ring.commit();
      // the way out
      const G = S.gold ?? 0.15;
      beyondMat.uniforms.uGain.value = 0.06 + 0.42 * G; gold.intensity = 42 * G; goldShaft.uniforms.uGain.value = 0.16 * G;
      goldGlow.set(0, EXIT.x - 1, EXIT.y, EXIT.z, 62, 1.0, 0.66, 0.3, 0.22 * G, 0); goldGlow.set(1, EXIT.x - 1, EXIT.y, EXIT.z, 30, 1.0, 0.8, 0.5, 0.3 * G, 0);
      goldGlow.set(2, EXIT.x - 1, EXIT.y, EXIT.z, 150, 1.0, 0.6, 0.3, 0.1 * G * G, 0); goldGlow.commit();
      // dust never sits on the lens
      for (let i = 0; i < 520; i++) dust.col[i * 4 + 3] = dustA[i] * smooth(9, 22, Math.hypot(dust.pos[i * 3] - camera.position.x, dust.pos[i * 3 + 1] - camera.position.y, dust.pos[i * 3 + 2] - camera.position.z));
      dust.aCol.needsUpdate = true;
    },
  };
}
