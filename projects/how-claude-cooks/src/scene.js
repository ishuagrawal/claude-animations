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
let layer = base;
const put = (s) => layer.push(s);

// A named group the animation can drive. `ox`/`oy` pin the pivot for rotation and scale;
// otherwise the animation uses the group's box center.
function G(id, fn, o = {}) {
  const piv = o.ox != null ? ` data-ox="${o.ox}" data-oy="${o.oy}"` : "";
  put(`<g id="${id}"${piv}${o.attrs ? " " + o.attrs : ""}>`);
  fn();
  put(`</g>`);
}
// Same, but in the top layer (drawn once, above both print passes).
function TG(id, fn, o = {}) {
  const prev = layer;
  layer = top;
  G(id, fn, o);
  layer = prev;
}

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
  put(`<path d="${d}"${o.attrs ? " " + o.attrs : ""} style="${paint(fill, o.stroke, o.sw)}${o.dash ? `;stroke-dasharray:${o.dash}` : ""}"/>`);
const hpath = (d, pat = "hatch") => put(`<path d="${d}" style="${hatchPaint(pat)}"/>`);
const circ = (cx, cy, r, fill, o = {}) =>
  put(`<circle cx="${cx}" cy="${cy}" r="${r}" style="${paint(fill, o.stroke, o.sw)}"/>`);
