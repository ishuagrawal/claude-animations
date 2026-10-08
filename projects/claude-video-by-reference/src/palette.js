// Palette. Explainer world: built from the bible's measured clip palettes (one field per chapter,
// a deep anchor, warm accent on cool field, white, one pop accent). Coral is reserved for Claude.
// RETRO = the in-film "loved video" (Sunset Surf), a 70s poster look that must read as a
// different style from the explainer world.
export const P = {
  // fields (one per chapter)
  cream: '#f4efe4',     // hook / deliver / end field (close to the mascot sheet's #f2f3ee, warmer)
  creamDk: '#e7dfcf',
  navy: '#1f1c4d',      // study / tips field, also the ink anchor
  navyDk: '#15123a',
  navyLt: '#2c2866',
  mint: '#43c6a6',      // imagine field
  mintDk: '#2fa98b',
  mintLt: '#8fe0c9',
  cobalt: '#2d55e0',    // animate field (Digital Banking cobalt #054eb8 family, lifted)
  cobaltDk: '#1f3fb4',
  cobaltLt: '#5c7ff0',
  violet: '#6b55e6',    // score field (Amazon violet #9373f5 family, deepened)
  violetDk: '#5240c8',
  violetLt: '#9a8af3',
  // accents
  butter: '#ffcf4f',    // warm accent on cool fields (gold #fbbb35 / butter #f9d169 family)
  butterDk: '#f0b42e',
  sky: '#7cc3ff',       // light cool accent (#6ebcf0 / #58ccfb family)
  rose: '#ff6f9c',      // pop accent (#db4c73 family, brighter)
  roseLt: '#ffb3c9',
  lilac: '#c9bdff',
  // neutrals / UI
  white: '#ffffff',
  paper: '#fbf8f2',
  ui: '#e4e1ee',        // placeholder text bars on white cards
  uiDk: '#c9c4da',
  ink: '#14132e',       // eyes, deepest ink
  line: '#2a2760',      // thin line accents / line-art pass
  // Claude (reserved)
  coral: '#da7758',     // measured from refs/claude-mascot.png
  coralDk: '#bd5c3f',
  coralLt: '#ec9b7f',
  // user's hands
  skin: '#9a6247',
  skinDk: '#7d4a33',
  skinLt: '#b57a5d',
  sleeve: '#4a3fcf',
  sleeveDk: '#3a30ad',
  // retro "Sunset Surf" (the loved video)
  rCream: '#f8e8c8',
  rPeach: '#f6c99a',
  rMustard: '#f1ac32',
  rOrange: '#e98a2c',
  rRust: '#b4442a',
  rBrown: '#4a2a20',
  rTeal: '#1d8a83',
  rTealDk: '#156a65',
  rMint: '#a6d8c6',
  rPink: '#f0a39a',
};

// mix two hex colors
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
export function rgba(hex, a) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}
export const shade = (c, k) => mix(c, '#000000', k);
export const tintW = (c, k) => mix(c, '#ffffff', k);
