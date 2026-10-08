"""C03 — EXT night: the long pull-back. From Claude small on the gallery, up and away: the windmill turning slowly on
its peak above the sea of moonlit cloud — and over it, filling the sky, the Claude-shaped constellation, complete,
both eyes shining. Its lines glow faintly in, then the picture slowly fades (title composited at encode)."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, finale, windmill, props, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.c02 import GAL_A, gallery_spot, perch, PERCH


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=20.0, window_glow=0.7), overrides=dict(stars=1.3))
    O = W.origin
    dur = (f1 - f0) / 24
    finale.patch_canvas()
    hub = W.wm["hub"]
    for f in range(f0, f1, 2):
        windmill.sails_set_angle(hub, 20.0 + 6.0 * (f - f0) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    K = props.constellation(origin=(O.x, O.y, 0), lines=0.0, eye=1.0)
    for ln in K["lines"]:
        for f in range(f0, f1, 3):
            t = (f - f0) / 24
            ln["line"] = 0.42 * anim.ease("soft", (t - 4.5) / 4.0)
            ln.keyframe_insert('["line"]', frame=f)
    gz = O.z + windmill.GALLERY_Z + 0.17
    cpos, out = gallery_spot(O)
    cpos.z = gz
    look = props.const_dir(0, 0)
    flat = Vector((look.x, look.y, 0)).normalized()
    hd = math.degrees(math.atan2(flat.x, -flat.y))
    side = Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0))
    T = finale.scrap_telescope()
    tp = cpos + side * 0.62 - flat * 0.45            # beside it, just behind its left shoulder
    T["root"].location = (tp.x, tp.y, gz)
    T["root"].rotation_euler = (0, 0, math.radians(hd) + math.radians(25))
    T["root"].scale = (1.25, 1.25, 1.25)
    perch(W, cpos, hd)
    gz += PERCH
    cpos.z = gz
    c = W.claude()
    tr = Track()
    tr.pose(0.0, S.merge(S.C_WONDER, x=cpos.x, y=cpos.y, z=gz, heading=hd, look_y=1.0, eye_happy=0.75, eye_open=0.7,
                         lean=-12, head_nod=-12, armL_up=-20, armR_up=-20, head_tilt=8))
    tr.layer(anim.breathe(0.012, 0.22))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # the pull-back: from above Claude's shoulder on the gallery, up and away over the peak, then back and down over
    # the sea of cloud, tilting up until the windmill stands on its peak under the whole constellation
    def aim(e, az, el, d=50.0):
        a_, e_ = math.radians(az), math.radians(el)
        return e + Vector((math.cos(e_) * math.cos(a_), math.cos(e_) * math.sin(a_), math.sin(e_))) * d
    head = cpos + Vector((0, 0, 0.5))
    e0 = cpos + Vector((3.2, -3.4, 3.0))
    t0 = head + Vector((-0.1, 1.0, 0.25))
    e1 = O + Vector((9.0, -13.0, 12.0))
    t1 = O + Vector((0.5, 0.0, 9.0))
    e2 = O + Vector((4.0, -57.0, -11.4))
    t2 = aim(e2, 93, 33.0)
    e3 = e2 + Vector((0.3, -1.6, -0.3))
    cam = scene.camera("Cam", lens=30)
    ct = Track(CAM_DEFAULT)
    ct.key(0.0, cx=e0.x, cy=e0.y, cz=e0.z, tx=t0.x, ty=t0.y, tz=t0.z, lens=30)
    ct.key(4.0, "inout", cx=e1.x, cy=e1.y, cz=e1.z, tx=t1.x, ty=t1.y, tz=t1.z, lens=22)
    ct.key(10.0, "inout", cx=e2.x, cy=e2.y, cz=e2.z, tx=t2.x, ty=t2.y, tz=t2.z, lens=20)
    ct.key(dur, "soft", cx=e3.x, cy=e3.y, cz=e3.z, tx=t2.x, ty=t2.y, tz=t2.z, lens=20)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=85)
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.4)), e0, (0.3, 0.8, 0.4), rim_col=(0.6, 0.75, 1.0), rim_w=22.0,
                      fill_col=(0.55, 0.65, 0.95), fill_w=4.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=60.0, mist_depth=2000.0, bloom=0.85, bloom_thr=0.45,
                          vignette=0.4))
