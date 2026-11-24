// Shared light rigs. Positions are panel units (panel-local in panel env), z = height above the cloth.
// raking warm key from upper left, low orange kicker from the right; both breathe like lamplight
export const defaultKeys = (c, t, k = 1) => { const f = 1 + 0.03 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1 + 1); return [{ x: c.x - c.w * 0.26, y: c.y - c.w * 0.27, z: c.w * 0.30, R: c.w * 0.66, col: [2.05 * f * k, 1.74 * f * k, 1.28 * f * k] }, { x: c.x + c.w * 0.5, y: c.y + c.w * 0.16, z: c.w * 0.2, R: c.w * 0.5, col: [0.62 * k, 0.36 * k, 0.16 * k] }]; };
