// Exports every time the soundtrack needs, straight from the film's own cue sheets, so sound re-times with the picture.
//   node audio/cues.mjs > out/cues-audio.json
// node has no canvas: a stub good enough for modules that measure text at load time
globalThis.OffscreenCanvas ??= class { constructor() {} getContext() { return new Proxy({ measureText: s => ({ width: String(s).length * 10 }) }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true }); } };
const { C, SEGMENTS, SCRIPT, word } = await import('../src/timeline.js');
const { HUD_ITEMS } = await import('../src/hud.js');
const { T: ST, keyT, KEYS } = await import('../src/acts/send_t.js');
const { T: AT } = await import('../src/acts/answer_kit.js');
const { T: FT } = await import('../src/acts/after_core.js');
const { T: GT } = await import('../src/acts/finale_time.js');
const { G: LG } = await import('../src/acts/loop_brass.js');
const O = await import('../src/acts/orbit_stage.js');

const items = HUD_ITEMS.map(([s, id, f, c]) => ({ s, c, t: C[id] + (C[id + 'n'] - C[id]) * f })).sort((a, b) => a.t - b.t);
const vo = SCRIPT.filter(l => l[1]).map(([id]) => ({ id, t: C[id], e: C[id + 'e'] }));
const out = {
  end: C.end + 1, C, segments: SEGMENTS, items, vo,
  // the three ribbons at the wake (first three labels)
  ribbons: [word('a2', 0) + 0.1, word('a2', 4), word('a2', 10)],
  send: { keys: Array.from({ length: KEYS }, (_, k) => keyT(k)), enter: ST.enter, pop: ST.pop, eng: ST.eng, tink: ST.tink, brake: ST.brake, go: ST.go, fib: ST.fib, sea: ST.sea, kick: ST.kick, scan: ST.scan, rush: ST.rush, couple: [ST.l1, ST.h2, ST.h3, ST.h4] },
  orbit: { grab: O.GR, strike: O.ST, sonar: O.TH, fire: O.F, catch: [O.CT1, O.CT2], dock: O.DK, slam: O.SL, flips: Array.from({ length: 9 }, (_, i) => O.FLIP(i)), leap: O.LA },
  vault: { storm: word('b5', 6), clunk: word('b5', 21) + 0.2 },
  loop: { fire: word('d1', 8), brass: [LG.b1, LG.b2, LG.b3], land: LG.land },
  answer: { hit: AT.hit, anvil: AT.b, open: AT.open, rain: AT.rain, undo: AT.undo, kept: AT.kept, crack: AT.crack, burst: AT.burst, throw: AT.throw, pop: AT.pop, letter: AT.letter },
  after: { crash: FT.crash, crum: FT.crum, clunk: FT.clunk, shut: FT.shut, jet: FT.jet, slap: FT.slap, suck: FT.suck, boom: FT.boom },
  finale: { land: GT.land, sneeze: GT.sneeze, hits: GT.hit, line: GT.line, erupt: GT.erupt, burst: GT.burst, stops: GT.A, wide: GT.wide, fall: GT.fall, room: GT.room, fixed: GT.fixed, leave: GT.leave, end: GT.end },
};
console.log(JSON.stringify(out));