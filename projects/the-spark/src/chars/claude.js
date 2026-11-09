// Claude the mascot in 3D, built from refs/claude-mascot.png (250x189). Measured in 18 px units (u):
//   body 8u x 6u (x 52..198, y 17..123), colour #DA7758
//   arms 2u x 2u on each side at body rows 2..4 (x 15..231, y 52..88)
//   legs 1u x 2u at body columns 0, 2, 5, 7 (y 124..162)
//   eyes 1u x 1u black squares at columns 1 and 6, row 1 (x 71..87 / 161..177, y 34..50)
// The front silhouette is exact; depth (4.6u body, two rows of legs) is invented for 3D. Origin = ground centre.
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { rbox, mesh } from '../gl/geo.js';
import { clamp } from '../core.js';

export const CORAL = 0xda7758;

export class Claude {
  constructor() {
    const g = this.group = new THREE.Group();
    const root = this.root = new THREE.Group(); g.add(root);       // squash/tilt pivot at the feet
    const skin = this.skin = paint(CORAL, { objSpace: true, scale: 0.1, stroke: 0.3, warm: true, rim: 1.2, shade: 1.5, broken: 0.6, emissive: CORAL, emissiveIntensity: 0.0 });
    const dark = this.dark = paint(0x070608, { objSpace: true, stroke: 0.05, rim: 0.0, shade: 0.1, broken: 0 });
    const bodyP = this.bodyP = new THREE.Group(); bodyP.position.y = 2; root.add(bodyP);
    this.body = mesh(rbox(8, 6, 4.6, 0.32, 4), skin); this.body.position.y = 3; bodyP.add(this.body);
    this.arms = [-1, 1].map(s => {
      const piv = new THREE.Group(); piv.position.set(4 * s, 3, 0); bodyP.add(piv);
      const a = mesh(rbox(2.1, 2, 2.3, 0.3, 3), skin); a.position.x = 0.95 * s; piv.add(a);
      return piv;
    });
    this.legs = [];
    for (const z of [1.45, -1.45]) for (const x of [-3.5, -1.5, 1.5, 3.5]) {
      const piv = new THREE.Group(); piv.position.set(x, 2.05, z); root.add(piv);
      const l = mesh(rbox(1, 2.1, 1.3, 0.22, 3), skin); l.position.y = -1.0; piv.add(l);
      piv.userData = { x, z }; this.legs.push(piv);
    }
    this.eyes = [-2.5, 2.5].map(x => {
      const e = mesh(rbox(1, 1, 0.3, 0.1, 2), dark, { cast: false }); e.position.set(x, 4.5, 2.3); bodyP.add(e);
      e.userData.x = x; return e;
    });
  }
  // p: { squash (1 = neutral, <1 squashed), tilt, lean, armL, armR (radians, + = raised), walk (phase), stride,
  //      blink 0..1 (1 closed), lookX, lookY (-1..1), eyeH (height scale), bob }
  pose(p = {}) {
    const sq = p.squash ?? 1, inv = 1 / Math.sqrt(sq);
    this.root.scale.set(inv, sq, inv);
    this.root.rotation.set(p.lean ?? 0, 0, p.tilt ?? 0);
    this.root.position.y = p.bob ?? 0;
    this.bodyP.position.y = 2 + (p.bodyLift ?? 0);
    this.arms[0].rotation.z = -(p.armL ?? 0); this.arms[1].rotation.z = p.armR ?? 0;
    const st = p.stride ?? 0, ph = p.walk ?? 0;
    this.legs.forEach((l, i) => {
      const a = Math.sin(ph + (i % 2) * Math.PI + (i > 3 ? Math.PI : 0)) * st;
      l.rotation.x = a; l.position.y = 2.05 + Math.max(0, Math.cos(ph + (i % 2) * Math.PI + (i > 3 ? Math.PI : 0))) * st * 0.5;
    });
    const open = clamp(1 - (p.blink ?? 0), 0.08, 1) * (p.eyeH ?? 1);
    this.eyes.forEach(e => {
      e.scale.set(p.eyeW ?? 1, open, 1);
      e.position.x = e.userData.x + (p.lookX ?? 0) * 0.3; e.position.y = 4.5 + (p.lookY ?? 0) * 0.25;
    });
  }
}
// natural blink: closed for ~0.12 s at each time in `at`
export const blinkAt = (t, at) => at.reduce((m, b) => Math.max(m, clamp(1 - Math.abs(t - b) / 0.09)), 0);
