// 2D overlay: captions only (the narration script, until the voice exists).
import { LINES, CAPTIONS } from './timeline.js';
import { clamp } from './core.js';
import { subs } from './subs.js';
const FONT = '"SF Pro Rounded", "SF Compact Rounded", ui-rounded, sans-serif';
export function overlay(x, t) {
  subs(x, t);
  if (!CAPTIONS) return; const l = LINES.find(q => q.s && t >= q.t && t < q.end + q.hold); if (!l) return;
  const a = clamp((t - l.t) / 0.22) * (1 - clamp((t - l.end - l.hold + 0.18) / 0.18)); x.save(); x.globalAlpha = a; x.font = `600 36px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const rows = [], max = 1240; const wrap = m => { const o = []; let c = ''; l.s.split(' ').forEach(w => { const n = c ? c + ' ' + w : w; if (x.measureText(n).width > m && c) { o.push(c); c = w; } else c = n; }); o.push(c); return o; };
  let r = wrap(max); if (r.length > 1) for (let m = max; m > 500; m -= 30) { const q = wrap(m); if (q.length > r.length) break; r = q; }
  const g = x.createLinearGradient(0, 850, 0, 1080); g.addColorStop(0, 'rgba(4,2,24,0)'); g.addColorStop(1, 'rgba(4,2,24,0.72)'); x.fillStyle = g; x.fillRect(0, 850, 1920, 230);
  x.shadowColor = 'rgba(4,2,24,0.9)'; x.shadowBlur = 16; x.fillStyle = '#fff'; r.forEach((s, i) => x.fillText(s, 960, 1022 - (r.length - 1 - i) * 47)); x.restore();
}
