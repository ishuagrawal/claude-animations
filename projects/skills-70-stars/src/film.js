// Shot list -> frame renderer. Each shot module exports [{ name, start, end, draw(ctx, t) }];
// draw returns post params ({ vig, grain, contrast, saturation, tint, tintAmt, flash, flashCol }).
import { P } from './palette.js';
import { C } from './timeline.js';
import { loadFonts } from './type.js';
import { aOpen } from './shots/a_open.js';
import { bConfig } from './shots/b_config.js';
import { cCard } from './shots/c_card.js';
import { eCake } from './shots/e_cake.js';
import { gEnd } from './shots/g_end.js';

const shots = [...aOpen, ...bConfig, ...cCard, ...eCake, ...gEnd].sort((a, b) => a.start - b.start);

export const film = {
  duration: C.end,
  shots,
  // flat vector style: crisp edges, every frame on 1s, no motion blur (the reference has none)
  render: { supersample: 1.25 },
  async load() { await loadFonts(); },
  draw(ctx, t) {
    const s = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    if (!s) { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, 1920, 1080); return { vig: 0, grain: 0 }; }
    ctx.save();
    const fx = s.draw(ctx, t) || {};
    ctx.restore();
    return fx;
  },
};
