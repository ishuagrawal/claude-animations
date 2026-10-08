// Painted background plates, generated once at load (see paint.js). Each location is split into
// parallax layers (sky / far / mid / near / front) so shots can pan with depth.
import { OC, dab, stroke, leafClump, tree, treeline, grassField, cumulus, wisps, mountains, rock, strata, skyPlate, pebbles, flowers, fbm } from './paint.js';
import { mix, rgba, P } from './palette.js';
import { rng, TAU, lerp } from './core.js';

export const PL = {};
const PW = 2400, PH = 1080;

const FOLIAGE = {
  dark: '#1f5a3a', mid: '#3f8a46', lit: '#7cc04e', hi: '#c8ec7a', deep: '#123826',
  bark: '#5a3a2a', barkLit: '#9a6a44',
};
const hazed = (pal, k, hz) => Object.fromEntries(Object.entries(pal).map(([n, c]) => [n, mix(c, hz, k)]));

function cloudPal(warm = 0) {
  return warm
    ? { sh: '#c98a8a', mid: '#f2b49a', lit: '#ffe2c4', rim: '#fff4e0', sh2: '#9a6a8a' }
    : { sh: '#9fb6cc', mid: '#dce8f0', lit: '#ffffff', rim: '#ffffff', sh2: '#7d97b8' };
}

