// Layout of the milestone page. The page is a scrolling site inside a floating window ("panel")
// on the gradient stage. Page coords: origin at the panel's top-left at scroll 0. The rest frame is
// the 1920×1080 frame with the camera at rest; the camera (film.js) then pushes/pans over it.
import { C } from './timeline.js';
import { key, ease } from './core.js';

export const PANEL = { x: 180, y: 100, w: 1560, h: 880, r: 22 };
export const NAV_H = 62;
export const SEC = { hero: 0, feature: 880, stats: 1760, cta: 2640 };

// scroll position (page px) over time: product-video scrolls are quick quint ease-in-outs
const quint = t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
export const scrollAt = t => key(t, [
  [0, 0], [C.scroll1, 0], [C.scroll1 + 0.85, SEC.feature, quint],
  [C.scroll2, SEC.feature], [C.scroll2 + 0.85, SEC.stats, quint],
  [C.scroll3, SEC.stats], [C.scroll3 + 0.85, SEC.cta, quint],
]);
export const toRest = (px, py, t) => [PANEL.x + px, PANEL.y + py - scrollAt(t)];

// ---- hero
export const HERO = {
  x: 132, pillY: 262, h1: [378, 478], h1Size: 100, subY: [548, 582], btnY: 640, btnH: 58, socialY: 772,
  octo: { x: 1150, y: 418, s: 112 },
};
export const STAR_BTN = { x: HERO.x, y: HERO.btnY, w: 206, h: HERO.btnH };
export const GET_BTN = { x: HERO.x + 206 + 16, y: HERO.btnY, w: 220, h: HERO.btnH };

// ---- feature (relative to SEC.feature)
export const FEAT = {
  x: 110,
  term: { x: 640, y: 92, w: 600, h: 372 },
  bible: { x: 1182, y: 66, w: 322, h: 312 },
  player: { x: 744, y: 432, w: 486, h: 356 },
  pipe: { x: 1214, y: 404, w: 290, h: 262 },
};
export const TERM_INPUT = { x: FEAT.term.x + 58, y: FEAT.term.y + 151 }; // typed text start (baseline-left)

// ---- stats (relative to SEC.stats)
export const STATS = {
  grid: { x: 156, y: 296, w: 676, h: 556 },
  cell: 52, gap: 9,
  cards: { x: 868, y: 296, w: 262, h: 270, gap: 16 },
};
export const cellRect = i => {
  const c = i % 10, r = Math.floor(i / 10);
  const gx = STATS.grid.x + (STATS.grid.w - (10 * STATS.cell + 9 * STATS.gap)) / 2;
  return { x: gx + c * (STATS.cell + STATS.gap), y: STATS.grid.y + 92 + r * (STATS.cell + STATS.gap), w: STATS.cell, h: STATS.cell };
};

// ---- CTA (relative to SEC.cta)
export const CTA = {
  cx: PANEL.w / 2, pillY: 136, h2: 230, sub: 284,
  cmd: { x: 330, y: 476, w: 900, h: 186 },
  btnY: 718,
};
export const COPY_BTN = { x: CTA.cmd.x + CTA.cmd.w - 128, y: CTA.cmd.y + 54, w: 104, h: 40 };

export { ease };

// pipeline card rows (feature section coords): toggle i
export const pipeRow = i => ({ y: FEAT.pipe.y + 82 + i * 44, tx: FEAT.pipe.x + FEAT.pipe.w - 66 });
