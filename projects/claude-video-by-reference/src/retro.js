// The in-film "loved video": SUNSET SURF, a 70s retro poster style (striped sun, wavy bands,
// mustard/rust/teal/cream, grain). Two stories share the style:
//   'surf' — the original video: a cat surfing (the SURFACE Claude must not copy)
//   'kite' — Claude's new film: Claude flying a kite over striped hills (same DNA, new story)
// Shapes are polylines in a 1600x900 frame so they can be filled, drawn on as line art
// (`line` = draw-on progress), or flood-filled shape by shape (`fill` = fill progress).
import { P, mix, rgba } from './palette.js';
import { TAU, clamp, inv, ease, rng, lerp } from './core.js';
import { claude } from './claude.js';
import { grain } from './tex.js';

export const RW = 1600, RH = 900;

function wavy(y0, amp, freq, phase, { x0 = -30, x1 = RW + 30, n = 90, amp2 = 0, freq2 = 0, phase2 = 0, bottom = RH + 30 } = {}) {
  const top = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    const u = x / RW;
    top.push([x, y0 + Math.sin(u * TAU * freq + phase) * amp + Math.sin(u * TAU * freq2 + phase2) * amp2]);
  }
  return { top, poly: [...top, [x1, bottom], [x0, bottom]] };
}
const yOn = (top, x) => {
  for (let i = 1; i < top.length; i++) if (top[i][0] >= x) { const [ax, ay] = top[i - 1], [bx, by] = top[i]; return lerp(ay, by, (x - ax) / (bx - ax)); }
  return top[top.length - 1][1];
};
const circ = (cx, cy, r, n = 64, a0 = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + i / n * TAU) * r, cy + Math.sin(a0 + i / n * TAU) * r]);
const pathOf = (pts, close = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; };
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function strokePartial(ctx, pts, f) {
  if (f <= 0) return;
  const L = polyLen(pts) * clamp(f);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (acc + d >= L) { const k = (L - acc) / d; ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k); break; }
    ctx.lineTo(bx, by); acc += d;
  }
  ctx.stroke();
}

// ---- scene description (list of shapes, back to front) -------------------------------------
function scene(story, t) {
  const S = [];
  const sun = story === 'surf' ? { x: 800, y: 560, r: 205 } : { x: 1010, y: 575, r: 215 };
  S.push({ kind: 'sky' });
  S.push({ kind: 'sun', ...sun, pts: circ(sun.x, sun.y, sun.r) });
  // retro clouds (cream pills with stripe gaps)
  const cl = (x, y, w, sp) => ({ kind: 'cloud', x: x + Math.sin(t * 0.4 + sp) * 14, y, w });
  S.push(cl(story === 'surf' ? 300 : 260, 250, 260, 0), cl(story === 'surf' ? 1280 : 1350, 190, 200, 2));
  if (story === 'surf') {
    const b1 = wavy(585, 7, 3, t * 0.6, { amp2: 3, freq2: 7, phase2: -t });
    const b2 = wavy(650, 15, 2.2, -t * 0.9, { amp2: 5, freq2: 5, phase2: t * 1.3 });
    const b3 = wavy(735, 24, 1.6, t * 1.1, { amp2: 6, freq2: 4.2, phase2: -t * 1.5 });
    const b4 = wavy(830, 16, 2.6, -t * 1.4, { amp2: 5, freq2: 6, phase2: t * 2 });
    S.push({ kind: 'band', pts: b1.poly, top: b1.top, fill: P.rTeal, foam: 0 });
    S.push({ kind: 'band', pts: b2.poly, top: b2.top, fill: P.rMint, foam: 1, stripes: P.rTeal });
    S.push({ kind: 'band', pts: b3.poly, top: b3.top, fill: P.rTeal, foam: 1 });
    // the cat surfs the third band
    const cx = 800 + Math.sin(t * 0.9) * 260;
    S.push({ kind: 'cat', x: cx, y: yOn(b3.top, cx) - 4, tilt: Math.cos(t * 0.9) * 0.12, t });
    S.push({ kind: 'band', pts: b4.poly, top: b4.top, fill: P.rTealDk, foam: 1 });
  } else {
    const h1 = wavy(610, 34, 1.3, 0.6, { amp2: 8, freq2: 3.1, phase2: 1 });
    const h2 = wavy(690, 46, 1.05, 2.4, { amp2: 10, freq2: 2.6, phase2: 0.3 });
    const h3 = wavy(785, 36, 0.85, 4.2, { amp2: 9, freq2: 2.2, phase2: 2 });
    S.push({ kind: 'band', pts: h1.poly, top: h1.top, fill: P.rMustard, rows: P.rOrange });
    S.push({ kind: 'band', pts: h2.poly, top: h2.top, fill: P.rRust, rows: mix(P.rRust, P.rBrown, 0.35) });
    S.push({ kind: 'band', pts: h3.poly, top: h3.top, fill: P.rTeal, rows: P.rTealDk });
    const cx = 470;
    const kx = 1180 + Math.sin(t * 1.3) * 40, ky = 250 + Math.sin(t * 2.1) * 26;
    S.push({ kind: 'kite', x: kx, y: ky, rot: Math.sin(t * 1.7) * 0.18, t });
    S.push({ kind: 'claudeKite', x: cx, y: yOn(h3.top, cx) + 6, t, kx, ky });
  }
  S.push({ kind: 'birds', t });
  return { S, sun };
}

