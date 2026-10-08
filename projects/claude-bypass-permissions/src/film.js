// Shot list -> frame renderer.
import { P } from './palette.js';
import { bg } from './draw.js';
import { act1 } from './shots/act1.js';
import { act2a } from './shots/act2a.js';
import { act2b } from './shots/act2b.js';
import { act2c } from './shots/act2c.js';
import { act3 } from './shots/act3.js';
import { C } from './timeline.js';

const shots = [...act1, ...act2a, ...act2b, ...act2c, ...act3].sort((a, b) => a.start - b.start);

export const film = {
  duration: C.end,
  shots,
  draw(ctx, t) {
    const s = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    if (!s || t >= s.end) { bg(ctx, P.ink); return { vig: 0 }; }
    ctx.save();
    const fx = s.draw(ctx, t) || {};
    ctx.restore();
    return fx;
  },
};
