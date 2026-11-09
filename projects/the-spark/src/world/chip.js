// Inside the processor: a hushed hall of silicon. Pillars recede like a forest, interconnect beams cross overhead
// like a canopy, one shaft of light falls from an oculus onto a dais where Claude sleeps. Units: Claude is 8 wide.
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, shaftMat, fxMesh, FXU, DEPTH_GLSL, FX_LAYER } from '../gl/fx.js';
import { rbox, cyl, mesh, inst, merge, at, V3 } from '../gl/geo.js';
import { canvasTexture } from '../gl/tex.js';
import { rng, TAU, clamp, lerp, hash2, smooth } from '../core.js';
import { PROMPT } from '../timeline.js';

export const WORDS = ['Write', 'me', 'a', 'poem', 'about', 'a', 'spark.'];

export function buildChip() {
  const scene = new THREE.Scene(), R = rng(512);
  scene.userData.clear = 0x03050c;
  scene.fog = new THREE.FogExp2(0x070c1c, 0.0075);
  const cam = new THREE.PerspectiveCamera(34, 1920 / 804, 0.3, 500);
  const top = new THREE.DirectionalLight(0xa9c8ff, 0.85); top.position.set(14, 90, 26); top.target.position.set(0, 0, 0);
  top.castShadow = true; top.shadow.mapSize.set(2048, 2048); top.shadow.bias = -0.0006; top.shadow.normalBias = 0.2;
  Object.assign(top.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 220 });
  const hemi = new THREE.HemisphereLight(0x2c4a8c, 0x04060d, 0.34);
  const warm = new THREE.PointLight(0xffb070, 0, 170, 1.2); warm.position.set(-3, 17, 15);
  scene.add(top, top.target, hemi, warm);

  // ---- floor: the die, drawn as a floorplan of blocks and buses
  const tex = canvasTexture(2048, 2048, (c, S) => {
    const r = rng(8); c.fillStyle = '#1b2942'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      const w = 80 + r() * 380, h = 60 + r() * 300, x = r() * S - w / 2, y = r() * S - h / 2, v = r();
      c.fillStyle = v < 0.4 ? '#22355a' : v < 0.7 ? '#16223a' : '#2a416c'; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(120,160,220,0.5)'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
      if (r() < 0.6) { c.strokeStyle = 'rgba(110,150,210,0.28)'; c.lineWidth = 1.5; const st = 6 + r() * 8, hz = r() < 0.5;
        for (let k = st; k < (hz ? h : w); k += st) { c.beginPath(); hz ? (c.moveTo(x, y + k), c.lineTo(x + w, y + k)) : (c.moveTo(x + k, y), c.lineTo(x + k, y + h)); c.stroke(); } }
    }
    for (let i = 0; i < 40; i++) { c.strokeStyle = 'rgba(190,170,120,0.4)'; c.lineWidth = 3; c.beginPath(); const hz = r() < 0.5, p = r() * S; hz ? (c.moveTo(0, p), c.lineTo(S, p)) : (c.moveTo(p, 0), c.lineTo(p, S)); c.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
  const floor = mesh(new THREE.PlaneGeometry(520, 520), paint(0xffffff, { map: tex, scale: 0.03, stroke: 0.4 }), { cast: false });
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // warmth that ripples out across the die from the dais
  const ripU = { ...FXU, uR: { value: 0 }, uAmt: { value: 0 }, uBase: { value: 0.0 } };
  const rip = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.ShaderMaterial({ uniforms: ripU,
    vertexShader: 'varying vec2 vP; varying float vZ; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; vec4 mv = viewMatrix * w; vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `precision highp float; ${DEPTH_GLSL} uniform float uR, uAmt, uBase; varying vec2 vP; varying float vZ;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){ float r = length(vP); vec2 g = vP / 4.5; vec2 f = abs(fract(g) - 0.5); vec2 id = floor(g);
        float line = smoothstep(0.46, 0.5, max(f.x, f.y)); float cell = step(0.72, hh(id)) * 0.35;
        float bus = smoothstep(0.42, 0.5, abs(fract(vP.x / 27.0) - 0.5) * 2.0) * 0.0;
        float inside = smoothstep(uR, uR - 26.0, r) * smoothstep(240.0, 60.0, r);
        float ring = exp(-pow((r - uR) / 3.2, 2.0));
        vec3 c = vec3(1.0, 0.62, 0.3) * ((line * 0.55 + cell * 0.5) * inside * uAmt + ring * (0.5 + line) * uAmt * 1.4) + vec3(0.25, 0.5, 1.0) * line * uBase * smoothstep(120.0, 10.0, r);
        gl_FragColor = vec4(c * softDepth(vZ, 0.5), 1.0); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }));
  rip.rotation.x = -Math.PI / 2; rip.position.y = 0.06; rip.layers.set(FX_LAYER); rip.frustumCulled = false; scene.add(rip);

  // ---- dais
  const stone = paint(0x7388ad, { scale: 0.06, stroke: 0.4, rim: 1.2 });
  scene.add(mesh(merge([at(cyl(19, 20, 1.2, 64), 0, 0.6, 0), at(cyl(14.5, 15.5, 1.2, 64), 0, 1.8, 0), at(cyl(10.5, 11.2, 1.0, 64), 0, 2.9, 0)]), stone));
  const DAIS_Y = 3.4;
  // ---- the pillar forest (a clearing round the dais, an aisle toward the camera)
  const pil = [], caps = [];
  for (let gx = -13; gx <= 13; gx++) for (let gz = -15; gz <= 6; gz++) {
    const x = gx * 10 + (R() - 0.5) * 2.4, z = gz * 10 + (R() - 0.5) * 2.4, rr = Math.hypot(x, z);
    if (rr < 31) continue; if (Math.abs(x) < 17 && z > 0) continue; if (R() < 0.12) continue;
    const w = 1.6 + R() * 1.6, h = 150;
    pil.push({ p: [x, h / 2, z], s: [w, h, w], r: [0, R() * 0.6, 0] }); caps.push({ p: [x, 0.8, z], s: [w * 1.9, 1.6, w * 1.9], r: [0, R() * 0.6, 0] });
  }
  const pilM = paint(0x5b6f96, { scale: 0.05, stroke: 0.45, rim: 1.6 });
  scene.add(inst(rbox(1, 1, 1, 0.12, 2), pilM, pil)); scene.add(inst(rbox(1, 1, 1, 0.2, 2), stone, caps));
  // ---- interconnect canopy: beams crossing at several heights, an oculus left open above the dais
  const beams = [];
  for (let l = 0; l < 4; l++) { const y = 62 + l * 13, alongX = l % 2 === 0;
    for (let i = -12; i <= 12; i++) { const o = i * 11 + (R() - 0.5) * 3; if (Math.abs(o) < 14) continue;
      beams.push(alongX ? { p: [0, y, o], s: [300, 1.6, 2.6 + R() * 2] } : { p: [o, y, 0], s: [2.6 + R() * 2, 1.6, 300] }); } }
  scene.add(inst(new THREE.BoxGeometry(1, 1, 1), paint(0x3b4a6e, { scale: 0.04, stroke: 0.4, rim: 1.2 }), beams, { receive: false }));
  // ---- light from the oculus
  const shaftM = shaftMat(0x8fb8ff, { gain: 0.085, mode: 0, streak: 5, pow: 3.0, soft: 6, fadeTop: 0.0, fadeBot: 0.5 });
  const shaft = fxMesh(new THREE.CylinderGeometry(11, 19, 130, 40, 1, true), shaftM); shaft.position.y = 66; scene.add(shaft);
  const oculus = new Sprites(2, { shape: 'dot', core: 0.9, soft: 20 }); scene.add(oculus.mesh);
  const dust = new Sprites(260, { shape: 'dot', core: 0.3, soft: 2, drift: [2.2, 0.16, 0.6] });
  for (let i = 0; i < 260; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * 42; dust.set(i, Math.cos(a) * rr, 2 + R() * 70, Math.sin(a) * rr, 0.25 + R() * 0.5, 0.75, 0.86, 1.0, 0.2 + R() * 0.5, R()); }
  dust.commit(); scene.add(dust.mesh);

  // ---- the prompt as drifting words of light
  const wordMeshes = [], wordW = [];
  const meas = document.createElement('canvas').getContext('2d'); meas.font = '500 150px Cormorant, Georgia, serif';
  WORDS.forEach((w, i) => {
    const tw = Math.ceil(meas.measureText(w).width) + 60;
    const tx = canvasTexture(tw, 230, (c) => { c.clearRect(0, 0, tw, 230); c.font = '500 150px Cormorant, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(w, tw / 2, 118); });
    const u = { ...FXU, tMap: { value: tx }, uA: { value: 0 }, uCol: { value: new THREE.Color(0.62, 0.86, 1.0) } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tw / 230, 1), new THREE.ShaderMaterial({ uniforms: u,
      vertexShader: 'varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `precision highp float; ${DEPTH_GLSL} uniform sampler2D tMap; uniform float uA; uniform vec3 uCol; varying vec2 vUv; varying float vZ;
        void main(){ float a = texture2D(tMap, vUv).a * uA * softDepth(vZ, 0.6); gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.35) * a * 1.5, 1.0); }`,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }));
    m.layers.set(FX_LAYER); m.frustumCulled = false; scene.add(m); wordMeshes.push({ m, u }); wordW.push(tw / 230);
  });
  return { scene, cam, top, hemi, warm, ripU, shaftM, oculus, dust, wordMeshes, wordW, DAIS_Y, pilM };
}