// ---- drawing --------------------------------------------------------------------------------
// opts: { line: 0..1 draw-on progress (1 = all lines, null = no lines), fill: 0..1 (1 = all
// filled), lineColor, paper (bg when unfilled), grain: alpha, claude: extra rig opts }
export function drawRetro(ctx, x, y, w, h, t, story = 'surf', opts = {}) {
  const o = { line: null, fill: 1, lineColor: P.line, paper: P.white, grain: 0.16, lineW: 3.2, view: null, lineAlpha: 1, ...opts };
  const { S, sun } = scene(story, t);
  const [vx, vy, vw, vh] = o.view || [0, 0, RW, RH];
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.scale(w / vw, h / vh);
  ctx.translate(-vx, -vy);
  const n = S.length;
  // per-shape fill progress (staggered flood)
  const fp = i => clamp(o.fill * (n + 2) - i * 1.0, 0, 1);
  const lp = i => (o.line === null ? 0 : clamp(o.line * (n + 3) - i * 1.0, 0, 1));
  if (o.fill < 1 && o.paper) { ctx.fillStyle = o.paper; ctx.fillRect(0, 0, RW, RH); }
  S.forEach((s, i) => drawShape(ctx, s, fp(i), sun, story, o));
  if (o.grain > 0 && o.fill > 0) {
    ctx.save();
    ctx.globalAlpha = o.grain * clamp(o.fill * 1.5 - 0.5);
    ctx.globalCompositeOperation = 'multiply';
    const pat = ctx.createPattern(grain(P.rBrown), 'repeat');
    pat.setTransform(new DOMMatrix().scale(1.4));
    ctx.fillStyle = pat; ctx.fillRect(0, 0, RW, RH);
    ctx.restore();
  }
  if (o.line !== null && o.lineAlpha > 0) {
    ctx.globalAlpha = o.lineAlpha;
    ctx.strokeStyle = o.lineColor; ctx.lineWidth = o.lineW; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    S.forEach((s, i) => lineShape(ctx, s, lp(i), story, o));
  }
  ctx.restore();
}

