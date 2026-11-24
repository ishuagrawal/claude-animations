// Dumps the cue sheet and every panel's sound cues to out/cues.json for the score.
import { writeFile, mkdir } from 'node:fs/promises';
import { C, RING, PANEL_DUR, panelStart, DURATION } from '../src/timeline.js';
const out = { C, DURATION, PANEL_DUR, panels: [] };
for (let i = 0; i < RING.length; i++) { const id = RING[i][0]; let sfx = []; try { sfx = (await import(`../src/panels/${id}.js`)).default.sfx || []; } catch (e) { console.log('no', id, String(e.message).split('\n')[0]); } sfx = sfx.map(c => ({ ...c, t: c.t < 1.25 ? Math.max(-0.2, (c.t - 0.42) / (0.83 / 1.25)) : c.t })); out.panels.push({ id, t: panelStart(i), sfx }); }
await mkdir(new URL('../out/', import.meta.url), { recursive: true }); await writeFile(new URL('../out/cues.json', import.meta.url), JSON.stringify(out, null, 1)); console.log('cues', out.panels.reduce((a, p) => a + p.sfx.length, 0));
