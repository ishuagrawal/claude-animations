// THE cue sheet: every event time in the film, shared by picture (src/sections) and sound
// (src/audio/score.js). Sections must not contain literal absolute times — derive them here so
// re-pacing the film is a one-file change.
import { BEAT, BAR } from './core.js';

// What's being celebrated (github.com/ishuagrawal/skills, read when rendered).
export const STARS = 70;
export const FORKS = 10;
export const OWNER = 'ishuagrawal', REPO = 'skills', SKILL = 'video-by-reference';
export const INSTALL = '/plugin marketplace add ishuagrawal/skills';
export const RUN = '/skills:video-by-reference';

// 120 BPM → 2 s bars, 30 frames per beat at 60 fps. Music starts on frame 0.
export const MUSIC = 0;
export const bar = n => MUSIC + (n - 1) * BAR;             // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n

export const C = {
  // ---- INTRO (bars 1–2): click the GitHub app; its mascot comes alive; the app window opens
  icon: 0.12,                      // app icon springs in on the gradient stage
  cursorIn: 0.4,                   // cursor glides in
  click: beat(1, 3),               // 1.0  click the icon → the mark's cut-out lights up with the model
  dissolve: beat(1, 4),            // 1.5  the white mark dissolves outward, tentacles unfurl
  alive: beat(2, 1),               // 2.0  eyes open; the icon starts opening into the window
  open: beat(2, 1) + 0.05,
  openEnd: beat(2, 2) + 0.45,      // 2.95 window fully open
  // ---- HERO: the milestone page; the cursor stars the repo (STARS-1 → STARS)
  nav: beat(2, 2) + 0.1,           // 2.6
  pill: beat(2, 3) - 0.2,          // 2.8
  h1: beat(2, 3) - 0.1,            // 2.9
  sub: beat(2, 3) + 0.15,          // 3.15
  btns: beat(2, 3) + 0.3,          // 3.3
  chips: beat(2, 4),               // 3.5
  toStar: beat(3, 1) - 0.1,        // 3.9  cursor heads for the Star button
  star: beat(3, 3),                // 5.0  click: Starred, counters roll to STARS
  push1: beat(3, 3) + 0.4,         // 5.4  camera pushes in on the headline
  scroll1: beat(4, 3) + 0.2,       // 7.2  scroll to the skill
  // ---- FEATURE: video-by-reference (bars 5–8)
  feat: beat(5, 1) - 0.1,          // 7.9  section content staggers in
  cards: beat(5, 1) + 0.1,         // 8.1  layered UI cards spring in
  push2: beat(5, 3),               // 9.0  push in on the terminal
  toTerm: beat(5, 3) + 0.2,        // 9.2  cursor into the terminal
  type: beat(6, 1),                // 10.0 typing the slash command
  enter: beat(6, 4),               // 11.5 enter
  out1: beat(7, 1),                // 12.0 terminal output lines (one per beat) flip the pipeline toggles
  out2: beat(7, 2),
  out3: beat(7, 3),
  out4: beat(7, 4),                // 13.5 rendering starts → progress bar, preview plays
  doneRender: beat(8, 3) + 0.25,   // 15.25 render complete
  scroll2: beat(8, 3) + 0.4,       // 15.4 scroll to the stargazers
  // ---- STATS: one cell per star (bars 9–10)
  stats: beat(9, 1) + 0.1,         // 16.1
  grid0: beat(9, 2),               // 16.5 cells start lighting
  grid1: beat(10, 1) + 0.2,        // 18.2 the newest (last) cell
  tip: beat(10, 2) + 0.1,          // 18.6 tooltip on the newest star
  scroll3: beat(10, 3) + 0.3,      // 19.3 scroll to the thank-you
  // ---- CTA: thank you + install (bars 11–13)
  cta: beat(11, 1),                // 20.0
  mascots: beat(11, 1) + 0.25,     // 20.25 Octocat + Claude pop up
  typeCmd: beat(11, 2) + 0.1,      // 20.6 command types in
  copy: beat(12, 1),               // 22.0 click Copy → Copied, confetti
  pullOut: beat(12, 3) + 0.3,      // 23.3 camera pulls out to the whole window
  caption: beat(13, 1) - 0.2,      // 23.8 repo URL on the stage
  fadeOut: beat(13, 3) + 0.2,      // 25.2
  end: bar(14),                    // 26.0
};

// Stargazer cells light in a diagonal wave between grid0 and grid1 (shared by picture + sound).
export const GRID = { cols: 10, rows: 7 };
export const cellTime = i => {
  const c = i % GRID.cols, r = Math.floor(i / GRID.cols);
  const u = (c + r * 1.4) / (GRID.cols - 1 + (GRID.rows - 1) * 1.4);
  return i === STARS - 1 ? C.grid1 : C.grid0 + u * (C.grid1 - C.grid0 - 0.35);
};
