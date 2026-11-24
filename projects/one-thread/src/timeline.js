// The cue sheet. 96 BPM, 24 fps: beat = 15 frames, bar = 2.5 s.
export const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
export const bar = (n, b = 0) => n * BAR + b * BEAT;
// the ring of squares, in the order the thread visits them: [id, column, row]
export const RING = [
  ['australia', 0, 0], ['ur', 1, 0], ['nile', 2, 0], ['aegean', 3, 0], ['india', 4, 0], ['china', 5, 0],
  ['steppe', 5, 1], ['persia', 5, 2], ['swahili', 5, 3], ['asante', 5, 4],
  ['norse', 5, 5], ['ukraine', 4, 5], ['arctic', 3, 5], ['wampum', 2, 5], ['maya', 1, 5], ['andes', 0, 5],
  ['polynesia', 0, 4], ['java', 0, 3], ['japan', 0, 2],
];
export const BLANK = ['blank', 0, 1];
export const PANEL_BARS = 2, PANEL_DUR = PANEL_BARS * BAR;
export const C = {
  spark1: bar(0, 2), spark2: bar(0, 3), ember: bar(1), spin: bar(1), text0: bar(1, 0.5), bloom: bar(2), hunt: bar(3), figure: bar(4), title: bar(5), titleSet: bar(5, 1.6),
  panels: bar(6), montage: bar(6 + 19 * PANEL_BARS), ring: bar(46), pull: bar(48), whole: bar(51), glide: bar(53), hands: bar(55), held: bar(57), line2: bar(58), out: bar(60.4), end: bar(61),
};
export const panelStart = i => C.panels + i * PANEL_DUR;
export const DURATION = C.end;
