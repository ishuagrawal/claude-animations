// STATS — one cell per stargazer, as a GitHub contribution-graph card: the cells light up in a
// diagonal wave until the grid is full (the newest one gold; any spare slots dashed "next"), with stat
// cards counting up beside it, and a tooltip on the newest star.
import { C, STARS, FORKS, GRID, cellTime } from '../timeline.js';
import { STATS, cellRect, PANEL } from '../layout.js';
import { clamp, hash, TAU } from '../core.js';
import { sp, smooth, icon, glow } from '../kit.js';
import { rgba, mix } from '../palette.js';
import { G, card, txt, tw, rr, rise, pill, odometer, shadow, noShadow } from '../ui.js';

const LV = ['#0e4429', '#006d32', '#26a641', '#39d353'];
const MONO = '"Monaspace Neon", ui-monospace, monospace';
export const litCount = t => { let n = 0; for (let i = 0; i < STARS; i++) if (t >= cellTime(i)) n++; return n; };

function grid(ctx, t) {
  const { x, y, w, h } = STATS.grid;
  card(ctx, x, y, w, h, { r: 18, fill: '#0f141b', sh: 0.6 });
  icon(ctx, 'starFill', x + 36, y + 42, 20, G.star);
  txt(ctx, 'Stargazers', x + 56, y + 49, { size: 20, weight: 600 });
  txt(ctx, 'ishuagrawal/skills', x + 56 + tw(ctx, 'Stargazers', 20, 600) + 12, y + 49, { size: 14, fam: MONO, color: G.faint });
  const n = litCount(t);
  odometer(ctx, n, x + w - 74, y + 51, { size: 28, weight: 600, color: G.fg, digits: 2 });
  txt(ctx, 'stars', x + w - 28, y + 51, { size: 16, color: G.muted, align: 'right' });
  ctx.fillStyle = 'rgba(240,246,252,0.07)'; ctx.fillRect(x + 1, y + 74, w - 2, 1);
  for (let i = 0; i < GRID.cols * GRID.rows; i++) {
    const r = cellRect(i);
    if (i >= STARS) { // the next one
      ctx.save(); ctx.setLineDash([4, 4]); rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 9);
      const a = 0.35 + 0.25 * Math.sin(t * 4);
      ctx.strokeStyle = rgba('#8b949e', a); ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      icon(ctx, 'plus', r.x + r.w / 2, r.y + r.h / 2, 18, rgba('#8b949e', a));
      continue;
    }
    const t0 = cellTime(i), u = t - t0;
    rr(ctx, r.x, r.y, r.w, r.h, 9); ctx.fillStyle = '#161b22'; ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,252,0.05)'; ctx.lineWidth = 1; ctx.stroke();
    if (u < 0) continue;
    const last = i === STARS - 1;
    const k = sp(t, t0, last ? 1.6 : 2.4, last ? 0.35 : 0.45);
    const base = last ? G.star : LV[Math.floor(hash(i * 7 + 3) * 4)];
    const flash = Math.exp(-u * 5);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(k, k);
    if (flash > 0.05 || last) glow(ctx, 0, 0, r.w * (last ? 1.6 : 1.1), last ? '#e3b341' : '#39d353', (last ? 0.35 : 0.5) * Math.max(flash, last ? 0.6 : 0));
    rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 9); ctx.fillStyle = mix(base, last ? '#fff2c2' : '#7ee787', flash * 0.7); ctx.fill();
    const hg = ctx.createLinearGradient(0, -r.h / 2, 0, r.h / 2);
    hg.addColorStop(0, 'rgba(255,255,255,0.16)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
    icon(ctx, 'starFill', 0, 0, r.w * 0.36, last ? 'rgba(90,50,0,0.55)' : 'rgba(1,4,9,0.28)');
    ctx.restore();
  }
  // legend
  const ly = y + h - 30;
  txt(ctx, 'One cell per star', x + 37, ly + 5, { size: 14, color: G.faint });
  let lx = x + w - 37;
  lx -= txt(ctx, 'More', lx, ly + 5, { size: 14, color: G.faint, align: 'right' }) + 10;
  for (const c of [...LV].reverse().concat('#161b22')) { lx -= 16; rr(ctx, lx, ly - 7, 14, 14, 3); ctx.fillStyle = c; ctx.fill(); lx -= 5; }
  txt(ctx, 'Less', lx - 6, ly + 5, { size: 14, color: G.faint, align: 'right' });
  // tooltip on the newest star
  const ta = smooth((t - C.tip) / 0.18);
  if (ta > 0) {
    const r = cellRect(STARS - 1), cx = r.x + r.w / 2, ty = r.y - 14;
    const label = `Star #${STARS} · just now`;
    const bw = tw(ctx, label, 15, 500) + 52, bh = 36;
    const bx = Math.min(cx - bw / 2, x + w - 10 - bw); // keep the bubble inside the card; the arrow stays on the cell
    ctx.save(); ctx.globalAlpha *= ta; ctx.translate(0, (1 - ta) * 6);
    rr(ctx, bx, ty - bh, bw, bh, 8);
    shadow(ctx, 18, 6, 'rgba(0,0,0,0.5)'); ctx.fillStyle = '#e6edf3'; ctx.fill(); noShadow(ctx);
    ctx.beginPath(); ctx.moveTo(cx - 7, ty); ctx.lineTo(cx, ty + 7); ctx.lineTo(cx + 7, ty); ctx.closePath(); ctx.fill();
    icon(ctx, 'starFill', bx + 22, ty - bh / 2, 15, '#bb8009');
    txt(ctx, label, bx + 36, ty - bh / 2 + 1, { size: 15, weight: 500, color: '#0d1117', base: 'middle' });
    ctx.restore();
  }
}

