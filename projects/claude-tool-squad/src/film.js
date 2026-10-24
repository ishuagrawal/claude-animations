// Shot list -> frame renderer. Each shot module exports [{ name, start, end, draw(ctx, t) }];
// draw returns post params ({ k, vig, grain, contrast, saturation, tint, tintAmt, ca, flash, flashCol }).
import { P } from './palette.js';
import { C } from './timeline.js';
import { loadBG } from './bg.js';
import { loadPlates } from './plates.js';
import { setLight } from './cel.js';
import { act1 } from './shots/act1.js';
import { act2 } from './shots/act2.js';
import { act3 } from './shots/act3.js';

const shots = [...act1, ...act2, ...act3].sort((a, b) => a.start - b.start);

// Anime post (style bible): flat lens, light vignette, faint grain, a touch of saturation and
// chromatic fringe like an SD broadcast.
export const POST = { k: 0, vig: 0.2, grain: 0.024, saturation: 1.1, contrast: 1.03, ca: 0.8, soft: 0.35, bloom: 0.45 };

export const film = {
  duration: C.end,
  shots,
  hold: 2, // everything on 2s (measured: ≈12 images/s, pans included)
  render: { supersample: 1.25 },
  async load() { await loadBG(); loadPlates(); },
  draw(ctx, t) {
    const s = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    if (!s || t >= s.end) { ctx.fillStyle = P.ink; ctx.fillRect(-4000, -4000, 9000, 9000); return { ...POST, vig: 0 }; }
    setLight();
    ctx.save();
    const fx = s.draw(ctx, t) || {};
    ctx.restore();
    return { ...POST, ...fx };
  },
};
