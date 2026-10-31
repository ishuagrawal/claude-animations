// The timeline: one pass through the kitchen, from "you hit send" to the bell, ending on the
// finished poster. Everything is a pure function of time t (seconds), so any moment can be
// rendered on its own (?t=12.5) and frames can be captured one by one. Sound cues live here
// too, so picture and sound share one clock.
import { REPLY } from "./scene.js";

export const END = 51.5;

const clamp = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, p) => a + (b - a) * p;
const out = (p) => 1 - (1 - p) ** 3;
const back = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;
const wig = (p, amp, n) => amp * Math.sin(p * n * 2 * Math.PI) * (1 - p);
const bump = (p) => Math.sin(Math.PI * p);
function bounce(p) {
  if (p < 0.6) return (p / 0.6) ** 2;
  const q = (p - 0.6) / 0.4;
  return 1 - 0.18 * Math.sin(Math.PI * q) * (1 - q);
}
// 0 → 1 → 0 over a window, with soft edges
const win = (t, a, b, e = 0.2) => clamp((t - a) / e) * clamp((b - t) / e);

// ---------- tracks ----------
// mode "reveal": hidden before t0 · "pre": fx(0) applies before t0 · "after": nothing before t0
// "always": fx gets absolute time (p is unused)
const tracks = [];
const add = (id, t0, d, fx, mode = "after") => tracks.push({ id, t0, d, fx, mode });

const pop = (id, t0, d = 0.45) => add(id, t0, d, (s, p) => { s.op *= clamp(p * 3); s.s *= lerp(0.5, 1, back(p)); }, "reveal");
const fade = (id, t0, d = 0.4) => add(id, t0, d, (s, p) => { s.op *= out(p); }, "reveal");
const rise = (id, t0, d = 0.6) => add(id, t0, d, (s, p) => { s.op *= out(p); s.ty += 16 * (1 - out(p)); }, "reveal");
const draw = (id, t0, d = 0.5) => add(id, t0, d, (s, p) => { s.draw = out(p); }, "reveal");
const slideIn = (id, t0, dx, d = 0.6) => add(id, t0, d, (s, p) => { s.op *= clamp(p * 2); s.tx += dx * (1 - out(p)); }, "reveal");
const pulse = (id, t0, amt = 0.18, d = 0.35) => add(id, t0, d, (s, p) => { s.s *= 1 + amt * bump(p); });
const always = (id, fx) => add(id, 0, 1, fx, "always");
// shown only inside [a, b], popping in and fading out
const flash = (id, a, b) => always(id, (s, _p, t) => {
  s.op = win(t, a, b, 0.15);
  s.s *= t < a + 0.3 ? lerp(0.5, 1, back(clamp((t - a) / 0.3))) : 1;
});

// ---------- sound cues ----------
export const CUES = [];
const cue = (t, name, o = {}) => CUES.push({ t, name, ...o });

// ---------- Claude, the chef ----------
const EXPR = ["open", "squint", "wide", "happy", "blink"];
// expr: [[from, to, expression]]; look: [[from, to, dx, dy]] in Claude's own units
function chef(id, { base = "open", phase = 0, expr = [], look = [] }) {
  const exprAt = (t) => {
    let e = base;
    for (const [a, b, x] of expr) if (t >= a && t < b) e = x;
    if ((e === "open" || e === "wide") && (t + phase * 1.3) % 3.4 < 0.13) e = "blink";
    return e;
  };
  for (const e of EXPR) always(`${id}-e-${e}`, (s, _p, t) => { s.op = exprAt(t) === e ? 1 : 0; });
  always(`${id}-eyes`, (s, _p, t) => {
    for (const [a, b, dx, dy] of look) { const w = win(t, a, b, 0.25); s.tx += dx * w; s.ty += dy * w; }
  });
  always(`${id}-body`, (s, _p, t) => {
    const b = Math.sin(t * 2.6 + phase);
    s.sy *= 1 + 0.03 * b;
    s.sx *= 1 - 0.015 * b;
  });
  always(`${id}-hat`, (s, _p, t) => { s.ty += 2.5 * Math.sin(t * 2.6 + phase - 0.7); s.r += 2 * Math.sin(t * 1.3 + phase); });
}
// a hop, in Claude's own units
const hop = (id, t0, h = 40, d = 0.45) => {
  add(`${id}-body`, t0, d, (s, p) => {
    s.ty -= h * Math.sin(Math.PI * p);
    s.sy *= p < 0.15 || p > 0.85 ? 0.9 : 1.06;
    s.sx *= p < 0.15 || p > 0.85 ? 1.06 : 0.96;
  });
  cue(t0, "hop");
};
// walk in from dx away (page units), legs swinging
const walkIn = (id, t0, dx, d = 0.8) => {
  add(id, t0, d, (s, p) => { s.tx += dx * (1 - out(p)); }, "pre");
  add(`${id}-body`, t0, d, (s, p) => { s.ty -= 6 * Math.abs(Math.sin(p * Math.PI * 4)); });
  add(`${id}-legA`, t0, d, (s, p) => { s.r += 14 * Math.sin(p * Math.PI * 4); });
  add(`${id}-legB`, t0, d, (s, p) => { s.r -= 14 * Math.sin(p * Math.PI * 4); });
  cue(t0, "steps", { d });
};

