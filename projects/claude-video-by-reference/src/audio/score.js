// The soundtrack: an original upbeat explainer bed (120 BPM, G major, I–V–vi–IV family) + UI-style
// Foley on every on-screen action, synthesized offline from the cue sheet (sample-accurate).
// Music bars run on odd seconds (downbeat n at 1 + 2n) so every chapter but ④ starts on a downbeat.
import { makeEngine } from './engine.js';
import { makeKit } from './kit.js';
import { C, STAFF_MELODY, SFX_MARKS } from '../timeline.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;
const DB = n => 1 + n * 2;            // music downbeat of bar n

const CH = {
  G: { uke: [62, 67, 71, 74], bass: 43, arp: [67, 71, 74, 79] },
  D: { uke: [62, 66, 69, 74], bass: 50, arp: [66, 69, 74, 78] },
  Em: { uke: [64, 67, 71, 76], bass: 52, arp: [67, 71, 76, 79] },
  C: { uke: [60, 64, 67, 72], bass: 48, arp: [64, 67, 72, 76] },
};
// bar-by-bar chords (bars 0..30 cover 1 s .. 63 s)
const PROG = [
  'G', 'Em', 'C', 'D',          // hook
  'G', 'D', 'Em', 'C',          // ① study
  'Em', 'C', 'G', 'D',          // ② imagine
  'G', 'D', 'Em', 'C',          // ③ animate
  'G', 'Em', 'C',               // ④ compose
  'G', 'D', 'Em',               // deliver (chorus)
  'C', 'D', 'G',                // any style
  'G', 'C', 'D',                // tips
  'G', 'D', 'G', 'G',           // end
];
// arrangement density per bar: 0 light, 1 groove, 2 full
const DENS = [0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 0, 1, 1, 2, 2, 2, 2];

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  const K = makeKit(A);
  music(A, K, duration);
  foley(A, K);
  const g = A.buses.master.gain;
  g.setValueAtTime(0.9, Math.max(0, duration - 0.45)); g.linearRampToValueAtTime(0.0001, duration - 0.02);
  return ctx.startRendering();
}

