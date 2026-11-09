// The monitor's UI: an original, minimal chat window drawn in a 1720x1000 virtual canvas (no screenshots).
// draw(state) is a pure function of the state it is given.
import * as THREE from 'three';
import { clamp, TAU, smooth } from '../core.js';
import { PROMPT, POEM } from '../timeline.js';

export const SW = 1720, SH = 1000;
const INK = '#2b2622', CREAM = '#f4efe5', SIDE = '#ebe5d8', CARD = '#fffdf8', LINE = '#ddd5c5', CORAL = '#d97757', MUTE = '#9a9184';
const SANS = 'InterUI, Inter, system-ui, sans-serif', SERIF = 'Cormorant, Georgia, serif';
export const COL_X = 520, POEM_Y = 372, POEM_LH = 92;       // reply column origin, used to place 3D motes

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function burst(c, x, y, r, rot = 0, col = CORAL) {
  c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = r * 0.26;
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8, l = r * (i % 2 ? 0.72 : 1); c.beginPath(); c.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke(); }
  c.restore();
}

export class Screen {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = SW; this.canvas.height = SH;
    this.c = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.poemW = [];
  }
  // st: { typed (chars of PROMPT in the input), sent 0..1 (prompt flies up into the thread), think 0..1, t (seconds, for pulses),
  //       lines: [0..1 x4] reveal of each poem line, cursor 0..1, blink 0..1, on (screen brightness 0..1) }
  draw(st) {
    const c = this.c, t = st.t ?? 0, sent = st.sent ?? 0;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.fillStyle = CREAM; c.fillRect(0, 0, SW, SH);
    // sidebar
    c.fillStyle = SIDE; c.fillRect(0, 0, 300, SH);
    c.fillStyle = LINE; c.fillRect(300, 0, 2, SH);
    burst(c, 62, 66, 22);
    c.fillStyle = INK; c.font = `500 30px ${SERIF}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('Claude', 98, 68);
    rr(c, 36, 124, 228, 52, 14); c.fillStyle = '#e0d8c8'; c.fill();
    c.fillStyle = INK; c.font = `500 20px ${SANS}`; c.fillText('+  New chat', 60, 151);
    c.fillStyle = MUTE; c.font = `400 17px ${SANS}`; c.fillText('Recents', 40, 226);
    [172, 204, 150, 188, 132, 196, 160].forEach((w, i) => { rr(c, 40, 256 + i * 46, w, 14, 7); c.fillStyle = i === 0 && sent > 0.5 ? '#cfc5b2' : '#dcd4c4'; c.fill(); });
    // main column
    const cx = 300 + (SW - 300) / 2;
    const typed = PROMPT.slice(0, clamp(st.typed ?? 0, 0, PROMPT.length) | 0);
    // input card: centred before sending, docked at the bottom after
    const cardY = 430 + (812 - 430) * smooth(0, 1, sent), cardW = 900, cardH = 150;
    if (sent < 1) {
      c.globalAlpha = 1 - smooth(0.0, 0.6, sent);
      c.fillStyle = INK; c.font = `400 62px ${SERIF}`; c.textAlign = 'center'; c.fillText('Good evening', cx + 30, 318);
      burst(c, cx - 190, 314, 26, t * 0.15);
      c.globalAlpha = 1;
    }
    c.save(); c.shadowColor = 'rgba(60,40,20,0.12)'; c.shadowBlur = 30; c.shadowOffsetY = 8;
    rr(c, cx - cardW / 2, cardY, cardW, cardH, 26); c.fillStyle = CARD; c.fill(); c.restore();
    rr(c, cx - cardW / 2, cardY, cardW, cardH, 26); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
    c.textAlign = 'left'; c.font = `400 34px ${SANS}`;
    const inInput = sent < 0.02;
    if (inInput && typed.length) { c.fillStyle = INK; c.fillText(typed, cx - cardW / 2 + 36, cardY + 52); }
    else { c.fillStyle = '#b5ab9b'; c.fillText(sent > 0.5 ? 'Reply to Claude…' : 'How can I help you today?', cx - cardW / 2 + 36, cardY + 52); }
    if (inInput) {  // caret
      const w = c.measureText(typed).width;
      if (Math.floor(t * 2.2) % 2 === 0 || (st.typing ?? 0)) { c.fillStyle = INK; c.fillRect(cx - cardW / 2 + 38 + w, cardY + 30, 3, 44); }
    }
    const ready = inInput && typed.length === PROMPT.length;
    c.beginPath(); c.arc(cx + cardW / 2 - 50, cardY + cardH - 46, 26, 0, TAU); c.fillStyle = ready ? CORAL : '#e3c3b4'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(cx + cardW / 2 - 50, cardY + cardH - 34); c.lineTo(cx + cardW / 2 - 50, cardY + cardH - 58); c.moveTo(cx + cardW / 2 - 60, cardY + cardH - 48); c.lineTo(cx + cardW / 2 - 50, cardY + cardH - 58); c.lineTo(cx + cardW / 2 - 40, cardY + cardH - 48); c.stroke();
    c.fillStyle = MUTE; c.font = `400 19px ${SANS}`; c.fillText('Claude', cx - cardW / 2 + 36, cardY + cardH - 40);
    // the sent prompt as a bubble in the thread
    if (sent > 0.02) {
      c.font = `400 32px ${SANS}`;
      const w = c.measureText(PROMPT).width + 60, k = smooth(0.1, 1, sent);
      const by = 430 + 26 + (150 - (430 + 26)) * k, bx = cx + cardW / 2 - w;
      c.globalAlpha = smooth(0.02, 0.3, sent);
      rr(c, bx, by, w, 70, 24); c.fillStyle = '#e8e0d0'; c.fill();
      c.fillStyle = INK; c.fillText(PROMPT, bx + 30, by + 36); c.globalAlpha = 1;
    }
    // thinking glyph, then the reply
    const think = st.think ?? 0, lines = st.lines || [];
    if (think > 0.01 || lines.some(v => v > 0)) {
      const pul = 1 + 0.12 * Math.sin(t * 5.2) * think;
      c.globalAlpha = clamp(think + (lines[0] > 0 ? 1 : 0));
      burst(c, COL_X - 70, 300, 24 * pul, t * 1.6 * think);
      c.globalAlpha = 1;
    }
    c.font = `500 60px ${SERIF}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    POEM.forEach((ln, i) => {
      const v = lines[i] ?? 0; if (v <= 0) return;
      const y = POEM_Y + i * POEM_LH, n = ln.length;
      let x = COL_X; this.poemW[i] = c.measureText(ln).width;
      for (let k = 0; k < n; k++) {
        const a = clamp(v * (n + 6) - k) / 1; const ch = ln[k], w = c.measureText(ch).width;
        if (a > 0) { c.globalAlpha = Math.min(1, a); c.fillStyle = a < 1 ? '#b8862f' : INK; c.fillText(ch, x, y + (1 - Math.min(1, a)) * 10); }
        x += w;
      }
      c.globalAlpha = 1;
    });
    this.tex.needsUpdate = true;
  }
  // virtual pixel -> uv (0..1, y up)
  static uv(x, y) { return [x / SW, 1 - y / SH]; }
}
