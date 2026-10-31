// The poster: one view of how an LLM generates a reply, drawn as a kitchen line.
// Everything in `base` is drawn twice: an ink pass (outlines, hatching, text) and an
// offset riso pass (flat color only, multiplied on top). Shapes read their paint from
// CSS custom properties so the two <use> passes can switch parts on and off.

export const W = 1600;
export const H = 1240;

const INK = "#2b2622";
const PAPER = "#f3ecdf";
const RED = "#b8432f";
const TERRA = "#d97757";
const SAGE = "#9fbf9a";
const MUST = "#e3b64c";
const BLUE = "#8fa9c4";
const PINK = "#eea6a0";
const WOOD = "#c4945f";
const CREAM = "#fbf6ea";
const WHITE = "#fffdf7";
const STEEL = "#c3cacd";
const SLATE = "#3d4a44";
const CHALK = "#f1eee4";
const FONT = "'Courier Prime', 'Courier New', monospace";

let base = [];
let top = [];
const put = (s) => base.push(s);

// ---------- primitives ----------
const paint = (fill, stroke = INK, sw = 2) =>
  `${fill === "none" ? "fill:none" : `fill:var(--pf,${fill})`};` +
  `${stroke === "none" ? "stroke:none" : `stroke:var(--sk,${stroke});stroke-width:${sw}`};` +
  `stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke`;
const hatchPaint = (pat) => `fill:url(#${pat});stroke:none;opacity:var(--ho,1)`;
const inkFill = (c = INK) => `fill:var(--tf,${c});stroke:none`;

const rect = (x, y, w, h, fill, o = {}) =>
  put(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}" style="${paint(fill, o.stroke, o.sw)}"/>`);
const hrect = (x, y, w, h, pat = "hatch", rx = 0) =>
  put(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="${hatchPaint(pat)}"/>`);
const path = (d, fill, o = {}) =>
  put(`<path d="${d}" style="${paint(fill, o.stroke, o.sw)}${o.dash ? `;stroke-dasharray:${o.dash}` : ""}"/>`);
const hpath = (d, pat = "hatch") => put(`<path d="${d}" style="${hatchPaint(pat)}"/>`);
const circ = (cx, cy, r, fill, o = {}) =>
  put(`<circle cx="${cx}" cy="${cy}" r="${r}" style="${paint(fill, o.stroke, o.sw)}"/>`);
const hcirc = (cx, cy, r, pat = "hatch") => put(`<circle cx="${cx}" cy="${cy}" r="${r}" style="${hatchPaint(pat)}"/>`);
const inkPath = (d, c = INK) => put(`<path d="${d}" style="${inkFill(c)}"/>`);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function text(x, y, str, o = {}) {
  const { size = 20, weight = 400, italic = false, anchor = "start", color = INK, ls = 0, rot = 0, layer = base } = o;
  const fill = layer === top ? `fill:${color}` : inkFill(color);
  layer.push(
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" font-style="${italic ? "italic" : "normal"}"` +
      ` text-anchor="${anchor}" letter-spacing="${ls}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}` +
      ` style="${fill}">${esc(str)}</text>`,
  );
}
const label = (x, y, lines, o = {}) =>
  lines.forEach((l, i) => text(x, y + i * (o.lh || 21), l, { size: 19, italic: true, anchor: "middle", ...o }));

