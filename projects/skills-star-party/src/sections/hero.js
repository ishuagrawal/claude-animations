// HERO — the milestone page's first screen (page coords). Left: MILESTONE_ pill, the headline
// "69 stars / on GitHub" whose number rolls to 70 when the cursor stars the repo, subtitle, Star +
// Get-the-skill buttons, stargazer row. Right: the Octocat (drawn by film.js between the back and
// front layers) on a lit platform, with floating stat chips at two depths. Plus the sticky nav.
import { C, STARS, FORKS, OWNER, REPO } from '../timeline.js';
import { PANEL, NAV_H, HERO, STAR_BTN, GET_BTN } from '../layout.js';
import { clamp, lerp, TAU, rng } from '../core.js';
import { sp, eout, smooth, icon, glow, sparkle, SANS, MONO } from '../kit.js';
import { rgba, mix } from '../palette.js';
import { G, card, txt, tw, pill, button, avatar, odometer, rr, ripple, rise, shadow, noShadow } from '../ui.js';

// the star count over time: STARS-1 until the click, then an odometer roll with a tiny overshoot
export const count = t => STARS - 1 + clamp(sp(t, C.star, 1.6, 0.6));
export const starred = t => smooth((t - C.star) / 0.12);

// ---------------------------------------------------------------- backdrop
function backdrop(ctx, t) {
  const a = smooth((t - C.open - 0.3) / 0.8);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  // light pools behind the hero art
  const o = HERO.octo;
  for (const [x, y, r, c, k] of [[o.x, o.y + 120, 760, '#6e40c9', 0.26], [o.x + 260, o.y - 220, 560, '#1f6feb', 0.14], [o.x - 300, o.y + 380, 520, '#bf3989', 0.12]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, k)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // faint blueprint grid, fading out from the hero art
  ctx.lineWidth = 1;
  for (let x = 36; x < PANEL.w; x += 72) {
    const d = Math.abs(x - o.x) / 700, al = 0.06 * Math.max(0, 1 - d * d);
    if (al < 0.004) continue;
    const g = ctx.createLinearGradient(0, NAV_H, 0, PANEL.h);
    g.addColorStop(0, rgba('#f0f6fc', 0)); g.addColorStop(0.45, rgba('#f0f6fc', al)); g.addColorStop(1, rgba('#f0f6fc', 0));
    ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(x + 0.5, NAV_H); ctx.lineTo(x + 0.5, PANEL.h); ctx.stroke();
  }
  for (let y = NAV_H + 48; y < PANEL.h; y += 72) {
    const d = Math.abs(y - o.y - 100) / 420, al = 0.05 * Math.max(0, 1 - d * d);
    if (al < 0.004) continue;
    const g = ctx.createLinearGradient(o.x - 640, 0, o.x + 640, 0);
    g.addColorStop(0, rgba('#f0f6fc', 0)); g.addColorStop(0.5, rgba('#f0f6fc', al)); g.addColorStop(1, rgba('#f0f6fc', 0));
    ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(o.x - 640, y + 0.5); ctx.lineTo(o.x + 640, y + 0.5); ctx.stroke();
  }
  // twinkles
  const R = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 760 + R() * 780, y = 90 + R() * 760, ph = R() * TAU, r = 2 + R() * 4;
    const tw2 = 0.5 + 0.5 * Math.sin(t * (1.5 + R() * 2) + ph);
    sparkle(ctx, x, y, r * (0.6 + tw2 * 0.6), i % 4 ? '#c9d1d9' : '#e3b341', ph, 0.25 + 0.45 * tw2);
  }
  ctx.restore();
}

