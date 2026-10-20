// Every path in the film, in its local plane. Lid-plane paths use display coordinates (origin at the
// display center, y down); the base path uses (x, depth-from-hinge).
import { catmull, resample, roundRect, svgSubpaths, Poly, smoothLevels } from './geom.js';
import { DISP, BASE } from './cam.js';

export const NPATH = 900;

// The finger's loose lasso: starts at the top-center seam and runs clockwise, bigger and looser than
// the display it becomes (wobbly bottom, leaning sides).
const LASSO_CP = [
  [0, -256], [140, -276], [290, -262], [392, -214], [428, -96], [418, 40], [404, 168], [356, 262],
  [236, 284], [120, 266], [8, 292], [-118, 276], [-246, 296], [-370, 258], [-420, 150], [-432, 10],
  [-414, -128], [-366, -232], [-236, -272], [-110, -262],
];
export function lassoPts() {
  const raw = catmull(LASSO_CP, true, 30);
  const a = -0.035, c = Math.cos(a), s = Math.sin(a);
  return resample(raw.map(([x, y]) => [x * c - y * s, x * s + y * c]), NPATH, true);
}
export const rectPts = () => roundRect(DISP.w, DISP.h, DISP.r, NPATH);
export const pillPts = (w = 66, h = 20) => roundRect(w, h, h / 2, 220);

export const morph = (A, B, m) => A.map((p, i) => [p[0] + (B[i][0] - p[0]) * m, p[1] + (B[i][1] - p[1]) * m]);

// Apple logo outline (simple-icons, 24-unit viewBox): body starts at the top dip, leaf is separate
const LOGO_D = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
export const LOGO = { h: 236, cy: -8 };
export function logoPolys() {
  const k = LOGO.h / 24;
  const [body, leaf] = svgSubpaths(LOGO_D, 0.03).map(sp => sp.map(([x, y]) => [(x - 12) * k, (y - 12) * k + LOGO.cy]));
  const BL = smoothLevels(resample(body, 700, true), true, 3.6, 13), B = BL[0];
  // leaf: start at its top tip so the flick sweeps down and around
  let li = 0; leaf.forEach((p, i) => { if (p[1] < leaf[li][1]) li = i; });
  const LL = smoothLevels(resample([...leaf.slice(li), ...leaf.slice(0, li)], 260, true), true, 1.6, 10), L = LL[0];
  // the bottom dip between the two lower lobes: where the two pouring heads meet
  let bi = 0, best = 1e9;
  for (let i = 0; i < B.n; i++) if (Math.abs(B.x[i]) < 1.2 * k && B.y[i] > LOGO.cy + 4 * k && B.y[i] < best) { best = B.y[i]; bi = i; }
  return { body: B, leaf: L, bodyLevels: BL, leafLevels: LL, sBottom: B.s[bi], top: [B.x[0], B.y[0]] };
}

// base: back-left corner, down the left side, across the front (with the thumb scoop), back up the right
export function basePts() {
  const hw = BASE.w / 2, d = BASE.d, r = 46, sc = 70;
  const pts = [[-hw, 6]];
  for (let k = 0; k <= 16; k++) { const a = Math.PI - (k / 16) * Math.PI / 2; pts.push([-hw + r + r * Math.cos(a), d - r + r * Math.sin(a)]); }
  for (let x = -sc * 1.6; x <= sc * 1.6; x += 8) { const q = x / sc; pts.push([x, d - 9 * Math.exp(-q * q * 2.2)]); }
  for (let k = 0; k <= 16; k++) { const a = Math.PI / 2 - (k / 16) * Math.PI / 2; pts.push([hw - r + r * Math.cos(a), d - r + r * Math.sin(a)]); }
  pts.push([hw, 6]);
  return resample(pts, 700, false);
}
export const frontPts = () => {
  const hw = BASE.w / 2 - 30;
  return resample([[-hw, BASE.d], [hw, BASE.d]], 200, false);
};
export const hingePts = () => resample([[-DISP.w / 2 - 6, 0], [DISP.w / 2 + 6, 0]], 300, false);
