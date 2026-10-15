// FEATURE — the skill itself, as a product-site split section. Left: icon + "video-by-reference",
// description, checklist, and a dim list of what's in the skill folder. Right: layered live UI —
// a Claude Code terminal where the cursor types the slash command (with autocomplete), a style-bible
// card whose skeleton fills in, a pipeline card whose toggles flip as the run progresses (the cursor
// clicks the last one), and a player card that renders this very film.
import { C, RUN, SKILL, STARS } from '../timeline.js';
import { FEAT, TERM_INPUT, pipeRow } from '../layout.js';
import { clamp, TAU } from '../core.js';
import { sp, smooth, icon, glow } from '../kit.js';
import { rgba, mix } from '../palette.js';
import { G, card, txt, rr, rise, toggle, checkDot, traffic, code } from '../ui.js';
import { octocat } from '../actors.js';

const FRAMES = 1560;
export const typed = t => Math.max(0, Math.min(RUN.length, Math.floor((t - C.type) * 18.5)));
const outs = () => [C.out1, C.out2, C.out3, C.out4];
export const toggleOn = (t, i) => smooth((t - outs()[i] - 0.02) / 0.16);
const renderU = t => {
  const u = clamp((t - C.out4 - 0.2) / (C.doneRender - C.out4 - 0.2));
  return clamp(u + Math.sin(u * 19) * 0.012 * (1 - u)); // uneven, like real progress
};

function enter(ctx, t, t0, fn) {
  const k = sp(t, t0, 1.3, 0.7);
  if (k <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6);
  ctx.translate(0, (1 - k) * 46);
  fn();
  ctx.restore();
}

// ---------------------------------------------------------------- left column
function left(ctx, t) {
  const x = FEAT.x;
  const st = (i, fn) => { ctx.save(); const a = rise(ctx, (t - C.feat - i * 0.07) / 0.6, 16); ctx.globalAlpha *= a; fn(); ctx.restore(); };
  st(0, () => {
    rr(ctx, x, 128, 40, 40, 10);
    const g = ctx.createLinearGradient(x, 128, x + 40, 168); g.addColorStop(0, '#a371f7'); g.addColorStop(1, '#6e40c9');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    icon(ctx, 'video', x + 20, 148, 21, '#ffffff');
    txt(ctx, 'Agent Skill', x + 54, 155, { size: 18, weight: 500, color: G.purpleFg });
  });
  st(1, () => txt(ctx, SKILL, x - 2, 238, { size: 56, weight: 500, color: G.fg, track: -2 }));
  st(2, () => {
    ['Turns a video you love into an original', 'animated short in the same style, with its', 'own soundtrack.'].forEach((s, i) => txt(ctx, s, x, 290 + i * 32, { size: 21, color: G.muted }));
  });
  ['Studies your reference, frame by frame', 'Writes a measured style bible', 'Invents an original story', 'Animates and scores it in code'].forEach((s, i) => st(3 + i * 0.6, () => {
    checkDot(ctx, x + 12, 420 + i * 46 - 6, 12, { on: 1 });
    txt(ctx, s, x + 38, 420 + i * 46, { size: 19, weight: 500, color: '#c9d1d9' });
  }));
  // dim list: what's inside the skill folder, with a rail marking SKILL.md
  st(6, () => {
    ctx.fillStyle = 'rgba(240,246,252,0.08)'; ctx.fillRect(x - 26, 616, 2, 4 * 46 - 6);
    const rg = ctx.createLinearGradient(0, 616, 0, 656); rg.addColorStop(0, G.purpleFg); rg.addColorStop(1, G.pink);
    ctx.fillStyle = rg; ctx.fillRect(x - 26, 616, 2, 40);
    [['file', 'SKILL.md', ''], ['folder', 'references/', '7 guides'], ['folder', 'scripts/', '3 tools'], ['folder', 'assets/engine/', 'template']].forEach(([ic, s, meta], i) => {
      const y = 643 + i * 46, on = i === 0;
      icon(ctx, ic, x + 10, y - 7, 18, on ? G.fg : G.faint);
      const w = txt(ctx, s, x + 32, y, { size: 20, weight: on ? 500 : 400, color: on ? G.fg : G.faint });
      if (meta) txt(ctx, meta, x + 32 + w + 12, y, { size: 13, fam: '"Monaspace Neon", monospace', color: '#484f58' });
    });
  });
}

