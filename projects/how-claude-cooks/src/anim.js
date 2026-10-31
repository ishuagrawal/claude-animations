// The timeline: one pass through the kitchen, from "you hit send" to the bell, ending on the
// finished poster. Everything is a pure function of time t (seconds), so any moment can be
// rendered on its own (?t=12.5) and frames can be captured one by one.
import { REPLY } from "./scene.js";

export const END = 48.5;

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
const fadeOut = (id, t0, d = 0.3) => add(id, t0, d, (s, p) => { s.op *= 1 - p; });
const pulse = (id, t0, amt = 0.18, d = 0.35) => add(id, t0, d, (s, p) => { s.s *= 1 + amt * bump(p); });
const always = (id, fx) => add(id, 0, 1, fx, "always");

// ---------- the story ----------
// header and start
fade("hdr-kicker", 0.1, 0.5);
rise("hdr-title1", 0.3);
rise("hdr-title2", 0.55);
rise("hdr-sub", 0.9);
pop("start-dot", 1.4);
add("start-dot", 1.8, 0.6, (s, p) => { s.s *= 1 + 0.25 * bump(p); });
draw("arr-start", 2.0, 0.4);

// 1 order: the receipt prints out of the rail in jerky little steps
pop("s1-ticket", 2.3);
fade("s1-rail", 2.4, 0.3);
add("s1-slip-paper", 2.7, 2.0, (s, p, t) => {
  const k = Math.min(4, Math.floor(p * 5)), f = p * 5 - k;
  const y = p >= 1 ? 1 : (k + out(Math.min(1, f * 2.2))) / 5;
  s.ty -= 150 * (1 - y);
  if (p > 0 && p < 1) s.tx += Math.sin(t * 90) * 0.7;
}, "pre");
draw("arr-12", 4.9);

// 2 chop: seven chops, seven tokens
pop("s2-ticket", 5.3);
fade("s2-board", 5.4);
pop("s2-claude", 5.5);
pop("s2-cleaver", 5.6);
const CHOP = 0.42, CHOP0 = 6.1, IMPACT = 0.29;
for (let i = 0; i < 7; i++) {
  add("s2-cleaver", CHOP0 + i * CHOP, CHOP, (s, p) => {
    s.r += p < 0.55 ? -40 * out(p / 0.55) : -40 * (1 - clamp((p - 0.55) / 0.15));
  });
  pop(`s2-t-${i}`, CHOP0 + i * CHOP + IMPACT, 0.3);
}
add("s2-lines", CHOP0 + IMPACT, 7 * CHOP, (s, p, t) => {
  const f = ((t - CHOP0 - IMPACT) / CHOP) % 1;
  s.op *= p >= 1 ? 1 : f < 0.35 ? 1 : 0.15;
}, "reveal");
draw("arr-23", 9.2);

// 3 flavor: each jar tips, its token's flavor bars grow out
pop("s3-ticket", 9.5);
for (let k = 0; k < 4; k++) {
  pop(`s3-jar-${k}`, 9.6 + k * 0.08);
  const t0 = 10.1 + k * 0.5;
  add(`s3-jar-${k}`, t0, 0.55, (s, p) => { s.r += -28 * bump(p); });
  pop(`s3-tile-${k}`, t0 + 0.05, 0.35);
  add(`s3-bars-${k}`, t0 + 0.2, 0.45, (s, p) => { s.sx *= Math.max(0.001, out(p)); }, "reveal");
}
fade("s3-more", 12.3);
draw("arr-3L", 12.4, 0.8);
fade("s3-note", 12.8);

// 4 cook: the whole order arrives at layer 1 at once
pop("s4-ticket", 13.2);
fade("s4-counter", 13.2);
pop("s4-card", 13.5);
fade("s4-clip", 13.7);
function stationIn(id, t0) {
  pop(`${id}-sign`, t0);
  fade(`${id}-oven`, t0);
  fade(`${id}-flames`, t0 + 0.1);
  pop(`${id}-claude`, t0 + 0.2);
  slideIn(`${id}-tray`, t0 + 0.3, 140);
  pop(`${id}-rope`, t0 + 0.7);
}
stationIn("st1", 13.8);