// ---------- the story ----------
// header: the head chef waves hello
fade("hdr-kicker", 0.1, 0.5);
rise("hdr-title1", 0.3);
rise("hdr-title2", 0.55);
rise("hdr-sub", 0.9);
pop("hdr-hero", 1.0, 0.5);
cue(1.0, "pop");
add("hero-armR", 1.3, 1.2, (s, p) => { s.r += -25 * Math.sin(p * Math.PI * 4) * (1 - p * 0.3); });
flash("hero-note", 1.4, 2.6);
add("hero-note", 1.4, 1.2, (s, p) => { s.ty -= 20 * p; });
cue(1.4, "hum");
chef("hero", {
  phase: 0.3,
  expr: [[1.3, 2.6, "happy"], [47.6, 49.2, "happy"], [36.0, 36.9, "wide"]],
  look: [[2.6, 13.8, 10, 2], [13.8, 29.7, 6, 10], [29.7, 47.4, 4, 12]],
});
hop("hero", 47.7, 50, 0.5);
hop("hero", 48.3, 40, 0.45);
add("hero-armR", 47.6, 1.2, (s, p) => { s.r += -40 * bump(p); });

pop("start-dot", 1.6);
add("start-dot", 1.9, 0.6, (s, p) => { s.s *= 1 + 0.25 * bump(p); });
cue(1.9, "click");
draw("arr-start", 2.2, 0.4);
cue(2.2, "swish");

// 1 order: the receipt prints out of the rail in jerky little steps
pop("s1-ticket", 2.5);
cue(2.5, "pop");
fade("s1-rail", 2.6, 0.3);
add("s1-slip-paper", 2.9, 2.0, (s, p, t) => {
  const k = Math.min(4, Math.floor(p * 5)), f = p * 5 - k;
  const y = p >= 1 ? 1 : (k + out(Math.min(1, f * 2.2))) / 5;
  s.ty -= 150 * (1 - y);
  if (p > 0 && p < 1) s.tx += Math.sin(t * 90) * 0.7;
}, "pre");
for (let k = 0; k < 5; k++) cue(2.9 + k * 0.4, "printer", { d: 0.17 });
cue(5.0, "tear");
draw("arr-12", 5.1);
cue(5.1, "swish");

