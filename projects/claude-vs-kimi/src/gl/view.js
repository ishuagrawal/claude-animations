// The 3D view: one WebGL renderer + scene + camera shared by every shot. Shots pose the world and the
// camera for time t, then film.js composites: 2D background (posters) → 3D → 2D overlays (HUD, type).
import * as THREE from 'three';
import { W, H } from '../core.js';
import { RIG } from './toon.js';

export function makeView(ss) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(Math.round(W * ss), Math.round(H * ss), false);
  // stylized pipeline: colors are authored as display values (sRGB in, sRGB out), like paint
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  RIG.uRes.value.set(Math.round(W * ss), Math.round(H * ss));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);
  return { canvas, renderer, scene, camera, ss };
}

// Drawing rate (style bible): characters, FX and type hold on 2s while the camera moves on 1s. film.js
// evaluates each shot twice per frame: once at the smooth time to RECORD the camera, then at the held
// time with the camera REPLAYED, so only the camera stays smooth.
export const CAMLOCK = { mode: 'off', rec: null };
export const RENDER = { off: false };

// camera helper: position, look-at target, fov, dutch roll (rad), optional up vector; `free` bypasses the lock
export function aim(cam, pos, target, fov = 35, roll = 0, up = null, free = false) {
  if (CAMLOCK.mode === 'replay' && CAMLOCK.rec && !free) {
    const r = CAMLOCK.rec;
    cam.position.copy(r.p); cam.quaternion.copy(r.q); cam.up.copy(r.up);
    if (cam.fov !== r.fov) { cam.fov = r.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    return;
  }
  cam.position.set(...pos);
  cam.up.set(...(up || [0, 1, 0]));
  cam.lookAt(new THREE.Vector3(...target));
  if (roll) cam.rotateZ(roll);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld(true);
  if (CAMLOCK.mode === 'record' && !free) CAMLOCK.rec = { p: cam.position.clone(), q: cam.quaternion.clone(), up: cam.up.clone(), fov };
}

// project a world point to 1920×1080 screen space
export function toScreen(cam, p) {
  const v = (p.isVector3 ? p.clone() : new THREE.Vector3(...p)).project(cam);
  return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z];
}
