// THE cue sheet: every event time in the film, shared by picture (src/shots) and sound
// (src/audio/score.js). Shots never contain literal absolute times.
// 144 BPM at 24 fps → 10 frames per beat, 40 per bar. Cuts land on bars/beats like the reference.
import { BEAT, BAR } from './core.js';

export const MUSIC = 0.25;
export const bar = n => MUSIC + (n - 1) * BAR;             // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT;  // beat b of bar n (b may be fractional)

export const C = {
  // ---- Act I: the world, the hero, the dream
  cosmos: 0,                 // starfield → constellation graph → dive to the planet
  comet: beat(1, 3),         // a glowing prompt-token comet streaks past
  dive: beat(2, 1),          // camera dives through the clouds
  boot: bar(3),              // CU: hilltop terminal, cursor blinks
  sprite: beat(3, 2),        // 8-bit Claude assembles on the screen, pixel by pixel
  spriteLook: beat(3, 4),    // the sprite looks at the edge of the screen
  burst: bar(4),             // white flash: Claude bursts out in full cel colour
  eyes: beat(4, 3),          // ECU, eyes open on a sunburst (the long hero reveal)
  eyesOpen: beat(5, 1),
  cliff: bar(6),             // Claude on the cliff, the whole codebase land below
  dream: bar(7),             // empty stadium, a lone silhouette
  board: bar(8),             // CU scoreboard: all red
  // ---- Act II: the squad, the bugs, the throw
  parade: bar(9),            // one bar per tool-creature
  pRead: bar(9), pFetch: bar(10), pEdit: bar(11), pWrite: bar(12), pBash: bar(13),
  gang: bar(14),             // the bug gang poses (villain trio)
  gOff: beat(14, 1), gRace: beat(14, 3), gFlaky: beat(15, 1), gBonk: beat(15, 3),
  gag: bar(16),              // Claude pounces on the Flaky Test; it flickers away
  pounce: beat(16, 2), vanish: beat(16, 3), faceplant: beat(16, 4), flakyBack: beat(17, 2), flakyBlink: beat(17, 3),
  windup: bar(18),           // THE THROW (smash chain)
  release: beat(18, 3), tokenCam: beat(18, 4),
  split: bar(19),            // token bursts: five subagents fan out
  fan: beat(19, 2),
  panels: bar(20),           // split screen: five subagents work in parallel
  panelIn: [beat(20, 1), beat(20, 2), beat(20, 3), beat(20, 4), beat(21, 1)],
  checks: [beat(21, 2), beat(21, 2.5), beat(21, 3), beat(21, 3.5), beat(21, 4)],
  // ---- Act III: the dragon, the rival, the team, the dream comes true
  dragon: bar(22),           // Bash rears up at the src/ folder
  inhale: beat(22, 2),
  prompt: beat(22, 3),       // the permission prompt appears between them (read time ≈ 2.9 s)
  promptNo: beat(23, 4),     // the selection moves down to "3. No"
  fizzle: beat(24, 2),       // the fire fizzles into a smoke puff, Bash sulks
  pat: beat(24, 4),          // Claude pats it…
  hug: beat(25, 2),          // …and hugs it (warmth beat, held 1.5 s)
  beast: bar(26),            // the Merge Conflict beast rears up
  roar: beat(26, 2),
  snip: bar(27),             // Edit snips the markers; the heads merge
  snipCut: beat(27, 3), merged: bar(28), mergedSmile: beat(28, 3),
  team: bar(29),             // ensemble line-up
  road: bar(30),             // the journey: a git-graph road toward the stadium
  finale: bar(32),           // the stadium again: red → green
  flip: beat(32, 3), fireworks: bar(33),
  throw2: bar(34),           // final wind-up, throw at the lens
  release2: beat(34, 3), flash2: beat(34, 4.5),
  logo: bar(35),             // logo slam on a starburst
  ribbon: beat(35, 3),
  button: bar(37),           // a tiny bug strolls over the logo; Claude's eyes slide
  bugIn: beat(37, 1), eyesSlide: beat(37, 4), black: beat(38, 2),
  end: beat(38, 2) + 0.75,
};
