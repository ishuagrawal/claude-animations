// 3D effects, all analytic in t (no simulation state): glass shards, cel steam puffs, energy beams with a
// clash ball, spark streaks, a shockwave ring, and hanging price tags.
import * as THREE from 'three';
import { toon, glowMat, glassMat, RIG, common, vert } from '../gl/toon.js';
import { labelTex } from '../gl/tex.js';
import { rng, clamp } from '../core.js';

const G = 9.0; // world gravity (units/s²) — cartoon-light

// ---------- glass shards (pool), launched from a centre at time t0
export function makeShards(scene, n = 40, seed = 3) {
  const r = rng(seed);
  const list = [];
  const mat = glassMat('#cfe8ff', { fill: 0.25, amt: 1 });
  for (let i = 0; i < n; i++) {
    const geo = new THREE.BufferGeometry();
    const s = 0.05 + r() * 0.12;
    const v = new Float32Array([0, 0, 0, s, r() * s * 0.5, 0, r() * s * 0.6, s * (0.6 + r()), 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.computeVertexNormals();
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    const m = new THREE.Mesh(geo, mat);
    m.userData = { dir: new THREE.Vector3(r() - 0.5, 0.35 + r() * 0.9, r() - 0.5).normalize(), sp: 2 + r() * 4.5, spin: new THREE.Vector3(r() * 9, r() * 9, r() * 9) };
    m.visible = false; m.renderOrder = 13;
    scene.add(m); list.push(m);
  }
  return list;
}
export function animShards(list, t, t0, center, { floorY = 0.02, scale = 1 } = {}) {
  list.forEach(m => {
    const dt = t - t0;
    if (dt < 0) { m.visible = false; return; }
    m.visible = true;
    const d = m.userData;
    const v = d.dir.clone().multiplyScalar(d.sp * scale);
    const h = Math.max(0.0001, center.y - floorY);
    const tland = (v.y + Math.sqrt(v.y * v.y + 2 * G * h)) / G;
    const tt = Math.min(dt, tland);
    m.position.set(center.x + v.x * tt, Math.max(floorY, center.y + v.y * tt - 0.5 * G * tt * tt), center.z + v.z * tt);
    m.rotation.set(d.spin.x * tt, d.spin.y * tt, d.spin.z * tt);
    if (dt >= tland) m.rotation.set(-Math.PI / 2, 0, d.spin.z);
  });
}

// ---------- cel puffs (steam / dust): sprite with a 2-tone halftone puff texture
let PUFF = null;
function puffTex() {
  if (PUFF) return PUFF;
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const x = c.getContext('2d');
  // cel cloud: overlapping lobes, a halftone shade crescent on the lower right, soft-free hard edges
  const lobes = [[0.5, 0.56, 0.3], [0.32, 0.6, 0.2], [0.68, 0.62, 0.21], [0.42, 0.4, 0.22], [0.62, 0.42, 0.19]];
  const shape = () => { x.beginPath(); lobes.forEach(([cx, cy, r]) => { x.moveTo(cx * s + r * s, cy * s); x.arc(cx * s, cy * s, r * s, 0, 7); }); };
  x.fillStyle = '#ffffff'; shape(); x.fill();
  x.save(); shape(); x.clip();
  x.fillStyle = '#9aa0d6';
  lobes.forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx * s + r * s * 0.35, cy * s + r * s * 0.4, r * s * 0.85, 0, 7); x.fill(); });
  x.fillStyle = '#ffffff';
  lobes.forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx * s - r * s * 0.12, cy * s - r * s * 0.12, r * s * 0.82, 0, 7); x.fill(); });
  x.fillStyle = '#9aa0d6';
  for (let i = 0; i < s; i += 8) for (let j = 0; j < s; j += 8) {
    const d = Math.hypot(i - s * 0.72, j - s * 0.78) / (s * 0.42);
    const rr = clamp(1 - d) * 3.2;
    if (rr > 0.3) { x.beginPath(); x.arc(i, j, rr, 0, 7); x.fill(); }
  }
  x.restore();
  PUFF = new THREE.CanvasTexture(c); PUFF.colorSpace = THREE.NoColorSpace;
  return PUFF;
}
export function makePuffs(scene, n = 24) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false, color: '#c9cdf0' }));
    sp.visible = false; sp.renderOrder = 14;
    scene.add(sp); list.push(sp);
  }
  return list;
}
// emit a burst of puffs: centre, t0, life, spread, rise, color
export function animPuffs(list, t, bursts) {
  let k = 0;
  list.forEach(s => (s.visible = false));
  for (const b of bursts) {
    const r = rng(b.seed ?? 7);
    for (let i = 0; i < (b.n ?? 8) && k < list.length; i++, k++) {
      const s = list[k];
      const dt = t - b.t0 - r() * (b.stagger ?? 0.1);
      const life = (b.life ?? 0.9) * (0.7 + r() * 0.6);
      const a = r() * Math.PI * 2, sp = (b.spread ?? 1) * (0.4 + r());
      const dir = new THREE.Vector3(Math.cos(a) * sp, (b.rise ?? 0.6) * (0.5 + r()), Math.sin(a) * sp * (b.flatZ ?? 1));
      if (dt < 0 || dt > life) continue;
      const u = dt / life;
      const ease = 1 - Math.pow(1 - u, 3);
      s.visible = true;
      s.position.copy(b.c).addScaledVector(dir, ease * 0.9);
      const sc = (b.size ?? 0.5) * (0.5 + r()) * (0.4 + ease * 0.9) * (1 - Math.pow(u, 4));
      s.scale.set(sc, sc, 1);
      s.material.color.set(b.col ?? '#c9cdf0');
      s.material.opacity = (b.alpha ?? 1) * (1 - Math.pow(u, 3));
      s.material.rotation = r() * 6 + u;
    }
  }
}

