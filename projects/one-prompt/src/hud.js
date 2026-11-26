// Film-wide overlay: the running tally of kinds of data (bottom right), the prompt you haven't typed yet (bottom left),
// and the breakdown line under the finished tree. Every time comes from the narration cues, so it re-times with the voice.
import { C, SCRIPT } from './timeline.js';
import { K, CODE, rr, glow, text, tw, clamp, lerp, ease, rgba } from './ink.js';
import { T as FT } from './acts/finale_time.js';
import { T as ST } from './acts/send_t.js';
import { WORDS as VW } from './vo_words.js';
import { logo } from './coin.js';

// [label, narration line, fraction of that line's window, reason]; measured from where each label first appears on screen
const ITEMS = [["Account", "a3", 0.173, "need"], ["Device ID", "a31", 0.031, "extra"], ["System", "a32", 0.043, "extra"], ["Terminal", "a33", 0.03, "extra"], ["App version", "a33", 0.97, "extra"], ["IP address", "a4", 0.15, "extra"], ["Rough location", "a4", 0.566, "extra"], ["Update checks", "a5", 0.156, "extra"], ["Feature checks", "a5", 0.512, "extra"], ["File names", "b2", 0.035, "need"], ["Git branch", "b2", 0.13, "need"], ["Uncommitted changes", "b2", 0.238, "need"], ["Recent commits", "b2", 0.384, "need"], ["Instruction files", "b3", 0.073, "need"], ["Memories", "b3", 0.423, "need"], ["Code index", "b4", 0.1, "need"], ["Whole repository (one case)", "b5", 0.375, "extra"], ["Your prompt", "c2", 0.028, "need"], ["Tool instructions", "c2", 0.319, "need"], ["Conversation so far", "c2", 0.496, "need"], ["Project details", "c2", 0.632, "need"], ["Attachments", "c2", 0.772, "choice"], ["File contents", "d2", 0.258, "need"], ["Command output", "d2", 0.751, "need"], ["Web lookups", "d3", 0.068, "need"], ["Connected tools", "d3", 0.423, "choice"], ["Which tools ran", "d4", 0.219, "extra"], ["How long they took", "d4", 0.344, "extra"], ["Approvals & refusals", "d4", 0.468, "extra"], ["The answer", "e1", 0.441, "need"], ["Token counts", "e2", 0.022, "extra"], ["Speed", "e2", 0.333, "extra"], ["Errors", "e2", 0.509, "extra"], ["Kept or undone edits", "e2", 0.668, "extra"], ["Crash reports", "e3", 0.173, "extra"], ["Ratings", "e3", 0.449, "choice"], ["Feedback", "e3", 0.679, "choice"], ["Saved conversations", "f2", 0.014, "extra"], ["Training", "f3", 0.074, "extra"], ["Human review", "f3", 0.541, "extra"], ["Shared links", "f3", 0.999, "choice"], ["Cloud copies", "f4", 0.531, "choice"], ["Local transcripts", "f4", 0.752, "extra"], ["Website visits", "f5", 0.142, "extra"], ["Billing", "f5", 0.55, "need"], ["Support messages", "f5", 0.767, "choice"]];
const NOPOP = new Set(['Device ID', 'System', 'Terminal', 'App version']); // usage data, on by default in many tools: no pop-up asks
const ORDER = ['need', 'extra', 'choice'];
let EV = null;
const events = () => EV ??= ITEMS.map(([s, id, f, c]) => ({ s, c, t: C[id] + (C[id + 'n'] - C[id]) * f })).sort((a, b) => a.t - b.t);
const pop = (t, t0, d = 0.5) => { const a = t - t0; return a < 0 || a > d * 2.2 ? 0 : Math.exp(-a * 7 / d) * Math.sin(a * 22 / d) * (1 - a / (d * 2.2)); };

function panel(x, X, Y, W, H, a) { x.save(); x.globalAlpha *= a; x.shadowColor = 'rgba(4,2,24,0.55)'; x.shadowBlur = 26 * x.getTransform().a; x.shadowOffsetY = 8 * x.getTransform().a; x.fillStyle = 'rgba(14,8,52,0.62)'; x.fill(rr(X, Y, W, H, 22)); x.restore(); x.save(); x.globalAlpha *= a; x.strokeStyle = 'rgba(214,200,255,0.28)'; x.lineWidth = 1.6; x.stroke(rr(X + 0.8, Y + 0.8, W - 1.6, H - 1.6, 21)); x.fillStyle = 'rgba(255,255,255,0.06)'; x.fill(rr(X + 3, Y + 3, W - 6, H * 0.42, 19)); x.restore(); }

