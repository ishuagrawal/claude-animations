// Subtitles: the whole phrase is visible so the eye can read ahead; the word being spoken brightens and a short warm
// underline glides beneath it. Phrases follow the sentence (break at . ? ! ; : and dashes, or after ~62 characters),
// at most two balanced lines. Timing comes from the measured narration (src/vo_words.js).
import { LINES, C } from './timeline.js';
import { WORDS } from './vo_words.js';
import { rr, text, tw, clamp, lerp, ease } from './ink.js';

const FS = 38, LH = 50, MAXW = 1180, CACHE = {};
const lineOf = t => LINES.find(l => l.s && t >= l.t - 0.12 && t < l.end + Math.min(l.hold, 0.6));
function prep(l) {
  if (CACHE[l.id]) return CACHE[l.id];
  const w = l.s.split(/\s+/), st = WORDS[l.id] && WORDS[l.id].length === w.length ? WORDS[l.id] : w.map((_, i) => (i / w.length) * (l.end - l.t));
  // sentences first, then split long ones at the comma or dash nearest the middle, then at the middle word
  const idx = w.map((_, i) => i), len = ix => ix.filter(j => w[j] !== '—').map(j => w[j]).join(' ').length, sent = []; let cur = [];
  idx.forEach(i => { cur.push(i); if (/[.?!;:]$/.test(w[i])) { sent.push(cur); cur = []; } }); if (cur.length) sent.push(cur);
  const split = ix => { if (len(ix) <= 60) return [ix]; const L = len(ix); let best = -1, bd = 1e9, acc = 0;
    ix.forEach((j, k) => { acc += w[j].length + 1; if (k < ix.length - 1 && (/[,—]$/.test(w[j]) || w[j] === '—' || w[ix[k + 1]] === '—')) { const d = Math.abs(acc - L / 2); if (d < bd && acc > 14 && L - acc > 14) { bd = d; best = k; } } });
    if (best < 0) { acc = 0; ix.forEach((j, k) => { acc += w[j].length + 1; const d = Math.abs(acc - L / 2); if (k < ix.length - 1 && d < bd) { bd = d; best = k; } }); }
    return [...split(ix.slice(0, best + 1)), ...split(ix.slice(best + 1))]; };
  const ph = sent.flatMap(split).map(ix => ix.filter(j => w[j] !== '—')).filter(ix => ix.length);
  // join very short neighbours (e.g. "Not quite.") with the next phrase when they fit
  for (let i = 0; i < ph.length - 1; i++) if (len(ph[i]) < 16 && len(ph[i]) + len(ph[i + 1]) < 64) { ph[i] = ph[i].concat(ph[i + 1]); ph.splice(i + 1, 1); i--; }
  return (CACHE[l.id] = { w, st, ph: ph.map(ix => ({ ix, t0: l.t + st[ix[0]] })) });
}
function rows(x, w, ix) {
  const sp = tw(x, ' ', FS, { w: 600 }), m = ix.map(j => ({ j, ww: tw(x, w[j], FS, { w: 600 }) })), tot = m.reduce((a, q) => a + q.ww + sp, -sp);
  if (tot <= MAXW) return { r: [m], sp };
  let acc = 0, k = 0; for (; k < m.length; k++) { if (acc + m[k].ww > tot / 2) break; acc += m[k].ww + sp; }
  k = Math.max(1, Math.min(m.length - 1, k)); return { r: [m.slice(0, k), m.slice(k)], sp };
}
export function subs(x, t) {
  const l = lineOf(t); if (!l) return; const P = prep(l); let pi = 0; P.ph.forEach((p, i) => { if (t >= p.t0 - 0.1) pi = i; });
  const p = P.ph[pi], nx = P.ph[pi + 1], tEnd = nx ? nx.t0 - 0.1 : l.end + Math.min(l.hold, 0.6);
  const a = ease.out2(clamp((t - p.t0 + 0.14) / 0.2)) * (1 - ease.in2(clamp((t - tEnd + 0.14) / 0.14))); if (a <= 0.01) return;
  let cw = -1; p.ix.forEach(j => { if (t >= l.t + P.st[j] - 0.04) cw = j; });
  const { r, sp } = rows(x, P.w, p.ix), widths = r.map(q => q.reduce((s, o) => s + o.ww + sp, -sp)), W = Math.max(...widths) + 72, H = r.length * LH + 30, X = 960 - W / 2, Y = 1080 - 40 - H;
  x.save(); x.globalAlpha *= a; x.translate(0, (1 - a) * 6);
  x.save(); x.shadowColor = 'rgba(6,3,26,0.45)'; x.shadowBlur = 22 * x.getTransform().a; x.shadowOffsetY = 4 * x.getTransform().a; x.fillStyle = 'rgba(16,10,44,0.74)'; x.fill(rr(X, Y, W, H, 20)); x.restore();
  x.strokeStyle = 'rgba(220,212,255,0.14)'; x.lineWidth = 1.5; x.stroke(rr(X + 0.75, Y + 0.75, W - 1.5, H - 1.5, 19.5));
  let hi = null;
  r.forEach((row, ri) => { let px = 960 - widths[ri] / 2; const py = Y + 15 + LH / 2 + ri * LH;
    row.forEach(({ j, ww }) => { const now = j === cw, said = cw >= 0 && j < cw; text(x, P.w[j], px, py, now ? '#ffffff' : said ? 'rgba(238,233,255,0.9)' : 'rgba(206,198,240,0.6)', FS, { w: 600, align: 'left' }); if (now) hi = { px, py, ww, j }; px += ww + sp; }); });
  if (hi) { const k = ease.out3(clamp((t - l.t - P.st[hi.j] + 0.04) / 0.16)); x.fillStyle = 'rgba(255,208,128,0.92)'; x.fill(rr(hi.px, hi.py + FS * 0.6, Math.max(3, hi.ww * k), 3.5, 1.75)); }
  x.restore();
}
