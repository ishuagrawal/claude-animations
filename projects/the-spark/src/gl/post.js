// Image finish: painted scene (MSAA, HDR) -> depth-driven Kuwahara (brush consolidation: fine at the focus,
// broad far from it) -> crisp FX layer on top -> bloom -> grade, soft shoulder, vignette, canvas tooth, grain.
import * as THREE from 'three';
import { LOOK } from './paint.js';
import { FXU, FX_LAYER } from './fx.js';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const LINZ = 'float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }';

const KUWAHARA = `precision highp float;
uniform sampler2D tC, tZ, uStroke; uniform vec2 px; uniform float uNear, uFar, uFocus, uRange, uFlat, uRNear, uRFar, uMean, uAspect, uHaze, uWobble; uniform vec3 uHazeCol;
varying vec2 vUv; ${LINZ}
void main() {
  float z = linZ(texture2D(tZ, vUv).x);
  float coc = smoothstep(0.0, 1.0, (abs(z - uFocus) - uFlat) / uRange);
  float R = mix(uRNear, uRFar, coc);
  vec3 bn = texture2D(uStroke, vUv * vec2(uAspect, 1.0) * 1.7).rgb;
  float ang = bn.g * 12.0;
  // brushed edges: nudge the lookup with the stroke field so silhouettes are not ruler-straight
  vec2 uvw = vUv + (texture2D(uStroke, vUv * vec2(uAspect, 1.0) * 3.1 + 0.31).rg - 0.5) * px * uWobble * (0.6 + coc);
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);
  vec3 best = vec3(0.0), all = vec3(0.0); float bv = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sg = vec2(q == 0 || q == 3 ? -1.0 : 1.0, q < 2 ? -1.0 : 1.0);
    vec3 m = vec3(0.0), s = vec3(0.0);
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
      vec2 o = rot * (vec2(float(i), float(j)) / 3.0 * R * sg) * px;
      vec3 c = min(texture2D(tC, uvw + o).rgb, vec3(4.0));
      m += c; s += c * c;
    }
    m /= 16.0; s = abs(s / 16.0 - m * m);
    float v = s.r + s.g + s.b;
    all += m;
    if (v < bv) { bv = v; best = m; }
  }
  vec3 col = mix(best, all * 0.25, coc * uMean);
  // aerial haze painted in with distance
  col = mix(col, uHazeCol, uHaze * smoothstep(uFocus, uFar * 0.6, z) * step(z, uFar * 0.98));
  gl_FragColor = vec4(col, 1.0);
}`;

const BRIGHT = `precision highp float; uniform sampler2D tC; uniform vec2 px; uniform float uThr; varying vec2 vUv;
void main() { vec3 c = vec3(0.0);
  c += texture2D(tC, vUv + px * vec2(-0.5, -0.5)).rgb; c += texture2D(tC, vUv + px * vec2(0.5, -0.5)).rgb;
  c += texture2D(tC, vUv + px * vec2(-0.5, 0.5)).rgb; c += texture2D(tC, vUv + px * vec2(0.5, 0.5)).rgb; c *= 0.25;
  float l = max(c.r, max(c.g, c.b)); float k = max(l - uThr, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * k, vec3(6.0)), 1.0); }`;
const BLUR = `precision highp float; uniform sampler2D tC; uniform vec2 dir; varying vec2 vUv;
void main() { vec3 c = texture2D(tC, vUv).rgb * 0.227027;
  c += (texture2D(tC, vUv + dir * 1.3846).rgb + texture2D(tC, vUv - dir * 1.3846).rgb) * 0.316216;
  c += (texture2D(tC, vUv + dir * 3.2308).rgb + texture2D(tC, vUv - dir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0); }`;
const COPY = 'precision highp float; uniform sampler2D tC; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tC, vUv).rgb, 1.0); }';

