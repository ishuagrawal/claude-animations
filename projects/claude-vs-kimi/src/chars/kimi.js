// Kimi, from the user's mascot image (116×93): a glossy blue sphere, Ø 66 px; core #2b76f3–#317df6, edges brighter
// (#5299f8 → #6eabf9 fresnel glow), two white vertical pill eyes 8×13 px (0.12 × 0.20 Ø), 17 px apart (0.26 Ø),
// set up-right of centre (looking up-right). Ø 0.9 units here (Claude's body is 1.0 wide).
// The eyes are painted in the shader so they can morph: pill (Kimi) ↔ black square (Claude's, when it copies).
import * as THREE from 'three';
import { RIG, common, vert } from '../gl/toon.js';

export const KIMI = { base: '#3a86f7', shade: '#2361d8', deep: '#16307e', rim: '#79b6ff' };
export const R = 0.45;

function kimiMat() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...RIG,
      uBase: { value: new THREE.Color(KIMI.base) }, uShade: { value: new THREE.Color(KIMI.shade) },
      uDeep: { value: new THREE.Color(KIMI.deep) }, uGlowC: { value: new THREE.Color(KIMI.rim) },
      uLook: { value: new THREE.Vector2(0.12, 0.1) },  // eye centre offset (radians, x right / y up)
      uSquare: { value: 0 },                           // 0 pill (white) → 1 Claude square (black)
      uOpen: { value: 1 }, uSlant: { value: 0 }, uEyeScale: { value: 1 },
      uEyeGlow: { value: 0 }, uEyeGlowCol: { value: new THREE.Color('#bfe3ff') },
      uHappy: { value: 0 },                            // ^ ^ arcs
      uX: { value: 0 },                                // KO
    },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform vec3 uBase, uShade, uDeep, uGlowC, uEyeGlowCol;
      uniform vec2 uLook; uniform float uSquare, uOpen, uSlant, uEyeScale, uEyeGlow, uHappy, uX;
      varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying float vDepth;
      float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
      // eye coverage at object direction d for an eye centred at (ax, ay) radians on the front (+z)
      float eye(vec3 d, float ax, float ay, float side){
        vec3 c = normalize(vec3(sin(ax) * cos(ay), sin(ay), cos(ax) * cos(ay)));
        if (dot(d, c) < 0.7) return 0.0;
        vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), c)); rt = -rt;
        vec3 up = cross(c, rt);
        vec2 p = vec2(dot(d - c, rt), dot(d - c, up)) / uEyeScale;
        // pill: 0.12 x 0.20 of the diameter; square: Claude's (a touch bigger so it reads)
        vec2 hb = mix(vec2(0.12, 0.20), vec2(0.165, 0.165), uSquare) * vec2(1.0, max(uOpen, 0.08));
        float r = mix(hb.x, 0.02, uSquare);
        float dd = sdBox(p, hb, min(r, hb.y));
        float cut = p.y - (hb.y - uSlant * (0.55 - p.x / hb.x * 0.5 * side * 1.1) * hb.y * 1.4);
        dd = max(dd, cut);
        // happy arcs ^ ^
        float arc = abs(length(p - vec2(0.0, -0.10)) - 0.15) - 0.035;
        arc = max(arc, -(p.y + 0.03));
        dd = mix(dd, arc, step(0.5, uHappy));
        float xb = min(abs(p.x - p.y), abs(p.x + p.y)) * 0.7071 - 0.03;
        xb = max(xb, max(abs(p.x), abs(p.y)) - 0.11);
        dd = mix(dd, xb, step(0.5, uX));
        float aa = fwidth(dd) * 1.3;
        return 1.0 - smoothstep(-aa, aa, dd);
      }
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(vV);
        if (uSil > 0.5) { gl_FragColor = vec4(uSilCol, 1.0); return; }
        float ndl = dot(N, uKeyDir) * 0.5 + 0.5;
        float aa = fwidth(ndl) * 1.2 + 0.002;
        float b2 = smoothstep(0.58 - aa, 0.58 + aa, ndl), b1 = smoothstep(0.34 - aa, 0.34 + aa, ndl);
        vec3 c = mix(uDeep, mix(uShade, uBase, b2), b1);
        float c2 = clamp((0.76 - ndl) / 0.18, 0.0, 1.0) * b2;
        float c1 = clamp((0.50 - ndl) / 0.16, 0.0, 1.0) * b1 * (1.0 - b2);
        c = mix(c, uShade, halftone(c2 * 0.5, uDot, 0.785));
        c = mix(c, uDeep, halftone(c1 * 0.7, uDot, 1.185));
        c *= uKeyCol;
        // the mascot's own glow: brighter toward the silhouette (fresnel band)
        float fr = 1.0 - max(dot(N, V), 0.0);
        c = mix(c, uGlowC, smoothstep(0.62, 0.78, fr) * 0.55);
        // glossy hard highlight + small secondary
        vec3 H = normalize(uKeyDir + V);
        float sp = pow(max(dot(N, H), 0.0), 220.0);
        c = mix(c, vec3(1.0), smoothstep(0.5, 0.56, sp) * 0.9);
        c += uGlowC * pow(max(dot(N, H), 0.0), 8.0) * 0.18;
        // colored rim lines from the side lights
        float ra = fr * max(dot(N, uRimADir), 0.0), rb = fr * max(dot(N, uRimBDir), 0.0);
        float rw = fwidth(fr) * 1.5 + 0.01, th = 0.42 / max(uRimW, 0.2);
        c = mix(c, uRimACol, smoothstep(th - rw, th + rw, ra));
        c = mix(c, uRimBCol, smoothstep(th - rw, th + rw, rb));
        // eyes (object space so they ride the squash and spin)
        vec3 d = normalize(vObj);
        float sep = mix(0.27, 0.32, uSquare);
        float e = max(eye(d, uLook.x - sep, uLook.y, -1.0), eye(d, uLook.x + sep, uLook.y + 0.02 * (1.0 - uSquare), 1.0));
        vec3 eyeCol = mix(vec3(0.97, 0.99, 1.0), vec3(0.04, 0.035, 0.07), uSquare);
        eyeCol = mix(eyeCol, uEyeGlowCol, uEyeGlow);
        c = mix(c, eyeCol, e);
        float f = smoothstep(uFogNear, uFogFar, vDepth);
        c = mix(c, uFogCol, f);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export function makeKimi(glow) {
  const mat = kimiMat();
  const root = new THREE.Group();
  const ball = new THREE.Group();     // squash/stretch frame
  root.add(ball);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat);
  ball.add(mesh);
  // the mascot's soft outer glow (as in the user's image)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#2f7cf6', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  halo.scale.set(R * 4.2, R * 4.2, 1); halo.renderOrder = -1;
  root.add(halo);
  const k = { root, ball, mesh, mat, halo };
  pose(k, {});
  return k;
}

