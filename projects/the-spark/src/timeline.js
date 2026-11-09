// THE cue sheet: every event time in the film, shared by picture (src/shots) and sound (src/audio/score.js).
// 72 BPM at 24 fps: a beat is 20 frames, a bar is 80 frames (3.333 s). Shots never contain literal absolute times.
import { BEAT, BAR } from './core.js';

export const MUSIC = 0.5;                                   // bar 1, beat 1
export const bar = n => MUSIC + (n - 1) * BAR;              // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n

export const PROMPT = 'Write me a poem about a spark.';
export const POEM = ['It woke inside the wall,', 'ran the copper dark,', 'and found me waiting.', 'Every answer starts as a spark.'];
export const TYPE_CPS = 17;

const C = {};
// ---- Act I: the room, the question
C.fadeIn = 0;
C.room = bar(1);                    // dusk room, slow push-in
C.titleIn = beat(1, 3);
C.titleOut = beat(2, 4);
C.screen = bar(3);                  // close on the monitor
C.typeStart = C.screen + 0.5;
C.typeEnd = C.typeStart + PROMPT.length / TYPE_CPS;
C.enter = beat(4, 2);               // Enter: the prompt is sent
C.follow = beat(4, 3);              // down the cord to the wall
C.slotGlow = C.follow + 3.2;        // a glow answers inside the outlet
// ---- Act II: the spark
C.outlet = bar(6);                  // inside the outlet, dark
C.arc1 = C.outlet + 0.9;            // first crackles between contact and prong
C.arc2 = C.outlet + 1.6;
C.born = beat(6, 4);                // the arcs gather into a body
C.eyesOpen = C.born + 0.9;
C.lookAround = C.eyesOpen + 0.7;
C.notice = bar(8) - 0.6;            // sees the way in
C.hop = bar(8);
C.dive = beat(8, 2) + 0.3;          // dives into the prong
C.xray = beat(8, 3);                // the cord on the floor, glow racing inside
C.tunnel = beat(9, 3);              // inside the copper
C.tunnelLoop = C.tunnel + 2.4;      // a joyful barrel roll
C.psu = bar(11);                    // the power supply cavern
C.coilIn = C.psu + 1.5;             // caught by the transformer
C.coilOut = bar(12) + 1.4;          // flung out along the rail
C.vista = bar(13);                  // THE reveal: the motherboard at golden hour
C.run = bar(15);                    // running the gold trace
C.leap = C.run + 3.2;               // leap to the socket
// ---- Act III: Claude
C.chip = beat(16, 3);               // inside the processor: dark, someone sleeping
C.two = bar(18);                    // close two-shot
C.reach = C.two + 1.6;              // hesitant reach
C.touch = bar(19);                  // touch: silence, then warmth
C.wake = C.touch + 1.1;             // eyes open
C.greet = C.wake + 1.5;             // they see each other
C.words = bar(20);                  // the prompt drifts down
C.wordsLand = C.words + 2.8;
C.idea = C.words + 4.2;             // Claude looks at the spark: that's the poem
C.gather = C.idea + 1.0;
C.release = bar(22);                // the flock of tokens lifts
C.ascend = beat(22, 3);             // wide: rising through the chip
C.white = bar(24) - 0.5;            // into the light of the screen
C.reply = bar(24);                  // the answer arrives
C.line = POEM.map((_, i) => C.reply + 0.7 + i * 1.5);
C.cursor = C.line[3] + 1.9;         // the cursor blinks: it has eyes
C.home = beat(26, 3);               // the room again, warmer
C.fadeOut = bar(28);
C.end = bar(28) + 2.4;
export { C };