// taste back: "en" looks at every earlier token, hardest at "ram"…
const HI1 = [[14.9, 19.0], [21.9, 22.4], [24.95, 25.3]];
const HI2 = [[19.1, 20.7], [22.4, 23.0], [25.3, 25.8]];
const windowed = (wins) => (s, _p, t) => {
  let v = 0;
  for (const [a, b] of wins) v = Math.max(v, clamp((t - a) / 0.25) * clamp((b - t) / 0.25));
  s.op *= v;
};
always("s4-hi1", windowed(HI1));
always("s4-hi2", windowed(HI2));
add("st1-t-5", 14.9, 0.5, (s, p) => { s.s *= 1 + 0.35 * bump(p); });
[0, 1].forEach((k) => fade(`st1-arc-${k}`, 15.3 + k * 0.35, 0.3));
[2, 3, 4].forEach((k) => draw(`st1-arc-${k}`, 15.3 + k * 0.35, 0.35));
for (let k = 0; k < 4; k++) fade(`s4-note-${k}`, 15.4 + k * 0.4, 0.3);
// …so "ram" + "en" click into "ramen"
add("st1-t-4", 17.1, 0.6, (s, p) => { s.tx += 2.5 * bump(p); });
add("st1-t-5", 17.1, 0.6, (s, p) => { s.tx -= 2.5 * bump(p); });
pop("st1-bubble", 17.2, 0.4);
fadeOut("st1-bubble", 18.3);
// it tries to peek at "?", and the rope says no
add("st1-t-5", 18.4, 0.7, (s, p) => { s.r += p < 0.5 ? 16 * out(p / 0.5) : 16 * (1 - out((p - 0.5) / 0.5)); s.tx += 4 * bump(p); });
add("st1-rope", 18.7, 0.6, (s, p) => { s.r += wig(p, 9, 3); });

// season: every token gets its own pinch
pop("st1-shaker", 19.1, 0.3);
add("st1-shaker", 19.3, 1.3, (s, p) => { s.r += 22 * Math.sin(p * Math.PI * 9) * (1 - p * 0.4); });
fade("st1-grains", 19.5, 0.9);

// the same recipe at layer 2, faster
draw("arr-L12", 20.9, 0.6);
stationIn("st2", 21.2);
[0, 1].forEach((k) => fade(`st2-arc-${k}`, 21.95, 0.3));
[2, 3, 4].forEach((k) => draw(`st2-arc-${k}`, 21.95, 0.35));
pop("st2-shaker", 22.4, 0.25);
add("st2-shaker", 22.5, 0.5, (s, p) => { s.r += 22 * Math.sin(p * Math.PI * 6); });
fade("st2-grains", 22.55, 0.4);

// …many more layers…
fade("s4-many", 23.3, 0.3);
fade("s4-dots", 23.4, 0.3);
add("s4-dots", 23.4, 0.9, (s, p) => { s.op *= 0.4 + 0.6 * Math.abs(Math.cos(p * Math.PI * 3)); });
draw("arr-L2N", 23.5, 0.7);

// …until the last layer: everything cooked, and "?" knows what comes next
stationIn("stN", 24.2);
[0, 1].forEach((k) => fade(`stN-arc-${k}`, 25.0, 0.25));
[2, 3, 4].forEach((k) => draw(`stN-arc-${k}`, 25.0, 0.3));
pop("stN-shaker", 25.35, 0.2);
add("stN-shaker", 25.4, 0.4, (s, p) => { s.r += 22 * Math.sin(p * Math.PI * 5); });
fade("stN-grains", 25.45, 0.3);
fade("stN-steam", 25.9, 0.5);
pop("stN-spark", 26.1, 0.5);
draw("arr-L5", 26.5, 0.8);

// 5 score: chalk up the odds for every possible next token
pop("s5-ticket", 27.3);
fade("s5-board", 27.4);
fade("c-title", 27.7, 0.5);
for (let i = 0; i < 4; i++) {
  fade(`c-word-${i}`, 28.0 + i * 0.3, 0.3);
  fade(`c-pct-${i}`, 28.45 + i * 0.3, 0.3);
}
fade("c-more", 29.3, 0.4);
draw("arr-56", 29.7);

// 6 spin: the wheel is weighted by those odds
pop("s6-ticket", 30.1);
fade("s6-stand", 30.2);
pop("s6-disc", 30.3);
pop("s6-claude", 30.4);
add("s6-disc", 30.7, 2.6, (s, p) => { s.r += 1080 * out(p); });
draw("arr-67", 33.4);

