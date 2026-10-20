// THE cue sheet: every event time in the film, shared by picture (src/shots) and sound (src/audio/score.js).
// 90 BPM at 24 fps = 16 frames per beat; one bar = 2.667 s. Shots never contain literal absolute times.
import { BEAT, BAR } from './core.js';

export const MUSIC = 0.25;
export const bar = n => MUSIC + (n - 1) * BAR;             // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n (fractional b = off-beats)

export const STAR_FROM = 66; // the counter climbs 66 → 70 in the opening

export const C = {
  // A · the 70th star (gold)
  barDrops: [1, 1.5, 2, 2.5, 3, 3.5].map(b => beat(1, b)), // one ink bar per letter, on 8ths
  morph: bar(2),             // bars become the wordmark
  pill: beat(2, 3),          // star button pops in
  taps: [bar(3), beat(3, 2), beat(3, 3)], // 67, 68, 69 (three different hands)
  hush: beat(3, 4),          // one beat of silence; the big finger winds up
  seventy: bar(4),           // THE tap: 70, Claude boings up as the dot of the i
  // B · the party, by reference
  collapse: bar(5),          // wordmark collapses into bars → the stage floor
  land: beat(5, 2),          // Claude lands on the floor
  tileIn: beat(5, 2),        // a reference video tile lowers on a string
  tileHang: beat(5, 4),
  bump: bar(6),              // Claude hops and bumps the tile: it plays
  chips: [2, 2.5, 3, 3.5].map(b => beat(6, b)), // palette chips LAND (they leave the tile 0.42 s earlier)
  flood: beat(6, 2),         // first chip floods the wall with look 1
  builds: { lamp: beat(6, 2.5), frame: beat(6, 2.5) + 0.08, bunting: beat(6, 2.5) + 0.16, table: beat(6, 3), cake: beat(6, 3) + 0.2,
    gifts: beat(6, 3.5), balloons: beat(6, 3.5) + 0.12, candles: beat(6, 4), flames: beat(6, 4.5) },
  looks: [beat(6, 2), beat(7, 3), bar(8), beat(8, 3)], // soft → pixel → ink → neon (flick + reveal on each)
  pullback: bar(9),          // camera pulls back: the party is a video in a card
  card: beat(9, 2.5),        // card settled; caption `/skills:video-by-reference` readable
  // C/D · toss + tunnel
  toss: beat(10, 3),
  land2: bar(11),            // gift box lands (top-down)
  lid: beat(11, 2),          // lid pops → square morphs into the cake
  candle: beat(11, 3),       // a finger sets the last candle; flames pop on 16ths
  party: bar(12),            // cut: side view of the party (blue)
  cannons: beat(12, 3),      // confetti cannons; Claude jumps
  freeze: bar(13),           // FREEZE at the apex: shutter, tape stop
  // G · the still → canvas → thank-you
  shrink: bar(13) + 0.12,
  grab: beat(13, 2) - 0.05,
  flip: beat(13, 2.5),
  type: beat(13, 4),         // stretcher bars fly into the end type
  typeDone: bar(14),
  dab: bar(14) + 3.0,        // a single coral dab on the corner canvas (the tease)
  fade: bar(14) + 3.9,
  end: bar(14) + 4.35,
};
