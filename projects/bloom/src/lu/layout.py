"""Fixed staging layout for BLOOM. Every shot and the environment build to these marks (world coords, metres; +Y =
north, +X = east). Shots read them from here; heights come from the terrain: `W.ground(x, y)` (or terrain.height).

The valley runs south -> north: the stump of Claude's home tree on the valley floor at the origin, the charred forest
all around, the mountain rising out of the valley's north end with the climb up its south face, ridges ringing the
valley (more ridges layered beyond, fading into the haze). The storm rolls in from the west-north-west; the low sun is
behind the peak (as seen from the valley), so the summit is back/rim lit from the stump and the beam slants down
from the upper right onto PEAK_SOIL.

The environment agent may refine the numbers but keeps the names."""
STUMP = (0.0, 0.0)            # the charred stump of Claude's home tree (centre; ~3 m wide trunk, roots to ~3.5 m)
STUMP_R = 1.5                 # trunk radius at chest height (m); base flare + roots reach ~2.2 m / ~3.5 m
DOOR_AZ = -95.0               # the hollow door-hole faces this azimuth (deg, 0 = +X east, 90 = north): south
SWING = (2.75, -0.35)         # where the charred rope swing's seat hangs (under the dead branch, east side)
SWING_PIVOT_Z = 2.95          # height of the branch the swing ropes hang from (above the stump's ground)
SEED = (0.95, -2.35)          # where the glowing seed lies in the ash at the stump's foot (south side, by the roots)
PEAK = (30.0, 150.0)          # the summit (a small rocky crown with one patch of soil); ~55 m above the valley floor
PEAK_SOIL = (30.0, 149.0)     # the soil patch where the sprout is planted (the sunbeam lands here)
SLOPE_START = (14.0, 92.0)    # foot of the climb (ash slope)
SCREE = (18.0, 108.0)         # the ash/scree slope that collapses (B09)
LEDGE = (24.0, 126.0)         # the rock ledge Claude hauls itself up (B11); a ~1.1 m strata step, its face looks south
HAIL_SPOT = (26.0, 136.0)     # where Claude curls up under the hail (B12-B15), a small bench under a rock band
STORM_FROM = (-1.0, 0.35)     # direction the storm rolls in from (west-north-west), horizontal unit-ish vector
SUN_AZ_EL = (75.0, 24.0)      # sun direction (azimuth deg 0=+X 90=+Y, elevation deg): low, just behind and above
                              # the peak as seen from the stump (the peak sits at azimuth ~79 deg, elevation ~20 deg),
                              # so the summit glows rim-lit in the hole of the overcast and the beam slants onto it
BLOOM_R_END = 430.0           # the bloom wave's radius (m from PEAK_SOIL) once it has covered every visible slope
