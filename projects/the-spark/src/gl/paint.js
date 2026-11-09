// Painterly surface material (the Wild Robot look): a Lambert override where the light term is re-painted.
//  * the terminator is broken up by brush strokes and banded into soft tones (non-physical shading)
//  * brush texture shows in the key light; the shadow side is flat and takes a scene-wide tint
//  * a stroke-broken rim catches the backlight
// LOOK holds the scene-wide paint parameters, so a shot re-grades every material by changing a few values.
import * as THREE from 'three';

export const LOOK = {
  uStroke: { value: null },
  uShadowTint: { value: new THREE.Color(0.22, 0.3, 0.42) },
  uBand: { value: new THREE.Vector4(0.1, 0.42, 0.78, 1.15) },
  uBreak: { value: 0.6 },
  uPoster: { value: 0.72 },
  uRimCol: { value: new THREE.Color(1, 0.75, 0.5) },
  uRimAmt: { value: 0.0 },
  uReveal: { value: new THREE.Vector4(0, 0, 0, 0) },      // xyz + radius: x-ray dissolve around a point
  uRevealCol: { value: new THREE.Color(0.4, 0.9, 1.0) },
  uWarm: { value: 0.0 },                                   // 0..1 "awake" amount for materials that opt in
};

const VS_PARS = `
varying vec3 vPP; varying vec3 vPN; varying vec3 vWorldP;
uniform float uObj;
`;
const VS_MAIN = `
{
  vec4 ppw = vec4(transformed, 1.0);
  vec3 ppn = objectNormal;
  #ifdef USE_INSTANCING
    ppw = instanceMatrix * ppw; ppn = mat3(instanceMatrix) * ppn;
  #endif
  vec4 pWorld = modelMatrix * ppw;
  vWorldP = pWorld.xyz;
  if (uObj > 0.5) { vPP = transformed; vPN = objectNormal; }
  else { vPP = pWorld.xyz; vPN = normalize(mat3(modelMatrix) * ppn); }
}
`;
const FS_PARS = `
uniform sampler2D uStroke; uniform vec3 uShadowTint; uniform vec4 uBand; uniform float uBreak, uPoster, uRimAmt, uWarm;
uniform vec3 uRimCol; uniform float uStrokeScale, uStrokeAmt, uRimK, uShadeK, uWarmK, uBroken; uniform vec4 uReveal; uniform vec3 uRevealCol; uniform vec3 uCold;
varying vec3 vPP; varying vec3 vPN; varying vec3 vWorldP;
vec3 triStroke(vec3 p, vec3 n, float s) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  return texture2D(uStroke, p.zy * s).rgb * w.x + texture2D(uStroke, p.xz * s + 0.37).rgb * w.y + texture2D(uStroke, p.xy * s + 0.71).rgb * w.z;
}
`;
const FS_OUT = `
  vec3 pIrr = reflectedLight.directDiffuse * PI;
  vec3 pAmb = reflectedLight.indirectDiffuse * PI;
  vec3 alb = diffuseColor.rgb;
  #ifdef PAINT_WARM
    alb = mix(mix(vec3(dot(alb, vec3(0.3, 0.5, 0.2))), alb, 0.25) * uCold, alb, clamp(uWarm * uWarmK, 0.0, 1.0));
  #endif
  vec3 pst = triStroke(vPP, normalize(vPN), uStrokeScale);
  float sn = pst.r - 0.5, bl = pst.g - 0.5;
  alb *= 1.0 + bl * vec3(0.42, 0.04, -0.42) * uBroken + sn * vec3(-0.12, 0.05, 0.16) * uBroken;   // broken colour: warm/cool patches
  #ifdef PAINT_DISSOLVE
    float dR = distance(vWorldP, uReveal.xyz) + bl * uReveal.w * 0.9 + sn * uReveal.w * 0.35;
    float dA = smoothstep(uReveal.w * 0.72, uReveal.w, dR);
    if (dA < 0.5) discard;
    totalEmissiveRadiance += uRevealCol * (1.0 - smoothstep(0.5, 1.0, dA)) * 2.5;
  #endif
  float pL = dot(pIrr, vec3(0.2126, 0.7152, 0.0722));
  vec3 hue = mix(vec3(1.0), pIrr / max(pL, 1e-3), smoothstep(0.0, 0.04, pL));
  float Lb = pL * (1.0 + sn * uBreak * 1.3) + sn * uBreak * 0.14 * smoothstep(0.0, 0.25, pL) + bl * 0.05;
  float t1 = smoothstep(uBand.x, uBand.y, Lb), t2 = smoothstep(uBand.z, uBand.w, Lb);
  float Lp = t1 * 0.62 + t2 * 0.38 + max(Lb - uBand.w, 0.0) * 0.7;
  float Lq = max(mix(Lb, Lp, uPoster), 0.0);
  vec3 lit = alb * hue * Lq * (1.0 + sn * uStrokeAmt * 2.0);
  vec3 shade = alb * (uShadowTint * uShadeK + pAmb) * (1.0 + bl * 0.6 + sn * uStrokeAmt * 1.1);
  float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
  float rimB = smoothstep(0.3, 0.7, fr + sn * 0.6);
  vec3 outgoingLight = shade + lit + uRimCol * (uRimAmt * uRimK * rimB) * (0.35 + 0.65 * alb) + totalEmissiveRadiance;
`;

