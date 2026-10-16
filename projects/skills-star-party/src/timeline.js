// THE cue sheet: every event time in the film, shared by picture (film.js) and sound (audio/score.js).
import { BEAT, BAR } from './core.js';

// What's being celebrated (github.com/ishuagrawal/skills, read when rendered).
export const STARS = 70;
export const OWNER = 'ishuagrawal', REPO = 'skills', SKILL = 'video-by-reference';

// 120 BPM → 2 s bars, 30 frames per beat at 60 fps. Music starts on frame 0.
export const bar = n => (n - 1) * BAR;                 // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;

export const C = {
  // the logo
  mark: 0.1,                     // the Invertocat pops in
  squash: beat(1, 2) + 0.25,     // 0.75 anticipation
  invert: beat(1, 3),            // 1.0  colours invert outward from the centre: the cat's cut-out turns solid
  invertEnd: beat(1, 3) + 0.36,
  pop: beat(1, 3) + 0.34,        // 1.34 the silhouette pops into the Octocat
  // the Octocat assembles (staggered on 16ths)
  legs: beat(1, 3) + 0.4,
  face: beat(1, 3) + 0.4,
  tail: beat(1, 3) + 0.48,
  eyes: beat(1, 4) - 0.02,       // 1.48
  whiskers: beat(1, 4) + 0.12,
  suckers: beat(1, 4) + 0.15,
  puddle: beat(1, 3) + 0.3,      // the logo's ring falls and flattens into the puddle
  alive: bar(2),                 // 2.0 eyes blink open, the groove starts
  drip: bar(2) + 0.15,           // a drop forms on the tail tip
  // Claude joins
  slide: beat(2, 1) + 0.25,      // 2.25 the Octocat steps right
  jump: beat(2, 2) - 0.1,        // 2.4  Claude leaps in from the left
  land: beat(2, 2) + 0.42,       // 2.92
  // the count
  count: beat(2, 3),             // 3.0  the star + number appear and count up
  hit: bar(3),                   // 4.0  STARS lands: burst, confetti, high five
  repo: bar(3) + 0.35,           // repo name
  skill: bar(3) + 0.6,           // video-by-reference
  wave: beat(4, 1),              // 6.0 the two wave
  fadeOut: 7.55,
  end: 8.0,
};
