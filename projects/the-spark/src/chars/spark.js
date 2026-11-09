// The Spark: an electric discharge that becomes a character. A plasma teardrop (wisp on top that trails behind
// when it moves), big dark eyes, lightning arms and legs that re-strike on twos, a halo, a light, a trail.
// Everything is a pure function of the pose passed to update(); nothing is simulated.
import * as THREE from 'three';
import { FXU, DEPTH_GLSL, Sprites, Ribbon, FX_LAYER } from '../gl/fx.js';
import { hash2, clamp, lerp, TAU, FPS } from '../core.js';

const Y = new THREE.Vector3(0, 1, 0);
const v = () => new THREE.Vector3();
const _a = v(), _b = v(), _c = v(), _d = v(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();

// jagged polyline a -> b into out[] (n points), re-struck per seed
export function strike(a, b, n, amp, seed, out, sag = 0) {
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), w = Math.sin(k * Math.PI);
    const p = out[i] || (out[i] = v());
    p.lerpVectors(a, b, k);
    p.x += (hash2(seed, i * 3) - 0.5) * 2 * amp * w;
    p.y += (hash2(seed, i * 3 + 1) - 0.5) * 2 * amp * w - sag * w;
    p.z += (hash2(seed, i * 3 + 2) - 0.5) * 2 * amp * w;
  }
  out.length = n;
  return out;
}