// 2 chop: Claude walks up, squints, and chops seven times, one token per chop
pop("s2-ticket", 5.5);
cue(5.5, "pop");
fade("s2-board", 5.6);
fade("s2-claude", 5.6, 0.2);
walkIn("c2", 5.6, 70, 0.8);
const CHOP = 0.42, CHOP0 = 6.6, IMPACT = 0.29;
for (let i = 0; i < 7; i++) {
  add("c2-armR", CHOP0 + i * CHOP, CHOP, (s, p) => {
    s.r += p < 0.55 ? -40 * out(p / 0.55) : -40 * (1 - clamp((p - 0.55) / 0.15));
  });
  add("c2-body", CHOP0 + i * CHOP + IMPACT, 0.15, (s, p) => { s.sy *= 1 - 0.05 * bump(p); });
  pop(`s2-t-${i}`, CHOP0 + i * CHOP + IMPACT, 0.3);
  cue(CHOP0 + i * CHOP + IMPACT, "chop", { i });
}
add("s2-lines", CHOP0 + IMPACT, 7 * CHOP, (s, p, t) => {
  const f = ((t - CHOP0 - IMPACT) / CHOP) % 1;
  s.op *= p >= 1 ? 1 : f < 0.35 ? 1 : 0.15;
}, "reveal");
flash("c2-sweat", 8.3, 10.0);
add("c2-sweat", 8.3, 1.7, (s, p) => { s.ty += 14 * p; });
chef("c2", {
  base: "squint",
  phase: 1.1,
  expr: [[5.6, 6.5, "open"], [9.7, 10.8, "happy"]],
  look: [[6.4, 9.6, -8, 8]],
});
hop("c2", 9.75, 36);
draw("arr-23", 10.0);
cue(10.0, "swish");

// 3 flavor: each jar tips, its token's flavor bars grow out
pop("s3-ticket", 10.3);
cue(10.3, "pop");
fade("s3-shelf", 10.35);
for (let k = 0; k < 4; k++) {
  pop(`s3-jar-${k}`, 10.4 + k * 0.08);
  const t0 = 10.9 + k * 0.5;
  add(`s3-jar-${k}`, t0, 0.55, (s, p) => { s.r += -28 * bump(p); });
  cue(t0 + 0.1, "shake", { d: 0.3 });
  pop(`s3-tile-${k}`, t0 + 0.05, 0.35);
  add(`s3-bars-${k}`, t0 + 0.2, 0.45, (s, p) => { s.sx *= Math.max(0.001, out(p)); }, "reveal");
  cue(t0 + 0.2, "zip", { k });
}
fade("s3-more", 13.1);
draw("arr-3L", 13.2, 0.8);
cue(13.2, "whoosh");
fade("s3-note", 13.6);

