// Desk-world props, drawn in centimetres with y = 0 at the desk surface (negative is up).
// Every prop takes a lighting state L so the same set reads as night / show / morning.
import { P, mix, rgba } from './palette.js';
import { rectP, rrP, circP, ellP, polyP, blobP, union, fill, solid, crescent, glow, text, sparkle } from './draw.js';
import { TAU, clamp, hash, hash2, rng, lerp, noise } from './core.js';

// ---------- lighting states ----------
export const LIGHTS = {
  // developer still working: lamp on, monitor on
  work: {
    wall: '#17217a', wallDk: '#0d1458', deskTop: '#2a2470', deskFront: '#100d2c', deskEdge: P.blueLt,
    tint: '#0e1660', tintAmt: 0.25, sh: P.ink2, rim: P.blueLt, rimW: 0.32, src: { x: 0, y: -30 },
  },
  // lights out: only the monitor's blue glow
  dark: {
    wall: '#0c1460', wallDk: '#070c3d', deskTop: '#1a1a55', deskFront: '#08071a', deskEdge: P.blue,
    tint: '#0a1150', tintAmt: 0.62, sh: P.ink, rim: P.blueLt, rimW: 0.32, src: { x: 0, y: -30 },
  },
  // showtime: hot-red stage wash from the reference trailer, lemon spotlight
  show: {
    wall: P.red, wallDk: '#c41641', deskTop: '#3a1d6e', deskFront: P.ink, deskEdge: P.blueLt,
    tint: '#2a0d3c', tintAmt: 0.12, sh: P.ink, rim: P.lemon, rimW: 0.3, src: { x: -30, y: -50 },
  },
  // morning after: lemon daylight, long blue shadows
  morning: {
    wall: '#f6e98a', wallDk: '#e2c95a', deskTop: '#c9b27a', deskFront: '#3a2f6b', deskEdge: P.cream,
    tint: '#ffffff', tintAmt: 0.0, sh: '#4a4a9a', rim: P.cream, rimW: 0.3, src: { x: 120, y: -60 },
  },
  // epilogue: calm cream night
  calm: {
    wall: '#1b2a8f', wallDk: '#111c6a', deskTop: '#2c2a78', deskFront: '#0e0c2a', deskEdge: P.sky,
    tint: '#101a70', tintAmt: 0.2, sh: P.ink2, rim: P.sky, rimW: 0.3, src: { x: -30, y: -50 },
  },
};
export const tone = (L, c) => (L.tintAmt ? mix(c, L.tint, L.tintAmt) : c);
// rim/shadow offsets for an object at x (rim faces the light source)
export function lit(L, x, y = -10, w = L.rimW) {
  const dx = L.src.x - x, dy = L.src.y - y;
  const d = Math.hypot(dx, dy) || 1;
  return { rim: [L.rim, (dx / d) * w, (dy / d) * w], sh: [L.sh, (-dx / d) * w * 2.2, (-dy / d) * w * 1.2] };
}

// ---------- wall / room ----------
export function wall(ctx, L, x0, x1, y0, y1) {
  ctx.fillStyle = L.wall;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

export function clock(ctx, L, x, y, r, hours, mins) {
  const l = lit(L, x, y, 0.5);
  solid(ctx, circP(x, y, r), tone(L, P.cream), { sh: [tone(L, '#b9b6c8'), l.sh[1] * 0.8, l.sh[2] * 0.8] });
  ctx.strokeStyle = tone(L, P.ink); ctx.lineWidth = r * 0.12;
  ctx.beginPath(); ctx.arc(x, y, r * 0.94, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    ctx.fillStyle = tone(L, P.ink);
    ctx.save(); ctx.translate(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74); ctx.rotate(a);
    ctx.fillRect(-r * 0.08, -r * 0.03, i % 3 ? r * 0.08 : r * 0.16, r * 0.06); ctx.restore();
  }
  const ha = ((hours % 12) + mins / 60) / 12 * TAU - Math.PI / 2, ma = mins / 60 * TAU - Math.PI / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = tone(L, P.ink); ctx.lineWidth = r * 0.12;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5); ctx.stroke();
  ctx.lineWidth = r * 0.07;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ma) * r * 0.75, y + Math.sin(ma) * r * 0.75); ctx.stroke();
  ctx.fillStyle = tone(L, P.red); ctx.beginPath(); ctx.arc(x, y, r * 0.08, 0, TAU); ctx.fill();
}