// ------------------------------------------------------------- music
function music(A, K, duration) {
  const STRUM = [[0, 1, 0.9], [2, 1, 0.7], [3, -1, 0.55], [5, -1, 0.6], [6, 1, 0.8], [7, -1, 0.5]];
  // pickup
  K.marimba(0.5, 71, 0.7); K.marimba(0.75, 74, 0.8);
  PROG.forEach((name, n) => {
    const t0 = DB(n);
    if (t0 >= duration - 0.3) return;
    const ch = CH[name], d = DENS[n] ?? 1;
    const flaw = n === 15; // ③ "uh-oh": the band drops to bass for a beat
    const muted = t => flaw && t >= C.flaw - 0.05 && t < C.fix;
    // ukulele strums
    STRUM.forEach(([e, dir, v]) => {
      const t = t0 + e * E8;
      if (!muted(t)) K.uke(t, ch.uke, { v: v * (d === 0 ? 0.75 : 0.9), dir });
    });
    // bass
    if (n >= 1) {
      [[0, 1.4], [3, 0.4], [4, 0.9], [7, 0.3]].forEach(([e, dur], k) => {
        if (d === 0 && k % 2) return;
        K.bass(t0 + e * E8, ch.bass + (k === 3 ? 12 : 0), dur * 0.5, 0.9);
      });
    }
    // drums
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * E8;
      if (muted(t)) continue;
      if (d >= 1 && (e === 0 || e === 4)) K.kick(t, e ? 0.8 : 1);
      if (d >= 2 && e === 7) K.kick(t, 0.5);
      if (e === 2 || e === 6) { if (d >= 1) K.clap(t, 0.85); else K.snap(t, 0.9); }
      K.shaker(t, e % 2 ? 0.6 : 1);
      if (d >= 2) K.shaker(t + S16, 0.45);
    }
    // marimba arpeggio (groove sections), skipped where the staff melody plays
    if (d >= 1 && !(t0 >= 33 && t0 < 39)) {
      for (let e = 0; e < 8; e++) { if (e % 2 && d < 2) continue; if (!muted(t0 + e * E8)) K.marimba(t0 + e * E8, ch.arp[[0, 1, 2, 3, 2, 1, 2, 3][e]], 0.42, 0.25); }
    }
    if (d >= 2 && n % 4 === 0) K.pad(t0, ch.uke.map(m => m - 12), 2, 0.7);
  });

  // ---- chapter accents
  [C.study, C.imagine, C.animate, C.deliver, C.styles, C.tips, C.end].forEach(t => K.crash(t, 0.8));
  // drum fill into ① (claps on 16ths)
  for (let k = 0; k < 4; k++) K.clap(C.study - 0.5 + k * S16, 0.4 + k * 0.15);
  // ① "measure the music": glock picks out the beat when the music card appears
  [0, 1, 2, 3].forEach(k => K.glock(C.music + 0.5 + k * BEAT, [79, 83, 86, 91][k], 0.55, 0.3));
  // ② storyboard cards snap one note each, climbing
  C.cards.forEach((t, i) => K.marimba(t, [79, 83, 86][i], 1.1, 0));
  // ③ ascending glock run while the colors pour in; crash when it comes alive
  for (let k = 0; k < 8; k++) K.glock(C.fill + k * 0.125, [67, 71, 74, 79, 83, 86, 91, 95][k], 0.45, (k - 4) * 0.1);
  K.crash(C.alive, 0.7); K.kick(C.alive, 1);
  // ④ the staff melody — exactly the notes drawn on screen
  STAFF_MELODY.forEach(([t, m]) => { K.glock(t, m, 1.0, 0.05); K.marimba(t, m - 12, 0.7, -0.05); });
  // deliver: the whistled hook (original)
  const hook = [[0, 74, 1], [1, 79, 1], [2, 78, 0.5], [2.5, 79, 0.5], [3, 81, 1], [4, 81, 1.5], [5.5, 78, 0.5], [6, 74, 1], [7, 76, 1], [8, 79, 1], [9, 76, 0.5], [9.5, 74, 0.5], [10, 71, 2]];
  hook.forEach(([b, m, d]) => K.whistle(C.deliver + b * BEAT, m, d * BEAT * 0.92, 1));
  // any style: each style's signature layer on its beat
  K.chip(C.style[0], [67, 71, 74, 79, 83, 86, 91], 1); K.chip(C.style[0] + 0.5, [91, 86, 83, 79], 0.8);
  K.sparkle(C.style[1], 1.4); A.inst.stab(C.style[1], [62, 66, 69, 74], 0.25, 0.8);
  K.harp(C.style[2], [67, 71, 74, 79, 83, 86, 91, 95, 98], 1);
  K.squish(C.style[3], 1.2); K.boing(C.style[3] + 0.5, 0.8);
  K.paper(C.style[4], 1.2); K.snap(C.style[4] + 0.25, 1); K.snap(C.style[4] + 0.5, 1);
  // end: whistle tag, final chord + glock sparkle on the wink
  [[0, 79, 1], [1, 81, 1], [2, 83, 1], [3, 86, 1], [4, 83, 1], [5, 81, 0.5], [5.5, 79, 0.5]].forEach(([b, m, d]) => K.whistle(C.end + b * BEAT, m, d * BEAT * 0.92, 0.9));
  K.whistle(C.wink, 79, 1.3, 0.9);
  K.uke(C.wink, CH.G.uke, { v: 1.1, len: 1.4 }); K.uke(C.wink + 0.02, CH.G.uke.map(m => m + 12), { v: 0.6, len: 1.4 });
  K.bass(C.wink, 43, 1.4, 1); K.kick(C.wink, 1); K.crash(C.wink, 0.9);
  [91, 95, 98, 103].forEach((m, i) => K.glock(C.wink + 0.05 + i * 0.07, m, 0.6, (i - 1.5) * 0.3));
}

