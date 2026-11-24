import { makeGL, program, target, texFromCanvas, bindTex, FSQ, M4, sub3, norm3, cross3 } from './gl.js';
import * as S from './shaders.js';
import { clamp, lerp, rng } from '../core.js';

function makeNoise(gl) {
  const N = 1024, buf = new Uint8Array(N * N * 4);
  const grid = (seed, fx, fy) => { const r = rng(seed), g = new Float32Array(fx * fy); for (let i = 0; i < g.length; i++) g[i] = r(); return (x, y) => { const u = x * fx, v = y * fy, i = Math.floor(u), j = Math.floor(v); let a = u - i, b = v - j; a = a * a * a * (a * (a * 6 - 15) + 10); b = b * b * b * (b * (b * 6 - 15) + 10); const I = i % fx, J = j % fy, I1 = (I + 1) % fx, J1 = (J + 1) % fy; return lerp(lerp(g[J * fx + I], g[J * fx + I1], a), lerp(g[J1 * fx + I], g[J1 * fx + I1], a), b); }; };
  const mk = (seed, bx, by, oct) => { const gs = [], w = []; let tot = 0; for (let o = 0; o < oct; o++) { gs.push(grid(seed + o * 17, Math.min(N, bx << o), Math.min(N, by << o))); const k = Math.pow(0.55, o); w.push(k); tot += k; } return (x, y) => { let s = 0; for (let o = 0; o < oct; o++) s += gs[o](x, y) * w[o]; s /= tot; return clamp((s - 0.5) * 1.75 + 0.5); }; };
  const R = mk(11, 4, 4, 6), G = mk(57, 20, 20, 5), B = mk(91, 6, 96, 3), W = rng(5);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (y * N + x) * 4, u = x / N, v = y / N; buf[k] = R(u, v) * 255; buf[k + 1] = G(u, v) * 255; buf[k + 2] = B(u, v) * 255; buf[k + 3] = W() * 255; }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, buf); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  if (gl.aniso) gl.texParameterf(gl.TEXTURE_2D, gl.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}
