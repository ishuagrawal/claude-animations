// Beat times (seconds), shared by picture and score.
export const T = {
  touch: 0.4,               // first fingertip contact at the top-center seam
  gest: [0.55, 3.75],       // the finger draws a loose lasso
  snap: 3.55,               // the lasso springs into the display's rounded rectangle
  seal: 4.2,                // the two ends fuse: a pulse runs round the frame
  pill: [4.65, 5.4],        // a drop of light settles into the camera island
  swipe: [5.85, 6.02, 6.55],// touch down, drag starts, lift (then the trail flings off-screen)
  pinch: [7.35, 7.55, 8.6], // two fingers down, start moving, meet (seed of light remains)
  pull: [8.9, 11.9],        // camera pulls back and rises: it's a laptop
  hinge: [9.5, 10.1],
  base: [9.85, 10.95],
  front: [10.45, 11.15],
  rim: [10.6, 12.5],        // amber light runs along the lid's edge
  leaf: [11.85, 12.25],
  pour: [12.15, 13.45],     // light pours down both sides of the logo and meets at the bottom
  close: [15.0, 16.55],     // the lid closes; everything folds into one line
  line: [16.6, 17.5],
  text1: [17.4, 19.6],
  text2: [19.8, 22.0],
  end: 22.5,
};