// ------------------------------------------------------------- foley
function foley(A, K) {
  K.room(0, C.fin);
  // HOOK
  K.whoosh(C.phoneIn, 0.5, 0.8, 250, 1800);
  K.swish(C.capLove, 0.5);
  for (let i = 0; i < 9; i++) K.bloop(C.hearts + i * 0.16 + 0.1, 0.5, 1 + (i % 3) * 0.25, 0.3);
  K.whoosh(C.claudeHop - 0.1, 0.4, 0.6, 400, 2500, 0.5); K.boing(C.claudeHop, 0.9); K.land(C.claudeLand, 1);
  K.sparkle(C.claudeLand + 0.25, 0.9); K.boing(C.claudeLand + 0.55, 0.5);
  K.click(C.share, 1, 0.3); K.pop(C.bubbleOut, 0.9, 1.2, 0.2); K.whoosh(C.bubbleOut, 0.7, 0.8, 600, 3000, 0.4); K.pop(C.bubbleLand, 1, 0.9, 0.4);
  K.whoosh(C.bubbleLand + 0.15, 0.5, 0.5, 2000, 300);
  K.swish(C.title, 0.6); K.pop(C.title + 0.3, 1, 0.8); K.chime(C.title + 0.35, 0.8, 79);
  K.riser(C.zoom1 - 0.1, C.study - C.zoom1 + 0.1, 0.8); K.whoosh(C.zoom1, C.study - C.zoom1, 1, 300, 5000);
  // ① STUDY
  K.whoosh(C.study, 0.8, 0.7, 4000, 400);
  K.pop(C.badge1, 1, 1.1); K.swish(C.cap1, 0.5);
  K.pop(C.study + 0.8, 0.7, 0.8); // magnifier arrives
  for (let k = 0; k < 5; k++) { K.bloop(C.colors + k * 0.09, 0.7, 1.2 + k * 0.15); K.pop(C.colors + 0.55 + k * 0.09, 0.45, 1.4 + k * 0.1); }
  K.pop(C.colors, 0.8); K.pop(C.timing, 0.8); K.pop(C.music, 0.8);
  K.whoosh(C.timing, 0.3, 0.5, 2000, 600); K.snip(C.timing + 0.32, 1); K.snip(C.timing + 0.5, 0.8); K.tick(C.timing + 0.9, 0.8);
  K.flip(C.bookIn, 0.9); K.whoosh(C.chipsFly, 0.6, 0.8, 500, 2500); K.thump(C.bookClose, 1.1); K.sparkle(C.bookClose + 0.1, 1); K.boing(C.bookClose + 0.1, 0.5);
  K.swish(C.cap1b, 0.5);
  K.sploosh(C.splash1, 0.85, 1);
  // ② IMAGINE
  K.pop(C.badge2, 1, 1.1); K.swish(C.cap2a, 0.5);
  A.fx.whistleDown(C.frameDrop - 0.05, 0.45, 0.5); K.thump(C.frameDrop + 0.45, 0.8); K.pop(C.frameDrop + 0.5, 1, 0.7); A.fx.crackle(C.frameDrop + 0.5, 0.25, 40, 0.6, 3000);
  C.shake.forEach(t => { K.rattle(t, 1); for (let i = 0; i < 9; i++) K.clink(t + 0.25 + i * 0.035, 0.8, (i - 4) * 0.08); });
  K.boing(C.catLift, 0.8); K.whoosh(C.catLift + 0.4, 1.2, 0.7, 300, 1200, -0.6); K.bloop(C.catLift + 0.6, 0.8, 1.6, -0.5); K.bloop(C.catLift + 0.7, 0.6, 1.9, -0.5);
  K.swish(C.cap2b, 0.5);
  K.whoosh(C.bulb - 0.3, 0.4, 0.5, 1500, 300); K.ding(C.bulb, 1, 91); K.boing(C.bulb + 0.05, 0.4);
  C.cards.forEach(t => { K.whoosh(t - 0.35, 0.35, 0.4, 600, 2800); K.click(t, 1); });
  K.riser(C.zoom2 - 0.2, C.animate - C.zoom2 + 0.2, 0.7); K.whoosh(C.zoom2, C.animate - C.zoom2, 0.9, 300, 4500);
  // ③ ANIMATE
  K.whoosh(C.animate, 0.8, 0.6, 4000, 400);
  K.pop(C.badge3, 1, 1.1); K.swish(C.cap3a, 0.5); K.pop(C.animate + 0.5, 0.7, 0.9);
  K.typing(C.code, C.fill - 0.2, 12, 1);
  K.scribble(C.lines, C.fill - 0.25, 1);
  K.whoosh(C.fill - 0.75, 0.5, 0.6, 400, 2000, 0.6); K.glug(C.fill, C.alive - 0.4, 1);
  K.pop(C.alive, 1, 1.2); K.click(C.alive + 0.05, 0.6);
  K.whoosh(C.grid - 0.05, 0.7, 0.7, 2500, 500);
  for (let i = 0; i < 11; i++) K.pop(C.grid + 0.28 + i * 0.045, 0.35, 1.3 + (i % 3) * 0.2, (i % 4 - 1.5) * 0.3);
  K.swish(C.cap3b, 0.5);
  K.pop(C.loupe, 0.7); K.whoosh(C.loupe, C.flaw - C.loupe, 0.4, 800, 1600);
  K.uhoh(C.flaw); K.pop(C.flaw, 0.8, 0.7);
  K.whoosh(C.fix, 0.35, 0.6, 600, 4000); K.sparkle(C.fix + 0.2, 1);
  for (let i = 0; i < 12; i++) K.ding(C.checks + i * 0.045, 0.22, [86, 88, 91, 93, 95, 98][i % 6]);
  K.boing(C.checks + 0.2, 0.6);
  K.sploosh(C.splash3, 0.85, 1);
  // ④ COMPOSE
  K.pop(C.badge4, 1, 1.1); K.swish(C.cap4, 0.5); K.pop(C.score + 0.6, 0.6, 0.8); // headphones
  for (let i = 0; i < 7; i++) K.pop(C.score + 0.15 + i * 0.05, 0.3, 1.2 + i * 0.05);
  SFX_MARKS.forEach(mk => {
    if (mk.kind === 'whoosh') K.whoosh(mk.t - 0.15, 0.45, 1, 400, 4000, -0.2);
    else if (mk.kind === 'pop') K.pop(mk.t, 1.4, 1);
    else K.ding(mk.t, 1.3, 91);
  });
  K.reverse(C.rollUp, 0.5, 0.9); K.pop(C.mp4, 1.2, 0.9); K.chime(C.mp4 + 0.05, 0.8, 84);
  K.whoosh(C.deliver - 0.4, 0.5, 0.9, 500, 4000, 0.6);
  K.sploosh(C.deliver - 0.4, 0.85, 0.9);
  // DELIVER
  K.whoosh(C.phone2, 0.5, 0.7, 250, 1800);
  K.whoosh(C.mp4In, C.play - C.mp4In, 0.8, 4000, 600, 0.6); K.bloop(C.play - 0.05, 1, 0.8); K.click(C.play, 0.8);
  K.pop(C.play + 0.35, 0.7, 1); K.pop(C.play + 0.45, 0.7, 1.2); K.swish(C.capSame, 0.5);
  for (let i = 0; i < 10; i++) K.bloop(C.hearts2 + i * 0.13 + 0.1, 0.45, 1 + (i % 3) * 0.25, 0.1);
  K.boing(C.proud, 0.9); K.land(C.proud + 0.55, 1); K.sparkle(C.proud + 0.6, 0.9);
  K.riser(C.zoom3 - 0.1, C.styles - C.zoom3 + 0.1, 0.6); K.whoosh(C.zoom3, C.styles - C.zoom3, 0.9, 300, 4500);
  // ANY STYLE
  K.whoosh(C.styles, 0.5, 0.6, 3000, 600); K.swish(C.capAny, 0.6);
  C.style.forEach(t => { K.whoosh(t - 0.08, 0.3, 0.8, 600, 5000); K.pop(t + 0.12, 0.5, 1.3); });
  K.sploosh(C.splash4, 0.85, 1);
  // TIPS
  K.swish(C.capTips, 0.6);
  C.tip.forEach((t, i) => { K.pop(t, 1.1, 0.9 + i * 0.15); K.marimba(t, [79, 83, 86][i], 1, 0, A.buses.sfx); K.swish(t + 0.15, 0.4); });
  K.reverse(C.collapse - 0.1, 0.45, 0.8); K.whoosh(C.end - 0.38, 0.4, 0.7, 500, 3500);
  // END
  K.pop(C.pill, 1.3, 0.8); A.fx.crackle(C.pill + 0.05, 0.6, 50, 0.5, 6000);
  K.boing(C.hopOn, 0.8); K.land(C.hopOn + 0.5, 1);
  K.swish(C.tagline, 0.5); K.swish(C.ps, 0.4);
  K.sparkle(C.wink, 1.2);
}

// 16-bit PCM WAV
export function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length;
  const out = new Uint8Array(44 + n * ch * 2);
  const v = new DataView(out.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return out;
}
