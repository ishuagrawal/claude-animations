// Voids the light flows around: signed distance fields (negative inside) and the push that bends
// fibers out of them, piling them up just outside the edge so the shape reads as pure black.

// stadium (pill) centered at (cx, cy), w x h
export function pillSDF(cx, cy, w, h) {
  const a = Math.max(0, (w - h) / 2), r = h / 2;
  return (x, y) => {
    const px = x - cx, py = y - cy;
    const qx = Math.max(0, Math.abs(px) - a);
    const d = Math.hypot(qx, py);
    if (d < 1e-6) return [-r, 0, py < 0 ? -1 : 1];
    return [d - r, Math.sign(px) * qx / d, py / d];
  };
}

// Euclidean distance transform (Felzenszwalb) of a binary grid -> distance to nearest "on" cell
function edt(on, w, h) {
  const INF = 1e12, f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = on[i] ? 0 : INF;
  const pass = (n, get, set) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      do { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); } while (s <= z[k] && --k >= 0);
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    for (let q = 0; q < n; q++) set(q, d[q]);
  };
  for (let x = 0; x < w; x++) pass(h, y => g[y * w + x], (y, val) => { g[y * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, x => g[y * w + x], (x, val) => { g[y * w + x] = val; });
  for (let i = 0; i < w * h; i++) g[i] = Math.sqrt(g[i]);
  return g;
}

// signed distance grid for filled closed polygons (frame coords), sampled bilinearly with a gradient
export function polySDF(polys, pad = 120, res = 1) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = Math.ceil((x1 - x0) / res), h = Math.ceil((y1 - y0) / res);
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  for (const P of polys) {
    ctx.beginPath();
    P.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (x - x0) / res, (y - y0) / res));
    ctx.closePath(); ctx.fill();
  }
  const px = ctx.getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { inside[i] = px[i * 4 + 3] > 127 ? 1 : 0; outside[i] = 1 - inside[i]; }
  const dOut = edt(inside, w, h), dIn = edt(outside, w, h);
  const S = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) S[i] = (inside[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5) * res;
  const raw = (x, y) => {
    const gx = (x - x0) / res, gy = (y - y0) / res;
    if (gx < 0 || gy < 0 || gx >= w - 1 || gy >= h - 1) return pad; // far outside
    const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, i = iy * w + ix;
    return (S[i] * (1 - fx) + S[i + 1] * fx) * (1 - fy) + (S[i + w] * (1 - fx) + S[i + w + 1] * fx) * fy;
  };
  return (x, y) => {
    const d = raw(x, y), e = 1.5 * res;
    let nx = raw(x + e, y) - raw(x - e, y), ny = raw(x, y + e) - raw(x, y - e);
    const l = Math.hypot(nx, ny) || 1;
    return [d, nx / l, ny / l];
  };
}

// push a point out of a void: deep inside lands at `margin` outside the edge; outside, a soft lens.
// returns [x, y, amount]
export function push(sdf, x, y, margin, soft) {
  const [d, nx, ny] = sdf(x, y);
  const k = (margin - d) / soft;
  if (k < -8) return [x, y, 0];
  const a = soft * (k > 20 ? k : Math.log1p(Math.exp(k)));
  return [x + nx * a, y + ny * a, a];
}