function tally(x, t) {
  // top right, quiet: how many kinds of data have left so far
  const E = events(), t0 = E[0].t - 0.7, t1 = C.g1 - 0.25, hr0 = sw('f3', 32), hr1 = C.f4, a = ease.io2(clamp((t - t0) / 0.5)) * (1 - ease.io2(clamp((t - t1) / 0.5))) * (1 - clamp((t - hr0 + 0.4) / 0.4) * (1 - clamp((t - hr1) / 0.4))); if (a <= 0) return;
  const done = E.filter(e => e.t <= t), n = done.length, last = done[n - 1], b = last ? pop(t, last.t, 0.45) : 0, X = 1920 - 60, Y = 62;
  x.save(); x.globalAlpha *= a; x.shadowColor = 'rgba(6,3,26,0.6)'; x.shadowBlur = 14 * x.getTransform().a;
  x.save(); x.translate(X, Y); x.scale(1 + b * 0.16, 1 + b * 0.16); text(x, String(n), 0, 0, '#ffffff', 46, { w: 800, align: 'right' }); x.restore();
  text(x, 'kinds of data', X, Y + 34, 'rgba(232,226,255,0.82)', 19, { w: 700, align: 'right' }); x.restore();
}

// the prompt you still haven't typed: dim, blinking, until the four words go in
const WORDS = 'fix the login bug';
function prompt(x, t) {
  const t0 = C.a1 + 0.8, k0 = ST.key0, k1 = ST.enter - 0.5, t1 = ST.enter + 1.1, a = ease.io2(clamp((t - t0) / 0.6)) * (1 - ease.io2(clamp((t - t1) / 0.4))); if (a <= 0) return;
  const n = Math.round(clamp((t - k0) / (k1 - k0)) * WORDS.length), s = WORDS.slice(0, n), lit = clamp((t - k0 + 0.3) / 0.3), flash = ST.enter > 0 ? pop(t, ST.enter, 0.6) : 0;
  const W = 380, H = 64, X = 56, Y = 32; x.save(); x.translate(0, -(1 - ease.out3(clamp((t - t0) / 0.6))) * 30 - Math.max(0, clamp((t - ST.enter) / 0.4)) * 40);
  panel(x, X, Y, W, H, a); x.save(); x.globalAlpha *= a * lerp(0.62, 1, lit); if (lit > 0) glow(x, X + W / 2, Y + H / 2, 260, K.need, 0.25 * lit + flash * 0.6);
  const fs = 26, px = X + 26, py = Y + H / 2 + 1; text(x, '$', px, py, lit > 0 ? K.need : 'rgba(210,200,255,0.7)', fs, { mono: true, w: 800, align: 'left' }); const w = text(x, s, px + 30, py, '#ffffff', fs, { mono: true, w: 700, align: 'left' });
  if (n === 0) text(x, 'not typed yet', X + W - 22, py, 'rgba(210,200,255,0.55)', 18, { w: 700, align: 'right' });
  if (Math.floor(t * 2.4) % 2 === 0 || (n > 0 && n < WORDS.length)) { x.fillStyle = lit > 0 ? K.need : 'rgba(220,210,255,0.85)'; x.fillRect(px + 32 + w, py - 14, 13, 28); }
  x.restore(); x.restore();
}

// the breakdown under the full bloom
function breakdown(x, t) {
  const a = ease.io2(clamp((t - FT.wide - 0.2) / 0.7)) * (1 - ease.io2(clamp((t - FT.fall - 0.3) / 0.6))); if (a <= 0) return;
  const parts = [['46 kinds of data', null], ['17 needed', 'need'], ['22 on top', 'extra'], ['7 only if you choose', 'choice']], fs = 30, gap = 46;
  const ws = parts.map(([s, c]) => tw(x, s, fs, { w: 800 }) + (c ? 30 : 0)), Wt = ws.reduce((p, q) => p + q, 0) + gap * (parts.length - 1) + 64, X = 960 - Wt / 2, Y = 1080 - 230;
  x.save(); x.translate(0, (1 - ease.out3(clamp((t - FT.wide - 0.2) / 0.7))) * 24); panel(x, X, Y, Wt, 64, a); x.save(); x.globalAlpha *= a; let px = X + 32;
  parts.forEach(([s, c], i) => { if (c) { glow(x, px + 9, Y + 32, 30, CODE[c][0], 0.4); x.fillStyle = CODE[c][0]; x.beginPath(); x.arc(px + 9, Y + 32, 9, 0, Math.PI * 2); x.fill(); } text(x, s, px + (c ? 30 : 0), Y + 33, i ? '#ffffff' : '#fff6dd', fs, { w: i ? 700 : 900, align: 'left' }); px += ws[i] + gap; if (i < parts.length - 1) { x.fillStyle = 'rgba(220,210,255,0.4)'; x.beginPath(); x.arc(px - gap / 2, Y + 32, 3, 0, Math.PI * 2); x.fill(); } });
  x.restore(); x.restore();
}

