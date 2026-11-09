// Generated textures. Built once at load from fixed seeds (never per frame), so every frame is deterministic.
import * as THREE from 'three';
import { rng, TAU } from '../core.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Brush map (tileable). R: stroke values around 0.5, G: large soft blotches, B: fine bristle/canvas tooth.
export function strokeTexture(size = 1024, seed = 11) {
  const r = rng(seed);
  const tiled = (ctx, x, y, reach, fn) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (x + ox < -reach || x + ox > size + reach || y + oy < -reach || y + oy > size + reach) continue;
      ctx.save(); ctx.translate(x + ox, y + oy); fn(); ctx.restore();
    }
  };
  // R: overlapping dabs, mostly one direction with scatter
  const cs = mk(size, size), s = cs.getContext('2d');
  s.fillStyle = '#808080'; s.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const x = r() * size, y = r() * size, len = 26 + r() * 74, wid = 7 + r() * 15;
    const a = 0.45 + (r() - 0.5) * 1.5 + (r() < 0.12 ? 1.4 : 0);
    const v = Math.round(128 + (r() - 0.5) * 190), al = 0.35 + r() * 0.5;
    tiled(s, x, y, 80, () => {
      s.rotate(a);
      s.fillStyle = `rgba(${v},${v},${v},${al})`;
      s.beginPath(); s.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU); s.fill();
      // bristle streaks inside the dab
      for (let k = 0; k < 3; k++) {
        const yy = (r() - 0.5) * wid * 0.7, vv = Math.max(0, Math.min(255, v + (r() - 0.5) * 70));
        s.strokeStyle = `rgba(${vv},${vv},${vv},${al * 0.8})`; s.lineWidth = 1 + r() * 1.5;
        s.beginPath(); s.moveTo(-len * 0.42, yy); s.lineTo(len * (0.2 + r() * 0.25), yy + (r() - 0.5) * 2); s.stroke();
      }
    });
  }
  // G: blotches
  const cb = mk(size, size), b = cb.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = r() * size, y = r() * size, rad = 70 + r() * 210, v = r() < 0.5 ? 255 : 0, al = 0.10 + r() * 0.2;
    tiled(b, x, y, rad, () => {
      const g = b.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, `rgba(${v},${v},${v},${al})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      b.fillStyle = g; b.fillRect(-rad, -rad, rad * 2, rad * 2);
    });
  }
  const R = s.getImageData(0, 0, size, size), G = b.getImageData(0, 0, size, size);
  const d = R.data, g = G.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 1] = g[i];
    d[i + 2] = Math.round(128 + (r() - 0.5) * 150 + (((i >> 2) % 3) - 1) * 14);
    d[i + 3] = 255;
  }
  s.putImageData(R, 0, 0);
  const t = new THREE.CanvasTexture(cs);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

// Canvas-drawn colour texture helper (sRGB)
export function canvasTexture(w, h, draw) {
  const c = mk(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
