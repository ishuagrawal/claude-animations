"""B05 (15.00-17.50, 4 beats): MS, low angle. Thunder (T_THUNDER): a cold gust whips the ash sideways; Claude flinches
and its head snaps up. Behind it a towering violet storm wall rolls over the western ridge, lightning flickering inside
it (T_FLASH); the charred trunk of its home stands black against it. Claude's arms come round the sprout in the ash, a
shelter. An insert-like push down onto the sprout: it shivers, dims and curls in on itself (T_SHIVER).
Feeling: the threat arrives (valence 0, tension 3).

Staging cheat: B03-B04 are close-ups with no readable background, so Claude here kneels at the same spot turned to
face east (the storm comes from the west, behind it); the trunk stands behind its right shoulder."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, sky, foliage
from lu import stump as STUMP
from lu.anim import Track
from shots import act_ash as A

T_THUNDER = 0.3
T_FLASH = 1.2
T_SHIVER = 1.6
HEADING = 90.0                       # Claude faces east (the storm behind it)
STORM = (0.40, 0.56)                 # the wall rolls over the ridge during the shot


def make(f0, f1):
    dur = (f1 - f0) / 24
    F = lambda t: f0 + int(round(t * 24))
    sx, sy = A.SEED_SPOT
    hd = HEADING
    fw, lf = A.front(hd), A.left(hd)
    kx, ky = sx - fw.x * A.KNEEL_REACH, sy - fw.y * A.KNEEL_REACH
    W = world.World("threat", focus=(kx - 3.0, ky + 2.0), storm=STORM[0], frames=(f0, f1))
    g = W.ground
    sz = g(sx, sy)
    from lu import dress
    dress.mow((kx, ky), 0.45)
    dress.mow((sx, sy), 0.2)
    # ---- the storm: the wall rolls in; a faint flicker before the thunder, the big flash at T_FLASH
    W.storm_advance(f0, f1, STORM[0], STORM[1])
    sky.flash(F(0.05), 0.35, az=172.0, el=10.0)
    fx.lightning(F(T_FLASH), start=Vector((-210.0, 95.0, 190.0)), end=Vector((-160.0, 70.0, 10.0)), flash=0.75,
                 seed=55, az=168.0, el=14.0)
    # the cold gust: ash streams sideways, the dead trees shiver, the charred swing is shoved
    wa = W.fx.get("wind_ash")
    if wa:
        fx.amount(wa, f0, 0.0)
        fx.amount(wa, F(T_THUNDER + 0.05), 0.0)
        fx.amount(wa, F(T_THUNDER + 0.45), 1.0)
        fx.amount(wa, F(dur), 0.85)
    W.gust(F(T_THUNDER + 0.05), f1 + 12, strength=1.6)
    if W.stump:
        STUMP.swing_push(W.stump, F(T_THUNDER + 0.3), amp=14.0, decay=1.5)
    # ---- the sprout (on the ground, the leaf has let go of the thumb): startled, then shivering and dim
    s = A.sprout("Sprout", light_scale=0.4)
    sh = hd + 180.0 + 20.0               # faces Claude, turned a little toward the camera
    sp = dict(acting.S_SPROUT, x=sx, y=sy, z=sz - 0.004, heading=sh, eye_happy=0.5, mouth=0.6, blush=0.4,
              glow=1.35, health=1.0, head_nod=-18.0, look_y=0.5, leafL_reach=40.0, leafL_curl=0.4)
    st = Track()
    st.pose(0.0, sp)
    st.key(T_THUNDER + 0.04, "linear", eye_happy=0.5, squash=0.0, leafL_reach=40.0, leafL_curl=0.4, mouth=0.6)
    st.key(T_THUNDER + 0.16, "out", eye_happy=0.0, eye_open=1.2, squash=-0.15, leafL_reach=-10.0, leafL_curl=0.6,
           leafR_curl=0.5, mouth=-0.1, blush=0.0, head_nod=-26.0, look_y=0.8, look_x=0.6, head_turn=-30.0)
    st.key(T_SHIVER - 0.1, "inout", squash=-0.05, glow=1.2, health=0.9)
    st.key(T_SHIVER + 0.35, "inout", **{k: v for k, v in acting.S_SHIVER.items() if k not in ("grow", "crack",
                                                                                               "unfurl", "leaf_open")},
           head_turn=-10.0, look_x=0.2)
    st.key(dur, "soft", glow=0.5, health=0.42, head_nod=18.0, eye_open=0.4)
    st.layer(acting.sprout_shiver(T_SHIVER - 0.05, dur + 0.5, amp=1.0, freq=13.0))
    A.bake_sprout(s, st, f0, f1)
    # ---- Claude: tender -> the flinch and snap up -> arms round the sprout -> the flash -> worried, looking down
    c = W.claude()
    base = dict(acting.B_SIFT)
    base.update(A.ASH, x=kx, y=ky, z=g(kx, ky), heading=hd, lean=8.0, bend=3.0, head_nod=2.0, squash=-0.02,
                eye_open=0.95, eye_happy=0.55, eye_tilt=0.45, smile=0.6, head_tilt=10.0, look_y=-0.85,
                handL_x=0.17, handL_y=-0.37, handL_z=0.13, handR_x=-0.17, handR_y=-0.39, handR_z=0.13)
    tr = Track()
    tr.pose(0.0, base)
    tr.key(T_THUNDER, "linear", squash=-0.02, head_nod=2.0, head_tilt=10.0, head_turn=0.0, eye_open=0.95,
           eye_happy=0.55, smile=0.6, look_y=-0.85, look_x=0.0, lean=8.0, bend=3.0)
    # the flinch (squash down, eyes squeezed) ...
    tr.key(T_THUNDER + 0.07, "out", squash=-0.12, eye_open=0.25, eye_squeeze=0.5, eye_happy=0.0, smile=0.0,
           head_nod=6.0)
    # ... and the snap up: head up and toward the thunder behind it, eyes wide
    tr.key(T_THUNDER + 0.22, "back", squash=0.07, eye_open=1.3, eye_squeeze=0.0, pupil=0.75, head_nod=-22.0,
           head_tilt=0.0, head_turn=24.0, look_y=0.9, look_x=1.1, lean=-4.0, bend=-4.0, eye_tilt=0.5)
    tr.key(T_THUNDER + 0.55, "inout", squash=0.03, head_turn=30.0, look_x=1.25, head_nod=-18.0)
    # arms come round the sprout: a shelter of mitts
    tr.key(T_THUNDER + 0.25, "linear", **{k: base[k] for k in ("handL_x", "handL_y", "handL_z", "handR_x",
                                                                "handR_y", "handR_z")})
    tr.key(T_FLASH - 0.15, "inout", handL_x=0.15, handL_y=-0.43, handL_z=0.13, handR_x=-0.15, handR_y=-0.43,
           handR_z=0.13, handL_bend=50.0, handR_bend=50.0, lean=10.0, bend=6.0, squash=-0.03)
    # the flash: a start, eyes wide on the storm
    tr.key(T_FLASH + 0.05, "out", eye_open=1.32, squash=-0.06, pupil=0.7)
    tr.key(T_FLASH + 0.25, "inout", eye_open=1.2, squash=-0.03)
    # down to the shivering sprout: worry
    tr.key(T_SHIVER + 0.3, "inout", head_turn=0.0, head_nod=8.0, look_x=0.0, look_y=-0.9, eye_tilt=0.95,
           eye_open=1.05, lower_lid=0.2, pupil=0.9, bend=10.0, lean=12.0, smile=-0.45, wobble=0.12)
    tr.key(dur, "soft", head_nod=10.0, bend=11.0, eye_tilt=1.0)
    tr.layer(acting.breathe(0.012, 0.45, arms=1.0))
    tr.layer(anim.saccades(seed=51, amp=0.05, every=(0.35, 0.8)))
    A.bake_claude(c, tr, f0, f1)
    # ---- camera: low ESE of Claude looking up WNW: the storm behind, the trunk on the right; push in to the sprout
    K = Vector((kx, ky, g(kx, ky)))
    S = Vector((sx, sy, sz))
    az0 = math.radians(-14.0)
    dir0 = Vector((math.cos(az0), math.sin(az0), 0.0))
    e0 = K + dir0 * 2.6
    e0.z = g(e0.x, e0.y) + 0.13
    vaz = math.radians(186.0)           # look past the trunk at the storm wall; Claude on the right third
    t0 = e0 + Vector((math.cos(vaz), math.sin(vaz), 0.0)) * 3.0
    t0.z = K.z + 0.78
    Hs = s.point("head", F(T_SHIVER + 0.3))
    Ew = (c.point("eyeL", F(T_SHIVER + 0.3)) + c.point("eyeR", F(T_SHIVER + 0.3))) * 0.5
    t1 = Hs.lerp(Ew, 0.45)
    e1 = t1 + dir0 * 1.25 + Vector((0, 0, 0.12))
    A.mow_line(e0, K, 0.6)
    A.cam_move("CamB05", f0, f1, [(0.0, "linear", e0, t0, 24.0, (K - e0).length),
                                  (1.3, "linear", e0 + (t0 - e0) * 0.03, t0, 24.0, (K - e0).length),
                                  (dur, "inout", e1, t1, 38.0, (Hs - e1).length)],
               shake=0.08, seed=505, fstop=4.0)
    c.face_light(e0, energy=2.5, col=(0.85, 0.85, 0.95), dist=1.4, size=0.8, frame=F(1.0))
    c.rim_light(e0, (-0.95, 0.33, 0.25), col=(0.72, 0.62, 1.0), energy=60.0, dist=1.8, frame=F(1.0))
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("threat", focus_xy=(0.45, 0.42), sat=A.SAT))
