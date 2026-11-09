// Inside the power cord: a tunnel of twisted copper. Nine ropes of stranded wire are laid helically around a
// hollow core (the Spark's flyway); dark insulation shows in the gaps between them. The cord curves gently, then
// runs straight to a white-gold opening (the power supply). Units: 1 = roughly one wire radius x 2 (a wire is a
// tree trunk to the Spark, whose body is ~0.36).
// Everything is addressed by u = arc length along the cord and a cross-section offset (right, up).
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, Ribbon, shaftMat, fxMesh } from '../gl/fx.js';
import { strike } from '../chars/spark.js';
import { rng, TAU, clamp, hash2, smooth, lerp, noise, key, FPS } from '../core.js';

export const U0 = -76, UE = 204;          // built range; UE is the mouth of the cord
export const R_IN = 4.1;                  // free radius: every rope's inner face touches this circle
const R_INS = 7.0;                        // insulation jacket
const PT = 150;                           // lay length of the ropes around the core
const DS = 0.5, CHUNK = 14, RAD = 8;
const NH = 8;                             // heat samples along the Spark's wake

// ---------------------------------------------------------------- centreline (integrated once into a table)
const STEP = 0.25, NTAB = Math.ceil((UE + 40 - U0) / STEP) + 1;
const TAB = new Float64Array(NTAB * 6);
const kappa = u => key(u, [[-80, 0.012], [-14, 0.012], [28, -0.006], [50, 0.009], [98, 0.009], [128, 0], [400, 0]]);   // yaw rate: + turns right
const pitchRate = u => 0.0042 * Math.sin(u / 21 + 0.6) * (1 - smooth(104, 134, u));
{
  const i0 = Math.round((0 - U0) / STEP);
  const put = (i, x, y, z, yaw, pit) => {
    TAB[i * 6] = x; TAB[i * 6 + 1] = y; TAB[i * 6 + 2] = z;
    TAB[i * 6 + 3] = Math.sin(yaw) * Math.cos(pit); TAB[i * 6 + 4] = Math.sin(pit); TAB[i * 6 + 5] = -Math.cos(yaw) * Math.cos(pit);
  };
  for (const dir of [1, -1]) {
    let x = 0, y = 0, z = 0, yaw = 0, pit = 0;
    put(i0, x, y, z, yaw, pit);
    for (let i = i0 + dir; i >= 0 && i < NTAB; i += dir) {
      const u = U0 + (i - dir * 0.5) * STEP;
      yaw += kappa(u) * STEP * dir; pit += pitchRate(u) * STEP * dir;
      x += Math.sin(yaw) * Math.cos(pit) * STEP * dir; y += Math.sin(pit) * STEP * dir; z -= Math.cos(yaw) * Math.cos(pit) * STEP * dir;
      put(i, x, y, z, yaw, pit);
    }
  }
}
const mkFrame = () => ({ c: new THREE.Vector3(), T: new THREE.Vector3(), R: new THREE.Vector3(), U: new THREE.Vector3() });
const YUP = new THREE.Vector3(0, 1, 0);
// frame of the cord at u: centre c, tangent T (direction of travel), right R, up U
export function frameAt(u, f) {
  const x = clamp((u - U0) / STEP, 0, NTAB - 1.001), i = Math.floor(x), k = x - i, a = i * 6, b = a + 6;
  f.c.set(lerp(TAB[a], TAB[b], k), lerp(TAB[a + 1], TAB[b + 1], k), lerp(TAB[a + 2], TAB[b + 2], k));
  f.T.set(lerp(TAB[a + 3], TAB[b + 3], k), lerp(TAB[a + 4], TAB[b + 4], k), lerp(TAB[a + 5], TAB[b + 5], k)).normalize();
  f.R.crossVectors(f.T, YUP).normalize(); f.U.crossVectors(f.R, f.T);
  return f;
}
const _f = mkFrame();
// world position of (u, right, up)
export function place(u, ox, oy, out) {
  frameAt(u, _f);
  return out.copy(_f.c).addScaledVector(_f.R, ox).addScaledVector(_f.U, oy);
}

