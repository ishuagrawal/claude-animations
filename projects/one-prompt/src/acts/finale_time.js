// All finale beats, derived from the narration cues.
import { C, word, SEAM } from '../timeline.js';
import { lerp } from '../core.js';
export const T = {
  in: C.g1 - SEAM, apex: C.g1 + 0.08, land: C.g1 + 0.62, look: C.g1 + 0.92, turn: C.g1 + 1.2, clasp: C.g1 + 1.72, tick: word('g1', 7) - 0.08, sneeze: word('g1', 9) + 0.08,
  four: C.g2, one: word('g2', 2), all: word('g2', 4), g3: C.g3, end: C.end,
};
T.hit = [0, 1, 2, 3].map(i => T.four - 0.62 + i * 0.205);      // four big sparks light the four words
T.fuse = T.one - 0.4; T.line = T.one + 0.06;                   // letters fuse into the line
T.erupt = T.one + 0.38; T.burst = T.one + 0.64;                  // trunk, then crown
// six framed stops, one bough each, held long enough to read; then the whole bloom held for 3 s before anything falls
T.fly = T.all + 0.1; T.A = [0, 1, 2, 3, 4, 5].map(k => T.fly + 0.42 + k * 1.36); T.D = T.A.map(q => q + 1.08); T.F = T.A.slice();
T.flyEnd = T.D[5]; T.wide = T.flyEnd + 0.72; T.fall = T.wide + 3.05;
T.pull = T.fall + 0.12; T.room = T.pull + 1.15;                      // camera backs out through the round window
// in the room: the fix lands on the screen on "bug fix", then on "And you never saw most of it leave" the lanterns lift away
T.fixed = word('g3', 7) - 0.1; T.leave = word('g3', 8) + 0.05; T.type = C.g3e + 0.9;
export const WL = 850, BASE = [960, 846], CORE = [960, 540];
export { C, word, lerp };