// ---------------------------------------------------------------- the codebase land vista
function vista() {
  const HZ = '#cfe8ee';
  { // sky
    const [c, x] = OC(PW, PH);
    skyPlate(x, PW, PH, [[0, '#1170b0'], [0.35, '#2f9fcf'], [0.62, '#8fcfe0'], [0.72, HZ]], 3);
    wisps(x, 0, 120, PW, 260, 30, 5, '#ffffff', 0.5);
    cumulus(x, 380, 470, 620, 300, 11, cloudPal());
    cumulus(x, 1300, 380, 520, 240, 12, cloudPal());
    cumulus(x, 2050, 500, 700, 320, 13, cloudPal());
    cumulus(x, 900, 560, 380, 150, 14, cloudPal());
    PL.vistaSky = c;
  }
  { // far snowy range
    const [c, x] = OC(PW, PH);
    mountains(x, -50, 640, PW + 100, 330, 21, { top: '#5a86b8', bottom: '#8fb6d0', lit: '#b7d2e6', gully: '#3e6290', haze: HZ, snow: '#f4f8ff' }, { peaks: 9, snow: true, hazeA: 0.85 });
    PL.vistaFar = c;
  }
  { // mid range + forest + mesas + river + stadium
    const [c, x] = OC(PW, PH);
    mountains(x, -50, 720, PW + 100, 220, 23, { top: '#4f8a78', bottom: '#7aa890', lit: '#9cc6a0', gully: '#2f5a50', haze: HZ }, { peaks: 7, hazeA: 0.55, forest: hazed(FOLIAGE, 0.45, HZ) });
    // meadow plain
    grassField(x, 0, 712, PW, 120, { far: mix('#8cc06a', HZ, 0.4), near: '#7ab858', sun: '#c8e88a', shade: '#4a8a4a', dark: '#5a9a4a', mid: '#82bc5c', lit: '#a8d878' }, 31, { blade: 6, density: 0.6 });
    // river winding toward the horizon
    const riv = [[1700, 712], [1600, 735], [1720, 760], [1500, 800], [1640, 840]];
    for (let i = 0; i < riv.length - 1; i++) stroke(x, [riv[i], riv[i + 1]], lerp(6, 40, i / riv.length), lerp(8, 50, (i + 1) / riv.length), '#7fc8e8');
    for (let i = 0; i < riv.length - 1; i++) stroke(x, [[riv[i][0] + 4, riv[i][1]], [riv[i + 1][0] + 6, riv[i + 1][1]]], 2, 4, '#e8fbff', 0.8);
    // folder mesas (plateaus with a tab), painted
    const mesaPl = (mx, my, w, h, label, seed) => {
      const tab = w * 0.36, tabH = h * 0.14, d = w * 0.1;
      rock(x, [[mx, my], [mx + w, my], [mx + w + w * 0.05, my + h], [mx - w * 0.05, my + h]], { mid: '#c08a5a', lit: '#e8b47a', dark: '#8a5a3a', crack: '#6a3e26', edge: '#ffd8a0' }, seed, { cracks: 5, cy: -h * 0.2 });
      rock(x, [[mx + w, my], [mx + w + d, my - d * 0.5], [mx + w + d + w * 0.04, my + h - d * 0.5], [mx + w + w * 0.05, my + h]], { mid: '#8a5a3a', lit: '#9a6a44', dark: '#6a4028', crack: '#4a2a18', edge: '#b07a50' }, seed + 1, { cracks: 1 });
      x.fillStyle = '#6aaa4a';
      x.beginPath(); x.moveTo(mx - 3, my + 3); x.lineTo(mx + d * 0.2, my - d * 0.45); x.lineTo(mx + d * 0.2, my - d * 0.45 - tabH); x.lineTo(mx + d * 0.2 + tab, my - d * 0.45 - tabH); x.lineTo(mx + d * 0.2 + tab + tabH, my - d * 0.45); x.lineTo(mx + w + d, my - d * 0.5); x.lineTo(mx + w + 3, my + 3); x.closePath(); x.fill();
      x.fillStyle = '#9ad06a'; x.fillRect(mx + d * 0.2 + 3, my - d * 0.45 - tabH + 2, tab - 6, tabH * 0.35);
      treeline(x, mx, mx + w, my + 6, h * 0.12, FOLIAGE, seed + 3, 2);
      x.font = `800 ${Math.round(h * 0.16)}px "SF Mono", Menlo, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.globalAlpha = 0.75; x.fillStyle = '#fff2d8'; x.fillText(label, mx + w / 2, my + h * 0.5); x.globalAlpha = 1;
    };
    mesaPl(520, 660, 220, 110, 'docs/', 41);
    mesaPl(1080, 690, 300, 150, 'tests/', 42);
    // far stadium on the horizon (the dream)
    const sx = 1900, sy = 700;
    x.fillStyle = mix('#e8e0d0', HZ, 0.25); x.beginPath(); x.ellipse(sx, sy, 150, 40, 0, Math.PI, TAU); x.lineTo(sx + 140, sy + 30); x.lineTo(sx - 140, sy + 30); x.closePath(); x.fill();
    x.fillStyle = mix('#b8ab98', HZ, 0.25); x.fillRect(sx - 140, sy, 280, 30);
    for (let i = -5; i <= 5; i++) { x.fillStyle = mix('#9a8f80', HZ, 0.3); x.fillRect(sx + i * 26 - 3, sy + 4, 6, 26); }
    for (const s of [-1, 1]) { x.fillStyle = mix('#8a8070', HZ, 0.3); x.fillRect(sx + s * 120 - 2, sy - 70, 4, 70); x.fillStyle = '#fffbe8'; x.fillRect(sx + s * 120 - 12, sy - 78, 24, 10); }
    treeline(x, -20, PW + 20, 790, 34, hazed(FOLIAGE, 0.15, HZ), 51, 1.3);
    PL.vistaMid = c;
  }
  { // near meadow + trees + big mesa src/
    const [c, x] = OC(PW, PH);
    grassField(x, 0, 800, PW, 300, { far: '#6aae4a', near: '#3f8a3a', sun: '#b8e070', shade: '#2f6a3a', dark: '#2f7a3a', mid: '#5aa44a', lit: '#9ad46a' }, 61, { blade: 30 });
    flowers(x, 0, 860, PW, 220, 120, 62);
    const sp = { dark: '#7a4a2e', mid: '#c08a5a', lit: '#eebc80', crack: '#5a3420', edge: '#ffe0a8' };
    const mx = 1250, my = 740, w = 420, h = 230;
    rock(x, [[mx, my], [mx + w, my], [mx + w + 24, my + h], [mx - 20, my + h]], sp, 71, { cracks: 9, moss: FOLIAGE });
    rock(x, [[mx + w, my], [mx + w + 60, my - 30], [mx + w + 84, my + h - 30], [mx + w + 24, my + h]], { ...sp, mid: '#8a5a3a', lit: '#a06a44' }, 72, { cracks: 2 });
    x.fillStyle = '#5aa44a'; x.beginPath(); x.moveTo(mx - 4, my + 4); x.lineTo(mx + 12, my - 26); x.lineTo(mx + 12, my - 56); x.lineTo(mx + 170, my - 56); x.lineTo(mx + 200, my - 26); x.lineTo(mx + w + 60, my - 30); x.lineTo(mx + w + 4, my + 4); x.closePath(); x.fill();
    x.fillStyle = '#9ad46a'; x.fillRect(mx + 18, my - 54, 146, 8);
    treeline(x, mx, mx + w + 40, my + 8, 30, FOLIAGE, 73, 2);
    x.font = `800 ${Math.round(h * 0.2)}px "SF Mono", Menlo, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,240,215,0.8)'; x.fillText('src/', mx + w / 2, my + h * 0.48);
    tree(x, 1060, 900, 300, FOLIAGE, 81); tree(x, 1900, 880, 340, FOLIAGE, 82); tree(x, 2250, 920, 280, FOLIAGE, 83); tree(x, 760, 930, 240, FOLIAGE, 84);
    PL.vistaNear = c;
  }
  { // the cliff ledge Claude stands on (foreground, bottom-left)
    const [c, x] = OC(PW, PH);
    const lp = [[-40, 800], [300, 770], [620, 760], [880, 790], [960, 860], [920, 980], [980, 1100], [-40, 1100]];
    rock(x, lp, { mid: '#a87a52', lit: '#d8aa74', dark: '#6a4630', crack: '#4a2e1e', edge: '#ffdca0' }, 91, { cracks: 14, cy: -60 });
    rock(x, [[620, 860], [760, 830], [900, 880], [930, 1000], [700, 1010]], { mid: '#8a5e40', lit: '#b88a5c', dark: '#5a3a26', crack: '#3a2418', edge: '#e8c090' }, 92, { cracks: 4 });
    // grassy lip
    const gl = { dark: '#2f7a3a', mid: '#5aa44a', lit: '#9ad46a' };
    const r = rng(93);
    for (let i = 0; i < 700; i++) { const px = -40 + r() * 960, top = px < 300 ? 800 - px * 0.1 : px < 620 ? 770 - (px - 300) * 0.03 : 760 + (px - 620) * 0.115; const py = top + r() * 22, len = 10 + r() * 26; const col = r() < 0.3 ? gl.dark : r() < 0.7 ? gl.mid : gl.lit; stroke(x, [[px, py], [px + (r() - 0.4) * 8, py - len * 0.6], [px + (r() - 0.4) * 14, py - len]], 3.2, 0.4, col, 0.95); }
    PL.vistaLedge = c;
  }
}

