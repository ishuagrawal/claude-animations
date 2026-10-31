// Downsamples the supersampled scene and adds a two-level bloom (blurred at quarter resolution).
import { W, H } from './core.js';

export class Post {
  constructor() {
    this.out = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.o = this.out.getContext('2d', { alpha: false, willReadFrequently: true });
    this.q = Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 });
    this.b = Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 });
  }
  run(scene, { bloom = 1 } = {}) {
    const { o, q, b } = this;
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.filter = 'none';
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(scene, 0, 0, W, H);
    const qc = q.getContext('2d', { willReadFrequently: true }), bc = b.getContext('2d', { willReadFrequently: true });
    qc.imageSmoothingQuality = 'high';
    qc.clearRect(0, 0, q.width, q.height);
    qc.drawImage(scene, 0, 0, q.width, q.height);
    o.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[2.5, 0.55], [9, 0.45]]) {
      bc.clearRect(0, 0, b.width, b.height);
      bc.filter = `blur(${r}px)`;
      bc.drawImage(q, 0, 0);
      bc.filter = 'none';
      o.globalAlpha = a * bloom;
      o.drawImage(b, 0, 0, W, H);
    }
    o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    return this.out;
  }
}
