// Entry point. ?render=1 exposes window.FILM for the offline renderer; otherwise a preview player.
import { W, H, FPS } from './core.js';
import { Engine } from './gl/engine.js';
import { film } from './film.js';

const params = new URLSearchParams(location.search);
const OH = +(params.get('h') || 1080), OW = Math.round(OH * 16 / 9);
const view = document.getElementById('view');
const E = new Engine(view, OW, OH);
window.E = E;
const fonts = Promise.all((film.fonts || []).map(f => document.fonts.load(f).catch(() => 0)));
const blobURL = async (b) => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const blob = (type = 'image/png', q = 1) => new Promise(r => view.toBlob(r, type, q));
if (params.has('render')) {
  window.FILM = {
    ready: fonts.then(() => film.load(E, params)).then(() => true),
    info: () => ({ duration: film.duration, fps: FPS, w: OW, h: OH }),
    async still(t, opt = {}) { await film.prepare(E, t, opt); E.frameNo = Math.round(t * FPS); const cv = film.draw(E, t, opt) || view; if (opt.scale && opt.scale !== 1) { const c = new OffscreenCanvas(Math.round(OW * opt.scale), Math.round(OH * opt.scale)), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, c.width, c.height); return blobURL(await c.convertToBlob({ type: 'image/png' })); } return blobURL(await (cv.convertToBlob ? cv.convertToBlob({ type: 'image/png' }) : blob())); },
    async push(i0, i1, url) { for (let i = i0; i < i1; i++) { const t = i / FPS; await film.prepare(E, t, {}); E.frameNo = i; const cv = film.draw(E, t, {}) || view; const b = await new Promise(r => cv.toBlob ? cv.toBlob(r, 'image/jpeg', 0.985) : cv.convertToBlob({ type: 'image/jpeg', quality: 0.985 }).then(r)); await fetch(url + '?i=' + i, { method: 'POST', body: b }); } return true; },
  };
} else preview();
async function preview() {
  await fonts; await film.load(E, params);
  const scrub = document.getElementById('scrub'), label = document.getElementById('time'), btn = document.getElementById('play'); scrub.max = film.duration; let t = +(params.get('t') || 0), playing = false, last = 0, busy = false;
  const audio = new Audio('out/soundtrack.wav');
  const show = async () => { if (busy) return; busy = true; await film.prepare(E, t, {}); E.frameNo = Math.round(t * FPS); film.draw(E, t, {}); scrub.value = t; label.textContent = t.toFixed(2) + 's'; busy = false; };
  const tick = now => { if (!playing) return; t = audio.readyState > 2 && !audio.paused ? audio.currentTime : t + (now - last) / 1000; last = now; if (t >= film.duration) { t = film.duration - 0.02; playing = false; } show(); requestAnimationFrame(tick); };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); if (playing) { audio.currentTime = t; audio.play().catch(() => 0); requestAnimationFrame(tick); } else audio.pause(); };
  scrub.oninput = () => { playing = false; audio.pause(); t = +scrub.value; show(); };
  addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); btn.click(); } if (e.key === 'ArrowRight') { t += 1 / FPS; show(); } if (e.key === 'ArrowLeft') { t -= 1 / FPS; show(); } });
  show();
}
