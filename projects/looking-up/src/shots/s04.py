"""S04 — EXT dusk, at the window, looking in: Claude climbs onto the step crate inside, glances out at the
evening (not up), reaches for the shutters and pulls them closed on us — the warm room and its face vanish
behind the boards. A habit; the sky goes unseen."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as CDEF
from shots import s06 as S6


def make(f0, f1):
    W = world.World("ext", "dusk", windmill_state=dict(window_glow=0.0, sails_angle=20.0), with_interior=True)
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    I = W.I
    pr = W.practicals(lamp=55.0, stove=10.0, candle=6.0, fill=26.0)
    crate_top = I["crate"]["top"]
    shut = I["win_front"][1]
    for p in shut:
        interior.set_ishutter(p, 1.0)
    an = math.radians(-45)
    nrm = Vector((math.cos(an), math.sin(an), 0.0))         # window normal (out of the room)
    tng = Vector((-nrm.y, nrm.x, 0.0))                       # screen-right as seen from outside
    c = W.claude()
    hw = S.heading_to((crate_top.x, crate_top.y), (2.5, -2.5))
    tr = Track()
    base = dict(x=O.x + crate_top.x + 0.05, y=O.y + crate_top.y - 0.05, z=O.z + crate_top.z, heading=hw)
    # climbs up onto the step crate: rises into the window from below the sill, lands with a little squash
    tr.pose(0.0, base, z=base["z"] - 0.42, look_x=0.0, look_y=-0.35, eye_open=0.8, squash=-0.06, lean=10,
            armL_up=40, armR_up=40, armL_fwd=40, armR_fwd=40)
    tr.key(0.32, "out", z=base["z"] + 0.05, squash=0.08, lean=4, look_y=-0.2, armL_up=10, armR_up=10)
    tr.key(0.5, "inout", z=base["z"], squash=-0.05, lean=0, armL_up=-25, armR_up=-25, armL_fwd=0, armR_fwd=0)
    # a glance out at the evening (level, not up), a tired blink, a small sag
    tr.key(0.62, "inout", squash=0.0, look_x=0.3, look_y=-0.08, eye_open=0.82, head_turn=0, eye_tilt=0.0, slump=0)
    tr.key(0.95, "inout", look_x=-0.35, look_y=-0.05, head_turn=-7)
    tr.key(1.15, "inout", look_x=0.0, head_turn=0, eye_open=0.72, eye_tilt=0.2, slump=4)
    # reach up and out for both shutter edges
    tr.key(1.45, "back", armL_up=72, armR_up=72, armL_fwd=-10, armR_fwd=-10, squash=0.07, lean=-4, look_y=0.2,
           slump=0)
    # pull them closed toward the middle
    tr.key(2.3, "inout", armL_fwd=62, armR_fwd=62, armL_up=55, armR_up=55, lean=5, squash=-0.03, look_y=0.0)
    tr.key(dur, "soft", armL_fwd=66, armR_fwd=66)
    tr.layer(anim.blinks(times=[1.05], dur=0.22))
    S6.anchor(tr, CDEF)
    tr.layer(anim.breathe(0.01, 0.3))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    closed = []
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = anim.ease("inout", (t - 1.45) / 0.85)
        closed.append(u)
        for p in shut:
            interior.set_ishutter(p, 1.0 - u)
            p.keyframe_insert("rotation_euler", frame=f)
    win = O + nrm * interior.RI + Vector((0, 0, 1.16))
    # warm dusk light from outside onto Claude's face (cut as the shutters close)
    ld = bpy.data.lights.new("DuskKey", "AREA")
    ld.size = 1.5
    ld.color = (1.0, 0.6, 0.45)
    wl = bpy.data.objects.new("DuskKey", ld)
    bpy.context.scene.collection.objects.link(wl)
    scene.look_at(wl, L(4.6, -3.0, 2.4), L(1.95, -1.95, 0.9))
    # the lamp-lit room behind Claude (back wall glow + a warm rim on its head), and warm spill out of the window
    # onto the sill, reveal and shutters - all gone once the boards are shut
    rb = scene.point("RoomBack", O + nrm * 1.2 + tng * -0.4 + Vector((0, 0, 1.75)), (1.0, 0.62, 0.3), 0.0, 0.3)
    ls = bpy.data.lights.new("WinSpill", "AREA")
    ls.size = 0.7
    ls.color = (1.0, 0.6, 0.3)
    ls.use_shadow = True
    sp = bpy.data.objects.new("WinSpill", ls)
    bpy.context.scene.collection.objects.link(sp)
    scene.look_at(sp, O + nrm * (interior.RI - 0.6) + Vector((0, 0, 1.45)), win + nrm * 1.5 + Vector((0, 0, -0.6)))
    for i, f in enumerate(range(f0, f1)):
        k = 1.0 - closed[i]
        ld.energy = 22.0 * k + 0.01
        rb.data.energy = 260.0 * max(k, 0.0) + 0.01
        ls.energy = 70.0 * k + 0.01
        ld.keyframe_insert("energy", frame=f)
        rb.data.keyframe_insert("energy", frame=f)
        ls.keyframe_insert("energy", frame=f)
    # outside, a few steps back: the warm window glowing in the cool dusk wall, Claude framed in it; the boards
    # swing shut on us
    cam = scene.camera(lens=45)
    ct = Track(CAM_DEFAULT)
    a = O + nrm * (interior.RI + 3.25) + tng * 0.42 + Vector((0, 0, 1.0))
    tg = win + Vector((0, 0, -0.06)) + tng * 0.02
    b = O + nrm * (interior.RI + 2.95) + tng * 0.36 + Vector((0, 0, 1.02))
    ct.key(0, cx=a.x, cy=a.y, cz=a.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=45, fstop=2.8, focus=(tg - a).length)
    ct.key(dur, "soft", cx=b.x, cy=b.y, cz=b.z, tx=tg.x, ty=tg.y, tz=tg.z + 0.02, lens=50, fstop=2.8,
           focus=(tg - b).length)
    ct.layer(lambda t, p: p.update(shake=0.2))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=4)
    sxy = scene.sun_screen(cam, W.P["sun_dir"])
    return dict(face_key=30.0,
                post=dict(haze=(0.30, 0.22, 0.34), haze_warm=W.P["haze"], haze_amt=0.5, mist_start=60.0,
                          mist_depth=2200.0, bloom=0.5, bloom_thr=0.72, vignette=0.42))
