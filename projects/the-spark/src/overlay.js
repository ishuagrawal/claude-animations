// 2D titles over the picture, in the reference's manner: small, thin, white serif capitals with very wide tracking.
import { W, H } from './core.js';

export function title(ctx, text, alpha, { y = H / 2, size = 44, track = 30, sub = null } = {}) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18;
  ctx.font = `400 ${size}px Cormorant, Georgia, serif`;
  ctx.letterSpacing = track + 'px';
  ctx.fillText(text, W / 2 + track / 2, y);
  if (sub) { ctx.font = `400 ${Math.round(size * 0.42)}px Cormorant, Georgia, serif`; ctx.letterSpacing = Math.round(track * 0.36) + 'px'; ctx.globalAlpha = Math.min(1, alpha) * 0.85; ctx.fillText(sub, W / 2 + track * 0.18, y + size * 1.25); }
  ctx.restore();
}