// ---------------------------------------------------------------- the forest clearing
function forest() {
  const HZ = '#d8f0e0';
  { const [c, x] = OC(PW, PH);
    skyPlate(x, PW, PH, [[0, '#3aa2d0'], [0.5, '#9ad4e0'], [0.8, '#e4f4e0']], 7);
    cumulus(x, 600, 360, 600, 240, 91, cloudPal()); cumulus(x, 1800, 320, 520, 200, 92, cloudPal());
    treeline(x, -40, PW + 40, 640, 220, hazed(FOLIAGE, 0.5, HZ), 93, 0.8);
    for (let i = 0; i < 12; i++) tree(x, -60 + i * 220 + (i % 3) * 30, 760, 420 + (i % 4) * 50, hazed(FOLIAGE, 0.3, HZ), 100 + i, { wide: 0.5 });
    PL.forestBack = c; }
  { const [c, x] = OC(PW, PH);
    for (let i = 0; i < 7; i++) tree(x, 80 + i * 360 + (i % 2) * 60, 860, 640 + (i % 3) * 90, FOLIAGE, 120 + i, { wide: 0.46, trunk: 0.06 });
    PL.forestMid = c; }
  { const [c, x] = OC(PW, PH);
    grassField(x, 0, 820, PW, 260, { far: '#7cc25a', near: '#4a9a42', sun: '#d8f08a', shade: '#2f6a3a', dark: '#3a8a3a', mid: '#64b04c', lit: '#a8dc70' }, 131, { blade: 34 });
    // dirt path + dappled light
    x.save(); x.filter = 'blur(3px)';
    x.fillStyle = '#d8b884'; x.beginPath(); x.moveTo(700, 1080); x.quadraticCurveTo(1100, 900, 1500, 860); x.lineTo(1700, 870); x.quadraticCurveTo(1300, 940, 1150, 1080); x.closePath(); x.fill();
    x.restore();
    pebbles(x, 760, 900, 800, 180, 60, { dark: '#8a6a44', mid: '#c8a878', lit: '#f0dcb0' }, 132);
    flowers(x, 0, 860, PW, 220, 160, 133);
    x.save(); x.filter = 'blur(10px)'; const r = rng(134);
    for (let i = 0; i < 26; i++) dab(x, r() * PW, 840 + r() * 240, 40 + r() * 70, 10 + r() * 16, 0, '#f6ffc0', 0.35);
    x.restore(); x.globalAlpha = 1;
    PL.forestFloor = c; }
  { const [c, x] = OC(PW, PH); // dark foreground leaves for framing
    const pal = { dark: '#0f2c1e', mid: '#1d4a30', lit: '#3a7a40', hi: '#6aa84a', deep: '#081a12' };
    const r = rng(141);
    for (let i = 0; i < 9; i++) leafClump(x, -40 + r() * 260, -40 + i * 60, 120, pal, r, 1.4);
    for (let i = 0; i < 9; i++) leafClump(x, PW + 40 - r() * 260, -40 + i * 50, 120, pal, r, 1.4);
    for (let i = 0; i < 14; i++) leafClump(x, i * 180, -60 + r() * 60, 110, pal, r, 1.2);
    PL.forestFront = c; }
}

