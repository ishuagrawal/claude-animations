// Paths in frame coordinates (origin at the frame center, output pixels, y down).
import { Poly, catmull, resample, svgSubpaths, smoothLevels } from './geom.js';

// The opening brush stroke: a fingertip flourish. Lands lower left, sweeps up and right, loops over the
// top (through the hidden island), crosses its own path and lifts off to the right.
const STROKE_CP = [
  [-476, 232], [-330, 182], [-160, 118], [6, 34], [128, -92], [148, -232], [64, -312], [-58, -310],
  [-168, -244], [-202, -128], [-136, -18], [4, 50], [176, 78], [330, 74], [470, 40],
];
export const strokePoly = () => new Poly(resample(catmull(STROKE_CP, false, 30), 900), false, 2);

export const ISLAND = { x: 0, y: -306, w: 112, h: 34 };

// Apple logo outline (simple-icons, 24-unit viewBox): body starts at the top dip, leaf is separate
const LOGO_D = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
export const LOGO = { h: 300, cx: 70, cy: -38 };
export function logoShapes() {
  const k = LOGO.h / 24;
  const [body, leaf] = svgSubpaths(LOGO_D, 0.03).map(sp => sp.map(([x, y]) => [(x - 12) * k + LOGO.cx, (y - 12) * k + LOGO.cy]));
  const b = resample(body, 760, true), l = resample(leaf, 280, true);
  return { body: b, leaf: l, bodyLevels: smoothLevels(b, true, 3, 8), leafLevels: smoothLevels(l, true, 1.5, 8) };
}
