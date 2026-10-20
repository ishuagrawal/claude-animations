// "Touch the Light": a fingertip draws a loose loop of light that springs into a display; touches
// ripple across it; the camera rises to reveal a laptop; light pours into the logo; the lid closes
// into a single line; title.
import { W, H, SS, clamp, lerp, inv, sstep, easeInOut, easeIn, win, bezier, apple, spring, hash } from './core.js';
import { Poly, catmull, resample } from './geom.js';
import { camera, lidMap, baseMap, DISP, HINGE_Y, BASE } from './cam.js';
import { ribbon, glow, AMBER } from './ribbon.js';
import * as S from './shapes.js';
import { T } from './timeline.js';

let G = null;
function load() {
  const lasso = S.lassoPts(), rect = S.rectPts();
  const lassoPoly = new Poly(lasso, true), rectPoly = new Poly(rect, true);
  const pillY = -DISP.h / 2 + 21;
  const pill = new Poly(S.pillPts().map(([x, y]) => [x, y + pillY]), true);
  // swipe: drag right-to-left, then the flung trail keeps going past the display edge
  const swipeCP = [[232, 74], [150, 64], [40, 54], [-80, 48], [-130, 46], [-330, 42], [-620, 40], [-950, 40]];
  const swipe = new Poly(resample(catmull(swipeCP, false, 30), 600));
  let liftS = 0; { let best = 1e9; for (let i = 0; i < swipe.n; i++) { const d = Math.hypot(swipe.x[i] + 130, swipe.y[i] - 46); if (d < best) { best = d; liftS = swipe.s[i]; } } }
  const logo = S.logoPolys();
  const M = logo.top;
  const spiral = (P0, turn) => {
    const pts = [];
    for (let k = 0; k <= 80; k++) {
      const q = k / 80, a = turn * q, r = 1 - q;
      const dx = P0[0] - M[0], dy = P0[1] - M[1];
      pts.push([M[0] + (dx * Math.cos(a) - dy * Math.sin(a)) * r, M[1] + (dx * Math.sin(a) + dy * Math.cos(a)) * r]);
    }
    return new Poly(resample(pts, 300));
  };
  G = {
    lasso, rect, lassoPoly, rectPoly, pill, pillY, swipe, liftS, logo, M,
    pinchA: spiral([-262, -176], 1.5), pinchB: spiral([268, 150], 1.5),
    base: new Poly(S.basePts()), front: new Poly(S.frontPts()), hinge: new Poly(S.hingePts()),
    out: -rectPoly.inward,
  };
}

// ---------- camera & lid ----------
const gestEase = bezier(0.4, 0.08, 0.3, 1);
const sHeadG = t => G.lassoPoly.L * gestEase(inv(T.gest[0], T.gest[1], t));
const closeEase = bezier(0.5, 0, 0.25, 1);
const LEAN = -0.3;

function lidAngle(t) {
  const lean = LEAN * apple(inv(T.pull[0], T.pull[1], t));
  return lerp(lean, Math.PI / 2 - 0.004, closeEase(inv(T.close[0], T.close[1], t)));
}

function camAt(t) {
  // 1) gesture: close on the fingertip, easing out to the full display
  const z0 = 2.6;
  const zq = apple(inv(T.touch - 0.1, T.gest[1] - 0.15, t));
  const zoom = lerp(z0, 1, zq);
  const follow = (zoom - 1) / (z0 - 1);
  const hp = G.lassoPoly.at(sHeadG(t - 0.1));
  let c = { tx: hp.x * follow, ty: hp.y * follow, tz: 0, yaw: 0, pitch: 0, dist: 1500, zoom };
  // gentle push while the display is alive
  c.zoom *= 1 + 0.035 * sstep(T.gest[1], T.pull[0], t);
  // 2) pull back and rise to reveal the laptop
  const p = apple(inv(T.pull[0], T.pull[1], t));
  const L1 = { tx: 0, ty: 118, tz: -150, yaw: -0.4, pitch: 0.36, dist: 2350, zoom: 0.93 };
  for (const k in L1) c[k] = lerp(c[k], L1[k], p);
  // 3) slow drift toward the screen while the logo appears
  const d = easeInOut(inv(T.pull[1] - 0.6, T.close[0] + 0.3, t), 2);
  c.yaw = lerp(c.yaw, -0.3, d); c.dist = lerp(c.dist, 2260, d); c.pitch = lerp(c.pitch, 0.33, d);
  c.tx = lerp(c.tx, 40, d); c.ty = lerp(c.ty, 70, d);
  // 4) lid closes: come down level with the laptop and square up
  const q = apple(inv(T.close[0] - 0.1, T.close[1] + 0.25, t));
  const L2 = { tx: 0, ty: HINGE_Y, tz: -BASE.d / 2, yaw: 0, pitch: 0.05, dist: 2250, zoom: 1.0 };
  for (const k in L2) c[k] = lerp(c[k], L2[k], q);
  return camera(c);
}

