// Claude, built exactly from refs/claude-mascot.png: an 8×6 body of square cells + 2×2 arms on rows 2–3,
// four 1×2 legs (columns 0, 2, 5, 7) and 1×1 black eyes at (1,1) and (6,1), colour #DA7758. Drawn flat
// like the reference (to sit beside the flat official Octocat) with a thin extruded edge, a soft
// gradient, bevel light, eye catchlights and contact shadows. Origin at the feet (bottom centre).
import { TAU } from './core.js';

const CLAY = '#da7758', TOP = '#ef9f80', SIDE = '#b2593c', SIDE2 = '#9a4a31';
const D = [0.22, -0.16]; // extrusion (cells) toward the upper right

function slab(ctx, x, y, w, h, light = 1) {
  // extruded sides (top + right), then the front face
  ctx.fillStyle = TOP;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + D[0], y + D[1]); ctx.lineTo(x + w + D[0], y + D[1]); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  const sg = ctx.createLinearGradient(x + w, y, x + w, y + h);
  sg.addColorStop(0, SIDE); sg.addColorStop(1, SIDE2);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + D[0], y + D[1]); ctx.lineTo(x + w + D[0], y + h + D[1]); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, '#e58767'); g.addColorStop(0.5, CLAY); g.addColorStop(1, '#cf6b4c');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha *= light;
  ctx.strokeStyle = 'rgba(255,235,222,0.6)'; ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.moveTo(x + 0.03, y + h - 0.05); ctx.lineTo(x + 0.03, y + 0.03); ctx.lineTo(x + w - 0.05, y + 0.03); ctx.stroke();
  ctx.globalAlpha /= light;
}

function arm(ctx, side, ang) {
  // 2×2 block hinged at the shoulder (body edge, row 2 top)
  ctx.save();
  ctx.translate(side < 0 ? 0 : 8, 2); ctx.rotate(ang);
  slab(ctx, side < 0 ? -2 : 0, 0, 2, 2);
  ctx.restore();
}

function eye(ctx, c, r, open, happy, look) {
  const x = c + look[0] * 0.12, y = r + look[1] * 0.1;
  if (happy > 0.5) { // ^ eyes in three pixels
    ctx.fillStyle = '#111';
    for (const [px, py] of [[0, 2], [1, 1], [2, 2]]) ctx.fillRect(x + px / 3, y + py / 3 - 0.08, 1 / 3 + 0.01, 1 / 3 + 0.01);
    return;
  }
  const h = Math.max(0.12, open);
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y + (1 - h) / 2, 1, h);
  if (h > 0.7) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(x + 0.16, y + 0.16, 0.24, 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 0.62, y + 0.6, 0.14, 0.14);
  }
}

// s = px per cell. o: { squash (−stretch … +squash), armL, armR (rad, + = up), blink 0..1, happy, look [x,y], tilt }
export function claude(ctx, x, y, s, o = {}) {
  const { squash = 0, armL = 0, armR = 0, blink = 0, happy = 0, look = [0, 0], tilt = 0, shadow = 1, lift = 0 } = o;
  // contact shadow on the ground (stays on the ground while jumping)
  if (shadow > 0) {
    const k = Math.max(0.35, 1 - lift / (s * 9));
    ctx.save(); ctx.translate(x, y + s * 0.08); ctx.scale(1, 0.16);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 5.2 * k);
    g.addColorStop(0, `rgba(60,80,120,${0.32 * shadow * k})`); g.addColorStop(1, 'rgba(60,80,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 5.2 * k, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.rotate(tilt);
  ctx.scale(s * (1 + squash * 0.14), s * (1 - squash * 0.14));
  ctx.translate(-4, -8); // grid origin: body top-left; feet at row 8
  ctx.lineJoin = 'round';
  // legs: outer legs splay a touch when landing
  for (const c of [7, 5, 2, 0]) slab(ctx, c + (c === 0 ? -squash * 0.1 : c === 7 ? squash * 0.1 : 0), 6, 1, 2);
  // arms (behind the body's side faces)
  arm(ctx, -1, armL);   // canvas rotation is clockwise: + lifts the left arm, − lifts the right
  arm(ctx, 1, -armR);
  slab(ctx, 0, 0, 8, 6);
  // ambient occlusion under the body where the legs join, a soft sheen on top
  const ao = ctx.createLinearGradient(0, 6, 0, 6.5);
  ao.addColorStop(0, 'rgba(90,30,15,0.35)'); ao.addColorStop(1, 'rgba(90,30,15,0)');
  ctx.fillStyle = ao; for (const c of [0, 2, 5, 7]) ctx.fillRect(c, 6, 1, 0.5);
  const sh = ctx.createRadialGradient(2, 0.8, 0, 2, 0.8, 4);
  sh.addColorStop(0, 'rgba(255,240,230,0.22)'); sh.addColorStop(1, 'rgba(255,240,230,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, 8, 6);
  eye(ctx, 1, 1, 1 - blink, happy, look);
  eye(ctx, 6, 1, 1 - blink, happy, look);
  ctx.restore();
}
