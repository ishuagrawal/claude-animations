// THE cue sheet: every event time in the film, shared by picture (src/shots) and sound
// (src/audio/score.js). Shots must not contain literal absolute times — derive them here so
// re-pacing the film is a one-file change.
import { BEAT, BAR } from './core.js';

// Music anchor: the distilled drop lands in the K3.1 flask on the downbeat of bar 1.
export const MUSIC = 90 / 24;                               // 3.75 s (frame 90)
export const bar = n => MUSIC + (n - 1) * BAR;             // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n
export const bt = k => MUSIC + k * BEAT;                    // k beats after the drop

export const C = {
  // cold open — the still (no music; room tone, bubbling, one drip)
  open: 0,
  neck: 1.25,          // tilt up the swan neck: orange motes go in, blue comes out
  spout: 2.5,          // ECU spout: the blue drop swells
  fall: 80 / 24,        // the drop lets go (dead air)
  drop: MUSIC,         // splash in the K3.1 flask = the beat drop

  // act 1 — arrivals
  kimiPop: MUSIC,      // flask erupts, arena lights slam on, Kimi bounces out (square eyes!)
  kimiCU: bt(4),       // close-up: blink, the square eyes turn into Kimi's own pills
  kimiBlink: bt(5),
  kimiName: bt(6),
  claudePop: bt(10),   // Claude bursts out of the boiling flask
  claudeLand: bt(11.5),
  claudeName: bt(12),
  gpt: bt(15),         // ringside: GPT-6 Astra and GPT-6.1 Sol — their spotlight dies
  gptDim: bt(18),
  vs: bt(21),          // split-screen VS card
  fight: bt(25),       // "FIGHT!"

  // act 2 — the fight
  charge: bt(26),      // Claude charges, punches; Kimi bounces over it
  punch: bt(28),
  headbutt: bt(30),    // Kimi ricochets into Claude
  impact: bt(32),      // impact frame + PERFECT!!
  special: bt(34),     // Claude's special-move poster
  copy: bt(38),        // Kimi strikes the same pose: MOVE COPIED
  clash: bt(42),       // beams meet, dead even
  blowAway: bt(45.5),  // the GPTs pop up and get blown away
  boom: bt(47),        // explosion → flash

  // act 3 — decision
  draw: bt(48),        // top-down, both flat: DRAW
  tiebreak: bt(52),    // TIEBREAKER: PRICE
  tags: bt(53.5),      // price tags drop
  win: bt(57),         // KIMI WINS
  launch: bt(60),      // moonshot
  liftoff: bt(60.75),
  moon: bt(62),        // space: Kimi lands on the moon
  title: bt(63),       // KIMI K3.1 PRO — LAUNCHED
  button: bt(68),    // Claude alone under the still; one more drop
  plink: bt(70),
  end: bt(72.25),
};
