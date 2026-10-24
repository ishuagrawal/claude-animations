// Space (reference DNA: a cosmic-scale button). Far from the arena (z ≈ -400): a star field, Earth, and the
// moon, whose dark side Kimi lights up when it lands — the "moonshot" launch.
import * as THREE from 'three';
import { toon, glowMat } from '../gl/toon.js';
import { moonTex } from '../gl/tex.js';
import { rng } from '../core.js';

export const SPACE = new THREE.Vector3(0, 0, -400);

function earthTex() {
  const w = 1024, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = rng(12);
  x.fillStyle = '#2f6fe0'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    x.fillStyle = i % 3 ? '#4fbf6a' : '#3a9a58';
    x.beginPath();
    const cx = r() * w, cy = h * (0.25 + r() * 0.5);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = 50 + r() * 90; x.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr * 0.8); }
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 30; i++) { x.beginPath(); x.ellipse(r() * w, r() * h, 30 + r() * 60, 6 + r() * 10, r() * 0.4, 0, 7); x.fill(); }
  x.fillRect(0, 0, w, 26); x.fillRect(0, h - 26, w, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

export function makeSpace(scene, stage) {
  const g = new THREE.Group(); g.position.copy(SPACE); g.visible = false; scene.add(g);
  const r = rng(404);
  // stars
  const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const pal = [[1, 1, 1], [0.7, 0.85, 1], [1, 0.85, 0.6], [1, 0.6, 0.7]];
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, R = 120;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R], i * 3);
    const c = pal[Math.floor(r() * 4)], b = 0.35 + r() * 0.65;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true })));
  const twinkles = [];
  for (let i = 0; i < 24; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.STAR, color: ['#ffffff', '#9fd8ff', '#ffd98a'][i % 3], blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set((r() - 0.5) * 70, (r() - 0.5) * 40, -30 - r() * 40);
    sp.userData = { s: 0.6 + r() * 1.6, ph: r() * 6 };
    g.add(sp); twinkles.push(sp);
  }
  // moon: lit crescent on the right, dark side toward us
  const moonMat = toon({ base: '#f3e6bf', shade: '#2a2c66', deep: '#141542', half: 1, map: moonTex(), mapAmt: 0.7, rim: 0, fog: 0 });
  moonMat.uniforms.uKeyDir = { value: new THREE.Vector3(0.9, 0.3, -0.3).normalize() };
  moonMat.uniforms.uKeyCol = { value: new THREE.Color('#ffffff') };
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 96, 64), moonMat);
  moon.position.set(3, 0.5, -22); g.add(moon);
  // Kimi's glow spreading over the dark side after landing
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.GLOW, color: '#2f7cf6', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  moonGlow.scale.set(20, 20, 1); moonGlow.position.set(3, 0.5, -14); g.add(moonGlow);
  const landFlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.STAR, color: '#bfe3ff', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  g.add(landFlare);
  // earth, small, lower left
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2.0, 64, 48), toon({ base: '#ffffff', shade: '#8a96d8', deep: '#1b1f5a', half: 1, map: earthTex(), mapAmt: 1, rim: 0, fog: 0 }));
  earth.material.uniforms.uKeyDir = { value: new THREE.Vector3(0.9, 0.3, 0.3).normalize() };
  earth.position.set(-10.5, 5.2, -27); g.add(earth);
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: stage.GLOW, color: '#4aa8ff', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
  atmo.scale.set(6.5, 6.5, 1); atmo.position.copy(earth.position); g.add(atmo);
  return { group: g, moon, moonGlow, landFlare, earth, twinkles, origin: SPACE.clone() };
}

export function animateSpace(S, t) {
  S.twinkles.forEach(sp => {
    const k = Math.max(0, Math.sin(t * 2.4 + sp.userData.ph));
    const s = sp.userData.s * (0.3 + 0.7 * k * k);
    sp.scale.set(s, s, 1);
  });
  S.earth.rotation.y = t * 0.15;
}
