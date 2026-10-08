// The room: one desk world framed by every shot's camera. Layout in cm (y=0 desk top).
import { P, mix, rgba } from './palette.js';
import { withCam, apply } from './camera.js';
import { LIGHTS, lit, tone, wall, desk, monitor, keyboard, lamp, lampBeam, duck, mug, clock, poster, windowView, windowFrame, sticky } from './props.js';
import { rectP, rrP, polyP, circP, ellP, blobP, fill, solid, glow, text, contact } from './draw.js';
import { TAU, lerp, clamp } from './core.js';

export const LAYOUT = {
  monitor: { x: 0, w: 62 },
  keyboard: { x: -2, w: 40 },
  lamp: { x: -70 },
  duck: { x: 38 },
  mug: { x: 52 },
  window: { x: 66, y: -100, w: 70, h: 62 },
  clock: { x: -38, y: -72, r: 6 },
  poster: { x: -104, y: -96, w: 22, h: 30 },
  door: { x: -118 },
  WALL_PAR: 0.92,
};

// wall shelf with books, a cactus and a tiny trophy
function shelf(ctx, L) {
  const x = 20, y = -76, w = 40;
  const l = lit(L, x + w / 2, y, 0.3);
  const books = [[2.2, 11, P.red], [1.8, 9.5, P.lemon], [2.6, 12, P.blue], [1.6, 8.5, P.cream], [2.2, 10.5, P.navy]];
  let bx = x + 2;
  books.forEach(([bw, bh, c], i) => {
    const lean = i === 4 ? 0.22 : 0;
    ctx.save(); ctx.translate(bx, y); ctx.rotate(lean);
    solid(ctx, rectP(0, -bh, bw, bh), tone(L, c), { rim: [L.rim, l.rim[1] * 0.6, -0.15], sh: [tone(L, mix(c, P.ink, 0.4)), -0.5, 0] });
    fill(ctx, rectP(0.3, -bh + 1.2, bw - 0.6, 0.5), tone(L, mix(c, P.cream, 0.5)));
    ctx.restore();
    bx += bw + (i === 3 ? 1.6 : 0.15);
  });
  // cactus in a pot
  const cx = x + 27;
  solid(ctx, polyP([[cx - 2.4, y], [cx + 2.4, y], [cx + 3, y - 4], [cx - 3, y - 4]]), tone(L, P.red), { sh: [tone(L, P.redDk), -0.6, 0] });
  const cac = new Path2D();
  cac.roundRect(cx - 1.4, y - 12, 2.8, 9, 1.4);
  cac.roundRect(cx + 0.8, y - 9.5, 3.2, 1.6, 0.8);
  cac.roundRect(cx + 2.6, y - 12, 1.5, 3.8, 0.75);
  cac.roundRect(cx - 3.6, y - 8, 3, 1.4, 0.7);
  cac.roundRect(cx - 3.6, y - 10.4, 1.4, 3.6, 0.7);
  solid(ctx, cac, tone(L, '#2f8f6a'), { rim: [L.rim, l.rim[1] * 0.6, -0.2], sh: [tone(L, '#1d5a48'), -0.7, 0] }, true);
  // trophy
  const tx = x + 35;
  solid(ctx, polyP([[tx - 2, y - 7], [tx + 2, y - 7], [tx + 1.2, y - 4], [tx - 1.2, y - 4]]), tone(L, P.gold), { sh: [tone(L, '#b88a20'), 0.5, 0] });
  fill(ctx, rectP(tx - 0.4, y - 4, 0.8, 2.6), tone(L, P.gold));
  fill(ctx, rectP(tx - 1.6, y - 1.6, 3.2, 1.6), tone(L, P.ink3));
  // plank
  solid(ctx, rectP(x - 1, y, w + 2, 1.4), tone(L, '#3a3577'), { rim: [L.rim, 0, -0.25] });
  fill(ctx, rectP(x + 3, y + 1.4, 1, 2.5), tone(L, P.ink3));
  fill(ctx, rectP(x + w - 4, y + 1.4, 1, 2.5), tone(L, P.ink3));
}

