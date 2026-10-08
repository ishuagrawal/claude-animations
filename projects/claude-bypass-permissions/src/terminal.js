// Claude Code terminal UI, drawn into the monitor's 1600x900 virtual screen.
import { P, mix, rgba } from './palette.js';
import { rrP, rectP, fill, text, font, glow } from './draw.js';
import { clamp, FPS } from './core.js';

export const FS = 30, LH = 46, PAD = 54;
const MONO = { fam: 'mono', weight: 500 };
const MONO_B = { fam: 'mono', weight: 700 };

export function bg(ctx, w, h, col = P.term) {
  ctx.fillStyle = col; ctx.fillRect(0, 0, w, h);
}

// typed substring: chars appear at `cps` from t0
export const typed = (s, t, t0, cps = 28) => s.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
export const cursorOn = t => Math.floor(t * 2.2) % 2 === 0;

// Draw a run of styled segments on one line. segs: [[text, color, bold?], ...]
export function line(ctx, x, y, segs, size = FS) {
  let cx = x;
  for (const [s, c, b] of segs) {
    font(ctx, size, b ? MONO_B : MONO);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = c;
    ctx.fillText(s, cx, y);
    cx += ctx.measureText(s).width;
  }
  return cx;
}
export function cursor(ctx, x, y, t, size = FS, col = P.cream) {
  if (!cursorOn(t)) return;
  fill(ctx, rectP(x + 2, y - size * 0.82, size * 0.58, size * 1.02), col);
}

// rounded box border (terminal-drawn)
export function box(ctx, x, y, w, h, col, lw = 2.5, r = 14) {
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
}

// The tiny pixel mascot shown in the welcome box (also the eyes that "boot up")
export function pixelMascot(ctx, x, y, u, col = P.coral, eyeCol = P.ink, eyeGlow = 0) {
  ctx.fillStyle = col;
  ctx.fillRect(x + u * 1, y, u * 6, u * 4);
  ctx.fillRect(x, y + u * 1.5, u * 8, u * 1.5);
  ctx.fillRect(x + u * 1, y + u * 4, u, u * 1.4);
  ctx.fillRect(x + u * 2.6, y + u * 4, u, u * 1.4);
  ctx.fillRect(x + u * 4.4, y + u * 4, u, u * 1.4);
  ctx.fillRect(x + u * 6, y + u * 4, u, u * 1.4);
  ctx.fillStyle = eyeCol;
  ctx.fillRect(x + u * 2, y + u * 0.8, u * 0.8, u * 0.8);
  ctx.fillRect(x + u * 5.2, y + u * 0.8, u * 0.8, u * 0.8);
  if (eyeGlow > 0) {
    glow(ctx, x + u * 2.4, y + u * 1.2, u * 3 * eyeGlow, eyeCol, 0.8 * eyeGlow);
    glow(ctx, x + u * 5.6, y + u * 1.2, u * 3 * eyeGlow, eyeCol, 0.8 * eyeGlow);
  }
}

export function welcome(ctx, x, y, w, o = {}) {
  const h = 196;
  box(ctx, x, y, w, h, P.coral, 2.5, 16);
  if (!o.hideMascot) pixelMascot(ctx, x + 44, y + 52, 14, P.coral, o.eyeCol || P.ink, o.eyeGlow || 0);
  line(ctx, x + 196, y + 72, [['✻ ', P.coral, true], ['Claude Code', P.cream, true], ['  v2.1', P.termDim]]);
  line(ctx, x + 196, y + 118, [['Opus · ', P.termDim], ['~/acme-app', P.cream]]);
  line(ctx, x + 196, y + 160, [['/help for help, /status for your current setup', P.termDim]], 24);
  return h;
}

export function inputBox(ctx, x, y, w, str, t, o = {}) {
  const h = 78;
  box(ctx, x, y, w, h, o.border || '#4b4e78', 2.5, 12);
  const end = line(ctx, x + 26, y + 51, [['> ', P.termDim], [str, P.cream]]);
  if (o.cursor !== false) cursor(ctx, end, y + 51, t);
  return h;
}

export function statusLine(ctx, x, y, mode, glowAmt = 0) {
  const modes = {
    bypass: [['⏵⏵ bypass permissions on', P.red, true], [' (shift+tab to cycle)', P.termDim]],
    manual: [['⏸ manual mode on', P.termDim], [' (shift+tab to cycle)', P.termDim]],
    sandbox: [['⏵⏵ bypass permissions on', P.red, true], ['  ·  ', P.termDim], ['▣ sandboxed container · no network', P.sky, true]],
  };
  if (glowAmt > 0) glow(ctx, x + 200, y - 10, 330 * glowAmt, P.red, 0.35 * glowAmt);
  return line(ctx, x + 6, y, modes[mode] || modes.manual, 26);
}

// tool call: ⏺ Name(args) + ⎿ result lines
export function toolCall(ctx, x, y, name, args, result, o = {}) {
  line(ctx, x, y, [['⏺ ', o.dot || P.lemon], [name, P.cream, true], ['(', P.cream], [args, P.cream], [')', P.cream]]);
  let yy = y;
  for (const r of result || []) {
    yy += LH;
    line(ctx, x, yy, [['  ⎿  ', P.termDim], [r, o.resCol || P.termDim]]);
  }
  return yy;
}

export function spinner(ctx, x, y, t, verb) {
  const glyphs = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  const g = glyphs[Math.floor(t * 8) % glyphs.length];
  line(ctx, x, y, [[g + ' ', P.coral, true], [verb + '…', P.coral], ['  (esc to interrupt)', P.termDim]]);
}

export function warningBox(ctx, x, y, w, sel, t, accent = 1) {
  const h = 520;
  ctx.fillStyle = rgba(P.redDeep, 0.25 * accent);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
  box(ctx, x, y, w, h, P.red, 3, 16);
  let yy = y + 70;
  line(ctx, x + 40, yy, [['WARNING: Claude Code running in Bypass Permissions mode', P.red, true]]);
  yy += 70;
  const body = [
    'In Bypass Permissions mode, Claude Code will not ask for your',
    'approval before running potentially dangerous commands.',
    'This mode should only be used in a sandboxed container/VM that',
    'has restricted internet access and can easily be restored.',
  ];
  body.forEach((b, i) => { line(ctx, x + 40, yy + i * LH - (i > 1 ? -18 : 0), [[b, P.cream]], 28); });
  yy += LH * 4 + 60;
  line(ctx, x + 40, yy, [[sel === 0 ? '❯ ' : '  ', P.sky, true], ['1. No, exit', sel === 0 ? P.sky : P.termDim, sel === 0]]);
  line(ctx, x + 40, yy + LH + 6, [[sel === 1 ? '❯ ' : '  ', P.red, true], ['2. Yes, I accept', sel === 1 ? P.red : P.termDim, sel === 1]]);
  return h;
}