export const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export const ENV = {
  cloth: '#bf8536', keys: [{ x: 0, y: 0, z: 900, R: 2200, col: [1.5, 1.3, 1.02] }], amb: [0.13, 0.108, 0.088], sun: [0.3, 0.5, 0.8], sunC: [0, 0, 0], glowC: [1, 0.86, 0.6],
  stain: 1, wear: 0.2, relief: 1, fuzz: 1, gild: 1, exposure: 0.9, bloom: 0.5, bloomThr: 1.0, vig: 0.85, scorch: 0.7, grain: 0.016, sat: 1.04, con: 1.10, ca: 0.6, tint: [1, 0.985, 0.95], lift: [0, 0, 0], fade: 0, flash: 0, flashC: [1, 0.9, 0.7],
};
export class Engine {
  constructor(canvas, W, H) {
    this.W = W; this.H = H; canvas.width = W; canvas.height = H;
    const gl = this.gl = makeGL(canvas);
    this.noise = makeNoise(gl);
    const P = (v, f, n) => program(gl, v, f, n), FQ = 'precision highp float;\n' + FSQ;
    this.pr = {
      sprite: P(S.SPRITE_VS, S.SPRITE_FS, 'sprite'), shsp: P(S.SPRITE_VS, S.SHADOW_FS, 'shadowsprite'), cloth: P(S.CLOTH_VS, S.CLOTH_FS, 'cloth'),
      thread: P(S.THREAD_VS, S.THREAD_FS, 'thread'), thsh: P(S.THREAD_SH_VS, S.THREAD_SH_FS, 'threadshadow'), part: P(S.PART_VS, S.PART_FS, 'particles'),
      blur: P(FQ, S.BLUR1_FS, 'blur'), dof: P(FQ, S.DOF_FS, 'dof'), bdn: P(FQ, S.BLOOM_DN_FS, 'bdn'), bup: P(FQ, S.BLOOM_UP_FS, 'bup'), final: P(FQ, S.FINAL_FS, 'final'),
    };
    const k = H / 1080, pw = Math.min(8192, Math.round(2880 * k)), ph = Math.min(8192, Math.round(1800 * k));
    this.pig = target(gl, pw, ph, ['rgba8', 'rgba16f'], { mips: true });
    this.sh = [target(gl, 1440, 900, ['r16f']), target(gl, 1440, 900, ['r16f'])];
    this.hdr = target(gl, W, H, ['rgba16f', 'rg16f'], { depth: true });
    this.dofT = target(gl, W, H, ['rgba16f']);
    this.bl = []; let bw = W >> 1, bh = H >> 1; for (let i = 0; i < 7 && bh > 6; i++) { this.bl.push([target(gl, bw, bh, ['rgba16f']), target(gl, bw, bh, ['rgba16f'])]); bw >>= 1; bh >>= 1; }
    // unit quad + cloth grid
    this.quad = gl.createVertexArray(); gl.bindVertexArray(this.quad); const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); this.qb = qb;
    const gx = 200, gy = 120, v = new Float32Array((gx + 1) * (gy + 1) * 2), idx = new Uint32Array(gx * gy * 6); let n = 0; for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) { v[n++] = i / gx; v[n++] = j / gy; } n = 0; for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const a = j * (gx + 1) + i; idx.set([a, a + 1, a + gx + 1, a + 1, a + gx + 2, a + gx + 1], n); n += 6; }
    this.grid = gl.createVertexArray(); gl.bindVertexArray(this.grid); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); this.gridN = idx.length;
    this.tvao = gl.createVertexArray(); gl.bindVertexArray(this.tvao); this.tb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.tb); for (const [l, s, o] of [[0, 3, 0], [1, 3, 12], [2, 2, 24]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 32, o); }
    this.pvao = gl.createVertexArray(); gl.bindVertexArray(this.pvao); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); this.pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.pb); for (const [l, o] of [[1, 0], [2, 16], [3, 32]]) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 48, o); gl.vertexAttribDivisor(l, 1); }
    this.pdata = new Float32Array(12 * 60000);
    gl.bindVertexArray(null);
    this.over = new OffscreenCanvas(W, H); this.ox = this.over.getContext('2d'); this.overT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.overT); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.white = this.solid(255, 255, 255, 255); this.black = this.solid(0, 0, 0, 255);
    this.calls = 0;
  }
  solid(r, g, b, a) { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); return t; }
  upload(art) { const gl = this.gl; const o = { main: texFromCanvas(gl, art.main, { premult: true }), aux: texFromCanvas(gl, art.aux), w: art.w, h: art.h, pw: art.main.width, ph: art.main.height }; art.main.width = art.main.height = art.aux.width = art.aux.height = 1; return o; }
  free(t) { if (t) { this.gl.deleteTexture(t.main); this.gl.deleteTexture(t.aux); } }

  // ---- frame
  begin(cam, env, mats) {
    const gl = this.gl, A = this.W / this.H;
    this.env = env = { ...ENV, ...env };
    const c = this.cam = { x: 960, y: 540, w: 1920, tilt: 0, yaw: 0, roll: 0, fov: 34, aperture: 0, focus: null, ...cam };
    const fy = c.fov * Math.PI / 180, dist = (c.w / A / 2) / Math.tan(fy / 2);
    const dir = [Math.sin(c.yaw) * Math.cos(c.tilt), -Math.sin(c.tilt), Math.cos(c.tilt) * Math.cos(c.yaw)];
    const tgt = [c.x, -c.y, c.z || 0], eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
    let up = [Math.sin(c.roll), Math.cos(c.roll), 0]; up = norm3(up);
    const V = M4.look(eye, tgt, up), P = M4.persp(fy, A, Math.max(0.5, dist * 0.02), dist * 12); this.VP = M4.mul(P, V); this.eye = eye; this.dist = dist; this.fwd = norm3(sub3(tgt, eye)); this.right = norm3(cross3(this.fwd, up)); this.up = cross3(this.right, this.fwd); this.pxScale = 2 * Math.tan(fy / 2) / this.H;
    this.focus = c.focus ?? dist; this.ap = c.aperture * (this.H / 1080);
    // visible rect on z=0
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const th = Math.tan(fy / 2);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const d = norm3([0, 1, 2].map(i => this.fwd[i] + this.right[i] * sx * th * A + this.up[i] * sy * th)); let t = d[2] < -0.05 ? -eye[2] / d[2] : dist * 4; t = Math.min(t, dist * 4); const px = eye[0] + d[0] * t, py = -(eye[1] + d[1] * t); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const mg = (env.foldMargin ?? 40) + c.w * 0.015; x0 -= mg; y0 -= mg; x1 += mg; y1 += mg; this.rect = [x0, y0, x1 - x0, y1 - y0];
    this.mats = mats || new Int32Array(40); this.threads = []; this.shq = []; this.pn = 0; this.waves = env.waves || []; this.bumps = env.bumps || [];
    this.ox.setTransform(1, 0, 0, 1, 0, 0); this.ox.clearRect(0, 0, this.W, this.H); this.ox.setTransform(this.H / 1080, 0, 0, this.H / 1080, 0, 0); this.overUsed = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pig.fbo); gl.viewport(0, 0, this.pig.w, this.pig.h); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(this.pr.sprite.p); gl.bindVertexArray(this.quad);
    const u = this.pr.sprite.u; gl.uniform4fv(u.uRect, this.rect); bindTex(gl, 2, this.noise, u.uNoise); gl.uniform1i(u.uMain, 0); gl.uniform1i(u.uAux, 1);
    this.inPig = true; this.calls = 0;
  }
  // is a cloth-space box on screen?
  sees(x0, y0, x1, y1) { const r = this.rect; return x1 >= r[0] && y1 >= r[1] && x0 <= r[0] + r[2] && y0 <= r[1] + r[3]; }
  // generic quad. m = [a,b,c,d,e,f]: (u,v in 0..1) → (a*u+c*v+e, b*u+d*v+f)
  quadDraw(tex, m, o = {}) {
    const gl = this.gl, u = this.pr.sprite.u; this.calls++;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex ? tex.main : this.white); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex ? tex.aux : this.black);
    gl.uniform3f(u.uM0, m[0], m[2], m[4]); gl.uniform3f(u.uM1, m[1], m[3], m[5]); const uv = o.uv || [0, 0, 1, 1]; gl.uniform4f(u.uUV, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform1f(u.uRv, o.rv ?? 1); gl.uniform1f(u.uSoft, o.soft ?? 0.05); gl.uniform1f(u.uEdge, o.edge ?? 0.045); gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uGlow, o.glow ?? 1); gl.uniform1f(u.uNoiseAmt, o.noise ?? 0.05); gl.uniform1f(u.uGoldMul, o.gold ?? 1); gl.uniform1f(u.uRaiseMul, o.raise ?? 1); gl.uniform1f(u.uEmit, o.emit ?? 0); gl.uniform1f(u.uBlur, o.blur ?? 0);
    const t = o.tint ? hex(o.tint) : [0, 0, 0]; gl.uniform3f(u.uTint, t[0], t[1], t[2]); gl.uniform1f(u.uTintA, o.tint ? (o.tintA ?? 1) : 0);
    gl.uniform1i(u.uRvMode, o.mode ?? 0); gl.uniform4fv(u.uRvP, o.rvp || [0, 0, 1, 1]); if (o.flat) { const f = hex(o.flat), a = o.flatA ?? 1; gl.uniform4f(u.uFlat, f[0] * a, f[1] * a, f[2] * a, a); } else gl.uniform4f(u.uFlat, 0, 0, 0, 0);
    if (o.add) gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); if (o.add) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  rectDraw(tex, x, y, w, h, o) { this.quadDraw(tex, [w, 0, 0, h, x, y], o); }
  // sprite frame {tex, uv, w, h, ox, oy} placed at x,y with scale/rotation about its origin
  sprite(fr, o) {
    const sx = (o.s ?? 1) * (o.sx ?? 1) * (o.flip ? -1 : 1), sy = (o.s ?? 1) * (o.sy ?? 1), r = o.r ?? 0, c = Math.cos(r), n = Math.sin(r), sk = o.skew ?? 0;
    const a = c * sx, b = n * sx, cc = -n * sy + sk * c * sy, d = c * sy + sk * n * sy, ox = -fr.ox, oy = -fr.oy;
    const e = o.x + a * ox + cc * oy, f = o.y + b * ox + d * oy; const m = [a * fr.w, b * fr.w, cc * fr.h, d * fr.h, e, f];
    if (o.lift) { const l = o.lift, L = this.lightDir2(o.x, o.y); this.shq.push({ fr, m: [m[0], m[1], m[2], m[3], m[4] - L[0] * l, m[5] - L[1] * l], a: (o.alpha ?? 1) * (o.shadow ?? 0.8) * clamp((o.rv ?? 1) * 1.6 - 0.3), lod: Math.min(5, 1 + l * 0.03) }, { fr, m, a: 0.8 * (o.alpha ?? 1), lod: 1, hole: 1 }); }
    this.quadDraw(fr.tex, m, { ...o, uv: fr.uv });
  }
  lightDir2(x, y) { const k = this.env.keys[0], dx = k.x - x, dy = k.y - y, z = k.z; const s = 1 / Math.max(z, 200); return [clamp(dx * s, -1.6, 1.6), clamp(dy * s, -1.6, 1.6)]; }
  // pts: [[x,y,z]...] cloth space. opts {w, color, from, to (arc units or use f0,f1 fractions), glow, gold, spark, headLen, alpha, shadow}
  thread(pts, o = {}) { if (pts.length < 2) return; this.threads.push({ pts, o }); }
  _threadBuf(pts) {
    const n = pts.length, d = new Float32Array(n * 2 * 8); let L = 0;
    for (let i = 0; i < n; i++) { if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...t) || 1; t = t.map(q => q / l); for (let s = 0; s < 2; s++) d.set([pts[i][0], pts[i][1], pts[i][2], t[0], t[1], t[2], s ? 1 : -1, L], (i * 2 + s) * 8); }
    return { d, n: n * 2, L };
  }
  // particle: kind 0 glow 1 disc 2 petal 3 smoke
  part(x, y, z, size, r, g, b, a, kind = 0, ang = 0, stretch = 0, additive = 1) { if (this.pn >= 60000) return; const k = this.pn * 12, d = this.pdata; d[k] = x; d[k + 1] = y; d[k + 2] = z; d[k + 3] = size; d[k + 4] = r; d[k + 5] = g; d[k + 6] = b; d[k + 7] = a; d[k + 8] = kind; d[k + 9] = ang; d[k + 10] = stretch; d[k + 11] = additive; this.pn++; }
  _keys(u) { const gl = this.gl, ks = this.env.keys.slice(0, 3), p = [], c = [], r = []; for (let i = 0; i < 3; i++) { const k = ks[i] || { x: 0, y: 0, z: 1, R: 1, col: [0, 0, 0] }; p.push(k.x, k.y, k.z); c.push(...k.col); r.push(k.R); } gl.uniform3fv(u.uKeyP, p); gl.uniform3fv(u.uKeyC, c); gl.uniform1fv(u.uKeyR, r); gl.uniform1i(u.uKeyN, ks.length); }
  _fsq(prog, dst, w, h) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, w, h); gl.useProgram(prog.p); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(this.quad); }
  end() {
    const gl = this.gl, E = this.env, W = this.W, H = this.H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.pig.genMips();
    // thread geometry
    for (const t of this.threads) t.buf = this._threadBuf(t.pts);
    // --- shadows
    const s0 = this.sh[0], s1 = this.sh[1]; gl.bindFramebuffer(gl.FRAMEBUFFER, s0.fbo); gl.viewport(0, 0, s0.w, s0.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.shq.length) { const p = this.pr.shsp; gl.useProgram(p.p); gl.bindVertexArray(this.quad); gl.uniform4fv(p.u.uRect, this.rect); gl.uniform1i(p.u.uMain, 0); for (const q of this.shq) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, q.fr.tex.main); gl.uniform3f(p.u.uM0, q.m[0], q.m[2], q.m[4]); gl.uniform3f(p.u.uM1, q.m[1], q.m[3], q.m[5]); gl.uniform4f(p.u.uUV, ...q.fr.uv); gl.uniform1f(p.u.uAlpha, q.a); gl.uniform1f(p.u.uLod, q.lod); if (q.hole) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); if (q.hole) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); } }
    if (this.threads.length) { const p = this.pr.thsh; gl.useProgram(p.p); gl.bindVertexArray(this.tvao); gl.uniform4fv(p.u.uRect, this.rect); for (const t of this.threads) { const o = t.o; if (o.shadow === 0) continue; const m = t.pts[t.pts.length >> 1], l = this.lightDir2(m[0], m[1]); gl.uniform2f(p.u.uLd, l[0], l[1]); gl.uniform1f(p.u.uW, o.w ?? 8); gl.uniform1f(p.u.uHeadU, o.to ?? (o.f1 ?? 1) * t.buf.L); gl.uniform1f(p.u.uTailU, o.from ?? (o.f0 ?? 0) * t.buf.L); gl.uniform1f(p.u.uA, (o.shadow ?? 0.8) * (o.alpha ?? 1)); gl.bindBuffer(gl.ARRAY_BUFFER, this.tb); gl.bufferData(gl.ARRAY_BUFFER, t.buf.d, gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLE_STRIP, 0, t.buf.n); } }
    for (const [src, dst, dx, dy] of [[s0, s1, 1.2, 0], [s1, s0, 0, 1.2]]) { this._fsq(this.pr.blur, dst.fbo, dst.w, dst.h); bindTex(gl, 0, src.tex[0], this.pr.blur.u.uT); gl.uniform2f(this.pr.blur.u.uD, dx / dst.w, dy / dst.h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    // --- cloth
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdr.fbo); gl.viewport(0, 0, W, H); gl.clearBufferfv(gl.COLOR, 0, [0.004, 0.003, 0.002, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, this.dist, 0, 0]); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND);
    { const p = this.pr.cloth, u = p.u; gl.useProgram(p.p); gl.bindVertexArray(this.grid); bindTex(gl, 0, this.pig.tex[0], u.uPig); bindTex(gl, 1, this.pig.tex[1], u.uAuxB); bindTex(gl, 2, this.noise, u.uNoise); bindTex(gl, 3, s0.tex[0], u.uShadow);
      gl.uniform4fv(u.uRect, this.rect); gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniform3fv(u.uEye, this.eye); gl.uniform2f(u.uPigRes, this.pig.w, this.pig.h); gl.uniform1iv(u.uMat, this.mats); gl.uniform4f(u.uOrigin, 6, 6, 1920, 1080); gl.uniform3fv(u.uClothCol, hex(E.cloth)); this._keys(u); gl.uniform3fv(u.uAmb, E.amb); gl.uniform3fv(u.uSun, norm3([E.sun[0], E.sun[1], E.sun[2]])); gl.uniform3fv(u.uSunC, E.sunC); gl.uniform3fv(u.uGlowC, E.glowC); gl.uniform1f(u.uStain, E.stain); gl.uniform1f(u.uWear, E.wear); gl.uniform1f(u.uReliefMul, E.relief); gl.uniform1f(u.uFuzz, E.fuzz); gl.uniform1f(u.uGild, E.gild); gl.uniform1f(u.uFocus, this.focus); gl.uniform1f(u.uAperture, this.ap);
      const wv = new Float32Array(24); this.waves.slice(0, 6).forEach((w, i) => wv.set(w, i * 4)); gl.uniform4fv(u.uWave, wv); gl.uniform1i(u.uWaveN, Math.min(6, this.waves.length)); const bp = new Float32Array(32); this.bumps.slice(0, 8).forEach((w, i) => bp.set(w, i * 4)); gl.uniform4fv(u.uBump, bp); gl.uniform1i(u.uBumpN, Math.min(8, this.bumps.length));
      gl.drawElements(gl.TRIANGLES, this.gridN, gl.UNSIGNED_INT, 0); }
    // --- threads
    if (this.threads.length) { const p = this.pr.thread, u = p.u; gl.useProgram(p.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.bindVertexArray(this.tvao); bindTex(gl, 2, this.noise, u.uNoise); gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniform3fv(u.uEye, this.eye); this._keys(u); gl.uniform3fv(u.uAmb, E.amb); gl.uniform1f(u.uFocus, this.focus); gl.uniform1f(u.uAperture, this.ap);
      for (const t of this.threads) { const o = t.o, c = hex(o.color ?? '#d9a23a').map(v => Math.pow(v, 2.2)); gl.uniform1f(u.uW, o.w ?? 8); gl.uniform3fv(u.uCol, c); gl.uniform3fv(u.uCol2, hex(o.color2 ?? o.color ?? '#d9a23a').map(v => Math.pow(v, 2.2))); gl.uniform1f(u.uGlow, o.glow ?? 0); gl.uniform1f(u.uGold, o.gold ?? 0.6); gl.uniform1f(u.uHeadU, o.to ?? (o.f1 ?? 1) * t.buf.L); gl.uniform1f(u.uTailU, o.from ?? (o.f0 ?? 0) * t.buf.L - 1); gl.uniform1f(u.uHeadLen, o.headLen ?? 60); gl.uniform1f(u.uSpark, o.spark ?? 0); gl.uniform1f(u.uAlpha, o.alpha ?? 1); gl.uniform1f(u.uPly, o.ply ?? 2); gl.bindBuffer(gl.ARRAY_BUFFER, this.tb); gl.bufferData(gl.ARRAY_BUFFER, t.buf.d, gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLE_STRIP, 0, t.buf.n); } }
    // --- DOF
    let src = this.hdr.tex[0]; if (this.ap > 0.01) { this._fsq(this.pr.dof, this.dofT.fbo, W, H); const u = this.pr.dof.u; bindTex(gl, 0, src, u.uT); bindTex(gl, 1, this.hdr.tex[1], u.uC); gl.uniform2f(u.uPx, 1 / W, 1 / H); gl.uniform1f(u.uMax, 26 * H / 1080); gl.drawArrays(gl.TRIANGLES, 0, 3); src = this.dofT.tex[0]; }
    // --- particles
    if (this.pn) { const tgt = src === this.hdr.tex[0] ? this.hdr.fbo : this.dofT.fbo; gl.bindFramebuffer(gl.FRAMEBUFFER, tgt); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); const p = this.pr.part, u = p.u; if (tgt === this.hdr.fbo) gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); gl.useProgram(p.p); gl.bindVertexArray(this.pvao); bindTex(gl, 2, this.noise, u.uNoise); gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniform3fv(u.uEye, this.eye); gl.uniform3fv(u.uRight, this.right); gl.uniform3fv(u.uUp, this.up); gl.uniform1f(u.uFocus, this.focus); gl.uniform1f(u.uAperture, this.ap); gl.uniform1f(u.uPxScale, this.pxScale); gl.bindBuffer(gl.ARRAY_BUFFER, this.pb); gl.bufferData(gl.ARRAY_BUFFER, this.pdata.subarray(0, this.pn * 12), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.pn); if (tgt === this.hdr.fbo) gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); }
    // --- bloom
    let prev = src, pw = W, ph = H; this.bl.forEach(([d], i) => { this._fsq(this.pr.bdn, d.fbo, d.w, d.h); const u = this.pr.bdn.u; bindTex(gl, 0, prev, u.uT); gl.uniform2f(u.uPx, 1 / pw, 1 / ph); gl.uniform1f(u.uThr, i === 0 ? E.bloomThr : 0); gl.drawArrays(gl.TRIANGLES, 0, 3); prev = d.tex[0]; pw = d.w; ph = d.h; });
    let up = this.bl[this.bl.length - 1][0]; for (let i = this.bl.length - 2; i >= 0; i--) { const [d, t] = this.bl[i]; this._fsq(this.pr.bup, t.fbo, t.w, t.h); const u = this.pr.bup.u; bindTex(gl, 0, d.tex[0], u.uT); bindTex(gl, 1, up.tex[0], u.uB); gl.uniform2f(u.uPx, 1 / up.w, 1 / up.h); gl.uniform1f(u.uK, 0.85); gl.drawArrays(gl.TRIANGLES, 0, 3); up = t; }
    // --- final
    gl.bindTexture(gl.TEXTURE_2D, this.overT); if (this.overUsed) { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.over); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
    this._fsq(this.pr.final, null, W, H); const u = this.pr.final.u; bindTex(gl, 0, src, u.uT); bindTex(gl, 1, up.tex[0], u.uBloom); bindTex(gl, 2, this.noise, u.uNoise); bindTex(gl, 3, this.overT, u.uOver); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uBloomK, E.bloom * 0.22); gl.uniform1f(u.uExp, E.exposure); gl.uniform1f(u.uVig, E.vig); gl.uniform1f(u.uScorch, E.scorch); gl.uniform1f(u.uGrain, E.grain); gl.uniform1f(u.uSeed, (this.frameNo || 0) % 211); gl.uniform1f(u.uSat, E.sat); gl.uniform1f(u.uCon, E.con); gl.uniform1f(u.uCA, E.ca); gl.uniform1f(u.uFade, E.fade); gl.uniform1f(u.uFlash, E.flash); gl.uniform3fv(u.uFlashC, E.flashC); gl.uniform3fv(u.uTint, E.tint); gl.uniform3fv(u.uLift, E.lift); gl.uniform2f(u.uMB, (E.mb || [0, 0])[0], (E.mb || [0, 0])[1]); gl.uniform1f(u.uOverA, this.overUsed ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
  }
}
