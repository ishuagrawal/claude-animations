// FILM contract. ?panel=<id> = single-square look-dev; otherwise the whole film (director.js).
import { clamp } from './core.js';
import { defaultKeys } from './light.js';
import { PanelSet, G } from './panel.js';
import { DURATION } from './timeline.js';
let dev = null, D = null;
export const film = {
  duration: DURATION,
  fonts: ['64px "Hoefler Text"', '21px "Optima"'],
  async load(E, params) {
    const id = params.get('panel');
    if (id) { const mod = (await import(`./panels/${id}.js`)).default; dev = new PanelSet(E, mod, +(params.get('bake') || mod.bakeScale || 2.4)); await dev.bake(); console.log(id, 'baked in', Math.round(dev.ms), 'ms'); }
    else if (!params.get('lite')) { D = await import('./director.js'); await D.load(E, params); }
  },
  async prepare(E, t) { if (D) await D.prepare(E, t); },
  draw(E, t, opt = {}) {
    if (D) return D.draw(E, t, opt);
    const m = dev.mod, mats = new Int32Array(40).fill(m.mat || 0); mats[36] = 0;
    const full = opt.view === 'full'; let cam, env;
    if (full) cam = { x: (m.w || 1920) / 2, y: (m.h || 1080) / 2, w: (m.w || 1920) * 1.073 }; else { const k = m.shots.findIndex(s => t < s.end), j = k < 0 ? m.shots.length - 1 : k, st = j ? m.shots[j - 1].end : 0; cam = m.shots[j].cam(clamp((t - st) / (m.shots[j].end - st)), t); }
    if (opt.cam) cam = { ...cam, ...opt.cam };
    env = typeof m.env === 'function' ? m.env(t, cam) : { ...(m.env || {}) }; env.keys = env.keys || defaultKeys(cam, t); env.bumps = [];
    E.begin(cam, env, mats); E.bumps = env.bumps; const g = new G(E, dev, 0, 0, t, full ? { rv: 1 } : {}); m.draw(g, t, m.dur || 5); E.end();
  },
};