// ---------------------------------------------------------------- the canyon (day / dusk)
function canyon(dusk) {
  const key = dusk ? 'Dusk' : 'Day';
  const HZ = dusk ? '#e8a08a' : '#f0d8b0';
  { const [c, x] = OC(PW, PH);
    skyPlate(x, PW, PH, dusk ? [[0, '#2a2060'], [0.4, '#7a3a7a'], [0.7, '#e07a6a'], [0.85, '#f8b07a']] : [[0, '#1a7ab8'], [0.45, '#4fb0d8'], [0.8, '#bfe4ee']], 201);
    wisps(x, 0, 100, PW, 300, 26, 202, dusk ? '#ffc8b0' : '#ffffff', 0.45);
    cumulus(x, 500, 420, 640, 260, 203, cloudPal(dusk)); cumulus(x, 1900, 360, 560, 220, 204, cloudPal(dusk));
    mountains(x, -50, 700, PW + 100, 300, 205, dusk ? { top: '#6a3a6a', bottom: '#b06a7a', lit: '#d08a8a', gully: '#4a2450', haze: HZ } : { top: '#c88a5a', bottom: '#e0b080', lit: '#f2c890', gully: '#8a5a3a', haze: HZ }, { peaks: 6, hazeA: 0.5 });
    PL['canyonSky' + key] = c; }
  { const [c, x] = OC(PW, PH);
    const pal = dusk ? { mid: '#8a4a5a', band1: '#9a5a62', band2: '#7a3a50', dark: '#4a2240', lit: '#d08080' } : { mid: '#c8844e', band1: '#d89a62', band2: '#b06a3e', dark: '#7a4026', lit: '#f2c088' };
    strata(x, [[-40, 380], [260, 330], [520, 420], [620, 560], [700, 1080], [-40, 1080]], pal, 211);
    strata(x, [[1840, 420], [2100, 300], [2440, 340], [2440, 1080], [1760, 1080], [1800, 600]], pal, 212);
    const gpal = dusk ? { far: '#9a6a6a', near: '#6a4050', sun: '#d89a8a', shade: '#4a2a40', dark: '#6a3a4a', mid: '#9a6060', lit: '#c88a7a' } : { far: '#e8c08a', near: '#c89058', sun: '#f8dca8', shade: '#a06a40', dark: '#b07a48', mid: '#d8a468', lit: '#f0c890' };
    x.fillStyle = gpal.far; x.fillRect(0, 820, PW, 260);
    x.save(); x.filter = 'blur(14px)'; const r = rng(213); for (let i = 0; i < 14; i++) dab(x, r() * PW, 840 + r() * 220, 120 + r() * 200, 20 + r() * 30, 0, r() < 0.5 ? gpal.sun : gpal.shade, 0.35); x.restore(); x.globalAlpha = 1;
    pebbles(x, 0, 840, PW, 240, 260, { dark: gpal.shade, mid: gpal.dark, lit: gpal.lit }, 214);
    rock(x, [[60, 980], [140, 900], [300, 880], [380, 960], [400, 1080], [40, 1080]], dusk ? { mid: '#7a4050', lit: '#b06a70', dark: '#4a2240', crack: '#2a1020', edge: '#e09a90' } : { mid: '#b07848', lit: '#e0aa70', dark: '#7a4a2a', crack: '#4a2a18', edge: '#ffd8a0' }, 215, { cracks: 5 });
    rock(x, [[2000, 1000], [2080, 930], [2240, 920], [2340, 990], [2360, 1080], [1990, 1080]], dusk ? { mid: '#7a4050', lit: '#b06a70', dark: '#4a2240', crack: '#2a1020', edge: '#e09a90' } : { mid: '#b07848', lit: '#e0aa70', dark: '#7a4a2a', crack: '#4a2a18', edge: '#ffd8a0' }, 216, { cracks: 5 });
    PL['canyonGround' + key] = c; }
}