// 7 plate: the winner drops into the bowl and onto your screen
pop("s7-ticket", 33.8);
pop("s7-bowl", 33.9);
fade("s7-bowl-tiles", 34.1);
pop("s7-screen", 34.3);
add("s7-broth", 34.9, 0.6, (s, p) => { s.op *= clamp(p * 4); s.ty -= 70 * (1 - bounce(p)); }, "reveal");
fade("s7-lines", 35.45, 0.2);

// the next lap: only the new token rides back to the line
fade("s7-belt", 36.0);
draw("arr-loop", 36.1, 1.0);
fade("s7-note", 36.5);

const LAPS = [37.8, 39.3, 40.8, 42.3];
const LAP_TOKENS = [[1, ","], [2, "simmered"], [2, " slow"], [2, "."]];
const RIDES = [[36.2, 1.4], ...LAPS.map((T) => [T - 0.1, 0.5])];
always("s7-belt-tile", (s, _p, t) => {
  if (t < 36.2) { s.op = 0; return; }
  const ride = RIDES.find(([a, d]) => t >= a && t < a + d);
  if (ride) {
    const p = (t - ride[0]) / ride[1];
    s.tx += -20 + 170 * p;
    s.op *= p > 0.85 ? (1 - p) / 0.15 : 1;
  } else s.op *= t > 44 ? clamp((t - 44) / 0.4) : 0;
});
LAPS.forEach((T, L) => {
  pulse("st1-sign", T);
  pulse("st2-sign", T + 0.22);
  pulse("s4-dots", T + 0.38);
  pulse("stN-sign", T + 0.5);
  add("s6-disc", T + 0.8, 0.5, (s, p) => { s.r += 360 * out(p); });
  if (L === 0) fade("s4-note-4", T + 0.3, 0.3);
});
// chalk bars grow in, then regrow on every lap
for (let i = 0; i < 4; i++) {
  const first = 28.1 + i * 0.3;
  always(`c-bar-${i}`, (s, _p, t) => {
    if (t < first) { s.op = 0; return; }
    let sx = out(clamp((t - first) / 0.5));
    for (const T of LAPS) if (t >= T + 0.6 && t < T + 0.9) sx = out((t - T - 0.6) / 0.3);
    s.sx *= Math.max(0.001, sx);
  });
}

// 7 plate, on screen: earlier tokens type in, then one token per lap
const typing = [];
{
  const first = [[0, REPLY[0]], [1, "good "]];
  let t = 34.6;
  for (const [line, str] of first) for (const ch of str) typing.push([(t += 0.045), line, ch]);
  typing.push([35.5, 1, "broth"]);
  LAPS.forEach((T, L) => typing.push([T + 1.3, ...LAP_TOKENS[L]]));
}
export function screenAt(t) {
  const lines = ["", "", ""];
  for (const [at, line, str] of typing) if (t >= at) lines[line] += str;
  return lines;
}

// endings: the bell rings; the other two endings show what else can stop a reply
draw("arr-done", 44.2);
pop("e-done", 44.6);
pop("e-bell", 44.7);
add("e-bell", 44.9, 0.9, (s, p) => { s.r += wig(p, 14, 4); });
pop("e-ding", 45.0, 0.5);
draw("arr-full", 45.9);
pop("e-full", 46.3);
pop("e-fullbowl", 46.4);
draw("arr-fetch", 46.8);
pop("e-fetch", 47.2);
pop("e-runner", 47.3);

// idle life, once things are on the page
["st1", "st2", "stN"].forEach((id, k) =>
  always(`${id}-flames`, (s, _p, t) => { s.sy *= 1 + 0.12 * Math.sin(t * 13 + k * 2); }));
always("stN-steam", (s, _p, t) => { s.ty -= 2 * Math.sin(t * 2.2); });
always("stN-spark", (s, _p, t) => { s.r += 8 * Math.sin(t * 1.6); });
always("e-runner", (s, _p, t) => { if (t > 47.8) s.ty -= 2.5 * Math.abs(Math.sin(t * 9)); });

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
    els.set(tr.id, { el, ox: +ox, oy: +oy, tracks: [tr], drawn, heads });
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
