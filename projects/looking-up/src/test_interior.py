"""Dev test: interior look. blender -b --python src/test_interior.py -- out/test [preset]"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lu import scene, claude, star, mat, geo, sky, post, terrain, interior

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
preset = args[1] if len(args) > 1 else "dusk"
sc = scene.reset()
P = dict(sky.PRESETS[preset])
P["sun_dir"] = (0.75, -0.62, 0.22)
lights, P = sky.build(P)
O = (0.0, 7.0, float(terrain.height(0, 7)))
terrain.build()
sky.interior_mode('night')
I = interior.build(origin=O)
for piv in I["win_front"][1] + I["win_side"][1]:
    interior.set_ishutter(piv, 1.0)
bpy.context.view_layer.update()
c = claude.Claude()
tb = I["table"]["top"]
cx, cy = O[0] + 0.55, O[1] - 0.95
c.apply(dict(x=cx, y=cy, z=O[2], heading=-155, look_x=0.3, eye_happy=0.0, armL_up=-30, armR_up=-30))
s = star.Star()
sp = I["stove"]["pos"] + Vector(O) + I["stove"]["front"] * 0.55
s.apply(dict(x=sp.x, y=sp.y, z=O[2] + 0.12, heading=-40, droop=20, eye_open=0.0, glow=0.8, pitch=-70))
s.light_scale = 12
lamp = scene.point("OilLamp", Vector(O) + Vector((tb.x + 0.25, tb.y - 0.18, 0.95)), (1.0, 0.6, 0.28), 18.0, 0.04)
fire = scene.point("StoveGlow", I["stove"]["pos"] + Vector(O) + I["stove"]["front"] * 0.45 + Vector((0, 0, 0.5)), (1.0, 0.4, 0.12), 6.0, 0.15)
cam = scene.camera(lens=30, loc=(O[0] - 1.9, O[1] - 1.9, O[2] + 1.15), target=(O[0] + 0.7, O[1] - 0.4, O[2] + 0.62), fstop=3.5)
scene.char_lights(c.col, (cx, cy, O[2] + 0.4), cam.location, (0.3, 0.5, 0.2), rim_col=(1.0, 0.7, 0.45), rim_w=40.0)
post.setup(haze=P["haze"], haze_amt=0.0, bloom=0.4, bloom_thr=0.8, kuw_near=3, kuw_far=4)
scene.render_still(os.path.join(out, f"interior_{preset}.png"))
