// The film: in the X app, Grok Bot turns into the search field, types the query, scans the Top results and dives
// into the first one. From there the results play full screen: the first few flow into each other with forward
// pushes (the dive's momentum carrying on), then the pace picks up and each new result slides up over the last
// like a sheet (the near-still pieces as frozen snapshots), each credited with its creator's handle. Grok Bot
// reacts to every find. The last clip's tennis ball becomes the Grok Bot sphere and the reference end card plays
// with "now has taste" under the lockup.
import { CLIPS, FPS } from './clips.js';
import { drawBot, flourish, FACES, mixFace, calm, ORANGE } from './bot.js';
import { S, COL, FIELD, FEED_TOP, C, FONT, xLogo, drawNav, drawSidebar, postHeights, mediaBox, drawPostChrome,
  drawMediaBorder, drawHeader, drawFieldContents, POST } from './xui.js';

export const W = 1920, H = 1080;
export { FPS };

// ---------- easing ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k * k;
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutBack = (k, s = 1.7) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const smooth = (a, b, x) => { const k = prog(x, a, b); return k * k * (3 - 2 * k); };
const bump = (t, a, b) => Math.sin(Math.PI * prog(t, a, b)); // 0 → 1 → 0 over [a, b]
const mix = (a, b, k) => {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], k)).toString(16).padStart(2, '0')).join('');
};

