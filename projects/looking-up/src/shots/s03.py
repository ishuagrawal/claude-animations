"""S03 — INT evening: tea alone. Shot across the table past the empty second stool (soft foreground):
Claude sips, lowers the cup, glances at the empty seat opposite... a small sigh, looks down into the cup."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, geo, interior
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as CDEF
from shots import s06 as S6


def make(f0, f1):
    W = world.World("int", "dusk")
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    pr = W.practicals(lamp=6.0, stove=3.0, candle=3.5, fill=2.0)
    dur = (f1 - f0) / 24
    I = W.I
    seat = I["table"]["seat"]
    tbl = I["table"]["top"]
    c = W.claude()
    h = S.heading_to((seat.x, seat.y), (tbl.x, tbl.y))
    # the cup: move the table cup into Claude's hands (attached to the right forearm)
    cup = I["table"]["cup"]
    bpy_cup = cup
    # hold the cup in front with both arms
    hold = dict(armL_fwd=62, armR_fwd=62, armL_up=8, armR_up=8, armL_curl=25, armR_curl=25)
    S.attach(bpy_cup, c, "armR2", Matrix.Translation(Vector((-0.06, -0.47, 0.4))), pose=hold)
    # the second stool, set aside at the far end of the table, opposite Claude
    s2o = I["table"]["stool2"]
    s2o.location = (2.1, 1.86, 0.0)
    s2w = O + Vector((s2o.location.x, s2o.location.y, 0.48))
    sit = S.C_SIT(seat.z)
    base = S.merge(sit, hold, x=O.x + seat.x, y=O.y + seat.y, z=O.z, heading=h)
    tr = Track()
    tr.pose(0.0, base, eye_open=0.85, look_y=-0.3, look_x=0.0, head_turn=0)
    # sip: lift the cup to the face, eyes close
    tr.key(0.7, "inout", armL_up=34, armR_up=34, armL_fwd=72, armR_fwd=72, head_nod=-6, eye_open=0.8)
    tr.key(1.0, "inout", eye_open=0.05, eye_happy=0.3)
    tr.key(1.6, "inout", eye_open=0.05, eye_happy=0.35)
    tr.key(2.0, "inout", armL_up=8, armR_up=8, armL_fwd=62, armR_fwd=62, head_nod=0, eye_open=0.85, eye_happy=0.0,
           head_turn=0, look_x=0.0)
    # glance across at the empty stool opposite (just below camera A), linger
    lk = S.look_params((O.x + seat.x, O.y + seat.y), h, O.z + 0.9, s2w)
    tr.key(2.5, "inout", head_turn=0, head_nod=4, eye_open=0.95, **lk)
    tr.key(3.4, "linear", head_turn=0, look_x=lk["look_x"] * 1.05, look_y=lk["look_y"] - 0.05, slump=0, eye_tilt=0.0,
           squash=0.0)
    # small sigh: sag, eyes soften and lower
    tr.key(3.9, "inout", head_turn=0, head_nod=0, slump=10, look_x=0.0, look_y=-0.7, eye_open=0.6, eye_tilt=0.45,
           squash=-0.04)
    tr.key(dur, "soft", slump=13, eye_open=0.55, look_y=-0.75)
    S6.anchor(tr, CDEF)
    tr.layer(anim.breathe(0.009, 0.3))
    tr.layer(anim.blinks(times=[2.25, 4.6], dur=0.18))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    fx.steam("TeaSteam", L(tbl.x - 0.25, tbl.y - 0.3, 0.95), f0, f1, rate=2.5, seed=4, opacity=0.18)

    I["table"]["pot"].location = I["bench"]["top"] + Vector((0.45, 0.0, 0.0))     # off the table, on the bench
    # (A) across the table from beside the empty stool: Claude's face as it sips, glances over, sighs.
    # (B) the reverse at the glance: high over Claude's shoulder, down the table to the empty stool at its end.
    T_B0, T_B1 = 2.55, 3.55
    camA = scene.camera("CamA", lens=40)
    ca = Track(CAM_DEFAULT)
    a = L(2.2, 1.95, 1.12)
    tgt = L(seat.x, seat.y, 0.8)
    ca.key(0, cx=a.x, cy=a.y, cz=a.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=40, fstop=2.2, focus=(tgt - a).length)
    b = L(2.14, 1.9, 1.1)
    ca.key(dur, "soft", cx=b.x, cy=b.y, cz=b.z, tx=tgt.x, ty=tgt.y, tz=tgt.z - 0.02, lens=46, fstop=2.2,
           focus=(tgt - b).length)
    ca.layer(lambda t, p: p.update(shake=0.25))
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=3)
    hr = math.radians(h)
    fwd = Vector((math.sin(hr), -math.cos(hr), 0.0))
    left = Vector((-fwd.y, fwd.x, 0.0))
    camB = scene.camera("CamB", lens=35)
    cb = Track(CAM_DEFAULT)
    eb = L(seat.x, seat.y, 2.05) - fwd * 0.7 + left * 0.42
    tb = s2w + Vector((0, 0, 0.12)) - fwd * 0.25
    cb.key(T_B0, cx=eb.x, cy=eb.y, cz=eb.z, tx=tb.x, ty=tb.y, tz=tb.z, lens=35, fstop=2.8, focus=(tb - eb).length)
    cb.key(T_B1, "soft", cx=eb.x + fwd.x * 0.06, cy=eb.y + fwd.y * 0.06, tz=tb.z - 0.02, lens=37)
    cb.layer(lambda t, p: p.update(shake=0.2))
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=13)
    # the last of the dusk through the side window falls on the empty seat
    import bpy
    lw = bpy.data.lights.new("EmptySeatLight", "AREA")
    lw.color = (0.75, 0.62, 0.85)
    lw.energy = 22.0
    lw.size = 0.6
    ow = bpy.data.objects.new("EmptySeatLight", lw)
    bpy.context.scene.collection.objects.link(ow)
    wa = math.radians(45)
    scene.look_at(ow, O + Vector((math.cos(wa), math.sin(wa), 0)) * (interior.RI - 0.15) + Vector((0, 0, 1.25)), s2w)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(round(T_B0 * 24)))
    S.cut(camA, f0 + int(round(T_B1 * 24)))
    __import__("bpy").context.scene.camera = camA
    scene.char_lights(c.col, tgt, camA.location, (-0.7, -0.4, 0.3), rim_col=(1.0, 0.62, 0.35), rim_w=10.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.45, bloom_thr=0.8, kuw_near=3, kuw_far=4, vignette=0.4))
