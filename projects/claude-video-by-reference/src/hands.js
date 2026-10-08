// The viewer's hands and phone, in the reference's close-up "hands with devices" idiom:
// flat skin with one shadow tone, sleeve + cuff, no outlines.
import { P, mix, rgba } from './palette.js';
import { TAU, clamp } from './core.js';
import { sprayAt } from './tex.js';

// the 16:9 video area inside a (wider) phone screen — videos play pillarboxed, never stretched
export function videoRect(sx, sy, sw, sh) { const w = Math.min(sw, sh * 16 / 9), h = w * 9 / 16; return { x: sx + (sw - w) / 2, y: sy + (sh - h) / 2, w, h }; }

// Landscape phone centred at (cx,cy), size w x h, rotation rot. drawScreen(ctx, x, y, w, h) paints the screen.
export function phone(ctx, cx, cy, w, h, rot = 0, drawScreen = null, o = {}) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const r = h * 0.14;
  // soft drop shadow
  ctx.fillStyle = rgba(o.shadowCol || P.navy, 0.16);
  ctx.beginPath(); ctx.roundRect(-w / 2 + 14, -h / 2 + 22, w, h, r); ctx.fill();
  ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r); ctx.fill();
  // side buttons
  ctx.fillStyle = P.navyDk;
  ctx.fillRect(-w * 0.18, -h / 2 - 5, w * 0.12, 6); ctx.fillRect(w * 0.0, -h / 2 - 5, w * 0.07, 6);
  // highlight edge
  ctx.strokeStyle = P.navyLt; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 3); ctx.stroke();
  const bz = h * 0.06, sx = -w / 2 + bz * 1.6, sy = -h / 2 + bz, sw = w - bz * 3.2, sh = h - bz * 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, r * 0.55); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, sw, sh);
  if (drawScreen) drawScreen(ctx, sx, sy, sw, sh);
  ctx.restore();
  // camera dot
  ctx.fillStyle = P.navyDk; ctx.beginPath(); ctx.arc(-w / 2 + bz * 0.8, 0, bz * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
  return { sx, sy, sw, sh };
}

// One hand holding a landscape phone's side. side = -1 (left edge) or 1 (right edge).
// part = 'back' (forearm, palm and the fingers curling round the edge — drawn before the phone)
// or 'front' (thumb on the glass). Authored for the right edge in phone-local space.
export function holdHand(ctx, cx, cy, w, h, rot, side, part, o = {}) {
  const skin = o.skin || P.skin, dk = o.skinDk || P.skinDk, lt = o.skinLt || P.skinLt;
  const W2 = w / 2, H2 = h / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.scale(side, 1);
  const cap = (x, y, len, th, ang, col) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(0, -th / 2, len, th, th / 2); ctx.fill(); ctx.restore(); };
  if (part === 'back') {
    // forearm + sleeve heading down and out of frame
    const wx = W2 + h * 0.02, wy = H2 + h * 0.22, ang = 1.08, L = h * 2.2;
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(ang);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(0, -h * 0.15); ctx.lineTo(L, -h * 0.23); ctx.lineTo(L, h * 0.23); ctx.lineTo(0, h * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(0, h * 0.06); ctx.lineTo(L, h * 0.1); ctx.lineTo(L, h * 0.23); ctx.lineTo(0, h * 0.15); ctx.closePath(); ctx.fill();
    // sleeve with cuff
    ctx.fillStyle = o.sleeve || P.sleeve; ctx.beginPath(); ctx.moveTo(h * 0.42, -h * 0.25); ctx.lineTo(L, -h * 0.33); ctx.lineTo(L, h * 0.33); ctx.lineTo(h * 0.42, h * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.sleeveDk || P.sleeveDk; ctx.beginPath(); ctx.moveTo(h * 0.42, h * 0.08); ctx.lineTo(L, h * 0.12); ctx.lineTo(L, h * 0.33); ctx.lineTo(h * 0.42, h * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(h * 0.36, -h * 0.26, h * 0.12, h * 0.52, h * 0.03); ctx.fill();
    ctx.restore();
    // palm cupping the bottom corner from behind
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(W2 - h * 0.04, H2 + h * 0.02, h * 0.2, h * 0.27, -0.5, 0, TAU); ctx.fill();
    // fingers curling round the side edge (only the tips beyond the edge show)
    const fy = [-0.27, -0.09, 0.09], fl = [0.1, 0.12, 0.1];
    fy.forEach((y, i) => {
      cap(W2 - h * 0.14, y * h, h * fl[i] + h * 0.14, h * 0.13, 0.12 + i * 0.05, skin);
      ctx.fillStyle = rgba(P.skinDk, 0.8); ctx.beginPath(); ctx.ellipse(W2 + h * (fl[i] - 0.02), y * h + h * 0.035 + (fl[i] * h) * (0.12 + i * 0.05), h * 0.045, h * 0.022, 0.1, 0, TAU); ctx.fill();
    });
  } else {
    // thumb resting on the glass near the bottom corner
    const tap = o.tap || 0;
    const bx = W2 + h * 0.04, by = H2 - h * 0.02, ang = Math.PI + 0.62 + tap * 0.18, len = h * (0.36 + tap * 0.05);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(bx + h * 0.05, by + h * 0.04, h * 0.12, h * 0.1, 0.4, 0, TAU); ctx.fill();
    cap(bx, by, len, h * 0.135, ang, skin);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    ctx.fillStyle = lt; ctx.beginPath(); ctx.roundRect(len - h * 0.11, -h * 0.045, h * 0.085, h * 0.075, h * 0.03); ctx.fill();
    ctx.fillStyle = dk; ctx.beginPath(); ctx.roundRect(h * 0.02, h * 0.025, len - h * 0.06, h * 0.035, h * 0.017); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Hearts that float up from a point (analytic particles). Returns nothing; draws.
export function heart(ctx, x, y, s, col, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 20, s / 20);
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -10, -13, 0, -5); ctx.bezierCurveTo(10, -13, 14, -1, 0, 9);
  ctx.fill(); ctx.restore();
}