function flood(ctx, path, f, cx, cy, R, color) {
  if (f <= 0) return;
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  if (f >= 1) ctx.fill(path);
  else { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, R * ease.out(f)), 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawShape(ctx, s, f, sun, story, o) {
  if (f <= 0) return;
  switch (s.kind) {
    case 'sky': {
      const g = ctx.createLinearGradient(0, 0, 0, RH * 0.7);
      g.addColorStop(0, P.rCream); g.addColorStop(1, P.rPeach);
      flood(ctx, pathOf([[0, 0], [RW, 0], [RW, RH], [0, RH]]), f, RW / 2, 0, RW, g);
      break;
    }
    case 'sun': {
      const g = ctx.createLinearGradient(0, s.y - s.r, 0, s.y + s.r * 0.4);
      g.addColorStop(0, P.rMustard); g.addColorStop(1, P.rOrange);
      const p = pathOf(s.pts);
      flood(ctx, p, f, s.x, s.y, s.r * 1.1, g);
      if (f >= 1) {
        // horizontal stripe gaps in the lower half, growing thicker toward the horizon
        ctx.save(); ctx.clip(p);
        const sky = ctx.createLinearGradient(0, 0, 0, RH * 0.7);
        sky.addColorStop(0, P.rCream); sky.addColorStop(1, P.rPeach);
        ctx.fillStyle = sky;
        for (let k = 0; k < 6; k++) { const yy = s.y - s.r * 0.12 + k * s.r * 0.17; ctx.fillRect(s.x - s.r, yy, s.r * 2, 4 + k * 4.5); }
        ctx.restore();
      }
      break;
    }
    case 'cloud': {
      ctx.save(); ctx.globalAlpha *= ease.out(f);
      ctx.fillStyle = mix(P.rCream, '#ffffff', 0.5);
      const hgt = s.w * 0.22;
      ctx.beginPath(); ctx.roundRect(s.x - s.w / 2, s.y, s.w, hgt, hgt / 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(s.x - s.w * 0.25, s.y - hgt * 0.75, s.w * 0.55, hgt, hgt / 2); ctx.fill();
      ctx.fillStyle = P.rPeach; ctx.globalAlpha *= 0.7;
      ctx.fillRect(s.x - s.w / 2, s.y + hgt * 0.45, s.w, 4);
      ctx.restore();
      break;
    }
    case 'band': {
      const p = pathOf(s.pts);
      const mid = s.top[Math.floor(s.top.length / 2)];
      flood(ctx, p, f, mid[0], mid[1] + 60, RW * 0.75, s.fill);
      if (f >= 1 && s.rows) {
        // furrow rows following the hill's curve
        ctx.save(); ctx.clip(p); ctx.strokeStyle = s.rows; ctx.lineWidth = 7; ctx.lineCap = 'round';
        for (let k = 1; k < 6; k++) {
          ctx.beginPath();
          s.top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + k * 26 + k * k * 3) : ctx.moveTo(x, y + k * 26 + k * k * 3)));
          ctx.stroke();
        }
        ctx.restore();
      }
      if (f >= 1 && s.stripes) {
        ctx.save(); ctx.clip(p); ctx.strokeStyle = rgba(s.stripes, 0.35); ctx.lineWidth = 5;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); s.top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + k * 22) : ctx.moveTo(x, y + k * 22))); ctx.stroke(); }
        ctx.restore();
      }
      if (f >= 1 && s.foam) {
        // scalloped foam crest
        ctx.save(); ctx.fillStyle = P.rCream;
        for (let i = 2; i < s.top.length - 2; i += 3) {
          const [x, y] = s.top[i];
          ctx.beginPath(); ctx.ellipse(x, y + 2, 13, 6, 0, Math.PI, TAU); ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'cat': drawCat(ctx, s, f); break;
    case 'kite': drawKite(ctx, s, f); break;
    case 'claudeKite': {
      if (f <= 0) break;
      const pop = ease.outBack(clamp(f));
      const swing = Math.sin(s.t * 2.6) * 0.12;
      const a = claude(ctx, { x: s.x, y: s.y, s: 150 * pop, armR: 1.05 + swing, armL: -0.2 + Math.sin(s.t * 3) * 0.1, eyes: 'happy', ly: -0.6, lx: 0.6, grain: 0.4, light: P.rPeach, sx: 1 + Math.sin(s.t * 5.2) * 0.015, sy: 1 - Math.sin(s.t * 5.2) * 0.02, ...(o.claude || {}) });
      // string to the kite
      ctx.save(); ctx.strokeStyle = P.rBrown; ctx.lineWidth = 2.6; ctx.globalAlpha *= clamp(f * 2 - 1);
      ctx.beginPath(); ctx.moveTo(a.handR[0], a.handR[1]);
      ctx.quadraticCurveTo((a.handR[0] + s.kx) / 2 + 40, (a.handR[1] + s.ky) / 2 + 110, s.kx, s.ky + 52);
      ctx.stroke(); ctx.restore();
      break;
    }
    case 'birds': {
      ctx.save(); ctx.strokeStyle = P.rBrown; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.globalAlpha *= ease.out(f);
      [[560, 330, 0], [610, 300, 1.3], [1250, 380, 2.1]].forEach(([bx, by, ph]) => {
        const fl = Math.sin(s.t * 7 + ph) * 7, xx = bx + Math.sin(s.t * 0.5 + ph) * 30;
        ctx.beginPath(); ctx.moveTo(xx - 18, by - fl); ctx.quadraticCurveTo(xx - 8, by - 8, xx, by); ctx.quadraticCurveTo(xx + 8, by - 8, xx + 18, by - fl); ctx.stroke();
      });
      ctx.restore();
      break;
    }
  }
}

