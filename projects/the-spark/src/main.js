// Entry point. ?render=1 exposes window.FILM for the offline renderer; otherwise a preview player.
// Picture: Three.js painted scene -> post pipeline (2.39:1) -> letterboxed 16:9 canvas + 2D titles.
import * as THREE from 'three';
import { W, H, FPS } from './core.js';
import { Pipeline } from './gl/post.js';
import { LOOK } from './gl/paint.js';
import { FXU } from './gl/fx.js';
import { strokeTexture } from './gl/tex.js';
import { film } from './film.js';

export const GW = 1920, GH = 804, BAR_Y = (H - GH) / 2;
const glc = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
LOOK.uStroke.value = strokeTexture();
const pipe = new Pipeline(renderer, GW, GH);
const out = document.createElement('canvas');
const octx = out.getContext('2d', { alpha: false });

function draw(t, s = 1) {
  pipe.setScale(s);
  const w = Math.round(W * s), h = Math.round(H * s);
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  FXU.uTime.value = t;
  const f = film.draw(t, { renderer, aspect: GW / GH });
  pipe.render(f.scene, f.camera, { ...f.post, seed: (Math.floor(t * FPS + 1e-6) % 997) * 0.731 });
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.fillStyle = '#000'; octx.fillRect(0, 0, w, h);
  octx.drawImage(glc, 0, Math.round(BAR_Y * s), w, Math.round(GH * s));
  if (f.overlay) { octx.save(); octx.setTransform(s, 0, 0, s, 0, 0); f.overlay(octx, t); octx.restore(); }
  return out;
}

const params = new URLSearchParams(location.search);
const ready = document.fonts.ready.then(() => film.load({ renderer })).then(() => true);
if (params.has('render')) {
  window.FILM = {
    ready,
    info: () => ({ duration: film.duration, fps: FPS, w: W, h: H }),
    frame(t, s = 1) { return draw(t, s).toDataURL('image/png'); },
    timing(t, s = 1) { const t0 = performance.now(); draw(t, s); const g = renderer.getContext(); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4)); return performance.now() - t0; },
    async audioWav() {
      const { renderSoundtrack, toWav } = await import('./audio/score.js');
      const buf = await renderSoundtrack(film.duration);
      const bytes = toWav(buf);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
} else preview();

async function preview() {
  await ready;
  const view = document.getElementById('view'), vctx = view.getContext('2d');
  const scrub = document.getElementById('scrub'), tlabel = document.getElementById('time'), playBtn = document.getElementById('play');
  const ps = +(params.get('scale') || 0.5);
  scrub.max = film.duration;
  let t = +(params.get('t') || 0), playing = false, ac = null, src = null, buffer = null, t0 = 0, startAt = 0;
  const show = () => { vctx.drawImage(draw(t, ps), 0, 0, view.width, view.height); scrub.value = t; tlabel.textContent = t.toFixed(2) + 's  f' + Math.floor(t * FPS); };
  const stop = () => { playing = false; src?.stop(); src = null; playBtn.textContent = 'Play'; };
  const play = async () => {
    if (!buffer) { playBtn.textContent = 'Rendering audio…'; const { renderSoundtrack } = await import('./audio/score.js'); buffer = await renderSoundtrack(film.duration); }
    ac = ac || new AudioContext();
    src = ac.createBufferSource(); src.buffer = buffer; src.connect(ac.destination);
    startAt = t; t0 = ac.currentTime; src.start(0, t);
    playing = true; playBtn.textContent = 'Pause';
    const tick = () => { if (!playing) return; t = startAt + (ac.currentTime - t0); if (t >= film.duration) { t = film.duration - 1 / FPS; stop(); } show(); requestAnimationFrame(tick); };
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
