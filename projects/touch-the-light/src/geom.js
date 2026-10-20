// 2D path building: Catmull-Rom splines, arc-length polylines with normals, rounded rects, SVG paths.

// Polyline with cumulative arc length and smoothed unit normals (left-hand normal in y-down space).
export class Poly {
  // win: neighbors on each side used for the tangent (wider = rounder fibers at sharp corners)
  constructor(pts, closed = false, win = 1) {
    this.closed = closed;
    const P = closed ? [...pts, pts[0]] : pts;
    const n = P.length;
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    this.s = new Float64Array(n); this.nx = new Float64Array(n); this.ny = new Float64Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = P[i][0]; this.y[i] = P[i][1]; }
    for (let i = 1; i < n; i++) this.s[i] = this.s[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
    this.L = this.s[n - 1];
    this.n = n;
    for (let i = 0; i < n; i++) {
      let i0 = i - win, i1 = i + win;
      if (closed) { if (i0 < 0) i0 += n - 1; if (i1 > n - 1) i1 -= n - 1; }
      else { i0 = Math.max(0, i0); i1 = Math.min(n - 1, i1); }
      const tx = this.x[i1] - this.x[i0], ty = this.y[i1] - this.y[i0], l = Math.hypot(tx, ty) || 1;
      this.nx[i] = -ty / l; this.ny[i] = tx / l;
    }
    // signed area > 0 means clockwise on screen (y down); then the left normal points inward
    let A = 0;
    for (let i = 0; i < n - 1; i++) A += this.x[i] * this.y[i + 1] - this.x[i + 1] * this.y[i];
    this.area = A / 2;
  }
  get inward() { return this.area > 0 ? 1 : -1; }
  // index of the segment containing arc length s
  seg(s) {
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    return lo;
  }
  at(s) {
    s = Math.min(this.L, Math.max(0, s));
    const i = this.seg(s), j = Math.min(this.n - 1, i + 1), d = this.s[j] - this.s[i] || 1, t = (s - this.s[i]) / d;
    let nx = this.nx[i] + (this.nx[j] - this.nx[i]) * t, ny = this.ny[i] + (this.ny[j] - this.ny[i]) * t;
    const l = Math.hypot(nx, ny) || 1;
    return { x: this.x[i] + (this.x[j] - this.x[i]) * t, y: this.y[i] + (this.y[j] - this.y[i]) * t, nx: nx / l, ny: ny / l };
  }
}

// centripetal Catmull-Rom through control points
export function catmull(cps, closed = false, per = 24) {
  const out = [];
  const n = cps.length;
  const get = i => closed ? cps[(i + n) % n] : cps[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * (k / per);
      const L = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  if (!closed) out.push(cps[n - 1]);
  return out;
}

// resample to n points evenly spaced by arc length (closed: n distinct points, no duplicate end)
export function resample(pts, n, closed = false) {
  const p = new Poly(pts, closed);
  const out = [];
  const m = closed ? n : n - 1;
  for (let k = 0; k < n; k++) { const q = p.at(p.L * k / m); out.push([q.x, q.y]); }
  return out;
}

// rounded rectangle, starting at top center and running clockwise on screen
export function roundRect(w, h, r, n = 900) {
  const pts = [], hw = w / 2, hh = h / 2;
  const add = (x, y) => pts.push([x, y]);
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 24; k++) { const a = a0 + (k / 24) * Math.PI / 2; add(cx + r * Math.cos(a), cy + r * Math.sin(a)); } };
  add(0, -hh); add(hw - r, -hh); arc(hw - r, -hh + r, -Math.PI / 2);
  add(hw, hh - r); arc(hw - r, hh - r, 0);
  add(-hw + r, hh); arc(-hw + r, hh - r, Math.PI / 2);
  add(-hw, -hh + r); arc(-hw + r, -hh + r, Math.PI);
  return resample(pts, n, true);
}

// SVG path data (absolute M per subpath) -> list of subpaths sampled via the browser's path geometry
export function svgSubpaths(d, step = 0.05) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.style.position = 'absolute'; svg.style.width = '0'; svg.style.height = '0';
  document.body.appendChild(svg);
  const out = d.split(/(?=M)/).filter(Boolean).map(sd => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', sd);
    svg.appendChild(path);
    const L = path.getTotalLength(), pts = [];
    for (let s = 0; s < L; s += step) { const q = path.getPointAtLength(s); pts.push([q.x, q.y]); }
    return pts;
  });
  svg.remove();
  return out;
}

// Progressively Gaussian-smoothed copies of an evenly spaced polyline: levels[i] has sigma = i * step
// (world units). Same vertex count, so index i on any level corresponds to the same arc position.
export function smoothLevels(pts, closed, step, count, win = 2) {
  const n = pts.length;
  const base = new Poly(pts, closed, win);
  const sp = base.L / (closed ? n : n - 1);
  const out = [base];
  for (let i = 1; i < count; i++) {
    const sg = Math.max(0.5, i * step / sp), R = Math.ceil(sg * 2.5);
    const w = []; for (let k = -R; k <= R; k++) w.push(Math.exp(-k * k / (2 * sg * sg)));
    const sm = pts.map((_, j) => {
      let x = 0, y = 0, ws = 0;
      for (let k = -R; k <= R; k++) {
        let idx = j + k;
        idx = closed ? ((idx % n) + n) % n : Math.max(0, Math.min(n - 1, idx));
        x += pts[idx][0] * w[k + R]; y += pts[idx][1] * w[k + R]; ws += w[k + R];
      }
      return [x / ws, y / ws];
    });
    out.push(new Poly(sm, closed, win));
  }
  return out;
}
