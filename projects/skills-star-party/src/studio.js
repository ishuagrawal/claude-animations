// The studio: a soft-lit wall and floor; the video card (a framed screen with a playhead, a heart
// badge and glass glare) that first plays the reference — a video you love — and then the short
// Claude makes from it; the study (a scan sweep, the frames peeling off into a filmstrip, the style
// lifting out as chips: palette, motion curve, sound); and Claude's clapperboard.
import { clamp, lerp, TAU } from './core.js';
import { C, SKILL, OWNER, REPO } from './timeline.js';
import { sp, smooth, eio, eout, font, SANS, icon } from './kit.js';
import { sky, ball, PAL } from './sky.js';
import { sparkle } from './fx.js';

export const IN = { x: 860, y: 236, w: 768, h: 432 };          // the card's screen (16:9)
export const BEZ = 14;
export const CARD_C = [IN.x + IN.w / 2, IN.y + IN.h / 2];
export const FLOOR = 812;

export function wall(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#f6f8fc'); g.addColorStop(1, '#e6ecf5');
  ctx.fillStyle = g; ctx.fillRect(-200, -200, 2320, FLOOR + 200);
  // a soft key light behind the card and a cooler fill on the left
  for (const [x, y, r, c] of [[CARD_C[0], CARD_C[1] - 40, 900, 'rgba(255,255,255,0.85)'], [300, 300, 700, 'rgba(214,226,250,0.5)']]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const f = ctx.createLinearGradient(0, FLOOR, 0, 1180);
  f.addColorStop(0, '#dde4ef'); f.addColorStop(1, '#cfd8e6');
  ctx.fillStyle = f; ctx.fillRect(-200, FLOOR, 2320, 500);
  const hl = ctx.createLinearGradient(0, FLOOR - 2, 0, FLOOR + 30);
  hl.addColorStop(0, 'rgba(255,255,255,0.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-200, FLOOR - 1, 2320, 31);
  // the card's soft reflection on the floor
  ctx.save(); ctx.globalAlpha = 0.18;
  const rf = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 160);
  rf.addColorStop(0, '#b8c6dc'); rf.addColorStop(1, 'rgba(184,198,220,0)');
  ctx.fillStyle = rf; ctx.fillRect(IN.x, FLOOR + 6, IN.w, 160);
  ctx.restore();
}

// the framed screen; content(ctx) draws 1920×1080 into it. ui = overlay visibility (playhead, badge).
export function card(ctx, t, content, { ui = 1, progress = 0, scan = -1 } = {}) {
  const k = sp(t, C.card, 1.6, 0.55);
  if (k <= 0.002) return;
  const cx = CARD_C[0], cy = CARD_C[1];
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(Math.min(1.04, k), Math.min(1.04, k)); ctx.translate(-cx, -cy);
  const x = IN.x - BEZ, y = IN.y - BEZ, w = IN.w + 2 * BEZ, h = IN.h + 2 * BEZ;
  const m = ctx.getTransform().a;
  ctx.shadowColor = 'rgba(40,60,100,0.22)'; ctx.shadowBlur = 60 * m; ctx.shadowOffsetY = 26 * m;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(31,35,40,0.08)'; ctx.lineWidth = 1.5; ctx.stroke();
  // the screen
  ctx.save();
  ctx.beginPath(); ctx.roundRect(IN.x, IN.y, IN.w, IN.h, 16); ctx.clip();
  ctx.save(); ctx.translate(IN.x, IN.y); ctx.scale(IN.w / 1920, IN.h / 1080); content(ctx); ctx.restore();
  if (scan >= 0 && scan <= 1) { // the study: a bright scan line and an analysed tint behind it
    const sx = IN.x + IN.w * scan;
    ctx.fillStyle = 'rgba(80,170,255,0.10)'; ctx.fillRect(IN.x, IN.y, sx - IN.x, IN.h);
    const sg = ctx.createLinearGradient(sx - 40, 0, sx + 6, 0);
    sg.addColorStop(0, 'rgba(120,200,255,0)'); sg.addColorStop(0.85, 'rgba(160,220,255,0.7)'); sg.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 40, IN.y, 46, IN.h);
  }
  if (ui > 0.01) {
    ctx.globalAlpha = ui;
    // glass glare
    const gg = ctx.createLinearGradient(IN.x, IN.y, IN.x + IN.w * 0.6, IN.y + IN.h);
    gg.addColorStop(0, 'rgba(255,255,255,0.16)'); gg.addColorStop(0.35, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(IN.x, IN.y, IN.w, IN.h);
    // playhead
    const by = IN.y + IN.h - 22, bx0 = IN.x + 26, bx1 = IN.x + IN.w - 26, px = lerp(bx0, bx1, clamp(progress));
    const bg = ctx.createLinearGradient(0, by - 40, 0, IN.y + IN.h); bg.addColorStop(0, 'rgba(20,30,50,0)'); bg.addColorStop(1, 'rgba(20,30,50,0.25)');
    ctx.fillStyle = bg; ctx.fillRect(IN.x, by - 40, IN.w, IN.y + IN.h - by + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.roundRect(bx0, by - 3, bx1 - bx0, 6, 3); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(bx0, by - 3, px - bx0, 6, 3); ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6 * m; ctx.beginPath(); ctx.arc(px, by, 9, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent';
    // heart badge: a video you love
    const hx = IN.x + 40, hy = IN.y + 40;
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10 * m; ctx.shadowOffsetY = 3 * m;
    ctx.beginPath(); ctx.arc(hx, hy, 24, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowColor = 'transparent';
    const beat = 1 + 0.1 * Math.max(0, Math.sin(t * Math.PI * 2)) ** 8;
    ctx.save(); ctx.translate(hx, hy + 1); ctx.scale(beat, beat);
    ctx.fillStyle = '#ff5a6e';
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -10, -14, 0, -6); ctx.bezierCurveTo(10, -14, 14, -1, 0, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-5, -6, 2.6, 1.6, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // inner screen edge
  ctx.strokeStyle = 'rgba(31,35,40,0.10)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(IN.x, IN.y, IN.w, IN.h, 16); ctx.stroke();
  ctx.restore();
}

// the reference frame at time tt (for the filmstrip thumbnails)
function refFrame(ctx, tt) { sky(ctx, tt); ball(ctx, tt); }

// frames peel off the card into a filmstrip above it
export function filmstrip(ctx, t) {
  const u0 = t - C.frames;
  if (u0 < 0 || t > C.clap) return;
  const out = smooth((t - C.absorb - 0.15) / 0.35);
  const n = 4, fw = 160, fh = 90, gap = 18, sw = n * fw + (n - 1) * gap + 40, sx = CARD_C[0] - sw / 2, sy = 62 - out * 60;
  ctx.save();
  ctx.globalAlpha *= 1 - out;
  // the strip
  const a = smooth(u0 / 0.25);
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#20252c'; ctx.beginPath(); ctx.roundRect(sx, sy, sw, fh + 44, 10); ctx.fill();
  ctx.fillStyle = '#f2f4f8';
  for (let i = 0; i < 22; i++) { const hx = sx + 14 + i * (sw - 28) / 21; ctx.beginPath(); ctx.roundRect(hx - 5, sy + 6, 10, 8, 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(hx - 5, sy + fh + 30, 10, 8, 2); ctx.fill(); }
  ctx.globalAlpha /= a;
  for (let i = 0; i < n; i++) {
    const k = eout((u0 - 0.06 - i * 0.08) / 0.38);
    if (k <= 0) continue;
    const tx = sx + 20 + i * (fw + gap), ty = sy + 22;
    // flies from the card screen to its slot
    const x = lerp(IN.x + IN.w * (0.12 + i * 0.22), tx, k), y = lerp(IN.y + IN.h * 0.35, ty, k), s = lerp(1.6, 1, k);
    ctx.save(); ctx.translate(x + fw / 2, y + fh / 2); ctx.scale(s, s); ctx.rotate((1 - k) * (i - 1.5) * 0.12); ctx.translate(-fw / 2, -fh / 2);
    ctx.beginPath(); ctx.roundRect(0, 0, fw, fh, 6); ctx.save(); ctx.clip();
    ctx.scale(fw / 1920, fh / 1080); refFrame(ctx, 0.15 + i * 0.42); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// the style lifting out of the reference: four swatches, a motion curve, a sound wave
const CHIPS = [['swatch', PAL.skyTop], ['swatch', PAL.coral], ['swatch', PAL.hill], ['swatch', PAL.sun], ['motion'], ['sound']];
export function chips(ctx, t, target) {
  if (t < C.chips || t > C.absorb + 0.5) return;
  CHIPS.forEach(([kind, col], i) => {
    const t0 = C.chips + i * 0.05, k = clamp(sp(t, t0, 2.2, 0.55), 0, 1.15);
    if (k <= 0.002) return;
    const from = [IN.x + 60 + (i % 3) * 120, IN.y + 140 + Math.floor(i / 3) * 120];
    const an = Math.PI * (1.12 + i * 0.152), park = [500 + Math.cos(an) * 250, 360 + Math.sin(an) * 150];
    let [x, y] = [lerp(from[0], park[0], Math.min(1, k)), lerp(from[1], park[1], Math.min(1, k))];
    let s = k;
    const a = eio((t - C.absorb - i * 0.03) / 0.3);
    if (a > 0) { // into Claude
      const q = 1 - a, c = [(park[0] + target[0]) / 2, Math.min(park[1], target[1]) - 140];
      x = q * q * park[0] + 2 * q * a * c[0] + a * a * target[0]; y = q * q * park[1] + 2 * q * a * c[1] + a * a * target[1];
      s *= 1 - a * 0.85;
      if (a >= 1) return;
    }
    const bob = Math.sin(t * 5 + i) * 4 * (1 - a);
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    const m = ctx.getTransform().a;
    ctx.shadowColor = 'rgba(40,60,100,0.25)'; ctx.shadowBlur = 14 * m; ctx.shadowOffsetY = 5 * m;
    ctx.scale(1.3, 1.3);
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowColor = 'transparent';
    if (kind === 'swatch') {
      const g = ctx.createRadialGradient(-8, -9, 2, 0, 0, 27); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, col); g.addColorStop(1, col);
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fillStyle = g; ctx.fill();
    } else if (kind === 'motion') {
      ctx.strokeStyle = '#8250df'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-20, 14); ctx.bezierCurveTo(-4, 14, -2, -14, 20, -14); ctx.stroke();
      ctx.fillStyle = '#8250df'; ctx.beginPath(); ctx.arc(-20, 14, 4.5, 0, TAU); ctx.arc(20, -14, 4.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(130,80,223,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, 14); ctx.lineTo(-4, 14); ctx.moveTo(20, -14); ctx.lineTo(2, -14); ctx.stroke();
    } else {
      ctx.fillStyle = '#bf3989';
      [10, 22, 32, 18, 26, 12].forEach((h, j) => { const hh = h * (0.7 + 0.3 * Math.abs(Math.sin(t * 9 + j))); ctx.beginPath(); ctx.roundRect(-19 + j * 7.2, -hh / 2, 4.6, hh, 2.3); ctx.fill(); });
    }
    ctx.restore();
  });
  // a sparkle where they land
  const land = t - C.absorb - 0.3;
  if (land > 0 && land < 0.4) for (let i = 0; i < 6; i++) { const a = i * TAU / 6, d = 20 + 70 * eout(land / 0.4); sparkle(ctx, target[0] + Math.cos(a) * d, target[1] + Math.sin(a) * d, 12 * (1 - land / 0.4), i % 2 ? '#ffd56b' : '#8250df', a, 1); }
}

// Claude's clapperboard. (x, y) = the board's bottom-left corner; open = clapstick angle (rad).
const STRIPES = (ctx, w, h) => {
  ctx.fillStyle = '#f4f5f7'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b1f24';
  for (let i = -1; i < 10; i++) { const x0 = i * 34; ctx.beginPath(); ctx.moveTo(x0, h); ctx.lineTo(x0 + 17, h); ctx.lineTo(x0 + 17 + h * 0.7, 0); ctx.lineTo(x0 + h * 0.7, 0); ctx.closePath(); ctx.fill(); }
};
export function clapper(ctx, x, y, { open = 0, rot = -0.06, pop = 0, flash = 0, scale = 1 } = {}) {
  const bw = 250, bh = 168, sh = 30;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale * (1 + pop), scale * (1 + pop));
  const m = ctx.getTransform().a;
  // board
  ctx.shadowColor = 'rgba(20,30,50,0.3)'; ctx.shadowBlur = 18 * m; ctx.shadowOffsetY = 8 * m;
  ctx.beginPath(); ctx.roundRect(0, -bh, bw, bh, 10); ctx.fillStyle = '#22272e'; ctx.fill(); ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, -bh, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(12, -bh + 74); ctx.lineTo(bw - 12, -bh + 74); ctx.moveTo(12, -bh + 116); ctx.lineTo(bw - 12, -bh + 116); ctx.moveTo(bw / 2, -bh + 116); ctx.lineTo(bw / 2, -10); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'alphabetic';
  font(ctx, 13, 600, SANS, 1.5); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('SKILL', 14, -bh + 26);
  font(ctx, 29, 700, SANS, -0.5); const fit = Math.min(29, 29 * (bw - 28) / ctx.measureText(SKILL).width);
  font(ctx, fit, 700, SANS, -0.5); ctx.fillStyle = '#ffffff'; ctx.fillText(SKILL, 14, -bh + 60);
  font(ctx, 12, 600, SANS, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('REPO', 14, -bh + 98);
  font(ctx, 18, 600, SANS, 0); ctx.fillStyle = '#ffffff'; ctx.fillText(`${OWNER}/${REPO}`, 64, -bh + 99);
  font(ctx, 12, 600, SANS, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('SCENE', 14, -bh + 138); ctx.fillText('TAKE', bw / 2 + 12, -bh + 138);
  font(ctx, 24, 700, SANS, 0); ctx.fillStyle = '#ffffff'; ctx.fillText('1', 14, -bh + 162 - 4); ctx.fillText('1', bw / 2 + 12, -bh + 158);
  // bottom clapstick (fixed) + hinged top stick
  ctx.save(); ctx.translate(0, -bh - sh); ctx.beginPath(); ctx.roundRect(0, 0, bw, sh, 4); ctx.clip(); STRIPES(ctx, bw, sh); ctx.restore();
  ctx.save(); ctx.translate(2, -bh - sh); ctx.rotate(-open);
  ctx.save(); ctx.translate(0, -sh - 2); ctx.beginPath(); ctx.roundRect(0, 0, bw - 2, sh, 4); ctx.clip(); STRIPES(ctx, bw, sh); ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#9aa4b2'; ctx.beginPath(); ctx.arc(8, -bh - sh - 1, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8ecf2'; ctx.beginPath(); ctx.arc(8, -bh - sh - 1, 2.5, 0, TAU); ctx.fill();
  if (flash > 0) { // the snap: little impact lines off the far end
    ctx.strokeStyle = `rgba(255,214,90,${flash})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.4, r0 = 18, r1 = 18 + 34 * (1 - flash * 0.4); ctx.beginPath(); ctx.moveTo(bw + Math.cos(a) * r0, -bh - sh + Math.sin(a) * r0); ctx.lineTo(bw + Math.cos(a) * r1, -bh - sh + Math.sin(a) * r1); ctx.stroke(); }
  }
  ctx.restore();
}

// the end lockup under the card: GitHub mark, repo, ★ count
export function lockup(ctx, t, stars, starFn) {
  const a = eout((t - C.lockup) / 0.5);
  if (a <= 0) return;
  const y = 760, size = 40;
  font(ctx, size, 600, SANS, -0.3);
  const ow = ctx.measureText(`${OWNER}/`).width; font(ctx, size, 700, SANS, -0.3); const rw = ctx.measureText(REPO).width;
  font(ctx, size, 700, SANS, -0.3); const nw = ctx.measureText(String(stars)).width;
  const total = 48 + 16 + ow + rw + 40 + 40 + 10 + nw, x0 = CARD_C[0] - total / 2;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 20);
  icon(ctx, 'github', x0 + 24, y - 14, 48, '#1f2328');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  font(ctx, size, 600, SANS, -0.3); ctx.fillStyle = '#59636e'; ctx.fillText(`${OWNER}/`, x0 + 64, y);
  font(ctx, size, 700, SANS, -0.3); ctx.fillStyle = '#1f2328'; ctx.fillText(REPO, x0 + 64 + ow, y);
  const sx = x0 + 64 + ow + rw + 40 + 20;
  starFn(ctx, sx, y - 14, 21);
  ctx.fillStyle = '#1f2328'; ctx.fillText(String(stars), sx + 30, y);
  ctx.restore();
}

// festive bunting that drops in across the top of the studio at the wrap
const FLAGS = ['#8250df', '#2da44e', '#e3b341', '#0969da', '#bf3989', '#da7758'];
export function bunting(ctx, t) {
  const k = clamp(sp(t, C.wrap + 0.15, 1.3, 0.45), 0, 1.2);
  if (k <= 0.002) return;
  for (const [x0, x1, y0, sag, n, seed] of [[-80, 1000, 0, 120, 13, 0], [900, 2000, -10, 110, 13, 3]]) {
    const yy = y0 - (1 - k) * 220;
    const P = u => [lerp(x0, x1, u), yy + 4 * sag * u * (1 - u) + Math.sin(t * 2 + u * 6 + seed) * 4];
    ctx.strokeStyle = '#8c959f'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const [x, y] = P(i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, [x, y] = P(u), [xa, ya] = P(u - 0.02), [xb, yb] = P(u + 0.02);
      const ang = Math.atan2(yb - ya, xb - xa), sw = Math.sin(t * 3 + i * 1.3) * 0.08;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + sw);
      const c = FLAGS[(i + seed) % FLAGS.length];
      ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.lineTo(0, 54); ctx.closePath();
      ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(0, 0); ctx.lineTo(0, 54); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-24, 0, 48, 4);
      ctx.restore();
    }
  }
}