const FINAL = `precision highp float;
uniform sampler2D tC, tB0, tB1, tB2, tB3, uStroke; uniform vec2 uRes;
uniform float uBloom, uExposure, uContrast, uSat, uVig, uGrain, uSeed, uFade, uFlash, uCanvas, uAspect, uGlowWarm;
uniform vec3 uLift, uGain, uFadeCol;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
vec3 shoulder(vec3 x) { vec3 a = vec3(0.72); return mix(x, a + (1.0 - a) * (1.0 - exp(-(x - a) / (1.0 - a))), step(a, x)); }
void main() {
  vec3 c = texture2D(tC, vUv).rgb;
  vec3 b = texture2D(tB0, vUv).rgb * 0.34 + texture2D(tB1, vUv).rgb * 0.3 + texture2D(tB2, vUv).rgb * 0.22 + texture2D(tB3, vUv).rgb * 0.2;
  c += b * uBloom;
  c *= uExposure;
  // glows burn toward white-gold instead of clipping to a flat primary
  float over = max(max(c.r, max(c.g, c.b)) - 1.0, 0.0);
  c += over * 0.45 * mix(vec3(1.0), vec3(1.0, 0.9, 0.72), uGlowWarm);
  // lift (tinted toe) / gain
  c = c * uGain + uLift * (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - clamp(c, 0.0, 1.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.18) * uContrast + 0.18;
  c = shoulder(max(c, 0.0));
  vec2 q = vUv - 0.5; q.x *= uAspect * 0.62;
  c *= 1.0 - uVig * smoothstep(0.18, 0.95, dot(q, q) * 2.2);
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  // canvas tooth + brush variation, then grain
  vec3 st = texture2D(uStroke, vUv * vec2(uAspect, 1.0) * 2.2).rgb;
  c *= 1.0 + ((st.b - 0.5) * 0.5 + (st.r - 0.5) * 0.5) * uCanvas;
  c += (h(floor(gl_FragCoord.xy)) - 0.5) * uGrain;
  c = mix(c, uFadeCol, uFade);
  c = mix(c, vec3(1.0), uFlash);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const POST_DEFAULT = {
  focus: 10, range: 14, flat: 2, rNear: 2.2, rFar: 7.5, mean: 0.45, wobble: 5, haze: 0, hazeCol: [0.8, 0.6, 0.45],
  bloom: 0.9, thr: 0.95, exposure: 1, contrast: 1.06, sat: 1.08, vig: 0.42, grain: 0.028, canvas: 0.1, glowWarm: 0.6,
  lift: [0.012, 0.03, 0.04], gain: [1.0, 1.0, 1.0], fade: 0, fadeCol: [0, 0, 0], flash: 0, seed: 0,
};

export class Pipeline {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H; this.scale = 0;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.mK = mat(KUWAHARA, { tC: { value: null }, tZ: { value: null }, uStroke: LOOK.uStroke, px: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 100 },
      uFocus: { value: 10 }, uRange: { value: 10 }, uFlat: { value: 1 }, uRNear: { value: 2 }, uRFar: { value: 7 }, uMean: { value: 0.4 }, uAspect: { value: W / H }, uHaze: { value: 0 }, uWobble: { value: 3 }, uHazeCol: { value: new THREE.Color() } });
    this.mBright = mat(BRIGHT, { tC: { value: null }, px: { value: new THREE.Vector2() }, uThr: { value: 1 } });
    this.mBlur = mat(BLUR, { tC: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCopy = mat(COPY, { tC: { value: null } });
    this.mFinal = mat(FINAL, { tC: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, uStroke: LOOK.uStroke, uRes: { value: new THREE.Vector2() },
      uBloom: { value: 1 }, uExposure: { value: 1 }, uContrast: { value: 1 }, uSat: { value: 1 }, uVig: { value: 0.4 }, uGrain: { value: 0.03 }, uSeed: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 },
      uCanvas: { value: 0.1 }, uAspect: { value: W / H }, uGlowWarm: { value: 0.6 }, uLift: { value: new THREE.Color() }, uGain: { value: new THREE.Color() }, uFadeCol: { value: new THREE.Color() } });
    this.setScale(1);
  }
  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    const w = this.w = Math.round(this.W * s), h = this.h = Math.round(this.H * s);
    this.r.setSize(w, h, false);
    for (const k of ['A', 'K', 'b0', 'b0t', 'b1', 'b1t', 'b2', 'b2t', 'b3', 'b3t']) this[k]?.dispose();
    const rt = (ww, hh, o = {}) => new THREE.WebGLRenderTarget(Math.max(2, Math.round(ww)), Math.max(2, Math.round(hh)), { type: THREE.HalfFloatType, depthBuffer: false, ...o });
    this.A = rt(w, h, { samples: 4, depthBuffer: true });
    this.A.depthTexture = new THREE.DepthTexture(w, h);
    this.A.depthTexture.type = THREE.UnsignedIntType;
    this.K = rt(w, h, { depthBuffer: true });
    for (let i = 0; i < 4; i++) { const d = 2 << i; this['b' + i] = rt(w / d, h / d); this['b' + i + 't'] = rt(w / d, h / d); }
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
  render(scene, camera, P0 = {}) {
    const P = { ...POST_DEFAULT, ...P0 }, r = this.r, s = this.scale;
    camera.updateMatrixWorld();
    FXU.uNear.value = camera.near; FXU.uFar.value = camera.far; FXU.uRes.value.set(this.w, this.h);
    // 1. painted world
    camera.layers.set(0);
    r.setRenderTarget(this.A); r.setClearColor(scene.userData.clear ?? 0x000000, 1); r.clear(); r.render(scene, camera);
    // 2. brush consolidation
    const k = this.mK.uniforms;
    k.tC.value = this.A.texture; k.tZ.value = this.A.depthTexture; k.px.value.set(1 / this.w, 1 / this.h);
    k.uNear.value = camera.near; k.uFar.value = camera.far; k.uFocus.value = P.focus; k.uRange.value = P.range; k.uFlat.value = P.flat;
    k.uRNear.value = P.rNear * s; k.uRFar.value = P.rFar * s; k.uMean.value = P.mean; k.uHaze.value = P.haze; k.uWobble.value = P.wobble * s; k.uHazeCol.value.setRGB(...P.hazeCol);
    r.setRenderTarget(this.K); r.clear();
    this.pass(this.mK, this.K);
    // 3. FX layer, crisp, soft-depth-tested against the painted scene
    FXU.uDepth.value = this.A.depthTexture;
    camera.layers.set(FX_LAYER);
    const bg = scene.background; scene.background = null;
    r.autoClear = false; r.setRenderTarget(this.K); r.render(scene, camera); r.autoClear = true;
    scene.background = bg; camera.layers.set(0);
    // 4. bloom pyramid
    this.mBright.uniforms.tC.value = this.K.texture; this.mBright.uniforms.px.value.set(1 / this.w, 1 / this.h); this.mBright.uniforms.uThr.value = P.thr;
    this.pass(this.mBright, this.b0t);
    let src = this.b0t;
    for (let i = 0; i < 4; i++) {
      const a = this['b' + i], t = this['b' + i + 't'];
      if (i > 0) { this.mCopy.uniforms.tC.value = src.texture; this.pass(this.mCopy, t); }
      this.mBlur.uniforms.tC.value = t.texture; this.mBlur.uniforms.dir.value.set(1 / t.width, 0); this.pass(this.mBlur, a);
      this.mBlur.uniforms.tC.value = a.texture; this.mBlur.uniforms.dir.value.set(0, 1 / t.height); this.pass(this.mBlur, t);
      this.mBlur.uniforms.tC.value = t.texture; this.mBlur.uniforms.dir.value.set(1 / t.width, 0); this.pass(this.mBlur, a);
      this.mBlur.uniforms.tC.value = a.texture; this.mBlur.uniforms.dir.value.set(0, 1 / t.height); this.pass(this.mBlur, t);
      this.mCopy.uniforms.tC.value = t.texture; this.pass(this.mCopy, a);
      src = a;
    }
    // 5. finish
    const f = this.mFinal.uniforms;
    f.tC.value = this.K.texture; f.tB0.value = this.b0.texture; f.tB1.value = this.b1.texture; f.tB2.value = this.b2.texture; f.tB3.value = this.b3.texture;
    f.uRes.value.set(this.w, this.h); f.uBloom.value = P.bloom; f.uExposure.value = P.exposure; f.uContrast.value = P.contrast; f.uSat.value = P.sat;
    f.uVig.value = P.vig; f.uGrain.value = P.grain; f.uSeed.value = P.seed; f.uFade.value = P.fade; f.uFlash.value = P.flash; f.uCanvas.value = P.canvas; f.uGlowWarm.value = P.glowWarm;
    f.uLift.value.setRGB(...P.lift); f.uGain.value.setRGB(...P.gain); f.uFadeCol.value.setRGB(...P.fadeCol);
    this.pass(this.mFinal, null);
  }
}