// retro "SHIP IT" poster: rocket over a sun
export function poster(ctx, L, x, y, w, h) {
  const l = lit(L, x + w / 2, y + h / 2, 0.45);
  solid(ctx, rectP(x, y, w, h), tone(L, P.lemon), { sh: [tone(L, P.lemonDk), l.sh[1], l.sh[2]], rim: [L.rim, l.rim[1], l.rim[2]] });
  fill(ctx, rectP(x + w * 0.07, y + w * 0.07, w * 0.86, h * 0.68), tone(L, P.navy));
  ctx.save(); ctx.beginPath(); ctx.rect(x + w * 0.07, y + w * 0.07, w * 0.86, h * 0.68); ctx.clip();
  fill(ctx, circP(x + w / 2, y + h * 0.5, w * 0.36), tone(L, P.red));
  // rocket
  const rx = x + w / 2, ry = y + h * 0.38;
  fill(ctx, polyP([[rx, ry - h * 0.2], [rx + w * 0.08, ry - h * 0.05], [rx + w * 0.08, ry + h * 0.16], [rx - w * 0.08, ry + h * 0.16], [rx - w * 0.08, ry - h * 0.05]]), tone(L, P.cream));
  fill(ctx, polyP([[rx - w * 0.08, ry + h * 0.06], [rx - w * 0.17, ry + h * 0.2], [rx - w * 0.08, ry + h * 0.16]]), tone(L, P.ink));
  fill(ctx, polyP([[rx + w * 0.08, ry + h * 0.06], [rx + w * 0.17, ry + h * 0.2], [rx + w * 0.08, ry + h * 0.16]]), tone(L, P.ink));
  fill(ctx, circP(rx, ry, w * 0.035), tone(L, P.blue));
  fill(ctx, polyP([[rx - w * 0.05, ry + h * 0.16], [rx, ry + h * 0.3], [rx + w * 0.05, ry + h * 0.16]]), tone(L, P.lemon));
  ctx.restore();
  ctx.save();
  text(ctx, 'SHIP IT', x + w / 2, y + h * 0.9, tone(L, P.ink), w * 0.2, { align: 'center', fam: 'display', weight: 800, italic: true });
  ctx.restore();
}

// Window with night city (or day). open: 0..1 swings the right pane outward.
export function windowView(ctx, L, x, y, w, h, o = {}) {
  const { sky = P.navyDeep, moon = P.cream, moonR = w * 0.22, moonX = x + w * 0.62, moonY = y + h * 0.36, day = 0, t = 0, city = true, stars = true, cityH = 0.42 } = o;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  if (stars && day < 0.5) {
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      const sx = x + r() * w, sy = y + r() * h * 0.6, tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
      sparkle(ctx, sx, sy, (0.25 + r() * 0.5) * (0.6 + tw * 0.4), P.cream);
    }
  }
  if (moon) {
    glow(ctx, moonX, moonY, moonR * 2.4, moon, 0.35);
    fill(ctx, circP(moonX, moonY, moonR), moon);
    if (!day) { // flat craters
      ctx.fillStyle = rgba('#d9d5c3', 0.9);
      [[0.3, -0.2, 0.16], [-0.35, 0.25, 0.12], [0.1, 0.45, 0.09], [-0.1, -0.5, 0.07]].forEach(([a, b, s]) => {
        ctx.beginPath(); ctx.arc(moonX + a * moonR, moonY + b * moonR, s * moonR, 0, TAU); ctx.fill();
      });
    }
  }
  if (city) skyline(ctx, x, y + h, w, h * cityH, day, t);
  ctx.restore();
}

