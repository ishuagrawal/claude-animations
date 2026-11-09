// Light/FX layer (layer 1): unlit, mostly additive things drawn crisp on top of the painted image.
// They are occluded by the painted scene with a manual soft depth test against its depth texture.
import * as THREE from 'three';
import { LOOK } from './paint.js';

export const FX_LAYER = 1;
export const FXU = {
  uDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
  uNear: { value: 0.1 }, uFar: { value: 100 }, uTime: { value: 0 },
};
export const DEPTH_GLSL = `
uniform sampler2D uDepth; uniform vec2 uRes; uniform float uNear, uFar;
float sceneZ() { float d = texture2D(uDepth, gl_FragCoord.xy / uRes).x; float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float softDepth(float viewZ, float soft) { return clamp((sceneZ() - viewZ) / soft + 0.5, 0.0, 1.0); }
`;
const onFx = o => { o.layers.set(FX_LAYER); o.frustumCulled = false; return o; };

// ---------------------------------------------------------------- billboard sprites
const SHAPES = {
  dot: `float r = length(vUv); a = exp(-r * r * 5.0) * smoothstep(1.0, 0.6, r) + smoothstep(0.22, 0.0, r) * uCore;`,
  star: `float r = length(vUv); vec2 q = abs(vUv);
         a = exp(-r * r * 9.0) + uCore * (pow(max(0.0, 1.0 - q.x), 5.0) * pow(max(0.0, 1.0 - q.y * 10.0), 2.0) + pow(max(0.0, 1.0 - q.y), 5.0) * pow(max(0.0, 1.0 - q.x * 10.0), 2.0));`,
  bokeh: `float r = length(vUv); a = smoothstep(1.0, 0.86, r) * (0.55 + 0.45 * smoothstep(0.4, 0.95, r));`,
  ring: `float r = length(vUv); a = smoothstep(0.12, 0.0, abs(r - 0.8)) + exp(-r * r * 3.0) * uCore;`,
};
export class Sprites {
  // drift: [amplitude (world units), frequency, twinkle 0..1]
  constructor(n, { shape = 'dot', soft = 0.25, core = 0.6, drift = [0, 0, 0], blending = THREE.AdditiveBlending, sizeAtten = true } = {}) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.n = n;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.col = new Float32Array(n * 4); this.seed = new Float32Array(n);
    g.setAttribute('iPos', this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3));
    g.setAttribute('iSize', this.aSize = new THREE.InstancedBufferAttribute(this.size, 1));
    g.setAttribute('iCol', this.aCol = new THREE.InstancedBufferAttribute(this.col, 4));
    g.setAttribute('iSeed', this.aSeed = new THREE.InstancedBufferAttribute(this.seed, 1));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({
      uniforms: { ...FXU, uSoft: { value: soft }, uCore: { value: core }, uDrift: { value: new THREE.Vector3(...drift) }, uGain: { value: 1 } },
      vertexShader: `
        attribute vec3 iPos; attribute float iSize; attribute vec4 iCol; attribute float iSeed;
        uniform float uTime; uniform vec3 uDrift; varying vec2 vUv; varying vec4 vCol; varying float vZ;
        void main() {
          vec3 p = iPos; float ph = iSeed * 6.2831;
          p += uDrift.x * vec3(sin(uTime * uDrift.y * (0.7 + iSeed) + ph), sin(uTime * uDrift.y * (0.5 + fract(iSeed * 7.0)) + ph * 1.7), cos(uTime * uDrift.y * (0.6 + fract(iSeed * 3.0)) + ph * 2.3));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 1.0 - uDrift.z * (0.5 + 0.5 * sin(uTime * (1.5 + iSeed * 4.0) + ph * 3.0));
          mv.xy += position.xy * iSize; vZ = -mv.z;
          gl_Position = projectionMatrix * mv; vUv = position.xy * 2.0; vCol = vec4(iCol.rgb, iCol.a * tw);
        }`,
      fragmentShader: `precision highp float;
        ${DEPTH_GLSL} uniform float uSoft, uCore, uGain; varying vec2 vUv; varying vec4 vCol; varying float vZ;
        void main() { float a; ${SHAPES[shape]}
          a *= softDepth(vZ, uSoft) * vCol.a * uGain; if (a < 0.0005) discard;
          gl_FragColor = vec4(vCol.rgb * a, a); }`,
      transparent: true, depthTest: false, depthWrite: false,
      blending: blending === THREE.AdditiveBlending ? THREE.CustomBlending : blending,
      blendSrc: THREE.OneFactor, blendDst: blending === THREE.AdditiveBlending ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
    });
    this.mesh = onFx(new THREE.Mesh(g, m));
    this.u = m.uniforms;
  }
  set(i, x, y, z, size, r, g, b, a = 1, seed = 0) {
    const p = this.pos, c = this.col;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; this.size[i] = size;
    c[i * 4] = r; c[i * 4 + 1] = g; c[i * 4 + 2] = b; c[i * 4 + 3] = a; this.seed[i] = seed;
  }
  commit(count = this.n) {
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aCol.needsUpdate = this.aSeed.needsUpdate = true;
    this.mesh.geometry.instanceCount = count;
  }
}