// ---------------------------------------------------------------- terminal (Claude Code)
const MONO = '"Monaspace Neon", ui-monospace, monospace';
function terminal(ctx, t) {
  const { x, y, w, h } = FEAT.term;
  card(ctx, x, y, w, h, { r: 14, fill: '#0b0f14', sh: 0.7 });
  ctx.save();
  rr(ctx, x, y, w, h, 14); ctx.clip();
  ctx.fillStyle = '#161b22'; ctx.fillRect(x, y, w, 42);
  ctx.fillStyle = 'rgba(240,246,252,0.08)'; ctx.fillRect(x, y + 42, w, 1);
  traffic(ctx, x + 20, y + 21, 12);
  txt(ctx, 'claude — ~/skills-star-party', x + w / 2, y + 26, { size: 14, fam: MONO, color: G.muted, align: 'center' });
  // welcome box
  rr(ctx, x + 20.5, y + 60.5, w - 41, 46, 8); ctx.strokeStyle = rgba(G.clay, 0.8); ctx.lineWidth = 1; ctx.stroke();
  icon(ctx, 'sparkleFill', x + 42, y + 83.5, 16, G.clay);
  const ww = txt(ctx, 'Welcome to ', x + 60, y + 89, { size: 16, fam: MONO, color: G.fg });
  txt(ctx, 'Claude Code', x + 60 + ww, y + 89, { size: 16, fam: MONO, weight: 600, color: G.fg });
  txt(ctx, '~/skills-star-party', x + w - 36, y + 89, { size: 13, fam: MONO, color: G.faint, align: 'right' });
  if (t < C.enter) {
    // prompt input with typed text, autocomplete, caret
    rr(ctx, x + 20.5, y + 122.5, w - 41, 44, 8); ctx.strokeStyle = 'rgba(240,246,252,0.22)'; ctx.stroke();
    txt(ctx, '>', x + 36, TERM_INPUT.y, { size: 18, fam: MONO, color: G.muted });
    const n = typed(t), s = RUN.slice(0, n);
    const ex = code(ctx, [[s, '#d2a8ff']], TERM_INPUT.x, TERM_INPUT.y, { size: 18 });
    if (n === 0) txt(ctx, 'Try "/skills:video-by-reference"', TERM_INPUT.x, TERM_INPUT.y, { size: 18, fam: MONO, color: '#484f58' });
    if (Math.floor(t * 2.4) % 2 === 0 || (n > 0 && n < RUN.length)) { ctx.fillStyle = '#c9d1d9'; ctx.fillRect(ex + (n ? 2 : 0), TERM_INPUT.y - 18, 10, 22); }
    if (n >= 3) { // autocomplete
      const items = [['/skills:video-by-reference', 'Turns a video you love into…'], ['/skills', 'List installed skills'], ['/status', 'Show session status']];
      items.forEach(([c, d], i) => {
        const iy = y + 200 + i * 34, on = i === 0;
        if (on) { rr(ctx, x + 20, iy - 22, w - 40, 32, 6); ctx.fillStyle = 'rgba(163,113,247,0.14)'; ctx.fill(); }
        txt(ctx, c, x + 36, iy, { size: 15, fam: MONO, color: on ? '#d2a8ff' : G.muted, weight: on ? 500 : 400 });
        txt(ctx, d, x + 318, iy, { size: 14, color: on ? '#c9d1d9' : G.faint });
      });
    }
  } else {
    txt(ctx, '> ' + RUN, x + 36, TERM_INPUT.y, { size: 17, fam: MONO, color: G.muted });
    const lines = [
      ['Studied the reference', '31 s · 60 fps · one take'],
      ['Wrote the style bible', 'palette · type · motion'],
      ['Wrote an original story', 'icon → Octocat → page'],
      [null, null],
    ];
    lines.forEach(([a, b], i) => {
      const t0 = outs()[i];
      if (t < t0) return;
      const u = clamp((t - t0) / 0.3), ly = y + 200 + i * 40;
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 20, ly - 26, (w - 40) * (1 - Math.pow(1 - u, 3)), 40); ctx.clip();
      if (i < 3) {
        ctx.beginPath(); ctx.arc(x + 42, ly - 6, 5, 0, TAU); ctx.fillStyle = G.greenFg; ctx.fill();
        const aw = txt(ctx, a, x + 58, ly, { size: 17, fam: MONO, color: G.fg });
        txt(ctx, '  ' + b, x + 58 + aw, ly, { size: 14, fam: MONO, color: G.faint });
      } else {
        const ru = renderU(t), fin = t >= C.doneRender;
        if (fin) { ctx.beginPath(); ctx.arc(x + 42, ly - 6, 5, 0, TAU); ctx.fillStyle = G.greenFg; ctx.fill(); }
        else { ctx.save(); ctx.translate(x + 42, ly - 6); ctx.rotate(t * 5); icon(ctx, 'sparkleFill', 0, 0, 15, G.clay); ctx.restore(); }
        const aw = txt(ctx, fin ? 'Rendered the film' : 'Rendering…', x + 58, ly, { size: 17, fam: MONO, color: fin ? G.fg : '#f0a17f' });
        txt(ctx, `  ${Math.round(ru * FRAMES)}/${FRAMES} frames`, x + 58 + aw, ly, { size: 14, fam: MONO, color: G.faint });
      }
      ctx.restore();
    });
  }
  txt(ctx, '? for shortcuts', x + 24, y + h - 18, { size: 13, fam: MONO, color: '#484f58' });
  if (t > C.enter && t < C.doneRender) txt(ctx, 'esc to interrupt', x + w - 24, y + h - 18, { size: 13, fam: MONO, color: G.faint, align: 'right' });
  ctx.restore();
}

