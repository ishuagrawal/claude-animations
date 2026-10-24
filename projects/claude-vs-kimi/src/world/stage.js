// The arena: one world every shot frames with its own camera. Units ≈ Claude's body width.
// Dark indigo stage, reflective checker floor, colored spot cones with stipple dust and star flares,
// a ring truss hung with red paper lanterns, an LED-bar curtain, a giant moon backdrop (dark side out:
// 月之暗面, "the dark side of the moon", is Moonshot AI's Chinese name) and a cyan neon sign of it.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { toon, glowMat, coneMat, RIG } from '../gl/toon.js';
import { starTex, glowTex, moonTex, checkerTex, neonTex, grungeTex } from '../gl/tex.js';
import { rng } from '../core.js';

export const STAGE_R = 6.5;
const MAXPOOLS = 8;

const floorShader = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uMap: { value: null }, uRes: { value: new THREE.Vector2(1920, 1080) },
    uPoolPos: { value: Array.from({ length: MAXPOOLS }, () => new THREE.Vector3()) },   // x, z, radius
    uPoolCol: { value: Array.from({ length: MAXPOOLS }, () => new THREE.Color(0)) },
    uRefl: { value: 0.42 }, uFogCol: { value: new THREE.Color('#0c0a2b') }, uSeed: { value: 0 },
    uBright: { value: 1 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUvR; varying vec3 vW; varying float vDepth;
    void main(){
      vUvR = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      vec4 mv = viewMatrix * w; vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, uMap; uniform vec2 uRes;
    uniform vec3 uPoolPos[${MAXPOOLS}]; uniform vec3 uPoolCol[${MAXPOOLS}];
    uniform float uRefl, uSeed, uBright; uniform vec3 uFogCol;
    varying vec4 vUvR; varying vec3 vW; varying float vDepth;
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      float r = length(vW.xz);
      if (r > ${STAGE_R.toFixed(2)}) discard;
      vec3 base = texture2D(uMap, vW.xz / 9.6 + 0.5).rgb;
      vec3 c = base * 0.62;
      // reflection, slightly blurred
      vec4 uv = vUvR; vec3 rf = vec3(0.0);
      for (int i = 0; i < 4; i++) { vec2 o = vec2(float(i == 1) - float(i == 2), float(i == 3) - float(i == 0)) * 0.006 * uv.w; rf += texture2DProj(tDiffuse, vec4(uv.xy + o, uv.zw)).rgb; }
      rf *= 0.25;
      c += rf * uRefl * (0.6 + 0.4 * base.b * 2.0);
      // light pools with a stippled edge
      vec2 px = floor(gl_FragCoord.xy / (uRes.y / 1080.0) / 2.0);
      float h = hash12(px + uSeed);
      for (int i = 0; i < ${MAXPOOLS}; i++) {
        vec3 p = uPoolPos[i]; if (p.z <= 0.0) continue;
        float d = length(vW.xz - p.xy) / p.z;
        float core = 1.0 - smoothstep(0.55, 0.95, d);
        float st = step(h, (1.0 - smoothstep(0.75, 1.35, d)) * 0.45);
        c += uPoolCol[i] * (core * 0.55 * (0.5 + base.b * 1.6) + st * 0.35);
      }
      // stage edge band
      float edge = smoothstep(${(STAGE_R - 0.25).toFixed(2)}, ${(STAGE_R - 0.18).toFixed(2)}, r);
      c = mix(c, vec3(0.05, 0.04, 0.14), edge);
      c *= uBright;
      c = mix(c, uFogCol, smoothstep(14.0, 60.0, vDepth));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function makeStage(scene) {
  const S = { spots: [], lanterns: [], bars: [], flares: [] };
  const STAR = starTex(), GLOW = glowTex();
  S.STAR = STAR; S.GLOW = GLOW;

  // floor
  const floor = new Reflector(new THREE.CircleGeometry(STAGE_R, 96), {
    textureWidth: 1024, textureHeight: 576, clipBias: 0.003, shader: floorShader, multisample: 0,
  });
  floor.rotation.x = -Math.PI / 2;
  floor.material.uniforms.uMap.value = checkerTex();
  scene.add(floor);
  S.floor = floor;
  // stage skirt (the platform's edge) + rim lights
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(STAGE_R, STAGE_R + 0.15, 0.5, 96, 1, true), toon({ base: '#2a2d6e', shade: '#191a48', deep: '#0b0a26', half: 0.6 }));
  skirt.position.y = -0.25; scene.add(skirt);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat('#ffd98a', { amt: 1.3 }), 64);
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.sin(a) * (STAGE_R + 0.08), -0.12, Math.cos(a) * (STAGE_R + 0.08)));
  }
  scene.add(bulbs);
  // the void floor beyond the stage
  const pit = new THREE.Mesh(new THREE.CircleGeometry(60, 64), toon({ base: '#0e0d2c', shade: '#0b0a22', deep: '#07061a', half: 0, rim: 0 }));
  pit.rotation.x = -Math.PI / 2; pit.position.y = -0.5; scene.add(pit);

  // moon backdrop: dark side out, a thin lit crescent upper-right
  const moonMat = toon({ base: '#f3e6bf', shade: '#2a2c66', deep: '#141542', half: 1, map: moonTex(), mapAmt: 0.7, rim: 0, fog: 0.2 });
  moonMat.uniforms.uKeyDir = { value: new THREE.Vector3(0.85, 0.45, -0.28).normalize() };
  moonMat.uniforms.uKeyCol = { value: new THREE.Color('#ffffff') };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6.5, 96, 64), moonMat);
  moon.position.set(0, 6.2, -24);
  moon.rotation.y = -0.5;
  scene.add(moon);
  S.moon = moon;
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#3b4bb0', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  moonHalo.scale.set(22, 22, 1); moonHalo.position.set(0, 6.2, -25); scene.add(moonHalo);

  // light strips radiating from behind the moon (reference: ceiling of light strips), gold and cyan
  const r = rng(31);
  const barGeo = new THREE.PlaneGeometry(1, 1);
  barGeo.translate(0, 0.5, 0);
  for (let i = 0; i < 44; i++) {
    const a = -2.3 + i / 43 * 4.6 + (r() - 0.5) * 0.05;
    const len = 6 + r() * 10;
    const m = new THREE.Mesh(barGeo, glowMat(i % 3 === 1 ? '#38b6ff' : '#f2c46a', { amt: 0.5, additive: true, side: THREE.DoubleSide }));
    m.scale.set(0.06 + r() * 0.07, len, 1);
    const r0 = 7.0 + r() * 0.8;
    m.position.set(Math.sin(a) * r0, 6.2 + Math.cos(a) * r0, -25);
    m.rotation.z = -a;
    m.userData.ph = r() * 6.28;
    scene.add(m); S.bars.push(m);
  }
  // twinkles hanging in the dark (reference: 4-point sparkles everywhere)
  S.twinkles = [];
  for (let i = 0; i < 46; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: STAR, color: ['#ffffff', '#9fd8ff', '#ffd98a', '#ff8fa8'][i % 4], blending: THREE.AdditiveBlending, depthWrite: false }));
    const a = r() * Math.PI * 2, rad = 9 + r() * 14;
    sp.position.set(Math.sin(a) * rad, 1.5 + r() * 13, -Math.abs(Math.cos(a)) * rad - 4);
    sp.userData = { s: 0.35 + Math.pow(r(), 2) * 1.2, ph: r() * 6.28, f: 0.6 + r() * 1.5 };
    scene.add(sp); S.twinkles.push(sp);
  }
  // dim back wall (so the rays read against something)
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 30, 64, 1, true, Math.PI * 0.6, Math.PI * 0.8), toon({ base: '#0d0d2a', shade: '#0a0a22', deep: '#060518', half: 0, rim: 0, fog: 0, side: THREE.BackSide }));
  wall.position.set(0, 10, 0); scene.add(wall);
  // ring truss
  const trussMat = toon({ base: '#4a4f8f', shade: '#262a5c', deep: '#0e0d2c', half: 0.8, hatch: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.12, 8, 96), trussMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 8.2; scene.add(ring);
  const ring2 = ring.clone(); ring2.position.y = 8.7; scene.add(ring2);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), trussMat);
    strut.position.set(Math.sin(a) * 7.2, 8.45, Math.cos(a) * 7.2); scene.add(strut);
  }

  // red paper lanterns hanging from the truss (warm practicals)
  const lanternProfile = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; lanternProfile.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI) * 0.36, t * 0.72 - 0.36)); }
  const lanternGeo = new THREE.LatheGeometry(lanternProfile, 24);
  const lanternMat = toon({ base: '#ff5a4a', shade: '#d22a3a', deep: '#7a1030', emis: '#ff3a2a', emisAmt: 0.25, half: 0.8, rim: 0.6 });
  lanternMat.uniforms.uKeyCol = { value: new THREE.Color('#ffffff') };   // own dimmer (not the shared rig)
  S.lanternMat = lanternMat;
  const capMat = toon({ base: '#f2c46a', shade: '#b8862e', deep: '#4c2a1a', half: 0.5 });
  const ribMat = toon({ base: '#5a1020', shade: '#3a0a18', deep: '#1a0610', half: 0, rim: 0.3 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.1;
    const g = new THREE.Group();
    const len = 0.6 + (i % 3) * 0.35;
    g.position.set(Math.sin(a) * 6.6, 8.1 - len - 0.4, Math.cos(a) * 6.6);
    const body = new THREE.Mesh(lanternGeo, lanternMat); g.add(body);
    for (let k = 0; k < 6; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.47 - Math.abs(k - 2.5) * 0.05, 0.012, 4, 24), ribMat);
      rib.rotation.x = Math.PI / 2; rib.position.y = -0.27 + k * 0.11; g.add(rib);
    }
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 16), capMat); capT.position.y = 0.39; g.add(capT);
    const capB = capT.clone(); capB.position.y = -0.39; g.add(capB);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, len, 4), ribMat); cord.position.y = 0.43 + len / 2; g.add(cord);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), capMat); tassel.position.y = -0.58; tassel.rotation.x = Math.PI; g.add(tassel);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ff5a3a', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    halo.scale.set(2.2, 2.2, 1); g.add(halo);
    g.userData.ph = a * 3;
    scene.add(g); S.lanterns.push(g);
  }

  // neon sign on the Kimi side: 月之暗面
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.76), glowMat('#ffffff', { map: neonTex('月之暗面', '#38d6ff'), additive: true, amt: 1.2 }));
  neon.position.set(10.5, 4.6, -9.5); neon.rotation.y = -0.75; scene.add(neon);
  const neonPlate = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.1, 0.12), toon({ base: '#1b1d4a', shade: '#121338', deep: '#08071c', half: 0.5, map: grungeTex(3, 200), mapAmt: 0.8 }));
  neonPlate.position.copy(neon.position).add(new THREE.Vector3(0.06, 0, -0.08)); neonPlate.rotation.y = -0.75; scene.add(neonPlate);
  S.neon = neon;

  // spot lamps on the truss (cones are re-aimed per shot)
  const coneGeo = new THREE.ConeGeometry(1, 1, 64, 1, true);
  coneGeo.translate(0, -0.5, 0);   // apex at origin, opening toward -y
  for (let i = 0; i < MAXPOOLS; i++) {
    const cone = new THREE.Mesh(coneGeo, coneMat('#ffffff'));
    cone.frustumCulled = false; cone.renderOrder = 5;
    scene.add(cone);
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: STAR, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
    flare.renderOrder = 6; scene.add(flare);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 16), toon({ base: '#3a3e7a', shade: '#22265a', deep: '#0b0a26', half: 0.6 }));
    scene.add(head);
    S.spots.push({ cone, flare, head, on: false });
  }
  return S;
}

