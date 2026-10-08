"""S05 — EXT night: the warm window goes dark (lamp blown out). The camera tilts up past the cap and the sails
to the sky: the Claude-shaped constellation, one eye missing. Faint star-chart lines breathe in so the shape
reads; hold on the empty eye."""
import math
from mathutils import Vector
from lu import world, anim, scene, stage as S, props, windmill
from lu.anim import Track, CAM_DEFAULT


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(window_glow=1.0, sails_angle=33.0))
    O = W.origin
    dur = (f1 - f0) / 24
    K = props.constellation(origin=(O.x, O.y, 0), lines=0.0, bright=1.0, eye=0.0)
    m = __import__("bpy").data.materials.get("WindowGlass")
    # window glow off at 1.1 s (keyframe the emission mix factor)
    node = None
    for n in m.node_tree.nodes:
        if n.type == "MIX" and n.data_type == "RGBA" and n.blend_type == "MIX" and not n.inputs[6].is_linked \
                and tuple(n.inputs[6].default_value)[:3] == (0.0, 0.0, 0.0) and n.inputs[7].is_linked:
            node = n
    for f in range(f0, f1):
        t = (f - f0) / 24
        node.inputs[0].default_value = 1.0 if t < 1.05 else max(0.0, 1.0 - (t - 1.05) / 0.12)
        node.inputs[0].keyframe_insert("default_value", frame=f)
    for ln in K["lines"]:
        for f in range(f0, f1, 2):
            t = (f - f0) / 24
            ln["line"] = 0.32 * anim.ease("soft", (t - 3.0) / 1.6)
            ln.keyframe_insert('["line"]', frame=f)
    cam = scene.camera(lens=26)
    a = O + Vector((6.2, -7.4, 0.9))
    win = O + Vector((2.6, -2.6, 1.45))
    cdir = props.const_dir(1.5, -2.5)
    sky_t = a + cdir * 60.0
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=a.x, cy=a.y, cz=a.z, tx=win.x, ty=win.y, tz=win.z, lens=30)
    ct.key(1.6, "linear", tx=win.x, ty=win.y, tz=win.z + 0.2, lens=30)
    ct.key(3.8, "inout", tx=sky_t.x, ty=sky_t.y, tz=sky_t.z, lens=24)
    ct.key(dur, "linear", tx=sky_t.x, ty=sky_t.y, tz=sky_t.z + 0.6, lens=23)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=5)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=60.0, mist_depth=2000.0, bloom=0.7, bloom_thr=0.6,
                          bloom_size=8))