// ---------------------------------------------------------------- style bible card
const SWATCH = ['#0d1117', '#161b22', '#6e40c9', '#bf3989', '#1f6feb', '#e3b341', '#3fb950', '#e6edf3'];
function bible(ctx, t) {
  const { x, y, w, h } = FEAT.bible;
  card(ctx, x, y, w, h, { r: 14, fill: '#161b22', sh: 0.65 });
  rr(ctx, x + 18, y + 18, 32, 32, 8);
  const g = ctx.createLinearGradient(x + 18, y + 18, x + 50, y + 50); g.addColorStop(0, '#f778ba'); g.addColorStop(1, '#bf3989');
  ctx.fillStyle = g; ctx.fill();
  icon(ctx, 'brush', x + 34, y + 34, 17, '#ffffff');
  txt(ctx, 'Style bible', x + 62, y + 40, { size: 18, weight: 600 });
  rr(ctx, x + w - 62.5, y + 23.5, 44, 22, 11); ctx.strokeStyle = G.border; ctx.lineWidth = 1; ctx.stroke();
  txt(ctx, 'v3', x + w - 40.5, y + 35, { size: 12, fam: MONO, color: G.muted, align: 'center', base: 'middle' });
  const ready = t - C.out2;
  const shimmer = (bx, by, bw, bh) => {
    rr(ctx, bx, by, bw, bh, Math.min(7, bh / 2)); ctx.fillStyle = '#21262d'; ctx.fill();
    const sx = x + ((t * 0.8) % 1.5 - 0.25) * w;
    const sg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.07)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fill();
  };
  // palette swatches pop in when the bible is written
  for (let i = 0; i < SWATCH.length; i++) {
    const sx = x + 18 + i * 36, sy = y + 70;
    const k = sp(t, C.out2 + i * 0.04, 2, 0.5);
    if (ready < 0 || k < 0.02) { shimmer(sx, sy, 30, 30); continue; }
    ctx.save(); ctx.translate(sx + 15, sy + 15); ctx.scale(k, k);
    rr(ctx, -15, -15, 30, 30, 7); ctx.fillStyle = SWATCH[i]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  const rows = [['Shot', '1 continuous take'], ['Motion', 'calm · push-ins'], ['Type', 'Mona Sans'], ['Tempo', '120 BPM'], ['Grade', 'dark · brand glow']];
  rows.forEach(([k, v], i) => {
    const ry = y + 140 + i * 34;
    ctx.fillStyle = 'rgba(240,246,252,0.06)'; ctx.fillRect(x + 18, ry - 22, w - 36, 1);
    txt(ctx, k, x + 18, ry, { size: 14, color: G.muted });
    const a = smooth((ready - 0.15 - i * 0.06) / 0.25);
    if (a < 1) { ctx.save(); ctx.globalAlpha *= 1 - a; shimmer(x + w - 18 - 120 + i * 8, ry - 12, 120 - i * 8, 12); ctx.restore(); }
    if (a > 0) txt(ctx, v, x + w - 18, ry, { size: 14, fam: MONO, color: G.fg, align: 'right', a });
  });
}

