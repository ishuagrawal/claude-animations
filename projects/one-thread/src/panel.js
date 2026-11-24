// Panel runtime: bakes a panel module's art into GPU textures and gives it a local-space drawing API.
import { Art } from './art/art.js';
import { clamp, lerp, hash, TAU } from './core.js';
export const PW = 1920, PH = 1080;

export class PanelSet {
  constructor(E, mod, scale) { this.E = E; this.mod = mod; this.scale = scale; this.layers = {}; this.sprites = {}; this.pages = []; this.cur = null; }
  async bake() {
    const t0 = performance.now(); const self = this;
    const B = {
      scale: this.scale, w: this.mod.w || PW, h: this.mod.h || PH,
      layer(name, fn, o = {}) { const A = new Art(o.w || B.w, o.h || B.h, self.scale * (o.res || 1)); fn(A); self.layers[name] = { tex: self.E.upload(A), x: o.x || 0, y: o.y || 0, w: o.w || B.w, h: o.h || B.h }; },
      // o: {w,h,ox,oy,n,res}. fn(A, phase 0..1, i). Origin of drawing is (ox,oy) inside the w×h box.
      sprite(name, o, fn) { const n = o.n || 1, frames = []; for (let i = 0; i < n; i++) { const A = new Art(o.w, o.h, self.scale * (o.res || 1), { ox: o.ox ?? o.w / 2, oy: o.oy ?? o.h / 2 }); fn(A, i / n, i); frames.push(self._pack(A, o)); } self.sprites[name] = { frames, n, loop: o.loop !== false }; },
    };
    this.mod.bake(B); this._flush(); this.ms = performance.now() - t0; return this;
  }
  _newPage() { const N = Math.min(8192, this.scale >= 1.5 ? 6144 : 3072), m = new OffscreenCanvas(N, N), a = new OffscreenCanvas(N, N); const mx = m.getContext('2d'), ax = a.getContext('2d', { alpha: false }); this.cur = { N, m, a, mx, ax, x: 2, y: 2, rowH: 0, frames: [] }; }
  _pack(A, o) {
    const w = A.main.width, h = A.main.height; if (!this.cur) this._newPage(); let c = this.cur;
    if (w + 4 > c.N || h + 4 > c.N) { const tex = this.E.upload(A); return { tex, uv: [0, 0, 1, 1], w: o.w, h: o.h, ox: o.ox ?? o.w / 2, oy: o.oy ?? o.h / 2 }; }
    if (c.x + w + 2 > c.N) { c.x = 2; c.y += c.rowH + 4; c.rowH = 0; } if (c.y + h + 2 > c.N) { this._flush(); this._newPage(); c = this.cur; }
    c.mx.drawImage(A.main, c.x, c.y); c.ax.drawImage(A.aux, c.x, c.y); const f = { tex: null, uv: [c.x / c.N, c.y / c.N, (c.x + w) / c.N, (c.y + h) / c.N], w: o.w, h: o.h, ox: o.ox ?? o.w / 2, oy: o.oy ?? o.h / 2 }; c.frames.push(f); c.x += w + 4; c.rowH = Math.max(c.rowH, h); A.main.width = A.aux.width = 1; return f;
  }
  _flush() { const c = this.cur; if (!c) return; const tex = this.E.upload({ main: c.m, aux: c.a, w: c.N, h: c.N }); c.frames.forEach(f => (f.tex = tex)); this.pages.push(tex); this.cur = null; }
  free() { Object.values(this.layers).forEach(l => this.E.free(l.tex)); this.pages.forEach(t => this.E.free(t)); Object.values(this.sprites).forEach(s => s.frames.forEach(f => { if (!this.pages.includes(f.tex)) this.E.free(f.tex); })); this.layers = {}; this.sprites = {}; this.pages = []; }
}
// Local-space drawing API handed to panel.draw(g, t, dur)
export class G {
  constructor(E, set, ox, oy, t, o = {}) { this.E = E; this.set = set; this.ox = ox; this.oy = oy; this.t = t; this.rv = o.rv; this.fx = o.fx !== false; this.dim = o.alpha ?? 1; }
  _o(o) { const q = { ...o }; if (this.rv !== undefined) q.rv = this.rv; if (this.dim !== 1) q.alpha = (q.alpha ?? 1) * this.dim; if (q.rvp) { q.rvp = [...q.rvp]; if (q.mode === 1) { q.rvp[1] += this.oy; q.rvp[3] += this.ox; } else if (q.mode === 2 || q.mode === 3 || q.mode === 5) { q.rvp[0] += this.ox; q.rvp[1] += this.oy; } } return q; }
  // flat dyed ground. o: {color, x,y,w,h, rv, mode, rvp,…}
  ground(o) { const { x = 0, y = 0, w = this.set.mod.w || PW, h = this.set.mod.h || PH } = o; this.E.rectDraw(null, this.ox + x, this.oy + y, w, h, this._o({ ...o, flat: o.color, flatA: o.a ?? 1 })); }
  layer(name, o = {}) { const l = this.set.layers[name]; if (!l) throw new Error('layer ' + name); const s = o.s ?? 1, cx = o.cx ?? l.x + l.w / 2, cy = o.cy ?? l.y + l.h / 2; const r = o.r ?? 0; if (!r) { this.E.rectDraw(l.tex, this.ox + cx + (l.x - cx) * s + (o.x || 0), this.oy + cy + (l.y - cy) * s + (o.y || 0), l.w * s, l.h * s, this._o(o)); return; } const c = Math.cos(r) * s, n = Math.sin(r) * s, dx = l.x - cx, dy = l.y - cy; this.E.quadDraw(l.tex, [c * l.w, n * l.w, -n * l.h, c * l.h, this.ox + cx + c * dx - n * dy + (o.x || 0), this.oy + cy + n * dx + c * dy + (o.y || 0)], this._o(o)); }
  // sprite: o {x,y,s,sx,sy,r,flip,skew,frame (int) | ph (0..1 loops), rv, alpha, lift, tint…}
  sprite(name, o) { const s = this.set.sprites[name]; if (!s) throw new Error('sprite ' + name); let i = o.frame ?? 0; if (o.ph !== undefined) i = Math.floor(((o.ph % 1) + 1) % 1 * s.n); i = ((i % s.n) + s.n) % s.n; const f = s.frames[i]; const R = Math.max(f.w, f.h) * Math.abs(o.s ?? 1) * 1.3; const X = this.ox + o.x, Y = this.oy + o.y; if (!this.E.sees(X - R, Y - R, X + R, Y + R)) return; this.E.sprite(f, this._o({ ...o, x: X, y: Y })); }
  thread(pts, o = {}) { if (!this.fx && !o.always) return; if (o.hero) o = { color: '#a8150c', color2: '#cf8c26', glow: 0.5, gold: 0.9, ply: 3, ...o }; this.E.thread(pts.map(p => [p[0] + this.ox, p[1] + this.oy, p[2] || 0]), o); }
  part(x, y, z, size, r, g, b, a, kind, ang, stretch, add) { if (!this.fx) return; this.E.part(x + this.ox, y + this.oy, z, size, r, g, b, a, kind, ang, stretch, add); }
  bump(x, y, r, amp) { this.E.bumps.push([x + this.ox, y + this.oy, r, amp]); }
  // burst of sparks at (x,y) started at t0. Stateless.
  burst(x, y, t0, { n = 40, speed = 260, life = 0.9, size = 3, col = [2.4, 1.3, 0.5], seed = 1, grav = 120, z = 20, kind = 0, add = 1, spread = TAU, dir = 0 } = {}) { const a = this.t - t0; if (a < 0 || a > life * 1.3) return; for (let i = 0; i < n; i++) { const h1 = hash(seed * 971 + i * 7), h2 = hash(seed * 131 + i * 13 + 1), h3 = hash(seed * 53 + i * 29 + 2), h4 = hash(seed * 17 + i * 31 + 3); const L = life * (0.5 + h3 * 0.8); if (a > L) continue; const u = a / L, sp = speed * (0.25 + h2), an = dir + (h1 - 0.5) * spread, dr = (1 - Math.exp(-3 * a)) / 3; const px = x + Math.cos(an) * sp * dr, py = y + Math.sin(an) * sp * dr + grav * a * a * 0.5, pz = z + (h4 - 0.3) * sp * dr * 0.8; const k = (1 - u) * (1 - u); this.part(px, py, pz, size * (0.5 + h4), col[0] * k, col[1] * k, col[2] * k, k, kind, -an, kind === 0 ? 2.4 * (1 - u) : 0, add); } }
  // continuous drifting field (dust, embers, snow, petals…) over a box
  drift({ n = 60, x = 0, y = 0, w = PW, h: H = PH, vx = 10, vy = -20, z0 = 30, z1 = 260, size = 2.2, col = [1.1, 0.8, 0.4], a = 0.6, seed = 3, kind = 0, add = 1, sway = 18, spin = 1, twinkle = 1 } = {}) {
    const t = this.t;
    for (let i = 0; i < n; i++) {
      const h = k => hash(seed * 7919 + i * 31 + k), k = 0.6 + h(4) * 0.8;
      let px = (h(1) * w + vx * k * t + Math.sin(t * (0.6 + h(5)) + h(6) * 7) * sway) % w, py = (h(2) * H + vy * k * t) % H;
      if (px < 0) px += w; if (py < 0) py += H;
      const fe = clamp(Math.min(px / w, 1 - px / w, py / H, 1 - py / H) * 8), tw = twinkle ? 0.55 + 0.45 * Math.sin(t * (2 + h(7) * 4) + h(8) * 9) : 1;
      this.part(x + px, y + py, lerp(z0, z1, h(3)), size * (0.5 + h(9)), col[0] * tw, col[1] * tw, col[2] * tw, a * fe, kind, h(10) * 6 + t * spin * (h(11) - 0.5) * 3, 0, add);
    }
  }
}
