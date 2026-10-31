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

// ---------- page sections ----------
function header() {
  text(68, 80, "the kitchen of claude  ·  I", { size: 22, ls: 2 });
  text(60, 170, "How Claude", { size: 78, weight: 700 });
  text(60, 252, "cooks", { size: 78, weight: 700 });
  text(66, 306, "your words in, a reply out,", { size: 24, italic: true });
  text(66, 336, "one token at a time", { size: 24, italic: true });
}

function rowPrep() {
  // start
  circ(740, 32, 15, "none", { sw: 1.6 });
  circ(740, 32, 10, RED);
  arrow("M740,49 V74", 740, 79, 90);
  label(728, 68, ["you hit send"], { anchor: "end", size: 17 });

  // A: your words, an order slip on the rail
  ticket(740, 112, "your words", MUST);
  rect(640, 168, 200, 9, STEEL, { rx: 3 });
  hrect(640, 172, 200, 5, "hatchDense");
  path("M668,176 L816,174 L820,300 L812,306 L804,300 L796,306 L788,300 L780,306 L772,300 L764,306 L756,300 L748,306 L740,300 L732,306 L724,300 L716,306 L708,300 L700,306 L692,300 L684,306 L676,300 L670,304 Z", WHITE);
  hpath("M808,180 L816,180 L819,298 L811,302 Z", "hatch");
  text(680, 200, "table 1 · order", { size: 12, color: RED, rot: -0.8 });
  text(680, 236, "how do i", { size: 19, italic: true, rot: -0.8 });
  text(680, 266, "make ramen?", { size: 19, italic: true, rot: -0.8 });

  arrow("M840,112 H921", 926, 112, 0);
  label(883, 52, ["chopped", "into tokens"]);

  // B: a row of tokens, chopped at the board
  ticket(1060, 112, "a row of tokens", MUST);
  claude(1029, 200, 0.42, { eyes: "squint" });
  path("M1100,224 L1146,190 L1152,197 L1108,231 Z", STEEL, { sw: 1.6 });
  path("M1096,227 L1104,221 L1110,229 L1102,235 Z", WOOD, { sw: 1.6 });
  path("M1158,180 l8,-6 M1162,192 l10,-2 M1150,172 l2,-9", "none", { sw: 1.4 });
  rect(924, 262, 274, 24, WOOD, { rx: 4 });
  hrect(924, 278, 274, 8, "hatchDense");
  tiles(929, 237, PROMPT, { size: 14, gap: 5 });

  arrow("M1196,112 H1262", 1267, 112, 0);
  label(1222, 52, ["each gets a", "flavor card"]);

  // C: a row of vectors, every tile with its card of numbers and a seat number
  ticket(1410, 112, "a row of vectors", MUST);
  const nums = [["0.21", "-1.30", "0.07"], ["-0.62", "0.48", "1.15"], ["0.93", "-0.04", "-0.81"], ["0.10", "0.77", "-0.39"]];
  ["how", "do", "i", "make"].forEach((wd, i) => {
    const cx = 1302 + i * 66;
    rect(cx - 28, 190, 56, 84, WHITE, { sw: 1.6 });
    hrect(cx + 23, 192, 4, 80, "hatchDense");
    nums[i].forEach((n, j) => text(cx - 2, 212 + j * 17, n, { size: 12, anchor: "middle" }));
    text(cx - 2, 264, "⋮", { size: 12, anchor: "middle" });
    circ(cx + 23, 192, 10, MUST, { sw: 1.4 });
    text(cx + 23, 196.5, String(i + 1), { size: 12, weight: 700, anchor: "middle" });
    const w = tileW(wd, 13);
    tiles(cx - w / 2, 284, [wd], { size: 13 });
  });
  text(1548, 236, "…", { size: 24, anchor: "middle" });

  // into the line: the whole prompt at once
  arrow("M1552,112 H1578 V545 H1512", 1506, 545, 180);
  label(1566, 360, ["all at once,", "the first time"], { anchor: "end" });
}

function station(sx, name, o = {}) {
  const cx = sx + 150;
  path(`M${cx - 30},392 V418 M${cx + 30},392 V418`, "none", { sw: 1.4 });
  rect(cx - 56, 418, 112, 32, WHITE, { rx: 2 });
  hrect(cx + 50, 420, 4, 28, "hatchDense");
  text(cx, 440, name, { size: 18, anchor: "middle", weight: 700 });
  claude(sx + 30, 548, 0.38, { eyes: o.eyes || "open" });
  return tiles(sx + 92, 574, PROMPT, { size: 11, gap: 3, fills: o.fills });
}