// 4 cook: the kitchen lights up and the whole order arrives at layer 1 at once
pop("s4-ticket", 14.0);
cue(14.0, "pop");
fade("k-wall", 14.0, 0.6);
fade("k-rail", 14.1);
fade("s4-counter", 14.1);
pop("s4-card", 14.3);
fade("s4-clip", 14.5);
pop("k-clock", 14.4);
pop("k-pan", 14.5);
pop("k-ladle", 14.6);
cue(14.5, "clang");
cue(14.6, "ambience");
function stationIn(id, t0) {
  pop(`${id}-sign`, t0);
  fade(`${id}-oven`, t0);
  fade(`${id}-flames`, t0 + 0.1);
  cue(t0 + 0.1, "ignite");
  pop(`${id}-claude`, t0 + 0.2);
  slideIn(`${id}-tray`, t0 + 0.3, 140);
  cue(t0 + 0.3, "whoosh");
  pop(`${id}-rope`, t0 + 0.7);
  for (let k = 0; k < 3; k++) fade(`${id}-steam-${k}`, t0 + 0.9 + k * 0.15);
}
const HI1 = [], HI2 = [];
// one station's work: taste back (arcs), the thought, then season
function cook(id, { arcs, t0, gap, think, shake0, shakeD, extra }) {
  HI1.push([t0 - 0.2, think + 0.5]);
  HI2.push([shake0 - 0.1, shake0 + shakeD + 0.2]);
  arcs.forEach((dashed, k) => {
    const at = t0 + k * gap;
    if (dashed) fade(`${id}-arc-${k}`, at, 0.3); else draw(`${id}-arc-${k}`, at, 0.35);
    cue(at, "taste", { k });
  });
  pop(`${id}-think`, think, 0.45);
  cue(think, "thought");
  add(`${id}-c-armL`, shake0, shakeD, (s, p) => { s.r += 10 * Math.sin(p * Math.PI * 2 * Math.max(3, shakeD * 6)) - 20 * bump(p); });
  cue(shake0, "shake", { d: shakeD });
  fade(`${id}-grains`, shake0 + 0.15, Math.min(0.9, shakeD));
  if (extra) extra();
}
stationIn("st1", 14.6);
add("st1-t-5", 15.7, 0.5, (s, p) => { s.s *= 1 + 0.35 * bump(p); });
cue(15.7, "blip");
cook("st1", {
  arcs: [true, true, false, false, false], t0: 16.1, gap: 0.35, think: 18.0, shake0: 20.4, shakeD: 1.3,
  extra: () => {
    // "ram" + "en" click together: that's ramen
    add("st1-t-4", 17.8, 0.6, (s, p) => { s.tx += 2.5 * bump(p); });
    add("st1-t-5", 17.8, 0.6, (s, p) => { s.tx -= 2.5 * bump(p); });
    // it tries to peek at "?", and the rope snaps it back
    add("st1-t-5", 19.1, 0.7, (s, p) => { s.r += p < 0.5 ? 16 * out(p / 0.5) : 16 * (1 - out((p - 0.5) / 0.5)); s.tx += 4 * bump(p); });
    add("st1-rope", 19.4, 0.6, (s, p) => { s.r += wig(p, 9, 3); });
    cue(19.4, "boing");
    flash("st1-c-bang", 19.4, 20.1);
    add("st1-c-bang", 19.4, 0.7, (s, p) => { s.r += wig(p, 15, 2); });
  },
});
for (let k = 0; k < 4; k++) fade(`s4-note-${k}`, 16.2 + k * 0.4, 0.3);
for (let k = 0; k < 4; k++) cue(16.2 + k * 0.4, "scribble");
chef("st1-c", {
  base: "wide", phase: 2.2,
  expr: [[18.0, 19.1, "happy"], [19.4, 20.1, "wide"], [20.3, 21.8, "squint"], [47.6, 49.2, "happy"]],
  look: [[15.3, 20.2, -10, 6], [20.3, 21.8, -6, -4]],
});
hop("st1-c", 18.05, 30);
hop("st1-c", 19.45, 22, 0.3);

draw("arr-L12", 22.0, 0.6);
cue(22.0, "swish");
stationIn("st2", 22.3);
cook("st2", { arcs: [true, true, true, false, false, false], t0: 23.1, gap: 0.12, think: 23.9, shake0: 24.4, shakeD: 0.7 });
chef("st2-c", {
  base: "squint", phase: 0.4,
  expr: [[22.4, 23.0, "open"], [23.9, 24.4, "happy"], [47.6, 49.2, "happy"]],
  look: [[23.0, 25.2, -10, 6]],
});
hop("st2-c", 23.95, 28);

// …many more layers…
fade("s4-many", 25.3, 0.3);
fade("s4-dots", 25.4, 0.3);
add("s4-dots", 25.4, 0.9, (s, p) => { s.op *= 0.4 + 0.6 * Math.abs(Math.cos(p * Math.PI * 3)); });
cue(25.4, "dots");
draw("arr-L2N", 25.5, 0.7);
cue(25.5, "swish");

// …until the last layer: the "?" has worked out what comes next
stationIn("stN", 26.2);
cook("stN", { arcs: [false, true, true, false, false, false], t0: 27.0, gap: 0.08, think: 27.6, shake0: 28.0, shakeD: 0.45 });
pop("stN-spark", 28.0, 0.5);
cue(28.0, "sparkle");
chef("stN-c", {
  base: "happy", phase: 3.1,
  expr: [[26.3, 27.6, "open"]],
  look: [[27.0, 28.6, -10, 6]],
});
hop("stN-c", 27.65, 30);
draw("arr-L5", 28.8, 0.8);
cue(28.8, "whoosh");
always("s4-hi1", (s, _p, t) => { s.op *= Math.max(...HI1.map(([a, b]) => win(t, a, b, 0.25))); });
always("s4-hi2", (s, _p, t) => { s.op *= Math.max(...HI2.map(([a, b]) => win(t, a, b, 0.25))); });