// ---- who does what: small brand cards that appear on the word that names each tool (facts in research/matrix_*.local.md)
const sw = (id, k) => C[id] + (VW[id]?.[k] ?? 0);
const DISC = { claudecode: '#b4532f', codex: '#3328c4', cline: '#3c3c58', gemini: '#2a3cc8', antigravity: '#2638b8', devin: '#0e5a50', kilo: '#2a2a22', copilot: '#5a34d8', zed: '#2c3c78' };
// [line, items [logo, name, note, word index (or [word, note2 index, note2])], end (line, word or 'next'), y]
const CALLOUTS = [
  ['a31', [['codex', 'Codex', 'device ID', 8], ['cline', 'Cline', 'device ID', 9], ['gemini', 'Gemini CLI', 'install ID', 11]], ['a32', -0.25], 190],
  ['f2', [['claudecode', 'Claude Code', '30 days · 5 years with training', 8], [null, 'Kiro', 'free tier: up to 60 days', 19], ['antigravity', 'Antigravity', 'sharing on: until you ask to delete', 26], ['devin', 'Devin Desktop', 'as long as you are a customer', 37]], ['f3', -0.3], 192],
  ['f3', [['copilot', 'GitHub Copilot', 'trains by default', 0], ['codex', 'Codex', 'trains by default', 2], [null, 'Kiro', 'trains by default', 3], ['devin', 'Devin Desktop', 'free plan: no opt-out', 5], ['claudecode', 'Claude Code', 'trains unless you opt out', 21]], ['f3w', 32], 880],
  ['f3', [['antigravity', 'Antigravity', 'Google reviewers · sharing on', 40], ['gemini', 'Gemini API', 'free key: human reviewers', 47], ['copilot', 'GitHub Copilot', 'GitHub & Microsoft staff', 51]], ['f4', -0.3], 846],
  ['f4', [['kilo', 'Kilo Code', 'anyone with the link', 4, 'signed in: every session uploaded', 20], ['devin', 'Devin', 'keeps a copy of your project', 27], ['claudecode', 'Claude Code', 'local transcripts · 30 days', 35]], ['f5', -0.3], 200],
];
function cards(x, t) {
  CALLOUTS.forEach(([id, items, [eid, ek], y]) => {
    const t0 = sw(id, items[0][3]) - 0.15, t1 = eid === 'f3w' ? sw('f3', ek) - 0.25 : C[eid] + ek; if (t < t0 - 0.1 || t > t1 + 0.5) return;
    const out = 1 - ease.in2(clamp((t - t1) / 0.4)), fs = 27, ns = 21, H = 84, gap = 16;
    const ws = items.map(([lg, nm, note, k, n2]) => Math.max(tw(x, nm, fs, { w: 800 }), tw(x, note, ns, { w: 600 }), n2 ? tw(x, n2, ns, { w: 700 }) + 4 : 0) + (lg ? 96 : 40));
    const tot = ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1); let px = 960 - tot / 2;
    items.forEach(([lg, nm, note, k, n2, k2], i) => {
      const ta = sw(id, k) - 0.1, a = ease.out3(clamp((t - ta) / 0.3)) * out, w = ws[i]; if (a > 0.01) {
        const second = n2 && t > sw(id, k2) - 0.1, h2 = second ? 26 : 0, X = px, Y = y - (H + h2) / 2 + (1 - a) * 10;
        x.save(); x.globalAlpha *= a;
        x.save(); x.shadowColor = 'rgba(6,3,26,0.45)'; x.shadowBlur = 18 * x.getTransform().a; x.fillStyle = 'rgba(16,10,44,0.8)'; x.fill(rr(X, Y, w, H + h2, 20)); x.restore();
        x.strokeStyle = 'rgba(220,212,255,0.16)'; x.lineWidth = 1.5; x.stroke(rr(X + 0.75, Y + 0.75, w - 1.5, H + h2 - 1.5, 19));
        let tx = X + 20; if (lg) { x.fillStyle = DISC[lg] || '#333'; x.beginPath(); x.arc(X + 46, Y + H / 2, 27, 0, Math.PI * 2); x.fill(); logo(x, lg, X + 46, Y + H / 2, 34); tx = X + 84; }
        text(x, nm, tx, Y + 30, '#ffffff', fs, { w: 800, align: 'left' }); text(x, note, tx, Y + 59, 'rgba(232,226,255,0.9)', ns, { w: 600, align: 'left' });
        if (second) { x.save(); x.globalAlpha *= clamp((t - sw(id, k2) + 0.1) / 0.3); text(x, n2, tx, Y + 85, '#ffd38a', ns, { w: 700, align: 'left' }); x.restore(); }
        x.restore();
      }
      px += w + gap;
    });
  });
}
export function hud(x, t) { if (t < C.a1) return; tally(x, t); cards(x, t); breakdown(x, t); }
export const HUD_ITEMS = ITEMS;