// ---------------------------------------------------------------- sunset hills (the journey)
function sunset() {
  const HZ = '#ffd0a0';
  { const [c, x] = OC(PW, PH);
    skyPlate(x, PW, PH, [[0, '#2c3a8a'], [0.3, '#8a5a9a'], [0.5, '#e8846a'], [0.66, '#ffc27a'], [0.74, '#ffe0a8']], 301);
    wisps(x, 0, 80, PW, 360, 36, 302, '#ffd0b8', 0.55);
    x.save(); x.filter = 'blur(40px)'; dab(x, 1800, 640, 260, 200, 0, '#fff4d0', 0.9); x.restore();
    cumulus(x, 400, 380, 640, 240, 303, cloudPal(1)); cumulus(x, 1350, 300, 520, 200, 304, cloudPal(1)); cumulus(x, 2200, 420, 560, 240, 305, cloudPal(1));
    mountains(x, -50, 690, PW + 100, 240, 306, { top: '#8a5a8a', bottom: '#d08a8a', lit: '#f0a890', gully: '#5a3a6a', haze: HZ }, { peaks: 8, hazeA: 0.7 });
    PL.sunsetSky = c; }
  { const [c, x] = OC(PW, PH);
    const pal = { far: '#b0a060', near: '#6a8a4a', sun: '#ffd890', shade: '#4a5a3a', dark: '#5a7a40', mid: '#8aa050', lit: '#d8c070' };
    // rolling hills: two humps painted with grass strokes
    x.save(); const hill = new Path2D(); hill.moveTo(0, 1080); hill.lineTo(0, 760); for (let px = 0; px <= PW; px += 20) hill.lineTo(px, 720 + Math.sin(px * 0.0022 + 1) * 50 + fbm(px * 0.005, 7) * 20); hill.lineTo(PW, 1080); hill.closePath();
    x.clip(hill); grassField(x, 0, 660, PW, 420, pal, 311, { blade: 28 }); x.restore();
    const wf = hazed(FOLIAGE, 0.0, HZ);
    const sunsetFol = { ...wf, dark: '#3a4a2a', mid: '#6a7a3a', lit: '#d8b860', hi: '#ffe090', deep: '#2a2a1a', bark: '#4a2a1a', barkLit: '#c08050' };
    tree(x, 180, 860, 360, sunsetFol, 321); tree(x, 2150, 820, 400, sunsetFol, 322); tree(x, 1750, 780, 220, sunsetFol, 323);
    treeline(x, 300, 1500, 760, 40, sunsetFol, 324, 1.4);
    PL.sunsetLand = c; }
}

// ---------------------------------------------------------------- dawn hill (the terminal)
function dawn() {
  const [c, x] = OC(PW, PH);
  skyPlate(x, PW, PH, [[0, '#24357a'], [0.4, '#6a6aa8'], [0.66, '#f09a80'], [0.8, '#ffd29a']], 401);
  wisps(x, 0, 200, PW, 400, 30, 402, '#ffc8b0', 0.5);
  cumulus(x, 500, 520, 600, 220, 403, cloudPal(1)); cumulus(x, 1900, 480, 520, 200, 404, cloudPal(1));
  mountains(x, -50, 860, PW + 100, 260, 405, { top: '#5a4a7a', bottom: '#b07a8a', lit: '#e8a08a', gully: '#3a2a5a', haze: '#ffc8a0' }, { peaks: 8, hazeA: 0.6 });
  grassField(x, 0, 860, PW, 220, { far: '#6a8a6a', near: '#3a5a4a', sun: '#e8b080', shade: '#2a3a3a', dark: '#2f4a3a', mid: '#4a6a4a', lit: '#c09a70' }, 406, { blade: 20 });
  PL.dawn = c;
}