function lineShape(ctx, s, f, story, o) {
  if (f <= 0) return;
  switch (s.kind) {
    case 'sun': strokePartial(ctx, s.pts, f); for (let k = 0; k < 4; k++) { const yy = s.y - s.r * 0.12 + k * s.r * 0.17 + 2; const hw = Math.sqrt(Math.max(0, s.r * s.r - (yy - s.y) ** 2)); strokePartial(ctx, [[s.x - hw, yy], [s.x + hw, yy]], clamp(f * 2 - 0.6 - k * 0.1)); } break;
    case 'band': strokePartial(ctx, s.top, f); break;
    case 'cloud': { const hgt = s.w * 0.22; strokePartial(ctx, [[s.x - s.w / 2 + hgt / 2, s.y + hgt], [s.x + s.w / 2 - hgt / 2, s.y + hgt], ...circ(s.x + s.w / 2 - hgt / 2, s.y + hgt / 2, hgt / 2, 12, Math.PI / 2).slice(0, 7), [s.x + s.w * 0.3, s.y], ...circ(s.x + s.w * 0.02, s.y - hgt * 0.25, hgt / 2, 16, 0).slice(8, 17)], f); break; }
    case 'kite': { const k = kitePts(s); strokePartial(ctx, [...k, k[0]], f); strokePartial(ctx, [k[0], k[2]], f * 1.5 - 0.5); strokePartial(ctx, [k[1], k[3]], f * 1.5 - 0.5); break; }
    case 'claudeKite': {
      ctx.save();
      const m = new DOMMatrix().translate(s.x, s.y).scale(150 / 147);
      ctx.setTransform(ctx.getTransform().multiply(m));
      const pts = [[-73.5, 0], [-73.5, -144], [73.5, -144], [73.5, 0]];
      ctx.lineWidth = o.lineW * 147 / 150;
      strokePartial(ctx, pts, f);
      ctx.restore();
      break;
    }
    case 'cat': { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.tilt); ctx.beginPath(); ctx.ellipse(0, 6, 105 * clamp(f * 2), 12, 0, 0, TAU); ctx.stroke(); if (f > 0.5) { ctx.beginPath(); ctx.ellipse(-6, -52, 30, 38, 0, 0, TAU * clamp(f * 2 - 1)); ctx.stroke(); } ctx.restore(); break; }
    default: break;
  }
}

function kitePts(s) {
  const c = Math.cos(s.rot), sn = Math.sin(s.rot);
  return [[0, -70], [52, 0], [0, 58], [-52, 0]].map(([x, y]) => [s.x + x * c - y * sn, s.y + x * sn + y * c]);
}
function drawKite(ctx, s, f) {
  if (f <= 0) return;
  const k = kitePts(s), c = [s.x, s.y];
  ctx.save(); ctx.globalAlpha *= ease.out(f);
  const tri = (a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.fill(); };
  tri(k[0], k[1], P.rTeal); tri(k[1], k[2], P.rMustard); tri(k[2], k[3], P.rTeal); tri(k[3], k[0], P.rMustard);
  ctx.strokeStyle = P.rRust; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(k[0][0], k[0][1]); ctx.lineTo(k[2][0], k[2][1]); ctx.moveTo(k[1][0], k[1][1]); ctx.lineTo(k[3][0], k[3][1]); ctx.stroke();
  // tail with bows
  ctx.strokeStyle = P.rBrown; ctx.lineWidth = 3;
  const tail = []; for (let i = 0; i <= 20; i++) tail.push([k[2][0] + Math.sin(s.t * 4 + i * 0.5) * 10 * (i / 20) + i * 2, k[2][1] + i * 9]);
  ctx.beginPath(); tail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  [6, 12, 18].forEach((i, j) => { const [x, y] = tail[i]; ctx.fillStyle = j % 2 ? P.rRust : P.rMustard; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y - 9); ctx.lineTo(x - 14, y + 9); ctx.closePath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y - 9); ctx.lineTo(x + 14, y + 9); ctx.closePath(); ctx.fill(); });
  ctx.restore();
}