// door light slice on the wall (hallway light), open 0..1
function doorLight(ctx, L, open) {
  if (open <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const x = LAYOUT.door.x;
  const w = 26 * open;
  const p = polyP([[x, -160], [x + w, -160], [x + w * 1.6, 10], [x - w * 0.1, 10]]);
  fill(ctx, p, rgba(P.lemon, 0.28));
  ctx.restore();
}

// Draw the whole room. o: options for props, plus hooks: o.wallExtra(ctx), o.deskBack(ctx), o.deskFront(ctx), o.fg(ctx)
export function room(ctx, c, L, o = {}) {
  const t = o.t || 0;
  // ----- wall layer -----
  withCam(ctx, c, LAYOUT.WALL_PAR, () => {
    wall(ctx, L, -400, 500, -400, 220);
    if (o.wallGlow !== false) {
      // monitor spill on the wall
      glow(ctx, 0, -40, 90, o.screenGlowCol || P.blue, (o.screenGlow ?? 0.55));
    }
    doorLight(ctx, L, o.door || 0);
    const cl = LAYOUT.clock;
    clock(ctx, L, cl.x, cl.y, cl.r, o.clockH ?? 11, o.clockM ?? 58);
    const po = LAYOUT.poster;
    poster(ctx, L, po.x, po.y, po.w, po.h);
    const wi = LAYOUT.window;
    windowView(ctx, L, wi.x, wi.y, wi.w, wi.h, { t, ...(o.windowView || {}) });
    o.windowInside?.(ctx);
    windowFrame(ctx, L, wi.x, wi.y, wi.w, wi.h, o.windowOpen || 0);
    // sticky notes on the wall
    sticky(ctx, L, -74, -62, 6, -0.08, P.lemon, 3);
    sticky(ctx, L, -66, -66, 6, 0.1, P.pink, 2);
    shelf(ctx, L);
    o.wallExtra?.(ctx, L);
  });
  // ----- desk layer -----
  withCam(ctx, c, 1, () => {
    const x1 = o.deskX1 ?? 400;
    if (o.floor) {
      // floor + baseboard beyond the desk's right edge
      fill(ctx, rectP(-400, 71, 800, 3.2), mix(L.wall, P.ink, 0.45));
      fill(ctx, rectP(-400, 74.2, 800, 80), mix(L.deskFront, P.navy, 0.35));
      for (let i = -25; i < 25; i++) fill(ctx, rectP(x1 + i * 16, 74.2, 0.3, 80), rgba(P.ink, 0.35));
      // desk leg
      fill(ctx, rectP(x1 - 5, 8, 3.2, 66.2), L.deskFront);
      fill(ctx, rectP(x1 - 2.2, 8, 0.4, 66.2), L.deskEdge);
      o.floorStuff?.(ctx, L);
    }
    desk(ctx, L, -400, x1);
    o.deskBack?.(ctx, L);
    const lp = lamp(ctx, L, LAYOUT.lamp.x, { a1: -0.15, a2: 1.72, dir: 1.25, on: o.lampOn ?? 0, ...(o.lamp || {}) });
    const mon = monitor(ctx, L, LAYOUT.monitor.x, -2.5, LAYOUT.monitor.w, o.screen, { rimCol: o.monitorRim });
    // sticky notes on the bezel
    sticky(ctx, L, 25.5, -26, 4.2, 0.12, P.lemon, 0, 'TODO');
    if (!o.hideKeyboard) keyboard(ctx, L, LAYOUT.keyboard.x, LAYOUT.keyboard.w, { press: o.press });
    if (!o.hideDuck) duck(ctx, L, LAYOUT.duck.x, 0, 9, { look: -1, ...(o.duck || {}) });
    if (!o.hideMug) mug(ctx, L, LAYOUT.mug.x, 0, { steam: o.steam ?? 0, t });
    o.deskMid?.(ctx, L, lp, mon);
    if ((o.lampOn ?? 0) > 0 && o.beam !== false) lampBeam(ctx, lp, o.lampOn ?? 0, 70, 0.4, P.lemon, o.beamA ?? 0.22);
    o.deskFront?.(ctx, L, lp, mon);
  });
  // ----- foreground layer -----
  if (o.fg) withCam(ctx, c, 1.25, () => o.fg(ctx, L));
}

// Developer silhouette (seen from behind / side). Units cm. pose: {lean, armA (shoulder), armB (elbow), reach}
export function dev(ctx, L, x, y, s, o = {}) {
  const { lean = 0, armA = 0.4, armB = -0.3, armLen = 1, head = 0, rim = L.rim, col = P.ink, mugInHand = false } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  // torso
  const torso = blobP([[-16, 40], [-18, 6], [-12, -6], [0, -9], [12, -6], [18, 6], [16, 40]]);
  // head + hair tuft
  const hd = blobP([[-7, -12], [-9, -21], [-6, -28], [0, -31], [6, -29], [9, -22], [8, -14], [4, -10], [-3, -9]]);
  const hair = blobP([[-8, -24], [-5, -31], [1, -33.5], [6, -31.5], [9.5, -25], [4, -28.5], [-2, -28.5]]);
  const neck = rectP(-3.5, -12, 7, 6);
  // arm (upper + forearm) from right shoulder
  const sh = [13, -2];
  const e = [sh[0] + Math.cos(armA) * 17 * armLen, sh[1] + Math.sin(armA) * 17 * armLen];
  const hnd = [e[0] + Math.cos(armA + armB) * 16 * armLen, e[1] + Math.sin(armA + armB) * 16 * armLen];
  const limb = (p, q, w) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d * w, ny = dx / d * w;
    return polyP([[p[0] + nx, p[1] + ny], [q[0] + nx * 0.85, q[1] + ny * 0.85], [q[0] - nx * 0.85, q[1] - ny * 0.85], [p[0] - nx, p[1] - ny]]);
  };
  const arm = union2(limb(sh, e, 4.2), limb(e, hnd, 3.4), circP(e[0], e[1], 3.6), circP(hnd[0], hnd[1], 3.2), circP(sh[0], sh[1], 5));
  const shape = union2(torso, hd, hair, neck, arm);
  solid(ctx, shape, col, { rim: [rim, 0.9, -0.6] }, true);
  ctx.restore();
  return { hand: [x + hnd[0] * s, y + hnd[1] * s] };
}
function union2(...ps) { const p = new Path2D(); ps.forEach(q => p.addPath(q)); return p; }

