// The stage: a near-black backdrop lit by huge, heavily blurred colour fields (the reference's
// wine glow, recoloured to GitHub's purple / magenta / blue), drifting slowly, with event tints
// (gold when the star lands, green while the stargazer grid lights). Plus the floating window.
import { W, H, TAU, clamp, lerp } from './core.js';
import { rgba, mix } from './palette.js';
import { shadow, noShadow } from './ui.js';

const FIELDS = [
  // x, y, radius, colour, alpha, drift speed, phase
  [180, 900, 980, '#6e40c9', 0.62, 0.11, 0.0],
  [1760, 960, 900, '#bf3989', 0.50, 0.09, 1.7],
  [1700, 90, 820, '#1f6feb', 0.40, 0.13, 3.1],
  [120, 60, 760, '#3b2a8f', 0.50, 0.10, 4.4],
  [960, 1180, 700, '#8957e5', 0.35, 0.07, 2.2],
];

export function stage(ctx, t, cam, { gold = 0, green = 0 } = {}) {
  ctx.fillStyle = '#06070b'; ctx.fillRect(-10, -10, W + 20, H + 20);
  // parallax: the stage sits far behind the window, so it moves/zooms a fraction of the camera
  const z = 1 + (cam.z - 1) * 0.25, ox = -(cam.x - W / 2) * 0.12 * cam.z, oy = -(cam.y - H / 2) * 0.12 * cam.z;
  ctx.save();
  ctx.translate(W / 2 + ox, H / 2 + oy); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  for (const [x, y, r, c, a, sp, ph] of FIELDS) {
    const px = x + Math.sin(t * sp * TAU * 0.5 + ph) * 90, py = y + Math.cos(t * sp * TAU * 0.4 + ph) * 60;
    let col = c;
    if (gold > 0) col = mix(col, '#e3b341', gold * 0.55);
    if (green > 0) col = mix(col, '#2ea043', green * 0.45);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.45)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
  // soft top-down sheen so the stage has a light direction
  const s = ctx.createLinearGradient(0, 0, 0, H);
  s.addColorStop(0, 'rgba(255,255,255,0.025)'); s.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
}

// The window. icon = 1 draws it as the GitHub app icon (squircle, raised gradient), 0 as the page panel.
export function windowBack(ctx, R, icon = 0) {
  const { x, y, w, h, r } = R;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  shadow(ctx, 90, 46, 'rgba(0,0,0,0.6)'); ctx.fillStyle = '#0d1117'; ctx.fill();
  shadow(ctx, 14, 4, 'rgba(0,0,0,0.5)'); ctx.fill();
  noShadow(ctx);
  if (icon > 0.001) {
    ctx.globalAlpha = icon;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#3a414b'); g.addColorStop(0.5, '#23282f'); g.addColorStop(1, '#0d1117');
    ctx.fillStyle = g; ctx.fill();
    const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.16)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h * 0.5, [Math.max(0, r - 5), Math.max(0, r - 5), 0, 0]);
    ctx.fillStyle = hl; ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
export function windowFront(ctx, R, icon = 0) {
  const { x, y, w, h, r } = R;
  ctx.save();
  ctx.lineWidth = 1.5;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(255,255,255,${lerp(0.14, 0.22, icon)})`); g.addColorStop(0.3, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.strokeStyle = g; ctx.beginPath(); ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); ctx.stroke();
  ctx.restore();
}
export { clamp };
