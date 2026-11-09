// Look-dev frames (open index.html?lookdev): the board with both characters, to judge the paint against the reference.
import * as THREE from 'three';
import { buildBoard } from '../world/board.js';
import { Claude } from '../chars/claude.js';
import { Spark } from '../chars/spark.js';
import { LOOK } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';

export default function shots() {
  const B = buildBoard();
  const claude = new Claude(); claude.group.scale.setScalar(1.1); claude.group.position.set(6, 0.2, 40); claude.group.rotation.y = 0.5; B.scene.add(claude.group);
  const spark = new Spark(); B.scene.add(spark.group);
  const look = () => { LOOK.uShadowTint.value.setRGB(0.1, 0.2, 0.24); LOOK.uRimCol.value.setRGB(1.0, 0.62, 0.3); LOOK.uRimAmt.value = 0.55; LOOK.uWarm.value = 1; };
  return [
    { name: 'vista', start: 0, end: 2, draw(t) {
      look(); const u = 0.45; B.update(t, u, B.cam);
      setCam(B.cam, [34, 13, 112], [-2, 15, -20], 30);
      const p = B.path.getPointAt(u); p.y = 1.6;
      claude.pose({}); spark.update(t, B.cam, { pos: p, size: 1.2, look: [0.4, 0.2] });
      return { scene: B.scene, camera: B.cam, post: { focus: 110, range: 120, flat: 30, rFar: 6, haze: 0.22, hazeCol: [0.85, 0.5, 0.28], bloom: 0.6 } };
    } },
    { name: 'close', start: 2, end: 4, draw(t) {
      look(); B.update(t, 0.3, B.cam);
      setCam(B.cam, [22, 6, 62], [4, 5.5, 40], 28);
      claude.pose({ lookX: 0.6, armR: 0.5 }); spark.update(t, B.cam, { pos: V3(15, 7.5, 44), size: 1.6, look: [-0.7, -0.2], happy: 0.2 });
      return { scene: B.scene, camera: B.cam, post: { focus: 24, range: 40, flat: 6, rFar: 8, haze: 0.2, hazeCol: [0.85, 0.5, 0.28], bloom: 0.6 } };
    } },
  ];
}
