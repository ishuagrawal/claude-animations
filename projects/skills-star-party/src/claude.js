// Claude, built exactly from refs/claude-mascot.png (measured): an 8×6 body of square cells, 2×2 arms on
// rows 2–3, four 1×2 legs at columns 0, 2, 5, 7, and 1×1 black eyes at (1,1) and (6,1); colour #DA7758.
// Drawn flat like the official art (to match the flat official Octocat), with the same light polish:
// a soft top-down grade, a broad sheen, a crisp lit top edge and a darker base edge, eye catchlights,
// and a soft contact shadow. Origin at the feet (bottom centre); s = px per cell.
import { TAU } from './core.js';

const CLAY = '#da7758';
const R = 0.07; // corner rounding (cells): crisp pixels, no hard aliasing

function grade(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#e3866a'); g.addColorStop(0.5, CLAY); g.addColorStop(1, '#cb6648');
  return g;
}
function block(ctx, x, y, w, h, y0 = 0, y1 = 8) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, R);
  ctx.fillStyle = grade(ctx, y0, y1); ctx.fill();
}
function arm(ctx, side, ang) {
  // 2×2 block hinged at the shoulder corner (body edge, top of row 2); + ang lifts it
  ctx.save();
  ctx.translate(side < 0 ? 0 : 8, 2); ctx.rotate(side < 0 ? ang : -ang);
  const x0 = side < 0 ? -2.02 : 0.02;
  block(ctx, x0, 0, 2, 2, -1, 3);
  ctx.strokeStyle = 'rgba(255,236,224,0.55)'; ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.moveTo(x0 + 0.08, 0.05); ctx.lineTo(x0 + 1.92, 0.05); ctx.stroke();
  ctx.restore();
}
function eye(ctx, c, r, open, happy, look) {
  const x = c + look[0] * 0.12, y = r + look[1] * 0.1;
  if (happy > 0.5) { // ^ in three pixels
    ctx.fillStyle = '#141414';
    for (const [px, py] of [[0, 2], [1, 1], [2, 2]]) ctx.fillRect(x + px / 3, y + py / 3 - 0.1, 1 / 3 + 0.01, 1 / 3 + 0.01);
    return;
  }
  const h = Math.max(0.1, open);
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.roundRect(x, y + (1 - h) / 2, 1, h, 0.05); ctx.fill();
  if (h > 0.7) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(x + 0.14, y + 0.14, 0.24, 0.24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 0.64, y + 0.62, 0.12, 0.12);
  }
}

// o: { squash (+squash/−stretch), lift (px), armL, armR (rad, + = up), blink 0..1, happy, look [x,y], tilt,
//      shadow 0..1, shadowY (px below the feet where the shadow lands, for perching) }
export function claude(ctx, x, y, s, o = {}) {
  const { squash = 0, lift = 0, armL = 0, armR = 0, blink = 0, happy = 0, look = [0, 0], tilt = 0, shadow = 1, a = 1 } = o;
  ctx.save();
  ctx.globalAlpha *= a;
  if (shadow > 0) { // contact shadow stays on the surface while hopping
    const k = Math.max(0.3, 1 - lift / (s * 10));
    ctx.save(); ctx.translate(x, y + s * 0.06); ctx.scale(1, 0.18);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 5.4 * k);
    g.addColorStop(0, `rgba(60,70,110,${0.3 * shadow * k})`); g.addColorStop(1, 'rgba(60,70,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 5.4 * k, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.translate(x, y - lift);
  ctx.rotate(tilt);
  ctx.scale(s * (1 + squash * 0.14), s * (1 - squash * 0.14));
  ctx.translate(-4, -8); // grid origin: body top-left; feet at row 8
  arm(ctx, -1, armL);
  arm(ctx, 1, armR);
  // legs (outer ones splay a touch on landings)
  for (const c of [0, 2, 5, 7]) {
    const dx = c === 0 ? -squash * 0.1 : c === 7 ? squash * 0.1 : 0;
    block(ctx, c + dx, 5.9, 1, 2.1, 0, 8);
    const lg = ctx.createLinearGradient(0, 6, 0, 8); lg.addColorStop(0, 'rgba(120,40,20,0.22)'); lg.addColorStop(0.35, 'rgba(120,40,20,0)'); lg.addColorStop(1, 'rgba(120,40,20,0.12)');
    ctx.fillStyle = lg; ctx.fillRect(c + dx, 6, 1, 2);
  }
  // body
  block(ctx, 0, 0, 8, 6, 0, 6);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, 8, 6, R); ctx.clip();
  const sh = ctx.createRadialGradient(2.2, 1.0, 0.2, 2.2, 1.0, 5.2);
  sh.addColorStop(0, 'rgba(255,240,230,0.20)'); sh.addColorStop(1, 'rgba(255,240,230,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, 8, 6);
  const base = ctx.createLinearGradient(0, 5.3, 0, 6); base.addColorStop(0, 'rgba(110,35,15,0)'); base.addColorStop(1, 'rgba(110,35,15,0.22)');
  ctx.fillStyle = base; ctx.fillRect(0, 5.3, 8, 0.7);
  ctx.strokeStyle = 'rgba(255,236,224,0.7)'; ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.moveTo(0.1, 0.04); ctx.lineTo(7.9, 0.04); ctx.stroke();
  ctx.restore();
  eye(ctx, 1, 1, 1 - blink, happy, look);
  eye(ctx, 6, 1, 1 - blink, happy, look);
  ctx.restore();
}
