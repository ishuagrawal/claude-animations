// The room: a desk under a dusk window, someone typing, a tower PC on the floor, and the cord that runs along the
// wall to the outlet. Units are decimetres. One world, framed by every room shot (wide, screen, cord, x-ray, ending).
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, shaftMat, fxMesh, FXU, DEPTH_GLSL, FX_LAYER } from '../gl/fx.js';
import { rbox, cyl, mesh, inst, merge, at, V3 } from '../gl/geo.js';
import { canvasTexture } from '../gl/tex.js';
import { rng, TAU, clamp, lerp, hash2, smooth } from '../core.js';
import { Screen, SW, SH } from './screen.js';

const limb = (a, b, r0, r1 = r0) => {
  const A = V3(...a), B = V3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r1, r0, d.length(), 14, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, V3(1, 1, 1)));
  return g;
};
const ball = (x, y, z, r, sy = 1, sz = 1) => at(new THREE.SphereGeometry(r, 20, 14), x, y, z, 0, 0, 0, [1, sy, sz]);

export const OUTLET = [-24, 3.2, 0];            // wall plate centre
export const MON = { x: 7, y: 11.3, z: 1.9, w: 8.5, h: 8.5 * SH / SW };

export function buildRoom() {
  const scene = new THREE.Scene(), R = rng(2024);
  scene.userData.clear = 0x0a1418;
  const cam = new THREE.PerspectiveCamera(32, 1920 / 804, 0.1, 300);
  // ---------------- light: low dusk sun through the window (the wall has a real opening), teal ambient
  const sun = new THREE.DirectionalLight(0xffa868, 1.7); sun.position.set(-40, 26, -30); sun.target.position.set(0, 2, 12);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 26, bottom: -22, near: 5, far: 120 });
  const hemi = new THREE.HemisphereLight(0x4f8fb0, 0x0b1a22, 0.5);
  const screenLight = new THREE.PointLight(0xffd29a, 0, 40, 1.4); screenLight.position.set(MON.x, MON.y, MON.z + 2.2);
  const towerLight = new THREE.PointLight(0x62dcff, 0, 16, 1.6); towerLight.position.set(-6.5, 3, 4.6);
  scene.add(sun, sun.target, hemi, screenLight, towerLight);

  // ---------------- materials
  const wallM = paint(0x6f8a8c, { scale: 0.09, stroke: 0.3 });
  const trimM = paint(0xd9d2c2, { scale: 0.2, stroke: 0.25 });
  const woodM = paint(0x8a5c3c, { scale: 0.16, stroke: 0.4, rim: 1.2 });
  const darkM = paint(0x1b2028, { scale: 0.2, stroke: 0.35, rim: 1.4 });
  const slateM = paint(0x38424e, { scale: 0.2, stroke: 0.35, rim: 1.2 });
  const creamM = paint(0xe6dcc6, { scale: 0.3, stroke: 0.25 });

  // ---------------- shell: floor, back wall with a window opening, side walls
  const floorTex = canvasTexture(1024, 1024, (c, S) => {
    const r = rng(9); c.fillStyle = '#7a5a40'; c.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++) { let x = -r() * 300; while (x < S) { const w = 260 + r() * 300, v = 0.82 + r() * 0.36;
      c.fillStyle = `rgb(${122 * v | 0},${90 * v | 0},${64 * v | 0})`; c.fillRect(x, y * 128, w - 4, 124); c.fillStyle = 'rgba(40,24,14,0.5)'; c.fillRect(x + w - 4, y * 128, 4, 128); c.fillRect(x, y * 128 + 124, w, 4);
      for (let k = 0; k < 5; k++) { c.strokeStyle = `rgba(60,38,22,${0.12 + r() * 0.15})`; c.lineWidth = 1 + r() * 2; c.beginPath(); const yy = y * 128 + r() * 120; c.moveTo(x, yy); c.bezierCurveTo(x + w / 3, yy + (r() - 0.5) * 14, x + w * 2 / 3, yy + (r() - 0.5) * 14, x + w, yy); c.stroke(); }
      x += w; } }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(5, 5);
  const floor = mesh(new THREE.PlaneGeometry(90, 80), paint(0xffffff, { map: floorTex, scale: 0.12, stroke: 0.35 }), { cast: false, z: 30 });
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const WX0 = -21, WX1 = -9, WY0 = 8.5, WY1 = 21;     // window opening
  scene.add(mesh(merge([at(new THREE.BoxGeometry(24, 30, 1), -33, 15, -0.5), at(new THREE.BoxGeometry(54, 30, 1), 18, 15, -0.5),
    at(new THREE.BoxGeometry(12, WY0, 1), -15, WY0 / 2, -0.5), at(new THREE.BoxGeometry(12, 30 - WY1, 1), -15, (30 + WY1) / 2, -0.5)]), wallM));
  const side = mesh(new THREE.PlaneGeometry(90, 30), wallM, { cast: false, x: -34, y: 15, z: 30 }); side.rotation.y = Math.PI / 2; scene.add(side);
  const side2 = mesh(new THREE.PlaneGeometry(90, 30), wallM, { cast: false, x: 34, y: 15, z: 30 }); side2.rotation.y = -Math.PI / 2; scene.add(side2);
  scene.add(mesh(new THREE.BoxGeometry(70, 1.1, 0.25), trimM, { y: 0.55, z: 0.12 }));       // skirting board
  // window frame, sill, mullions
  const fr = [at(rbox(12.8, 0.6, 1.3, 0.1), -15, WY0 - 0.2, 0.1), at(rbox(12.8, 0.5, 0.7, 0.1), -15, WY1 + 0.15, 0), at(rbox(0.5, 12.9, 0.7, 0.1), WX0 - 0.15, 14.75, 0), at(rbox(0.5, 12.9, 0.7, 0.1), WX1 + 0.15, 14.75, 0),
    at(rbox(0.28, 12.5, 0.4, 0.05), -15, 14.75, -0.3), at(rbox(12, 0.28, 0.4, 0.05), -15, 15.2, -0.3)];
  scene.add(mesh(merge(fr), trimM));
  // dusk sky outside (unlit, HDR, brushed by the Kuwahara like everything in the world layer)
  const skyU = { uNight: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShaderMaterial({ uniforms: skyU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uNight;
      void main(){ float y = vUv.y;
        vec3 d = mix(vec3(1.9, 0.86, 0.36), vec3(1.25, 0.6, 0.5), smoothstep(0.3, 0.55, y)); d = mix(d, vec3(0.42, 0.42, 0.7), smoothstep(0.5, 0.85, y));
        float cl = smoothstep(0.02, 0.0, abs(y - 0.5 - 0.05 * sin(vUv.x * 9.0)) - 0.03) * 0.3 + smoothstep(0.02, 0.0, abs(y - 0.62 - 0.03 * sin(vUv.x * 14.0 + 2.0)) - 0.015) * 0.25;
        d += vec3(0.9, 0.4, 0.2) * cl;
        vec3 n = mix(vec3(0.05, 0.1, 0.2), vec3(0.015, 0.03, 0.08), y) + vec3(0.2, 0.12, 0.05) * smoothstep(0.42, 0.3, y);
        gl_FragColor = vec4(mix(d, n, uNight), 1.0); }` }));
  sky.position.set(-15, 16, -9); scene.add(sky);
  // far roofline and a tree outside
  const outM = new THREE.MeshBasicMaterial({ color: 0x0a1418 });
  scene.add(new THREE.Mesh(merge([at(new THREE.BoxGeometry(60, 10, 0.2), -15, 4.5, -7), at(new THREE.ConeGeometry(3.4, 3.2, 4), -21.5, 10.6, -7, 0, 0.78),
    at(new THREE.SphereGeometry(1.9, 12, 8), -11.2, 12.6, -6), at(new THREE.SphereGeometry(1.4, 12, 8), -10.0, 14.0, -6), at(new THREE.CylinderGeometry(0.2, 0.3, 6), -10.8, 9.5, -6)]), outM));
  // curtains: soft folds either side
  const curt = []; for (const s of [-1, 1]) for (let i = 0; i < 6; i++) curt.push({ p: [-15 + s * (7.2 + i * 0.52), 13.6, 0.75 + (i % 2) * 0.22], s: [0.36, 16.5, 0.36] });
  scene.add(inst(cyl(1, 1.15, 1, 12), paint(0xd8c7a8, { scale: 0.3, stroke: 0.25, emissive: 0x3a2412, emissiveIntensity: 0.5 }), curt));
  scene.add(mesh(at(cyl(0.14, 0.14, 19, 8), -15, 22.3, 0.9, 0, 0, Math.PI / 2), darkM));
  // plant on the sill
  const leaves = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; leaves.push(at(new THREE.SphereGeometry(0.75, 10, 8), -18.6 + Math.cos(a) * 0.7, 10.7 + (i % 3) * 0.55, 0.5 + Math.sin(a) * 0.5, 0.3, a, 0.6, [0.5, 1.5, 0.22])); }
  scene.add(mesh(merge(leaves), paint(0x2f6b4a, { scale: 0.5, stroke: 0.4, rim: 1.5 })));
  scene.add(mesh(at(cyl(0.75, 0.55, 1.2, 16), -18.6, 9.3, 0.5), paint(0xb9b0a0, { scale: 0.4 })));

  // ---------------- desk, monitor, keyboard, things
  const DX = 7;
  scene.add(mesh(merge([at(rbox(15.5, 0.5, 7.2, 0.12), DX, 7.4, 3.9), at(rbox(0.5, 7.2, 0.5, 0.08), DX - 7.2, 3.6, 0.8), at(rbox(0.5, 7.2, 0.5, 0.08), DX - 7.2, 3.6, 7), at(rbox(4.2, 6.6, 6.6, 0.12), DX + 5.4, 3.9, 3.9)]), woodM));
  scene.add(mesh(merge([at(rbox(3.4, 0.14, 0.2, 0.05), DX + 5.4, 5.9, 7.25), at(rbox(3.4, 0.14, 0.2, 0.05), DX + 5.4, 3.6, 7.25), at(rbox(3.4, 0.14, 0.2, 0.05), DX + 5.4, 1.6, 7.25)]), darkM));
  scene.add(mesh(merge([at(cyl(1.6, 1.7, 0.16, 28), MON.x, 7.74, 1.6), at(rbox(0.6, 2.2, 0.3, 0.1), MON.x, 8.8, 1.45), at(rbox(MON.w + 0.44, MON.h + 0.44, 0.34, 0.12), MON.x, MON.y, MON.z - 0.19)]), darkM));
  const screen = new Screen();
  const scrU = { ...FXU, tMap: { value: screen.tex }, uOn: { value: 1 }, uGain: { value: 1 } };
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(MON.w, MON.h), new THREE.ShaderMaterial({ uniforms: scrU,
    vertexShader: 'varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `precision highp float; ${DEPTH_GLSL} uniform sampler2D tMap; uniform float uOn, uGain; varying vec2 vUv; varying float vZ;
      void main(){ if (sceneZ() < vZ - 0.05) discard; vec3 c = texture2D(tMap, vUv).rgb; c = pow(c, vec3(2.2));
        vec2 q = abs(vUv - 0.5) * 2.0; float edge = 1.0 - 0.18 * pow(max(q.x, q.y), 6.0);
        gl_FragColor = vec4(c * uGain * uOn * edge, 1.0); }` }));
  scr.position.set(MON.x, MON.y, MON.z); scr.layers.set(FX_LAYER); scene.add(scr);
  // keyboard with keys, mouse, mug, books, a small lamp
  const keys = []; for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) keys.push({ p: [DX - 2.05 + k * 0.315, 7.93, 4.45 + r * 0.3], s: [0.26, 0.09, 0.25], c: (r === 2 && k === 13) || (r === 3 && k === 13) ? 0xcfd6dc : 0xeef0ee });
  scene.add(mesh(at(rbox(4.7, 0.22, 1.75, 0.08), DX, 7.78, 5.05), paint(0xb8c0c6, { scale: 0.5 })));
  scene.add(inst(rbox(1, 1, 1, 0.2, 2), paint(0xffffff, { scale: 0.8, stroke: 0.15 }), keys, { cast: false }));
  scene.add(mesh(at(new THREE.SphereGeometry(0.42, 16, 10), DX + 3.4, 7.82, 5.1, 0, 0, 0, [0.75, 0.5, 1.2]), creamM));
  scene.add(mesh(merge([at(cyl(0.48, 0.42, 1.0, 20), DX - 4.6, 8.16, 4.6), at(new THREE.TorusGeometry(0.3, 0.09, 8, 16), DX - 5.1, 8.16, 4.6)]), paint(0x2f7f86, { scale: 0.6, rim: 1.4 })));
  const books = [[0x355c7d, 2.6, 0.5], [0xc9a24a, 2.4, 0.38], [0x5b3a5e, 2.5, 0.45]].map(([c, w, h], i) => mesh(at(rbox(w, h, 3.3, 0.06), DX - 5.6 + i * 0.08, 7.9 + [0, 0.48, 0.9][i], 1.9, 0, 0.12 * (i - 1)), paint(c, { scale: 0.5, stroke: 0.3 })));
  books.forEach(b => scene.add(b));
  // wall shelf with books and a frame
  scene.add(mesh(at(rbox(11, 0.3, 2.2, 0.08), 12, 17, 1.2), woodM));
  const sb = []; let bx = 7.4; const cols = [0x2f5d62, 0x8a3b4a, 0xd1b26b, 0x40506a, 0x6b8f71, 0xa8643a, 0x2b3a55, 0xc7c0ae];
  for (let i = 0; i < 17; i++) { const w = 0.32 + R() * 0.3, h = 2.2 + R() * 1.1; if (i === 9) bx += 1.6; sb.push({ p: [bx + w / 2, 17.15 + h / 2, 1.1], s: [w, h, 1.7], r: [0, 0, i === 8 ? 0.22 : 0], c: cols[Math.floor(R() * cols.length)] }); bx += w + 0.05; }
  scene.add(inst(rbox(1, 1, 1, 0.06, 2), paint(0xffffff, { scale: 0.6, stroke: 0.35 }), sb));
  scene.add(mesh(merge([at(rbox(4.6, 5.8, 0.25, 0.08), 21.5, 15.5, 0.15)]), woodM));
  scene.add(mesh(at(new THREE.PlaneGeometry(3.8, 5), 21.5, 15.5, 0.3), paint(0x9fb7b0, { scale: 0.5, stroke: 0.5 }), { cast: false }));
  // rug
  const rugTex = canvasTexture(512, 512, (c, S) => { c.fillStyle = '#27455a'; c.fillRect(0, 0, S, S); c.strokeStyle = '#c8b68a'; c.lineWidth = 10; c.strokeRect(26, 26, S - 52, S - 52); c.strokeStyle = '#3f6f7a'; c.lineWidth = 6;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(60, 70 + i * 47); for (let x = 60; x < S - 60; x += 40) c.lineTo(x + 20, 70 + i * 47 + ((x / 40) % 2 ? 14 : -14)); c.stroke(); } });
  const rug = mesh(new THREE.PlaneGeometry(17, 12), paint(0xffffff, { map: rugTex, scale: 0.3, stroke: 0.4 }), { cast: false, x: DX, y: 0.03, z: 10.5 }); rug.rotation.x = -Math.PI / 2; scene.add(rug);

  // ---------------- chair + the user (seen from behind)
  const CZ = 9.7;
  const spokes = []; for (let i = 0; i < 5; i++) spokes.push(at(rbox(2.6, 0.22, 0.34, 0.1), DX + Math.cos(i / 5 * TAU) * 1.3, 0.5, CZ + Math.sin(i / 5 * TAU) * 1.3, 0, -i / 5 * TAU, 0));
  scene.add(mesh(merge([...spokes, at(cyl(0.22, 0.22, 3.8, 12), DX, 2.5, CZ), at(rbox(4.7, 0.7, 4.5, 0.3), DX, 4.55, CZ)]), slateM));
  const user = new THREE.Group(); user.position.set(DX, 4.9, CZ + 0.4); scene.add(user);       // pivots at the hips (leans back at the end)
  const chairBack = mesh(merge([at(rbox(4.5, 5.6, 0.7, 0.34), 0, 3.6, 1.75, 0.1), at(rbox(0.5, 2.4, 0.4, 0.1), 0, 0.6, 1.9)]), slateM); user.add(chairBack);
  const skin = paint(0xb47c58, { scale: 0.6, stroke: 0.25, rim: 1.4 });
  const hoodie = paint(0xc79a45, { scale: 0.3, stroke: 0.4, rim: 1.5 });
  const hair = paint(0x1d1512, { scale: 0.7, stroke: 0.3, rim: 1.6 });
  const jeans = paint(0x2b3c55, { scale: 0.4, stroke: 0.35 });
  user.add(mesh(merge([at(rbox(4.0, 5.0, 2.5, 1.0, 5), 0, 2.6, 0.1, 0.06), ball(0, 4.8, 0.25, 1.75, 0.62, 0.8), ball(0, 5.25, 0.75, 1.15, 0.7, 0.75)]), hoodie));
  const head = new THREE.Group(); head.position.set(0, 6.55, -0.1); user.add(head);
  head.add(mesh(merge([ball(0, 0, 0, 1.05, 1.08, 1), ball(-1.02, -0.05, 0, 0.2, 1.3, 0.9), ball(1.02, -0.05, 0, 0.2, 1.3, 0.9), at(cyl(0.42, 0.46, 0.8, 12), 0, -1.1, 0.1)]), skin));
  head.add(mesh(merge([at(new THREE.SphereGeometry(1.13, 22, 14, 0, TAU, 0, Math.PI * 0.62), 0, 0.1, 0.12, -0.42), ball(0, 1.0, 0.75, 0.52)]), hair));
  const armsG = new THREE.Group(); user.add(armsG);
  const sl = [], hands = [];
  for (const s of [-1, 1]) {
    sl.push(limb([1.95 * s, 4.5, 0.1], [2.25 * s, 2.9, -1.9], 0.62, 0.56), limb([2.25 * s, 2.9, -1.9], [1.0 * s, 3.0, -4.3], 0.54, 0.44), ball(2.25 * s, 2.9, -1.9, 0.58));
    const h = mesh(ball(0, 0, 0, 0.36, 0.6, 1.1), skin); h.position.set(0.95 * s, 3.03, -4.65); hands.push(h); armsG.add(h);
  }
  armsG.add(mesh(merge(sl), hoodie));
  const lg = []; for (const s of [-1, 1]) lg.push(limb([1.0 * s, 0.3, 0], [1.1 * s, 0.25, -3.2], 0.78, 0.66), limb([1.1 * s, 0.25, -3.2], [1.1 * s, -4.3, -3.6], 0.6, 0.48), at(rbox(0.9, 0.5, 1.9, 0.2), 1.1 * s, -4.62, -4.1));
  const legs = mesh(merge(lg), jeans); legs.position.copy(user.position); scene.add(legs);

  // ---------------- tower PC on the floor (glass side to camera), outlet, cord
  const TX = -6.5, TZ = 2.4;
  scene.add(mesh(merge([at(rbox(4.8, 5.0, 2.3, 0.14), TX, 2.75, TZ), at(rbox(0.5, 0.25, 2.1, 0.08), TX - 1.8, 0.12, TZ), at(rbox(0.5, 0.25, 2.1, 0.08), TX + 1.8, 0.12, TZ)]), darkM));
  const glassU = { ...FXU, uGlow: { value: 0 }, uTime2: { value: 0 } };
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.5), new THREE.ShaderMaterial({ uniforms: glassU,
    vertexShader: 'varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `precision highp float; ${DEPTH_GLSL} uniform float uGlow, uTime2; varying vec2 vUv; varying float vZ;
      void main(){ if (sceneZ() < vZ - 0.05) discard; vec2 p = vUv - vec2(0.62, 0.58); float r = length(p * vec2(1.0, 1.02));
        float ring = smoothstep(0.03, 0.0, abs(r - 0.2)) + 0.5 * smoothstep(0.2, 0.0, r) * (0.6 + 0.4 * sin(atan(p.y, p.x) * 9.0 + uTime2 * 3.0));
        float strip = smoothstep(0.02, 0.0, abs(vUv.y - 0.12)) * smoothstep(0.05, 0.2, vUv.x) * smoothstep(0.95, 0.8, vUv.x);
        float ram = smoothstep(0.012, 0.0, abs(vUv.x - 0.2)) * smoothstep(0.35, 0.45, vUv.y) * smoothstep(0.9, 0.8, vUv.y) + smoothstep(0.012, 0.0, abs(vUv.x - 0.25)) * smoothstep(0.35, 0.45, vUv.y) * smoothstep(0.9, 0.8, vUv.y);
        vec3 c = vec3(0.25, 0.85, 1.0) * ring * 1.3 + vec3(1.0, 0.62, 0.3) * (strip + ram) * 1.2 + vec3(0.02, 0.05, 0.07);
        gl_FragColor = vec4(c * uGlow, 1.0); }`,
    transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false }));
  glass.position.set(TX, 2.8, TZ + 1.17); glass.layers.set(FX_LAYER); scene.add(glass);
  // outlet (US duplex) with the plug in the lower receptacle
  const [OX, OY] = OUTLET;
  scene.add(mesh(at(rbox(0.9, 1.4, 0.12, 0.08), OX, OY, 0.06), creamM, { cast: false }));
  const slots = []; for (const dy of [0.36, -0.36]) { slots.push(at(new THREE.BoxGeometry(0.045, 0.2, 0.05), OX - 0.11, OY + dy + 0.04, 0.125), at(new THREE.BoxGeometry(0.045, 0.17, 0.05), OX + 0.11, OY + dy + 0.04, 0.125), at(cyl(0.045, 0.045, 0.05, 10), OX, OY + dy - 0.14, 0.125, Math.PI / 2)); }
  slots.push(at(cyl(0.04, 0.04, 0.04, 10), OX, OY, 0.13, Math.PI / 2));
  scene.add(mesh(merge(slots), paint(0x15120f, { stroke: 0.1, rim: 0, shade: 0.3 }), { cast: false }));
  const slotGlow = new Sprites(3, { shape: 'dot', core: 0.8, soft: 0.2 }); scene.add(slotGlow.mesh);
  scene.add(mesh(merge([at(rbox(0.5, 0.46, 0.5, 0.12), OX, OY - 0.36, 0.38), at(cyl(0.11, 0.15, 0.4, 12), OX, OY - 0.36, 0.78, Math.PI / 2)]), darkM));
  // the cord: plug -> down the wall -> along the floor -> tower
  const cordPts = [[OX, OY - 0.36, 0.95], [OX + 0.05, OY - 0.9, 1.25], [OX + 0.3, 0.45, 1.5], [OX + 1.4, 0.13, 2.0], [-20.4, 0.13, 3.3], [-17.6, 0.13, 2.5], [-14.8, 0.13, 3.5], [-12.4, 0.13, 2.9], [-10.4, 0.13, 2.7], [-9.35, 0.3, 2.45], [-9.0, 1.0, 2.35]].map(p => V3(...p));
  const cord = new THREE.CatmullRomCurve3(cordPts, false, 'catmullrom', 0.5);
  const CR = 0.12;
  const jacketM = paint(0x20242b, { scale: 1.6, stroke: 0.3, rim: 1.6, dissolve: true });
  scene.add(mesh(new THREE.TubeGeometry(cord, 420, CR, 14, false), jacketM));
  // inside: three insulated conductors twisted together, each a rope of copper (only matters in the x-ray shot)
  const N = 520, frames = cord.computeFrenetFrames(N, false);
  const off = (i, ang, rad) => cord.getPointAt(i / N).addScaledVector(frames.normals[i], Math.cos(ang) * rad).addScaledVector(frames.binormals[i], Math.sin(ang) * rad);
  const wires = [], coppers = [];
  [0xe9e4d8, 0x23262c, 0x3f8f5c].forEach((col, w) => {
    const pts = []; for (let i = 0; i <= N; i++) pts.push(off(i, i * 0.11 + w * TAU / 3, 0.052));
    const cv = new THREE.CatmullRomCurve3(pts); wires.push(cv);
    scene.add(mesh(new THREE.TubeGeometry(cv, 700, 0.046, 10, false), paint(col, { scale: 3, stroke: 0.25, rim: 1.4, dissolve: true, revealK: 0.62 }), { cast: false }));
    for (let k = 0; k < 4; k++) { const cp = []; for (let i = 0; i <= N; i++) cp.push(off(i, i * 0.11 + w * TAU / 3, 0.052).add(V3(Math.cos(i * 0.55 + k * TAU / 4) * 0.014, Math.sin(i * 0.55 + k * TAU / 4) * 0.014, 0))); coppers.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 700, 0.012, 5, false)); }
  });
  const copperM = paint(0xd98a45, { scale: 4, stroke: 0.3, rim: 2.0, emissive: 0xff9a3c, emissiveIntensity: 0.0 });
  scene.add(mesh(merge(coppers), copperM, { cast: false }));

  // ---------------- atmosphere: window shafts and dust
  const shafts = new THREE.Group(); scene.add(shafts);
  const shM = shaftMat(0xffa462, { gain: 0.11, mode: 1, streak: 2.2, pow: 1.1, soft: 2, fadeTop: 0.02, fadeBot: 0.55 });
  for (let i = 0; i < 4; i++) { const s = fxMesh(new THREE.PlaneGeometry(3.4, 34), shM); s.position.set(-13.6 + i * 2.6 - 6.5 + 13, 7.4 - 1.5, 9.5 + i * 0.4); s.rotation.set(0.62, 0.42, -0.86); shafts.add(s); }
  const dust = new Sprites(200, { shape: 'dot', core: 0.3, soft: 0.6, drift: [0.9, 0.2, 0.6] });
  for (let i = 0; i < 200; i++) { const k = R(); dust.set(i, -15 + k * 22 + (R() - 0.5) * 9, 16 - k * 14 + (R() - 0.5) * 6, 1 + k * 14 + (R() - 0.5) * 5, 0.05 + R() * 0.09, 1.0, 0.75, 0.45, 0.25 + R() * 0.6, R()); }
  dust.commit(); scene.add(dust.mesh);

  return {
    scene, cam, sun, hemi, screenLight, towerLight, screen, scrU, glassU, user, head, hands, armsG, cord, wires, copperM, jacketM, slotGlow, shM, dust, skyU, CR,
    // state: { night 0..1, screenOn, screenGain, tower 0..1, typing (seconds of typing motion or -1), lean (rad), headTilt, slot 0..1 }
    set(t, s = {}) {
      const night = s.night ?? 0;
      sun.intensity = 1.7 * (1 - night); skyU.uNight.value = night;
      hemi.intensity = lerp(0.5, 0.26, night); hemi.color.setRGB(lerp(0.1, 0.05, night), lerp(0.28, 0.14, night), lerp(0.42, 0.34, night));
      shM.uniforms.uGain.value = 0.11 * (1 - night); dust.u.uGain.value = lerp(1, 0.25, night);
      const on = s.screenOn ?? 1;
      scrU.uOn.value = on; scrU.uGain.value = s.screenGain ?? 1.0;
      screenLight.intensity = (s.screenLight ?? lerp(1.3, 2.4, night)) * on;
      glassU.uGlow.value = s.tower ?? 0.25; glassU.uTime2.value = t; towerLight.intensity = (s.tower ?? 0.25) * 1.2;
      user.rotation.x = s.lean ?? 0; head.rotation.set(s.headNod ?? 0, s.headTurn ?? 0, s.headTilt ?? 0);
      const ty = s.typing ?? -1;
      hands.forEach((h, i) => { const k = ty >= 0 ? Math.max(0, Math.sin(ty * (19 + i * 3.1) + i * 2)) : 0; h.position.y = 3.03 + k * 0.14; h.position.x = (i ? 1 : -1) * 0.95 + (ty >= 0 ? Math.sin(ty * 5.3 + i) * 0.22 : 0); });
      const g = s.slot ?? 0, [ox, oy] = OUTLET;
      slotGlow.set(0, ox - 0.11, oy + 0.4, 0.16, 0.5 * g, 0.4, 0.9, 1.0, g * (0.8 + 0.2 * Math.sin(t * 23)), 0);
      slotGlow.set(1, ox + 0.11, oy + 0.4, 0.16, 0.5 * g, 0.4, 0.9, 1.0, g * (0.8 + 0.2 * Math.sin(t * 29 + 1)), 0.3);
      slotGlow.set(2, ox, oy - 0.3, 0.3, 1.6 * g, 0.3, 0.8, 1.0, g * 0.5, 0.6);
      slotGlow.commit();
    },
  };
}