function statCard(ctx, t, i, iconName, tile, label, value, foot, mini) {
  const { x: x0, y: y0, w, h, gap } = STATS.cards;
  const x = x0 + (i % 2) * (w + gap), y = y0 + Math.floor(i / 2) * (h + gap);
  const k = sp(t, C.stats + 0.25 + i * 0.1, 1.4, 0.7);
  if (k <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6); ctx.translate(0, (1 - k) * 40);
  card(ctx, x, y, w, h, { r: 18, fill: '#161b22', sh: 0.6 });
  rr(ctx, x + 22, y + 22, 44, 44, 11);
  const g = ctx.createLinearGradient(x + 22, y + 22, x + 66, y + 66); g.addColorStop(0, tile[0]); g.addColorStop(1, tile[1]);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  icon(ctx, iconName, x + 44, y + 44, 22, '#ffffff');
  txt(ctx, label, x + 80, y + 50, { size: 17, weight: 500, color: G.muted });
  if (typeof value === 'function') value(x + 22, y + 160);
  else txt(ctx, value, x + 20, y + 160, { size: 64, weight: 500, track: -2 });
  txt(ctx, foot, x + 22, y + 196, { size: 15, color: G.faint });
  if (mini) mini(x, y + 214, w);
  ctx.restore();
}

export function draw(ctx, t, y0) {
  ctx.save();
  ctx.translate(0, y0);
  for (const [x, y, r, c, k] of [[500, 560, 640, '#2ea043', 0.13], [1150, 420, 560, '#6e40c9', 0.16]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, k)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const cx = PANEL.w / 2;
  ctx.save(); const pa = rise(ctx, (t - C.stats + 0.15) / 0.5, 12); pill(ctx, cx, 132, 'COMMUNITY', { t, a: pa, align: 'center', c0: '#2ea043', c1: '#1f6feb' }); ctx.restore();
  ctx.save(); const ha = rise(ctx, (t - C.stats) / 0.6, 18); txt(ctx, 'One square for every stargazer', cx, 210, { size: 62, weight: 500, align: 'center', track: -2, a: ha }); ctx.restore();
  ctx.save(); const sa = rise(ctx, (t - C.stats - 0.1) / 0.6, 14); txt(ctx, `Each lit cell is someone who starred the repo. Thank you, all ${STARS} of you.`, cx, 258, { size: 22, color: G.muted, align: 'center', a: sa }); ctx.restore();
  ctx.save(); const ga = rise(ctx, (t - C.stats - 0.15) / 0.6, 30); ctx.globalAlpha *= ga; grid(ctx, t); ctx.restore();
  const n = litCount(t);
  statCard(ctx, t, 0, 'starFill', ['#e3b341', '#bb8009'], 'Stars', (x, y) => odometer(ctx, n, x + tw(ctx, '00', 64, 500) + 4, y, { size: 64, weight: 500, digits: 2 }), 'and counting', (x, y, w) => {
    // mini bars: stars rising
    for (let b = 0; b < 12; b++) {
      const hh = 6 + 30 * Math.pow((b + 1) / 12, 1.6) * clamp(n / STARS * 1.2 - b / 24);
      rr(ctx, x + 22 + b * ((w - 44) / 12), y + 36 - hh, (w - 44) / 12 - 5, hh, 2); ctx.fillStyle = b === 11 ? G.star : 'rgba(227,179,65,0.35)'; ctx.fill();
    }
  });
  const fk = clamp((t - C.stats - 0.5) / 1.4);
  statCard(ctx, t, 1, 'fork', ['#3fb950', '#1a7f37'], 'Forks', (x, y) => odometer(ctx, (1 - Math.pow(1 - fk, 3)) * FORKS, x + tw(ctx, '00', 64, 500) + 4, y, { size: 64, weight: 500, digits: 2 }), 'remixing the skill', (x, y, w) => {
    ctx.strokeStyle = 'rgba(63,185,80,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 22, y + 22); ctx.lineTo(x + w - 22, y + 22); ctx.stroke();
    for (let b = 0; b < 5; b++) {
      const bx = x + 40 + b * (w - 80) / 4;
      ctx.beginPath(); ctx.moveTo(bx, y + 22); ctx.quadraticCurveTo(bx + 10, y + 6, bx + 26, y + 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, y + 22, 4, 0, TAU); ctx.fillStyle = G.greenFg; ctx.fill();
    }
  });
  statCard(ctx, t, 2, 'law', ['#58a6ff', '#1f6feb'], 'License', 'MIT', 'free and open source', null);
  statCard(ctx, t, 3, 'book', ['#a371f7', '#6e40c9'], 'References', '7', 'guides inside the skill', null);
  ctx.restore();
}
