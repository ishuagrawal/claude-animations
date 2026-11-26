// The vault: shaft -> round archive -> ladder ride -> Git tree -> AGENTS.md wave -> code galaxy -> the July 2026 storm -> updraft.
import * as fall from './vault_fall.js';
import * as tree from './vault_tree.js';
import * as wave from './vault_wave.js';
import * as gal from './vault_galaxy.js';
import * as storm from './vault_storm.js';
import { label, clamp } from '../ink.js';
import { C, word } from '../timeline.js';
const LB = [['File names', 'need', word('b2', 3) - 0.1, fall.TS - 0.35, 620], ['Git branch', 'need', tree.TS + 0.1, tree.UNC + 0.08], ['Uncommitted changes', 'need', tree.UNC + 0.14, tree.LAT + 0.32], ['Recent commits', 'need', tree.LAT + 0.4, C.b3 + 0.26], ['Instruction files', 'need', wave.TE + 0.14, wave.MEM - 0.05], ['Memories', 'need', wave.MEM + 0.06, wave.REAR - 0.1], ['Code index', 'need', gal.LIP + 0.75, gal.COP - 0.06], ['Whole repository (one case)', 'extra', storm.SEND - 0.05, storm.LEAP + 0.1]];
const SCENES = [[fall.TS, (x, t) => fall.draw(x, t, (g, q) => { if (q > fall.TS - 1.2) tree.stump(g, q); })], [wave.T0, tree.draw], [gal.LIP, wave.draw], [gal.SU, gal.draw], [Infinity, storm.draw]];
export function draw(x, t) {
  const fx = SCENES.find(s => t < s[0])[1](x, t);
  LB.forEach(([s, c, a, b, px]) => { const o = clamp((t - b) / 0.13); if (t < a || o >= 1) return; x.save(); x.globalAlpha *= 1 - o; x.translate(0, -o * 26); label(x, s, px || 960, 96, 74, t, a, null, c); x.restore(); });
  return fx;
}
const FAST = [[fall.TF - 0.2, fall.TB + 0.1], [fall.K1 - 0.1, fall.TG + 0.15], [fall.JA - 0.1, fall.JB + 0.2], [fall.TS - 0.1, tree.TS + 0.75], [tree.UNC - 0.05, tree.UNC + 0.3], [wave.HOP - 0.1, wave.ON + 0.1], [wave.OFF - 0.05, wave.LND + 0.15], [wave.LIP - 0.4, wave.LIP + 0.6], [gal.CUT - 0.35, gal.CUT + 0.25], [gal.NUM - 0.35, gal.NUM + 0.25], [gal.CUR - 0.25, gal.CUR + 0.3], [gal.SU, storm.GR + 0.2], [storm.STAMP - 0.3, storm.STAMP + 0.3], [storm.UPR - 0.1, storm.UPR + 0.5], [storm.LEAP, storm.GRAB + 0.15], [storm.CLU - 0.1, storm.CLU + 0.3]];
export const samples = (t, n) => (FAST.some(([a, b]) => t > a && t < b) ? n * 2 : n);
