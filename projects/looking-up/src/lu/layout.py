"""Fixed staging layout for the film. Every shot and the environment build to these marks (world coords, metres;
+Y = north). The windmill's sails face south (-Y); the meadow, the pine edge and the constellation are to the north."""
WM_XY = (0.0, 7.0)            # windmill centre; ground there z = 1.38
CONST_CENTER = (90.0, 30.0)   # constellation centre: azimuth 90 = due north, 30 deg above the horizon
GALLERY_N = (0.0, 10.45)      # Claude's mark at the north rail of the gallery (z = gallery deck, see windmill)
GALLERY_S = (0.0, 3.55)       # south gallery: where Claude boards the low sail tip (sails sweep past here)
CRATER = (2.6, 15.0)          # where the fallen star lands (north meadow; ground z ~ 0.7)
LIE = (1.0, 13.6)             # lying side by side in the flowers
NORTH_VIEW = (55.0, 125.0)    # azimuth sector (deg) kept free of tall trees from GALLERY_N / CRATER