// p: x, y (bottom of ball above ground), z, ry, roll, sq (along `axis`: <1 squash), axis (unit vec, default up),
//    look [x,y], square (0..1), open, slant, happy, eyeGlow, scale
export function pose(k, p) {
  const s = p.scale ?? 1;
  const sq = p.sq ?? 1;
  k.root.position.set(p.x ?? 0, (p.y ?? 0) + R * s * sq, p.z ?? 0);
  k.root.rotation.set(0, p.ry ?? 0, 0);
  k.root.scale.setScalar(s);
  // squash along an axis: align the axis with y, scale, rotate back
  const ax = p.axis ? new THREE.Vector3(...p.axis).normalize() : new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
  k.ball.quaternion.copy(q);
  k.ball.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  k.mesh.quaternion.copy(q.clone().invert());
  k.mesh.rotateZ(p.roll ?? 0);
  k.mesh.rotateX(p.spin ?? 0);
  const u = k.mat.uniforms;
  const lk = p.look || [0.12, 0.1];
  u.uLook.value.set(lk[0], lk[1]);
  u.uSquare.value = p.square ?? 0;
  u.uOpen.value = p.open ?? 1;
  u.uSlant.value = p.slant ?? 0;
  u.uHappy.value = p.happy ?? 0;
  u.uX.value = p.x_eyes ? 1 : 0;
  u.uEyeGlow.value = p.eyeGlow ?? 0;
  if (p.eyeGlowCol) u.uEyeGlowCol.value.set(p.eyeGlowCol);
}
