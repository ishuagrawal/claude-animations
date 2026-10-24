"""Dev test: the star at night next to Claude. blender -b --python src/test_star.py -- out/test"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lu import scene, claude, star, mat, geo, sky, post, terrain, foliage

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/lu_test"
sc = scene.reset()
lights, P = sky.build("night")
T = terrain.build()
H = terrain.height
foliage.grass("G", (0, -8), 4.0, 6000, H, seed=3, blade=(0.08, 0.2))
c = claude.Claude()
z0 = float(H(0.0, -8.0))
c.apply(dict(x=0.25, y=-8.0, z=z0, heading=-25, look_x=-0.5, look_y=-0.2, eye_happy=0.4, head_tilt=-10, armR_up=-20, armR_fwd=30))
s = star.Star()
cam = scene.camera(lens=40, loc=(-0.6, -10.6, z0 + 0.55), target=(-0.15, -8.0, z0 + 0.35), fstop=2.4)
poses = {
    "happy": dict(eye_happy=0.8, arms=25, glow=1.4, head=-10, look_x=0.5),
    "scared": dict(curl=35, squash=-0.12, glow=1.8, pupil=0.8, eye_open=1.0, look_x=0.6, droop=10),
    "dim": dict(droop=45, legs=-10, glow=0.25, warmth=0.15, eye_open=0.45, eye_tilt=0.8, look_y=-0.6, head=20),
}
scene.char_lights(c.col, (0.25, -8.0, z0 + 0.4), cam.location, P["sun_dir"], rim_col=(0.6, 0.75, 1.0), rim_w=60.0)
post.setup(haze=P["haze"], haze_amt=0.3, bloom=0.6, bloom_thr=0.7, bloom_size=8)
for n, p in poses.items():
    pp = dict(x=-0.42, y=-8.05, z=z0 + 0.32, heading=20)
    pp.update(p)
    s.apply(pp)
    bpy.context.view_layer.update()
    scene.render_still(os.path.join(out, f"star_{n}.png"))
