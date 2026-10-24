"""Look-development frame: blender -b --python src/lookdev.py -- <out.png> [preset]"""
import sys, os, time, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lu import scene, sky, terrain, windmill, foliage, clouds, claude, post, mat, geo

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = args[0] if args else "/tmp/lookdev.png"
preset = args[1] if len(args) > 1 else "golden"
t0 = time.time()
sc = scene.reset()
lights, P = sky.build(preset)
T = terrain.build()
terrain.rocks(keep_clear=[(8.0, -17.0, 9.0), (6.4, -12.6, 5.0)])
wm = windmill.build(origin=(terrain.WINDMILL[0], terrain.WINDMILL[1], float(terrain.height(*terrain.WINDMILL))), sails_angle=12)
H = terrain.height


def avoid(x, y):
    return math.hypot(x - terrain.WINDMILL[0], y - terrain.WINDMILL[1]) < 4.3 or abs(x - terrain.path_x(y)) < 0.55


foliage.grass("GrassNear", (5.0, -11.0), 9.0, 30000, H, seed=1, avoid=avoid, blade=(0.10, 0.26))
foliage.grass("GrassMid", (0.0, -2.0), 21.0, 40000, H, seed=2, avoid=avoid, blade=(0.25, 0.55))
for i, (x, y, h) in enumerate([(-12.5, -7.5, 9), (-14.5, -3.5, 11), (-10.8, -10.5, 6.5), (14.5, 3.0, 10), (16.5, -2.0, 8),
                               (9.0, 15.5, 12), (-8.0, 16.0, 10), (13.0, 9.5, 7)]):
    foliage.pine(f"Pine{i}", (x, y, float(H(x, y))), height=h, radius=h * 0.28, seed=i)
for i, (x, y, r) in enumerate([(-3.8, 4.2, 0.9), (4.2, 3.8, 0.7), (-6.5, -2.0, 1.1), (7.5, -9.0, 0.8)]):
    foliage.bush(f"Bush{i}", (x, y, float(H(x, y)) + r * 0.3), r, seed=i)
cl = clouds.sea()
clouds.floor()
clouds.massifs()
c = claude.Claude()
shot = args[2] if len(args) > 2 else "wide"
cx, cy = 4.6, -10.6
c.apply(dict(x=cx, y=cy, z=float(H(cx, cy)), heading=200 if shot == 'wide' else 35, head_tilt=-4, look_x=0.0, look_y=0.4,
             armL_up=-8, armR_up=-8))
if shot == "wide":
    cam = scene.camera(lens=28, loc=(8.0, -17.0, float(H(8.0, -17.0)) + 1.25), target=(1.2, 4.0, 5.5), fstop=5.6)
    cam.data.dof.focus_distance = 8.0
else:
    cam = scene.camera(lens=45, loc=(cx + 1.3, cy - 3.1, float(H(cx + 1.3, cy - 3.1)) + 0.55), target=(cx - 0.4, cy + 0.2, float(H(cx, cy)) + 0.5), fstop=2.8)
scene.char_lights(c.col, (cx, cy, float(H(cx, cy)) + 0.4), cam.location, P['sun_dir'], rim_w=420.0, fill_w=40.0)
sxy = scene.sun_screen(cam, P["sun_dir"])
post.setup(haze=(0.55, 0.52, 0.68), haze_warm=P["haze"], haze_amt=0.5, mist_start=60.0, mist_depth=2500.0, bloom=0.3,
           sun_xy=sxy, sun_glow=0.28, sun_size=0.5)
print("BUILD", time.time() - t0)
t1 = time.time()
scene.render_still(out)
print("RENDER", time.time() - t1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(out), "lookdev.blend"))
