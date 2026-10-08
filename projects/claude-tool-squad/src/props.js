// Cel props (outlined, they share the character layer): the prompt token Claude throws, the
// hilltop terminal, the stadium scoreboard.
import { P, mix, rgba } from './palette.js';
import { cel, ink, glint } from './cel.js';
import { bloom } from './bg.js';
import { setFont } from './type.js';
import { clamp, TAU } from './core.js';

const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };

// The prompt token: a pill-shaped terminal capsule with a glowing `>_`. s = width in px.
export function token(ctx, x, y, s, { rot = 0, glow = 0, spin = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  if (glow > 0) bloom(ctx, 0, 0, s * 1.6, P.coralLt, 0.55 * glow);
  const k = s / 100;
  ctx.scale(k, k);
  const sq = 1 - 0.25 * Math.abs(Math.sin(spin)); // fake spin: squash horizontally
  ctx.scale(sq, 1);
  const body = rr(-50, -31, 100, 62, 31);
  cel(ctx, body, P.term, { sh: '#08070d', depth: 7, line: Math.max(2, 3.2 * k), shapes: [], hlShapes: [rr(-34, -25, 60, 7, 4)], hl: '#3a3650' });
  // cream rim band
  const rim = rr(-50, -31, 100, 62, 31);
  ctx.save(); ctx.clip(rim);
  ctx.strokeStyle = P.cream; ctx.lineWidth = 9; ctx.stroke(rr(-46, -27, 92, 54, 27));
  ctx.restore();
  ink(ctx, rim, Math.max(2, 3.2 * k));
  // glyph
  ctx.save();
  ctx.shadowColor = P.coralLt; ctx.shadowBlur = 10 + glow * 20;
  ctx.strokeStyle = P.coral; ctx.lineWidth = 10; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.beginPath(); ctx.moveTo(-28, -15); ctx.lineTo(-10, 0); ctx.lineTo(-28, 15); ctx.stroke();
  ctx.fillStyle = P.coral; ctx.fillRect(4, 10, 22, 9);
  ctx.restore();
  ctx.restore();
}

// Hilltop terminal: a chunky cel monitor. Returns the screen rect (x, y, w, h) for content.
export function monitor(ctx, x, y, w, { on = 1 } = {}) {
  const h = w * 0.78;
  const lw = Math.max(3, w * 0.006);
  ctx.save();
  // stand
  const stand = new Path2D(); stand.moveTo(x - w * 0.12, y + h * 0.5); stand.lineTo(x + w * 0.12, y + h * 0.5); stand.lineTo(x + w * 0.2, y + h * 0.66); stand.lineTo(x - w * 0.2, y + h * 0.66); stand.closePath();
  cel(ctx, stand, '#cfc6b4', { sh: '#9d927d', depth: w * 0.02, line: lw });
  // casing
  const body = rr(x - w / 2, y - h / 2, w, h * 0.98, w * 0.05);
  cel(ctx, body, '#e6dfcf', { sh: '#b6ab95', depth: w * 0.03, line: lw, hlShapes: [rr(x - w / 2 + w * 0.04, y - h / 2 + w * 0.015, w * 0.8, w * 0.012, 4)], hl: '#fffaf0' });
  // bezel + screen
  const sx = x - w * 0.43, sy = y - h * 0.42, sw = w * 0.86, sh = h * 0.72;
  const bez = rr(sx - w * 0.012, sy - w * 0.012, sw + w * 0.024, sh + w * 0.024, w * 0.03);
  cel(ctx, bez, '#8d8679', { sh: '#6d675c', depth: w * 0.008, line: lw * 0.7 });
  const scr = rr(sx, sy, sw, sh, w * 0.025);
  ctx.fillStyle = mix('#0b0a12', P.term, on); ctx.fill(scr);
  // vents + power light
  ctx.fillStyle = '#9d927d';
  for (let i = 0; i < 5; i++) ctx.fillRect(x + w * 0.26 + i * w * 0.03, y + h * 0.36, w * 0.012, h * 0.06);
  ctx.fillStyle = on > 0.5 ? P.termGreen : '#4a5a4a'; ctx.beginPath(); ctx.arc(x - w * 0.36, y + h * 0.39, w * 0.012, 0, TAU); ctx.fill();
  ctx.restore();
  return { x: sx, y: sy, w: sw, h: sh, clip: scr };
}

// CRT treatment inside a screen rect: scanlines + glass glare
export function crt(ctx, scr, a = 1) {
  ctx.save();
  ctx.clip(scr.clip);
  ctx.globalAlpha = 0.18 * a; ctx.fillStyle = '#000';
  for (let y = scr.y; y < scr.y + scr.h; y += 6) ctx.fillRect(scr.x, y, scr.w, 2);
  ctx.globalAlpha = 0.1 * a;
  const g = ctx.createLinearGradient(scr.x, scr.y, scr.x + scr.w * 0.6, scr.y + scr.h * 0.6);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
  ctx.restore();
}

// Stadium scoreboard (cel prop): frame + LED panel. fill(ctx, panelRect) draws the content.
export function scoreboard(ctx, x, y, w, h, fillFn) {
  const lw = Math.max(2.5, w * 0.005);
  ctx.save();
  for (const sx of [-0.32, 0.32]) {
    const leg = rr(x + sx * w - w * 0.025, y + h * 0.5, w * 0.05, h * 0.6, 4);
    cel(ctx, leg, '#5d6a7a', { sh: '#3d4756', depth: w * 0.01, line: lw });
  }
  const frame = rr(x - w / 2, y - h / 2, w, h, w * 0.02);
  cel(ctx, frame, '#4a5566', { sh: '#2f3745', depth: w * 0.012, line: lw, hlShapes: [rr(x - w / 2 + 8, y - h / 2 + 6, w - 16, 5, 3)], hl: '#7d8a9c' });
  const px = x - w / 2 + w * 0.03, py = y - h / 2 + w * 0.03, pw = w * 0.94, ph = h - w * 0.06;
  const panel = rr(px, py, pw, ph, w * 0.01);
  ctx.fillStyle = '#0a0b10'; ctx.fill(panel);
  ctx.save(); ctx.clip(panel);
  fillFn(ctx, { x: px, y: py, w: pw, h: ph });
  // LED dot mesh
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
  const d = Math.max(4, w * 0.008);
  for (let yy = py; yy < py + ph; yy += d) ctx.fillRect(px, yy, pw, d * 0.3);
  for (let xx = px; xx < px + pw; xx += d) ctx.fillRect(xx, py, d * 0.3, ph);
  ctx.restore();
  ink(ctx, panel, lw * 0.6);
  ctx.restore();
}

// LED content: header, big count, lamp grid. pass = fraction green (0 = all red)
export function boardContent(ctx, r, pass, { flipT = 1 } = {}) {
  const cols = 16, rows = 6;
  const n = cols * rows;
  const green = Math.round(n * clamp(pass));
  setFont(ctx, r.h * 0.13, { fam: 'heavy', weight: 800, stretch: 'condensed', track: r.w * 0.004 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd36b'; ctx.fillText('CI · TEST SUITE', r.x + r.w / 2, r.y + r.h * 0.12);
  const all = pass >= 1;
  const big = all ? `${n} / ${n} PASSING` : `${green} / ${n} PASSING`;
  setFont(ctx, r.h * 0.2, { fam: 'heavy', weight: 800, stretch: 'condensed' });
  ctx.fillStyle = all ? P.greenLt : green > 0 ? '#ffe08a' : '#ff5a5a';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = r.h * 0.04;
  ctx.fillText(big, r.x + r.w / 2, r.y + r.h * 0.33);
  ctx.shadowBlur = 0;
  const gx = r.x + r.w * 0.08, gy = r.y + r.h * 0.5, gw = r.w * 0.84, gh = r.h * 0.42;
  const cw = gw / cols, ch = gh / rows;
  for (let i = 0; i < n; i++) {
    const c = i % cols, rr2 = Math.floor(i / cols);
    const on = i < green;
    const cx = gx + c * cw + cw / 2, cy = gy + rr2 * ch + ch / 2, s = Math.min(cw, ch) * 0.34;
    ctx.fillStyle = on ? P.green : '#e23a3a';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = s * 0.8;
    if (on) { // check
      ctx.strokeStyle = P.greenLt; ctx.lineWidth = s * 0.45; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx - s * 0.25, cy + s * 0.7); ctx.lineTo(cx + s, cy - s * 0.8); ctx.stroke();
    } else { // cross
      ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = s * 0.42; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy - s * 0.75); ctx.lineTo(cx + s * 0.75, cy + s * 0.75); ctx.moveTo(cx + s * 0.75, cy - s * 0.75); ctx.lineTo(cx - s * 0.75, cy + s * 0.75); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}

export { glint };