// ---------- arrows (red ink) ----------
function head(x, y, ang) {
  const a = (ang * Math.PI) / 180, L = 13, Wd = 6.5;
  const bx = x - L * Math.cos(a), by = y - L * Math.sin(a);
  const px = -Math.sin(a) * Wd, py = Math.cos(a) * Wd;
  inkPath(`M${x},${y} L${bx + px},${by + py} L${bx + L * 0.25 * Math.cos(a)},${by + L * 0.25 * Math.sin(a)} L${bx - px},${by - py} Z`, RED);
}
function arrow(d, ex, ey, ang, o = {}) {
  path(d, "none", { stroke: RED, sw: 2.4, dash: o.dash });
  head(ex, ey, ang);
}
function arrowQ(x1, y1, cx, cy, x2, y2, o) {
  arrow(`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, x2, y2, (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI, o);
}

// ---------- ticket (a state) ----------
function ticket(cx, cy, str, pin, o = {}) {
  const size = o.size || 24, h = o.h || 62;
  const w = o.w || Math.round(str.length * size * 0.6 + 48);
  const x = cx - w / 2, y = cy - h / 2;
  const n = Math.max(6, Math.round(w / 13));
  const torn = (dx, dy) => {
    let d = `M${x + dx},${y + dy} H${x + w + dx} V${y + h - 6 + dy}`;
    for (let i = n; i >= 0; i--) d += ` L${x + (w * i) / n + dx},${y + h - 6 + dy + (i % 2 ? 6 : 0)}`;
    return d + " Z";
  };
  hpath(torn(7, 7), "hatchDense");
  path(torn(0, 0), CREAM);
  path(`M${x + 9},${y + 17} H${x + w - 9}`, "none", { stroke: RED, sw: 1 });
  text(x + 11, y + 14, "No. 42", { size: 10, color: RED });
  text(cx, y + h / 2 + size * 0.34 + 5, str, { size, anchor: "middle" });
  circ(cx, y, 8.5, pin);
  circ(cx - 2.5, y - 2.5, 2.4, WHITE, { stroke: "none" });
  return { x, y, w, h };
}

// ---------- Claude, the chef ----------
// Body units follow refs/claude-mascot.png: a 150 x 107 block, stub arms, four legs.
function claude(x, y, s = 1, o = {}) {
  const { eyes = "open", hat = true, apron = true, legs = true } = o;
  put(`<g transform="translate(${x} ${y}) scale(${s})">`);
  if (legs) for (const lx of [2, 38, 94, 130]) rect(lx, 100, 18, 42, TERRA);
  rect(-36, 36, 38, 34, TERRA);
  rect(148, 36, 38, 34, TERRA);
  rect(0, 0, 150, 107, TERRA);
  hrect(104, 2, 44, 103);
  hrect(150, 52, 34, 17);
  if (apron) {
    path("M44,44 H106 V107 H44 Z", WHITE);
    path("M44,62 C25,60 12,56 4,50 M106,62 C125,60 138,56 146,50", "none", { sw: 1.6 });
    path("M58,74 H92 V92 H58 Z", "none", { sw: 1.4 });
  }
  if (eyes === "happy") {
    path("M20,36 L28,24 L36,36 M112,36 L120,24 L128,36", "none", { sw: 3.4 });
  } else if (eyes === "squint") {
    inkPath("M19,28 H37 V34 H19 Z M111,28 H129 V34 H111 Z");
  } else if (eyes === "wide") {
    inkPath("M18,16 H38 V40 H18 Z M110,16 H130 V40 H110 Z");
    circ(23, 21, 3, WHITE, { stroke: "none" });
    circ(115, 21, 3, WHITE, { stroke: "none" });
  } else {
    inkPath("M20,20 H36 V38 H20 Z M112,20 H128 V38 H112 Z");
  }
  circ(18, 50, 7, PINK, { stroke: "none" });
  circ(132, 50, 7, PINK, { stroke: "none" });
  if (hat) {
    circ(46, -40, 21, WHITE);
    circ(104, -40, 21, WHITE);
    circ(75, -52, 26, WHITE);
    hcirc(110, -38, 12, "hatchLight");
    rect(36, -30, 78, 30, WHITE);
    path("M50,-28 V-2 M66,-28 V-2 M84,-28 V-2 M100,-28 V-2", "none", { sw: 1.1 });
  }
  put(`</g>`);
}

// ---------- ingredient tiles (tokens) ----------
function tileW(str, size) {
  return str.length * size * 0.6 + size * 1.0;
}
function tiles(x, y, words, o = {}) {
  const size = o.size || 14, gap = o.gap ?? 5, h = size * 1.7;
  let cx = x;
  const out = [];
  words.forEach((wd, i) => {
    const w = tileW(wd, size);
    const fill = (o.fills && o.fills[i]) || CREAM;
    rect(cx, y, w, h, fill, { rx: 3, sw: 1.6 });
    hrect(cx + w - 4, y + 2, 3, h - 4, "hatchDense");
    text(cx + w / 2, y + h * 0.7, wd, { size, anchor: "middle" });
    out.push({ x: cx, w, cx: cx + w / 2 });
    cx += w + gap;
  });
  return out;
}

const PROMPT = ["how", "do", "i", "make", "ram", "en", "?"];

// ---------- labels ----------
const GREY = "#7a6c60";

// A numbered step: the state ticket, with the verb big and the technical name underneath.
function step(cx, cy, n, verb, tech, pin) {
  const size = 26, h = 58;
  const w = Math.round(verb.length * size * 0.6 + 86);
  const x = cx - w / 2, y = cy - h / 2;
  const nTeeth = Math.max(6, Math.round(w / 13));
  const torn = (dx, dy) => {
    let d = `M${x + dx},${y + dy} H${x + w + dx} V${y + h - 6 + dy}`;
    for (let i = nTeeth; i >= 0; i--) d += ` L${x + (w * i) / nTeeth + dx},${y + h - 6 + dy + (i % 2 ? 6 : 0)}`;
    return d + " Z";
  };
  hpath(torn(6, 6), "hatchDense");
  path(torn(0, 0), CREAM);
  if (n) {
    circ(x + 28, cy - 2, 15, pin, { sw: 1.6 });
    text(x + 28, cy + 4, String(n), { size: 18, weight: 700, anchor: "middle" });
  } else {
    circ(cx, y, 8.5, pin);
  }
  text(n ? x + 52 : cx, cy + 7, verb, { size, weight: 700, anchor: n ? "start" : "middle" });
  if (tech) text(cx, y + h + 22, tech, { size: 16, italic: true, anchor: "middle", color: GREY });
  return { x, y, w, h };
}
const note = (x, y, str, o = {}) => text(x, y, str, { size: 17, italic: true, anchor: "middle", ...o });

// ---------- props ----------
function bell(cx, cy, s = 1) {
  put(`<g transform="translate(${cx} ${cy}) scale(${s})">`);
  path("M-34,0 C-34,-40 34,-40 34,0 Z", MUST);
  hpath("M8,-30 C24,-24 34,-12 34,0 H20 C20,-12 16,-24 8,-30 Z", "hatch");
  rect(-6, -40, 12, 8, MUST, { sw: 1.4 });
  rect(-46, 0, 92, 10, WOOD, { rx: 2 });
  path("M-52,-34 l-14,-10 M0,-52 v-16 M52,-34 l14,-10", "none", { sw: 1.6 });
  put(`</g>`);
}
function jar(cx, y, color) {
  rect(cx - 20, y, 40, 12, WOOD, { rx: 2, sw: 1.6 });
  rect(cx - 24, y + 12, 48, 52, WHITE, { rx: 8, sw: 1.8 });
  rect(cx - 20, y + 30, 40, 30, color, { rx: 5, stroke: "none" });
  hrect(cx + 10, y + 16, 10, 44, "hatch", 4);
}
function flavorBars(cx, y, lens) {
  const cols = [TERRA, SAGE, MUST, BLUE];
  lens.forEach((l, i) => rect(cx - 26, y + i * 11, 52 * l, 8, cols[i], { sw: 1.2, rx: 1 }));
}
function bowl(cx, rimY, w, o = {}) {
  const hw = w / 2, d = w * 0.42;
  path(`M${cx - hw},${rimY} H${cx + hw} C${cx + hw - 4},${rimY + d} ${cx + 30},${rimY + d + 10} ${cx},${rimY + d + 10} C${cx - 30},${rimY + d + 10} ${cx - hw + 4},${rimY + d} ${cx - hw},${rimY} Z`, WHITE);
  hpath(`M${cx + hw * 0.55},${rimY + 8} H${cx + hw - 2} C${cx + hw - 8},${rimY + d * 0.8} ${cx + hw * 0.4},${rimY + d + 6} ${cx + 10},${rimY + d + 9} C${cx + hw * 0.5},${rimY + d * 0.7} ${cx + hw * 0.6},${rimY + d * 0.4} ${cx + hw * 0.55},${rimY + 8} Z`, "hatch");
  path(`M${cx - 26},${rimY + d + 10} H${cx + 26} L${cx + 20},${rimY + d + 22} H${cx - 20} Z`, BLUE, { sw: 1.6 });
  path(`M${cx - hw + 6},${rimY + 16} H${cx + hw - 6}`, "none", { stroke: RED, sw: 1.4 });
  if (o.steam) path(`M${cx - 26},${rimY - 34} c-7,-10 7,-16 0,-28 M${cx},${rimY - 40} c-7,-10 7,-16 0,-28 M${cx + 26},${rimY - 34} c-7,-10 7,-16 0,-28`, "none", { sw: 1.5 });
}

// ---------- page sections ----------
function header() {
  text(64, 78, "the kitchen of claude  ·  I", { size: 20, ls: 2 });
  text(58, 168, "How Claude", { size: 80, weight: 700 });
  text(58, 252, "cooks", { size: 80, weight: 700 });
  text(64, 300, "how an AI writes a reply,", { size: 23, italic: true });
  text(64, 330, "one token at a time", { size: 23, italic: true });
}

function rowPrep() {
  circ(598, 300, 14, "none", { sw: 1.6 });
  circ(598, 300, 9, RED);
  arrow("M613,300 H655", 660, 300, 0);

  // 1 order: the slip on the rail
  rect(648, 86, 196, 10, STEEL, { rx: 3 });
  hrect(648, 91, 196, 5, "hatchDense");
  let slip = "M670,94 L822,92 L824,236";
  for (let i = 0; i <= 19; i++) slip += ` L${824 - i * 8},${236 + (i % 2 ? 0 : 7)}`;
  path(slip + " Z", WHITE);
  hpath("M812,98 L822,98 L824,234 L814,236 Z");
  text(684, 124, "table 1", { size: 14, color: RED, rot: -1 });
  text(684, 168, "how do i", { size: 21, italic: true, rot: -1 });
  text(684, 200, "make ramen?", { size: 20, italic: true, rot: -1 });
  step(752, 300, 1, "order", "your words", MUST);

  arrow("M846,300 H917", 922, 300, 0);

  // 2 chop: Claude with a cleaver at the board
  claude(1006, 118, 0.6, { eyes: "squint" });
  path("M1110,152 L1146,112 L1170,132 L1134,170 Z", STEEL, { sw: 1.8 });
  hpath("M1150,118 L1170,132 L1150,154 Z", "hatch");
  path("M1104,160 L1114,150 L1124,160 L1114,170 Z", WOOD, { sw: 1.6 });
  path("M1180,108 l12,-10 M1186,128 l16,-2 M1166,96 l4,-14", "none", { sw: 1.6 });
  rect(914, 205, 276, 28, WOOD, { rx: 4 });
  hrect(914, 222, 276, 11, "hatchDense");
  tiles(921, 181, PROMPT, { size: 14, gap: 5 });
  step(1052, 300, 2, "chop", "into tokens", MUST);

  arrow("M1158,300 H1271", 1276, 300, 0);

  // 3 flavor: each token gets its own flavor profile from the spice jars
  [[1292, TERRA], [1362, SAGE], [1432, MUST], [1502, BLUE]].forEach(([x, c]) => jar(x, 70, c));
  const profiles = [[0.9, 0.3, 0.6, 0.2], [0.4, 0.8, 0.2, 0.7], [0.2, 0.5, 0.9, 0.4], [0.7, 0.2, 0.4, 0.9]];
  ["how", "do", "i", "make"].forEach((wd, i) => {
    const cx = 1292 + i * 70;
    flavorBars(cx, 152, profiles[i]);
    const w = tileW(wd, 14);
    tiles(cx - w / 2, 204, [wd], { size: 14 });
    circ(cx - w / 2, 204, 8, CREAM, { sw: 1.2 });
    text(cx - w / 2, 208, String(i + 1), { size: 10, weight: 700, anchor: "middle" });
  });
  text(1556, 220, "…", { size: 22, anchor: "middle" });
  step(1404, 300, 3, "flavor", "tokens become numbers", MUST);

  // into the line, the whole prompt at once
  arrow("M1488,300 H1578 V586 H1514", 1508, 586, 180);
  note(1568, 450, "all at once", { anchor: "end" });
}

function station(c, name, o) {
  path(`M${c - 34},404 V440 M${c + 34},404 V440`, "none", { sw: 1.4 });
  rect(c - 58, 440, 116, 32, WHITE, { rx: 2 });
  hrect(c + 52, 442, 4, 28, "hatchDense");
  text(c, 462, name, { size: 18, weight: 700, anchor: "middle" });
  claude(c + 60, 546, 0.5, { eyes: o.eyes, legs: false });
  const t = tiles(c - 160, 577, PROMPT, { size: 11, gap: 3, fills: o.fills });
  text(c - 10, 654, o.verb, { size: 17, weight: 700, anchor: "middle" });
  text(c - 10, 676, o.tech, { size: 14, italic: true, anchor: "middle", color: GREY });
  return t;
}

function rowLine() {
  rect(418, 596, 1104, 14, WOOD);
  hrect(418, 604, 1104, 6, "hatchDense");
  rect(428, 610, 1084, 80, CREAM);
  for (let x = 488; x < 1512; x += 62) path(`M${x},684 V690`, "none", { sw: 1.1 });

  // layer 1: every token tastes the ones before it, never the ones after
  const t1 = station(1350, "layer 1", { eyes: "wide", verb: "taste back", tech: "attention" });
  const mk = t1[3];
  [0, 1, 2].forEach((k) => {
    const a = t1[k];
    path(`M${mk.cx},575 Q${(mk.cx + a.cx) / 2},${552 - (3 - k) * 6} ${a.cx},575`, "none", { stroke: RED, sw: 1.5, dash: "3 4" });
  });
  const rx = t1[4].x - 1.5;
  rect(rx - 2, 552, 4, 24, MUST, { sw: 1.2 });
  circ(rx, 550, 4, MUST, { sw: 1.2 });
  path(`M${rx},557 Q${rx + 18},570 ${rx + 36},557`, "none", { stroke: RED, sw: 2.6 });

  // layer 2: each token seasoned on its own
  station(1010, "layer 2", { eyes: "squint", verb: "season", tech: "feed-forward" });
  path("M1052,538 L1066,524 L1082,540 L1068,554 Z", WHITE, { sw: 1.6 });
  path("M1053,537 L1067,523", "none", { sw: 4 });
  for (const [px, py] of [[1040, 556], [1030, 566], [1046, 570], [1016, 566], [1006, 572], [1024, 574], [990, 570]]) circ(px, py, 1.6, INK, { stroke: "none" });

  // layer N: fully cooked
  station(580, "layer N", { eyes: "happy", verb: "cooked", tech: "last layer", fills: Array(7).fill(MUST) });
  path("M462,560 c-6,-10 6,-14 0,-24 M520,560 c-6,-10 6,-14 0,-24 M578,560 c-6,-10 6,-14 0,-24", "none", { sw: 1.4 });

  // the many layers in between
  text(792, 590, "· · ·", { size: 30, anchor: "middle", weight: 700 });
  step(792, 482, 4, "cook", null, TERRA);
  arrowQ(1288, 446, 1180, 400, 1072, 444);
  arrowQ(948, 446, 792, 384, 646, 444);
  text(792, 552, "× many", { size: 18, weight: 700, anchor: "middle" });

  // the cache: notes on the clipboard, so old tokens never re-walk the line
  path("M232,438 V452", "none", { sw: 2 });
  rect(136, 458, 192, 200, WOOD, { rx: 8 });
  hrect(298, 462, 26, 192, "hatch", 6);
  rect(150, 476, 164, 170, WHITE);
  rect(200, 448, 64, 24, STEEL, { rx: 5 });
  hrect(200, 463, 64, 9, "hatchDense");
  text(232, 506, "notes", { size: 20, weight: 700, anchor: "middle" });
  for (let i = 0; i < 5; i++) {
    const y = 530 + i * 22;
    rect(164, y - 10, 30, 14, i < 4 ? CREAM : TERRA, { rx: 2, sw: 1.2 });
    path(`M204,${y - 3} q7,-5 14,0 t14,0 t14,0 t14,0 t14,0 t14,0`, "none", { sw: 1.2 });
  }
  text(232, 684, "the cache", { size: 16, italic: true, anchor: "middle", color: GREY });

  // out of the line
  arrow("M418,586 H392 V752", 392, 757, 90);
}

function rowPass() {
  // 5 score: the odds board
  rect(150, 846, 340, 236, WOOD, { rx: 4 });
  hrect(460, 850, 26, 228, "hatch");
  rect(164, 860, 312, 208, SLATE, { sw: 1.6 });
  const chalk = (x, y, s, o = {}) => text(x, y, s, { color: CHALK, layer: top, ...o });
  chalk(184, 896, "start with a good ___", { size: 17, italic: true });
  [["broth", 0.61], ["stock", 0.22], ["soup", 0.09], ["pot", 0.04]].forEach(([wd, p], i) => {
    const y = 936 + i * 28;
    chalk(184, y, wd, { size: 17 });
    top.push(`<rect x="250" y="${y - 13}" width="${Math.max(5, p * 260)}" height="15" rx="2" style="fill:${CHALK};opacity:.85"/>`);
    chalk(260 + Math.max(5, p * 260), y, `${Math.round(p * 100)}%`, { size: 14 });
  });
  chalk(184, 1050, "+ every other token", { size: 14, italic: true });
  step(332, 790, 5, "score", "odds for every token", BLUE);

  arrow("M418,790 H560", 565, 790, 0);

  // 6 spin: the weighted wheel
  wheel(650, 968, 100);
  claude(772, 1012, 0.5, { eyes: "wide" });
  path("M748,1016 L762,1032", "none", { sw: 1.6 });
  step(660, 790, 6, "spin", "pick one by its odds", BLUE);

  arrow("M752,790 H893", 898, 790, 0);

  // 7 plate: the new token lands in the bowl and on your screen
  bowl(990, 900, 170);
  tiles(916, 878, ["start", "with", "a", "good"], { size: 12, gap: 3 });
  tiles(962, 851, ["broth"], { size: 13, fills: [TERRA] });
  path("M952,855 l-10,-6 M952,867 l-12,0 M1024,855 l10,-6 M1024,867 l12,0", "none", { sw: 1.4 });
  rect(912, 1000, 160, 98, WHITE, { rx: 6 });
  hrect(1064, 1004, 5, 90, "hatchDense");
  rect(922, 1010, 140, 78, CREAM, { sw: 1.4 });
  path("M892,1098 H1092 L1102,1112 H882 Z", STEEL);
  text(932, 1040, "Start with a", { size: 14 });
  text(932, 1062, "good", { size: 14 });
  text(976, 1062, "broth", { size: 14, weight: 700, color: RED });
  inkPath("M1024,1050 h7 v15 h-7 Z");
  step(990, 790, 7, "plate", "add it, show it", TERRA);

  // the next lap: only the new token goes back to the line
  rect(1046, 724, 520, 12, STEEL, { rx: 6, sw: 1.6 });
  for (let x = 1060; x < 1566; x += 28) circ(x, 730, 3, WHITE, { sw: 1 });
  tiles(1110, 702, ["broth"], { size: 12, fills: [TERRA] });
  arrow("M1036,760 V744 H1578 V586 H1514", 1508, 586, 180);
  note(1400, 714, "next lap: just the new token", { size: 17 });

  // the three ways a reply ends
  arrow("M1082,790 H1235", 1240, 790, 0);
  step(1300, 790, 0, "done", "stop token", SAGE);
  bell(1478, 812, 0.85);
  text(1532, 760, "ding!", { size: 17, italic: true });

  arrowQ(1082, 804, 1180, 950, 1222, 950);
  step(1300, 950, 0, "full", "length limit", RED);
  bowl(1478, 940, 104);
  tiles(1438, 916, ["…", "and", "the"], { size: 10, gap: 2 });
  path("M1428,942 c-4,14 -2,26 -7,40 M1528,942 c4,14 2,26 7,40", "none", { stroke: RED, sw: 1.8 });

  arrowQ(1082, 818, 1150, 1110, 1214, 1110);
  step(1300, 1110, 0, "fetch", "uses a tool", BLUE);
  claude(1446, 1082, 0.42, { eyes: "wide" });
  rect(1528, 1100, 40, 26, WOOD, { rx: 3, sw: 1.6 });
  path("M1532,1100 Q1548,1080 1564,1100", "none", { sw: 1.6 });
  path("M1410,1096 h-18 M1414,1112 h-26 M1410,1128 h-18", "none", { sw: 1.5 });
}

function wheel(cx, cy, r) {
  const slices = [[0.61, TERRA, "broth"], [0.22, MUST, "stock"], [0.09, SAGE, ""], [0.04, BLUE, ""], [0.04, PINK, ""]];
  let a0 = -90 - 0.61 * 180;
  for (const [p, c, name] of slices) {
    const a1 = a0 + p * 360;
    const r0 = (a0 * Math.PI) / 180, r1 = (a1 * Math.PI) / 180;
    const large = p > 0.5 ? 1 : 0;
    path(`M${cx},${cy} L${cx + r * Math.cos(r0)},${cy + r * Math.sin(r0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(r1)},${cy + r * Math.sin(r1)} Z`, c, { sw: 1.6 });
    if (name) {
      const am = ((a0 + a1) / 2) * Math.PI / 180, lr = p > 0.3 ? r * 0.55 : r * 0.66;
      text(cx + lr * Math.cos(am), cy + lr * Math.sin(am) + 5, name, { size: p > 0.3 ? 16 : 13, anchor: "middle", weight: 700 });
    }
    a0 = a1;
  }
  hpath(`M${cx},${cy} m${r * 0.2},${r * 0.95} A${r},${r} 0 0 0 ${cx + r},${cy} L${cx + r * 0.85},${cy} A${r * 0.85},${r * 0.85} 0 0 1 ${cx + r * 0.17},${cy + r * 0.82} Z`, "hatch");
  circ(cx, cy, r, "none", { sw: 2.4 });
  circ(cx, cy, 9, WOOD, { sw: 1.6 });
  path(`M${cx - 10},${cy - r - 18} H${cx + 10} L${cx},${cy - r + 6} Z`, RED, { sw: 1.6 });
  path(`M${cx - 30},${cy + r + 30} L${cx},${cy} L${cx + 30},${cy + r + 30}`, "none", { sw: 3 });
}

export function buildPoster() {
  base = [];
  top = [];
  header();
  rowPrep();
  rowLine();
  rowPass();

  const pat = (id, gap, sw, op = 1) =>
    `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${INK}" stroke-width="${sw}" opacity="${op}"/></pattern>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    ${pat("hatch", 5, 1, 0.75)}${pat("hatchDense", 3.2, 0.9, 0.8)}${pat("hatchLight", 5, 0.8, 0.45)}
    <filter id="wob" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="riso" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.45" result="a"/>
      <feComposite in="SourceGraphic" in2="a" operator="in" result="speck"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="2" result="w"/>
      <feDisplacementMap in="speck" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="paper" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="1"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 -1.2 0.75"/>
    </filter>
    <g id="base">${base.join("\n")}</g>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="${H}" filter="url(#paper)" opacity="0.16"/>
  <use href="#base" filter="url(#wob)" style="--pf:${PAPER}"/>
  <use href="#base" filter="url(#riso)" transform="translate(2.6 1.8)"
       style="--pf:initial;--sk:transparent;--tf:transparent;--ho:0;mix-blend-mode:multiply;opacity:.9"/>
  <g filter="url(#wob)">${top.join("\n")}</g>
</svg>`;
}
