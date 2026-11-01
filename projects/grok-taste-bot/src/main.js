// Entry point. ?render=1 exposes window.FILM for the offline renderer; otherwise a preview player.
import { draw, loadManifest, cues, W, H, FPS, DURATION } from './film.js';
import { renderSoundtrack } from './audio.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const render = new URLSearchParams(location.search).has('render');
const base = location.pathname.replace(/[^/]*$/, '');

const ready = (async () => {
  await loadManifest(base);
  await Promise.all([`400 95px "SF Pro Text"`, `500 30px "SF Pro Text"`, `400 28px "SF Pro Text"`, `700 30px "SF Pro Text"`, `800 30px "SF Pro Text"`].map(f => document.fonts.load(f)));
})();

if (render) {
  document.body.classList.add('render');
  const small = document.createElement('canvas');
  window.FILM = {
    ready: false,
    info: () => ({ fps: FPS, duration: DURATION, width: W, height: H }),
    audioWav: () => renderSoundtrack(base, cues()),
    async frame(t, scale = 1) {
      await draw(ctx, t);
      if (scale === 1) return canvas.toDataURL('image/png');
      small.width = Math.round(W * scale); small.height = Math.round(H * scale);
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
      return small.toDataURL('image/png');
    },
  };
  ready.then(() => { window.FILM.ready = true; });
} else {
  let t = 0, playing = true, last = null, busy = false;
  const hud = document.getElementById('hud');
  const tick = async now => {
    if (last !== null && playing) t = (t + (now - last) / 1000) % DURATION;
    last = now;
    if (!busy) {
      busy = true;
      await draw(ctx, t);
      hud.textContent = `${t.toFixed(2)}s / ${DURATION}s · space = play/pause · ←/→ = step · click = scrub`;
      busy = false;
    }
    requestAnimationFrame(tick);
  };
  ready.then(() => requestAnimationFrame(tick));
  addEventListener('keydown', e => {
    if (e.code === 'Space') playing = !playing;
    if (e.code === 'ArrowRight') { playing = false; t = Math.min(DURATION, t + 1 / FPS); }
    if (e.code === 'ArrowLeft') { playing = false; t = Math.max(0, t - 1 / FPS); }
  });
  canvas.addEventListener('click', e => { const r = canvas.getBoundingClientRect(); t = (e.clientX - r.left) / r.width * DURATION; });
}
