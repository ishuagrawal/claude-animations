import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, numpy as np
from lu import scene, mat, geo, sky
sc = scene.reset()
sc.render.resolution_x, sc.render.resolution_y = 400, 200
lights, P = sky.build("golden")
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
variants = {"plain": dict(), "vcol": dict(vcol="tint")}
x = -3
for name, kw in variants.items():
    m = mat.painterly("T_"+name, (0.30, 0.46, 0.12) if name == "plain" else (1, 1, 1), stroke="strokes_broad", scale=0.5, **kw)
    o = geo.box("B_"+name, (2, 2, 0.1), loc=(x, 0, 0), mat=m)
    att = o.data.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.tile([0.30, 0.46, 0.12, 1.0], len(o.data.vertices)))
    x += 3
blk = geo.box("blocker", (40, 1, 40), loc=(-30, 30, 0)) if "--shadow" in sys.argv else None
cam = scene.camera(lens=35, loc=(-1.5, -8, 6), target=(-1.5, 0, 0))
sc.render.filepath = sys.argv[-1]
bpy.ops.render.render(write_still=True)
img = bpy.data.images.load(sys.argv[-1]); px = np.array(img.pixels[:]).reshape(200, 400, 4)
print("PIX plain", px[100, 130, :3], "vcol", px[100, 270, :3])