// platform the Octocat stands on: lit disc with rim gradient, inner ring, orbiting dots
function platform(ctx, t) {
  const a = smooth((t - C.openEnd + 0.4) / 0.6);
  if (a <= 0) return;
  const o = HERO.octo, cx = o.x, cy = o.y + o.s * 2.28, rx = 250 * (0.85 + 0.15 * a), ry = 52 * (0.85 + 0.15 * a);
  ctx.save(); ctx.globalAlpha *= a;
  glow(ctx, cx, cy, 300, '#8957e5', 0.22);
  ctx.beginPath(); ctx.ellipse(cx, cy + 10, rx, ry, 0, 0, TAU);
  const body = ctx.createLinearGradient(0, cy - ry, 0, cy + ry + 14);
  body.addColorStop(0, '#1b1f2a'); body.addColorStop(1, '#07090d');
  ctx.fillStyle = body; ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  const top = ctx.createRadialGradient(cx - 40, cy - 20, 10, cx, cy, rx);
  top.addColorStop(0, '#2a2f3d'); top.addColorStop(1, '#141822');
  ctx.fillStyle = top; ctx.fill();
  const rim = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  rim.addColorStop(0, rgba('#b38cff', 0.9)); rim.addColorStop(0.5, rgba('#ffffff', 0.25)); rim.addColorStop(1, rgba('#6fb8ff', 0.9));
  ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.72, ry * 0.72, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(240,246,252,0.10)'; ctx.lineWidth = 1; ctx.setLineDash([3, 7]); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i < 3; i++) { // orbiting dots on the inner ring
    const an = t * 0.9 + i * TAU / 3;
    const dx = Math.cos(an) * rx * 0.72, dy = Math.sin(an) * ry * 0.72;
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 3.2, 0, TAU);
    ctx.fillStyle = i === 0 ? G.star : i === 1 ? G.purpleFg : G.accentFg; ctx.fill();
  }
  // soft contact shadow where the tentacles touch
  ctx.save(); ctx.translate(cx, cy - 4); ctx.scale(1, 0.2);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 170, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// floating stat chip: icon tile + two lines