export function skyline(ctx, x, yb, w, hmax, day = 0, t = 0) {
  const r = rng(1234);
  // far row
  let cx = x - 2;
  ctx.fillStyle = day ? '#8f94d6' : '#1b2a9a';
  while (cx < x + w) {
    const bw = 3 + r() * 6, bh = hmax * (0.35 + r() * 0.45);
    ctx.fillRect(cx, yb - bh, bw + 0.2, bh);
    cx += bw;
  }
  cx = x - 1;
  const r2 = rng(99);
  while (cx < x + w) {
    const bw = 4 + r2() * 9, bh = hmax * (0.2 + r2() * 0.6);
    ctx.fillStyle = day ? '#5b5fb0' : P.ink;
    ctx.fillRect(cx, yb - bh, bw + 0.2, bh);
    if (r2() < 0.3) { ctx.fillRect(cx + bw * 0.4, yb - bh - 2.5, 0.4, 2.5); }
    // windows
    if (!day) {
      for (let wy = yb - bh + 1.2; wy < yb - 1; wy += 1.6) for (let wx = cx + 0.8; wx < cx + bw - 0.8; wx += 1.3) {
        const on = hash2(Math.floor(wx * 10), Math.floor(wy * 10)) < 0.28;
        if (on) { ctx.fillStyle = hash2(Math.floor(wy * 7), Math.floor(wx * 3)) < 0.8 ? P.lemon : P.pink; ctx.fillRect(wx, wy, 0.55, 0.7); }
      }
      ctx.fillStyle = P.ink;
    }
    cx += bw + r2() * 1.5;
  }
}

export function windowFrame(ctx, L, x, y, w, h, open = 0) {
  const fr = 2.2;
  const col = tone(L, '#e9e4d2');
  const l = lit(L, x + w / 2, y + h / 2, 0.35);
  const frame = new Path2D();
  frame.rect(x - fr, y - fr, w + fr * 2, h + fr * 2);
  frame.rect(x + w, y, -w, h); // hole (opposite winding)
  solid(ctx, frame, col, { sh: [tone(L, '#a9a3c4'), l.sh[1], l.sh[2]] });
  // mullions
  if (open < 1) {
    const pw = w / 2;
    ctx.save();
    // right pane swings outward (foreshortens)
    const sx = 1 - open;
    const mull = (px, pw2) => {
      const p = new Path2D();
      p.rect(px, y, pw2, h);
      p.rect(px + pw2 - 1.1, y + 1.1, -(pw2 - 2.2), h - 2.2);
      return p;
    };
    fill(ctx, mull(x, pw), col);
    if (sx > 0.02) {
      const p2 = new Path2D();
      p2.addPath(mull(0, pw), new DOMMatrix().translate(x + w, 0).scale(-sx, 1));
      fill(ctx, p2, col);
      fill(ctx, rectP(x + w - pw * sx, y + h / 2 - 0.5, pw * sx, 1), col);
    }
    fill(ctx, rectP(x, y + h / 2 - 0.5, pw, 1), col);
    // glass glare
    ctx.globalAlpha = 0.08;
    fill(ctx, polyP([[x + 2, y + h], [x + 8, y + h], [x + pw - 1, y + 10], [x + pw - 1, y + 4]]), P.cream);
    ctx.restore();
  }
  // sill
  solid(ctx, rectP(x - fr * 2, y + h + fr - 0.2, w + fr * 4, 2.2), col, { sh: [tone(L, '#8f88b5'), 0, 0.9], rim: [L.rim, 0, -0.35] });
}

