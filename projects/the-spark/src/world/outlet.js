// Inside the wall outlet: a dark moulded cavity, brass contact clips gripping the plug's blades, house wires
// curling away behind. The blades come in from the right (the room side); that is the way out. Units ~ cm.
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, Ribbon, shaftMat, fxMesh } from '../gl/fx.js';
import { rbox, cyl, mesh, inst, merge, at, V3, tube } from '../gl/geo.js';
import { rng, TAU } from '../core.js';

export const BLADE_Y = 0.09;           // top surface of the near blade
export const GAP = [1.15, 0.42, 0];     // where the contact lip meets the blade: the spark is born here

export function buildOutlet() {
  const scene = new THREE.Scene(), R = rng(31);
  scene.userData.clear = 0x05040b;
  scene.fog = new THREE.FogExp2(0x0b0818, 0.018);
  const cam = new THREE.PerspectiveCamera(32, 1920 / 804, 0.1, 120);
  // faint warm leak from the slots (right), a breath of cool ambient
  const leak = new THREE.DirectionalLight(0xffa066, 0.5); leak.position.set(14, 3, 4); leak.target.position.set(0, 0, 0);
  const hemi = new THREE.HemisphereLight(0x3a3a7a, 0x05040b, 0.22);
  const flash = new THREE.PointLight(0xd0f2ff, 0, 30, 1.4); flash.position.set(GAP[0], GAP[1] + 0.4, 1.2);
  scene.add(leak, leak.target, hemi, flash);

  const plastic = paint(0x3a3260, { scale: 0.14, stroke: 0.4, rim: 1.0 });
  const plastic2 = paint(0x2a2548, { scale: 0.14, stroke: 0.4, rim: 1.0 });
  const brass = paint(0xdba545, { scale: 0.1, stroke: 0.32, rim: 2.0 });
  const brassD = paint(0xa87428, { scale: 0.1, stroke: 0.32, rim: 1.6 });
  const steel = paint(0x9aa3ad, { scale: 0.4, stroke: 0.35, rim: 1.6 });

  // ---- moulded cavity: back wall with ribs, floor, ceiling, left wall, pegs
  const shell = [at(new THREE.BoxGeometry(44, 26, 1), 0, 1, -7.5), at(new THREE.BoxGeometry(44, 1, 30), 0, -5.2, 4), at(new THREE.BoxGeometry(44, 1, 30), 0, 7.6, 4), at(new THREE.BoxGeometry(1, 26, 30), -13, 1, 4)];
  scene.add(mesh(merge(shell), plastic2, { cast: false }));
  const ribs = []; for (let i = 0; i < 13; i++) ribs.push(at(rbox(0.6, 13, 1.2, 0.15), -11.5 + i * 2.1 + (R() - 0.5) * 0.3, 1.2, -6.6));
  for (let i = 0; i < 4; i++) ribs.push(at(rbox(30, 0.7, 1.0, 0.15), -1, -3.6 + i * 3.3, -6.8));
  for (const [x, z, r, h] of [[-7, -3, 1.1, 5], [-9.5, 2.5, 0.8, 4], [8.5, -4.5, 0.9, 6], [-3.5, -5, 0.7, 3.4]]) ribs.push(at(cyl(r, r * 1.15, h, 20), x, -4.7 + h / 2, z));
  scene.add(mesh(merge(ribs), plastic));
  // ---- faceplate inner wall (right) with two slots where the blades pass, light leaking round them
  const face = [at(new THREE.BoxGeometry(1, 26, 30), 9.5, 1, 4)];
  scene.add(mesh(merge(face), plastic2, { cast: false }));
  const slitM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.72, 0.3) });
  for (const z of [0, -3.6]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), slitM); s.rotation.y = -Math.PI / 2; s.position.set(8.98, BLADE_Y - 0.08, z); scene.add(s); }
  const leakShaft = shaftMat(0xffa25c, { gain: 0.28, mode: 1, streak: 2, pow: 1, soft: 1, fadeTop: 0.0, fadeBot: 0.85 });
  for (const z of [0, -3.6]) { const s = fxMesh(new THREE.PlaneGeometry(2.2, 9), leakShaft); s.rotation.set(Math.PI / 2, 0, Math.PI / 2); s.position.set(4.6, BLADE_Y + 0.25, z); scene.add(s); }
  // ---- the blades (flat, like bridges), each with its hole near the tip
  const blades = [], holes = [];
  for (const z of [0, -3.6]) { blades.push(at(rbox(8.6, 0.18, 1.5, 0.06), 4.9, 0, z)); holes.push(at(cyl(0.3, 0.3, 0.2, 20), 1.35, 0, z)); }
  scene.add(mesh(merge(blades), brass));
  scene.add(mesh(merge(holes), paint(0x100c18, { stroke: 0.1, rim: 0, shade: 0.4 }), { cast: false }));
  // ---- contact clips: two sprung brass leaves gripping each blade, a bus bar back to a screw terminal
  const leaf = new THREE.Shape();
  leaf.moveTo(-4.2, 1.3); leaf.lineTo(-1.2, 1.15); leaf.bezierCurveTo(0.2, 1.05, 0.6, 0.3, 1.15, 0.24); leaf.bezierCurveTo(1.6, 0.22, 2.0, 0.5, 2.3, 0.95);
  leaf.lineTo(2.18, 1.03); leaf.bezierCurveTo(1.9, 0.62, 1.6, 0.4, 1.2, 0.4); leaf.bezierCurveTo(0.75, 0.46, 0.35, 1.18, -1.2, 1.31); leaf.lineTo(-4.2, 1.46); leaf.closePath();
  const leafG = new THREE.ExtrudeGeometry(leaf, { depth: 1.7, bevelEnabled: false, curveSegments: 14 }); leafG.translate(0, 0, -0.85);
  const clips = [];
  for (const z of [0, -3.6]) { clips.push(at(leafG, 0, 0, z), at(leafG, 0, 0, z, Math.PI, 0, 0), at(rbox(0.3, 3.1, 1.9, 0.08), -4.2, 0, z), at(rbox(4.2, 0.3, 1.2, 0.08), -6.3, -1.2, z)); }
  scene.add(mesh(merge(clips), brass));
  const term = [];
  for (const z of [0, -3.6]) term.push(at(rbox(2.0, 2.4, 2.0, 0.2), -9, -1.2, z));
  scene.add(mesh(merge(term), brassD));
  const screws = []; for (const z of [0, -3.6]) screws.push(at(cyl(0.72, 0.72, 0.5, 20), -9, -1.2, z + 1.2, Math.PI / 2), at(new THREE.BoxGeometry(1.1, 0.14, 0.12), -9, -1.2, z + 1.47, 0, 0, 0.5));
  scene.add(mesh(merge(screws), steel));
  // ground contact (below, centre)
  scene.add(mesh(merge([at(new THREE.TorusGeometry(0.9, 0.2, 10, 24, Math.PI * 1.5), 5.5, -3.2, -1.8, 0, Math.PI / 2, 0.6), at(rbox(9, 0.25, 1.0, 0.08), 1, -4.0, -1.8)]), brassD));
  // ---- house wires curling away
  const wire = (pts, col) => { const { geo } = tube(pts, 0.62, 80, 12); scene.add(mesh(geo, paint(col, { scale: 0.25, stroke: 0.4, rim: 1.5 }))); };
  wire([[-9.8, -1.2, 0.3], [-11.2, 0.5, 1.5], [-10.4, 3.4, 3.2], [-7.5, 5.6, 2.2], [-3, 6.4, -1], [3, 6.6, -3.5]], 0x16161c);
  wire([[-9.8, -1.2, -3.6], [-11.6, -2.4, -4.4], [-11, -4.2, -1.5], [-7, -4.5, 2.5], [-2, -4.4, 5.5], [5, -4.5, 7]], 0xd9d4c6);
  wire([[-4, -4.1, -1.8], [-8, -4.3, -4.5], [-11.5, -3.6, -5.6]], 0x3f8f5c);
  scene.add(mesh(merge([at(cyl(0.3, 0.3, 1.2, 12), -9.4, -1.2, 0.2, 0, 0, Math.PI / 2), at(cyl(0.3, 0.3, 1.2, 12), -9.4, -1.2, -3.7, 0, 0, Math.PI / 2)]), paint(0xd98a45, { scale: 1, rim: 2 })));
  // ---- dust
  const dust = new Sprites(120, { shape: 'dot', core: 0.3, soft: 0.8, drift: [0.5, 0.25, 0.7] });
  for (let i = 0; i < 120; i++) dust.set(i, -10 + R() * 19, -4 + R() * 10, -5 + R() * 12, 0.04 + R() * 0.08, 0.8, 0.75, 1.0, 0.15 + R() * 0.45, R());
  dust.commit(); scene.add(dust.mesh);
  // arcs between lip and blade, the pulse along the blade, splash motes
  const arcs = [0, 1, 2, 3].map(() => new Ribbon(8, { color: 0x6fe6ff, gain: 2.6, core: 2.0, soft: 0.3 }));
  arcs.forEach(a => scene.add(a.mesh));
  const pulse = new Sprites(14, { shape: 'dot', core: 0.5, soft: 0.5 }); scene.add(pulse.mesh);
  const splash = new Sprites(60, { shape: 'star', core: 1, soft: 0.3 }); scene.add(splash.mesh);
  return { scene, cam, leak, hemi, flash, arcs, pulse, splash, dust, leakShaft, brass };
}