// ---------------------------------------------------------------- the ropes
// kind 7: 1 + 6 thick wires; kind 12: a core + 12 fine wires
const ROPES = (() => {
  const r = rng(2024), rad = [1.95, 1.45, 1.8, 1.6, 2.05, 1.4, 1.85, 1.55, 1.7], kind = [7, 12, 7, 7, 12, 7, 12, 7, 7];
  const span = rad.map(a => 2 * Math.asin(a / (R_IN + a)));
  const gap = (TAU - span.reduce((s, a) => s + a, 0)) / rad.length;
  let th = 0.35;
  return rad.map((a, k) => {
    const g = gap * (0.45 + 1.1 * r());
    const o = { r: a, kind: kind[k], th: th + span[k] / 2, w: kind[k] === 7 ? a / 3 : a / 5, pw: (26 + r() * 9) * (kind[k] === 7 ? 1 : 1.25), hue: Math.floor(r() * 8), ph: r() * TAU, seed: k };
    th += span[k] + g;
    return o;
  });
})();
export const ropeAngle = (k, u) => ROPES[k].th + TAU * u / PT;
// nearest rope to polar angle phi at u
export function nearestRope(u, phi) {
  let best = 0, bd = 9;
  for (let k = 0; k < ROPES.length; k++) {
    const d = Math.abs(Math.atan2(Math.sin(phi - ropeAngle(k, u)), Math.cos(phi - ropeAngle(k, u))));
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
// a point on the inner face of rope k (lift = distance off the surface towards the core)
export function ropePoint(k, u, lift, out) {
  const a = ropeAngle(k, u), rr = R_IN - lift;
  return place(u, Math.cos(a) * rr, Math.sin(a) * rr, out);
}

const COPPER = [0xe59a52, 0xd9843f, 0xf0b060, 0xc46a30, 0xb8562a, 0xe8a25a, 0x9a4a22, 0xd27a48].map(h => new THREE.Color(h));
const _c = new THREE.Color();

function buildChunk(ua, ub) {
  const n = Math.round((ub - ua) / DS) + 1;
  const fr = []; for (let i = -1; i <= n; i++) fr.push(frameAt(ua + i * DS, mkFrame()));
  const tubes = [];
  for (const rp of ROPES) {
    const nw = rp.kind === 7 ? 6 : 12, ring = rp.r - rp.w;
    for (let j = 0; j < nw; j++) tubes.push({ rp, ring, w: rp.w, psi: rp.ph + (j / nw) * TAU, rad: RAD, seed: rp.seed * 31 + j, core: false });
    tubes.push({ rp, ring: 0, w: (rp.r - 2 * rp.w) * 1.04, psi: 0, rad: 7, seed: rp.seed * 31 + 29, core: true });
  }
  let nv = 0, ni = 0;
  for (const t of tubes) { nv += n * t.rad; ni += (n - 1) * t.rad * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), aw = new Float32Array(nv), idx = new Uint32Array(ni);
  let v = 0, q = 0;
  const P = [], e1 = new THREE.Vector3(), tg = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  for (let i = 0; i < n + 2; i++) P.push(new THREE.Vector3());
  for (const t of tubes) {
    const { rp } = t, rc = R_IN + rp.r;
    for (let i = 0; i < n + 2; i++) {
      const u = ua + (i - 1) * DS, f = fr[i], th = rp.th + TAU * u / PT, ps = t.psi - TAU * u / rp.pw;
      const cr = Math.cos(th), sr = Math.sin(th), a = rc + t.ring * Math.cos(ps), b = t.ring * Math.sin(ps);
      // radial e1 = cr R + sr U, tangential e2 = -sr R + cr U
      P[i].copy(f.c).addScaledVector(f.R, cr * a - sr * b).addScaledVector(f.U, sr * a + cr * b);
    }
    const base = v, hw = hash2(t.seed, 7), c0 = COPPER[(rp.hue + (hash2(t.seed, 3) < 0.3 ? 1 : 0)) % COPPER.length], val = 0.86 + 0.28 * hash2(t.seed, 5);
    for (let i = 0; i < n; i++) {
      const u = ua + i * DS, f = fr[i + 1], th = rp.th + TAU * u / PT;
      tg.subVectors(P[i + 2], P[i]).normalize();
      e1.copy(f.R).multiplyScalar(Math.cos(th)).addScaledVector(f.U, Math.sin(th));
      n1.copy(e1).addScaledVector(tg, -e1.dot(tg)).normalize(); n2.crossVectors(tg, n1);
      // tarnish drifting along the wire; cores stay dark
      const tar = t.core ? 0.16 : 0.74 + 0.3 * noise(u * 0.16 + t.seed * 3.7, t.seed) + 0.1 * noise(u * 0.9, t.seed + 50);
      _c.copy(c0).multiplyScalar(tar * val);
      if (!t.core && hash2(t.seed, 11) < 0.18) _c.lerp(new THREE.Color(0x4a2313), 0.55);       // a few oxidised strands
      for (let k = 0; k < t.rad; k++) {
        const an = (k / t.rad) * TAU, ca = Math.cos(an), sa = Math.sin(an);
        const nx = n1.x * ca + n2.x * sa, ny = n1.y * ca + n2.y * sa, nz = n1.z * ca + n2.z * sa, p = P[i + 1];
        pos[v * 3] = p.x + nx * t.w; pos[v * 3 + 1] = p.y + ny * t.w; pos[v * 3 + 2] = p.z + nz * t.w;
        nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
        col[v * 3] = _c.r; col[v * 3 + 1] = _c.g; col[v * 3 + 2] = _c.b; aw[v] = t.core ? 0 : hw;
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < t.rad; k++) {
      const a = base + i * t.rad + k, b = base + i * t.rad + (k + 1) % t.rad, c = a + t.rad, d = b + t.rad;
      idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aW', new THREE.BufferAttribute(aw, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  // jacket for the same span
  const SEG = 28, jp = new Float32Array(n * SEG * 3), jn = new Float32Array(n * SEG * 3), ji = new Uint32Array((n - 1) * SEG * 6);
  for (let i = 0, w = 0; i < n; i++) {
    const f = fr[i + 1];
    for (let k = 0; k < SEG; k++, w++) {
      const an = (k / SEG) * TAU, ca = Math.cos(an), sa = Math.sin(an);
      const nx = f.R.x * ca + f.U.x * sa, ny = f.R.y * ca + f.U.y * sa, nz = f.R.z * ca + f.U.z * sa;
      jp[w * 3] = f.c.x + nx * R_INS; jp[w * 3 + 1] = f.c.y + ny * R_INS; jp[w * 3 + 2] = f.c.z + nz * R_INS;
      jn[w * 3] = nx; jn[w * 3 + 1] = ny; jn[w * 3 + 2] = nz;
    }
  }
  for (let i = 0, w = 0; i < n - 1; i++) for (let k = 0; k < SEG; k++) {
    const a = i * SEG + k, b = i * SEG + (k + 1) % SEG, c = a + SEG, d = b + SEG;
    ji[w++] = a; ji[w++] = b; ji[w++] = c; ji[w++] = b; ji[w++] = d; ji[w++] = c;
  }
  const jg = new THREE.BufferGeometry();
  jg.setAttribute('position', new THREE.BufferAttribute(jp, 3)); jg.setAttribute('normal', new THREE.BufferAttribute(jn, 3));
  jg.setIndex(new THREE.BufferAttribute(ji, 1));
  return { wires: g, jacket: jg };
}

// loose strands that have sprung out of the lay and arc through the flyway (foreground depth); they keep clear of
// the Spark's line and of the loop (u 52..96)
const STRAYS = [[-24, 26, 2.2, 0.5, 1.1, 0.2], [-2, 22, 4.0, -0.6, 0.9, 0.16], [14, 28, 1.2, 0.7, 1.15, 0.22], [31, 19, 5.2, 0.4, 0.8, 0.15],
  [100, 26, 0.6, 0.6, 1.0, 0.2], [118, 30, 3.6, -0.5, 1.15, 0.22], [140, 24, 2.0, 0.5, 1.0, 0.18], [160, 28, 5.0, 0.6, 1.1, 0.2], [177, 22, 1.0, -0.4, 0.9, 0.16]];
function buildStrays() {
  const RS = 7, geos = [];
  let nv = 0, ni = 0;
  for (const st of STRAYS) { const n = Math.round(st[1] / DS) + 1; nv += n * RS; ni += (n - 1) * RS * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), aw = new Float32Array(nv), idx = new Uint32Array(ni);
  let v = 0, q = 0;
  const f = mkFrame(), tg = new THREE.Vector3(), e1 = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  const at = (st, i, out) => {
    const s = clamp(i * DS / st[1], -0.02, 1.02), u = st[0] + s * st[1], ph = st[2] + st[3] * s + TAU * u / PT;
    const r = R_IN + 0.6 - (st[4] + 0.6) * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(s))), 1.2);
    return place(u, Math.cos(ph) * r, Math.sin(ph) * r, out);
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  STRAYS.forEach((st, si) => {
    const n = Math.round(st[1] / DS) + 1, base = v, c0 = COPPER[(si * 3) % COPPER.length];
    for (let i = 0; i < n; i++) {
      at(st, i - 1, pa); at(st, i, pb); at(st, i + 1, pc);
      tg.subVectors(pc, pa).normalize(); frameAt(st[0] + i * DS, f);
      e1.copy(f.U); if (Math.abs(e1.dot(tg)) > 0.9) e1.copy(f.R);
      n1.copy(e1).addScaledVector(tg, -e1.dot(tg)).normalize(); n2.crossVectors(tg, n1);
      const tar = 0.8 + 0.25 * noise(i * 0.2, si + 70);
      for (let k = 0; k < RS; k++, v++) {
        const an = (k / RS) * TAU, ca = Math.cos(an), sa = Math.sin(an);
        const nx = n1.x * ca + n2.x * sa, ny = n1.y * ca + n2.y * sa, nz = n1.z * ca + n2.z * sa;
        pos[v * 3] = pb.x + nx * st[5] * 1.4; pos[v * 3 + 1] = pb.y + ny * st[5] * 1.4; pos[v * 3 + 2] = pb.z + nz * st[5] * 1.4;
        nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
        col[v * 3] = c0.r * tar; col[v * 3 + 1] = c0.g * tar; col[v * 3 + 2] = c0.b * tar; aw[v] = 0.5 + 0.5 * hash2(si, 3);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < RS; k++) {
      const a = base + i * RS + k, b = base + i * RS + (k + 1) % RS, c = a + RS, d = b + RS;
      idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aW', new THREE.BufferAttribute(aw, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ---------------------------------------------------------------- copper: paint + a heat wake + painted glints
// Wraps the shared painterly material (without touching it): strands glow where the Spark has just passed, and
// take a stroke-broken highlight from the key light and a cyan one from the Spark, so the copper reads as metal.
const HEAT = {
  uHP: { value: Array.from({ length: NH }, () => new THREE.Vector4()) },     // xyz, amplitude
  uHR: { value: new Float32Array(NH) },                                      // 1 / radius^2
  uHeatGain: { value: 1 },
  uKeyV: { value: new THREE.Vector3(0, 0, 1) }, uSpecCol: { value: new THREE.Color(1.0, 0.72, 0.4) },
  uSparkV: { value: new THREE.Vector3() }, uSparkSpec: { value: 1 }, uSparkLight: { value: 1 }, uSparkFall: { value: 0.1 }, uSparkReach: { value: 8 }, uSparkCol: { value: new THREE.Color(0.1, 0.72, 1.0) },
};
function copper(color, o = {}) {
  const m = paint(color, o), base = m.onBeforeCompile, k = o.heatK ?? 1, sk = o.specK ?? 1;
  m.onBeforeCompile = sh => {
    base(sh);
    Object.assign(sh.uniforms, HEAT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aW; varying float vW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvW = aW;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec4 uHP[${NH}]; uniform float uHR[${NH}]; uniform float uHeatGain, uSparkSpec, uSparkLight, uSparkFall, uSparkReach; uniform vec3 uKeyV, uSpecCol, uSparkV, uSparkCol; varying float vW;`)
      .replace('#include <opaque_fragment>', `
        {
          float heat = 0.0;
          for (int i = 0; i < ${NH}; i++) { vec3 hd = vWorldP - uHP[i].xyz; heat += uHP[i].w * exp(-dot(hd, hd) * uHR[i]); }
          float hq = heat * (0.3 + 1.5 * vW) * (1.0 + sn * 0.7 + bl * 0.6) * float(${k.toFixed(3)});
          hq = max(hq, 0.0); hq = hq / (1.0 + 0.3 * hq);
          vec3 hc = mix(vec3(0.7, 0.13, 0.02), vec3(1.0, 0.42, 0.07), smoothstep(0.1, 0.6, hq));
          hc = mix(hc, vec3(1.5, 1.05, 0.55), smoothstep(0.7, 1.5, hq));
          outgoingLight += hc * hq * uHeatGain * (0.35 + 0.65 * alb / max(max(alb.r, alb.g), max(alb.b, 0.05)));
          vec3 Vv = normalize(vViewPosition);
          float sk = pow(max(dot(normal, normalize(uKeyV + Vv)), 0.0), 22.0);
          sk = smoothstep(0.32, 0.6, sk * (1.0 + sn * 1.6));
          outgoingLight += uSpecCol * sk * uSpecCol.r * (0.15 + 0.85 * alb) * float(${sk.toFixed(3)});
          // the Spark's light, painted: a banded cyan pool that glazes the copper instead of being absorbed by it
          vec3 Ls = uSparkV + vViewPosition; float ds = length(Ls); Ls /= max(ds, 1e-3);
          float at = uSparkLight / (1.0 + ds * ds * uSparkFall) * smoothstep(uSparkReach, uSparkReach * 0.3, ds);
          float cl = max(dot(normal, Ls), 0.0) * at * (1.0 + sn * 1.3) + bl * 0.04 * at;
          float b1 = smoothstep(0.14, 0.34, cl), b2 = smoothstep(0.55, 0.9, cl), b3 = smoothstep(1.6, 3.6, cl);
          float al = dot(alb, vec3(0.3, 0.5, 0.2));
          vec3 cc = mix(vec3(0.01, 0.12, 0.14), vec3(0.06, 0.52, 0.66), b2); cc = mix(cc, vec3(0.3, 0.86, 1.0), b3);
          outgoingLight = mix(outgoingLight, cc * (0.45 + 1.1 * al) + outgoingLight * 0.22, b1 * 0.92);
          float ss = pow(max(dot(normal, normalize(Ls + Vv)), 0.0), 20.0) * uSparkSpec * at;
          ss = smoothstep(0.75, 1.3, ss * (1.0 + sn * 1.4));
          outgoingLight += vec3(0.25, 0.7, 0.85) * ss * float(${sk.toFixed(3)});
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'tunnel-copper|' + k + '|' + sk;
  return m;
}

export function buildTunnel() {
  const scene = new THREE.Scene();
  scene.userData.clear = 0x120604;
  scene.fog = new THREE.FogExp2(0xc8601a, 0.016);
  const cam = new THREE.PerspectiveCamera(40, 1920 / 804, 0.12, 300);

  // ---- light: gold from the mouth of the cord (always from down the tunnel), a low ember fill, heat behind the Spark
  const sun = new THREE.DirectionalLight(0xffb060, 1.5); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x8a3a14, 0x2a0a08, 0.2); scene.add(hemi);
  const ember = [new THREE.PointLight(0xff7020, 0, 24, 1.5)];
  scene.add(...ember);

  // ---- geometry in chunks along the cord
  const wireMat = copper(0xffffff, { vertexColors: true, scale: 0.11, stroke: 0.3, rim: 1.25, shade: 1, broken: 0.45 });
  const jackMat = copper(0x7a2c1c, { scale: 0.07, stroke: 0.45, rim: 0.3, shade: 3.2, broken: 0.5, side: THREE.BackSide, heatK: 0.8, specK: 0 });
  const chunks = [];
  for (let ua = U0; ua < UE; ua += CHUNK) {
    const ub = Math.min(UE, ua + CHUNK), g = buildChunk(ua, ub);
    const w = new THREE.Mesh(g.wires, wireMat), j = new THREE.Mesh(g.jacket, jackMat);
    w.frustumCulled = j.frustumCulled = false;
    scene.add(w, j); chunks.push({ ua, ub, w, j });
  }

  const strays = new THREE.Mesh(buildStrays(), wireMat); strays.frustumCulled = false; strays.renderOrder = -1; scene.add(strays);

  // ---- the mouth: white-gold light (painted layer, HDR) with a soft crown of glow on top
  const fe = frameAt(UE + 3, mkFrame());
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(R_IN * 1.06, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.6, 2.2), fog: false, side: THREE.DoubleSide }));
  mouth.position.copy(fe.c); mouth.lookAt(fe.c.clone().sub(fe.T)); scene.add(mouth);
  const mouthGlow = new Sprites(4, { shape: 'dot', core: 0, soft: 6 }); scene.add(mouthGlow.mesh);
  const shaft = fxMesh(new THREE.CylinderGeometry(R_IN * 0.2, R_IN * 0.92, 90, 28, 1, true), shaftMat(0xffb060, { gain: 0.1, mode: 0, streak: 5, pow: 1.6, soft: 3, fadeTop: 0.3, fadeBot: 0.3 }));
  { const m = frameAt(UE - 45, mkFrame()); shaft.position.copy(m.c); shaft.quaternion.setFromUnitVectors(YUP, m.T.clone().negate()); }
  scene.add(shaft);

  // ---- air: copper dust and glints hanging in the flyway
  const R = rng(91), ND = 620, dust = new Sprites(ND, { shape: 'dot', core: 0.5, soft: 0.8, drift: [0.22, 0.9, 0.7] });
  const p = new THREE.Vector3();
  for (let i = 0; i < ND; i++) {
    const u = U0 + R() * (UE - U0), rr = 3.7 * Math.sqrt(R()), a = R() * TAU, big = R() < 0.12;
    place(u, Math.cos(a) * rr, Math.sin(a) * rr, p);
    dust.set(i, p.x, p.y, p.z, big ? 0.22 + R() * 0.2 : 0.06 + R() * 0.1, 1.0, 0.62 + R() * 0.2, 0.28, big ? 0.22 : 0.35 + R() * 0.5, R());
  }
  dust.commit(); scene.add(dust.mesh);

  // ---- electricity: arcs between the Spark and the strands, sparkles fizzing on the wake
  const NA = 7, arcs = Array.from({ length: NA }, () => new Ribbon(9, { color: 0x8fe9ff, gain: 2.2, core: 1.5, soft: 0.5 }));
  arcs.forEach(a => scene.add(a.mesh));
  const NS = 46, fizz = new Sprites(NS, { shape: 'star', core: 1.0, soft: 0.6 }); scene.add(fizz.mesh);
  const arcPts = arcs.map(() => []);
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), tmp = new THREE.Vector3(), cf = mkFrame();

  return {
    scene, cam, sun, hemi, ember, chunks, dust, fizz, arcs, mouth, shaft, HEAT, wireMat, jackMat,
    // S: { u, pos, off:[ox,oy], trail(age)->Vector3, heat, arc (0..1 how much the strands spark), camU, back (camera looks back up the cord) }
    update(t, camera, S) {
      const fs = Math.floor(t * FPS / 2 + 1e-6);
      camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      // only the stretch the camera can see
      const lo = S.back ? S.camU - (S.far ?? 90) : S.camU - 8, hi = S.back ? S.camU + 8 : S.camU + (S.far ?? 90);
      for (const c of chunks) {
        c.w.visible = c.j.visible = c.ub > lo && c.ua < hi;
        c.w.renderOrder = Math.round(Math.abs((c.ua + c.ub) / 2 - S.camU)); c.j.renderOrder = 1000 + c.w.renderOrder;   // near to far: early-z
      }
      // key light comes from down the cord, a little from above
      frameAt(S.camU + (S.back ? -8 : 24), cf);
      const kd = S.keyDir ?? [0.25, 0.42, 1];                                  // [right, up, along the cord]
      tmp.set(0, 0, 0).addScaledVector(cf.R, kd[0]).addScaledVector(cf.U, kd[1]).addScaledVector(cf.T, kd[2]).normalize();
      sun.target.position.copy(cf.c); sun.position.copy(cf.c).addScaledVector(tmp, 60);
      sun.intensity = S.key ?? 1.5;
      HEAT.uKeyV.value.copy(tmp).transformDirection(camera.matrixWorldInverse);
      HEAT.uSparkV.value.copy(S.pos).applyMatrix4(camera.matrixWorldInverse);
      HEAT.uSparkSpec.value = S.glint ?? 1; HEAT.uSparkLight.value = S.light ?? 2.6; HEAT.uSparkFall.value = S.fall ?? 0.12; HEAT.uSparkReach.value = S.reach ?? 5.8;
      // heat wake: samples of where the Spark has been
      const heat = S.heat ?? 1, wk = S.wakeK ?? 1;
      for (let i = 0; i < NH; i++) {
        // ages compress when the Spark is fast (wakeK < 1), so the samples stay close enough to read as one glow
        const a0 = 0.2 + Math.pow(i / (NH - 1), 1.25) * 1.7, env = smooth(0.16, 0.4, a0) * Math.exp(-Math.max(0, a0 - 0.4) / (S.cool ?? 0.5));
        const q = S.trail(a0 * wk), rad = 4.2 + a0 * 1.6;
        HEAT.uHP.value[i].set(q.x, q.y, q.z, heat * env); HEAT.uHR.value[i] = 1 / (rad * rad);
      }
      HEAT.uHeatGain.value = S.heatGain ?? 1;
      ember.forEach((l, i) => { l.position.copy(S.trail(0.55 * wk)); l.intensity = (S.ember ?? 1) * heat * 13; });
      // arcs (re-struck on twos): Spark -> nearest strands, and strand -> strand just behind it
      const phi = Math.atan2(S.off[1], S.off[0]), rho = Math.hypot(S.off[0], S.off[1]), amt = S.arc ?? 0.5;
      for (let i = 0; i < NA; i++) {
        const sd = fs * 17 + i * 53, toSpark = i < 3;
        const near = clamp((rho - 1.2) / 2.2);
        const live = hash2(sd, 1) < (toSpark ? amt * Math.max(near, i === 0 ? (S.zap ?? 0) : 0) : amt * 0.8);
        if (!live) { arcs[i].mesh.visible = false; continue; }
        arcs[i].mesh.visible = true;
        if (toSpark) {
          const ua = S.u + (hash2(sd, 2) - 0.7) * 3.2, k = nearestRope(ua, phi + (hash2(sd, 3) - 0.5) * (1.6 - near));
          ropePoint(k, ua, 0.05, a1); a0.copy(S.pos).lerp(a1, 0.18);
          strike(a0, a1, 8, 0.28, sd, arcPts[i]);
          arcs[i].update(arcPts[i], camera, 0.15, (j, kk) => 0.7 + 0.3 * kk);
        } else {
          const ub = S.u - 1.5 - hash2(sd, 4) * 13 * (0.4 + amt), k = Math.floor(hash2(sd, 5) * ROPES.length), k2 = (k + 1) % ROPES.length;
          ropePoint(k, ub, 0.1, a0); ropePoint(k2, ub + (hash2(sd, 6) - 0.5) * 2.4, 0.1, a1);
          strike(a0, a1, 7, 0.22, sd, arcPts[i], -0.25);
          arcs[i].update(arcPts[i], camera, 0.1, 0.6);
        }
      }
      // fizz: short-lived stars on the strands of the wake, cyan near the Spark cooling to gold behind
      for (let i = 0; i < NS; i++) {
        const sd = (fs + i * 3) * 29 + i * 7, age = hash2(sd, 1), back = Math.pow(age, 1.7) * 22;
        const k = Math.floor(hash2(sd, 2) * ROPES.length), on = hash2(sd, 3) < 0.35 + amt * 0.5 ? 1 : 0;
        ropePoint(k, S.u - 0.5 - back, -0.1 + hash2(sd, 4) * 0.4, tmp);
        tmp.x += (hash2(sd, 5) - 0.5) * 0.8; tmp.y += (hash2(sd, 6) - 0.5) * 0.8;
        const warm = smooth(0.1, 0.6, age);
        fizz.set(i, tmp.x, tmp.y, tmp.z, (0.55 - 0.3 * age) * (0.6 + hash2(sd, 7)), lerp(0.6, 1.0, warm), lerp(0.95, 0.72, warm), lerp(1.0, 0.3, warm), on * heat * (1 - 0.6 * age) * smooth(2, 4.5, tmp.distanceTo(camera.position)), hash2(i, 9));
      }
      fizz.commit();
      // the mouth glow
      const mg = S.mouth ?? 1;
      mouthGlow.set(0, fe.c.x, fe.c.y, fe.c.z, 60, 1.0, 0.62, 0.25, 0.5 * mg, 0);
      mouthGlow.set(1, fe.c.x, fe.c.y, fe.c.z, 26, 1.0, 0.8, 0.5, 0.8 * mg, 0);
      mouthGlow.set(2, fe.c.x, fe.c.y, fe.c.z, 150, 1.0, 0.5, 0.15, 0.22 * mg, 0);
      mouthGlow.set(3, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      mouthGlow.commit();
      shaft.material.uniforms.uGain.value = 0.1 * mg;
    },
  };
}