// ---------- desk ----------
export function desk(ctx, L, x0, x1, depth = 6) {
  // top surface seen at a grazing angle
  fill(ctx, rectP(x0, -depth, x1 - x0, depth), L.deskTop);
  fill(ctx, rectP(x0, -0.35, x1 - x0, 0.35), mix(L.deskTop, L.deskEdge, 0.5));
  // front face
  fill(ctx, rectP(x0, 0, x1 - x0, 8), L.deskFront);
  fill(ctx, rectP(x0, 0, x1 - x0, 0.45), L.deskEdge);
  if (x1 < 399) {
    // open space under the desk: the wall in deep shadow, a drawer pedestal
    fill(ctx, rectP(x0, 8, x1 - x0, 66.2), rgba(P.ink, 0.62));
    fill(ctx, rectP(x1 - 0.45, -depth, 0.45, depth + 8), L.deskEdge);
    const px = x1 - 46;
    fill(ctx, rectP(px, 8, 30, 66.2), L.deskFront);
    for (let i = 0; i < 3; i++) {
      fill(ctx, rectP(px + 2, 12 + i * 20.5, 26, 18), mix(L.deskFront, P.navy, 0.3));
      fill(ctx, rrP(px + 11, 19 + i * 20.5, 8, 1.6, 0.8), mix(L.deskFront, L.deskEdge, 0.5));
    }
    fill(ctx, rectP(px + 29.6, 8, 0.4, 66.2), mix(L.deskFront, L.deskEdge, 0.4));
  } else fill(ctx, rectP(x0, 8, x1 - x0, 120), mix(L.deskFront, P.ink, 0.6));
}

// ---------- phone (lying flat, seen edge-on) ----------
export function phone(ctx, L, x, y, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  solid(ctx, rrP(-7.5, -1, 15, 1, 0.45), tone(L, P.ink2), { rim: [L.rim, 0, -0.2] });
  fill(ctx, rectP(-6.8, -1.05, 13.6, 0.18), tone(L, P.blue));
  fill(ctx, rrP(7.2, -0.75, 1.2, 0.5, 0.2), tone(L, P.cream));
  ctx.restore();
}

// ---------- monitor ----------
// screen(ctx, w, h) draws the screen content in screen-local px space (1600x900 virtual)
export const SCREEN_W = 1600, SCREEN_H = 900;
export function monitor(ctx, L, x, y, w, screenFn, o = {}) {
  const h = w * 9 / 16;
  const bez = w * 0.022;
  const top = y - h - 11;
  const l = lit(L, x, top, 0.4);
  // stand
  solid(ctx, rrP(x - w * 0.05, top + h - 1, w * 0.1, 12, 0.6), tone(L, P.ink3), { rim: [L.rim, 0, -0.2], sh: [P.ink, w * 0.02, 0] });
  solid(ctx, polyP([[x - w * 0.16, 0], [x + w * 0.16, 0], [x + w * 0.12, -1.6], [x - w * 0.12, -1.6]]), tone(L, P.ink3), { rim: [L.rim, 0, -0.3] });
  // body
  const body = rrP(x - w / 2, top, w, h, 1.1);
  solid(ctx, body, tone(L, P.ink2), { rim: [o.rimCol || L.rim, l.rim[1], l.rim[2] - 0.15] });
  // chin logo
  fill(ctx, rrP(x - 1.5, top + h - bez * 0.62, 3, 0.35, 0.2), tone(L, P.ink3));
  // screen
  const sx = x - w / 2 + bez, sy = top + bez, sw = w - bez * 2, sh = h - bez * 2.4;
  ctx.save();
  ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
  ctx.translate(sx, sy);
  ctx.scale(sw / SCREEN_W, sh / SCREEN_H);
  screenFn ? screenFn(ctx, SCREEN_W, SCREEN_H) : (ctx.fillStyle = P.term, ctx.fillRect(0, 0, SCREEN_W, SCREEN_H));
  ctx.restore();
  if (o.glare !== false) {
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    ctx.globalAlpha = 0.05;
    fill(ctx, polyP([[sx + sw * 0.55, sy], [sx + sw * 0.75, sy], [sx + sw * 0.45, sy + sh], [sx + sw * 0.25, sy + sh]]), P.cream);
    ctx.globalAlpha = 0.03;
    fill(ctx, polyP([[sx + sw * 0.8, sy], [sx + sw * 0.84, sy], [sx + sw * 0.54, sy + sh], [sx + sw * 0.5, sy + sh]]), P.cream);
    ctx.restore();
  }
  return { sx, sy, sw, sh, top, h };
}