// ---------------------------------------------------------------- the stadium (painted stands)
function stadiumPlate() {
  const [c, x] = OC(PW, PH);
  const cx = PW / 2;
  // tiers of seats: each row an arc of tiny seat dabs, lit rim on top
  for (let row = 0; row < 16; row++) {
    const y = 330 + row * 24, w = 1500 + row * 150, hgt = 280;
    const col = mix('#2a3466', '#5a6aa0', row / 16);
    x.fillStyle = col; x.beginPath(); x.ellipse(cx, y + hgt, w / 2, hgt, 0, Math.PI, TAU); x.lineTo(cx + w / 2, y + hgt + 30); x.lineTo(cx - w / 2, y + hgt + 30); x.closePath(); x.fill();
    const r = rng(500 + row);
    for (let k = 0; k < 140 + row * 14; k++) {
      const a = Math.PI + (k + 0.5) / (140 + row * 14) * Math.PI;
      const sx = cx + Math.cos(a) * w / 2 * 0.985, sy = y + hgt + Math.sin(a) * hgt * 0.985 + 6;
      dab(x, sx, sy, 3.2, 2.2, 0, row % 4 === 0 ? '#8a3a4a' : mix('#3a4a8a', '#6a7ab8', r()), 0.9);
    }
    x.globalAlpha = 1; x.strokeStyle = rgba('#a8b8e8', 0.35); x.lineWidth = 2; x.beginPath(); x.ellipse(cx, y + hgt, w / 2, hgt, 0, Math.PI * 1.02, Math.PI * 1.98); x.stroke();
  }
  // aisles (stair stripes)
  for (let k = 0; k < 14; k++) { const a = Math.PI + (k + 0.5) / 14 * Math.PI; x.strokeStyle = rgba('#c8d0e8', 0.25); x.lineWidth = 6; x.beginPath(); x.moveTo(cx + Math.cos(a) * 760, 610 + Math.sin(a) * 280); x.lineTo(cx + Math.cos(a) * 1250, 690 + Math.sin(a) * 280); x.stroke(); }
  // roof canopy with trusses
  x.fillStyle = '#1a2040'; x.beginPath(); x.ellipse(cx, 560, 1300, 420, 0, Math.PI * 1.06, Math.PI * 1.94); x.lineTo(cx + 1000, 300); x.ellipse(cx, 560, 1150, 330, 0, Math.PI * 1.9, Math.PI * 1.1, true); x.closePath(); x.fill();
  x.strokeStyle = rgba('#5a6aa8', 0.6); x.lineWidth = 3;
  for (let k = 0; k < 40; k++) { const a = Math.PI * 1.08 + k / 40 * Math.PI * 0.84; x.beginPath(); x.moveTo(cx + Math.cos(a) * 1300, 560 + Math.sin(a) * 420); x.lineTo(cx + Math.cos(a) * 1150, 560 + Math.sin(a) * 330); x.stroke(); }
  // field: mowing stripes, painted texture, line markings
  x.save(); const field = new Path2D(); field.moveTo(-50, 1100); field.lineTo(-50, 720); field.quadraticCurveTo(cx, 610, PW + 50, 720); field.lineTo(PW + 50, 1100); field.closePath(); x.clip(field);
  grassField(x, 0, 640, PW, 460, { far: '#2f7a3c', near: '#4fa24a', sun: '#6ac05a', shade: '#245a30', dark: '#2a6a34', mid: '#3a8a40', lit: '#5aa84a' }, 531, { blade: 10, density: 0.5 });
  for (let i = 0; i < 12; i++) { x.fillStyle = rgba('#000000', 0.08); x.beginPath(); x.moveTo(cx + (i - 6) * 140, 640); x.lineTo(cx + (i - 5.5) * 140, 640); x.lineTo(cx + (i - 5.5) * 420, 1100); x.lineTo(cx + (i - 6) * 420, 1100); x.closePath(); if (i % 2) x.fill(); }
  x.restore();
  x.strokeStyle = rgba('#ffffff', 0.8); x.lineWidth = 6;
  x.beginPath(); x.ellipse(cx, 900, 380, 110, 0, 0, TAU); x.stroke();
  x.beginPath(); x.moveTo(cx, 650); x.lineTo(cx, 1100); x.stroke();
  x.beginPath(); x.moveTo(140, 760); x.quadraticCurveTo(cx, 650, PW - 140, 760); x.stroke();
  PL.stadium = c;
}

