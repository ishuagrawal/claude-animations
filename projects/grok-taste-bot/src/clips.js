// Source clips. `file` is relative to the sources folder (one file per creator, named after their X handle);
// `ref` is the Grok Bot reference film. [from, to] is the source range extracted by render/prep.mjs.
// Clips with `snap` are shown as a single frozen frame (`snap` = seconds into the extracted range);
// `loop` clips repeat their range; `rate` slows a clip that is on screen longer than its range.
export const CLIPS = {
  cerpow:          { file: 'cerpow.mp4',          from: 0.0, to: 1.87, rate: 0.75 },
  zarazhangrui:    { file: 'zarazhangrui.mp4',    from: 0.9, to: 3.8 },
  shirotatakajo:   { file: 'shirotatakajo.mp4',   from: 0.0, to: 1.4, loop: true },
  shun_webdesign:  { file: 'shun_webdesign.mp4',  from: 1.3, to: 3.6 },
  nickbakeddesign: { file: 'nickbakeddesign.mp4', from: 1.2, to: 3.32 },
  stackedlol:      { file: 'stackedlol.mp4',      from: 0.0, to: 2.2 },
  rameerez:        { file: 'rameerez.mp4',        from: 0.0, to: 1.8 },
  ann_nnng:        { file: 'ann_nnng.mp4',        from: 0.0, to: 1.8 },
  yui540:          { file: 'yui540.mp4',          from: 0.0, to: 1.6 },
  nono_ai_archive: { file: 'nono_ai_archive.jpeg', snap: 0 },
  DilumSanjaya:    { file: 'DilumSanjaya.mp4',    from: 2.3, to: 2.5, snap: 0 },
  AmirMushich:     { file: 'AmirMushich.mp4',     from: 1.7, to: 3.52 },
  ref:             { file: null,                  from: 8.6, to: 12.7 },
};

export const FPS = 30;
// Extracted frames are downscaled so their height is at most this (keeps zoom headroom at 1080p).
export const MAX_H = 1100;