// 5 score: chalk up the odds for every possible next token
pop("s5-ticket", 29.7);
cue(29.7, "pop");
fade("s5-board", 29.8);
fade("c-title", 30.1, 0.5);
cue(30.1, "chalk", { d: 0.5 });
for (let i = 0; i < 4; i++) {
  fade(`c-word-${i}`, 30.4 + i * 0.3, 0.3);
  fade(`c-pct-${i}`, 30.85 + i * 0.3, 0.3);
  cue(30.45 + i * 0.3, "chalk", { d: 0.25 });
}
fade("c-more", 31.7, 0.4);
draw("arr-56", 32.0);
cue(32.0, "swish");

// 6 spin: Claude runs up, gives the weighted wheel a shove, and sweats it out
pop("s6-ticket", 32.4);
cue(32.4, "pop");
fade("s6-stand", 32.5);
pop("s6-disc", 32.6);
fade("s6-claude", 32.6, 0.2);
walkIn("c6", 32.6, 90, 0.7);
add("c6-armL", 33.4, 0.4, (s, p) => { s.r += -35 * bump(p); });
add("c6-body", 33.4, 0.4, (s, p) => { s.tx -= 10 * bump(p); });
const SPIN0 = 33.5, SPIND = 2.6;
add("s6-disc", SPIN0, SPIND, (s, p) => { s.r += 1080 * out(p); });
for (let k = 1; k <= 36; k++) cue(SPIN0 + SPIND * (1 - Math.cbrt(1 - k / 36)), "tick");
chef("c6", {
  base: "wide", phase: 1.7,
  expr: [[33.5, 35.9, "squint"], [36.1, 37.2, "happy"], [47.6, 49.2, "happy"]],
  look: [[33.0, 36.1, -12, 4]],
});
flash("c6-sweat", 34.4, 35.9);
add("c6-sweat", 34.4, 1.5, (s, p) => { s.ty += 14 * p; });
hop("c6", 36.15, 44);
hop("c6", 36.65, 30);
cue(36.15, "cheer");
draw("arr-67", 36.4);
cue(36.4, "swish");

// 7 plate: the winner drops into the bowl and onto your screen
pop("s7-ticket", 36.8);
cue(36.8, "pop");
pop("s7-bowl", 36.9);
fade("s7-bowl-tiles", 37.1);
pop("s7-screen", 37.3);
add("s7-broth", 37.9, 0.6, (s, p) => { s.op *= clamp(p * 4); s.ty -= 70 * (1 - bounce(p)); }, "reveal");
cue(38.25, "plop");
flash("s7-splash", 38.25, 38.75);
add("s7-splash", 38.25, 0.5, (s, p) => { s.s *= 1 + 0.5 * p; s.ty -= 8 * p; });
fade("s7-lines", 38.3, 0.2);

// the next lap: only the new token rides back to the line
fade("s7-belt", 39.0);
draw("arr-loop", 39.1, 1.0);
cue(39.1, "conveyor", { d: 1.4 });
fade("s7-note", 39.5);

const LAPS = [40.8, 42.3, 43.8, 45.3];
const LAP_TOKENS = [[1, ","], [2, "simmered"], [2, " slow"], [2, "."]];
const RIDES = [[39.2, 1.4], ...LAPS.map((T) => [T - 0.1, 0.5])];
always("s7-belt-tile", (s, _p, t) => {
  if (t < 39.2) { s.op = 0; return; }
  const ride = RIDES.find(([a, d]) => t >= a && t < a + d);
  if (ride) {
    const p = (t - ride[0]) / ride[1];
    s.tx += -20 + 170 * p;
    s.op *= p > 0.85 ? (1 - p) / 0.15 : 1;
  } else s.op *= t > 47 ? clamp((t - 47) / 0.4) : 0;
});
LAPS.forEach((T, L) => {
  pulse("st1-sign", T);
  hop("st1-c", T + 0.05, 18, 0.3);
  pulse("st2-sign", T + 0.22);
  hop("st2-c", T + 0.27, 18, 0.3);
  pulse("s4-dots", T + 0.38);
  pulse("stN-sign", T + 0.5);
  hop("stN-c", T + 0.55, 18, 0.3);
  add("s6-disc", T + 0.8, 0.5, (s, p) => { s.r += 360 * out(p); });
  for (let k = 1; k <= 8; k++) cue(T + 0.8 + 0.5 * (1 - Math.cbrt(1 - k / 8)), "tick");
  cue(T + 1.3, "ping", { k: L });
  if (L === 0) { fade("s4-note-4", T + 0.3, 0.3); cue(T + 0.3, "scribble"); }
});
// chalk bars grow in, then regrow on every lap
for (let i = 0; i < 4; i++) {
  const first = 30.5 + i * 0.3;
  always(`c-bar-${i}`, (s, _p, t) => {
    if (t < first) { s.op = 0; return; }
    let sx = out(clamp((t - first) / 0.5));
    for (const T of LAPS) if (t >= T + 0.6 && t < T + 0.9) sx = out((t - T - 0.6) / 0.3);
    s.sx *= Math.max(0.001, sx);
  });
}

