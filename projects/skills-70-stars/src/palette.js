// Palette, mapped from the reference's k-means (see HANDOFF style bible) onto this film's own "brand":
// star gold + warm ink replace the reference's yellow + blue bookend; Claude's coral is reserved for Claude.
export const P = {
  // bookend
  gold: '#f4c431',      // ground of the opening / pull-back / end card (ref yellow #f8d611, warmer: a star)
  goldDk: '#d9a514',    // gold shade (pill shadow, tunnel wedges)
  goldLt: '#ffe17a',    // gold highlight / filled star glint
  ink: '#1b1a17',       // type, bars, wedges (the reference's brand-blue role)
  ink2: '#2c2a25',
  cream: '#faf7ee',     // pill fill, card chrome
  paper: '#efe7d6',     // ink-sketch look ground
  // the hero (reserved)
  coral: '#da7758',     // refs/claude-mascot.png body
  coralDk: '#b35a3e',
  coralLt: '#eb9779',
  eye: '#000000',
  // community hands (pastels, like the reference's mint / cream / slate hands)
  mint: '#cfeecb', mintDk: '#9fcf9c',
  creamHand: '#f3dcae', creamHandDk: '#d6b781',
  slate: '#8aa1a9', slateDk: '#62798a',
  tan: '#c99673', tanDk: '#a6714f',
  lilac: '#cdb9e8', lilacDk: '#a790c9',
  nail: '#ffffff',
  // room looks (color script)
  mustard: '#c3893b',   // look 1 soft flat (ref first room)
  mustardLt: '#ecc56e',
  teal: '#2f7c78',      // look 2 pixel
  tealLt: '#58a69c',
  night: '#241d48',     // look 4 neon
  nightLt: '#3c2f73',
  blue: '#3e6fb8',      // finale party (ref final room is brand blue)
  blueLt: '#79a6e6',
  blueDk: '#28508d',
  green: '#1f9476',     // top-down cake tablecloth (ref coffee ground teal #138d71)
  greenDk: '#167159',
  // props
  wood: '#c99a62', woodDk: '#9c7040', woodLt: '#e2bd88',
  frost: '#fff4e2', frostDk: '#ead2b4',
  berry: '#c8364f', berryDk: '#93223a',
  plum: '#6a4c9c', plumLt: '#9a7fd0',
  lime: '#a7d16b', limeDk: '#79a443',
  sky: '#8fd0e8', skyDk: '#5ea6c4',
  pink: '#f19bb5', pinkDk: '#cf6f8f',
  white: '#ffffff',
  black: '#000000',
  neonPink: '#ff4fa3', neonCyan: '#3ef0ff', neonLime: '#b8ff5a', neonGold: '#ffd34d',
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
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);
