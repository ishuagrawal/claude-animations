// Master cue sheet shared by picture and sound. Seconds. Music runs 160 BPM from MUSIC (bar 1 downbeat).
// Pacing rule: every on-screen sentence gets read time, every stunt gets title -> setup -> action -> held payoff.
import { BEAT, BAR } from './core.js';

export const MUSIC = 15.0;
export const bar = n => MUSIC + (n - 1) * BAR;          // start of bar n (1-based)
export const beat = (n, b = 1) => bar(n) + (b - 1) * BEAT; // beat b of bar n

export const C = {
  // ---------------- ACT I — last command before bed
  typeCmd: 0.5, enterShot: 2.55, enterCmd: 2.75,
  warnIn: 3.2, warnDown: 5.45, warnEnter: 6.0,
  taskShot: 6.7, typeTask: 6.85, enterTask: 9.35,
  lightsShot: 10.7, lampOff: 11.35, wipe: 11.8, doorShut: 12.7, clockTick: 12.95,
  bootShot: 13.2, eyesOn: 13.35, crackle: 13.85, ring: 14.1, burst: 14.6, flash1: 14.92,

  // ---------------- ACT II — the show (bars of 1.5s)
  land: bar(1), lampOn: beat(1, 2), pose: beat(1, 3), signIn: beat(1, 4) + 0.1, signOut: beat(3, 4),
  // Stunt 1 "The Clean Sweep": title 2 bars, climb, wind-up + leap, hit, aftermath, duck
  s1: bar(4), s1Climb: bar(6), s1Wind: bar(7), s1Leap: beat(7, 3), s1Hit: bar(8), s1Out: beat(8, 3), s1Duck: beat(10, 2),
  // Stunt 2 "Rewriting History": title 2 bars, rev, charge, slam on bar 14, Sarah's domino teeters, falls, plant + receipt
  s2: bar(11), s2Rev: bar(13), s2Charge: beat(13, 4), s2Slam: bar(14), s2Last: bar(16), s2Plant: beat(16, 3),
  // Stunt 3 "The Green Light": title 2 bars, three chops, the green flip and a held payoff
  s3: bar(18), chop1: beat(20, 2), chop2: beat(20, 3), chop3: beat(20, 4), green: bar(21),
  // Stunt 4 "The Drop": title 2 bars, tie + lift + waddle, look down, POV, jump, BOING, land, held payoff
  s4: bar(22), s4Run: bar(24), s4Edge: bar(25), s4Pov: beat(25, 2), s4Jump: bar(26), s4Boing: bar(27), s4Land: beat(27, 4),
  // Grand finale: open window + title 2 bars, fuses, launches, meter, the big one, ring-out
  s5: bar(29), s5Fuse: bar(31), s5Launch: bar(32), s5Meter: beat(32, 3), s5Big: bar(35), s5End: bar(36),

  // ---------------- ACT III — the morning after
  sunrise: bar(36), doorOpen: bar(36) + 3.0, summary: bar(36) + 5.5, slip: bar(36) + 13.0,
  shatter: bar(36) + 14.4, react: bar(36) + 15.0,

  // ---------------- EPILOGUE
  nextNight: bar(36) + 18.6, sandbox: bar(36) + 19.6, card: bar(36) + 24.6, end: bar(36) + 30.6,
};
C.squeak = C.react + 2.6;
