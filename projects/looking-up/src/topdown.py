"""Top-down orthographic map of the interior (mill-local metres, grid every 0.5 m) for staging."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lu import scene, interior, geo, mat
sc = scene.reset()
sc.render.engine = "BLENDER_WORKBENCH"
sc.render.resolution_x = sc.render.resolution_y = 1000
I = interior.build(origin=(0, 0, 0))
bpy.data.objects["IntCeiling"].hide_render = True
bpy.data.objects["Joists"].hide_render = True
# grid markers every metre
gm = mat.emissive("GridM", (1, 0, 0), 1)
for x in range(-3, 4):
    for y in range(-3, 4):
        geo.box(f"g{x}{y}", (0.04, 0.04, 0.01), loc=(x, y, 3.0), mat=gm)
geo.box("axisX", (1.0, 0.03, 0.01), loc=(0.5, 0, 3.0), mat=gm)
cd = bpy.data.cameras.new("top"); cd.type = "ORTHO"; cd.ortho_scale = 7.0
cam = bpy.data.objects.new("top", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, 0, 10)
sc.display.shading.light = "FLAT"
sc.display.shading.color_type = "RANDOM"
sc.render.filepath = sys.argv[-1]
bpy.ops.render.render(write_still=True)
