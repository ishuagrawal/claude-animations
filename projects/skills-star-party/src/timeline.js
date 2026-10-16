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
  // ACT 1 — Claude Code: Claude uses the skill on a video it loves (bars 1–3)
  card: 0.15,                    // the Claude Code card springs in
  hop: 0.4, land: 0.8,           // Claude drops onto the card's top edge
  type: 1.0, typeEnd: 1.9,       // types /video-by-reference
  attach: 2.1,                   // reference.mp4 attached
  stomp: 2.3, enter: beat(2, 2), // 2.5  Claude hops and stomps: enter
  tile: 2.6,                     // the reference springs out of the attachment, playing
  scan: beat(2, 3),              // 3.0  a scan studies it: the ball tracked, the frame sampled
  scanEnd: beat(2, 3) + 0.7,
  chips: beat(2, 4) - 0.05,      // 3.45 the style lifts out into the card: palette, motion, sound
  learned: beat(3, 2),           // 4.5  style learned
  make: beat(3, 3),              // 5.0  Claude hops: the style flies out and builds a new world
  wipe: beat(3, 3) + 0.1,        // 5.1  the sky (blue)
  sun: beat(3, 3) + 0.26,        // the sun (yellow)
  hills: beat(3, 3) + 0.32,      // the hills rise (mint)
  flowers: beat(3, 3) + 0.46,    // flowers along the crest (coral)
  dock: beat(3, 3) + 0.14, dockEnd: beat(3, 4) + 0.26,  // the card docks into a pill, Claude riding it
  // ACT 2 — the short Claude made: the same style, a new story (bars 3–6)
  mark: beat(3, 4) + 0.12,       // 5.62 the Invertocat pops out of the motion chip
  squash: beat(4, 1) + 0.2,
  invert: beat(4, 2),            // 6.5  colours invert outward: the cut-out cat turns solid
  invertEnd: beat(4, 2) + 0.36,
  pop: beat(4, 2) + 0.34,        // 6.84 the silhouette pops into the official Octocat
  puddle: beat(4, 2) + 0.3,
  legs: beat(4, 2) + 0.4,
  face: beat(4, 2) + 0.4,
  tail: beat(4, 2) + 0.48,
  eyes: beat(4, 2) + 0.48,
  whiskers: beat(4, 2) + 0.62,
  suckers: beat(4, 2) + 0.65,
  alive: beat(4, 4) - 0.05,      // 7.45 a blink
  header: beat(4, 4),            // 7.5  the repo card with its Star button (STARS − 1)
  starIn: bar(5),                // 8.0  a star slips out of the sun and drifts down
  catch: beat(5, 3),             // 9.0  caught on the tail tip
  windup: beat(5, 3) + 0.22,
  flick: beat(5, 4) - 0.05,      // 9.45 flicked up over the head…
  hit: bar(6),                   // 10.0 …into the Star button: Starred, STARS; the pill's job is done
  // ACT 3 — thank you (bars 6–8)
  credit: beat(6, 2) + 0.1,      // 10.6 the pill reads "Made with /video-by-reference"
  thank: bar(7),                 // 12.0 "Thank you for STARS stars": confetti cannons, a jump together
  wave: beat(7, 2) + 0.1,        // 12.6 both wave to the viewer; hearts float up
  fadeOut: 14.45,
  end: bar(8) + 1,               // 15.0
};
