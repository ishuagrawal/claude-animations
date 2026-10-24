// Claude, extruded from refs/claude-mascot.png (250×189, body #DA7758). Measured in px (body width 148 = 1 unit):
//   body 148×104 → 1.00 × 0.70;   arms 36×38 → 0.243 × 0.257, top at 33% of body height;
//   legs 18×40 → 0.12 × 0.27, centres at ±0.44 / ±0.18;   eyes 17 px black squares → 0.115, centres ±0.30,
//   23% down from the body top. Depth is ours (0.62): a chunky block, four legs in a row like the sheet.
// Origin = ground under the body centre; +z = front (eyes).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, common, vert } from '../gl/toon.js';

export const CLAUDE = { body: '#da7758', shade: '#b4533a', deep: '#5a2236' };
const LEG = 0.27, BW = 1.0, BH = 0.70, BD = 0.62;

// Flat matte-black eyes; expression only through their shape (bloom-project lesson: never break the
// mascot's graphic identity). Modes are blended by uniforms: open (height), slant (angry cut), glow.
export function eyeMat(color = '#0b0a12') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) }, uOpen: { value: 1 }, uSlant: { value: 0 }, uSide: { value: 1 },
      uGlow: { value: new THREE.Color('#ffd27a') }, uGlowAmt: { value: 0 }, uSil: { value: 0 }, uSilCol: { value: new THREE.Color(0) },
      uRound: { value: 0.08 }, uW: { value: 1 }, uX: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol, uGlow, uSilCol; uniform float uOpen, uSlant, uSide, uGlowAmt, uSil, uRound, uW, uX;
      varying vec2 vUv;
      float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
      void main(){
        vec2 p = vUv - 0.5;
        float h = 0.5 * max(uOpen, 0.06);
        float d = sdBox(p, vec2(0.5 * uW, h), min(uRound, h));
        // angry slant: cut the top edge, inner corner (toward the nose) lower
        // slant > 0: angry (inner corners down); < 0: worried (outer corners down)
        float ramp = uSlant >= 0.0 ? (0.55 - p.x * uSide * 1.1) : (0.55 + p.x * uSide * 1.1);
        float cut = p.y - (h - abs(uSlant) * ramp * h * 1.2);
        d = max(d, cut);
        if (uX > 0.5) {   // KO: X eyes
          float b1 = abs(p.x - p.y) * 0.7071 - 0.085, b2 = abs(p.x + p.y) * 0.7071 - 0.085;
          d = max(min(b1, b2), max(abs(p.x), abs(p.y)) - 0.5);
        }
        float aa = fwidth(d) * 1.2;
        float a = 1.0 - smoothstep(-aa, aa, d);
        if (a < 0.01) discard;
        vec3 c = mix(uCol, uGlow, uGlowAmt);
        if (uSil > 0.5) c = uSilCol;
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
  });
}

export function makeClaude() {
  const mat = toon({ base: CLAUDE.body, shade: CLAUDE.shade, deep: CLAUDE.deep, half: 1, spec: 0.0, rim: 1, grad: [-0.35, 0.3, 0.3] });
  const root = new THREE.Group();          // world placement (x, z, facing)
  const hips = new THREE.Group();          // bounce + squash about the feet
  root.add(hips);
  const body = new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 3, 0.035), mat);
  body.position.y = LEG + BH / 2;
  hips.add(body);
  // arms pivot at the shoulder seam so they can swing forward (punch) or up (cheer)
  const arms = [-1, 1].map(s => {
    const g = new THREE.Group();
    g.position.set(s * BW / 2, LEG + BH - 0.33 * BH - 0.1285, 0);
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.243, 0.257, 0.30, 2, 0.025), mat);
    m.position.x = s * 0.1215;
    g.add(m); hips.add(g);
    return g;
  });
  const legs = [-0.44, -0.18, 0.18, 0.44].map(x => {
    const g = new THREE.Group();
    g.position.set(x, LEG + 0.02, 0);
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.12, LEG + 0.04, 0.15, 2, 0.02), mat);
    m.position.y = -(LEG + 0.04) / 2;
    g.add(m); hips.add(g);
    return g;
  });
  const eyes = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.115), eyeMat());
    m.material.uniforms.uSide.value = s;
    m.position.set(s * 0.30, LEG + BH - 0.23 * BH, BD / 2 + 0.003);
    hips.add(m);
    return m;
  });
  const c = { root, hips, body, arms, legs, eyes, mat };
  pose(c, {});
  return c;
}

// p: x,y,z, ry (facing), lean (z roll), pitch (x), sq (squash: <1 flat, >1 tall), armL/armR (x-rot, rad,
// + = forward/up), armLz/armRz (outward lift), reach (punch extension), walk (phase), stride, eyes {open, slant, glow}, scale
export function pose(c, p) {
  const { root, hips, arms, legs, eyes } = c;
  root.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  root.rotation.set(0, p.ry ?? 0, 0);
  root.scale.setScalar(p.scale ?? 1);
  const sq = p.sq ?? 1;
  hips.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  hips.rotation.set(p.pitch ?? 0, 0, p.lean ?? 0);
  hips.position.y = p.lift ?? 0;
  const al = arms[0], ar = arms[1];
  al.rotation.set(-(p.armL ?? 0), 0, -(p.armLz ?? 0));
  ar.rotation.set(-(p.armR ?? 0), 0, p.armRz ?? 0);
  al.position.z = (p.reachL ?? 0); ar.position.z = (p.reachR ?? 0);
  const ph = p.walk ?? 0, st = p.stride ?? 0;
  legs.forEach((g, i) => {
    const o = (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0);
    g.rotation.x = Math.sin(ph + o) * st;
    g.position.y = 0.29 + Math.max(0, Math.cos(ph + o)) * st * 0.12;
  });
  const e = p.eyes || {};
  eyes.forEach(m => {
    const u = m.material.uniforms;
    u.uOpen.value = e.open ?? 1; u.uSlant.value = e.slant ?? 0;
    u.uGlowAmt.value = e.glow ?? 0; if (e.glowCol) u.uGlow.value.set(e.glowCol);
    u.uX.value = e.x ? 1 : 0;
    m.scale.set(e.w ?? 1, 1, 1);
  });
}

// anchors in world space (for FX placement)
export function anchors(c) {
  c.root.updateMatrixWorld(true);
  const w = v => c.hips.localToWorld(v.clone());
  return {
    center: w(new THREE.Vector3(0, LEG + BH / 2, 0)),
    face: w(new THREE.Vector3(0, LEG + BH * 0.72, BD / 2)),
    eyeL: w(new THREE.Vector3(-0.30, LEG + BH - 0.23 * BH, BD / 2 + 0.01)),
    eyeR: w(new THREE.Vector3(0.30, LEG + BH - 0.23 * BH, BD / 2 + 0.01)),
    top: w(new THREE.Vector3(0, LEG + BH, 0)),
  };
}

export function setSil(c, on, color) {
  c.eyes.forEach(m => { m.material.uniforms.uSil.value = on ? 1 : 0; if (color) m.material.uniforms.uSilCol.value.set(color); });
}
