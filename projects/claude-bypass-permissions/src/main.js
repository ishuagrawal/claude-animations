// Entry point. ?render=1 exposes window.FILM for the offline renderer; otherwise a preview player.
import { W, H, FPS } from './core.js';
import { Post } from './post.js';
import { film } from './film.js';
import { renderSoundtrack, toWav } from './audio/score.js';

const SS = 1.25; // supersample the flat art before the lens pass
const scene = document.createElement('canvas');
scene.width = Math.round(W * SS); scene.height = Math.round(H * SS);
const sctx = scene.getContext('2d', { alpha: false });
const post = new Post(W, H);

function draw(t) {
  sctx.setTransform(SS, 0, 0, SS, 0, 0);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
  const fx = film.draw(sctx, t) || {};
  return post.run(scene, { seed: (Math.floor(t * FPS / 2) % 997) * 0.731, ...fx });
}

const params = new URLSearchParams(location.search);
if (params.has('render')) {
  const small = document.createElement('canvas');
  window.FILM = {
    ready: document.fonts.ready.then(() => film.load?.()).then(() => true),
    info: () => ({ duration: film.duration, fps: FPS, w: W, h: H }),
    frame(t, scale = 1) {
      const out = draw(t);
      if (scale === 1) return out.toDataURL('image/png');
      small.width = Math.round(W * scale); small.height = Math.round(H * scale);
      const c = small.getContext('2d');
      c.imageSmoothingQuality = 'high';
      c.drawImage(out, 0, 0, small.width, small.height);
      return small.toDataURL('image/png');
    },
    async audioWav() {
      const buf = await renderSoundtrack(film.duration);
      const bytes = toWav(buf);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
} else {
  preview();
}

async function preview() {
  await document.fonts.ready;
  await film.load?.();
  const view = document.getElementById('view');
  const vctx = view.getContext('2d');
  const scrub = document.getElementById('scrub');
  const tlabel = document.getElementById('time');
  const playBtn = document.getElementById('play');
  scrub.max = film.duration;
  let t = +(params.get('t') || 0), playing = false, actx = null, src = null, buffer = null, t0 = 0, startAt = 0;
  const show = () => {
    vctx.drawImage(draw(t), 0, 0, view.width, view.height);
    scrub.value = t;
    tlabel.textContent = t.toFixed(2) + 's  f' + Math.floor(t * FPS);
  };
  const stop = () => { playing = false; src?.stop(); src = null; playBtn.textContent = 'Play'; };
  const play = async () => {
    if (!buffer) { playBtn.textContent = 'Rendering audio…'; buffer = await renderSoundtrack(film.duration); }
    actx = actx || new AudioContext();
    src = actx.createBufferSource(); src.buffer = buffer; src.connect(actx.destination);
    startAt = t; t0 = actx.currentTime; src.start(0, t);
    playing = true; playBtn.textContent = 'Pause';
    const tick = () => {
      if (!playing) return;
      t = startAt + (actx.currentTime - t0);
      if (t >= film.duration) { t = film.duration - 1 / FPS; stop(); }
      show();
      requestAnimationFrame(tick);
    };
    tick();
  };
  playBtn.onclick = () => (playing ? stop() : play());
  scrub.oninput = () => { stop(); t = +scrub.value; show(); };
  addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
    if (e.key === 'ArrowRight') { stop(); t = Math.min(film.duration, t + 1 / FPS); show(); }
    if (e.key === 'ArrowLeft') { stop(); t = Math.max(0, t - 1 / FPS); show(); }
  });
  show();
}