// inside-out fade (inner fibers first, the anchored edge last) for p in 0..1
const insideOut = p => u => 1 - clamp((p * 1.35 - (1 - u) * 0.75) / 0.6);

// ---------- touch visuals ----------
function ring(ctx, map, x, y, r, a, lw = 1.1) {
  if (a <= 0.004 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(214,226,246,${Math.min(1, a)})`;
  ctx.lineWidth = lw * SS;
  ctx.beginPath();
  for (let k = 0; k <= 72; k++) { const an = k / 72 * Math.PI * 2; const [px, py] = map(x + r * Math.cos(an), y + r * Math.sin(an)); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  ctx.restore();
}
// fingertip contact: touchdown ripple, a soft hot core while pressed, a fade on lift
function contact(ctx, map, sc, x, y, t, down, up) {
  if (t < down - 0.05 || t > up + 0.6) return;
  const press = sstep(down - 0.04, down + 0.06, t) * (1 - sstep(up, up + 0.22, t));
  const [px, py] = map(x, y);
  glow(ctx, px, py, 30 * sc, 0.55 * press);
  glow(ctx, px, py, 9 * sc, 0.9 * press, [255, 255, 255]);
  for (let k = 0; k < 2; k++) {
    const tau = t - down - k * 0.11;
    if (tau > 0 && tau < 0.9) ring(ctx, map, x, y, 12 + 95 * Math.pow(tau / 0.9, 0.6), 0.55 * (1 - tau / 0.9) * (1 - k * 0.35));
  }
  const tl = t - up;
  if (tl > 0 && tl < 0.5) ring(ctx, map, x, y, 6 + 30 * (tl / 0.5), 0.25 * (1 - tl / 0.5), 0.8);
}

// pulses of light that run around the frame from a point (after the seal and after each touch)
function framePulses(t, L) {
  const P = [
    { t0: T.seal, s0: 0, amp: 1.0, v: 900, life: 1.7 },
    { t0: T.swipe[0], s0: nearestS(232, 74), amp: 0.7, v: 1100, life: 1.0 },
    { t0: T.pinch[2], s0: nearestS(G.M[0], G.M[1]), amp: 1.0, v: 1100, life: 1.2 },
  ];
  return (s) => {
    let v = 1;
    for (const p of P) {
      const tau = t - p.t0;
      if (tau < 0 || tau > p.life) continue;
      let d = Math.abs(s - p.s0); d = Math.min(d, L - d);
      const front = tau * p.v, fall = 1 - tau / p.life;
      v += p.amp * fall * Math.exp(-Math.pow((d - front) / 70, 2));
    }
    return v;
  };
}
const nearestS = (x, y) => { let best = 1e9, s = 0; const P = G.rectPoly; for (let i = 0; i < P.n; i++) { const d = Math.hypot(P.x[i] - x, P.y[i] - y); if (d < best) { best = d; s = P.s[i]; } } return s; };

function clipDisplay(ctx, map) {
  const P = G.rectPoly;
  ctx.beginPath();
  for (let i = 0; i < P.n; i += 2) { const [x, y] = map(P.x[i], P.y[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath();
  ctx.clip();
}

// a moving trail along a path: head at sh, tail lagging; tapered at both ends
function trail(ctx, poly, map, sh, st, gain, t, wMax = 20, seed = 3) {
  if (sh - st < 1) return;
  const len = sh - st;
  ribbon(ctx, poly, {
    map, a: st, b: sh, N: 28, centered: true, lw: 1.0, gain, time: t, seed, tip: 0.6,
    width: s => wMax * Math.min(1, sstep(st, st + len * 0.7, s)) * (1 - sstep(sh - Math.min(26, len * 0.3), sh + 1, s)) + 0.5,
    accentGain: 0.7,
  });
}

// ---------- text ----------
const tl = document.createElement('canvas');
function title(ctx, text, t, [t0, t1], { size = 60, weight = 500, y = H / 2 }) {
  if (t < t0 || t > t1) return;
  const inP = clamp((t - t0) / 1.1), outP = clamp((t - (t1 - 0.55)) / 0.55);
  tl.width = W * SS; tl.height = 260 * SS;
  const c = tl.getContext('2d', { willReadFrequently: true });
  c.font = `${weight} ${size * SS}px Inter`;
  c.letterSpacing = `${lerp(0.16, -0.012, apple(inP)) * size * SS}px`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const tw = c.measureText(text).width, cx = tl.width / 2, cy = tl.height / 2;
  const g = c.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  const sh = lerp(-0.3, 1.3, clamp((t - t0 - 0.25) / 1.6));
  g.addColorStop(0, '#aeb9cb');
  g.addColorStop(clamp(sh - 0.18), '#c9d3e2');
  g.addColorStop(clamp(sh), '#ffffff');
  g.addColorStop(clamp(sh + 0.18), '#c9d3e2');
  g.addColorStop(1, '#9fabbf');
  c.fillStyle = g;
  c.fillText(text, cx, cy);
  // soft left-to-right wipe
  c.globalCompositeOperation = 'destination-in';
  const wp = lerp(-0.25, 1.25, apple(inP));
  const m = c.createLinearGradient(cx - tw / 2 - 40, 0, cx + tw / 2 + 40, 0);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(clamp(wp), 'rgba(0,0,0,1)'); m.addColorStop(clamp(wp + 0.25), 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = m; c.fillRect(0, 0, tl.width, tl.height);
  ctx.save();
  ctx.globalAlpha = 1 - outP;
  const blur = 10 * (1 - apple(inP)) + 8 * outP * outP;
  if (blur > 0.2) ctx.filter = `blur(${blur * SS}px)`;
  ctx.drawImage(tl, 0, (y - 130) * SS - outP * 6 * SS);
  ctx.restore();
}

// ---------- the film ----------
function draw(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W * SS, H * SS);
  const cam = camAt(t);
  const th = lidAngle(t);
  const lid = lidMap(cam, th), base = baseMap(cam);
  const sc = cam.scaleAt(0, 0, 0);
  const closing = inv(T.close[0], T.close[1], t);
  const lineP = inv(T.line[0], T.line[1], t);
  const sceneGain = 1 - sstep(T.line[0] + 0.05, T.line[0] + 0.45, t);

  if (sceneGain > 0.002) {
    // ---- base (behind the lid when open) ----
    const bq = inv(T.base[0], T.base[1], t), fq = inv(T.front[0], T.front[1], t);
    const baseFade = null;
    const baseRim = sstep(0.45, 1, closing) * 0.9;
    if (bq > 0) {
      const be = bezier(0.4, 0, 0.15, 1)(bq), L = G.base.L;
      ribbon(ctx, G.base, {
        map: base, a: 0, b: L * be, comb: 30 * (1 - be), tip: 0.7 * (1 - bq), N: 30, side: -G.base.inward || 1, lw: 1.0,
        width: s => 30 * sstep(0, 70, s) * (1 - sstep(L - 60, L, s)) + 1, gain: 0.82 * sceneGain, time: t, seed: 11,
        fade: baseFade, rim: baseRim, accentGain: 0.8,
      });
    }
    if (fq > 0) {
      const fe = apple(fq), L = G.front.L, mid = L / 2;
      ribbon(ctx, G.front, {
        map: baseMap(cam, BASE.drop + BASE.thick), a: mid - mid * fe, b: mid + mid * fe, N: 14, centered: true, lw: 0.9,
        width: s => 9 * sstep(0, 50, s) * (1 - sstep(L - 50, L, s)) + 0.5, gain: 0.55 * sceneGain, time: t, seed: 21,
        fade: baseFade, rim: baseRim, accents: null,
      });
    }
    // ---- hinge ----
    const hq = inv(T.hinge[0], T.hinge[1], t);
    if (hq > 0) {
      const he = apple(hq), L = G.hinge.L, mid = L / 2;
      ribbon(ctx, G.hinge, {
        map: (x, y) => lid(x, y + HINGE_Y - 3), a: mid - mid * he, b: mid + mid * he, N: 14, centered: true, lw: 0.9,
        width: s => 8 * sstep(0, 40, s) * (1 - sstep(L - 40, L, s)) + 0.5, gain: 0.6 * sceneGain, time: t, seed: 31,
        accents: null,
      });
    }

    // ---- display frame: the lasso that becomes the bezel ----
    const sh = sHeadG(t);
    const m = spring(t - T.snap, 1.9, 0.36);
    const mm = clamp(m);
    const P = m <= 0 ? G.lassoPoly : new Poly(S.morph(G.lasso, G.rect, m), true);
    const Lg = G.lassoPoly.L, L = P.L;
    const drawing = t < T.gest[1] + 0.05;
    const prof = q => sstep(0, 0.07, q) * (1 - sstep(0.9, 1.0, q)) * (0.62 + 0.38 * Math.sin(Math.PI * clamp((q - 0.04) / 0.62))) * 0.92 + 0.04;
    const pulses = framePulses(t, L);
    const fq2 = sstep(0.0, 0.9, closing);
    const rimSweep = s => {
      // amber light runs along the lid's top edge as the camera comes round, then glows as it closes
      const k = inv(T.rim[0], T.rim[1], t);
      const top = (s < L * 0.25 || s > L * 0.75) ? 1 : 0.35;
      const posS = (L * 0.86 + k * L * 0.36) % L;
      let d = Math.abs(s - posS); d = Math.min(d, L - d);
      return top * Math.sin(Math.PI * k) * Math.exp(-Math.pow(d / 180, 2)) * 1.6 + sstep(0.35, 1, closing) * 0.8;
    };
    ribbon(ctx, P, {
      map: lid, a: 0, b: drawing ? Math.min(sh, L) : L, side: G.out, N: 36, lw: lerp(1.25, 1.0, mm),
      width: s => lerp(66 * prof((s / L)), 26, mm),
      comb: drawing ? 22 * (1 - inv(T.gest[1] - 0.6, T.gest[1], t)) : 0, tip: drawing ? 0.9 : 0,
      gain: sceneGain * (1 + 0.2 * Math.exp(-Math.pow((t - T.seal) / 0.12, 2))), time: t, seed: 1,
      shimmer: (s) => pulses(s), fade: insideOut(fq2 * 0.3), rim: rimSweep, accentGain: lerp(1, 0.7, mm),
    });
    // fingertip riding the head of the stroke
    if (t > T.touch - 0.1 && t < T.gest[1] + 0.5) {
      const hq2 = P.at(Math.min(sh, L));
      const wv = 66 * prof(Math.min(sh, L) / L) * 0.4 * G.out;
      const [hx, hy] = lid(hq2.x + hq2.nx * wv, hq2.y + hq2.ny * wv);
      const press = sstep(T.touch - 0.08, T.touch + 0.12, t) * (1 - sstep(T.gest[1] - 0.1, T.gest[1] + 0.3, t));
      glow(ctx, hx, hy, 46 * Math.sqrt(sc), 0.32 * press);
      glow(ctx, hx, hy, 12 * Math.sqrt(sc), 0.55 * press, [255, 255, 255]);
      if (t < T.gest[0] + 0.8) for (let k = 0; k < 2; k++) {
        const tau = t - T.touch - k * 0.12;
        if (tau > 0 && tau < 0.9) ring(ctx, lid, 0, -256, 10 + 70 * Math.pow(tau / 0.9, 0.6), 0.5 * (1 - tau / 0.9), 1.0);
      }
    }
    // the seam seals with a flash
    {
      const f = Math.exp(-Math.pow((t - T.seal) / 0.16, 2)) + 0.6 * Math.exp(-Math.max(0, t - T.seal) / 0.5) * (t > T.seal ? 1 : 0);
      if (f > 0.01) { const [x, y] = lid(0, -DISP.h / 2 - 13); glow(ctx, x, y, 110 * sc, 0.32 * f); glow(ctx, x, y, 20 * sc, 0.75 * f, [255, 255, 255]); }
    }

    // ---- inside the display ----
    ctx.save();
    clipDisplay(ctx, lid);
    const content = 1 - sstep(0.05, 0.45, closing);
    // camera island: a drop of light settles and opens into a pill
    const pq = inv(T.pill[0], T.pill[1], t);
    if (pq > 0) {
      const drop = apple(inv(0, 0.4, pq));
      const dy = lerp(-DISP.h / 2 + 2, G.pillY, drop);
      const [dx2, dy2] = lid(0, dy);
      glow(ctx, dx2, dy2, 16 * sc, 0.8 * (1 - sstep(0.45, 0.8, pq)) * content, [255, 255, 255]);
      const op = apple(inv(0.32, 1, pq)), PL = G.pill.L;
      ribbon(ctx, G.pill, {
        map: lid, a: 0, b: PL * op / 2, N: 8, side: -G.pill.inward, lw: 0.85, width: () => 4, gain: 0.75 * content, time: t, seed: 41, accents: null,
      });
      ribbon(ctx, G.pill, {
        map: lid, a: PL - PL * op / 2, b: PL, N: 8, side: -G.pill.inward, lw: 0.85, width: () => 4, gain: 0.75 * content, time: t, seed: 41, accents: null,
      });
    }
    // swipe: touch, drag, lift; the trail is flung off the edge
    {
      const [d0, d1, up] = T.swipe;
      if (t > d0 - 0.1 && t < up + 1.4) {
        const sl = G.liftS;
        const sAt = tt => {
          if (tt < d1) return 0;
          if (tt < up) { const q = (tt - d1) / (up - d1); return sl * (1.4 * q * q - 0.4 * q * q * q); }
          const v = sl * 1.6 / (up - d1), tc = 0.55, tau = tt - up;
          return sl + v * tc * (1 - Math.exp(-tau / tc));
        };
        const shd = sAt(t), stl = sAt(t - 0.3);
        trail(ctx, G.swipe, lid, shd, stl, content * (1 - sstep(up + 0.35, up + 1.1, t)), t, 36, 5);
        const fp = G.swipe.at(Math.min(shd, sl));
        contact(ctx, lid, sc, fp.x, fp.y, t, d0, up);
      }
    }
    // pinch: two fingers spiral in and fuse into a seed of light
    {
      const [d0, mv, meet] = T.pinch;
      if (t > d0 - 0.1 && t < meet + 1) {
        const pe = bezier(0.45, 0, 0.75, 1);
        const sA = tt => G.pinchA.L * pe(inv(mv, meet, tt)), sB = tt => G.pinchB.L * pe(inv(mv, meet, tt));
        const g = content * (1 - sstep(meet - 0.05, meet + 0.25, t));
        trail(ctx, G.pinchA, lid, sA(t), sA(t - 0.36), g, t, 28, 7);
        trail(ctx, G.pinchB, lid, sB(t), sB(t - 0.36), g, t, 28, 9);
        const a = G.pinchA.at(sA(t)), b = G.pinchB.at(sB(t));
        contact(ctx, lid, sc, a.x, a.y, t, d0, meet);
        contact(ctx, lid, sc, b.x, b.y, t, d0 + 0.04, meet);
      }
    }
    // the seed, the pour and the logo
    {
      const meet = T.pinch[2];
      const [M0, M1] = G.M;
      const logoFade = insideOut(sstep(0.0, 0.7, closing));
      const logoRim = sstep(0.2, 0.6, closing);
      if (t > meet - 0.05 && t < T.pour[0] + 0.5) {
        const [x, y] = lid(M0, M1);
        const flash = Math.exp(-Math.max(0, t - meet) / 0.35);
        const breathe = 0.75 + 0.25 * Math.sin((t - meet) * 3.2);
        const keep = 1 - sstep(T.pour[0], T.pour[0] + 0.4, t);
        glow(ctx, x, y, (24 + 60 * flash) * sc, (0.32 + 0.28 * flash) * keep);
        glow(ctx, x, y, 8 * sc, 0.95 * breathe * keep, [255, 255, 255]);
        const tau = t - meet;
        if (tau > 0 && tau < 1.1) ring(ctx, lid, M0, M1, 10 + 150 * Math.pow(tau / 1.1, 0.55), 0.45 * (1 - tau / 1.1), 1.0);
      }
      const B = G.logo.body, Lb = B.L, sb = G.logo.sBottom;
      const pq = inv(T.pour[0], T.pour[1], t);
      const lq = inv(T.leaf[0], T.leaf[1], t);
      const lw = 44;
      const holdShim = s => {
        const k = t - T.pour[1];
        if (k < 0) return 1;
        const pos = (k * 420) % (Lb * 1.6);
        let d = Math.abs(s - pos);
        return 1 + 0.55 * Math.exp(-Math.pow(d / 90, 2)) * (1 - sstep(0, 1.5, closing * 3));
      };
      const meetFlash = Math.exp(-Math.pow((t - T.pour[1]) / 0.14, 2));
      if (lq > 0) {
        const le = bezier(0.3, 0, 0.2, 1)(lq), LL = G.logo.leaf.L;
        ribbon(ctx, G.logo.leaf, {
          map: lid, a: 0, b: LL * le, comb: 10 * (1 - le), tip: 0.8 * (1 - lq), N: 20, side: G.logo.leaf.inward, lw: 0.95,
          levels: G.logo.leafLevels, levelStep: 1.6, wRef: 15,
          width: s => 15 * sstep(0, 22, s) + 0.5, gain: content > 0 ? 1 : 0, time: t, seed: 51, fade: logoFade, rim: logoRim, accentGain: 0.6,
        });
      }
      if (pq > 0) {
        const pe = bezier(0.4, 0.05, 0.2, 1)(pq);
        const fwd = sb * pe, back = (Lb - sb) * pe;
        const wFn = s => {
          // thin where the light is still arriving, full where it has settled
          const dTop = Math.min(s, Lb - s);
          return lw * (0.12 + 0.88 * Math.max(sstep(0, 70, dTop), sstep(0.45, 1, pq))) + 0.5;
        };
        const common = { map: lid, N: 34, side: B.inward, lw: 0.95, width: wFn, levels: G.logo.bodyLevels, levelStep: 3.6, wRef: lw, time: t, seed: 61, fade: logoFade, rim: logoRim, shimmer: holdShim };
        const g = 1 + 0.7 * meetFlash;
        ribbon(ctx, B, { ...common, a: 0, b: fwd, comb: 16 * (1 - pe), tip: 0.8 * (1 - pq), gain: g });
        ribbon(ctx, B, { ...common, a: Lb - back, b: Lb, combA: 16 * (1 - pe), gain: g });
        // two drops of light lead the pour
        if (pq < 1) {
          const a = B.at(fwd), b = B.at(Lb - back);
          for (const q of [a, b]) {
            const off = lw * 0.35 * B.inward;
            const [x, y] = lid(q.x + q.nx * off, q.y + q.ny * off);
            glow(ctx, x, y, 34 * sc, 0.35 * (1 - pq * 0.6));
            glow(ctx, x, y, 8 * sc, 0.7 * (1 - pq * 0.6), [255, 255, 255]);
          }
        }
        if (meetFlash > 0.01) { const q = B.at(sb); const [x, y] = lid(q.x, q.y); glow(ctx, x, y, 90 * sc, 0.45 * meetFlash); }
      }
    }
    ctx.restore();
  }

  // ---- the closed laptop becomes one line, which draws back into a point ----
  if (t > T.line[0] - 0.05 && t < T.line[1] + 0.3) {
    const [cx, cy] = baseMap(cam)(0, BASE.d * 0.5);
    const [ex] = baseMap(cam)(BASE.w / 2, BASE.d * 0.5);
    const half = (ex - cx) / SS;
    const lp = bezier(0.55, 0, 0.3, 1)(lineP);
    const hl = half * (1 - lp);
    const pts = resample([[-half, 0], [half, 0]], 300);
    const poly = new Poly(pts);
    const L = poly.L;
    const appear = sstep(T.line[0] - 0.05, T.line[0] + 0.25, t);
    const map = (x, y) => [cx + x * SS, cy + y * SS];
    ribbon(ctx, poly, {
      map, a: L / 2 - hl, b: L / 2 + hl, N: 12, centered: true, lw: 1.1, time: t, seed: 71,
      width: s => 7 * sstep(L / 2 - hl, L / 2 - hl + 80, s) * (1 - sstep(L / 2 + hl - 80, L / 2 + hl, s)) + 0.4,
      gain: appear * 1.7, rim: 0.45, accents: null,
    });
    const pt = Math.exp(-Math.pow((lineP - 1) / 0.12, 2)) * (1 - sstep(T.line[1], T.line[1] + 0.3, t));
    glow(ctx, cx, cy, 60, 0.6 * pt);
    glow(ctx, cx, cy, 10, 0.9 * pt, [255, 255, 255]);
  }

  // ---- titles ----
  title(ctx, 'Touch the light.', t, T.text1, { size: 66, weight: 500 });
  title(ctx, 'MacBook Pro', t, T.text2, { size: 86, weight: 600 });
  return {};
}

export const film = { duration: T.end, load, draw };
