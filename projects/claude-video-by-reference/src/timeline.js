// THE cue sheet: every event time in the film, shared by picture (src/shots) and sound
// (src/audio/score.js). Shots never contain literal absolute times. 120 BPM at 30 fps:
// beat = 0.5 s = 15 frames, bar = 2 s. Chapter changes sit on bar lines.
import { BEAT, BAR } from './core.js';

export const MUSIC = 0;
export const bar = n => MUSIC + (n - 1) * BAR;             // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n

const H = 0; // hook
export const C = {
  // ---- HOOK: a video you love → "make me one like this!" → meet the skill
  phoneIn: H + 0.1,
  capLove: beat(1, 2),            // "Love how a video looks?"
  hearts: beat(1, 4),
  claudeHop: beat(2, 1) + 0.2,    // Claude leaps in from the right
  claudeLand: beat(2, 3),
  capLoveOut: beat(2, 4) + 0.25,
  share: beat(3, 1),              // thumb taps share
  bubbleOut: beat(3, 1) + 0.25,   // chat bubble + video card leave the phone
  bubbleLand: beat(3, 3),         // ...and land in Claude's hands
  nod: beat(3, 4),
  title: beat(4, 1) + 0.15,       // "Meet /video-by-reference"
  zoom1: beat(5, 1) + 0.3,        // zoom into the card (→ STUDY)
  study: bar(5) + 0.5 + 0.5,      // = 9.0

  // ---- STUDY
  badge1: 9.3, cap1: 9.4, cap1Out: 14.5,
  scan: 9.8,
  colors: 10.5,                   // swatches drip out
  timing: 12.0,                   // scissors mark a cut
  music: beat(7, 3) + 0.5,        // 13.5 waveform + bpm
  bookIn: 14.5, chipsFly: 15.0, bookClose: 15.5,
  cap1b: 15.0,
  splash1: 16.6,                  // mid ≈ 17.0 (→ IMAGINE)
  imagine: 17.0,

  // ---- IMAGINE
  badge2: 17.2, cap2a: 17.3,
  frameDrop: 17.55,
  shake: [beat(10, 2), beat(10, 3), beat(10, 4)], // 18.5 19.0 19.5
  catLift: 20.0,
  cap2b: 20.4,
  catAway: 21.0,
  bulb: beat(11, 4),              // 21.5
  cards: [beat(12, 1) + 0.0, beat(12, 2), beat(12, 3)], // 22.0 22.5 23.0
  zoom2: 24.1,
  animate: 25.0,

  // ---- ANIMATE
  badge3: 25.2, cap3a: 25.3, cap3aOut: 30.2,
  code: 25.4,
  lines: 25.8,
  fill: 28.5,
  alive: 29.5,
  grid: 30.0,
  cap3b: 30.6,
  loupe: 31.0,
  flaw: 31.5,
  fix: 32.0,
  checks: beat(17, 2),            // 32.5
  splash3: 33.1,
  score: 33.5,

  // ---- SCORE
  badge4: 33.7, cap4: 33.8,
  notes0: bar(18),                // 34.0 notes pop on every beat
  sfxIcons: 35.5,
  rollUp: 37.5,
  mp4: 38.0,
  deliver: 39.0,

  // ---- DELIVER
  phone2: 39.0, mp4In: 39.5, play: 40.0,
  capSame: 40.5,
  hearts2: 42.0,
  proud: 41.95,
  zoom3: 44.2,
  styles: 45.0,

  // ---- ANY STYLE
  capAny: 45.2,
  style: [45.5, 46.5, 47.5, 48.5, 49.5],
  splash4: 50.6,
  tips: 51.0,

  // ---- TIPS
  capTips: 51.2,
  tip: [52.0, 53.0, 54.0],
  collapse: 56.4,
  end: 57.0,

  // ---- END CARD
  pill: 57.0, hopOn: 57.5, tagline: 58.0, ps: 59.0, wink: 60.0,
  fin: 61.5,
};

// Melody written onto the staff in ④ — the score plays exactly these notes (time, MIDI).
// A bright G-major hook, one slot per eighth note (0.25 s), null = rest.
export const STAFF_MELODY = (() => {
  const m = [79, 76, 79, 83, null, 81, 79, 76, 74, 76, 79, null, 81, 83, 86];
  const out = [];
  m.forEach((n, i) => { if (n !== null) out.push([C.notes0 + i * BEAT / 2, n]); });
  return out;
})();
export const SFX_MARKS = [
  { t: C.sfxIcons, kind: 'whoosh' },
  { t: C.sfxIcons + 0.5, kind: 'pop' },
  { t: C.sfxIcons + 1.0, kind: 'ding' },
];
