"""B13 (33.13-35.63 s, 4 beats): wide, from across the mountainside at the bench's level. Tiny Claude curled on the
bench under the rock band, a speck of orange with a green ember under it, inside a curtain of hail and rain; the storm
is enormous, filling two thirds of the frame, and lightning branches right across the sky (T_BOLT) - for a few frames
everything goes white-violet and Claude is a dark little block. A slow, heavy push in."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky
from shots import act_climb as A
from shots.b12 import HEADING

T_BOLT = 1.0


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("storm", focus=(30.0, 134.0), frames=(f0, f1), storm=1.0, ambient=False)
    spot = W.mtn["hail"]["spot"]
    X = Vector((spot.x, spot.y, W.ground(spot.x, spot.y)))
    C = A.make_claude(W)
    S = A.make_sprout(C)

    tr = anim.Track(claude.DEFAULT)
    curl = dict(acting.B_CURL)
    curl.update(acting.F_FLINCH)
    curl.update(x=X.x, y=X.y, z=X.z, heading=HEADING, teeth=0.0, mouth_open=0.0, smile=-0.4, eye_tilt=0.3,
                squash=-0.12, crouch=0.9, bend=16.0, head_nod=16.0, ash=0.2, wet=0.6, damage=0.85, vivid=0.6,
                brand=0.85)
    tr.pose(0.0, curl)
    tr.layer(A.flinch_layer([0.3, 0.75, 1.3, 1.7, 2.2], amp=0.8, dur=0.25))
    tr.layer(acting.shiver(0.0, dur, amp=0.6, freq=15.0))
    tr.key(T_BOLT - 0.05, vivid=0.6)
    tr.key(T_BOLT, "linear", vivid=0.0)
    tr.key(T_BOLT + 0.2, vivid=0.0)
    tr.key(T_BOLT + 0.5, vivid=0.6)
    A.freeze(tr, 0.0, claude.DEFAULT)
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)
    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=180.0, glow=2.2, health=0.4, eye_open=0.0, head_nod=24.0,
                      leafL_curl=1.0, leafR_curl=1.0))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- camera: across the slope to the east, a little below the bench, looking west into the storm
    E0 = Vector((X.x + 13.5, X.y - 4.2, X.z - 1.6))
    E1 = Vector((X.x + 12.3, X.y - 3.8, X.z - 1.45))
    T0 = Vector((X.x - 1.0, X.y + 1.2, X.z + 3.4))
    T1 = Vector((X.x - 0.8, X.y + 1.0, X.z + 3.0))
    ct = anim.Track(anim.CAM_DEFAULT)
    A.ckey(ct, 0.0, E0, T0, lens=27.0, fstop=8.0, focus=(X - E0).length)
    A.ckey(ct, dur, E1, T1, lens=28.0, focus=(X - E1).length, ease="linear")
    ct.layer(A.handheld(amp=0.03, ang=0.3, freq=0.8, seed=131))
    ct.layer(A.impact_shake([T_BOLT + 0.05], amp=0.02, ang=0.4, dur=0.5))
    cam = A.make_camera("CamB13", ct, f0, f1, seed=13)

    # ---- the curtain: steady hail round the bench (hits the rock band and Claude's bench), long white hail
    # streaks crossing the frame between us and it, rain, splashes
    W.fx["hail"] = fx.hail((X.x, X.y), 10.0, 6000, f0, height=14.0)
    W.fx["hail2"] = fx.hail((X.x + 6.0, X.y - 2.5), 6.0, 2500, f0, height=14.0, seed=8, name="HailNear")
    W.fx["streaks"] = fx.rain((X.x + 6.0, X.y - 1.5, X.z + 4.0), (12.0, 12.0, 12.0), 5000, f0, wind=(1.0, -0.4),
                              fall=15.0, streak=(0.7, 1.2), seed=21, name="HailStreak")
    W.fx["rain"] = fx.rain((X.x + 2.0, X.y, X.z + 6.0), (30.0, 30.0, 18.0), 9000, f0, wind=(2.6, -0.9), fall=9.5)
    W.fx["splash"] = fx.rain_splashes((X.x, X.y), 8.0, 900, f0)
    W.set_env(Wet=1.0)

    # ---- lightning branching right across the sky (a long near-horizontal channel with forks), then a ground bolt
    fb = f0 + int(round(T_BOLT * A.FPS))
    bpy.context.scene.frame_set(fb)
    ce = cam.matrix_world.translation.copy()
    vd = (X - ce)
    vd.z = 0
    vd.normalize()
    sd_ = Vector((-vd.y, vd.x, 0.0))
    a = ce + vd * 420.0 - sd_ * 260.0 + Vector((0, 0, 260.0))
    b = ce + vd * 380.0 + sd_ * 180.0 + Vector((0, 0, 200.0))
    fx.lightning(fb, start=a, end=b, width=2.2, flash=1.0, seed=33, name="BoltSky")
    g = ce + vd * 300.0 + sd_ * 40.0
    g.z = W.ground(g.x, g.y)
    fx.lightning(fb + 1, start=ce + vd * 330.0 + sd_ * 20.0 + Vector((0, 0, 230.0)), end=g, width=1.6, flash=0.6,
                 seed=34, name="BoltGround", sky_flash=False)
    sky.flash(fb, 1.0, az=math.degrees(math.atan2(vd.y, vd.x)), el=22.0)
    sky.flash(f0 + 4, 0.3, az=math.degrees(math.atan2(vd.y, vd.x)) + 30.0, el=10.0, double=False)
    C.face_light(ce, energy=6.0, col=(0.82, 0.9, 1.0), dist=1.6, size=1.2)
    C.rim_light(ce, vd + Vector((0, 0, 0.6)), col=(0.78, 0.8, 1.0), energy=220.0, dist=2.2)
    W.gust(f0, f1, 1.5)
    return dict(post=A.post_storm(focus_xy=(0.42, 0.42), haze_amt=0.8))