// ---------- keyboard ----------
// Low-angle elevation: a slab with stepped rows of keycaps. press: {row, col, amt}
export function keyboard(ctx, L, x, w, o = {}) {
  const rows = 5, cols = 15;
  const kw = w / cols;
  const l = lit(L, x, -3, 0.25);
  const base = tone(L, '#2b2850');
  solid(ctx, rrP(x - w / 2 - 0.8, -2.6, w + 1.6, 2.6, 0.5), base, { rim: [L.rim, 0, -0.2] });
  for (let r = rows - 1; r >= 0; r--) {
    const yr = -2.2 - r * 0.62;
    for (let c = 0; c < cols; c++) {
      const kx = x - w / 2 + c * kw + 0.12;
      const accent = (r === 1 && c === cols - 1) ? 'enter' : (r === 4 && c === 0) ? 'esc' : (r === 0 && c >= 4 && c <= 10) ? 'space' : null;
      if (accent === 'space' && c !== 4) continue;
      let ww = accent === 'space' ? kw * 7 - 0.24 : kw - 0.24;
      let col = accent === 'enter' ? P.red : accent === 'esc' ? P.lemon : '#e8e4d6';
      const pressed = o.press && o.press.row === r && o.press.col === c ? o.press.amt : 0;
      const kp = rrP(kx, yr - 1.05 + pressed * 0.5, ww, 1.05, 0.25);
      const kl = lit(L, kx, yr, 0.2);
      solid(ctx, kp, tone(L, col), { sh: [tone(L, mix(col, P.navy, 0.45)), 0, 0.35], rim: [L.rim, kl.rim[1] * 0.6, -0.16] });
    }
  }
}

