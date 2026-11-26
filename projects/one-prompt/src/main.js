import { CALM } from './calm.js';
// ?render=1 exposes window.FILM for the offline renderer; otherwise a preview player.
import { W, H, FPS } from './core.js';
import { Post } from './post.js';
import { film } from './film.js';
import { overlay } from './overlay.js';
const SS = 1.5, scene = document.createElement('canvas'); scene.width = W * SS; scene.height = H * SS; const sctx = scene.getContext('2d', { alpha: false });
const post = new Post(W, H), out = document.createElement('canvas'); out.width = W; out.height = H; const octx = out.getContext('2d', { alpha: false });
function draw(t, n) {
  post.begin(); let fx = {}; const N = Math.max(1, n > 1 && film.blur ? film.blur(t, n) : n);
  for (let i = 0; i < N; i++) { const ts = Math.max(0, t + (N > 1 ? ((i + 0.5) / N - 0.5) * 0.5 / FPS : 0)); sctx.setTransform(SS, 0, 0, SS, 0, 0); sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over'; sctx.filter = 'none'; sctx.shadowColor = 'transparent'; fx = film.draw(sctx, ts) || {}; post.add(scene, 1 / N); }
  octx.drawImage(post.end({ seed: (Math.floor(t * 15) % 97) * 0.731, ...fx, bloom: (fx.bloom ?? 0.2) * CALM.bloom, sat: (fx.sat ?? 1) * CALM.sat, ca: 0 }), 0, 0); overlay(octx, t); return out;
}
const q = new URLSearchParams(location.search);
if (q.has('render')) { const s = document.createElement('canvas'); window.FILM = { ready: document.fonts.ready.then(() => true), info: () => ({ duration: film.duration, fps: FPS, w: W, h: H }), frame(t, k = 1, n = 4) { const c = draw(t, n); if (k === 1) return c.toDataURL('image/png'); s.width = Math.round(W * k); s.height = Math.round(H * k); const x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, s.width, s.height); return s.toDataURL('image/png'); } }; }
else document.fonts.ready.then(() => { const v = document.getElementById('view').getContext('2d'), s = document.getElementById('scrub'), l = document.getElementById('time'), b = document.getElementById('play'); s.max = film.duration; let t = +(q.get('t') || 0), on = false, t0, a; const show = () => { v.drawImage(draw(t, 1), 0, 0); s.value = t; l.textContent = t.toFixed(2); }, tick = () => { if (!on) return; t = a + (performance.now() - t0) / 1000; if (t > film.duration) { on = false; return; } show(); requestAnimationFrame(tick); }; b.onclick = () => { on = !on; a = t; t0 = performance.now(); tick(); }; s.oninput = () => { on = false; t = +s.value; show(); }; show(); });