// ---------------------------------------------------------------- pipeline toggles
function pipeline(ctx, t) {
  const { x, y, w, h } = FEAT.pipe;
  card(ctx, x, y, w, h, { r: 14, fill: '#161b22', sh: 0.7 });
  icon(ctx, 'workflow', x + 30, y + 34, 18, G.muted);
  txt(ctx, 'Pipeline', x + 48, y + 40, { size: 17, weight: 600 });
  const nOn = [0, 1, 2, 3].filter(i => t >= outs()[i]).length;
  txt(ctx, `${nOn}/4`, x + w - 20, y + 40, { size: 14, fam: MONO, color: nOn === 4 ? G.greenFg : G.muted, align: 'right' });
  ctx.fillStyle = 'rgba(240,246,252,0.07)'; ctx.fillRect(x + 1, y + 60, w - 2, 1);
  [['eye', 'Analyze reference'], ['brush', 'Style bible'], ['book', 'Original story'], ['video', 'Score + render']].forEach(([ic, s], i) => {
    const r = pipeRow(i), on = toggleOn(t, i);
    icon(ctx, ic, x + 30, r.y + 13, 16, mix(G.faint, G.fg, on));
    txt(ctx, s, x + 48, r.y + 19, { size: 15, weight: 500, color: mix(G.muted, G.fg, on) });
    toggle(ctx, r.tx, r.y, on, { w: 46, h: 26, color: i === 3 ? G.purple : G.green });
  });
}

