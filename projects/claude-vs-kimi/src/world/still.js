// The still: what "distilling Claude" looks like. A round-bottom flask over a blue gas flame holds Claude;
// its essence peels off as little orange cubes that rise through a glass swan neck into a glass coil, cool
// to blue on the way down, and drip from the spout into an Erlenmeyer flask labelled K3.1.
// Stands upstage centre (z = -3.2), so it is in the background of every fight shot.
import * as THREE from 'three';
import { toon, glowMat, glassMat, RIG, common, vert } from '../gl/toon.js';
import { labelTex, glowTex } from '../gl/tex.js';
import { rng, clamp } from '../core.js';

export const ST = {
  z: -3.2,
  boil: new THREE.Vector3(-1.7, 1.75, -3.2), boilR: 0.9,
  jacketX: 1.15, jacketY0: 1.95, jacketY1: 3.55,
  spout: new THREE.Vector3(1.85, 1.62, -3.2),
  recv: new THREE.Vector3(1.85, 0, -3.2),
};

const ORANGE = new THREE.Color('#ff8a4c'), BLUE = new THREE.Color('#4aa8ff');

// the full mote path: flask → swan neck → coil → spout
function buildPath() {
  const z = ST.z, bx = ST.boil.x, jx = ST.jacketX;
  const neck = [
    new THREE.Vector3(bx, 2.2, z), new THREE.Vector3(bx, 2.95, z), new THREE.Vector3(bx + 0.05, 3.6, z),
    new THREE.Vector3(bx + 0.6, 4.05, z), new THREE.Vector3(-0.2, 4.15, z), new THREE.Vector3(0.6, 3.95, z),
    new THREE.Vector3(jx, 3.7, z),
  ];
  const coil = [];
  const turns = 4.5, n = 90, r = 0.3;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = u * turns * Math.PI * 2;
    coil.push(new THREE.Vector3(jx + Math.sin(a) * r, 3.45 - u * 1.3, z + Math.cos(a) * r));
  }
  const tail = [new THREE.Vector3(jx + 0.25, 1.95, z + 0.1), new THREE.Vector3(ST.spout.x - 0.05, 1.85, z), new THREE.Vector3(ST.spout.x, 1.72, z), ST.spout.clone()];
  const neckCurve = new THREE.CatmullRomCurve3(neck, false, 'catmullrom', 0.4);
  const coilCurve = new THREE.CatmullRomCurve3(coil);
  const tailCurve = new THREE.CatmullRomCurve3([coil[coil.length - 1], ...tail]);
  return { neckCurve, coilCurve, tailCurve, path: new THREE.CatmullRomCurve3([...neckCurve.getPoints(60), ...coil.slice(1), ...tail], false, 'centripetal') };
}

