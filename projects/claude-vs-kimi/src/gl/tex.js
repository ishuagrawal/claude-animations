// Generated textures (built once at load from fixed seeds): star flares, soft glows, moon craters,
// grunge, neon signs and printed labels.
import * as THREE from 'three';
import { rng } from '../core.js';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t; };

// 4-point star flare (reference: cross sparkles at every light source)
export function starTex() {
  const s = 256, c = canvas(s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const spike = (ang, len, w) => {
    x.save(); x.translate(s / 2, s / 2); x.rotate(ang);
    const lg = x.createLinearGradient(0, 0, len, 0);
    lg.addColorStop(0, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg;
    x.beginPath(); x.moveTo(0, -w); x.lineTo(len, 0); x.lineTo(0, w); x.closePath(); x.fill();
    x.restore();
  };
  for (let i = 0; i < 4; i++) spike(i * Math.PI / 2, s * 0.5, s * 0.022);
  for (let i = 0; i < 4; i++) spike(Math.PI / 4 + i * Math.PI / 2, s * 0.17, s * 0.012);
  return tex(c);
}

export function glowTex() {
  const s = 128, c = canvas(s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  return tex(c);
}

// moon surface: maria + craters, gray values (multiplied into the toon colors)
export function moonTex() {
  const w = 1024, h = 512, c = canvas(w, h), x = c.getContext('2d'), r = rng(77);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(90,90,110,${0.18 + r() * 0.2})`;
    x.beginPath(); x.ellipse(r() * w, h * (0.2 + r() * 0.6), 60 + r() * 140, 40 + r() * 80, r() * 3, 0, 7); x.fill();
  }
  for (let i = 0; i < 160; i++) {
    const cx = r() * w, cy = r() * h, rr = 3 + Math.pow(r(), 3) * 40;
    x.fillStyle = 'rgba(60,60,80,0.45)'; x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = Math.max(1, rr * 0.18);
    x.beginPath(); x.arc(cx - rr * 0.12, cy - rr * 0.12, rr, Math.PI * 0.9, Math.PI * 1.7); x.stroke();
  }
  return tex(c);
}

// grunge / scratched paint (multiplied into props, as on the reference's boombox)
export function grungeTex(seed = 5, base = 235) {
  const s = 512, c = canvas(s), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = `rgb(${base},${base},${base})`; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const v = 150 + r() * 90;
    x.strokeStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.35})`; x.lineWidth = 0.6 + r() * 1.6;
    const px = r() * s, py = r() * s, a = r() * 6.28, l = 4 + r() * 30;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  for (let i = 0; i < 3000; i++) {
    const v = 180 + r() * 75; x.fillStyle = `rgba(${v},${v},${v},0.5)`;
    x.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// neon sign: glyphs with a glow, on transparent
export function neonTex(text, color, { font = '700 220px "PingFang SC","Hiragino Sans GB","STHeiti",sans-serif', w = 1024, h = 300, glow = 28 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = glow;
  x.strokeStyle = color; x.lineWidth = 10; x.lineJoin = 'round';
  for (let i = 0; i < 2; i++) x.strokeText(text, w / 2, h / 2);
  x.shadowBlur = glow * 0.5; x.lineWidth = 4; x.strokeStyle = '#ffffff';
  x.strokeText(text, w / 2, h / 2);
  return tex(c);
}

// printed label (flask tags, price tags)
export function labelTex(lines, { w = 512, h = 256, bg = '#f1e6c8', fg = '#1a1630', border = '#1a1630', font = '"Futura","Avenir Next Condensed",sans-serif', sizes = [120, 56], weights = [800, 700], hole = false } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  // paper grain
  const r = rng(w + h);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(80,60,40,${r() * 0.12})`; x.fillRect(r() * w, r() * h, 2, 2); }
  x.strokeStyle = border; x.lineWidth = 10; x.strokeRect(12, 12, w - 24, h - 24);
  if (hole) { x.fillStyle = '#05040c'; x.beginPath(); x.arc(w / 2, 46, 16, 0, 7); x.fill(); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const n = lines.length, step = h / (n + 1);
  lines.forEach((l, i) => {
    x.font = `${weights[i] ?? 700} ${sizes[i] ?? 48}px ${font}`;
    x.fillText(l, w / 2, step * (i + 1) + (hole ? 14 : 0));
  });
  return tex(c);
}

// checker floor tile texture with scuffs (indigo / violet), used as a map
export function checkerTex() {
  const n = 8, s = 1024, c = canvas(s), x = c.getContext('2d'), r = rng(9);
  const cs = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = (i + j) % 2 ? '#2c2f78' : '#12133e';
    x.fillRect(i * cs, j * cs, cs, cs);
  }
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.5 ? 255 : 0;
    x.fillStyle = `rgba(${v},${v},${v},${r() * 0.08})`;
    const px = r() * s, py = r() * s, l = 2 + r() * 18;
    x.fillRect(px, py, l, 1 + r() * 1.5);
  }
  x.strokeStyle = 'rgba(8,8,30,0.6)'; x.lineWidth = 3;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * cs, 0); x.lineTo(i * cs, s); x.stroke(); x.beginPath(); x.moveTo(0, i * cs); x.lineTo(s, i * cs); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