const hcirc = (cx, cy, r, pat = "hatch") => put(`<circle cx="${cx}" cy="${cy}" r="${r}" style="${hatchPaint(pat)}"/>`);
const inkPath = (d, c = INK) => put(`<path d="${d}" style="${inkFill(c)}"/>`);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function text(x, y, str, o = {}) {
  const { size = 20, weight = 400, italic = false, anchor = "start", color = INK, ls = 0, rot = 0 } = o;
  const fill = layer === top ? `fill:${color}` : inkFill(color);
  layer.push(
    `<text${o.id ? ` id="${o.id}"` : ""} x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" font-style="${italic ? "italic" : "normal"}"` +
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
  path(d, "none", { stroke: RED, sw: 2.4, dash: o.dash, attrs: 'pathLength="1" class="draw"' });
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
// Every part the animation moves is its own group: <id>-body (breathes, hops), -eyes (looks
// around) with one group per expression, -armL/-armR (hold props, drawn in page coordinates),
// -hat, -legA/-legB, and the reaction marks -bang / -sweat / -note.
const EXPRESSIONS = ["open", "squint", "wide", "happy", "blink"];
function eyesOf(e) {
  if (e === "happy") path("M20,36 L28,24 L36,36 M112,36 L120,24 L128,36", "none", { sw: 3.4 });
  else if (e === "squint") inkPath("M19,28 H37 V34 H19 Z M111,28 H129 V34 H111 Z");
  else if (e === "blink") inkPath("M18,30 H38 V33 H18 Z M110,30 H130 V33 H110 Z");
  else if (e === "wide") {
    inkPath("M18,16 H38 V40 H18 Z M110,16 H130 V40 H110 Z");
    circ(23, 21, 3, WHITE, { stroke: "none" });
    circ(115, 21, 3, WHITE, { stroke: "none" });
  } else inkPath("M20,20 H36 V38 H20 Z M112,20 H128 V38 H112 Z");
}
function claude(id, x, y, s = 1, o = {}) {
  const { eyes = "open", hat = true, apron = true, legs = true } = o;
  const inPage = (fn) => { put(`<g transform="scale(${1 / s}) translate(${-x} ${-y})">`); fn(); put(`</g>`); };
  const hidden = { attrs: 'opacity="0"' };
  G(id, () => {
    put(`<g transform="translate(${x} ${y}) scale(${s})">`);
    G(`${id}-body`, () => {
      if (legs) {
        G(`${id}-legA`, () => { rect(2, 100, 18, 42, TERRA); rect(94, 100, 18, 42, TERRA); }, { ox: 57, oy: 100 });
        G(`${id}-legB`, () => { rect(38, 100, 18, 42, TERRA); rect(130, 100, 18, 42, TERRA); }, { ox: 93, oy: 100 });
      }
      G(`${id}-armL`, () => { rect(-36, 36, 38, 34, TERRA); if (o.propL) inPage(o.propL); }, { ox: 2, oy: 53 });
      G(`${id}-armR`, () => { rect(148, 36, 38, 34, TERRA); hrect(150, 52, 34, 17); if (o.propR) inPage(o.propR); }, { ox: 148, oy: 53 });
      rect(0, 0, 150, 107, TERRA);
      hrect(104, 2, 44, 103);
      if (apron) {
        path("M44,44 H106 V107 H44 Z", WHITE);
        path("M44,62 C25,60 12,56 4,50 M106,62 C125,60 138,56 146,50", "none", { sw: 1.6 });
        path("M58,74 H92 V92 H58 Z", "none", { sw: 1.4 });
      }
      G(`${id}-eyes`, () => EXPRESSIONS.forEach((e) =>
        G(`${id}-e-${e}`, () => eyesOf(e), e === eyes ? {} : hidden)), { ox: 75, oy: 28 });
      circ(18, 50, 7, PINK, { stroke: "none" });
      circ(132, 50, 7, PINK, { stroke: "none" });
      if (hat) G(`${id}-hat`, () => {
        circ(46, -40, 21, WHITE);
        circ(104, -40, 21, WHITE);
        circ(75, -52, 26, WHITE);
        hcirc(110, -38, 12, "hatchLight");
        rect(36, -30, 78, 30, WHITE);
        path("M50,-28 V-2 M66,-28 V-2 M84,-28 V-2 M100,-28 V-2", "none", { sw: 1.1 });
      }, { ox: 75, oy: 0 });
      G(`${id}-sweat`, () => path("M168,-6 c-8,12 -10,18 -4,22 c6,4 12,-2 4,-22 Z", BLUE, { sw: 2 }), hidden);
      G(`${id}-bang`, () => text(176, 18, "!", { size: 64, weight: 700, color: RED }), { ...hidden, ox: 180, oy: 0 });
      G(`${id}-note`, () => text(-70, -30, "♪", { size: 56, color: INK }), hidden);
    }, { ox: 75, oy: 142 });
    put(`</g>`);
  });
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
    if (o.ids) put(`<g id="${o.ids}-${i}">`);
    rect(cx, y, w, h, fill, { rx: 3, sw: 1.6 });
    hrect(cx + w - 4, y + 2, 3, h - 4, "hatchDense");
    text(cx + w / 2, y + h * 0.7, wd, { size, anchor: "middle" });
    if (o.ids) put(`</g>`);
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
// Group ids are what src/anim.js drives: s1..s7 are the numbered steps, st1/st2/stN the
// three stations on the line, e-* the endings, and arr-* the arrows that draw themselves on.

function header() {
  G("hdr-kicker", () => text(64, 78, "the kitchen of claude  ·  I", { size: 20, ls: 2 }));
  G("hdr-title1", () => text(58, 168, "How Claude", { size: 80, weight: 700 }));
  G("hdr-title2", () => text(58, 252, "cooks", { size: 80, weight: 700 }));
  G("hdr-hero", () => claude("hero", 440, 214, 0.5, { eyes: "open", propR: () => {
    path("M528,246 L556,186", "none", { stroke: WOOD, sw: 5 });
    path("M528,246 L556,186", "none", { sw: 1.2 });
    path("M550,190 c-6,-14 6,-26 14,-18 c8,8 -2,22 -14,18 Z", WOOD, { sw: 1.6 });
  } }));
  G("hdr-sub", () => {
    text(64, 300, "how an AI writes a reply,", { size: 23, italic: true });
    text(64, 330, "one token at a time", { size: 23, italic: true });
  });
}

function rowPrep() {
  G("start-dot", () => {
    circ(598, 300, 14, "none", { sw: 1.6 });
    circ(598, 300, 9, RED);
  });
  G("arr-start", () => arrow("M613,300 H655", 660, 300, 0));

  // 1 order: a receipt prints down from the rail
  G("s1-rail", () => {
    rect(648, 86, 196, 10, STEEL, { rx: 3 });
    hrect(648, 91, 196, 5, "hatchDense");
    path("M656,86 V70 M836,86 V70", "none", { sw: 2 });
  });
  G("s1-slip", () => G("s1-slip-paper", () => {
    let slip = "M670,94 L822,92 L824,236";
    for (let i = 0; i <= 19; i++) slip += ` L${824 - i * 8},${236 + (i % 2 ? 0 : 7)}`;
    path(slip + " Z", WHITE);
    hpath("M812,98 L822,98 L824,234 L814,236 Z");
    text(684, 124, "table 1", { size: 14, color: RED, rot: -1 });
    text(684, 168, "how do i", { size: 21, italic: true, rot: -1 });
    text(684, 200, "make ramen?", { size: 20, italic: true, rot: -1 });
  }), { attrs: 'clip-path="url(#clipSlip)"' });
  G("s1-ticket", () => step(752, 300, 1, "order", "your words", MUST));

  G("arr-12", () => arrow("M846,300 H917", 922, 300, 0));

  // 2 chop: Claude brings the cleaver down, one token per chop
  G("s2-board", () => {
    rect(914, 205, 276, 28, WOOD, { rx: 4 });
    hrect(914, 222, 276, 11, "hatchDense");
  });
  G("s2-claude", () => claude("c2", 1006, 118, 0.6, { eyes: "squint", propR: () => {
    path("M1110,152 L1146,112 L1170,132 L1134,170 Z", STEEL, { sw: 1.8 });
    hpath("M1150,118 L1170,132 L1150,154 Z", "hatch");
    path("M1104,160 L1114,150 L1124,160 L1114,170 Z", WOOD, { sw: 1.6 });
  } }));
  G("s2-tiles", () => tiles(921, 181, PROMPT, { size: 14, gap: 5, ids: "s2-t" }));
  G("s2-lines", () => path("M1180,108 l12,-10 M1186,128 l16,-2 M1166,96 l4,-14", "none", { sw: 1.6 }));
  G("s2-ticket", () => step(1052, 300, 2, "chop", "into tokens", MUST));

  G("arr-23", () => arrow("M1158,300 H1271", 1276, 300, 0));

  // 3 flavor: each jar tips in, and each token gets its own flavor profile
  G("s3-shelf", () => {
    rect(1258, 134, 280, 9, WOOD, { rx: 2 });
    hrect(1258, 139, 280, 4, "hatchDense");
    path("M1276,143 l10,14 M1520,143 l-10,14", "none", { sw: 2 });
  });
  const profiles = [[0.9, 0.3, 0.6, 0.2], [0.4, 0.8, 0.2, 0.7], [0.2, 0.5, 0.9, 0.4], [0.7, 0.2, 0.4, 0.9]];
  [[1292, TERRA], [1362, SAGE], [1432, MUST], [1502, BLUE]].forEach(([x, c], k) =>
    G(`s3-jar-${k}`, () => jar(x, 70, c), { ox: x, oy: 134 }));
  ["how", "do", "i", "make"].forEach((wd, i) => {
    const cx = 1292 + i * 70;
    G(`s3-bars-${i}`, () => flavorBars(cx, 152, profiles[i]), { ox: cx - 26, oy: 170 });
    G(`s3-tile-${i}`, () => {
      const w = tileW(wd, 14);
      tiles(cx - w / 2, 204, [wd], { size: 14 });
      circ(cx - w / 2, 204, 8, CREAM, { sw: 1.2 });
      text(cx - w / 2, 208, String(i + 1), { size: 10, weight: 700, anchor: "middle" });
    });
  });
  G("s3-more", () => text(1556, 220, "…", { size: 22, anchor: "middle" }));
  G("s3-ticket", () => step(1404, 300, 3, "flavor", "tokens become numbers", MUST));

  // into the line, the whole prompt at once
  G("arr-3L", () => arrow("M1488,300 H1578 V586 H1514", 1508, 586, 180));
  G("s3-note", () => note(1568, 374, "all at once", { anchor: "end" }));
}

// A burner flame, drawn as a teardrop.
function flame(x, y) {
  path(`M${x},${y} c-5,-4 -4,-10 0,-14 c4,4 5,10 0,14 Z`, TERRA, { sw: 1.1 });
  path(`M${x},${y - 1} c-2,-2 -2,-5 0,-7 c2,2 2,5 0,7 Z`, MUST, { stroke: "none" });
}

// A thought bubble: what a token has worked out so far (a tiny icon and a word or two).
function thought(id, cx, word, icon, tailX) {
  const w = 40 + word.length * 8.4 + 12, x = cx - w / 2;
  G(id, () => {
    path(`M${x + 10},478 H${x + w - 10} Q${x + w},478 ${x + w},488 V498 Q${x + w},508 ${x + w - 10},508 H${x + 10} Q${x},508 ${x},498 V488 Q${x},478 ${x + 10},478 Z`, WHITE, { sw: 1.6 });
    circ((cx + tailX) / 2, 514, 3.6, WHITE, { sw: 1.4 });
    circ(tailX, 522, 2.2, WHITE, { sw: 1.2 });
    const ix = x + 20, iy = 493;
    if (icon === "bowl") {
      path(`M${ix - 10},${iy - 2} H${ix + 10} C${ix + 9},${iy + 8} ${ix - 9},${iy + 8} ${ix - 10},${iy - 2} Z`, TERRA, { sw: 1.4 });
      path(`M${ix + 2},${iy - 3} L${ix + 12},${iy - 12} M${ix + 6},${iy - 3} L${ix + 14},${iy - 9}`, "none", { sw: 1.4 });
    } else if (icon === "recipe") {
      rect(ix - 8, iy - 10, 16, 20, CREAM, { sw: 1.4 });
      path(`M${ix - 4},${iy - 4} H${ix + 4} M${ix - 4},${iy} H${ix + 4} M${ix - 4},${iy + 4} H${ix + 2}`, "none", { sw: 1.1 });
    } else {
      path(`M${ix - 10},${iy} H${ix + 8} M${ix + 3},${iy - 6} L${ix + 9},${iy} L${ix + 3},${iy + 6}`, "none", { stroke: RED, sw: 2.4 });
    }
    text(x + 36, 498, word, { size: 14, weight: 700, color: icon === "next" ? RED : INK });
  }, { ox: tailX, oy: 522 });
}

// One station of the line: a sign, a burner with a sheet tray of tokens, the chef and the oven.
// Every station runs the same two moves on the same tray: the focus token tastes back at every
// earlier token (thicker line = it matters more) but never ahead, then every token gets its own
// pinch of seasoning. What changes from layer to layer is what the tokens have worked out (the
// thought bubble) and how cooked they look.
function station(id, c, name, o) {
  G(`${id}-sign`, () => {
    path(`M${c - 34},398 V440 M${c + 34},398 V440`, "none", { sw: 1.4 });
    rect(c - 58, 440, 116, 32, WHITE, { rx: 2 });
    hrect(c + 52, 442, 4, 28, "hatchDense");
    text(c, 462, name, { size: 18, weight: 700, anchor: "middle" });
  }, { ox: c, oy: 398 });
  G(`${id}-oven`, () => {
    for (let k = 0; k < 5; k++) circ(c - 140 + k * 45, 622, 4.5, WHITE, { sw: 1.3 });
    rect(c - 160, 632, 230, 54, WHITE, { rx: 3, sw: 1.6 });
    path(`M${c - 130},639 H${c + 40}`, "none", { sw: 3 });
    rect(c - 146, 646, 202, 36, SLATE, { rx: 2, sw: 1.2 });
    G(`${id}-glow`, () => { put(`<g opacity="0.4">`); rect(c - 146, 646, 202, 36, MUST, { rx: 2, stroke: "none" }); put(`</g>`); });
    path(`M${c - 120},676 l6,-10 6,10 M${c - 60},676 l6,-10 6,10 M${c},676 l6,-10 6,10`, "none", { stroke: MUST, sw: 1.6 });
    hrect(c + 30, 648, 24, 32, "hatchLight");
  });
  G(`${id}-claude`, () => claude(`${id}-c`, c + 62, 538, 0.5, { eyes: o.eyes, legs: false, propL: () => {
    path(`M${c + 40},520 L${c + 54},506 L${c + 70},522 L${c + 56},536 Z`, WHITE, { sw: 1.6 });
    path(`M${c + 41},519 L${c + 55},505`, "none", { sw: 4 });
  } }));
  G(`${id}-flames`, () => {
    for (let x = c - 150; x <= c + 30; x += 30) flame(x, 596);
  }, { ox: c - 60, oy: 596 });
  let t;
  G(`${id}-tray`, () => {
    path(`M${c - 166},581 V596 M${c + 50},581 V596`, "none", { sw: 2 });
    rect(c - 172, 574, 228, 7, STEEL, { rx: 2, sw: 1.6 });
    hrect(c - 172, 577, 228, 4, "hatchDense");
    const fills = PROMPT.map((_, i) => (i === o.focus ? TERRA : o.tone));
    t = tiles(c - 164, 555, PROMPT, { size: 11, gap: 3, fills, ids: `${id}-t` });
  });
  for (let k = 0; k < 3; k++)
    G(`${id}-steam-${k}`, () => path(`M${c - 136 + k * 74},548 c-6,-8 6,-12 0,-20 c-6,-8 6,-12 0,-18`, "none", { sw: 1.3 }), { ox: c - 136 + k * 74, oy: 548 });
  const f = t[o.focus];
  o.arcs.forEach((sw, k) => {
    const a = t[k], peak = 546 - (f.cx - a.cx) * 0.16;
    G(`${id}-arc-${k}`, () =>
      path(`M${f.cx},553 Q${(f.cx + a.cx) / 2},${peak} ${a.cx},553`, "none",
        { stroke: RED, sw, dash: sw < 2 ? "3 4" : null, attrs: sw < 2 ? "" : 'pathLength="1" class="draw"' }));
  });
  const rx = o.focus < 6 ? t[o.focus + 1].x - 1.5 : f.x + f.w + 6;
  G(`${id}-rope`, () => {
    rect(rx - 2, 530, 4, 26, MUST, { sw: 1.2 });
    circ(rx, 528, 4, MUST, { sw: 1.2 });
    path(`M${rx},535 Q${rx + 16},548 ${rx + 30},535`, "none", { stroke: RED, sw: 2.6 });
  }, { ox: rx, oy: 556 });
  G(`${id}-grains`, () => {
    for (const [dx, dy] of [[34, 542], [28, 548], [38, 552]]) circ(c + dx, dy, 1.5, INK, { stroke: "none" });
    t.forEach((tl) => [-4, 0, 4].forEach((dx, j) => circ(tl.cx + dx, 553 + (j % 2), 1.3, INK, { stroke: "none" })));
  });
  thought(`${id}-think`, c - 40, o.think[0], o.think[1], f.cx);
  return t;
}

// The kitchen wall behind the line: subway tiles, a utensil rail, a clock, a pan and a ladle.
function kitchenWall() {
  G("k-wall", () => {
    put(`<g opacity="0.22">`);
    for (let y = 400, r = 0; y < 596; y += 24, r++) {
      path(`M424,${y} H1518`, "none", { sw: 1 });
      for (let x = 424 + (r % 2 ? 24 : 0); x < 1518; x += 48) path(`M${x},${y} V${Math.min(596, y + 24)}`, "none", { sw: 1 });
    }
    put(`</g>`);
  });
  G("k-rail", () => {
    rect(420, 390, 1102, 7, STEEL, { rx: 3, sw: 1.6 });
    path("M432,397 v10 M1510,397 v10", "none", { sw: 3 });
  });
  G("k-clock", () => {
    path("M470,397 V406", "none", { sw: 1.4 });
    circ(470, 428, 21, WHITE, { sw: 1.8 });
    hcirc(478, 432, 14, "hatchLight");
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      path(`M${470 + 16 * Math.cos(a)},${428 + 16 * Math.sin(a)} L${470 + 18.5 * Math.cos(a)},${428 + 18.5 * Math.sin(a)}`, "none", { sw: 1.2 });
    }
    G("k-clock-hr", () => path("M470,428 V418", "none", { sw: 2.6 }), { ox: 470, oy: 428 });
    G("k-clock-min", () => path("M470,428 L482,428", "none", { sw: 1.8 }), { ox: 470, oy: 428 });
    circ(470, 428, 2.2, INK, { stroke: "none" });
  });
  G("k-pan", () => {
    path("M1458,397 V420", "none", { sw: 1.4 });
    rect(1454, 418, 8, 18, WOOD, { rx: 3, sw: 1.4 });
    circ(1458, 452, 17, SLATE, { sw: 1.8 });
    circ(1458, 452, 12, "none", { sw: 1, stroke: CHALK });
  }, { ox: 1458, oy: 397 });
  G("k-ladle", () => {
    path("M1500,397 V444", "none", { stroke: STEEL, sw: 4 });
    path("M1500,397 V444", "none", { sw: 1 });
    path("M1488,444 H1512 C1510,458 1490,458 1488,444 Z", STEEL, { sw: 1.6 });
  }, { ox: 1500, oy: 397 });
}

function rowLine() {
  kitchenWall();
  G("s4-counter", () => {
    rect(418, 596, 1104, 14, WOOD);
    hrect(418, 604, 1104, 6, "hatchDense");
    rect(428, 610, 1084, 82, CREAM);
  });

  // the same recipe at every layer; what the tokens understand grows
  station("st1", 1350, "layer 1", { eyes: "wide", tone: CREAM, focus: 5, arcs: [1, 1, 1.3, 2.2, 3.8], think: ["ramen", "bowl"] });
  station("st2", 1010, "layer 2", { eyes: "squint", tone: "#f3dfae", focus: 6, arcs: [1.3, 1, 1, 3.4, 2.4, 2.4], think: ["a recipe", "recipe"] });
  const tn = station("stN", 580, "layer N", { eyes: "happy", tone: MUST, focus: 6, arcs: [2.2, 1.4, 1.4, 2.6, 2.8, 2.8], think: ["start…", "next"] });
  G("stN-spark", () => path(`M${tn[6].cx + 10},532 l3,9 9,3 -9,3 -3,9 -3,-9 -9,-3 9,-3 Z`, MUST, { sw: 1.3 }), { ox: tn[6].cx + 10, oy: 544 });

  // the recipe card: what every layer does
  G("s4-card", () => {
    rect(122, 356, 220, 84, WHITE, { rx: 2, sw: 1.6 });
    hrect(334, 360, 6, 78, "hatchDense");
    circ(232, 356, 6, RED, { sw: 1.4 });
    text(232, 382, "every layer", { size: 16, weight: 700, anchor: "middle" });
    G("s4-hi1", () => rect(130, 394, 204, 20, MUST, { rx: 3, stroke: "none" }));
    G("s4-hi2", () => rect(130, 416, 204, 20, MUST, { rx: 3, stroke: "none" }));
    rect(136, 400, 7, 7, CREAM, { sw: 1 });
    rect(153, 400, 7, 7, TERRA, { sw: 1 });
    path("M156,399 Q148,388 140,399", "none", { stroke: RED, sw: 1.8 });
    text(170, 408, "taste back", { size: 14, weight: 700 });
    text(258, 408, "attention", { size: 12, italic: true, color: GREY });
    path("M140,426 L148,418 L156,426 L148,434 Z", WHITE, { sw: 1.3 });
    path("M141,425 L149,417", "none", { sw: 3 });
    text(170, 430, "season", { size: 14, weight: 700 });
    text(230, 430, "feed-forward", { size: 12, italic: true, color: GREY });
  });

  // the many layers in between
  G("s4-dots", () => text(792, 580, "· · ·", { size: 30, anchor: "middle", weight: 700 }));
  G("s4-many", () => text(792, 552, "× many", { size: 18, weight: 700, anchor: "middle" }));
  G("s4-ticket", () => step(792, 482, 4, "cook", null, TERRA));
  G("arr-L12", () => arrowQ(1288, 446, 1180, 400, 1072, 444));
  G("arr-L2N", () => arrowQ(948, 446, 792, 384, 646, 444));

  // the cache: notes on the clipboard, so old tokens never re-walk the line
  G("s4-clip", () => {
    put(`<g transform="translate(0 30)">`);
    path("M232,438 V452", "none", { sw: 2 });
    rect(136, 458, 192, 200, WOOD, { rx: 8 });
    hrect(298, 462, 26, 192, "hatch", 6);
    rect(150, 476, 164, 170, WHITE);
    rect(200, 448, 64, 24, STEEL, { rx: 5 });
    hrect(200, 463, 64, 9, "hatchDense");
    text(232, 506, "notes", { size: 20, weight: 700, anchor: "middle" });
    for (let i = 0; i < 5; i++) {
      const y = 530 + i * 22;
      G(`s4-note-${i}`, () => {
        rect(164, y - 10, 30, 14, i < 4 ? CREAM : TERRA, { rx: 2, sw: 1.2 });
        path(`M204,${y - 3} q7,-5 14,0 t14,0 t14,0 t14,0 t14,0 t14,0`, "none", { sw: 1.2 });
      });
    }
    text(232, 680, "the cache", { size: 16, italic: true, anchor: "middle", color: GREY });
    put(`</g>`);
  });

  // out of the line
  G("arr-L5", () => arrow("M418,586 H392 V752", 392, 757, 90));
}

const ODDS = [["broth", 0.61], ["stock", 0.22], ["soup", 0.09], ["pot", 0.04]];
// What the screen says once the reply is finished; the animation types it token by token.
export const REPLY = ["Start with a", "good broth,", "simmered slow."];

function rowPass() {
  // 5 score: the odds board
  G("s5-board", () => {
    rect(150, 846, 340, 236, WOOD, { rx: 4 });
    hrect(460, 850, 26, 228, "hatch");
    rect(164, 860, 312, 208, SLATE, { sw: 1.6 });
  });
  const chalk = (x, y, s, o = {}) => text(x, y, s, { color: CHALK, ...o });
  TG("c-title", () => chalk(184, 896, "start with a good ___", { size: 17, italic: true }));
  ODDS.forEach(([wd, p], i) => {
    const y = 936 + i * 28, w = Math.max(5, p * 260);
    TG(`c-word-${i}`, () => chalk(184, y, wd, { size: 17 }));
    TG(`c-bar-${i}`, () => put(`<rect x="250" y="${y - 13}" width="${w}" height="15" rx="2" style="fill:${CHALK};opacity:.85"/>`), { ox: 250, oy: y });
    TG(`c-pct-${i}`, () => chalk(260 + w, y, `${Math.round(p * 100)}%`, { size: 14 }));
  });
  TG("c-more", () => chalk(184, 1050, "+ every other token", { size: 14, italic: true }));
  G("s5-ticket", () => step(332, 790, 5, "score", "odds for every token", BLUE));

  G("arr-56", () => arrow("M418,790 H560", 565, 790, 0));

  // 6 spin: the weighted wheel
  wheel(650, 968, 100);
  G("s6-claude", () => claude("c6", 772, 1012, 0.5, { eyes: "wide" }));
  G("s6-ticket", () => step(660, 790, 6, "spin", "pick one by its odds", BLUE));

  G("arr-67", () => arrow("M752,790 H893", 898, 790, 0));

  // 7 plate: the new token lands in the bowl and on your screen
  G("s7-bowl", () => bowl(990, 900, 170));
  G("s7-bowl-tiles", () => tiles(916, 878, ["start", "with", "a", "good"], { size: 12, gap: 3 }));
  G("s7-broth", () => tiles(962, 851, ["broth"], { size: 13, fills: [TERRA] }));
  for (let k = 0; k < 2; k++)
    G(`s7-steam-${k}`, () => path(`M${[900, 1080, 1066][k]},${[904, 904, 870][k]} c-7,-9 7,-14 0,-24 c-7,-9 7,-14 0,-20`, "none", { sw: 1.4 }), { ox: [900, 1080, 1066][k], oy: 900 });
  G("s7-splash", () => {
    for (const [x, y, r] of [[946, 872, 3], [936, 862, 2.4], [1034, 872, 3], [1044, 860, 2.2], [990, 866, 2]]) circ(x, y, r, BLUE, { sw: 1 });
  }, { attrs: 'opacity="0"', ox: 990, oy: 880 });
  G("s7-lines", () => path("M952,855 l-10,-6 M952,867 l-12,0 M1024,855 l10,-6 M1024,867 l12,0", "none", { sw: 1.4 }));
  G("s7-screen", () => {
    rect(912, 1000, 160, 98, WHITE, { rx: 6 });
    hrect(1064, 1004, 5, 90, "hatchDense");
    rect(922, 1010, 140, 78, CREAM, { sw: 1.4 });
    path("M892,1098 H1092 L1102,1112 H882 Z", STEEL);
    REPLY.forEach((l, i) => text(932, 1034 + i * 20, l, { size: 14, id: `s7-l${i}` }));
    G("s7-cur", () => inkPath("M1050,1063 h7 v14 h-7 Z"));
  });
  G("s7-ticket", () => step(990, 790, 7, "plate", "add it, show it", TERRA));

  // the next lap: only the new token goes back to the line
  G("s7-belt", () => {
    rect(1046, 724, 520, 12, STEEL, { rx: 6, sw: 1.6 });
    for (let x = 1060; x < 1566; x += 28) circ(x, 730, 3, WHITE, { sw: 1 });
  });
  G("s7-belt-tile", () => tiles(1380, 702, ["broth"], { size: 12, fills: [TERRA] }));
  G("arr-loop", () => arrow("M1036,760 V744 H1578 V586 H1514", 1508, 586, 180));
  G("s7-note", () => note(1056, 714, "next lap: just the new token", { size: 17, anchor: "start" }));

  // the three ways a reply ends
  G("arr-done", () => arrow("M1082,790 H1235", 1240, 790, 0));
  G("e-done", () => step(1300, 790, 0, "done", "stop token", SAGE));
  G("e-bell", () => bell(1478, 812, 0.85), { ox: 1478, oy: 812 });
  G("e-ding", () => text(1532, 760, "ding!", { size: 17, italic: true }));

  G("arr-full", () => arrowQ(1082, 804, 1180, 950, 1222, 950));
  G("e-full", () => step(1300, 950, 0, "full", "length limit", RED));
  G("e-fullbowl", () => {
    bowl(1478, 940, 104);
    tiles(1438, 916, ["…", "and", "the"], { size: 10, gap: 2 });
    path("M1428,942 c-4,14 -2,26 -7,40 M1528,942 c4,14 2,26 7,40", "none", { stroke: RED, sw: 1.8 });
  });

  G("arr-fetch", () => arrowQ(1082, 818, 1150, 1110, 1214, 1110));
  G("e-fetch", () => step(1300, 1110, 0, "fetch", "uses a tool", BLUE));
  G("e-runner", () => {
    G("e-speed", () => path("M1410,1096 h-18 M1414,1112 h-26 M1410,1128 h-18", "none", { sw: 1.5 }));
    claude("runner", 1446, 1082, 0.42, { eyes: "wide", propR: () => {
      rect(1528, 1100, 40, 26, WOOD, { rx: 3, sw: 1.6 });
      path("M1532,1100 Q1548,1080 1564,1100", "none", { sw: 1.6 });
    } });
  });
}

function wheel(cx, cy, r) {
  G("s6-disc", () => {
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
  }, { ox: cx, oy: cy });
  G("s6-stand", () => {
    path(`M${cx - 30},${cy + r + 30} L${cx},${cy} L${cx + 30},${cy + r + 30}`, "none", { sw: 3 });
    hpath(`M${cx},${cy} m${r * 0.2},${r * 0.95} A${r},${r} 0 0 0 ${cx + r},${cy} L${cx + r * 0.85},${cy} A${r * 0.85},${r * 0.85} 0 0 1 ${cx + r * 0.17},${cy + r * 0.82} Z`, "hatch");
    circ(cx, cy, r, "none", { sw: 2.4 });
    circ(cx, cy, 9, WOOD, { sw: 1.6 });
    path(`M${cx - 10},${cy - r - 18} H${cx + 10} L${cx},${cy - r + 6} Z`, RED, { sw: 1.6 });
  });
}

export function buildPoster() {
  base = [];
  top = [];
  layer = base;
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
    <clipPath id="clipSlip"><rect x="640" y="94" width="220" height="170"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect width="${W}" height="${H}" filter="url(#paper)" opacity="0.16"/>
  <g filter="url(#wob)" style="--pf:${PAPER}"><g id="base">${base.join("\n")}</g></g>
  <use href="#base" filter="url(#riso)" transform="translate(2.6 1.8)"
       style="--pf:initial;--sk:transparent;--tf:transparent;--ho:0;mix-blend-mode:multiply;opacity:.9"/>
  <g filter="url(#wob)">${top.join("\n")}</g>
</svg>`;
}