// ---------- energy beam: layered cylinders, white-hot core, colored sheath, scrolling energy
function beamMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { ...RIG, uCol: { value: new THREE.Color(color) }, uT: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform vec3 uCol; uniform float uT, uAmt; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        if (uSil > 0.5) discard;
        float e = abs(dot(normalize(vN), normalize(vV)));
        float core = smoothstep(0.55, 0.9, e);
        float flow = 0.75 + 0.25 * sin(vUv.y * 60.0 - uT * 40.0) * sin(vUv.x * 6.283 * 3.0 + uT * 7.0);
        vec3 c = mix(uCol * 1.2, vec3(1.0, 0.98, 0.92), core);
        float a = (0.25 + 0.75 * smoothstep(0.1, 0.5, e)) * flow * uAmt;
        gl_FragColor = vec4(c * a, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
export function makeBeam(scene, color, glow) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
  geo.translate(0, 0.5, 0); // base at origin, extends +y
  const outer = new THREE.Mesh(geo, beamMat(color));
  const inner = new THREE.Mesh(geo, beamMat('#ffffff'));
  outer.renderOrder = inner.renderOrder = 15;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(outer, inner, halo);
  const b = { outer, inner, halo };
  setBeam(b, null);
  return b;
}
// from, to: Vector3; w: radius; t: time
export function setBeam(b, from, to, w = 0.18, t = 0, amt = 1) {
  const on = !!from && amt > 0.001;
  b.outer.visible = b.inner.visible = b.halo.visible = on;
  if (!on) return;
  const d = to.clone().sub(from), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const wob = 1 + Math.sin(t * 53) * 0.08 + Math.sin(t * 31) * 0.06;
  for (const [m, k] of [[b.outer, 1], [b.inner, 0.45]]) {
    m.position.copy(from); m.quaternion.copy(q);
    m.scale.set(w * k * wob, len, w * k * wob);
    m.material.uniforms.uT.value = t; m.material.uniforms.uAmt.value = amt;
  }
  b.halo.position.copy(from); b.halo.scale.set(w * 9, w * 9, 1); b.halo.material.opacity = 0.8 * amt;
}

// ---------- clash ball + spark streaks
export function makeClash(scene, glow, star) {
  const ball = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false }));
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false }));
  ball.renderOrder = flare.renderOrder = 16;
  scene.add(ball, flare);
  const sparks = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(geo, glowMat(i % 2 ? '#ffb070' : '#8fd0ff', { additive: true, amt: 1.4 }));
    m.renderOrder = 16; scene.add(m); sparks.push(m);
  }
  const c = { ball, flare, sparks };
  setClash(c, null);
  return c;
}
export function setClash(c, p, t = 0, amt = 1, size = 1) {
  const on = !!p && amt > 0.001;
  c.ball.visible = c.flare.visible = on;
  c.sparks.forEach(s => (s.visible = on));
  if (!on) return;
  const pulse = 1 + 0.18 * Math.sin(t * 41) + 0.1 * Math.sin(t * 17);
  c.ball.position.copy(p); c.ball.scale.setScalar(1.6 * size * pulse); c.ball.material.opacity = amt;
  c.flare.position.copy(p); c.flare.scale.setScalar(2.6 * size * pulse); c.flare.material.opacity = amt;
  const r = rng(91);
  c.sparks.forEach((s, i) => {
    const per = 0.25 + r() * 0.3, ph = r();
    const u = ((t / per + ph) % 1);
    const a = r() * Math.PI * 2, el = (r() - 0.5) * 1.6;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) * 0.6).normalize();
    const dist = (0.2 + u * (1.2 + r() * 1.2)) * size;
    s.position.copy(p).addScaledVector(dir, dist);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    const L = 0.25 * (1 - u) * size * amt;
    s.scale.set(Math.max(0.001, L), 0.025 * size, 0.025 * size);
  });
}

