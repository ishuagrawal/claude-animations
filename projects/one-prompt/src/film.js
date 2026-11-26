// Assembles the acts. ?act=a,b limits loading for authors. Acts export draw(x, t) -> post params, optional samples(t, n), optional ready().
import { C, SEGMENTS, SEAM } from './timeline.js';
import { clamp, ease } from './core.js';
import { hud } from './hud.js';
const only = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('act') : null, segs = SEGMENTS.filter(s => !only || only.split(',').includes(s[0])), mods = {};
await Promise.all([...new Set(segs.map(s => s[0]))].map(async n => { try { mods[n] = await import(`./acts/${n}.js`); } catch (e) { console.log('act missing:', n, e.message); } }));
const live = segs.filter(s => mods[s[0]]); let buf = null;
const at = t => { const on = live.filter(s => t >= s[1] && t < s[2]); return on.length ? on : [live.reduce((a, b) => (Math.min(Math.abs(b[1] - t), Math.abs(b[2] - t)) < Math.min(Math.abs(a[1] - t), Math.abs(a[2] - t)) ? b : a))]; };
export const film = {
  duration: only ? Math.max(...live.map(s => s[2])) : C.end,
  blur: (t, n) => Math.max(...at(t).map(s => mods[s[0]].samples?.(t, n) ?? n)),
  draw(x, t) {
    const on = at(t), a = on[0], b = on[1]; x.save(); const fa = mods[a[0]].draw(x, t) || {}; x.restore(); if (!b) { if (!only) { x.save(); hud(x, t); x.restore(); } return fa; }
    const k = ease.io2(clamp((t - b[1]) / SEAM)); buf ??= new OffscreenCanvas(x.canvas.width, x.canvas.height); const g = buf.getContext('2d'); g.setTransform(x.getTransform()); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.save(); const fb = mods[b[0]].draw(g, t) || {}; g.restore(); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = k; x.drawImage(buf, 0, 0); x.restore(); if (!only) { x.save(); hud(x, t); x.restore(); } const o = {}; new Set([...Object.keys(fa), ...Object.keys(fb)]).forEach(q => { const u = fa[q], v = fb[q]; o[q] = typeof u === 'number' && typeof v === 'number' ? u + (v - u) * k : k > 0.5 ? v ?? u : u ?? v; }); return o;
  },
};