// on screen: earlier tokens type in, then one token per lap
const typing = [];
{
  const first = [[0, REPLY[0]], [1, "good "]];
  let t = 37.6;
  for (const [line, str] of first) for (const ch of str) typing.push([(t += 0.04), line, ch]);
  typing.push([38.3, 1, "broth"]);
  LAPS.forEach((T, L) => typing.push([T + 1.3, ...LAP_TOKENS[L]]));
  for (const [at, , str] of typing) if (str.trim()) cue(at, "key");
}
export function screenAt(t) {
  const lines = ["", "", ""];
  for (const [at, line, str] of typing) if (t >= at) lines[line] += str;
  return lines;
}

// endings: the bell rings and the whole kitchen cheers; then the other ways a reply can stop
draw("arr-done", 46.9);
cue(46.9, "swish");
pop("e-done", 47.3);
pop("e-bell", 47.4);
add("e-bell", 47.6, 0.9, (s, p) => { s.r += wig(p, 14, 4); });
cue(47.6, "ding");
pop("e-ding", 47.7, 0.5);
for (const [id, dt] of [["c2", 0], ["st1-c", 0.08], ["st2-c", 0.16], ["stN-c", 0.24], ["c6", 0.32]]) hop(id, 47.75 + dt, 34, 0.45);
cue(47.8, "cheer");
draw("arr-full", 48.9);
pop("e-full", 49.3);
pop("e-fullbowl", 49.4);
cue(49.4, "drip");
draw("arr-fetch", 49.8);
pop("e-fetch", 50.2);
fade("e-runner", 50.3, 0.2);
walkIn("runner", 50.3, -70, 0.8);
chef("runner", { base: "wide", phase: 0.9 });

// idle life, once things are on the page
["st1", "st2", "stN"].forEach((id, k) => {
  always(`${id}-flames`, (s, _p, t) => { s.sy *= 1 + 0.12 * Math.sin(t * 13 + k * 2); });
  always(`${id}-glow`, (s, _p, t) => { s.op *= 0.6 + 0.4 * Math.sin(t * 2.3 + k * 1.4); });
  for (let j = 0; j < 3; j++) always(`${id}-steam-${j}`, (s, _p, t) => {
    const c = (t * 0.45 + j * 0.33 + k * 0.2) % 1;
    s.ty -= 16 * c;
    s.op *= Math.sin(Math.PI * c);
    s.sx *= 1 + 0.2 * Math.sin(t * 3 + j);
  });
  for (let i = 0; i < 7; i++) always(`${id}-t-${i}`, (s, _p, t) => { s.ty += 0.6 * Math.sin(t * 29 + i * 1.9 + k); });
});
for (let j = 0; j < 2; j++) {
  fade(`s7-steam-${j}`, 38.6 + j * 0.2);
  always(`s7-steam-${j}`, (s, _p, t) => {
    const c = (t * 0.5 + j * 0.5) % 1;
    s.ty -= 14 * c;
    s.op *= Math.sin(Math.PI * c);
  });
}
always("k-pan", (s, _p, t) => { s.r += 4 * Math.sin(t * 1.7); });
always("k-ladle", (s, _p, t) => { s.r += 5 * Math.sin(t * 1.9 + 1); });
always("k-clock-min", (s, _p, t) => { s.r += t < 14.4 ? 0 : (t - 14.4) * 50; });
always("k-clock-hr", (s, _p, t) => { s.r += t < 14.4 ? 0 : (t - 14.4) * 4; });
always("stN-spark", (s, _p, t) => { s.r += 8 * Math.sin(t * 1.6); });
always("runner-body", (s, _p, t) => { if (t > 51.1) s.ty -= 5 * Math.abs(Math.sin(t * 9)); });
always("runner-legA", (s, _p, t) => { if (t > 51.1) s.r += 12 * Math.sin(t * 18); });
always("runner-legB", (s, _p, t) => { if (t > 51.1) s.r -= 12 * Math.sin(t * 18); });
always("e-speed", (s, _p, t) => { s.tx -= 3 * Math.sin(t * 9); });