// ---------------------------------------------------------------- space + the planet
function space() {
  const [c, x] = OC(2600, 1500);
  const g = x.createRadialGradient(1300, 700, 100, 1300, 700, 1500); g.addColorStop(0, '#1a0f3a'); g.addColorStop(1, '#03020a');
  x.fillStyle = g; x.fillRect(0, 0, 2600, 1500);
  const r = rng(601);
  const band = u => 750 + (u - 0.5) * 900 + Math.sin(u * 7) * 60; // a diagonal river of gas
  // gas: thousands of soft dabs along the band, colours drift along it
  x.save(); x.filter = 'blur(14px)';
  for (let i = 0; i < 900; i++) {
    const u = r(), px = u * 2600, py = band(u) + (r() - 0.5) * (260 + r() * 240);
    const col = ['#ff4fa0', '#a050ff', '#3fb0ff', '#ff9a50', '#40e0d0', '#ffd0f0'][Math.floor((u * 4 + r() * 1.5) % 6)];
    dab(x, px, py, 40 + r() * 120, 20 + r() * 60, -0.35 + (r() - 0.5) * 0.4, col, 0.05 + r() * 0.09);
  }
  x.restore();
  // dark dust lanes
  x.save(); x.filter = 'blur(6px)';
  for (let i = 0; i < 60; i++) { const u = r(), px = u * 2600, py = band(u) + (r() - 0.5) * 220; stroke(x, [[px, py], [px + 120 + r() * 200, py - 50 - r() * 80], [px + 260 + r() * 300, py - 90 - r() * 120]], 10 + r() * 30, 2, '#05030f', 0.25 + r() * 0.3); }
  x.restore();
  // bright core + star clusters
  x.save(); x.filter = 'blur(30px)'; dab(x, 1400, band(0.54), 260, 120, -0.35, '#ffe8f4', 0.45); x.restore();
  for (let i = 0; i < 2400; i++) { const u = r(), px = u * 2600, near = r() < 0.6, py = near ? band(u) + (r() - 0.5) * 500 : r() * 1500, s = 0.5 + r() * r() * 2.6; dab(x, px, py, s, s, 0, r() < 0.15 ? '#ffe2b0' : r() < 0.3 ? '#b8dcff' : '#ffffff', 0.5 + r() * 0.5); }
  for (let i = 0; i < 26; i++) { const px = r() * 2600, py = r() * 1500, s = 2 + r() * 3; x.save(); x.filter = 'blur(3px)'; dab(x, px, py, s * 4, s * 4, 0, '#bfe6ff', 0.6); x.restore(); dab(x, px, py, s, s, 0, '#ffffff'); x.globalAlpha = 0.8; x.fillStyle = '#ffffff'; x.fillRect(px - s * 7, py - 0.6, s * 14, 1.2); x.fillRect(px - 0.6, py - s * 7, 1.2, s * 14); }
  x.globalAlpha = 1;
  PL.space = c;
}
function planet() {
  const R = 2400, [c, x] = OC(3000, 1300);
  const cx = 1500, cy = R + 60;
  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip();
  const g = x.createRadialGradient(cx + 300, cy - R + 200, 100, cx, cy, R); g.addColorStop(0, '#3ab0e0'); g.addColorStop(0.6, '#1f7ab8'); g.addColorStop(1, '#0e3a7a');
  x.fillStyle = g; x.fillRect(0, 0, 3000, 1300);
  const r = rng(611);
  // continents: painted greens/sands with coastlines
  for (let k = 0; k < 7; k++) {
    const lx = 200 + r() * 2600, ly = 160 + r() * 700, lw = 160 + r() * 360, lh = 50 + r() * 120;
    const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, rr = 1 + fbm(i * 0.4, k * 9) * 0.6; pts.push([lx + Math.cos(a) * lw * rr, ly + Math.sin(a) * lh * rr]); }
    const pth = new Path2D(); pts.forEach(([px, py], i) => (i ? pth.lineTo(px, py) : pth.moveTo(px, py))); pth.closePath();
    x.save(); x.filter = 'blur(2px)'; x.fillStyle = '#e8d8a0'; x.globalAlpha = 0.6; x.lineWidth = 10; x.strokeStyle = '#bfe8f0'; x.stroke(pth); x.restore();
    x.fillStyle = '#5aa04a'; x.globalAlpha = 1; x.fill(pth);
    x.save(); x.clip(pth); for (let i = 0; i < 260; i++) dab(x, lx + (r() - 0.5) * lw * 2.4, ly + (r() - 0.5) * lh * 2.4, 6 + r() * 18, 3 + r() * 8, 0, ['#3f8a3a', '#7ab858', '#c8b070', '#2f6a3a', '#e0d0a0'][Math.floor(r() * 5)], 0.6); x.restore();
  }
  // cloud swirls
  x.save(); x.filter = 'blur(3px)';
  for (let i = 0; i < 140; i++) { const px = r() * 3000, py = 100 + r() * 900; stroke(x, [[px, py], [px + 60 + r() * 120, py - 10 - r() * 20], [px + 140 + r() * 200, py - 6]], 6 + r() * 16, 2, '#ffffff', 0.35 + r() * 0.4); }
  x.restore();
  // terminator shading (light from upper right)
  const sh = x.createLinearGradient(cx + 900, 0, cx - 1300, 900); sh.addColorStop(0, 'rgba(0,0,30,0)'); sh.addColorStop(1, 'rgba(0,0,30,0.55)');
  x.globalAlpha = 1; x.fillStyle = sh; x.fillRect(0, 0, 3000, 1300);
  x.restore();
  // atmosphere rim
  x.save(); x.filter = 'blur(8px)'; x.strokeStyle = '#bff4ff'; x.lineWidth = 30; x.globalAlpha = 0.85; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.restore();
  x.save(); x.filter = 'blur(40px)'; x.strokeStyle = '#6fd8ff'; x.lineWidth = 120; x.globalAlpha = 0.45; x.beginPath(); x.arc(cx, cy, R + 40, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.restore();
  PL.planet = c;
}
// small foreground plates
function fgGrass() {
  const [c, x] = OC(PW, 400);
  const r = rng(701);
  for (let i = 0; i < 900; i++) { const px = r() * PW, py = 400, len = 60 + r() * 220, lean = (r() - 0.5) * 0.6; const col = ['#13301e', '#1d4a2c', '#2a5e34'][Math.floor(r() * 3)]; stroke(x, [[px, py], [px + lean * len * 0.4, py - len * 0.55], [px + lean * len, py - len]], 6 + r() * 10, 0.6, col, 0.95); }
  PL.fgGrass = c;
}