// ---------- frames ----------
let manifest = null;
const cache = new Map();
export async function loadManifest(base) {
  manifest = await (await fetch(base + 'cache/manifest.json', { cache: 'no-store' })).json();
  layout();
}
function frameImage(id, i) {
  const m = manifest[id];
  i = CLIPS[id]?.loop ? Math.floor(i) % m.count : clamp(Math.floor(i), 0, m.count - 1);
  const key = id + '/' + i;
  if (!cache.has(key)) {
    const img = new Image();
    img.src = `cache/frames/${id}/${String(i + 1).padStart(4, '0')}.jpg`;
    cache.set(key, img.decode().then(() => img));
    if (cache.size > 240) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

// ---------- timeline ----------
const BOT_BIG = { x: 960, y: 540, w: 340, h: 200 };
const BOT_PERCH = { w: 116, h: 68 };
const QUERY = 'top design posts';
// form: the whole bot stretches into an orange search pill, its face still in it; hopOut: it hops out of the pill
// onto the pill's end, taking its face with it; tint: the empty pill cools to an ordinary X search field
const T = { look: 0.33, gather: [0.72, 0.88], form: [0.84, 1.34], hopOut: [1.52, 1.9], tint: [1.6, 1.94],
  type: [2.02, 2.56], enter: 2.64, dock: [2.72, 3.16] };
const ARRIVE = 3.81;       // the feed settles on the first result
const HOP = [3.94, 4.32];  // the bot hops from the search field onto that post
const DIVE = [4.4, 5.06];  // the camera follows the post's media to full screen
// Full-screen results. hold = seconds resting; tr = seconds of the transition into the next one.
// 'push': the camera keeps moving forward through the clip into the next; 'sheet': the next slides up over it.
// face/move = how Grok Bot reacts as that find arrives.
const SEQ = [
  { id: 'cerpow',          hold: 0.9,  tr: 0.72, kind: 'push',  face: 'excited',   move: 'pop' },
  { id: 'zarazhangrui',    hold: 0.85, tr: 0.7,  kind: 'push',  face: 'curious',   move: 'wiggle' },
  { id: 'shirotatakajo',   hold: 0.8,  tr: 0.68, kind: 'push',  face: 'delighted', move: 'celebrate' },
  { id: 'shun_webdesign',  hold: 0.75, tr: 0.66, kind: 'push',  face: 'surprised', move: 'pop' },
  { id: 'nickbakeddesign', hold: 0.65, tr: 0.5,  kind: 'sheet', face: 'happy',     move: 'hop' },
  { id: 'stackedlol',      hold: 0.55, tr: 0.48, kind: 'sheet', face: 'curious',   move: 'nod' },
  { id: 'rameerez',        hold: 0.45, tr: 0.46, kind: 'sheet', face: 'delighted', move: 'wiggle' },
  { id: 'ann_nnng',        hold: 0.4,  tr: 0.44, kind: 'sheet', face: 'excited',   move: 'hop' },
  { id: 'yui540',          hold: 0.32, tr: 0.42, kind: 'sheet', face: 'happy',     move: 'pop' },
  { id: 'nono_ai_archive', hold: 0.2,  tr: 0.42, kind: 'sheet', face: 'surprised', move: 'hop' },
  { id: 'DilumSanjaya',    hold: 0.2,  tr: 0.5,  kind: 'sheet', face: 'proud',     move: 'nod' },
  { id: 'AmirMushich',     hold: 1.05, tr: 0,                   face: 'attentive', move: 'pop' },
];
// pieces that lose too much to a 16:9 crop are shown whole over a blurred fill
const CONTAIN = new Set(['nono_ai_archive', 'yui540', 'stackedlol']);
// The serve toss in AmirMushich's last frame: centroid (805.1, 687.7) source px, ~4 px radius. The clip is timed
// to land on exactly that frame when the toss begins.
const BALL_SRC = { x: 805.1, y: 687.7, r: 4 };
const TOSS_DUR = 0.85;
const REF_SPHERE = { x: 984, y: 537, r: 45 }; // ref frame 8.633 s, first frame of the sphere
const TAG = { size: 95.5, baseline: 692 };
const URL_TEXT = 'x.ai/bot/_8iIneBUwOa06iIHpvCr5';

let cards = [], TOSS, REF_START, LIFT, WORDS, URL_T, FACE_KEYS, MOVES;
export let DURATION = 24;

// ---------- feed ----------
// null = placeholder post (skeleton text, soft colour block) so the scan reads as searching through many posts;
// ids are real results.
const FEED_IDS = [null, null, null, null, 'cerpow', null, 'zarazhangrui', null];
const PLACEHOLDER = [['#E7E1D8', 16 / 9], ['#DAE3EC', 1], ['#E8DCE5', 4 / 3], ['#DCE7DE', 16 / 9], ['#EDE6D2', 4 / 3], ['#DFDCEC', 1]];
let posts = [], scrollKeys = [];
const byId = {};

// Every cue derives from T, DIVE and SEQ.
function layout() {
  let y = 0;
  posts = FEED_IDS.map((id, i) => {
    const aspect = id ? manifest[id].w / manifest[id].h : PLACEHOLDER[i % PLACEHOLDER.length][1];
    const p = { id, i, y, mh: Math.round(Math.min(POST.maxMediaH, POST.mediaW / aspect) * S),
      color: id ? null : PLACEHOLDER[i % PLACEHOLDER.length][0], snap: id ? CLIPS[id].snap : undefined };
    postHeights(p);
    y += p.h;
    if (id) byId[id] = p;
    return p;
  });
  // scroll so the chosen post sits just under the sticky header
  scrollKeys = [[T.dock[0], -1100], [ARRIVE, byId.cerpow.y - 6]];
  byId.cerpow.playFrom = byId.zarazhangrui.playFrom = DIVE[0] - 0.15;

  let t = DIVE[1];
  cards = SEQ.map(s => {
    const c = { ...s, holdStart: t, holdEnd: t + s.hold, snap: CLIPS[s.id].snap, rate: CLIPS[s.id].rate || 1, src: manifest[s.id] };
    t = c.holdEnd + s.tr;
    return c;
  });
  // each clip starts as its transition begins (the first one as the dive starts); handles swap mid-transition
  cards.forEach((c, i) => {
    const p = cards[i - 1];
    c.playFrom = p ? p.holdEnd : DIVE[0] - 0.15;
    c.cut = p ? p.holdEnd + p.tr / 2 : DIVE[1];
  });
  const last = cards[cards.length - 1];
  TOSS = [last.holdEnd, last.holdEnd + TOSS_DUR];
  // the last clip ends on its final frame (the toss) exactly as the ball takes over
  last.playFrom = TOSS[0] - (last.src.count - 0.5) / FPS;
  REF_START = TOSS[1];
  // the ref lockup settles 1.7 s after the sphere appears; the tagline follows once it has rested
  LIFT = { t: REF_START + 2.1, dur: 0.55, dy: -72 };
  WORDS = [['now', REF_START + 2.75], ['has', REF_START + 2.92], ['taste', REF_START + 3.09]];
  URL_T = REF_START + 3.65;
  DURATION = +(URL_T + 1.6).toFixed(2);

  // Grok Bot's acting: faces it moves between (blended) and one-shot moves
  FACE_KEYS = [[0, 'attentive'], [T.look, 'curious'], [T.gather[0], 'attentive'], [T.form[0] + 0.2, 'happy'],
    [T.form[1] + 0.04, 'curious'], [T.hopOut[0] - 0.12, 'excited'], [T.hopOut[1] - 0.05, 'happy'],
    [T.type[0], 'attentive'], [T.enter, 'proud'], [T.enter + 0.3, 'attentive'], [ARRIVE - 0.32, 'surprised'],
    [HOP[0] - 0.08, 'excited'], [DIVE[0], 'delighted']];
  MOVES = [[T.hopOut[1] - 0.04, 'pop'], [T.enter, 'hop'], [ARRIVE - 0.32, 'pop']];
  cards.forEach((c, i) => {
    if (i) FACE_KEYS.push([cards[i - 1].holdEnd, cards[i - 1].kind === 'push' ? 'surprised' : 'attentive']);
    FACE_KEYS.push([c.cut + 0.04, c.face]);
    MOVES.push([c.cut + 0.02, c.move]);
  });
  FACE_KEYS.push([TOSS[0] - 0.05, 'excited']);
  MOVES.push([TOSS[0] - 0.05, 'shake']);
}
// Event times for the soundtrack (src/audio.js).
export function cues() {
  return { T, ARRIVE, HOP, DIVE, TOSS, REF_START, WORDS, URL_T, query: QUERY, duration: DURATION, moves: MOVES,
    cards: cards.map(c => ({ id: c.id, holdStart: c.holdStart, holdEnd: c.holdEnd, cut: c.cut, kind: c.kind, tr: c.tr, move: c.move })) };
}
function scroll(t) {
  const k = scrollKeys;
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t < k[i][0]) return lerp(k[i - 1][1], k[i][1], easeInOut(prog(t, k[i - 1][0], k[i][0])));
  return k[k.length - 1][1];
}
const postTop = (p, sc) => p.y - sc + FEED_TOP;
const mediaRect = (p, sc) => mediaBox(p, postTop(p, sc));
const srcTime = (p, t) => (p.snap !== undefined ? p.snap : Math.max(0, t - (p.playFrom ?? 1e9)) * (p.rate || CLIPS[p.id]?.rate || 1));

// Camera for the dive: e = 0 feed view .. 1 the first result's media fills the frame.
function cameraFor(t) {
  const e = easeInOut(prog(t, ...DIVE));
  if (e <= 0) return { z: 1, tx: 0, ty: 0, e };
  const M = mediaRect(byId.cerpow, scroll(t));
  const zt = Math.max(W / M.w, H / M.h);
  const F = { x: M.x + M.w / 2, y: M.y + M.h / 2 };
  const z = lerp(1, zt, e);
  return { z, tx: lerp(F.x, W / 2, e) - F.x * z, ty: lerp(F.y, H / 2, e) - F.y * z, e };
}
const toScreen = (cam, x, y) => ({ x: cam.tx + x * cam.z, y: cam.ty + y * cam.z });

// Which result is on screen: i = resting (or outgoing) card, u = transition progress to the next.
function viewer(t) {
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i], n = cards[i + 1];
    if (t < c.holdEnd || !n) return { i, u: 0 };
    if (t < n.holdStart) return { i, u: prog(t, c.holdEnd, n.holdStart) };
  }
}