// spots: [{ from:[x,y,z], to:[x,z], r, col, amt, flare }]
export function setSpots(S, spots, t) {
  const u = S.floor.material.uniforms;
  S.spots.forEach((s, i) => {
    const d = spots[i];
    s.cone.visible = s.flare.visible = s.head.visible = !!d && (d.amt ?? 1) > 0.001;
    if (!s.cone.visible) { u.uPoolPos.value[i].set(0, 0, 0); return; }
    const from = new THREE.Vector3(...d.from), to = new THREE.Vector3(d.to[0], 0, d.to[1]);
    const dir = from.clone().sub(to);
    const len = dir.length();
    s.cone.position.copy(from);
    s.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    s.cone.scale.set(d.r, len, d.r);
    const amt = d.amt ?? 1;
    s.cone.material.uniforms.uCol.value.set(d.col);
    s.cone.material.uniforms.uAmt.value = amt * (d.cone ?? 1);
    s.cone.material.uniforms.uSeed.value = Math.floor(t * 12) + i * 7;
    s.head.position.copy(from).add(dir.clone().normalize().multiplyScalar(0.2));
    s.head.quaternion.copy(s.cone.quaternion);
    s.flare.position.copy(from).add(dir.clone().normalize().multiplyScalar(-0.15));
    const fs = (d.flare ?? 1.6) * amt;
    s.flare.scale.set(fs, fs, 1);
    s.flare.material.color.set(d.col);
    s.flare.material.opacity = Math.min(1, amt);
    u.uPoolPos.value[i].set(d.to[0], d.to[1], d.r * (d.pool ?? 1.05));
    u.uPoolCol.value[i].set(d.col).multiplyScalar(amt);
  });
}

// ambient life: LED bars shimmer on the beat, lanterns sway
export function animateStage(S, t, { barAmt = 1, beatPulse = 0 } = {}) {
  S.bars.forEach((m, i) => {
    const v = (0.45 + 0.35 * Math.sin(t * 2.2 + m.userData.ph)) * barAmt + beatPulse * 0.5;
    m.material.uniforms.uAmt.value = v;
  });
  S.twinkles.forEach(sp => {
    const k = Math.max(0, Math.sin(t * sp.userData.f * 2 + sp.userData.ph));
    const sc = sp.userData.s * (0.35 + 0.65 * k * k);
    sp.scale.set(sc, sc, 1); sp.material.opacity = 0.3 + 0.7 * k;
  });
  S.lanterns.forEach(g => { g.rotation.z = Math.sin(t * 1.3 + g.userData.ph) * 0.05; g.rotation.x = Math.cos(t * 1.1 + g.userData.ph) * 0.04; });
  S.floor.material.uniforms.uSeed.value = Math.floor(t * 12) % 97;
}
