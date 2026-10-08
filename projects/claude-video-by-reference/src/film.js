// Shot list -> frame renderer. Chapters are continuous shots; liquid splash wipes cover the
// chapter changes listed in TRANSITIONS (outgoing chapter drawn before the splash's mid, incoming after).
import { P } from './palette.js';
import { C } from './timeline.js';
import { splash } from './splash.js';
import { hook } from './shots/hook.js';
import { study, BOOK } from './shots/study.js';
import { imagine } from './shots/imagine.js';
import { animate, CV } from './shots/animate.js';
import { compose, MP4 } from './shots/compose.js';
import { deliver } from './shots/deliver.js';
import { styles } from './shots/styles.js';
import { outro } from './shots/outro.js';

const shots = [...hook, ...study, ...imagine, ...animate, ...compose, ...deliver, ...styles, ...outro].sort((a, b) => a.start - b.start);

export const TRANSITIONS = [
  { t0: C.splash1, dur: 0.85, cx: BOOK.x - 125, cy: BOOK.y, colors: [P.butter, '#f59a2a'], seed: 3 },
  { t0: C.splash3, dur: 0.85, cx: CV.x, cy: CV.y, colors: [P.roseLt, P.rose], seed: 8, swirl: -0.6 },
  { t0: C.deliver - 0.4, dur: 0.85, cx: MP4.x + 300, cy: MP4.y - 250, colors: [P.sky, P.cobaltLt], seed: 12 },
  { t0: C.splash4, dur: 0.85, cx: 960, cy: 700, colors: [P.lilac, P.violetLt], seed: 21, swirl: -0.5 },
];

export const film = {
  duration: Math.min(C.fin, shots[shots.length - 1].end),
  shots,
  // flat motion graphics at 30 fps: crisp supersampled edges, a short shutter to soften fast zooms
  render: { supersample: 1.5, motionBlur: 1, shutter: 0.35 },
  async load() {},
  draw(ctx, t) {
    const s = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    ctx.save();
    ctx.fillStyle = P.ink; ctx.fillRect(0, 0, 1920, 1080); // never inherit the previous frame
    const fx = s.draw(ctx, t) || {};
    ctx.restore();
    for (const tr of TRANSITIONS) splash(ctx, t, tr);
    return fx;
  },
};
