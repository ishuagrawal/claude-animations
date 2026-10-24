// Comic-print toon shading (style bible: posterized 3-band key, halftone dots in the shade bands,
// colored rim lines per side, hard spec, indigo fog). Every material shares the RIG uniforms, so a
// shot sets the light rig once per frame.
import * as THREE from 'three';

// stylized pipeline: colors are display values (sRGB in, sRGB out). Must run before any Color exists.
THREE.ColorManagement.enabled = false;

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const col = c => new THREE.Color(c);

export const RIG = {
  uKeyDir: { value: v3(-0.4, 0.8, 0.5).normalize() },
  uKeyCol: { value: col('#ffffff') },
  uRimADir: { value: v3(-1, 0.25, -0.3).normalize() },
  uRimACol: { value: col('#e22f54') },
  uRimBDir: { value: v3(1, 0.25, -0.3).normalize() },
  uRimBCol: { value: col('#38b6ff') },
  uRimW: { value: 1 },
  uAmb: { value: col('#151642') },
  uFogCol: { value: col('#0c0a2b') },
  uFogNear: { value: 14 },
  uFogFar: { value: 60 },
  uDot: { value: 7.0 },        // halftone cell, px at 1080p
  uRes: { value: new THREE.Vector2(1920, 1080) },
  uTime: { value: 0 },
  uSil: { value: 0 },          // 1 = everything renders as a flat silhouette (poster passes)
  uSilCol: { value: col('#000000') },
};

export const common = /* glsl */`
uniform vec3 uKeyDir, uKeyCol, uRimADir, uRimACol, uRimBDir, uRimBCol, uAmb, uFogCol, uSilCol;
uniform float uRimW, uFogNear, uFogFar, uDot, uTime, uSil;
uniform vec2 uRes;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// halftone coverage: 1 inside a dot whose radius grows with c (0..1)
float halftone(float c, float cell, float ang){
  vec2 p = gl_FragCoord.xy / (uRes.y / 1080.0);
  float s = sin(ang), co = cos(ang);
  p = mat2(co, -s, s, co) * p / cell;
  vec2 f = fract(p) - 0.5;
  float r = sqrt(clamp(c, 0.0, 1.0)) * 0.62;
  float d = length(f);
  float aa = 0.9 / cell;
  return 1.0 - smoothstep(r - aa, r + aa, d);
}
float hatch(float c, float cell){
  vec2 p = gl_FragCoord.xy / (uRes.y / 1080.0);
  float l = abs(fract((p.x * 0.8 + p.y) / cell) - 0.5) * 2.0;
  float aa = 2.0 / cell;
  return 1.0 - smoothstep(c - aa, c + aa, l);
}
`;