// ---------- shockwave ring on the floor
export function makeRing(scene) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), glowMat('#ffffff', { additive: true, amt: 1, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 15; m.visible = false;
  scene.add(m);
  return m;
}
export function setRing(m, p, k, col = '#ffffff') {
  m.visible = !!p && k > 0 && k < 1;
  if (!m.visible) return;
  m.position.set(p.x, 0.03, p.z);
  const s = 0.3 + k * 9;
  m.scale.set(s, s, 1);
  m.material.uniforms.uCol.value.set(col);
  m.material.uniforms.uAmt.value = (1 - k) * 1.5;
}

// ---------- price tags hanging on strings (tiebreaker)
export function makeTag(scene, text, col) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.03), toon({ base: '#f2e7c9', shade: '#c9b894', deep: '#5a4a52', half: 0.8 }));
  g.add(card);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.58), new THREE.MeshBasicMaterial({ map: labelTex([text], { w: 640, h: 352, sizes: [190], weights: [800], bg: '#f2e7c9', fg: col, border: col, hole: true }) }));
  face.position.z = 0.017; g.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.017; g.add(back);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 6, 4), new THREE.MeshBasicMaterial({ color: '#d8d0b8' }));
  str.position.y = 3.31; g.add(str);
  g.visible = false;
  scene.add(g);
  return g;
}

// ---------- power orb for the special moves: glow + flare + orbiting cubes (Claude's essence)
export function makeOrb(scene, glow, star) {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false }));
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(halo, core, flare);
  const cubes = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), glowMat('#ffffff', { amt: 1.2 }));
    g.add(m); cubes.push(m);
  }
  [halo, core, flare, ...cubes].forEach(o => (o.renderOrder = 17));
  g.visible = false; scene.add(g);
  return { g, halo, core, flare, cubes };
}
export function setOrb(o, p, t, k, col, cubeCol) {
  o.g.visible = !!p && k > 0.001;
  if (!o.g.visible) return;
  o.g.position.copy(p);
  const pulse = 1 + 0.12 * Math.sin(t * 30);
  o.halo.material.color.set(col); o.halo.scale.setScalar(1.6 * k * pulse); o.halo.material.opacity = 0.9;
  o.core.scale.setScalar(0.55 * k * pulse);
  o.flare.material.color.set(col); o.flare.scale.setScalar(2.2 * k);
  o.cubes.forEach((c, i) => {
    const a = t * 3.2 + i / o.cubes.length * Math.PI * 2, r = 0.42 * k, el = Math.sin(t * 2 + i) * 0.25;
    c.position.set(Math.cos(a) * r, el * k, Math.sin(a) * r * 0.5);
    c.rotation.set(t * 4 + i, t * 3, 0);
    c.material.uniforms.uCol.value.set(cubeCol);
    c.scale.setScalar(Math.max(0.001, k));
  });
}