// ---------------------------------------------------------------- player (renders this film)
function miniFilm(ctx, x, y, w, h, t, u) {
  // a tiny version of this film: gradient stage, the window, the Octocat, "70 stars"
  ctx.save();
  rr(ctx, x, y, w, h, 10); ctx.clip();
  ctx.fillStyle = '#06070b'; ctx.fillRect(x, y, w, h);
  for (const [fx, fy, r, c, a] of [[0.1, 0.85, 0.6, '#6e40c9', 0.7], [0.92, 0.9, 0.55, '#bf3989', 0.55], [0.9, 0.05, 0.5, '#1f6feb', 0.45]]) {
    const g = ctx.createRadialGradient(x + fx * w, y + fy * h, 0, x + fx * w, y + fy * h, r * w);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  const px = x + w * 0.09, py = y + h * 0.09, pw = w * 0.82, ph = h * 0.82;
  rr(ctx, px, py, pw, ph, 6); ctx.fillStyle = '#0d1117'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(240,246,252,0.08)'; ctx.fillRect(px, py + ph * 0.08, pw, 1);
  rr(ctx, px + pw * 0.08, py + ph * 0.24, pw * 0.14, ph * 0.05, 3); ctx.fillStyle = G.magenta; ctx.fill();
  txt(ctx, `${STARS} stars`, px + pw * 0.08, py + ph * 0.45, { size: ph * 0.13, weight: 500, color: '#f2cc60' });
  txt(ctx, 'on GitHub', px + pw * 0.08, py + ph * 0.59, { size: ph * 0.13, weight: 500, color: G.fg });
  rr(ctx, px + pw * 0.08, py + ph * 0.7, pw * 0.13, ph * 0.07, 3); ctx.fillStyle = '#21262d'; ctx.fill();
  rr(ctx, px + pw * 0.23, py + ph * 0.7, pw * 0.14, ph * 0.07, 3); ctx.fillStyle = '#f0f6fc'; ctx.fill();
  octocat(ctx, px + pw * 0.72, py + ph * 0.36, ph * 0.12, { t, look: [0, 0], mouth: 0.6, cheer: 0.5 + 0.5 * Math.sin(t * 3) });
  // not yet rendered: tiles still dark, filling left→right, top→bottom
  if (u < 1) {
    const cols = 12, rows = 7, n = Math.floor(u * cols * rows);
    for (let i = n; i < cols * rows; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      ctx.fillStyle = i === n ? 'rgba(13,17,23,0.55)' : '#0d1117';
      ctx.fillRect(x + c * w / cols - 0.5, y + r * h / rows - 0.5, w / cols + 1, h / rows + 1);
    }
  }
  ctx.restore();
}
function player(ctx, t) {
  const { x, y, w, h } = FEAT.player;
  card(ctx, x, y, w, h, { r: 16, fill: '#161b22', sh: 0.75 });
  const vx = x + 12, vy = y + 12, vw = w - 24, vh = vw * 9 / 16;
  const u = t < C.out4 ? 0 : renderU(t);
  miniFilm(ctx, vx, vy, vw, vh, t, u);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; rr(ctx, vx + 0.5, vy + 0.5, vw - 1, vh - 1, 10); ctx.stroke();
  if (u < 1) { // badge: queued / rendering %
    const q = t < C.out4, bw = q ? 92 : 150, bx = q ? vx + vw / 2 - bw / 2 : vx + 14, by = q ? vy + vh / 2 - 18 : vy + vh - 50;
    rr(ctx, bx, by, bw, 36, 18); ctx.fillStyle = 'rgba(1,4,9,0.78)'; ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,252,0.15)'; ctx.stroke();
    if (!q) { ctx.beginPath(); ctx.arc(bx + 18, by + 18, 4, 0, TAU); ctx.fillStyle = Math.floor(t * 3) % 2 ? G.red : '#ff7b72'; ctx.fill(); }
    txt(ctx, q ? 'Queued' : `Rendering ${Math.round(u * 100)}%`, q ? bx + bw / 2 : bx + 30, by + 19, { size: 14, weight: 600, align: q ? 'center' : 'left', base: 'middle' });
  } else { // play button
    const k = sp(t, C.doneRender, 2, 0.5);
    ctx.save(); ctx.translate(vx + vw / 2, vy + vh / 2); ctx.scale(k, k);
    ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#0d1117'; ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(15, 0); ctx.lineTo(-9, 13); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // meta + progress
  const my = vy + vh + 34;
  txt(ctx, 'skills-star-party.mp4', x + 18, my, { size: 17, weight: 600 });
  txt(ctx, '1920×1080 · 60 fps · 0:26', x + w - 18, my, { size: 13, fam: MONO, color: G.muted, align: 'right' });
  const by = my + 20, bw = w - 36;
  rr(ctx, x + 18, by, bw, 8, 4); ctx.fillStyle = '#21262d'; ctx.fill();
  if (u > 0) {
    rr(ctx, x + 18, by, Math.max(8, bw * u), 8, 4);
    const g = ctx.createLinearGradient(x + 18, 0, x + 18 + bw, 0); g.addColorStop(0, G.purpleFg); g.addColorStop(1, G.pink);
    ctx.fillStyle = g; ctx.fill();
    if (u < 1) glow(ctx, x + 18 + bw * u, by + 4, 26, '#db61a2', 0.5);
  }
}

export function draw(ctx, t, y0) {
  ctx.save();
  ctx.translate(0, y0);
  // section light + divider
  for (const [x, y, r, c, k] of [[1080, 430, 700, '#6e40c9', 0.2], [1300, 200, 500, '#1f6feb', 0.12]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, k)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const dg = ctx.createLinearGradient(0, 0, 1560, 0);
  dg.addColorStop(0, 'rgba(240,246,252,0)'); dg.addColorStop(0.5, 'rgba(240,246,252,0.12)'); dg.addColorStop(1, 'rgba(240,246,252,0)');
  ctx.fillStyle = dg; ctx.fillRect(0, 0, 1560, 1);
  left(ctx, t);
  enter(ctx, t, C.cards, () => terminal(ctx, t));
  enter(ctx, t, C.cards + 0.12, () => bible(ctx, t));
  enter(ctx, t, C.cards + 0.24, () => player(ctx, t));
  enter(ctx, t, C.cards + 0.36, () => pipeline(ctx, t));
  ctx.restore();
}