export class Spark {
  constructor({ trail = 30, motes = 28, color = 0x59e6ff } = {}) {
    this.group = new THREE.Group();
    this.col = new THREE.Color(color);
    const rig = this.rig = new THREE.Group(); this.group.add(rig);
    this.bodyMat = new THREE.ShaderMaterial({
      uniforms: { ...FXU, uLean: { value: v() }, uWobble: { value: 1 }, uGain: { value: 1 },
        uCore: { value: new THREE.Color(0.9, 1.0, 1.0) }, uEdge: { value: new THREE.Color(0.22, 0.82, 1.0) } },
      vertexShader: `uniform float uTime, uWobble; uniform vec3 uLean; varying vec3 vN; varying vec3 vV; varying float vZ; varying float vH;
        void main() {
          vec3 p = position; float h = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
          p.xz *= 1.0 - 0.5 * pow(h, 3.0); p.y += 0.34 * pow(h, 4.0);
          p += normal * (sin(p.y * 6.0 + uTime * 9.0) * 0.03 + sin(p.x * 7.0 + uTime * 7.3) * 0.022 + sin(p.z * 5.0 - uTime * 8.1) * 0.022) * uWobble;
          p += uLean * pow(h, 2.0);
          p.x += sin(uTime * 13.0) * 0.07 * pow(h, 4.0); p.z += cos(uTime * 11.0) * 0.05 * pow(h, 4.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vZ = -mv.z; vV = -mv.xyz; vN = normalMatrix * normal; vH = h;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; ${DEPTH_GLSL}
        uniform vec3 uCore, uEdge; uniform float uGain; varying vec3 vN; varying vec3 vV; varying float vZ; varying float vH;
        void main() { if (sceneZ() < vZ - 0.03) discard;
          float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
          vec3 c = mix(uEdge, uCore, smoothstep(0.25, 0.95, f));
          c = mix(c, vec3(0.05, 0.3, 0.95), pow(1.0 - f, 2.5) * 0.6);
          c = mix(c, uEdge * 1.3, pow(vH, 3.0) * 0.5);
          gl_FragColor = vec4(c * uGain, 1.0); }`,
    });
    this.body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 6), this.bodyMat);
    this.body.layers.set(FX_LAYER); this.body.frustumCulled = false; rig.add(this.body);
    // face: eyes ride on the body surface, pointed at the camera plus a look offset
    const face = this.face = new THREE.Group(); rig.add(face);
    const eyeMat = this.eyeMat = new THREE.ShaderMaterial({
      uniforms: { ...FXU, uColor: { value: new THREE.Color(0.012, 0.03, 0.11) }, uOp: { value: 1 } },
      vertexShader: `varying float vZ; varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; ${DEPTH_GLSL} uniform vec3 uColor; uniform float uOp; varying float vZ; varying vec3 vN; varying vec3 vV;
        void main() { if (sceneZ() < vZ - 0.03) discard; float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
          gl_FragColor = vec4(uColor + vec3(0.02, 0.07, 0.16) * pow(1.0 - f, 2.0), uOp * smoothstep(0.0, 0.35, f)); }`,
      transparent: true, depthWrite: false, depthTest: false,
    });
    const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false });
    const sph = new THREE.SphereGeometry(1, 20, 14);
    this.eyes = [-1, 1].map(s => {
      const e = new THREE.Mesh(sph, eyeMat); e.layers.set(FX_LAYER); e.renderOrder = 20; e.frustumCulled = false;
      const h = new THREE.Mesh(sph, hiMat); h.layers.set(FX_LAYER); h.renderOrder = 21; h.frustumCulled = false;
      const h2 = new THREE.Mesh(sph, hiMat); h2.layers.set(FX_LAYER); h2.renderOrder = 21; h2.frustumCulled = false;
      face.add(e, h, h2);
      return { e, h, h2, s };
    });
    this.hiMat = hiMat;
    this.light = new THREE.PointLight(color, 2, 14, 1.6); this.light.layers.enableAll(); this.group.add(this.light);
    this.nM = motes;
    this.glow = new Sprites(6, { shape: 'dot', core: 0.0, soft: 0.6 });
    this.motes = new Sprites(motes, { shape: 'star', core: 1.0, soft: 0.3 });
    this.arms = [new Ribbon(7, { color, gain: 2.2, core: 1.6 }), new Ribbon(7, { color, gain: 2.2, core: 1.6 })];
    this.legs = [new Ribbon(6, { color, gain: 2.0, core: 1.4 }), new Ribbon(6, { color, gain: 2.0, core: 1.4 })];
    this.trail = new Ribbon(trail, { color, gain: 1.5, core: 0.9, soft: 0.5 });
    this.nT = trail;
    this.crown = [0, 1, 2].map(() => new Ribbon(6, { color, gain: 2.4, core: 1.8 }));
    this.group.add(...this.crown.map(r => r.mesh));
    this._cp = [[], [], []];
    this.group.add(this.glow.mesh, this.motes.mesh, this.trail.mesh, ...this.arms.map(r => r.mesh), ...this.legs.map(r => r.mesh));
    this._pts = [[], [], [], []]; this._tr = [];
    this.hands = [v(), v()];
  }
  // P: { pos, vel, size, look:[x,y], open, wide, happy, armL, armR ([x,y,z] face-local hand targets), legs (0..1),
  //      run (phase), glow, light, trailFn(age)->Vector3, trailLen, trailAmt, squash, spin }
  update(t, camera, P) {
    const size = P.size ?? 0.3, pos = P.pos, vel = P.vel || _d.set(0, 0, 0), glow = P.glow ?? 1;
    const fseed = Math.floor(t * FPS / 2 + 1e-6);
    const speed = vel.length(), sp = clamp(speed / (size * 14), 0, 1);
    this.group.visible = size > 1e-4 && glow > 1e-3;
    if (!this.group.visible) { this.light.intensity = 0; return; }
    this.rig.position.copy(pos);
    this.rig.scale.setScalar(size);
    // body: wisp points up at rest and trails behind the motion
    _a.copy(Y).multiplyScalar(1 - sp * 0.4);
    if (speed > 1e-5) _a.addScaledVector(vel, -sp * 0.62 / speed);
    _a.normalize();
    this.body.quaternion.setFromUnitVectors(Y, _a);
    const sq = (P.squash ?? 1) * (1 + sp * 0.16), ix = 1 / Math.sqrt(sq);
    this.body.scale.set(ix, sq, ix);
    this.bodyMat.uniforms.uWobble.value = 1 + sp * 1.2;
    this.bodyMat.uniforms.uGain.value = lerp(0.5, 0.98, clamp(glow));
    // face toward the camera with a look offset
    _m.lookAt(camera.position, pos, camera.up);
    this.face.quaternion.setFromRotationMatrix(_m);
    const lx = clamp(P.look?.[0] ?? 0, -1, 1), ly = clamp(P.look?.[1] ?? 0, -1, 1);
    _q.setFromEuler(_e.set(-ly * 0.5, lx * 0.72, (P.tilt ?? 0)));
    this.face.quaternion.multiply(_q);
    const open = clamp(P.open ?? 1, 0.06, 1.3), wide = P.wide ?? 1, happy = P.happy ?? 0;
    for (const { e, h, h2, s } of this.eyes) {
      const ex = 0.3 * s, ey = 0.06 + happy * 0.05, ez = 0.955;
      e.position.set(ex, ey, ez); e.rotation.set(0, s * 0.3, s * -0.06 * (1 - happy) + s * 0.25 * happy);
      e.scale.set(0.135 * wide * (1 + happy * 0.12), 0.215 * wide * open * (1 - happy * 0.42), 0.06);
      const hv = open > 0.35 ? 1 : 0;
      h.position.set(ex - 0.045, ey + 0.085 * open, ez + 0.065); h.scale.setScalar(0.05 * wide * hv);
      h2.position.set(ex + 0.05, ey - 0.07 * open, ez + 0.06); h2.scale.setScalar(0.024 * wide * hv);
    }
    this.face.scale.set(ix, sq, ix);        // keep the face on the squashed/stretched surface
    this.eyeMat.uniforms.uOp.value = clamp((P.eyes ?? 1));
    this.hiMat.opacity = clamp((P.eyes ?? 1));
    this.rig.updateMatrixWorld(true);
    // limbs
    const armAmt = P.arms ?? 1, legAmt = P.legs ?? 1;
    const idle = Math.sin(t * 2.2) * 0.06;
    const tg = [P.armL || [-1.28, -0.5 + idle, 0.3], P.armR || [1.28, -0.5 - idle, 0.3]];
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      _a.set(0.8 * s, -0.12, 0.3); this.face.localToWorld(_a);
      _b.set(...tg[i]); this.face.localToWorld(_b);
      this.hands[i].copy(_b);
      strike(_a, _b, 6, 0.1 * size, fseed * 7 + i * 31, this._pts[i]);
      this.arms[i].update(this._pts[i], camera, 0.26 * size, armAmt);
      // legs: hang below, swing when running, trail when flying
      const ph = (P.run ?? 0) + i * Math.PI, sw = Math.sin(ph) * 0.45 * (P.stride ?? 0), lift = Math.max(0, Math.cos(ph)) * 0.3 * (P.stride ?? 0);
      _a.set(0.36 * s, -0.86, 0.12); this.face.localToWorld(_a);
      _c.set(0.42 * s, -1.62 + lift, 0.12); this.face.localToWorld(_c);
      if (speed > 1e-5) { _c.addScaledVector(vel, (-sp * 0.7 * size) / speed); _b.copy(vel).cross(camera.up).cross(vel); if (_b.lengthSq() > 1e-8) _c.addScaledVector(_b.normalize(), sw * size); }
      strike(_a, _c, 5, 0.07 * size, fseed * 5 + i * 17 + 3, this._pts[2 + i]);
      this.legs[i].update(this._pts[2 + i], camera, 0.23 * size, legAmt);
      this.glow.set(2 + i, this.hands[i].x, this.hands[i].y, this.hands[i].z, 0.5 * size, 0.6, 0.95, 1.0, 1.1 * armAmt * glow, i);
      this.glow.set(4 + i, _c.x, _c.y, _c.z, 0.42 * size, 0.6, 0.95, 1.0, 1.0 * legAmt * glow, i);
    }
    // crown: short arcs that re-strike from the body on twos (the discharge never quite settles)
    for (let i = 0; i < 3; i++) {
      const sd = fseed * 13 + i * 101, live = hash2(sd, 1) < (P.crackle ?? 0.45) ? 1 : 0;
      const th = hash2(sd, 2) * TAU, ph = (hash2(sd, 3) - 0.35) * 1.6, r1 = 1.65 + hash2(sd, 4) * 0.7;
      _a.set(Math.cos(th) * Math.cos(ph), Math.sin(ph) + 0.25, 0.25 + Math.abs(Math.sin(th)) * 0.3).normalize().multiplyScalar(0.98);
      _b.copy(_a).multiplyScalar(r1); _b.x += (hash2(sd, 5) - 0.5) * 0.5; _b.y += (hash2(sd, 6) - 0.5) * 0.5;
      this.face.localToWorld(_a); this.face.localToWorld(_b);
      strike(_a, _b, 5, 0.12 * size, sd, this._cp[i]);
      this.crown[i].update(this._cp[i], camera, 0.14 * size, live * glow * (P.arms ?? 1));
    }
    const c = this.col, fl = 0.9 + 0.1 * Math.sin(t * 31) * Math.sin(t * 17.3);
    this.glow.set(0, pos.x, pos.y, pos.z, 7.0 * size, c.r, c.g, c.b, 0.26 * glow * fl, 0);
    this.glow.set(1, pos.x, pos.y, pos.z, 3.3 * size, 0.3, 0.8, 1.0, 0.3 * glow * fl, 0);
    this.glow.commit();
    this.light.position.copy(pos);
    this.light.color.set(P.lightCol ?? this.col);
    this.light.intensity = (P.light ?? 2.2) * glow * fl;
    this.light.distance = P.lightDist ?? 16;
    // trail + motes
    const fn = P.trailFn, len = P.trailLen ?? 0.6, amt = (P.trailAmt ?? 1) * glow;
    if (fn && amt > 0.001) {
      const tr = this._tr; tr.length = this.nT;
      for (let i = 0; i < this.nT; i++) (tr[i] || (tr[i] = v())).copy(fn((i / (this.nT - 1)) * len));
      this.trail.update(tr, camera, (i, k) => size * 1.25 * Math.pow(1 - k, 1.3), (i, k) => amt * 0.7 * Math.pow(1 - k, 1.6));
      this.trail.mesh.visible = true;
    } else this.trail.mesh.visible = false;
    for (let i = 0; i < this.nM; i++) {
      const h0 = hash2(i, 11), h1 = hash2(i, 23), h2 = hash2(i, 37), tw = hash2(i, fseed);
      if (fn && amt > 0.001) {
        const cyc = (t * (0.7 + h0 * 0.6) + h1) % 1, age = cyc * len * 2.4;
        _a.copy(fn(age));
        const sp2 = size * (0.5 + age * 2.6);
        _a.x += (h0 - 0.5) * sp2 * 2; _a.y += (h1 - 0.5) * sp2 * 2 - age * age * size * 2.5; _a.z += (h2 - 0.5) * sp2 * 2;
        this.motes.set(i, _a.x, _a.y, _a.z, size * (0.5 + h2 * 0.7) * (1 - cyc), 0.7, 0.95, 1.0, (1 - cyc) * (0.4 + tw) * amt, h0);
      } else {
        const ang = t * (0.8 + h0 * 1.4) * (i % 2 ? 1 : -1) + h1 * TAU, rad = size * (1.5 + h2 * 1.2), tilt = (h0 - 0.5) * 2.2;
        _a.set(Math.cos(ang) * rad, Math.sin(ang) * rad * Math.sin(tilt) + Math.sin(t * 1.7 + h1 * 9) * size * 0.4, Math.sin(ang) * rad * Math.cos(tilt)).add(pos);
        const on = i < this.nM * (P.orbit ?? 0.3) ? 1 : 0;
        this.motes.set(i, _a.x, _a.y, _a.z, size * (0.3 + h2 * 0.4), 0.7, 0.95, 1.0, on * (0.25 + tw * 0.9) * glow, h0);
      }
    }
    this.motes.commit();
  }
}