// flame: layered cones with a flicker
function flameMat() {
  return new THREE.ShaderMaterial({
    uniforms: { ...RIG, uFlick: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform float uFlick, uAmt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        if (uSil > 0.5) discard;
        float e = abs(dot(normalize(vN), normalize(vV)));
        float core = smoothstep(0.2, 0.9, e);
        vec3 c = mix(vec3(0.15, 0.35, 1.0), vec3(0.75, 0.95, 1.0), core * (1.0 - vUv.y * 0.7));
        float a = (0.35 + 0.65 * core) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * uAmt;
        gl_FragColor = vec4(c * a * 1.4, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function makeStill(scene, { glow }) {
  const S = { motes: [], bubbles: [] };
  const P = buildPath();
  S.P = P;
  const g = new THREE.Group(); scene.add(g); S.group = g;
  const brass = toon({ base: '#e0a25a', shade: '#9a5a2a', deep: '#3a1a22', half: 1, hatch: 0.35, spec: 0.8, specSize: 40, specCol: '#fff2c8' });
  const iron = toon({ base: '#4a4f8f', shade: '#2a2d62', deep: '#0e0d2c', half: 0.7, spec: 0.4, specSize: 30 });
  const glass = glassMat('#9fd0ff', { fill: 0.05 });
  S.glassMats = [glass];

  // tripod + burner
  const bx = ST.boil.x, z = ST.z;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), iron);
    leg.position.set(bx + Math.sin(a) * 0.45, 0.45, z + Math.cos(a) * 0.45);
    leg.rotation.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18);
    g.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 40), iron);
  ring.rotation.x = Math.PI / 2; ring.position.set(bx, 0.9, z); g.add(ring);
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.35, 16), brass);
  burner.position.set(bx, 0.18, z); g.add(burner);
  const flames = [0.42, 0.3].map((h, i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 - i * 0.03, h, 24, 1, true), flameMat());
    f.position.set(bx, 0.36 + h / 2, z); f.renderOrder = 7; g.add(f); return f;
  });
  S.flames = flames;
  const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#3a7bff', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  flameGlow.scale.set(1.6, 1.6, 1); flameGlow.position.set(bx, 0.6, z); g.add(flameGlow); S.flameGlow = flameGlow;

  // boiling flask (round bottom) + neck; the inner glow is Claude's essence
  const flask = new THREE.Mesh(new THREE.SphereGeometry(ST.boilR, 64, 48), glass);
  flask.position.copy(ST.boil); flask.renderOrder = 10; g.add(flask); S.flask = flask;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.75, 32, 1, true), glass);
  neck.position.set(bx, ST.boil.y + ST.boilR + 0.3, z); neck.renderOrder = 10; g.add(neck);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 32), brass);
  lip.rotation.x = Math.PI / 2; lip.position.set(bx, ST.boil.y + ST.boilR + 0.66, z); g.add(lip);
  const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ff7a3a', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  steam.scale.set(2.2, 2.2, 1); steam.position.copy(ST.boil); g.add(steam); S.steam = steam;
  // tag on the neck: OPUS 5.5
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: labelTex(['OPUS 5.5'], { w: 512, h: 256, sizes: [118], bg: '#f2e7c9', hole: true }), side: THREE.DoubleSide }));
  tag.position.set(bx + 0.5, ST.boil.y + 0.62, z + 0.62); tag.rotation.set(-0.15, 0.15, -0.12); g.add(tag); S.tag = tag;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 4), iron);
  string.position.set(bx + 0.33, ST.boil.y + 1.0, z + 0.42); string.rotation.set(0.5, 0, 0.55); g.add(string); S.string = string;

  // swan neck, coil and spout: glass tubes
  const tubeR = 0.075;
  for (const c of [P.neckCurve, P.coilCurve, P.tailCurve]) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 200, tubeR, 14, false), glass);
    m.renderOrder = 10; g.add(m);
  }
  // condenser: glass water jacket with brass caps and inlet/outlet stubs
  const jh = ST.jacketY1 - ST.jacketY0;
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, jh, 48, 1, true), glassMat('#7fe0ff', { fill: 0.09 }));
  jacket.position.set(ST.jacketX, (ST.jacketY0 + ST.jacketY1) / 2, z); jacket.renderOrder = 11; g.add(jacket);
  for (const y of [ST.jacketY0, ST.jacketY1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.12, 40), brass);
    cap.position.set(ST.jacketX, y, z); g.add(cap);
  }
  // lab stand: rod + clamps
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.4, 10), iron);
  rod.position.set(0.25, 2.2, z - 0.55); g.add(rod);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.6), iron);
  base.position.set(0.25, 0.04, z - 0.45); g.add(base);
  for (const [x, y] of [[ST.jacketX, 2.4], [ST.jacketX, 3.25], [-0.2, 4.0]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x - 0.25) + 0.05, 0.05, 0.05), brass);
    arm.position.set((x + 0.25) / 2, y, z - 0.5); g.add(arm);
    const cl = new THREE.Mesh(new THREE.TorusGeometry(x === -0.2 ? 0.1 : 0.55, 0.03, 6, 24), brass);
    cl.rotation.x = Math.PI / 2; cl.position.set(x, y, z); g.add(cl);
  }

  // receiving flask: Erlenmeyer with blue distillate and a K3.1 label
  const prof = [];
  const fh = 1.0;
  prof.push(new THREE.Vector2(0.001, 0));
  prof.push(new THREE.Vector2(0.58, 0)); prof.push(new THREE.Vector2(0.62, 0.05));
  prof.push(new THREE.Vector2(0.2, fh * 0.78)); prof.push(new THREE.Vector2(0.15, fh * 0.86)); prof.push(new THREE.Vector2(0.15, fh * 1.08));
  prof.push(new THREE.Vector2(0.18, fh * 1.1));
  const recv = new THREE.Group(); recv.position.copy(ST.recv); g.add(recv); S.recv = recv;
  const rglass = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glassMat('#9fd0ff', { fill: 0.06 }));
  rglass.renderOrder = 12; recv.add(rglass); S.recvGlass = rglass;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.57, 0.22, 40), toon({ base: '#4aa8ff', shade: '#2361d8', deep: '#16307e', emis: '#2f7cf6', emisAmt: 0.35, half: 0.6 }));
  liq.position.y = 0.13; recv.add(liq); S.liquid = liq;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), new THREE.MeshBasicMaterial({ map: labelTex(['K3.1'], { w: 512, h: 288, sizes: [150], bg: '#f2e7c9' }), transparent: true }));
  lab.position.set(0, 0.36, 0.43); lab.rotation.x = -0.36; recv.add(lab); S.recvLabel = lab;
  const recvGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#2f7cf6', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  recvGlow.scale.set(3, 3, 1); recvGlow.position.set(0, 0.4, 0); recv.add(recvGlow); S.recvGlow = recvGlow;

  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 24), brass);
  tip.rotation.x = Math.PI / 2; tip.position.set(ST.spout.x, ST.spout.y + 0.02, z); g.add(tip);
  // the drop (a stretched sphere) and its glint
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), toon({ base: '#7cc4ff', shade: '#2f7cf6', deep: '#16307e', spec: 1, specSize: 30, emis: '#2f7cf6', emisAmt: 0.4, half: 0 }));
  g.add(drop); S.drop = drop;

  // motes: little cubes of Claude riding the path (analytic positions, see animateStill)
  const r = rng(55);
  const moteGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(moteGeo, glowMat('#ff8a4c', { amt: 1 }));
    m.userData = { off: r(), speed: 0.11 + r() * 0.05, spin: r() * 6, jit: r() };
    g.add(m); S.motes.push(m);
  }
  // bubbles + cubes peeling off Claude inside the flask
  const bubbleGeo = new THREE.SphereGeometry(0.028, 12, 8);
  const bubbleMat = glassMat('#ffd8c0', { fill: 0.08 });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(i % 2 ? moteGeo : bubbleGeo, i % 2 ? glowMat('#ff8a4c', { amt: 1 }) : bubbleMat);
    m.renderOrder = 9;
    m.userData = { off: r(), x: (r() - 0.5) * 1.1, z: (r() - 0.5) * 1.1, sp: 0.5 + r() * 0.6 };
    g.add(m); S.bubbles.push(m);
  }
  return S;
}

