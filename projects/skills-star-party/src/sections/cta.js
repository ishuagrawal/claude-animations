// CTA — the thank-you: a glowing horizon arc, "Thank you for every star", the install commands
// typing into a command card (the cursor clicks Copy → Copied), the Octocat and Claude popping up
// from behind the card to wave, brand-coloured confetti, then the repo URL on the stage as the camera
// pulls out to the whole window.
import { C, STARS, INSTALL, RUN, OWNER, REPO } from '../timeline.js';
import { CTA, COPY_BTN, PANEL } from '../layout.js';
import { W, H, clamp, TAU, rng } from '../core.js';
import { sp, smooth, icon, glow } from '../kit.js';
import { rgba, mix } from '../palette.js';
import { G, card, txt, tw, rr, rise, pill, button, odometer, shadow, noShadow } from '../ui.js';
import { octocat, claude } from '../actors.js';

const MONO = '"Monaspace Neon", ui-monospace, monospace';
const typedN = (t, t0, s) => Math.max(0, Math.min(s.length, Math.floor((t - t0) * 40)));
const T2 = () => C.typeCmd + INSTALL.length / 40 + 0.2;

function horizon(ctx, t) {
  const a = smooth((t - C.cta + 0.6) / 1.0);
  if (a <= 0) return;
  const cx = PANEL.w / 2, cy = 1660, R = 1180;
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(cx, cy - R, 0, cx, cy - R, 900);
  g.addColorStop(0, 'rgba(137,87,229,0.35)'); g.addColorStop(0.5, 'rgba(191,57,137,0.12)'); g.addColorStop(1, 'rgba(137,87,229,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 900, cy - R - 900, 1800, 1800);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
  const f = ctx.createLinearGradient(0, cy - R, 0, cy - R + 300); f.addColorStop(0, '#120f1f'); f.addColorStop(1, '#0d1117');
  ctx.fillStyle = f; ctx.fill();
  const s = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  s.addColorStop(0.1, 'rgba(110,64,201,0)'); s.addColorStop(0.35, '#a371f7'); s.addColorStop(0.5, '#ffffff'); s.addColorStop(0.65, '#f778ba'); s.addColorStop(0.9, 'rgba(47,129,247,0)');
  shadow(ctx, 30, 0, 'rgba(163,113,247,0.9)');
  ctx.strokeStyle = s; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  noShadow(ctx);
  ctx.restore();
}

function mascots(ctx, t) {
  const { x, y, w } = CTA.cmd;
  const cheer = smooth((t - C.copy - 0.05) / 0.2);
  // Octocat peeks over the left of the card and waves
  const ko = sp(t, C.mascots, 1.4, 0.55);
  if (ko > 0.001) {
    const hop = t > C.copy ? Math.max(0, Math.sin((t - C.copy) * 7)) * Math.exp(-(t - C.copy) * 2) : 0;
    const blink = Math.max(0, 1 - Math.abs(t - (C.mascots + 1.6)) * 12);
    octocat(ctx, x + 190, y - 58 + (1 - ko) * 190 - hop * 24, 60, {
      t, look: [0.5, 0.3], mouth: 0.5 + cheer * 0.4, happy: cheer > 0.5 ? 1 : 0, wave: 1 - cheer, cheer, blink, squash: -hop * 0.5,
    });
  }
  // Claude pops up on the right
  const kc = sp(t, C.mascots + 0.15, 1.4, 0.5);
  if (kc > 0.001) {
    const hop = t > C.copy ? Math.max(0, Math.sin((t - C.copy - 0.08) * 7)) * Math.exp(-(t - C.copy) * 2) : 0;
    claude(ctx, x + w - 200, y + 34 + (1 - kc) * 190 - hop * 24, 118, {
      t, arms: 0.35 + 0.65 * cheer + 0.25 * Math.sin(t * 6) * (1 - cheer), happy: cheer > 0.5 ? 1 : 0, eyes: 1, squash: -hop * 0.5, look: -0.6,
    });
  }
}

function commandCard(ctx, t) {
  const { x, y, w, h } = CTA.cmd;
  card(ctx, x, y, w, h, { r: 16, fill: '#0b0f14', sh: 0.75 });
  // left accent rail
  const rg = ctx.createLinearGradient(0, y, 0, y + h); rg.addColorStop(0, G.purpleFg); rg.addColorStop(1, G.pink);
  ctx.fillStyle = rg; rr(ctx, x, y + 22, 3, h - 44, 1.5); ctx.fill();
  const n1 = typedN(t, C.typeCmd, INSTALL), n2 = typedN(t, T2(), RUN);
  txt(ctx, '# 1 · add the marketplace in Claude Code', x + 40, y + 42, { size: 14, fam: MONO, color: G.faint });
  let ex = x + 40 + txt(ctx, INSTALL.slice(0, n1), x + 40, y + 82, { size: 22, fam: MONO, color: G.fg });
  if (n1 < INSTALL.length && t > C.typeCmd - 0.3) { ctx.fillStyle = '#c9d1d9'; ctx.fillRect(ex + 2, y + 62, 11, 26); }
  txt(ctx, '# 2 · run it on a video you love', x + 40, y + 128, { size: 14, fam: MONO, color: G.faint });
  ex = x + 40 + txt(ctx, RUN.slice(0, n2), x + 40, y + 166, { size: 22, fam: MONO, color: '#d2a8ff' });
  if (t > T2() - 0.1 && (n2 < RUN.length || Math.floor(t * 2.4) % 2 === 0)) { ctx.fillStyle = '#c9d1d9'; ctx.fillRect(ex + 2, y + 146, 11, 26); }
  // Copy button → Copied
  const B = COPY_BTN, done = t >= C.copy;
  const hover = smooth((t - C.copy + 0.3) / 0.15);
  const press = Math.max(0, 1 - Math.abs(t - C.copy) / 0.09);
  button(ctx, B.x, B.y, B.w, B.h, done ? 'Copied' : 'Copy', {
    kind: done ? 'green' : 'default', hover, press, size: 15, iconName: done ? 'check' : 'copy', iconColor: done ? '#ffffff' : G.muted, r: 8,
  });
  const ta = smooth((t - C.copy) / 0.15) * (1 - smooth((t - C.copy - 1.6) / 0.3));
  if (ta > 0) {
    const label = 'Copied to clipboard', bw = tw(ctx, label, 14, 500) + 28, cx = B.x + B.w / 2, ty = B.y - 12;
    ctx.save(); ctx.globalAlpha *= ta; ctx.translate(0, (1 - ta) * 6);
    rr(ctx, cx - bw / 2, ty - 32, bw, 32, 7); ctx.fillStyle = '#e6edf3'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 6, ty); ctx.lineTo(cx, ty + 6); ctx.lineTo(cx + 6, ty); ctx.closePath(); ctx.fill();
    txt(ctx, label, cx, ty - 15, { size: 14, weight: 500, color: '#0d1117', align: 'center', base: 'middle' });
    ctx.restore();
  }
}

