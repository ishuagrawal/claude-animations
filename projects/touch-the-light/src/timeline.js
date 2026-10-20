// Beat times (seconds), shared by picture and score.
export const T = {
  touch: 0.35,               // a fingertip lands
  stroke: [0.5, 3.2],        // one soft brush stroke loops across; it parts round the hidden island
  islandPass: 1.3,           // the stroke's head reaches the island
  island: [3.45, 4.5],       // the island breathes wider and back: the fibers make room
  flick: [4.75, 4.87, 5.17], // finger down, drag up, release: the light scrolls, overshoots, rubber-bands
  pinch: [6.15, 6.35, 7.35], // two fingers down, gather, the light collapses into one point
  pixel: [7.45, 9.0],        // the point opens into one pixel's red, green and blue emitters, then folds back
  line: [9.0, 9.7],          // the point draws out into a line...
  lid: [9.85, 11.7],         // ...which splits: the top half lifts open like a lid
  emit: [11.5, 13.6],        // the open "screen" emits a sheet of light across the frame
  carve: 12.7,               // the sheet reaches the logo: it flows round it, leaving true black
  drain: [15.0, 16.3],       // the light drains back to the logo's edge
  fade: [16.5, 18.0],        // the edge cools to amber and goes out (the reference's exit)
  end: 18.8,
};