let variantId = 0;
// paint(color, { scale, stroke, rim, shade, objSpace, dissolve, warm, emissive, emissiveIntensity, map, emissiveMap, vertexColors, side, flat })
export function paint(color, o = {}) {
  const m = new THREE.MeshLambertMaterial({
    color, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    map: o.map ?? null, emissiveMap: o.emissiveMap ?? null, vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide, flatShading: !!o.flat,
  });
  const u = m.userData.u = {
    uStrokeScale: { value: o.scale ?? 0.55 }, uStrokeAmt: { value: o.stroke ?? 0.3 }, uRimK: { value: o.rim ?? 1 },
    uShadeK: { value: o.shade ?? 1 }, uBroken: { value: o.broken ?? 1 }, uObj: { value: o.objSpace ? 1 : 0 }, uWarmK: { value: o.warmK ?? 1 },
    uCold: { value: new THREE.Color(o.cold ?? 0x8fa6c4) },
  };
  const defs = (o.dissolve ? '#define PAINT_DISSOLVE\n' : '') + (o.warm ? '#define PAINT_WARM\n' : '');
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, LOOK, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VS_PARS)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VS_MAIN);
    sh.fragmentShader = defs + sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FS_PARS)
      .replace('#include <lights_lambert_fragment>', '#include <lights_lambert_fragment>\nmaterial.diffuseColor = vec3(1.0);')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', FS_OUT);
  };
  m.customProgramCacheKey = () => 'paint|' + defs;
  m.userData.variant = ++variantId;
  return m;
}

// Scene-wide paint state. Every shot calls this each frame (the uniforms are shared by all worlds).
const LOOK_DEFAULT = { tint: [0.12, 0.2, 0.26], rim: [1, 0.7, 0.4], rimAmt: 0.4, band: [0.1, 0.42, 0.78, 1.15], brk: 0.6, poster: 0.72, warm: 1, reveal: [0, 0, 0, 0], revealCol: [0.4, 0.9, 1.0] };
export function setLook(o = {}) {
  const L = { ...LOOK_DEFAULT, ...o };
  LOOK.uShadowTint.value.setRGB(...L.tint); LOOK.uRimCol.value.setRGB(...L.rim); LOOK.uRimAmt.value = L.rimAmt;
  LOOK.uBand.value.set(...L.band); LOOK.uBreak.value = L.brk; LOOK.uPoster.value = L.poster; LOOK.uWarm.value = L.warm;
  LOOK.uReveal.value.set(...L.reveal); LOOK.uRevealCol.value.setRGB(...L.revealCol);
}
