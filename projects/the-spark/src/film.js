// Shot list -> frame. A shots module default-exports (env) => [{ name, start, end, draw(t, env) }], and draw
// returns { scene, camera, post, overlay }. ?only=a,b loads just those modules (fast iteration on one set);
// ?lookdev loads the look-dev frames instead.
import { C } from './timeline.js';
import { MODULES } from './shots/index.js';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
let shots = [];
export const film = {
  duration: C.end,
  async load(env) {
    const names = params.has('lookdev') ? ['lookdev'] : params.get('only') ? params.get('only').split(',') : Object.keys(MODULES).filter(n => n !== 'lookdev');
    const mods = await Promise.all(names.map(n => MODULES[n]()));
    shots = mods.flatMap(m => m.default(env)).sort((a, b) => a.start - b.start);
    film.shots = shots;
  },
  draw(t, env) {
    const s = shots.find(s => t >= s.start && t < s.end) || (t < shots[0].start ? shots[0] : shots[shots.length - 1]);
    return s.draw(Math.max(s.start, Math.min(t, s.end - 1e-4)), env);
  },
};
