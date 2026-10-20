// Renders the whole party room (wall + props + Claude + light) in one look, in 1920×1080 local space under the
// caller's transform. The pixel look is drawn at 240×135: background and sprites in separate buffers, both
// palette-locked, sprites get a 1 px ink outline, then everything is upscaled with nearest-neighbour.
import { P, rgba } from './palette.js';
import { wall, renderPrims, PIXEL_PALETTE } from './looks.js';
import { partyPrims, SPOT } from './party.js';
import { claude } from './claude.js';


const PXW = 240, PXH = 135;
const bufs = {};
function buf(name) {
  if (!bufs[name]) { const c = new OffscreenCanvas(PXW, PXH); bufs[name] = [c, c.getContext('2d', { willReadFrequently: true })]; }
  const [c, x] = bufs[name];
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, PXW, PXH); x.imageSmoothingEnabled = false;
  x.setTransform(PXW / 1920, 0, 0, PXH / 1080, 0, 0);
  return [c, x];
}
const PAL = PIXEL_PALETTE.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const OUT = [0x1d, 0x1d, 0x22];

// snap every pixel to the palette; sprites (outline=true) also get a 1 px ink outline around their alpha mask
function quantize(x, outline = false) {
  x.setTransform(1, 0, 0, 1, 0, 0);
  const img = x.getImageData(0, 0, PXW, PXH), d = img.data;
  const solid = new Uint8Array(PXW * PXH);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    let best = 0, bd = 1e9;
    for (let k = 0; k < PAL.length; k++) {
      const dr = d[i] - PAL[k][0], dg = d[i + 1] - PAL[k][1], db = d[i + 2] - PAL[k][2];
      const dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dd < bd) { bd = dd; best = k; }
    }
    d[i] = PAL[best][0]; d[i + 1] = PAL[best][1]; d[i + 2] = PAL[best][2]; d[i + 3] = 255;
    solid[p] = 1;
  }
  if (outline) {
    for (let y = 0; y < PXH; y++) for (let xx = 0; xx < PXW; xx++) {
      const p = y * PXW + xx;
      if (solid[p]) continue;
      if ((xx > 0 && solid[p - 1]) || (xx < PXW - 1 && solid[p + 1]) || (y > 0 && solid[p - PXW]) || (y < PXH - 1 && solid[p + PXW])) {
        const i = p * 4; d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255;
      }
    }
  }
  x.putImageData(img, 0, 0);
}

// o: { builds, claude: pose for claude() (x, y, s, …) or null, extra(ctx) }
export function renderRoom(ctx, t, look, o = {}) {
  if (look === 'pixel') {
    const [bg, bx] = buf('bg');
    drawRoom(bx, t, 'pixel', o, 'bg');
    quantize(bx);
    const [fg, fx] = buf('fg');
    drawRoom(fx, t, 'pixel', o, 'fg');
    quantize(fx, true);
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.drawImage(fg, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0, 1920, 1080);
    ctx.restore();
    return;
  }
  drawRoom(ctx, t, look, o);
}

// layer: 'all' | 'bg' (wall + strings) | 'fg' (props + Claude), the split is only used by the pixel look
function drawRoom(ctx, t, lookName, o, layer = 'all') {
  const look = lookName === 'finale' ? 'soft' : lookName;
  const prims = partyPrims(t, o.builds || {}, o);
  if (layer !== 'fg') wall(ctx, lookName, { cx: SPOT.cx, cy: SPOT.cy, t });
  // lamp light pool on the wall: behind the props
  const lampOn = (o.builds?.lamp ?? 1) >= 1;
  if (layer === 'all' && lampOn && (look === 'soft' || look === 'neon')) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(300, 500, 0, 300, 500, 330);
    const col = look === 'soft' ? '#fff0b8' : P.neonPink;
    g.addColorStop(0, rgba(col, look === 'soft' ? 0.55 : 0.25)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 150, 700, 700);
    ctx.restore();
  }
  const strings = p => p.role === 'string';
  renderPrims(ctx, layer === 'all' ? prims : prims.filter(p => (layer === 'bg') === strings(p)), lookName, t);
  if (layer === 'bg') return;
  if (o.claude) {
    const pose = { style: look === 'pixel' ? 'flat' : look, t, ...o.claude };
    if (look === 'pixel' && pose.eyes !== 'closed') pose.eyes = 'open'; // 3 px eyes: keep them plain squares on the grid
    claude(ctx, pose);
  }
  // flame glows
  if ((o.builds?.flames ?? 1) > 0 && (o.builds?.candles ?? 1) >= 1 && look !== 'pixel' && look !== 'ink') {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const x of [1163, 1259]) {
      const g = ctx.createRadialGradient(x, 352, 0, x, 352, 120);
      const col = look === 'neon' ? P.neonGold : '#ffcf6a';
      g.addColorStop(0, rgba(col, 0.5 * (o.builds?.flames ?? 1))); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - 120, 232, 240, 240);
    }
    ctx.restore();
  }
  if (o.extra) o.extra(ctx);
}