function rowLine() {
  // the counter
  rect(430, 598, 1092, 14, WOOD);
  hrect(430, 606, 1092, 6, "hatchDense");
  rect(440, 612, 1072, 84, CREAM);
  path("M440,670 H1512", "none", { sw: 1.2 });
  for (let x = 500; x < 1512; x += 62) path(`M${x},670 V694`, "none", { sw: 1.2 });

  // layer 1: attention
  const t1 = station(1200, "layer 1", { eyes: "wide" });
  const mk = t1[3];
  for (const k of [0, 1, 2]) {
    const a = t1[k];
    path(`M${mk.cx},571 Q${(mk.cx + a.cx) / 2},${540 - (3 - k) * 5} ${a.cx},571`, "none", { stroke: INK, sw: 1.3, dash: "3 4" });
  }
  // velvet rope: no peeking ahead
  const rx = t1[4].x - 1;
  rect(rx - 2, 548, 4, 26, MUST, { sw: 1.2 });
  circ(rx, 546, 4, MUST, { sw: 1.2 });
  path(`M${rx},554 Q${rx + 20},566 ${rx + 40},554`, "none", { stroke: RED, sw: 2.6 });
  label(1350, 638, ["attention: each tastes", "the ones before it [never ahead]"], { size: 16, lh: 20 });

  // layer 2: feed-forward
  const t2 = station(900, "layer 2", { eyes: "squint" });
  path("M1010,532 L1022,520 L1036,534 L1024,546 Z", WHITE, { sw: 1.5 });
  path("M1011,531 L1023,519", "none", { sw: 4 });
  for (const [px, py] of [[1040, 548], [1050, 558], [1036, 560], [1062, 566], [1046, 568], [1072, 556]]) circ(px, py, 1.4, INK, { stroke: "none" });
  label(1050, 638, ["feed-forward: each gets", "seasoned on its own"], { size: 16, lh: 20 });

  // the middle: the state ticket and the rest of the stations
  ticket(820, 478, "inside a layer", TERRA);
  text(820, 590, "· · ·", { size: 30, anchor: "middle", weight: 700 });
  label(820, 645, ["many more", "layers"], { size: 16, lh: 20 });

  // layer N: fully cooked
  station(440, "layer N", { eyes: "happy", fills: Array(7).fill(MUST) });
  label(590, 638, ["the last layer: every token", "knows its whole context"], { size: 16, lh: 20 });

  // next layer, again and again
  arrowQ(1292, 426, 1200, 384, 1112, 424);
  arrowQ(992, 426, 820, 372, 652, 424);
  label(1050, 372, ["next layer [repeats many times]"], { size: 18 });

  // the cache, a clipboard on the wall
  path("M240,452 V464", "none", { sw: 2 });
  rect(132, 470, 216, 214, WOOD, { rx: 8 });
  hrect(310, 474, 34, 206, "hatch", 6);
  rect(146, 488, 188, 184, WHITE);
  rect(205, 460, 70, 26, STEEL, { rx: 5 });
  hrect(205, 476, 70, 10, "hatchDense");
  text(240, 516, "the cache", { size: 19, weight: 700, anchor: "middle" });
  const rows = ["how", "do", "i", "make", "ram", "en", "?", "start…"];
  rows.forEach((r, i) => {
    const y = 540 + (i % 4) * 22, x = i < 4 ? 158 : 248;
    text(x, y, r, { size: 13 });
    path(`M${x + 44},${y - 4} q6,-4 12,0 t12,0 t12,0`, "none", { sw: 1.1 });
  });
  text(240, 640, "notes from every lap, so", { size: 11, italic: true, anchor: "middle" });
  text(240, 656, "old tokens never re-walk", { size: 11, italic: true, anchor: "middle" });

  // out of the line
  arrow("M532,434 H420 V748", 420, 754, 90);
  label(408, 700, ["after the", "last layer"], { anchor: "end" });
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

function rowPass() {
  // E: a score for every token, on the chalkboard
  ticket(250, 790, "a score for every token", BLUE);
  rect(70, 842, 352, 232, WOOD, { rx: 4 });
  hrect(390, 846, 28, 224, "hatch");
  rect(84, 856, 324, 204, SLATE, { sw: 1.6 });
  const chalk = (x, y, s, o = {}) => text(x, y, s, { color: CHALK, layer: top, ...o });
  chalk(100, 884, "what comes after", { size: 16 });
  chalk(100, 906, "\"start with a good …\"", { size: 16, italic: true });
  [["broth", 0.61], ["stock", 0.22], ["soup", 0.09], ["pot", 0.04]].forEach(([wd, p], i) => {
    const y = 940 + i * 27;
    chalk(100, y, wd, { size: 16 });
    top.push(`<rect x="170" y="${y - 13}" width="${Math.max(4, p * 300)}" height="14" rx="2" style="fill:${CHALK};opacity:.85"/>`);
    chalk(178 + Math.max(4, p * 300), y, `${Math.round(p * 100)}%`, { size: 14 });
  });
  chalk(100, 1046, "+ tens of thousands more", { size: 13, italic: true });

  arrow("M444,790 H550", 555, 790, 0);
  label(500, 734, ["the scores", "become odds"]);

  // F: picking one, at the wheel
  ticket(610, 790, "picking one", BLUE);
  wheel(600, 950, 84);
  claude(712, 990, 0.4, { eyes: "wide" });

  arrowQ(718, 780, 778, 758, 838, 780);
  arrowQ(718, 802, 778, 824, 838, 802);
  label(778, 718, ["take the favorite", "[if temperature is 0]"], { size: 17, lh: 19 });
  label(780, 852, ["spin the wheel", "[otherwise]"], { size: 17, lh: 19 });

  // G: a new token lands in the bowl and on your screen
  ticket(945, 790, "a new token", TERRA);
  path("M864,880 H1026 C1022,930 990,950 945,950 C900,950 868,930 864,880 Z", WHITE);
  hpath("M990,890 H1022 C1016,926 996,944 970,948 C990,930 994,910 990,890 Z", "hatch");
  path("M915,950 H975 L970,962 H920 Z", BLUE, { sw: 1.6 });
  path("M868,896 H1022", "none", { stroke: RED, sw: 1.2 });
  tiles(874, 858, ["start", "with", "a", "good"], { size: 11, gap: 3 });
  tiles(1008, 834, ["broth"], { size: 12, fills: [TERRA] });
  path("M1052,834 l8,-6 M1054,846 l10,0", "none", { sw: 1.2 });
  path("M880,852 c-6,-10 6,-14 0,-24 M1036,858 c-6,-10 6,-14 0,-24", "none", { sw: 1.3 });
  // your screen
  rect(866, 984, 160, 100, WHITE, { rx: 6 });
  hrect(1018, 988, 5, 92, "hatchDense");
  rect(876, 994, 140, 80, CREAM, { sw: 1.4 });
  path("M846,1084 H1046 L1056,1098 H836 Z", STEEL);
  text(1006, 1012, "how do i make ramen?", { size: 9.5, anchor: "end", italic: true });
  text(884, 1036, "Start with a good", { size: 12 });
  text(884, 1056, "broth", { size: 12, weight: 700, color: RED });
  inkPath("M924,1046 h7 v13 h-7 Z");

  // back to the line with just the new token
  arrow("M1040,759 V715 H1578 V545 H1512", 1506, 545, 180);
  label(1100, 742, ["otherwise: it reaches your screen, and only the", "new token goes back [one at a time after that]"], { anchor: "start", size: 17, lh: 19 });

  // endings
  arrow("M1048,804 H1281", 1287, 804, 0);
  label(1190, 828, ["a stop token"], { size: 17 });
  ticket(1340, 814, "done", SAGE);
  // the bell
  path("M1426,830 C1426,800 1470,800 1470,830 Z", MUST);
  hpath("M1454,808 C1464,812 1470,820 1470,830 H1460 C1460,820 1458,812 1454,808 Z", "hatch");
  rect(1418, 830, 60, 8, WOOD, { rx: 2 });
  rect(1444, 796, 8, 6, MUST, { sw: 1.4 });
  path("M1414,800 l-10,-8 M1448,786 v-12 M1482,800 l10,-8", "none", { sw: 1.4 });
  text(1500, 784, "ding!", { size: 15, italic: true });

  arrowQ(1048, 816, 1140, 934, 1268, 934);
  label(1215, 880, ["the length", "limit is hit"], { size: 17, lh: 19 });
  ticket(1360, 934, "cut short", RED);
  path("M1470,930 H1550 C1548,960 1532,972 1510,972 C1488,972 1472,960 1470,930 Z", WHITE);
  tiles(1474, 908, ["…", "and", "the"], { size: 10, gap: 2 });
  path("M1474,930 c-4,12 -2,22 -6,34 M1546,930 c4,12 2,22 6,34", "none", { stroke: RED, sw: 1.6 });

  arrowQ(1048, 828, 1090, 1054, 1250, 1054);
  label(1200, 990, ["it asks", "for a tool"], { size: 17, lh: 19 });
  ticket(1400, 1054, "paused for a tool", BLUE);
  label(1400, 1112, ["the tool's answer is added", "to your words; cooking resumes"], { size: 15, lh: 18 });
}

function houseRules() {
  path("M70,1140 H1180 V1218 H70 Z", "none", { sw: 1.4, dash: "6 6" });
  text(90, 1172, "house rules", { size: 20, weight: 700 });
  text(90, 1202, "never peeks ahead · only adds to the end · always fits the window · one token per lap", { size: 16, italic: true });
  put(`<g transform="rotate(-8 1110 1176)">`);
  circ(1110, 1176, 34, "none", { stroke: RED, sw: 2.4 });
  circ(1110, 1176, 28, "none", { stroke: RED, sw: 1 });
  text(1110, 1172, "checked", { size: 13, anchor: "middle", color: RED, weight: 700 });
  text(1110, 1192, "✓", { size: 20, anchor: "middle", color: RED, weight: 700 });
  put(`</g>`);
}

export function buildPoster() {
  base = [];
  top = [];
  header();
  rowPrep();
  rowLine();
  rowPass();
  houseRules();

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