function chip(ctx, t, i, x, y, w, tile, iconName, line1, line2, o = {}) {
  const k = sp(t, C.chips + i * 0.12, 1.5, 0.55);
  if (k <= 0.002) return;
  const bob = Math.sin(t * 1.3 + i * 1.9) * 7;
  const h = 76;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + bob); const z = (0.7 + 0.3 * k) * (1 + (o.pulse || 0) * 0.08); ctx.scale(z, z); ctx.translate(-x - w / 2, -y - h / 2);
  ctx.globalAlpha *= clamp(k * 1.4);
  card(ctx, x, y, w, h, { r: 16, fill: 'rgba(22,27,34,0.92)', sh: 0.6 });
  const tx = x + 14, ty = y + 14;
  rr(ctx, tx, ty, 48, 48, 12);
  const g = ctx.createLinearGradient(tx, ty, tx + 48, ty + 48); g.addColorStop(0, tile[0]); g.addColorStop(1, tile[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; rr(ctx, tx + 0.5, ty + 0.5, 47, 47, 11.5); ctx.stroke();
  icon(ctx, iconName, tx + 24, ty + 24, 24, '#ffffff');
  if (typeof line1 === 'function') line1(tx + 64, y + 46);
  else txt(ctx, line1, tx + 64, y + 44, { size: 21, weight: 600, color: G.fg });
  txt(ctx, line2, tx + 64, y + 63, { size: 14, weight: 500, color: G.muted });
  if (o.plus > 0) { // "+1" badge
    const pa = o.plus, py = y - 6 - (1 - Math.pow(1 - pa, 3)) * 18;
    ctx.globalAlpha *= Math.min(1, pa * 3) * (pa > 0.75 ? 1 - (pa - 0.75) * 4 : 1);
    rr(ctx, x + w - 52, py - 14, 44, 28, 14); ctx.fillStyle = G.green; ctx.fill();
    txt(ctx, '+1', x + w - 30, py + 1, { size: 16, weight: 700, color: '#ffffff', align: 'center', base: 'middle' });
  }
  ctx.restore();
}

export function drawBack(ctx, t) {
  backdrop(ctx, t);
  const st = starred(t);
  // ---- left column
  const x = HERO.x;
  ctx.save();
  const pa = rise(ctx, (t - C.pill) / 0.5, 14);
  pill(ctx, x, HERO.pillY, 'MILESTONE', { t, a: pa });
  ctx.restore();
  // headline: lines rise out of a mask
  const n = count(t);
  for (let li = 0; li < 2; li++) {
    const u = clamp((t - C.h1 - li * 0.1) / 0.7), e = 1 - Math.pow(1 - u, 4);
    if (u <= 0) continue;
    const by = HERO.h1[li], S = HERO.h1Size;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 20, by - S * 1.02, 1000, S * 1.3); ctx.clip();
    ctx.translate(0, (1 - e) * S * 1.1);
    if (li === 0) {
      const dw = tw(ctx, '0', S, 500, SANS, 0) * 1.02 * 2;
      let fill = null;
      if (st > 0) {
        const g = ctx.createLinearGradient(x, by - S, x + dw, by);
        g.addColorStop(0, mix(G.fg, '#ffe08a', st)); g.addColorStop(1, mix(G.fg, '#f0883e', st));
        fill = g;
        glow(ctx, x + dw / 2, by - S * 0.35, S * 1.3 * st, '#e3b341', 0.18 * st);
      }
      odometer(ctx, n, x + dw, by, { size: S, weight: 500, color: G.fg, fill, digits: 2 });
      txt(ctx, ' stars', x + dw, by, { size: S, weight: 500, color: G.fg, track: -3 });
    } else {
      txt(ctx, 'on GitHub', x - 4, by, { size: S, weight: 500, color: G.fg, track: -3 });
    }
    ctx.restore();
  }
  // subtitle
  for (let li = 0; li < 2; li++) {
    ctx.save();
    const a = rise(ctx, (t - C.sub - li * 0.06) / 0.6, 14);
    txt(ctx, ['Open-source Agent Skills by Ishu Agrawal — home of video-by-reference.', 'Thank you for every single star.'][li], x, HERO.subY[li], { size: 24, weight: 400, color: G.muted, a });
    ctx.restore();
  }
  // buttons
  {
    ctx.save();
    const a = rise(ctx, (t - C.btns) / 0.55, 16);
    const hover = smooth((t - C.star + 0.3) / 0.15) * (1 - smooth((t - C.star - 0.8) / 0.3));
    const press = Math.max(0, 1 - Math.abs(t - C.star) / 0.09);
    const B = STAR_BTN;
    button(ctx, B.x, B.y, B.w, B.h, st > 0.5 ? 'Starred' : 'Star', {
      a, hover, press, size: 19, iconName: st > 0.5 ? 'starFill' : 'starOutline', iconColor: st > 0.5 ? G.star : G.muted,
      count: (cx, cy) => {
        font2(ctx);
        odometer(ctx, n, cx + tw(ctx, '00', 17, 600) / 2, cy + 6.5, { size: 17, weight: 600, color: G.fg });
      }, countText: '00',
    });
    button(ctx, GET_BTN.x, GET_BTN.y, GET_BTN.w, GET_BTN.h, 'Get the skill', { kind: 'primary', a, size: 19, iconName: 'plug', iconColor: '#0d1117' });
    ctx.restore();
    // star burst from the button
    if (t >= C.star && t < C.star + 1.2) {
      const bx = B.x + 34, by = B.y + B.h / 2, u = t - C.star;
      ripple(ctx, bx, by, u, { color: G.star, r: 60 });
      const R = rng(11);
      for (let i = 0; i < 14; i++) {
        const an = R() * Math.PI * 2, v = 50 + R() * 70, e = 1 - Math.exp(-u * 6);
        const px = bx + Math.cos(an) * v * e * 1.3, py = by + Math.sin(an) * v * e * 0.75 + 40 * u * u;
        const al = 1 - smooth((u - 0.2) / 0.55);
        if (al <= 0) continue;
        ctx.save(); ctx.globalAlpha *= al; ctx.translate(px, py); ctx.rotate(u * (R() * 6 - 3));
        icon(ctx, R() < 0.7 ? 'starFill' : 'sparkleFill', 0, 0, 10 + R() * 12, R() < 0.7 ? G.star : '#ffffff');
        ctx.restore();
      }
    }
  }
  // stargazer row
  {
    ctx.save();
    const a = rise(ctx, (t - C.btns - 0.2) / 0.6, 14);
    ctx.globalAlpha *= a;
    const cols = [['#a371f7', '#6e40c9'], ['#58a6ff', '#1f6feb'], ['#f778ba', '#bf3989'], ['#3fb950', '#238636'], ['#f0883e', '#bd561d']];
    cols.forEach(([c0, c1], i) => avatar(ctx, x + 18 + i * 26, HERO.socialY, 17, '', c0, c1));
    // the newest stargazer slides into the stack when the star lands
    const k = sp(t, C.star + 0.1, 1.8, 0.6);
    if (k > 0.001) { ctx.save(); ctx.globalAlpha *= clamp(k); avatar(ctx, x + 18 + 5 * 26, HERO.socialY - (1 - k) * 18, 17, '', '#e3b341', '#d29922'); icon(ctx, 'starFill', x + 18 + 5 * 26, HERO.socialY - (1 - k) * 18, 15, '#ffffff'); ctx.restore(); }
    const tx = x + 18 + 6 * 26 + 8;
    const w = odometer(ctx, n, tx + tw(ctx, '00', 19, 600), HERO.socialY + 7, { size: 19, weight: 600, color: G.fg, digits: 2 });
    txt(ctx, 'stargazers and counting', tx + w + 8, HERO.socialY + 7, { size: 19, weight: 400, color: G.muted });
    ctx.restore();
  }
  // ---- right column (behind the Octocat)
  platform(ctx, t);
  chip(ctx, t, 1, 1262, 236, 252, ['#a371f7', '#6e40c9'], 'video', 'video-by-reference', 'Agent Skill');
  chip(ctx, t, 3, 820, 600, 176, ['#3fb950', '#1a7f37'], 'fork', `${FORKS} forks`, 'Community');
}
function font2(ctx) { ctx.font = `600 17px ${SANS}`; }

