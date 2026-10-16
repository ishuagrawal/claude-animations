// THE cue sheet: every event time in the film, shared by picture (film.js, ui.js, short.js) and
// sound (audio/score.js).
import { BEAT, BAR } from './core.js';

// What's being celebrated (github.com/ishuagrawal/skills, read when rendered).
export const STARS = 70;
export const OWNER = 'ishuagrawal', REPO = 'skills', SKILL = 'video-by-reference';

// 120 BPM → 2 s bars, 30 frames per beat at 60 fps. Music starts on frame 0.
export const bar = n => (n - 1) * BAR;                 // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;

export const C = {
  // ACT 1 — Claude Code: Claude uses the skill on a video you love
  card: 0.1,                     // the Claude Code card springs in
  hop: 0.26, land: 0.62,         // Claude drops onto the card's top edge
  type: 0.72, typeEnd: 1.24,     // types /video-by-reference
  attach: 1.3,                   // reference.mp4 attached
  stomp: 1.32, enter: beat(1, 4),// 1.5  Claude hops and stomps: enter
  tile: 1.58,                    // the reference springs out of the attachment, playing
  scan: bar(2),                  // 2.0  a scan studies it: the ball tracked, the frame sampled
  scanEnd: bar(2) + 0.5,
  chips: beat(2, 2) - 0.2,       // 2.3  the style lifts out into the card: palette, motion, sound
  learned: beat(2, 2) + 0.28,    // 2.78 style learned
  make: beat(2, 3),              // 3.0  Claude hops: the style flies out and builds a new world
  wipe: beat(2, 3) + 0.1,        // 3.1  the sky (blue)
  sun: beat(2, 3) + 0.24,        // 3.24 the sun (yellow)
  hills: beat(2, 3) + 0.28,      // 3.28 the hills rise (mint)
  flowers: beat(2, 3) + 0.42,    // 3.42 flowers along the crest (coral)
  dock: beat(2, 3) + 0.12, dockEnd: beat(2, 4) + 0.2,  // the card docks into a pill, Claude riding it
  // ACT 2 — the short Claude made: the same style, a new story
  mark: beat(2, 4) + 0.12,       // 3.62 the Invertocat pops out of the motion chip
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
  hit: bar(5),                   // 8.0  …into the Star button: Starred, STARS; the pill's job is done
  // ACT 3 — the wrap
  credit: beat(5, 4) + 0.1,      // 9.6  the pill reads "Made with /video-by-reference"
  wrap: beat(6, 2),              // 10.5 Claude and the Octocat wave; confetti from the pill
  jump: beat(7, 1) - 0.5,        // 11.5 a jump together
  fadeOut: 13.45,
  end: bar(8),                   // 14.0
};
