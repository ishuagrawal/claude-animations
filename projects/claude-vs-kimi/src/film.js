// Shot list -> frame renderer. Each shot module exports [{ name, start, end, draw(ctx, t, world) }];
// a shot poses the 3D world for t, then calls world render helpers; it returns post params
// ({ vig, grain, contrast, saturation, tint, tintAmt, ca, flash, flashCol }).
import { W, H, onN } from './core.js';
import { CAMLOCK, RENDER } from './gl/view.js';
import { C } from './timeline.js';
import { makeWorld } from './world/world.js';
import { act1 } from './shots/act1.js';
import { act2 } from './shots/act2.js';
import { act3 } from './shots/act3.js';

const SS = 1.25;
const shots = [...act1, ...act2, ...act3].sort((a, b) => a.start - b.start);
let world = null;
const dummy = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }).getContext('2d');

export const film = {
  duration: C.end,
  shots,
  render: { supersample: SS },
  async load() {
    world = makeWorld(SS);
    await Promise.all(['italic 800 80px Futura', '80px "Arial Rounded MT Bold"', '900 80px "Songti SC"'].map(f => document.fonts.load(f, '对决ABC')));
  },
  draw(ctx, t) {
    const s = shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    // pass 1: smooth time, camera only (recorded, nothing rendered)
    CAMLOCK.mode = 'record'; CAMLOCK.rec = null; RENDER.off = true;
    dummy.save(); s.draw(dummy, t, world); dummy.restore();
    RENDER.off = false;
    // pass 2: everything else on twos, camera replayed
    CAMLOCK.mode = CAMLOCK.rec ? 'replay' : 'off';
    ctx.save();
    ctx.fillStyle = '#07061a'; ctx.fillRect(0, 0, W, H);
    const fx = s.draw(ctx, onN(t, 2), world) || {};
    ctx.restore();
    CAMLOCK.mode = 'off';
    return { vig: 0.32, grain: 0.018, ca: 0.7, contrast: 1.08, saturation: 1.12, ...fx };
  },
};

// render the 3D view into the 2D frame
export function render3D(ctx, world) {
  if (RENDER.off) return;
  world.renderer.render(world.scene, world.camera);
  ctx.drawImage(world.canvas, 0, 0, W, H);
}