// ---------- desk lamp ----------
// Articulated arm lamp. a1: lower arm angle from vertical (rad), a2: upper arm relative, a3: head pitch.
// Returns {head:[x,y], dir: angle of light}.
export function lamp(ctx, L, x, o = {}) {
  const { a1 = -0.35, a2 = 1.6, a3 = 0.5, on = 1, len1 = 26, len2 = 24, color = P.red, beam = true, dir = null } = o;
  const l = lit(L, x, -20, 0.35);
  // base
  solid(ctx, polyP([[x - 7, 0], [x + 7, 0], [x + 5.5, -2.4], [x - 5.5, -2.4]]), tone(L, P.ink3), { rim: [L.rim, 0, -0.25] });
  solid(ctx, rrP(x - 2, -4.2, 4, 2.2, 0.6), tone(L, color), { sh: [tone(L, P.redDk), 0.8, 0] });
  const j0 = [x, -3.6];
  const j1 = [j0[0] + Math.sin(a1) * len1, j0[1] - Math.cos(a1) * len1];
  const ang2 = a1 + a2;
  const j2 = [j1[0] + Math.sin(ang2) * len2, j1[1] - Math.cos(ang2) * len2];
  const rod = (p, q, wdt, c) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy), nx = -dy / d * wdt, ny = dx / d * wdt;
    return polyP([[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]);
  };
  // twin rods + spring
  for (const off of [-0.55, 0.55]) {
    solid(ctx, rod([j0[0] + off, j0[1]], [j1[0] + off, j1[1]], 0.28), tone(L, P.ink3), { rim: [L.rim, l.rim[1] * 0.5, l.rim[2] * 0.5] });
    solid(ctx, rod([j1[0] + off, j1[1]], [j2[0] + off, j2[1]], 0.28), tone(L, P.ink3), { rim: [L.rim, l.rim[1] * 0.5, l.rim[2] * 0.5] });
  }
  // spring coil along lower arm
  ctx.strokeStyle = tone(L, '#9aa0d8'); ctx.lineWidth = 0.18;
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const t = 0.25 + i / 14 * 0.5;
    const px = lerp(j0[0], j1[0], t), py = lerp(j0[1], j1[1], t);
    const nx = Math.cos(a1) * (i % 2 ? 0.9 : -0.9), ny = Math.sin(a1) * (i % 2 ? 0.9 : -0.9);
    i ? ctx.lineTo(px + nx, py + ny) : ctx.moveTo(px + nx, py + ny);
  }
  ctx.stroke();
  for (const j of [j0, j1]) solid(ctx, circP(j[0], j[1], 1.1), tone(L, color), { sh: [tone(L, P.redDk), 0.4, 0.4] });
  // head: cone shade
  const hd = dir ?? ang2 + a3 + Math.PI / 2; // direction the shade points (light dir)
  ctx.save();
  ctx.translate(j2[0], j2[1]);
  ctx.rotate(hd - Math.PI / 2);
  const shade = polyP([[-2.2, -1], [2.2, -1], [6.2, 8.5], [-6.2, 8.5]]);
  const inner = ellP(0, 8.5, 6.2, 1.5);
  solid(ctx, shade, tone(L, color), { sh: [tone(L, P.redDk), 1.4, 0], rim: [mix(L.rim, P.cream, 0.3), -0.45, -0.2] });
  fill(ctx, inner, on > 0 ? mix('#d7cfa0', P.cream, on) : tone(L, '#3a2040'));
  if (on > 0) fill(ctx, ellP(0, 8.8, 2.6 * on, 1.0 * on), P.lemon);
  solid(ctx, circP(0, -1.2, 1.5), tone(L, color), { sh: [tone(L, P.redDk), 0.5, 0.4] });
  ctx.restore();
  const head = [j2[0] + Math.cos(hd) * 8.5, j2[1] + Math.sin(hd) * 8.5];
  return { head, dir: hd, j0, j1, j2 };
}
export function lampBeam(ctx, lp, on, len = 120, spread = 0.42, color = P.lemon, a = 0.32) {
  if (on <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const [x, y] = lp.head, d = lp.dir;
  const p = new Path2D();
  p.moveTo(x + Math.cos(d + Math.PI / 2) * 5.5, y + Math.sin(d + Math.PI / 2) * 5.5);
  p.lineTo(x + Math.cos(d - Math.PI / 2) * 5.5, y + Math.sin(d - Math.PI / 2) * 5.5);
  p.lineTo(x + Math.cos(d - spread) * len, y + Math.sin(d - spread) * len);
  p.lineTo(x + Math.cos(d + spread) * len, y + Math.sin(d + spread) * len);
  p.closePath();
  const g = ctx.createRadialGradient(x, y, 0, x, y, len);
  g.addColorStop(0, rgba(color, a * on));
  g.addColorStop(0.6, rgba(color, a * 0.5 * on));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
}

// ---------- rubber duck ----------
export function duck(ctx, L, x, y, s = 9, o = {}) {
  const { tilt = 0, look = 1, squeak = 0, blink = 0, colorless = 0 } = o;
  const k = s / 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(k * look, k * (1 - squeak * 0.12));
  const body = blobP([[-5.2, -1.2], [-4.6, -4.8], [-1, -5.2], [3, -4.4], [5, -2.2], [4.4, 0], [-3.8, 0]]);
  const tail = polyP([[-4.6, -3.2], [-6.6, -6.4], [-3.2, -4.6]]);
  const head = circP(1.6, -7.6, 3.1 * (1 + squeak * 0.04));
  const shape = union(body, tail, head);
  const lm = lit(L, x, y - 5, 0.55);
  const base = tone(L, P.lemon);
  solid(ctx, shape, base, { sh: [tone(L, P.gold), lm.sh[1] * look, lm.sh[2]], rim: [L.rim, lm.rim[1] * look, lm.rim[2]] }, true);
  // wing
  fill(ctx, blobP([[-2.8, -3.2], [0.8, -4.2], [2.2, -2.4], [-1.4, -1.6]]), tone(L, P.gold));
  // beak
  const beakOpen = squeak * 0.9;
  fill(ctx, polyP([[4.1, -7.6], [7.4, -7.0 - beakOpen * 0.3], [6.6, -6.4], [4.2, -6.4]]), tone(L, P.red));
  fill(ctx, polyP([[4.2, -6.5], [6.8, -6.3 + beakOpen * 0.6], [4.4, -5.6 + beakOpen * 0.3]]), tone(L, P.redDk));
  // eye
  const eh = 1.15 * (1 - blink);
  fill(ctx, ellP(2.6, -8.4, 0.62, Math.max(0.08, eh * 0.62)), tone(L, P.ink));
  if (eh > 0.4) fill(ctx, circP(2.45, -8.65, 0.2), P.cream);
  ctx.restore();
}

// ---------- mug ----------
export function mug(ctx, L, x, y, o = {}) {
  const { s = 1, steam = 0, t = 0, tilt = 0, label = true } = o;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  const l = lit(L, x, y - 5, 0.5);
  const handle = new Path2D();
  handle.roundRect(3.2, -7.8, 3.4, 5.4, 1.6);
  handle.roundRect(4.2, -6.8, 1.4, 3.4, 0.7);
  solid(ctx, handle, tone(L, P.cream), { sh: [tone(L, '#b8b4c9'), 0.6, 0] }, true);
  const body = rrP(-4.4, -10, 8.8, 10, [0.4, 0.4, 1.6, 1.6]);
  solid(ctx, body, tone(L, P.cream), { sh: [tone(L, '#b8b4c9'), l.sh[1], 0], rim: [L.rim, l.rim[1], l.rim[2]] });
  fill(ctx, rectP(-4.4, -7.6, 8.8, 1.3), tone(L, P.red));
  if (label) {
    ctx.save();
    text(ctx, '</>', 0, -3.3, tone(L, P.navy), 2.6, { align: 'center', fam: 'mono', weight: 700 });
    ctx.restore();
  }
  fill(ctx, ellP(0, -10, 4.4, 0.6), tone(L, '#2a1a12'));
  ctx.restore();
  if (steam > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 * steam;
    ctx.strokeStyle = P.cream; ctx.lineWidth = 0.45; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) {
        const yy = y - 11 - j * 0.9;
        const xx = x - 1.6 + i * 1.6 + Math.sin(j * 0.7 + t * 4 + i * 2) * 0.6;
        j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- sticky note ----------
export function sticky(ctx, L, x, y, w, rot, color, lines = 3, label = null) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  solid(ctx, polyP([[0, 0], [w, 0], [w, w * 0.92], [w * 0.85, w], [0, w]]), tone(L, color), { sh: [tone(L, mix(color, P.ink, 0.25)), 0.3, 0.3] });
  if (label) text(ctx, label, w * 0.1, w * 0.36, tone(L, P.ink), w * 0.2, { fam: 'cond', weight: 700 });
  else for (let i = 0; i < lines; i++) fill(ctx, rectP(w * 0.12, w * (0.25 + i * 0.2), w * (0.5 + hash(i * 7 + w * 13) * 0.3), w * 0.05), tone(L, mix(color, P.ink, 0.5)));
  ctx.restore();
}
