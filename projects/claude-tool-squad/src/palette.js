// Palette from the style bible (k-means of the reference's frames) + the mascot's coral.
// Coral is reserved for Claude (and its subagents); nothing else in frame uses it.
export const P = {
  // line + darks
  line: '#1e1310',      // cel outline ink (ref #0c0805, warmed)
  ink: '#0c0805',
  ink2: '#1b1420',
  ink3: '#2a2238',
  // skies (ref #1f9bc1 / #44abc2 / #85b5c1)
  skyDeep: '#1478b4',
  sky: '#1f9bc1',
  skyMid: '#44abc2',
  skyPale: '#9fd0dc',
  haze: '#c9e4e6',
  cloud: '#fbfbf6',
  cloudSh: '#b4c6d4',
  cloudSh2: '#8ea9c2',
  // warm (ref #eec17d #f1dbb1 #e99468 #b15d34 #f9b017)
  sand: '#eec17d',
  cream: '#f6efdc',
  paper: '#fbf7e6',
  peach: '#f1dbb1',
  orange: '#e99468',
  brown: '#b15d34',
  brownDk: '#7a3c22',
  gold: '#f9b017',
  lemon: '#ffe46b',
  lemonDk: '#e2b52a',
  // cool darks / villain
  teal: '#3a6371',
  tealDk: '#22414c',
  mauve: '#a88682',
  mauveDk: '#7d5e63',
  grey: '#c1ccc8',
  purple: '#5b3a7a',
  purpleDk: '#2e1c45',
  violet: '#8a5cc0',
  // nature
  grass: '#6cb24a',
  grassDk: '#3f8a3a',
  forest: '#2f6b3f',
  forestDk: '#1d4a32',
  hill: '#86c06a',
  rock: '#c79a6a',
  rockDk: '#94663f',
  // hero (refs/claude-mascot.png #DA7758)
  coral: '#da7758',
  coralDk: '#a9502f',
  coralLt: '#f2a07d',
  // UI / signals
  red: '#e8333f',
  redDk: '#a3172a',
  green: '#35c26b',
  greenLt: '#8ff0a4',
  term: '#14121c',
  termGreen: '#7dffa0',
  termDim: '#8a87a8',
  white: '#ffffff',
  // aliases used by the bundled fx kit
  blue: '#2f7fd0',
  navy: '#163a7a',
  cyan: '#8ff0ff',
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
