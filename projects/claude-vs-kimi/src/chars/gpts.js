// The overlooked: GPT-6 Astra and GPT-6.1 Sol, as original mini-mascots read off their names (a silver star,
// a little sun) — no logos. They never get a spotlight that works.
import * as THREE from 'three';
import { toon, glowMat } from '../gl/toon.js';

function dotEyes(parent, y, sep, r, z) {
  const m = new THREE.MeshBasicMaterial({ color: '#0b0a12' });
  return [-1, 1].map(s => {
    const e = new THREE.Mesh(new THREE.CircleGeometry(r, 20), m);
    e.scale.y = 1.35;
    e.position.set(s * sep, y, z);
    parent.add(e);
    return e;
  });
}

export function makeAstra() {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * Math.PI * 2, rr = i % 2 ? 0.13 : 0.3;
    const x = Math.sin(a) * rr, y = Math.cos(a) * rr;
    i ? sh.lineTo(x, y) : sh.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
  geo.translate(0, 0, -0.045);
  const mat = toon({ base: '#dfe4fa', shade: '#9096cc', deep: '#3b3b7c', half: 1, spec: 0.7, specSize: 50 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const star = new THREE.Mesh(geo, mat); body.add(star);
  body.position.y = 0.33;
  const eyes = dotEyes(body, 0.0, 0.055, 0.022, 0.09);
  return { root, body, eyes, mat };
}

export function makeSol() {
  const mat = toon({ base: '#ffd774', shade: '#d9a13e', deep: '#6a3a2a', half: 1, spec: 0.5, specSize: 40 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 40, 30), mat); body.add(ball);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), mat);
    ray.position.set(Math.sin(a) * 0.23, Math.cos(a) * 0.23, 0);
    ray.rotation.z = -a;
    body.add(ray);
  }
  body.position.y = 0.32;
  const eyes = dotEyes(body, 0.02, 0.055, 0.02, 0.168);
  return { root, body, eyes, mat };
}

// p: x,y,z, ry, bob, tilt, spin, scale, blink (0..1 closed)
export function poseMini(c, p) {
  c.root.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  c.root.rotation.set(p.rx ?? 0, p.ry ?? 0, 0);
  c.root.scale.setScalar(p.scale ?? 1);
  c.body.position.y = 0.32 + (p.bob ?? 0);
  c.body.rotation.set(p.pitch ?? 0, 0, (p.tilt ?? 0) + (p.spin ?? 0));
  c.eyes.forEach(e => { e.scale.y = 1.35 * (1 - (p.blink ?? 0) * 0.9); e.scale.x = p.wide ? 1.3 : 1; });
}

// ringside bench they sit on (stage-left, below the stage lip)
export function makeBench(scene) {
  const g = new THREE.Group();
  const wood = toon({ base: '#5a4a8a', shade: '#3a2e66', deep: '#141238', half: 0.8, hatch: 0.3 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.45), wood); seat.position.y = 0.42; g.add(seat);
  for (const x of [-0.7, 0.7]) for (const z of [-0.17, 0.17]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), wood); l.position.set(x, 0.21, z); g.add(l);
  }
  // the dud spotlight on a floor stand aimed at the bench
  const lampMat = toon({ base: '#4a4f8f', shade: '#2a2d62', deep: '#0e0d2c', half: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), lampMat); pole.position.set(1.4, 0.8, 0.9); g.add(pole);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.34, 16), lampMat);
  head.position.set(1.4, 1.62, 0.9); head.rotation.set(0.5, 0, 0.9); g.add(head);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), glowMat('#fff3c4', { amt: 0 }));
  lens.position.set(1.27, 1.52, 0.98); lens.rotation.set(0.5, -0.6, 0.9); g.add(lens);
  scene.add(g);
  return { group: g, lens, head };
}
