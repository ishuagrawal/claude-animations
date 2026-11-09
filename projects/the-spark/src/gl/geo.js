// Geometry helpers: rounded boxes, instancing, tubes, merged static sets.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const rbox = (w, h, d, r = 0.08, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
export const cyl = (rt, rb, h, seg = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const merge = geos => mergeGeometries(geos.map(g => {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  return n;
}), false);
// geometry with a baked transform
export function at(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    typeof s === 'number' ? V3(s, s, s) : V3(...s));
  return geo.clone().applyMatrix4(m);
}
export function mesh(geo, mat, { cast = true, receive = true, x = 0, y = 0, z = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive; m.position.set(x, y, z);
  return m;
}
// items: [{ p:[x,y,z], r:[rx,ry,rz], s: number|[sx,sy,sz], c: 0xrrggbb }]
const _o = new THREE.Object3D(), _c = new THREE.Color();
export function inst(geo, mat, items, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    _o.position.set(...(it.p || [0, 0, 0])); _o.rotation.set(...(it.r || [0, 0, 0]));
    const s = it.s ?? 1; typeof s === 'number' ? _o.scale.setScalar(s) : _o.scale.set(...s);
    _o.updateMatrix(); im.setMatrixAt(i, _o.matrix);
    if (it.c !== undefined) im.setColorAt(i, _c.set(it.c));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false;
  return im;
}
export function tube(points, radius = 0.1, seg = 64, radial = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => (p.isVector3 ? p : V3(...p))), closed, 'catmullrom', 0.5);
  return { geo: new THREE.TubeGeometry(curve, seg, radius, radial, closed), curve };
}
export function setCam(cam, pos, look, fov = 35, roll = 0) {
  cam.position.set(...pos); cam.up.set(Math.sin(roll), Math.cos(roll), 0); cam.lookAt(...look);
  if (cam.fov !== fov) { cam.fov = fov; }
  cam.updateProjectionMatrix();
  return cam;
}