// where the cat is at time t (for close-up framings)
export function catPos(t) { const x = 800 + Math.sin(t * 0.9) * 260; return [x, 735 + Math.sin((x / RW) * TAU * 1.6 + t * 1.1) * 24 - 70]; }

// The surfing cat (the reference's "surface" character). Origin = board contact point.
export function drawCat(ctx, s, f = 1, { board = true } = {}) {
  if (f <= 0) return;
  const t = s.t || 0;
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.tilt || 0);
  const k = ease.outBack(clamp(f)); ctx.scale(k, k);
  if (board) {
    ctx.fillStyle = P.rMustard; ctx.beginPath(); ctx.ellipse(0, 4, 112, 15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = P.rRust; ctx.fillRect(-112, 1, 224, 6);
    ctx.fillStyle = P.rCream; ctx.beginPath(); ctx.ellipse(80, 0, 12, 4, 0, 0, TAU); ctx.fill();
  }
  const C = P.rBrown, B = P.rCream;
  // legs (crouched surf stance)
  ctx.fillStyle = C;
  ctx.beginPath(); ctx.roundRect(-34, -34, 16, 34, 7); ctx.roundRect(16, -34, 16, 34, 7); ctx.fill();
  // tail
  ctx.strokeStyle = C; ctx.lineWidth = 11; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-34, -48); ctx.bezierCurveTo(-80, -50, -70, -100 + Math.sin(t * 5) * 6, -96, -108 + Math.sin(t * 5) * 8); ctx.stroke();
  // body
  ctx.fillStyle = C; ctx.beginPath(); ctx.ellipse(-4, -62, 40, 34, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(6, -56, 20, 22, -0.15, 0, TAU); ctx.fill();
  // arms out for balance
  ctx.strokeStyle = C; ctx.lineWidth = 12;
  const wob = Math.sin(t * 4) * 0.25;
  ctx.beginPath(); ctx.moveTo(-26, -76); ctx.lineTo(-70, -96 + wob * 30); ctx.moveTo(22, -78); ctx.lineTo(66, -100 - wob * 30); ctx.stroke();
  // head
  ctx.fillStyle = C; ctx.beginPath(); ctx.arc(6, -112, 30, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, -128); ctx.lineTo(-14, -156); ctx.lineTo(4, -138); ctx.closePath(); ctx.moveTo(10, -140); ctx.lineTo(28, -158); ctx.lineTo(32, -128); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.rPink; ctx.beginPath(); ctx.moveTo(-14, -132); ctx.lineTo(-12, -148); ctx.lineTo(-2, -138); ctx.closePath(); ctx.fill();
  // face: shades (cool cat) + cream muzzle
  ctx.fillStyle = B; ctx.beginPath(); ctx.ellipse(12, -100, 14, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = P.rRust; ctx.beginPath(); ctx.roundRect(-10, -122, 20, 11, 4); ctx.roundRect(14, -122, 20, 11, 4); ctx.fill();
  ctx.fillRect(8, -119, 8, 3);
  ctx.fillStyle = P.rBrown; ctx.beginPath(); ctx.arc(12, -104, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// Cached still of a story frame at size (w,h) — for filmstrips, storyboard cards and thumbnails.
const stillCache = new Map();
export function retroStill(story, t, w, h, opts = {}) {
  const key = [story, t.toFixed(2), w, h, JSON.stringify(opts)].join('|');
  if (stillCache.has(key)) return stillCache.get(key);
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  drawRetro(c.getContext('2d'), 0, 0, c.width, c.height, t, story, opts);
  stillCache.set(key, c);
  return c;
}
