import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, numpy as np
from lu import scene, mat, geo, sky
sc = scene.reset()
sc.render.resolution_x, sc.render.resolution_y = 200, 100
P = dict(sky.PRESETS["golden"]); P["world_e"] = float(sys.argv[-1]); P["key_e"] = 0.0
lights, _ = sky.build(P)
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
m = mat.painterly("W", (1, 1, 1), stroke="strokes_broad", scale=0.5, tex_amt=0.0, breakup=0.0)
o = geo.box("B", (20, 20, 0.1), loc=(0, 0, 0), mat=m)
cam = scene.camera(lens=35, loc=(0, -3, 2), target=(0, 0, 0))
sc.render.filepath = "/tmp/tw.png"
bpy.ops.render.render(write_still=True)
img = bpy.data.images.load("/tmp/tw.png"); px = np.array(img.pixels[:]).reshape(100, 200, 4)
print("PIX world_e", sys.argv[-1], np.round(px[30, 100, :3], 3))
