// THE cue sheet: every event time in the film, shared by picture (film.js, studio.js, short.js) and
// sound (audio/score.js).
import { BEAT, BAR } from './core.js';

// What's being celebrated (github.com/ishuagrawal/skills, read when rendered).
export const STARS = 70;
export const OWNER = 'ishuagrawal', REPO = 'skills', SKILL = 'video-by-reference';

// 120 BPM → 2 s bars, 30 frames per beat at 60 fps. Music starts on frame 0.
export const bar = n => (n - 1) * BAR;                 // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;

export const C = {
  // ACT 1 — the studio: Claude studies a video you love
  card: 0.12,                    // the reference video springs in, already playing
  hop: 0.3, land: 0.82,          // Claude hops in with a clapperboard
  slate: beat(1, 3),             // 1.0  the slate turns to camera: "video-by-reference"
  scan: bar(2),                  // 2.0  a scan sweeps the reference
  frames: bar(2) + 0.08,         // its frames peel off into a filmstrip
  chips: beat(2, 2) + 0.05,      // 2.55 the style lifts out: palette, motion, sound
  absorb: beat(2, 3) - 0.1,      // 2.9  …and flies into Claude
  raise: beat(2, 3) + 0.25,      // 3.25 the clapperboard goes up
  clap: beat(2, 4),              // 3.5  CLAP — action
  zoomIn: beat(2, 4) + 0.05, zoomInEnd: bar(3) + 0.25,
  // ACT 2 — the short Claude made: the same style, a new story
  mark: beat(2, 4) + 0.12,       // 3.62 the Invertocat drops into the scene
  squash: beat(3, 1) + 0.2,
  invert: beat(3, 2),            // 4.5  colours invert outward: the cut-out cat turns solid
  invertEnd: beat(3, 2) + 0.36,
  pop: beat(3, 2) + 0.34,        // 4.84 the silhouette pops into the official Octocat
  puddle: beat(3, 2) + 0.3,
  legs: beat(3, 2) + 0.4,
  face: beat(3, 2) + 0.4,
  tail: beat(3, 2) + 0.48,
  eyes: beat(3, 2) + 0.48,
  whiskers: beat(3, 2) + 0.62,
  suckers: beat(3, 2) + 0.65,
  alive: beat(3, 4) - 0.05,      // 5.45 a blink
  header: beat(3, 4),            // 5.5  the repo card with its Star button (STARS − 1)
  starIn: bar(4),                // 6.0  a star slips out of the sun and drifts down
  catch: beat(4, 3),             // 7.0  caught on the tail tip
  windup: beat(4, 3) + 0.22,
  flick: beat(4, 4) - 0.05,      // 7.45 flicked up over the head…
  hit: bar(5),                   // 8.0  …into the Star button: Starred, STARS
  // ACT 3 — the wrap
  zoomOut: beat(5, 4) + 0.1, zoomOutEnd: bar(6) + 0.3,
  wrap: beat(6, 2),              // 10.5 "that's a wrap" clap
  lockup: beat(6, 2) + 0.3,
  fadeOut: 13.45,
  end: bar(8),                   // 14.0
};
