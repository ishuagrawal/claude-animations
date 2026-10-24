"""Dev test: render Claude in a few poses. blender -b --python src/test_claude.py -- out/test"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from lu import scene, claude, mat, geo

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/lu_test"
t0 = time.time()
sc = scene.reset()
sc.render.resolution_x, sc.render.resolution_y = 1280, 544
scene.world_color((0.25, 0.35, 0.6), (0.9, 0.6, 0.45), 0.6)
scene.sun("Key", (55, 0, -35), (1.0, 0.78, 0.55), 4.0)
scene.sun("Rim", (60, 0, 160), (1.0, 0.6, 0.45), 3.0, shadow=False)
ground = geo.box("ground", (20, 20, 0.1), (0, 0, -0.05), mat=mat.painterly("ground", (0.18, 0.3, 0.08), stroke="strokes_broad", scale=0.5))
c = claude.Claude()
poses = {
    "neutral": {},
    "happy": dict(eye_happy=0.85, eye_open=0.9, armL_up=40, armR_up=40, squash=0.06, head_tilt=8, look_y=0.3),
    "sad": dict(slump=22, lean=8, eye_tilt=0.9, eye_open=0.6, armL_up=-55, armR_up=-55, look_y=-0.6, squash=-0.05),
    "fear": dict(lean=-12, squash=-0.12, eye_open=1.0, pupil=0.75, armL_up=50, armL_fwd=40, armL_bend=40, armR_up=50, armR_fwd=40, armR_bend=40, legs_splay=6),
}
cam = scene.camera(lens=50, loc=(0.9, -3.0, 0.75), target=(0, 0, 0.38), fstop=2.8)
for i, (n, p) in enumerate(poses.items()):
    c.apply(p)
    bpy.context.view_layer.update()
    scene.render_still(os.path.join(out, f"claude_{n}.png"))
print("TIME", time.time() - t0)