// ---------------------------------------------------------------- camera-facing ribbons (arcs, trails)
const _t = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export class Ribbon {
  constructor(maxPts, { color = 0x9fe8ff, gain = 2, core = 1.5, soft = 0.2 } = {}) {
    this.max = maxPts;
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(maxPts * 6); this.uv = new Float32Array(maxPts * 4); this.al = new Float32Array(maxPts * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.al, 1));
    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { ...FXU, uColor: { value: new THREE.Color(color) }, uGain: { value: gain }, uCore: { value: core }, uSoft: { value: soft } },
      vertexShader: `attribute float aAlpha; varying vec2 vUv; varying float vA; varying float vZ;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; vUv = uv; vA = aAlpha; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; ${DEPTH_GLSL}
        uniform vec3 uColor; uniform float uGain, uCore, uSoft; varying vec2 vUv; varying float vA; varying float vZ;
        void main() { float x = abs(vUv.x * 2.0 - 1.0); float glow = pow(1.0 - x, 2.2), core = smoothstep(0.38, 0.0, x);
          vec3 c = (uColor * glow * uGain + vec3(1.0) * core * uCore) * vA * softDepth(vZ, uSoft);
          gl_FragColor = vec4(c, 1.0); }`,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = onFx(new THREE.Mesh(g, m));
    this.u = m.uniforms;
  }
  // pts: array of Vector3 (world space; keep the mesh at identity); width(i, k) and alpha(i, k) take k = i/(n-1)
  update(pts, camera, width = 0.1, alpha = 1) {
    const n = Math.min(pts.length, this.max), p = this.p, uv = this.uv, al = this.al;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], c = pts[i], k = n > 1 ? i / (n - 1) : 0;
      _t.subVectors(b, a); _v.subVectors(camera.position, c); _s.crossVectors(_t, _v);
      const l = _s.length(); if (l > 1e-8) _s.multiplyScalar(1 / l); else _s.set(0, 1, 0);
      const w = (typeof width === 'function' ? width(i, k) : width) * 0.5;
      p[i * 6] = c.x + _s.x * w; p[i * 6 + 1] = c.y + _s.y * w; p[i * 6 + 2] = c.z + _s.z * w;
      p[i * 6 + 3] = c.x - _s.x * w; p[i * 6 + 4] = c.y - _s.y * w; p[i * 6 + 5] = c.z - _s.z * w;
      uv[i * 4] = 0; uv[i * 4 + 1] = k; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = k;
      al[i * 2] = al[i * 2 + 1] = typeof alpha === 'function' ? alpha(i, k) : alpha;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = g.attributes.uv.needsUpdate = g.attributes.aAlpha.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }
}

// ---------------------------------------------------------------- volumetric light shafts / glow volumes
// mode 0: closed volumes (cones, spheres): fades at grazing angles. mode 1: flat cards: fades across u.
export function shaftMat(color, { gain = 1, mode = 0, streak = 6, pow = 2, soft = 1.5, fadeTop = 0.05, fadeBot = 0.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...FXU, uStroke: LOOK.uStroke, uColor: { value: new THREE.Color(color) }, uGain: { value: gain }, uMode: { value: mode },
      uStreak: { value: streak }, uPow: { value: pow }, uSoft: { value: soft }, uFade: { value: new THREE.Vector2(fadeTop, fadeBot) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vZ;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; vV = -mv.xyz; vN = normalMatrix * normal; vUv = uv; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; ${DEPTH_GLSL}
      uniform sampler2D uStroke; uniform vec3 uColor; uniform float uGain, uMode, uStreak, uPow, uSoft, uTime; uniform vec2 uFade;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vZ;
      void main() {
        float e = uMode < 0.5 ? pow(abs(dot(normalize(vN), normalize(vV))), uPow) : pow(sin(clamp(vUv.x, 0.0, 1.0) * 3.14159), uPow);
        float l = smoothstep(0.0, uFade.x, vUv.y) * smoothstep(1.0, 1.0 - uFade.y, vUv.y);
        float s = texture2D(uStroke, vec2(vUv.x * uStreak, vUv.y * 0.07 + uTime * 0.004)).g;
        float a = e * l * (0.45 + 1.1 * s) * softDepth(vZ, uSoft) * uGain;
        gl_FragColor = vec4(uColor * a, 1.0); }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
}
export const fxMesh = (geo, mat) => onFx(new THREE.Mesh(geo, mat));

// Unlit solid for the FX layer (keeps crisp edges): flat colour with a fresnel term. Depth-tests within the layer.
export function solidMat(color, { rim = 0x000000, rimPow = 2, gain = 1, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...FXU, uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uRimPow: { value: rimPow }, uGain: { value: gain }, uOpacity: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vZ;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; ${DEPTH_GLSL}
      uniform vec3 uColor, uRim; uniform float uRimPow, uGain, uOpacity; varying vec3 vN; varying vec3 vV; varying float vZ;
      void main() { if (sceneZ() < vZ - 0.02) discard;
        float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uRimPow);
        gl_FragColor = vec4((uColor + uRim * f) * uGain, uOpacity); }`,
    transparent: opacity < 1,
  });
}