// ---------- engine ----------
let els = null;
let screen = null;
let lastLines = null;

function init(svg) {
  els = new Map();
  for (const tr of tracks) {
    if (els.has(tr.id)) { els.get(tr.id).tracks.push(tr); continue; }
    const el = svg.getElementById(tr.id);
    if (!el) { console.warn("no element", tr.id); continue; }
    let ox = el.dataset.ox, oy = el.dataset.oy;
    if (ox == null) {
      const b = el.getBBox();
      ox = b.x + b.width / 2;
      oy = b.y + b.height / 2;
    }
    const drawn = [...el.querySelectorAll(".draw")];
    const heads = drawn.length ? [...el.querySelectorAll("path:not(.draw)")] : [];
    const op0 = el.getAttribute("opacity");
    els.set(tr.id, { el, ox: +ox, oy: +oy, tracks: [tr], drawn, heads, op0 });
  }
  screen = {
    lines: REPLY.map((_, i) => svg.getElementById(`s7-l${i}`)),
    cur: svg.getElementById("s7-cur"),
  };
}

export function render(svg, t) {
  if (!els) init(svg);
  for (const e of els.values()) {
    const s = { op: 1, tx: 0, ty: 0, r: 0, s: 1, sx: 1, sy: 1, draw: null };
    for (const tr of e.tracks) {
      if (tr.mode === "always") { tr.fx(s, 0, t); continue; }
      if (t < tr.t0) {
        if (tr.mode === "reveal") s.op = 0;
        else if (tr.mode === "pre") tr.fx(s, 0, t);
        continue;
      }
      tr.fx(s, clamp((t - tr.t0) / tr.d), t);
    }
    e.el.setAttribute("opacity", s.op.toFixed(3));
    const { ox, oy } = e;
    e.el.setAttribute("transform",
      `translate(${s.tx.toFixed(2)} ${s.ty.toFixed(2)}) translate(${ox} ${oy}) rotate(${s.r.toFixed(2)}) ` +
      `scale(${(s.s * s.sx).toFixed(4)} ${(s.s * s.sy).toFixed(4)}) translate(${-ox} ${-oy})`);
    if (s.draw != null) {
      for (const d of e.drawn) {
        d.style.strokeDasharray = "1 1";
        d.style.strokeDashoffset = String(1 - s.draw);
      }
      for (const h of e.heads) h.setAttribute("opacity", s.draw > 0.92 ? 1 : 0);
    }
  }
  renderScreen(t);
}

function renderScreen(t) {
  const lines = screenAt(t);
  if (!lastLines || lines.some((l, i) => l !== lastLines[i])) {
    lines.forEach((l, i) => { screen.lines[i].textContent = l; });
    lastLines = lines;
  }
  let li = 0;
  lines.forEach((l, i) => { if (l) li = i; });
  const x = 932 + lines[li].length * 8.4 + 1, y = 1034 + li * 20 - 11;
  const typingNow = typing.some(([at]) => t >= at && t < at + 0.35);
  const blink = typingNow || Math.floor(t * 2.4) % 2 === 0 ? 1 : 0.1;
  screen.cur.setAttribute("transform", `translate(${(x - 1050).toFixed(1)} ${y - 1063})`);
  screen.cur.setAttribute("opacity", blink);
}
