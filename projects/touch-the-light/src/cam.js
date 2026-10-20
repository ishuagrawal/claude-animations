// Perspective camera (world y points down, camera looks along +z at yaw = pitch = 0) and the laptop's
// local planes: the lid (display coordinates, hinged at its bottom edge) and the base's top surface.
import { W, H, SS } from './core.js';

export const DISP = { w: 760, h: 494, r: 30 };      // display area, centered on the lid origin
export const HINGE_Y = DISP.h / 2 + 24;             // hinge axis (bottom bezel below the display)
export const BASE = { w: 812, d: 560, drop: 9, thick: 15 };

export function camera({ tx = 0, ty = 0, tz = 0, yaw = 0, pitch = 0, dist = 1500, zoom = 1, ox = 0, oy = 0 }) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const f = [sy * cp, sp, cy * cp], r = [cy, 0, -sy];
  const d = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const px = tx - f[0] * dist, py = ty - f[1] * dist, pz = tz - f[2] * dist;
  const F = 1425 * zoom * (dist / 1500);
  // world -> canvas pixels (supersampled); returns [x, y, depth]
  const project = (X, Y, Z) => {
    const ax = X - px, ay = Y - py, az = Z - pz;
    const zc = Math.max(1, ax * f[0] + ay * f[1] + az * f[2]);
    const xc = ax * r[0] + ay * r[1] + az * r[2], yc = ax * d[0] + ay * d[1] + az * d[2];
    return [(W / 2 + ox + F * xc / zc) * SS, (H / 2 + oy + F * yc / zc) * SS, zc];
  };
  // world units -> output px at a world point (for sizing sprites)
  const scaleAt = (X, Y, Z) => {
    const ax = X - px, ay = Y - py, az = Z - pz;
    return F / Math.max(1, ax * f[0] + ay * f[1] + az * f[2]);
  };
  return { project, scaleAt };
}

// lid local (x, y) -> world; theta = 0 upright facing the camera, > 0 tips toward the camera (closing)
export const lidMap = (cam, theta) => {
  const c = Math.cos(theta), s = Math.sin(theta);
  return (x, y) => { const v = HINGE_Y - y; return cam.project(x, HINGE_Y - v * c, -v * s); };
};
export const lidWorld = (theta) => {
  const c = Math.cos(theta), s = Math.sin(theta);
  return (x, y) => { const v = HINGE_Y - y; return [x, HINGE_Y - v * c, -v * s]; };
};
// base top surface local (x, d): d = distance from the hinge toward the front edge
export const baseMap = (cam, dy = BASE.drop) => (x, d) => cam.project(x, HINGE_Y + dy, -d);