// brand confetti from both lower corners of the window, on the Copy click
const CONF = ['#a371f7', '#f778ba', '#58a6ff', '#3fb950', '#e3b341', '#ffffff'];
function confetti(ctx, t, y0) {
  const u = t - C.copy - 0.05;
  if (u < 0 || u > 3.2) return;
  const R = rng(23);
  ctx.save();
  ctx.globalAlpha *= 1 - smooth((u - 2.3) / 0.9);
  for (let i = 0; i < 110; i++) {
    const side = i % 2 ? 1 : -1;
    const ox = side < 0 ? 40 : PANEL.w - 40, oy = 900;
    const an = -Math.PI / 2 - side * (0.12 + R() * 0.5), v = 1300 + R() * 1100, k = 1.7 + R() * 0.9;
    const e = (1 - Math.exp(-k * u)) / k;
    const px = ox + Math.cos(an) * v * e + Math.sin(u * 3 + i) * 24 * u, py = oy + Math.sin(an) * v * e + 260 * u * u;
    const c = CONF[Math.floor(R() * CONF.length)], spin = u * (4 + R() * 8) + R() * TAU, flip = Math.cos(spin * 1.6), kind = R();
    const sz = 8 + R() * 9;
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin); ctx.scale(1, Math.max(0.1, Math.abs(flip)));
    ctx.fillStyle = flip > 0 ? c : mix(c, '#000000', 0.35);
    if (kind < 0.18) icon(ctx, 'starFill', 0, 0, sz * 1.5, flip > 0 ? '#e3b341' : '#bb8009');
    else if (kind < 0.4) { ctx.beginPath(); ctx.arc(0, 0, sz * 0.4, 0, TAU); ctx.fill(); }
    else { rr(ctx, -sz / 2, -sz * 0.22, sz, sz * 0.44, 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  void y0;
}

export function draw(ctx, t, y0) {
  ctx.save();
  ctx.translate(0, y0);
  horizon(ctx, t);
  const cx = CTA.cx;
  ctx.save(); const pa = rise(ctx, (t - C.cta + 0.2) / 0.5, 12); pill(ctx, cx, CTA.pillY, 'THANK YOU', { t, a: pa, align: 'center', c0: '#e3b341', c1: '#f0883e' }); ctx.restore();
  // headline with a gradient on "every star"
  ctx.save();
  const ha = rise(ctx, (t - C.cta - 0.05) / 0.7, 22);
  const A = 'Thank you for ', B = 'every star', S = 82;
  const wa = tw(ctx, A, S, 500, undefined, -3), wb = tw(ctx, B, S, 500, undefined, -3), x0 = cx - (wa + wb) / 2;
  txt(ctx, A, x0, CTA.h2, { size: S, weight: 500, track: -3, a: ha });
  const g = ctx.createLinearGradient(x0 + wa, 0, x0 + wa + wb, 0); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#f0883e'); g.addColorStop(1, '#f778ba');
  txt(ctx, B, x0 + wa, CTA.h2, { size: S, weight: 500, track: -3, color: g, a: ha });
  ctx.restore();
  ctx.save(); const sa = rise(ctx, (t - C.cta - 0.15) / 0.6, 14);
  txt(ctx, 'Make your own animated short from a video you love — right in Claude Code.', cx, CTA.sub, { size: 23, color: G.muted, align: 'center', a: sa });
  ctx.restore();
  // mascots behind the card, then the card
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PANEL.w, CTA.cmd.y + 8); ctx.clip(); mascots(ctx, t); ctx.restore();
  ctx.save(); const ca = rise(ctx, (t - C.cta - 0.2) / 0.6, 30); ctx.globalAlpha *= ca; commandCard(ctx, t); ctx.restore();
  // buttons
  ctx.save(); const ba = rise(ctx, (t - C.cta - 0.35) / 0.6, 16);
  const bw1 = 216, bw2 = 300, bx = cx - (bw1 + 16 + bw2) / 2;
  button(ctx, bx, CTA.btnY, bw1, 56, 'Starred', { a: ba, size: 19, iconName: 'starFill', iconColor: G.star, countText: String(STARS), count: STARS });
  button(ctx, bx + bw1 + 16, CTA.btnY, bw2, 56, `${OWNER}/${REPO}`, { kind: 'primary', a: ba, size: 19, iconName: 'github', iconColor: '#0d1117' });
  ctx.restore();
  confetti(ctx, t, y0);
  ctx.restore();
}

// repo URL on the stage under the window as the camera pulls out (screen coords)
export function drawCaption(ctx, t) {
  const a = smooth((t - C.caption) / 0.6);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(0, (1 - a) * 14);
  const label = `github.com/${OWNER}/${REPO}`;
  const lw = tw(ctx, label, 30, 500), total = 40 + lw + 24 + 96, x0 = W / 2 - total / 2, y = 1000;
  icon(ctx, 'github', x0 + 16, y - 10, 32, '#f0f6fc');
  txt(ctx, label, x0 + 44, y, { size: 30, weight: 500, color: '#f0f6fc' });
  const px = x0 + 44 + lw + 22;
  rr(ctx, px, y - 30, 96, 38, 19); ctx.fillStyle = 'rgba(227,179,65,0.16)'; ctx.fill();
  ctx.strokeStyle = 'rgba(227,179,65,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  icon(ctx, 'starFill', px + 26, y - 11, 18, G.star);
  txt(ctx, String(STARS), px + 42, y - 1, { size: 21, weight: 600, color: '#ffe08a' });
  ctx.restore();
  void H; void clamp; void odometer; void glow;
}