// ---------- media ----------
// Draws a clip frame into r: cover-cropped, or whole over a blurred fill for the CONTAIN pieces.
async function drawFrame(ctx, id, frameT, r, { radius = 0, contain = false, blur = 0, dim = 0 } = {}) {
  const img = await frameImage(id, frameT * FPS);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  const kc = Math.max(r.w / img.width, r.h / img.height);
  const sharp = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
  if (contain) {
    ctx.filter = `blur(${Math.round(r.w / 40 + blur)}px) brightness(0.92)`;
    ctx.drawImage(img, r.x + (r.w - img.width * kc * 1.1) / 2, r.y + (r.h - img.height * kc * 1.1) / 2, img.width * kc * 1.1, img.height * kc * 1.1);
    ctx.filter = sharp;
    const k = Math.min(r.w / img.width, r.h / img.height);
    ctx.drawImage(img, r.x + (r.w - img.width * k) / 2, r.y + (r.h - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    ctx.filter = sharp;
    ctx.drawImage(img, r.x + (r.w - img.width * kc) / 2, r.y + (r.h - img.height * kc) / 2, img.width * kc, img.height * kc);
  }
  ctx.filter = 'none';
  if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
}
async function drawMedia(ctx, p, t, r, radius) {
  if (p.id) return drawFrame(ctx, p.id, srcTime(p, t), r, { radius });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, p.color);
  g.addColorStop(1, mix(p.color, '#B9C2CA', 0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(r.x + r.w * (0.3 + 0.4 * ((p.i * 37) % 10) / 10), r.y + r.h * 0.55, r.h * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- layers ----------
// The X app: nav and sidebar stay put, the timeline column scrolls (blurring with speed); all of it zooms with
// the dive camera.
async function app(ctx, t, cam) {
  if (t < T.dock[0] || t >= DIVE[1]) return;
  const a = easeInOut(prog(t, ...T.dock));
  const sc = scroll(t);
  const v = Math.abs(scroll(t + 1 / FPS) - sc) * FPS; // px/s
  ctx.save();
  ctx.setTransform(cam.z, 0, 0, cam.z, cam.tx, cam.ty);
  ctx.globalAlpha = a;
  drawNav(ctx);
  drawSidebar(ctx);
  ctx.fillStyle = C.line;
  ctx.fillRect(COL.x - S, 0, S, H);
  ctx.fillRect(COL.x + COL.w, 0, S, H);
  ctx.globalAlpha = 1;
  if (cam.e < 0.5) ctx.filter = `blur(${Math.min(7, v / 900).toFixed(2)}px)`;
  for (const p of posts) {
    const top = postTop(p, sc);
    if (top > H || top + p.h < 0) continue;
    drawPostChrome(ctx, p, top);
    const r = mediaBox(p, top), radius = p.id === 'cerpow' ? lerp(16 * S, 0, cam.e) : 16 * S;
    await drawMedia(ctx, p, t, r, radius);
    drawMediaBorder(ctx, r, radius);
  }
  ctx.restore();
}

// Full-screen results.
const FULL = { x: 0, y: 0, w: W, h: H };
const scaled = s => ({ x: W / 2 - W * s / 2, y: H / 2 - H * s / 2, w: W * s, h: H * s });
async function results(ctx, t) {
  if (t < DIVE[1] || t >= TOSS[0] + 0.45) return;
  const { i, u } = viewer(t);
  const cur = cards[i], next = cards[i + 1];
  const curT = srcTime(cur, Math.min(t, TOSS[0]));
  const opt = c => ({ contain: CONTAIN.has(c.id) });
  ctx.save();
  // the last clip dissolves to white as the ball goes up
  ctx.globalAlpha = 1 - easeInOut(prog(t, TOSS[0], TOSS[0] + 0.4));
  if (!next || u === 0) {
    await drawFrame(ctx, cur.id, curT, FULL, opt(cur));
  } else if (cur.kind === 'push') {
    // the camera keeps flying forward: the current clip swells past the lens and dissolves while the next one
    // comes up from depth, sharpening as it arrives
    const e = easeInOut(u);
    ctx.globalAlpha = smooth(0.1, 0.65, u);
    await drawFrame(ctx, next.id, srcTime(next, t), scaled(lerp(0.78, 1, easeOut(u))), { ...opt(next), radius: 40 * (1 - easeOut(u)), blur: 14 * (1 - easeOut(u)) });
    ctx.globalAlpha = 1 - smooth(0.3, 0.85, u);
    await drawFrame(ctx, cur.id, curT, scaled(1 + 0.55 * easeIn(u) + 0.1 * e), { ...opt(cur), blur: 18 * easeIn(u) });
  } else {
    // sheet: the next result slides up over the current one, which sinks back and dims
    const e = easeInOut(u);
    const back = scaled(1 - 0.07 * e);
    back.y -= 30 * e;
    await drawFrame(ctx, cur.id, curT, back, { ...opt(cur), radius: 36 * e, dim: 0.28 * e, blur: 3 * e });
    const y = H * (1 - e);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = -10;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.roundRect(0, y, W, H, [40 * (1 - e), 40 * (1 - e), 0, 0]); ctx.fill();
    ctx.restore();
    await drawFrame(ctx, next.id, srcTime(next, t), { x: 0, y, w: W, h: H }, { ...opt(next), radius: 40 * (1 - e), blur: 4 * bump(u, 0, 1) });
  }
  ctx.restore();
}

// The search field is the bot's body: it stretches out of the bot, takes the query (focused: white with X's blue
// ring), docks into the header, and during the dive slims into a chip that floats over the results.
function chipWidth(ctx) {
  ctx.font = `400 ${15 * S * (60 / (42 * S))}px ${FONT}`;
  return 48 * S * (60 / (42 * S)) + ctx.measureText(QUERY).width + 30;
}
function fieldRect(ctx, t, cam) {
  const d = easeInOut(prog(t, ...T.dock));
  const centre = { x: 960, y: 540, w: FIELD.w * 1.2, h: FIELD.h * 1.5 };
  const docked = { x: 960, y: lerp(centre.y, FIELD.y, d), w: lerp(centre.w, FIELD.w, d), h: lerp(centre.h, FIELD.h, d) };
  const press = 1 - 0.03 * bump(t, T.enter, T.enter + 0.15);
  docked.w *= press; docked.h *= press;
  return { x: 960, y: lerp(docked.y, 58, cam.e), w: lerp(docked.w, chipWidth(ctx), cam.e), h: lerp(docked.h, 60, cam.e) };
}
// The pill while it still is the bot: its face looks around inside it, then it hops out.
function pillFace(t) {
  const hold = smooth(T.form[1] - 0.05, T.form[1] + 0.08, t);
  return { yaw: 12 * Math.sin((t - T.form[1]) * 8) * hold * (1 - smooth(T.hopOut[0] - 0.15, T.hopOut[0], t)),
    pitch: 10 * smooth(T.hopOut[0] - 0.15, T.hopOut[0], t) };
}
function searchField(ctx, t, cam) {
  if (t < T.form[0]) return;
  // the bot's body stretches into the pill with a little elastic overshoot
  const fk = prog(t, ...T.form);
  const f = easeInOut(fk), fw = easeOutBack(fk, 1.3);
  const b1 = fieldRect(ctx, t, cam), b0 = BOT_BIG;
  const r = { x: lerp(b0.x, b1.x, f), y: lerp(b0.y, b1.y, f), w: lerp(b0.w, b1.w, fw), h: lerp(b0.h, b1.h, f) };
  // it recoils as the bot springs out of it
  const kick = bump(t, T.hopOut[0] - 0.04, T.hopOut[0] + 0.2);
  r.h *= 1 - 0.12 * kick; r.w *= 1 + 0.025 * kick;
  const alpha = 1 - easeInOut(prog(t, TOSS[0], TOSS[0] + 0.35));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawHeader(ctx, smooth(0.55, 1, easeInOut(prog(t, ...T.dock))) * (1 - easeOut(Math.min(1, cam.e * 2.5))));
  // focused while typing, X's grey once the search has run, white once it floats over the results
  const focus = 1 - smooth(T.enter + 0.05, T.dock[1], t);
  if (cam.e > 0) { ctx.shadowColor = `rgba(0,0,0,${0.2 * cam.e})`; ctx.shadowBlur = 26; ctx.shadowOffsetY = 6; }
  const tint = easeInOut(prog(t, ...T.tint));
  const settled = mix(mix(C.field, '#FFFFFF', focus), '#FFFFFF', cam.e);
  const face = t < T.hopOut[0] + 0.03;
  drawBot(ctx, { ...r, color: mix(ORANGE, settled, tint), eyes: face ? 1 : 0, face: faceAt(t), ...pillFace(t), blink: life(t).blink });
  ctx.shadowColor = 'transparent';
  if (tint > 0) {
    const ring = Math.max(focus, 0) * tint;
    ctx.strokeStyle = ring > 0.02 ? `rgba(29,155,240,${ring})` : 'transparent';
    ctx.lineWidth = 2 * S * (r.h / FIELD.h);
    ctx.beginPath(); ctx.roundRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2); ctx.stroke();
    ctx.globalAlpha = alpha * smooth(0.5, 1, tint);
    const n = Math.floor(QUERY.length * prog(t, ...T.type));
    drawFieldContents(ctx, r, QUERY.slice(0, n), { focus, caret: t > T.tint[1] && t < T.enter + 0.1 && Math.floor(t * 3.5) % 2 === 0 });
  }
  ctx.restore();
}

// Handle pill over the results: rolls to the next handle mid-transition.
function pillGeom(ctx, t) {
  ctx.font = `500 40px ${FONT}`;
  let ci = 0;
  cards.forEach((c, i) => { if (t >= c.cut) ci = i; });
  const cur = cards[ci], prev = cards[ci - 1];
  const widthOf = s => 30 + 36 + 16 + ctx.measureText('@' + s).width + 34;
  const swap = prev ? easeOut(prog(t, cur.cut, cur.cut + 0.2)) : 1;
  const w = prev ? lerp(widthOf(prev.id), widthOf(cur.id), swap) : widthOf(cur.id);
  const enter = easeOutBack(prog(t, DIVE[1] - 0.15, DIVE[1] + 0.2), 1.4);
  const exit = easeIn(prog(t, TOSS[0] + 0.15, TOSS[0] + 0.45));
  return { ci, cur, prev, swap, x: 72, y: H - 72 - 84 + (1 - enter) * 160 + exit * 200, w, h: 84, alpha: clamp(enter * 3) };
}
function pill(ctx, t) {
  if (t < DIVE[1] - 0.15 || t > TOSS[0] + 0.5) return;
  const g = pillGeom(ctx, t);
  ctx.save();
  ctx.globalAlpha = g.alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, g.h / 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  xLogo(ctx, g.x + 30, g.y + g.h / 2 - 18, 36);
  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  const tx = g.x + 82, ty = g.y + g.h / 2 + 1;
  if (g.prev && g.swap < 1) {
    ctx.globalAlpha = g.alpha * (1 - g.swap);
    ctx.fillText('@' + g.prev.id, tx, ty - 44 * g.swap);
  }
  ctx.globalAlpha = g.alpha * g.swap;
  ctx.fillText('@' + g.cur.id, tx, ty + 44 * (1 - g.swap));
  ctx.restore();
}

// ---------- Grok Bot ----------
// Always alive, as on the official splash: a soft breathing squish, blinks on uneven timers (some doubled), and
// the face blending between expressions; each beat adds its gaze, posture and a one-shot move.
const BLINKS = [0.62, 2.32, 2.47, 4.1, 5.65, 7.2, 7.35, 9.45, 11.05, 12.65, 12.8, 14.45, 16.1];
function faceAt(t) {
  let i = 0;
  for (let k = 0; k < FACE_KEYS.length; k++) if (t >= FACE_KEYS[k][0]) i = k;
  const prev = FACE_KEYS[Math.max(0, i - 1)][1], cur = FACE_KEYS[i][1];
  return calm(mixFace(prev, cur, easeOut(prog(t, FACE_KEYS[i][0], FACE_KEYS[i][0] + 0.25))));
}
function moveAt(t, h) {
  let m = null;
  for (const mv of MOVES) if (t >= mv[0]) m = mv;
  return m && t - m[0] < 1.6 ? flourish(m[1], t - m[0], h) : flourish(null, 0, h);
}
function life(t) {
  const b = Math.sin(t * 2 * Math.PI / 1.45);
  return { sx: 1 + 0.025 * b, sy: 1 - 0.03 * b, blink: BLINKS.reduce((m, bt) => Math.max(m, bump(t, bt, bt + 0.13)), 0) };
}
function fieldAnchor(ctx, t) { const b = fieldRect(ctx, t, cameraFor(t)); return { x: b.x + b.w / 2 - 80, y: b.y - b.h / 2 - 28 }; }
function postAnchor(t) {
  const M = mediaRect(byId.cerpow, scroll(t));
  return toScreen(cameraFor(t), M.x + M.w - 90, M.y - 28);
}
function pillAnchor(ctx, t) { const g = pillGeom(ctx, t); return { x: g.x + g.w - 84, y: g.y - 28 }; }
function ballPos(t) {
  const m = cards[cards.length - 1].src;
  const k0 = Math.max(W / m.w, H / m.h); // AmirMushich is shown cover-cropped
  const p0 = { x: (W - m.w * k0) / 2 + BALL_SRC.x * k0, y: (H - m.h * k0) / 2 + BALL_SRC.y * k0 };
  const k = prog(t, ...TOSS);
  const p2 = REF_SPHERE, p1 = { x: lerp(p0.x, p2.x, 0.4), y: Math.min(p0.y, p2.y) - 230 };
  const u = easeInOut(k);
  return {
    x: (1 - u) ** 2 * p0.x + 2 * (1 - u) * u * p1.x + u * u * p2.x,
    y: (1 - u) ** 2 * p0.y + 2 * (1 - u) * u * p1.y + u * u * p2.y,
    r: lerp(BALL_SRC.r * k0, REF_SPHERE.r, easeIn(k) * 0.85 + k * 0.15), k,
  };
}

function bot(ctx, t, cam) {
  const L = life(t), P = BOT_PERCH;
  const face = faceAt(t);
  if (t < T.gather[1]) {
    // pops in, looks left then right with its whole head, then gathers itself (a small squash) before stretching
    const pop = easeOutBack(prog(t, 0, 0.34), 2.0);
    const st = bump(t, 0.04, 0.32);
    const yaw = (() => {
      const k = t - T.look;
      if (k < 0) return 0;
      if (k < 0.13) return -16 * easeInOut(k / 0.13);
      if (k < 0.2) return -16;
      if (k < 0.35) return lerp(-16, 15, easeInOut((k - 0.2) / 0.15));
      return lerp(15, 6, easeInOut(prog(k, 0.36, 0.44)));
    })();
    const sq = bump(t, T.gather[0], T.gather[1] + 0.06);
    drawBot(ctx, { x: BOT_BIG.x, y: BOT_BIG.y - 18 * st, w: BOT_BIG.w * pop, h: BOT_BIG.h * pop,
      sx: L.sx * (1 - 0.06 * st + 0.06 * sq), sy: L.sy * (1 + 0.1 * st - 0.08 * sq), face, yaw, blink: L.blink });
    return;
  }
  if (t < T.hopOut[0]) return; // it *is* the pill for a moment
  const a = fieldAnchor(ctx, t);
  const mv = moveAt(t, P.h);
  if (t < T.hopOut[1]) {
    // springs out of the pill from where its face was, arcs up and lands on the pill's end
    const k = easeInOut(prog(t, ...T.hopOut)), air = Math.sin(Math.PI * k);
    const pill = fieldRect(ctx, t, cam);
    const from = { x: pill.x - 0.03 * pill.w, y: pill.y };
    const grow = easeOutBack(prog(t, T.hopOut[0], T.hopOut[0] + 0.16), 1.6);
    drawBot(ctx, { x: lerp(from.x, a.x, k), y: lerp(from.y, a.y, k) - 150 * air, w: P.w * grow, h: P.h * grow,
      sx: 1 - 0.08 * air, sy: 1 + 0.12 * air, rot: 0.14 * air, bean: -0.35 * air, face, pitch: 8 - 14 * k, yaw: 8, blink: L.blink, f: mv });
    return;
  }
  if (t < HOP[0]) {
    let yaw = 0, pitch = 0, rot = -0.04, bob = 0, sx = L.sx, sy = L.sy;
    if (t < T.enter) {
      // reads the query as it types, following the caret and bobbing with each keystroke
      const k = prog(t, ...T.type);
      yaw = lerp(-18, -6, k); pitch = -8;
      bob = t < T.type[1] ? Math.abs(Math.sin(Math.PI * k * QUERY.length)) * 6 : 0;
    } else if (t < ARRIVE - 0.32) {
      // leans in and scans the Top results as they stream past
      pitch = -14; yaw = 8 * Math.sin((t - T.enter) * 9); rot = 0.05;
    } else {
      // spots it: wide eyes, a look, then an anticipation squash before the jump
      yaw = -10; pitch = -12;
      const sq = bump(t, HOP[0] - 0.15, HOP[0] + 0.02);
      sx *= 1 + 0.1 * sq; sy *= 1 - 0.13 * sq;
    }
    drawBot(ctx, { x: a.x, y: a.y - bob, w: P.w, h: P.h, sx, sy, rot, face, yaw, pitch, blink: L.blink, f: mv });
    return;
  }
  if (t < DIVE[0]) {
    // the jump: stretched and bean-shaped in the air, rocking as it flies, squashing on landing
    const k = easeInOut(prog(t, ...HOP)), air = Math.sin(Math.PI * k);
    const land = bump(t, HOP[1] - 0.02, HOP[1] + 0.1);
    const b = postAnchor(t);
    drawBot(ctx, { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - 140 * air + 5 * land, w: P.w, h: P.h,
      sx: 1 - 0.07 * air + 0.1 * land, sy: 1 + 0.1 * air - 0.12 * land, rot: -0.2 * air * (1 - k) + 0.14 * air * k,
      bean: -0.6 * air, face, yaw: -12, pitch: -10 + 6 * k, blink: L.blink });
    return;
  }
  const out = easeIn(prog(t, TOSS[0] + 0.25, TOSS[0] + 0.55));
  const p = pillAnchor(ctx, t);
  if (t < DIVE[1]) {
    // rides the dive: twists 90° and squeezes (like slipping into the side button), pops out onto the pill
    const k = easeInOut(prog(t, ...DIVE)), tw = Math.sin(Math.PI * k), b = postAnchor(t);
    drawBot(ctx, { x: lerp(b.x, p.x, k), y: lerp(b.y, p.y, k) - 90 * tw, w: P.w, h: P.h, sx: 1 - 0.3 * tw, sy: 1 + 0.1 * tw,
      rot: (Math.PI / 2) * tw, face, pitch: 12, blink: L.blink });
    return;
  }
  // presenting: looks up at each find from its pill; pushes make it gasp, sheets make it glance down to greet
  // the next one; every arrival gets its own face and move
  const { i, u } = viewer(t);
  let yaw = 10, pitch = 9;
  if (u > 0) {
    if (cards[i].kind === 'push') { pitch = 12; yaw = 3; } else { pitch = lerp(-12, 9, smooth(0.35, 0.95, u)); yaw = 6; }
  }
  // finale: eyes lock onto the ball and follow it up, body stretching to watch it go
  let sy = L.sy, sx = L.sx;
  if (t >= TOSS[0] - 0.05) {
    const bp = ballPos(Math.max(t, TOSS[0]));
    yaw = clamp((bp.x - p.x) / 50, -18, 18);
    pitch = clamp((p.y - bp.y) / 30, -14, 16);
    const w = easeOut(prog(t, TOSS[0], TOSS[0] + 0.3));
    sy *= 1 + 0.08 * w; sx *= 1 - 0.05 * w;
  }
  drawBot(ctx, { x: p.x, y: p.y, w: P.w, h: P.h, sx, sy, rot: -0.06, face, yaw, pitch, blink: L.blink, f: moveAt(t, P.h), alpha: 1 - out });
}

// ---------- the toss and the end card ----------
function tossBall(ctx, t) {
  if (t < TOSS[0] || t >= TOSS[1]) return;
  const { x, y, r: rad, k } = ballPos(t);
  const dark = easeInOut(prog(t, TOSS[1] - 0.25, TOSS[1] - 0.03));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(k * 5);
  ctx.fillStyle = '#D6E246';
  ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(0.6, rad * 0.07);
  ctx.beginPath(); ctx.arc(-rad * 1.25, 0, rad * 0.95, -0.75, 0.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(rad * 1.25, 0, rad * 0.95, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
  ctx.rotate(-k * 5);
  ctx.globalAlpha = dark;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(0, 0, rad + 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = rad * 0.09;
  ctx.beginPath(); ctx.moveTo(rad * 0.38, -rad * 0.62); ctx.lineTo(rad * 0.52, -rad * 0.48); ctx.stroke();
  ctx.restore();
}

// The reference end card from its first sphere frame, lifted to make room for the tagline.
async function ending(ctx, t) {
  if (t < REF_START) return;
  const lift = LIFT.dy * easeInOut(prog(t, LIFT.t, LIFT.t + LIFT.dur));
  const img = await frameImage('ref', ((t - REF_START) + 1 / FPS + 1e-4) * FPS);
  ctx.drawImage(img, 0, lift, W, H);
}

function tagline(ctx, t) {
  if (t < WORDS[0][1]) return;
  // rides up with the lockup until the lift settles
  const baseline = TAG.baseline + LIFT.dy * (easeInOut(prog(t, LIFT.t, LIFT.t + LIFT.dur)) - 1);
  ctx.save();
  ctx.font = `400 ${TAG.size}px ${FONT}`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const prefix = n => ctx.measureText(WORDS.slice(0, n).map(w => w[0]).join(' ')).width;
  const startX = n => 960 - prefix(n) / 2;
  let n = 0;
  WORDS.forEach(([, wt], i) => { if (t >= wt) n = i + 1; });
  // the line re-centres with an ease as each word pops in (as in the reference)
  const kk = easeOut(prog(t, WORDS[n - 1][1], WORDS[n - 1][1] + 0.28));
  const x0 = n > 1 ? lerp(startX(n - 1), startX(n), kk) : startX(1);
  for (let i = 0; i < n; i++) {
    const off = i ? prefix(i) + ctx.measureText(' ').width : 0;
    const extra = i === n - 1 && i > 0 ? 16 * (1 - easeOut(prog(t, WORDS[i][1], WORDS[i][1] + 0.25))) : 0;
    ctx.fillText(WORDS[i][0], x0 + off + extra, baseline);
  }
  ctx.restore();
}

function link(ctx, t) {
  if (t < URL_T) return;
  ctx.save();
  ctx.globalAlpha = easeOut(prog(t, URL_T, URL_T + 0.4));
  ctx.font = `400 32px ${FONT}`;
  ctx.fillStyle = '#9A9A9A';
  ctx.textAlign = 'center';
  ctx.fillText(URL_TEXT, 960, 990 + 8 * (1 - easeOut(prog(t, URL_T, URL_T + 0.4))));
  ctx.restore();
}

// ---------- frame ----------
export async function draw(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  const cam = cameraFor(t);
  await app(ctx, t, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  await results(ctx, t);
  searchField(ctx, t, cam);
  pill(ctx, t);
  bot(ctx, t, cam);
  tossBall(ctx, t);
  await ending(ctx, t);
  tagline(ctx, t);
  link(ctx, t);
}