export const vert = /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vV; varying vec2 vUv; varying float vDepth; varying vec3 vObj;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vObj = position;
  vN = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);   // world-space normal (handles non-uniform scale)
  vV = normalize(cameraPosition - w.xyz);
  vUv = uv;
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */`
${common}
uniform vec3 uBase, uShade, uDeep, uEmis, uSpecCol;
uniform float uHalf, uHatch, uSpec, uSpecSize, uRim, uBands, uEmisAmt, uFog, uOpacity, uFlat, uDotAng;
uniform sampler2D uMap; uniform float uMapAmt; uniform vec3 uGrad;
varying vec3 vN; varying vec3 vW; varying vec3 vV; varying vec2 vUv; varying float vDepth; varying vec3 vObj;
void main(){
  if (uSil > 0.5) { gl_FragColor = vec4(uSilCol, 1.0); return; }
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vV);
  float ndl = dot(N, uKeyDir) * 0.5 + 0.5;
  ndl = mix(ndl, 0.75, uFlat);
  if (uGrad.z > 0.0) ndl -= uGrad.z * (1.0 - smoothstep(uGrad.x, uGrad.y, vObj.y));
  float aa = fwidth(ndl) * 1.2 + 0.002;
  float b2 = smoothstep(0.60 - aa, 0.60 + aa, ndl);   // lit
  float b1 = smoothstep(0.36 - aa, 0.36 + aa, ndl);   // shade
  vec3 base = uBase, shade = uShade, deep = uDeep;
  if (uMapAmt > 0.0) { vec3 m = texture2D(uMap, vUv).rgb; base *= mix(vec3(1.0), m, uMapAmt); shade *= mix(vec3(1.0), m, uMapAmt); deep *= mix(vec3(1.0), m, uMapAmt * 0.6); }
  vec3 c = mix(deep, mix(shade, base, b2), b1);
  // halftone: darker dots creeping into each band above its edge
  if (uHalf > 0.0) {
    float c2 = clamp((0.80 - ndl) / 0.20, 0.0, 1.0) * b2;          // lit → shade dots
    float c1 = clamp((0.52 - ndl) / 0.16, 0.0, 1.0) * b1 * (1.0 - b2); // shade → deep dots
    c = mix(c, shade, halftone(c2 * 0.55, uDot, uDotAng) * uHalf);
    c = mix(c, deep, halftone(c1 * 0.75, uDot, uDotAng + 0.4) * uHalf);
  }
  if (uHatch > 0.0) c = mix(c, deep * 0.7, hatch((1.0 - b1) * 0.6 + (1.0 - b2) * 0.25, 9.0) * uHatch);
  c *= uKeyCol;
  // hard spec
  vec3 H = normalize(uKeyDir + V);
  float sp = pow(max(dot(N, H), 0.0), uSpecSize);
  c = mix(c, uSpecCol, smoothstep(0.5 - fwidth(sp), 0.5 + fwidth(sp), sp) * uSpec);
  // colored rim lines, one per side light
  float fr = 1.0 - max(dot(N, V), 0.0);
  float ra = fr * max(dot(N, uRimADir), 0.0), rb = fr * max(dot(N, uRimBDir), 0.0);
  float rw = fwidth(fr) * 1.5 + 0.01;
  float th = 0.42 / max(uRimW, 0.2);
  c = mix(c, uRimACol, smoothstep(th - rw, th + rw, ra) * uRim);
  c = mix(c, uRimBCol, smoothstep(th - rw, th + rw, rb) * uRim);
  c += uEmis * uEmisAmt;
  // depth fog toward the indigo void
  float f = smoothstep(uFogNear, uFogFar, vDepth) * uFog;
  c = mix(c, uFogCol, f);
  gl_FragColor = vec4(c, uOpacity);
}`;

// p: { base, shade, deep, half, hatch, spec, specSize, specCol, rim, emis, emisAmt, fog, opacity, flat, map, mapAmt }
export function toon(p = {}) {
  const base = col(p.base || '#888888');
  const shade = col(p.shade || base.clone().multiplyScalar(0.62));
  const deep = col(p.deep || base.clone().multiplyScalar(0.3).lerp(col('#151642'), 0.5));
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...RIG,
      uBase: { value: base }, uShade: { value: shade }, uDeep: { value: deep },
      uHalf: { value: p.half ?? 1 }, uHatch: { value: p.hatch ?? 0 }, uDotAng: { value: p.dotAng ?? 0.785 },
      uSpec: { value: p.spec ?? 0 }, uSpecSize: { value: p.specSize ?? 60 }, uSpecCol: { value: col(p.specCol || '#ffffff') },
      uRim: { value: p.rim ?? 1 }, uBands: { value: 3 },
      uEmis: { value: col(p.emis || '#000000') }, uEmisAmt: { value: p.emisAmt ?? 0 },
      uFog: { value: p.fog ?? 1 }, uOpacity: { value: p.opacity ?? 1 }, uFlat: { value: p.flat ?? 0 },
      uMap: { value: p.map || null }, uMapAmt: { value: p.map ? (p.mapAmt ?? 1) : 0 },
      uGrad: { value: new THREE.Vector3(...(p.grad || [0, 1, 0])) },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: (p.opacity ?? 1) < 1,
    side: p.side ?? THREE.FrontSide,
  });
  return m;
}