// flow: 0..1 how strongly the still runs; heat: flame size; t: time
export function animateStill(S, t, { flow = 1, heat = 1, dropT = null, recvFill = 0.3, recvGlow = 0 } = {}) {
  const P = S.P.path;
  S.flames.forEach((f, i) => {
    const fl = 1 + Math.sin(t * 37 + i) * 0.08 + Math.sin(t * 23.3) * 0.06;
    f.scale.set(heat * (1 + 0.05 * Math.sin(t * 31)), heat * fl, heat);
    f.position.y = 0.36 + 0.21 * heat * fl;
    f.material.uniforms.uAmt.value = heat;
  });
  S.flameGlow.material.opacity = 0.7 * heat;
  S.steam.material.opacity = 0.18 + 0.2 * flow;
  S.motes.forEach(m => {
    const d = m.userData;
    const u = (d.off + t * d.speed) % 1;
    m.visible = flow > 0.02 && u > 0.01 && u < 0.985;
    const p = P.getPointAt(u);
    m.position.copy(p);
    m.position.x += Math.sin(t * 3 + d.spin) * 0.02;
    m.rotation.set(t * 2 + d.spin, t * 1.7 + d.spin, 0);
    const k = clamp((u - 0.35) / 0.35);
    m.material.uniforms.uCol.value.copy(ORANGE).lerp(BLUE, k);
    const s = (0.6 + 0.6 * d.jit) * (1 - 0.35 * k) * flow;
    m.scale.setScalar(Math.max(0.001, s));
  });
  S.bubbles.forEach(b => {
    const d = b.userData;
    const u = (d.off + t * d.sp * 0.5) % 1;
    b.position.set(ST.boil.x + d.x * (1 - u * 0.6), ST.boil.y - 0.6 + u * 1.4, ST.z + d.z * (1 - u * 0.6));
    b.visible = flow > 0.02;
    b.scale.setScalar(Math.max(0.001, (0.6 + u) * flow));
    b.rotation.set(t * 2, t * 3, 0);
  });
  // the drop: swell at the spout, then fall to the receiving flask
  const dr = S.drop;
  if (dropT === null) dr.visible = false;
  else {
    dr.visible = true;
    const { phase, k } = dropT; // phase 'swell' (k 0..1) or 'fall' (k 0..1)
    if (phase === 'swell') {
      dr.position.set(ST.spout.x, ST.spout.y - 0.03 - k * 0.07, ST.z);
      dr.scale.set(0.5 + k * 0.6, 0.6 + k * 0.9, 0.5 + k * 0.6);
    } else {
      const y0 = ST.spout.y - 0.12, y1 = ST.recv.y + 0.9;
      dr.position.set(ST.spout.x, y0 + (y1 - y0) * k * k, ST.z);
      dr.scale.set(0.95, 1.6 - k * 0.3, 0.95);
    }
  }
  S.liquid.scale.y = Math.max(0.05, recvFill / 0.3);
  S.liquid.position.y = 0.02 + 0.11 * S.liquid.scale.y;
  S.recvGlow.material.opacity = recvGlow;
}