export function drawFront(ctx, t) {
  const n = count(t), st = starred(t);
  chip(ctx, t, 0, 800, 196, 214, ['#e3b341', '#bb8009'], 'starFill', (x, y) => {
    const w = tw(ctx, '00', 26, 600);
    odometer(ctx, n, x + w, y + 2, { size: 26, weight: 600, color: G.fg, digits: 2 });
    txt(ctx, 'stars', x + w + 8, y + 2, { size: 21, weight: 500, color: G.fg });
  }, 'on GitHub', { pulse: Math.max(0, 1 - Math.abs(t - C.star - 0.12) / 0.25), plus: t > C.star ? clamp((t - C.star) / 1.1) : 0 });
  chip(ctx, t, 2, 1310, 586, 196, ['#58a6ff', '#1f6feb'], 'law', 'MIT', 'License');
  void st;
}

// sticky nav (panel coords, not scrolled)
export function drawNav(ctx, t, scrolled) {
  const a = smooth((t - C.nav) / 0.5);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(0, (1 - eout((t - C.nav) / 0.5)) * -10);
  ctx.fillStyle = `rgba(13,17,23,${0.7 + 0.28 * scrolled})`; ctx.fillRect(0, 0, PANEL.w, NAV_H);
  ctx.fillStyle = 'rgba(240,246,252,0.08)'; ctx.fillRect(0, NAV_H - 1, PANEL.w, 1);
  icon(ctx, 'github', 42, NAV_H / 2, 32, '#f0f6fc');
  let px = 74;
  px += txt(ctx, OWNER, px, NAV_H / 2 + 1, { size: 17, weight: 400, color: G.muted, base: 'middle' });
  px += txt(ctx, ' / ', px, NAV_H / 2 + 1, { size: 17, weight: 400, color: G.faint, base: 'middle' });
  px += txt(ctx, REPO, px, NAV_H / 2 + 1, { size: 17, weight: 600, color: G.fg, base: 'middle' }) + 12;
  rr(ctx, px + 0.5, NAV_H / 2 - 11.5, 58, 23, 11.5); ctx.strokeStyle = G.border; ctx.lineWidth = 1; ctx.stroke();
  txt(ctx, 'Public', px + 29, NAV_H / 2 + 1, { size: 12.5, weight: 500, color: G.muted, align: 'center', base: 'middle' });
  // tabs
  let tx = 520;
  [['code', 'Code', 1], ['issueOpen', 'Issues', 0], ['pr', 'Pull requests', 0], ['play', 'Actions', 0], ['graph', 'Insights', 0]].forEach(([ic, label, on]) => {
    icon(ctx, ic, tx + 8, NAV_H / 2, 16, on ? G.fg : G.muted);
    const w = txt(ctx, label, tx + 24, NAV_H / 2 + 1, { size: 15, weight: on ? 600 : 400, color: on ? G.fg : G.muted, base: 'middle' });
    if (on) { ctx.fillStyle = G.orange; rr(ctx, tx - 6, NAV_H - 3, w + 36, 3, 1.5); ctx.fill(); }
    tx += w + 56;
  });
  // search + bell + avatar
  const sx = PANEL.w - 380;
  rr(ctx, sx + 0.5, NAV_H / 2 - 16.5, 250, 33, 8); ctx.fillStyle = G.inset; ctx.fill(); ctx.strokeStyle = G.border; ctx.stroke();
  icon(ctx, 'search', sx + 18, NAV_H / 2, 15, G.muted);
  txt(ctx, 'Type / to search', sx + 34, NAV_H / 2 + 1, { size: 14, color: G.muted, base: 'middle' });
  rr(ctx, sx + 222.5, NAV_H / 2 - 9.5, 18, 19, 4); ctx.strokeStyle = G.border; ctx.stroke();
  txt(ctx, '/', sx + 231.5, NAV_H / 2 + 1, { size: 12, fam: MONO, color: G.muted, align: 'center', base: 'middle' });
  icon(ctx, 'bell', PANEL.w - 100, NAV_H / 2, 17, G.muted);
  ctx.beginPath(); ctx.arc(PANEL.w - 92, NAV_H / 2 - 8, 4, 0, TAU); ctx.fillStyle = G.accentFg; ctx.fill();
  avatar(ctx, PANEL.w - 48, NAV_H / 2, 15, '', '#a371f7', '#1f6feb', { ring: G.border });
  ctx.restore();
}
export { shadow, noShadow, lerp };