// Unlit emissive (neon, lantern cores, sky elements). Respects silhouette passes.
export function glowMat(color, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...RIG, uCol: { value: col(color) }, uAmt: { value: opts.amt ?? 1 }, uOpacity: { value: opts.opacity ?? 1 }, uMap: { value: opts.map || null }, uHasMap: { value: opts.map ? 1 : 0 } },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform vec3 uCol; uniform float uAmt, uOpacity, uHasMap; uniform sampler2D uMap;
      varying vec2 vUv;
      void main(){
        if (uSil > 0.5) { gl_FragColor = vec4(uSilCol, 1.0); return; }
        vec4 m = uHasMap > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
        gl_FragColor = vec4(uCol * uAmt * m.rgb, uOpacity * m.a);
      }`,
    transparent: !!opts.transparent || !!opts.additive || !!opts.map || (opts.opacity ?? 1) < 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive && !opts.noDepthWrite,
    side: opts.side ?? THREE.FrontSide,
  });
}

// Light cone (volumetric spot) with stipple dust, additive.
export function coneMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { ...RIG, uCol: { value: col(color) }, uAmt: { value: 1 }, uSeed: { value: 0 } },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform vec3 uCol; uniform float uAmt, uSeed;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){
        if (uSil > 0.5) discard;
        float along = vUv.y;                       // 1 at the lamp, 0 at the floor
        float edge = abs(dot(normalize(vN), normalize(vV)));
        float body = pow(edge, 2.6);
        float a = body * (0.10 + 0.42 * pow(along, 1.6));
        // stipple dust: sparse bright points that thicken near the lamp
        vec2 px = floor(gl_FragCoord.xy / (uRes.y / 1080.0) / 2.0);
        float h = hash12(px + uSeed * 17.0);
        float dust = step(1.0 - (0.03 + 0.10 * along) * body, h);
        float c = a + dust * 0.8 * body;
        gl_FragColor = vec4(uCol * c * uAmt, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// Glass: fresnel edges, faint tint, streak highlights. Draw after opaque.
export function glassMat(tint = '#9fd0ff', opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...RIG, uTint: { value: col(tint) }, uAmt: { value: opts.amt ?? 1 }, uFill: { value: opts.fill ?? 0.06 } },
    vertexShader: vert,
    fragmentShader: /* glsl */`${common}
      uniform vec3 uTint; uniform float uAmt, uFill;
      varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      void main(){
        if (uSil > 0.5) discard;
        vec3 N = normalize(vN); float front = gl_FrontFacing ? 1.0 : 0.0; if (front < 0.5) N = -N;
        float fr = 1.0 - abs(dot(N, normalize(vV)));
        float edge = smoothstep(0.55, 0.95, fr);
        // cartoon window streaks: two slanted bars on the upper-left, front faces only
        vec3 Nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
        float d1 = abs(Nv.x + 0.42 - Nv.y * 0.35), d2 = abs(Nv.x + 0.22 - Nv.y * 0.35);
        float band = smoothstep(0.0, 0.35, Nv.y + 0.2) * (1.0 - smoothstep(0.78, 0.95, Nv.y));
        float streak = ((1.0 - smoothstep(0.04, 0.055, d1)) + (1.0 - smoothstep(0.014, 0.024, d2))) * band * front;
        float rimA = smoothstep(0.7, 0.85, fr * max(dot(N, uRimADir), 0.0) * 1.6);
        float rimB = smoothstep(0.7, 0.85, fr * max(dot(N, uRimBDir), 0.0) * 1.6);
        vec3 c = uTint * (uFill + edge * 0.55) + vec3(1.0) * streak * 0.9 + uRimACol * rimA * 0.8 + uRimBCol * rimB * 0.8;
        float a = clamp(uFill + edge * 0.6 + streak + (rimA + rimB) * 0.7, 0.0, 1.0) * uAmt;
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