// ---------------------------------------------------------------- the storm (villain line-up)
function storm() {
  const [c, x] = OC(PW, PH);
  skyPlate(x, PW, PH, [[0, '#0c0618'], [0.45, '#2a1640'], [0.75, '#5a2a5a'], [0.85, '#7a3a5a']], 801);
  const dark = { sh: '#1a0f2a', mid: '#3a2650', lit: '#6a4a80', rim: '#a088c8', sh2: '#0a0614' };
  cumulus(x, 400, 380, 900, 360, 802, dark); cumulus(x, 1500, 300, 1000, 380, 803, dark); cumulus(x, 2200, 420, 700, 300, 804, dark);
  cumulus(x, 900, 160, 1100, 300, 805, dark);
  mountains(x, -50, 820, PW + 100, 300, 806, { top: '#24142e', bottom: '#3a2040', lit: '#5a3a5a', gully: '#120a18', haze: '#5a2a50' }, { peaks: 7, hazeA: 0.4 });
  const gp = { far: '#2a1a30', near: '#160c1a', sun: '#4a2a4a', shade: '#0a050c', dark: '#1a0f1e', mid: '#2e1c34', lit: '#4a3050' };
  grassField(x, 0, 810, PW, 270, gp, 807, { blade: 22 });
  rock(x, [[120, 1000], [260, 860], [520, 840], [640, 960], [660, 1080], [100, 1080]], { mid: '#2e1c34', lit: '#5a3a5a', dark: '#140a18', crack: '#08040a', edge: '#8a6aa0' }, 808, { cracks: 6 });
  rock(x, [[1900, 1010], [2010, 880], [2240, 860], [2360, 960], [2380, 1080], [1880, 1080]], { mid: '#2e1c34', lit: '#5a3a5a', dark: '#140a18', crack: '#08040a', edge: '#8a6aa0' }, 809, { cracks: 6 });
  PL.storm = c;
}

export function loadPlates() {
  vista(); forest(); canyon(0); canyon(1); sunset(); dawn(); stadiumPlate(); space(); planet(); fgGrass(); storm();
}