// A big fingertip pressing down (for key close-ups), screen-ish units
export function finger(ctx, x, y, s, rim = P.blueLt) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const f = new Path2D();
  f.moveTo(-21, -80); f.lineTo(-21, -10); f.quadraticCurveTo(-21, 12, 0, 12); f.quadraticCurveTo(21, 12, 21, -10); f.lineTo(21, -80); f.closePath();
  const knuckle = new Path2D(); knuckle.ellipse(0, -62, 24, 10, 0, 0, Math.PI * 2);
  const hand = blobP([[-60, -190], [-34, -96], [-22, -78], [26, -78], [46, -100], [90, -186]]);
  const curl = new Path2D(); curl.roundRect(24, -112, 44, 30, 15); curl.roundRect(30, -140, 46, 30, 15);
  const shape = union2(f, hand, knuckle, curl);
  solid(ctx, shape, P.ink, { rim: [rim, 2.4, -1.2] }, true);
  fill(ctx, rrP(-12, -6, 24, 15, 6), mix(P.ink, rim, 0.22));
  ctx.restore();
}

// monitor screen geometry (matches props.monitor at LAYOUT.monitor, bottom y = -2.5)
export function screenRect() {
  const w = LAYOUT.monitor.w, h = w * 9 / 16, bez = w * 0.022;
  const top = -2.5 - h - 11;
  return { sx: LAYOUT.monitor.x - w / 2 + bez, sy: top + bez, sw: w - bez * 2, sh: h - bez * 2.4 };
}
// virtual screen px (1600x900) -> world cm
export function scr(vx, vy) {
  const r = screenRect();
  return [r.sx + vx * r.sw / 1600, r.sy + vy * r.sh / 900];
}
// zoom (px/cm) at which `vw` virtual px of screen span the frame width
export function scrZoom(vw) { return 1920 / (vw * screenRect().sw / 1600); }
