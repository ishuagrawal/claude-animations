"""SH15 (6 beats) - "Until finally". Low in the south meadow looking up at the windmill's front: Claude, perched on
the gallery's top rail with the pale star clutched to its chest, crouches and LEAPS across to the lowest sail, lands
on its bottom bar and wobbles. It looks up. A GUST (T_GUST): the grass runs in rolling bands, petals tear loose and
stream past us toward the mill, Claude braces and squints into the wind. The sails creak - rock back - and LIFT
(T_LIFT): the sail swings Claude up and around in a great arc against the stars, the camera craning up after it;
near the top Claude turns to face the constellation.

Also the sail-ride toolkit shared by SH16-SH19 (the sail tip frame, where Claude's feet are on the sail)."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, stage as S, windmill, foliage, props
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import (bake, frame_from, hold_point, aimed_light, cam_track, night_post, FPS, STAR_SCALE, petals,
                        heading_frame, key_energy, act1, FLOWER_COLS)
from lu import world

T_GUST = 1.33           # the gust hits (grass waves, petals fly)
T_LIFT = 2.0            # the sail lifts Claude up and around

T_CROUCH, T_JUMP, T_LAND = 0.28, 0.48, 0.86
T_CREAK = 1.55          # the sail creaks and rocks back before it goes
T_TURN = 3.05           # near the top Claude turns to face the constellation

SAIL_K = 0              # the sail Claude rides (it points straight down at sails_angle 180)
SAIL0 = 180.0           # sails_angle when Claude boards
ARC_T0, ARC_T1 = 2.0, 4.45      # the lift (ARC_T0 = T_LIFT): SAIL0 -> SAIL0 + 180 over these shot-local seconds (eased in/out); SH16
                                # finishes the last degrees


def sail_angle(t):
    """sails_angle at SH15-local time t (continues past the shot end into SH16): still; the creak rocks it back a
    few degrees (anticipation); at T_LIFT it lurches forward and swings up, still moving at the cut into SH16."""
    if t < T_CREAK:
        return SAIL0
    if t < ARC_T0:
        u = (t - T_CREAK) / (ARC_T0 - T_CREAK)
        return SAIL0 - 4.0 * math.sin(0.5 * math.pi * u)
    u = min(1.0, (t - ARC_T0) / (ARC_T1 - ARC_T0))
    return SAIL0 - 4.0 + 184.0 * anim.ease("soft", u)


def mount_matrix(W):
    bpy.context.view_layer.update()
    return W.wm["hub"].parent.matrix_world.copy()


def tip_frame(Mm, deg, k=SAIL_K, along=windmill.SAIL_TIP if hasattr(windmill, "SAIL_TIP") else 8.0):
    """World matrix at sail k's tip for sails_angle deg (axes as windmill.sail_tip: +Y out along the sail, +Z out of
    the sail face toward the south, +X the canvas side)."""
    return Mm @ Matrix.Rotation(math.radians(deg + 90.0 * k), 4, "Z") @ Matrix.Translation((0.0, along, 0.0))


def feet_on_sail(theta):
    """Where Claude's feet are, in the tip frame, when the sail has turned theta deg past straight down: perched on the
    stock's end on its open (leadboard) side at 0, on top of the horizontal stock at 90, on the stock's end at 180."""
    th = max(0.0, min(180.0, theta))
    keys = [(0.0, (-0.31, -0.2, 0.04)), (95.0, (-0.15, -0.26, 0.0)), (150.0, (-0.06, -0.06, 0.0)),
            (180.0, (0.0, 0.0, 0.0))]
    for (a0, p0), (a1, p1) in zip(keys, keys[1:]):
        if th <= a1:
            u = anim.ease("smooth", (th - a0) / (a1 - a0))
            return Vector(p0).lerp(Vector(p1), u)
    return Vector(keys[-1][1])


def ride_point(Mm, deg, k=SAIL_K):
    th = (deg - SAIL0)
    return tip_frame(Mm, deg, k) @ feet_on_sail(th)


def key_sails(W, f0, f1, fn):
    hub = W.wm["hub"]
    for f in range(f0 - 1, f1 + 1):
        windmill.sails_set_angle(hub, fn((f - f0) / FPS))
        hub.keyframe_insert("rotation_euler", frame=f)


def rail_top(W, x=0.32):
    O = W.origin
    r = windmill.rail_r() if hasattr(windmill, "rail_r") else windmill.BASE_R / math.cos(windmill.K) + 0.83
    y = O.y - math.sqrt(max(r * r - x * x, 0.0))
    return Vector((x, y, O.z + windmill.GALLERY_Z + 1.12 + 0.035))


def south_world(sails=SAIL0, glow=0.85):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=sails, window_glow=glow), overrides=dict(stars=1.2))
    O = W.origin
    try:
        K = props.constellation(origin=(O.x, O.y, 0), lines=0.3, eye=0.0)
    except Exception as e:
        print("SH15 WARNING: constellation failed:", e)
        K = None
    if act1 and hasattr(act1, "hide_tail"):
        act1.hide_tail()
    try:
        W.wm.setdefault("origin", O)
        windmill.lanterns(W.wm, door=True)
    except Exception as e:
        print("SH15: lanterns failed", e)
    return W, K


def make(f0, f1):
    W, K = south_world()
    dur = (f1 - f0) / FPS
    O = W.origin
    Mm = mount_matrix(W)
    key_sails(W, f0, f1, sail_angle)
    hub_p = Mm.translation.copy()
    R0 = rail_top(W)
    L0 = ride_point(Mm, SAIL0)
    if K is not None and hasattr(props, "key_lines"):
        props.key_lines(0.3, f0)

    # ------------------------------------------------------------------ wind: calm, then the gust
    try:
        foliage.breeze(0.25, f0)
        foliage.breeze(0.25, f0 + int(T_GUST * FPS) - 1)
        foliage.breeze(1.6, f0 + int((T_GUST + 0.5) * FPS))
        foliage.gust(f0 + int(T_GUST * FPS), f1 + 30, strength=1.0, speed=13.0, start=(3.0, -9.0), wavelength=4.5)
    except Exception as e:
        print("SH15: wind failed", e)

    # ------------------------------------------------------------------ Claude's feet: rail -> leap -> sail ride
    def feet(t):
        if t < T_JUMP:
            return R0.copy()
        if t < T_LAND:
            u = (t - T_JUMP) / (T_LAND - T_JUMP)
            p = R0.lerp(L0, anim.ease("inout", u) * 0.3 + u * 0.7)
            p.z += 0.5 * 4 * u * (1 - u)
            return p
        return ride_point(Mm, sail_angle(t))

    def heading(t):
        if t < T_TURN:
            return 0.0
        return 180.0 * anim.ease("inout", (t - T_TURN) / 0.6)

    def c_orient(t, p):
        loc = feet(t) + Vector((0, 0, p.get("hop", 0.0)))
        R = heading_frame(heading(t))
        lean = Matrix.Rotation(math.radians(p.get("lean_w", 0.0)), 3, R @ Vector((1, 0, 0)))
        return loc, lean @ R

    tr = Track()
    hug = dict(armL_fwd=86, armR_fwd=86, armL_curl=44, armR_curl=44, armL_up=6, armR_up=6)
    tr.pose(0.0, S.merge(hug, eye_tilt=-0.55, eye_open=0.75, look_y=-0.35, look_x=0.1, squash=0.0, lean=4, pupil=1.0))
    tr.key(T_CROUCH, "inout", squash=-0.17, lean=14, leg0_knee=22, leg1_knee=22, leg2_knee=22, leg3_knee=22,
           look_y=-0.45, eye_open=0.7)
    tr.key(T_JUMP, "linear", squash=-0.17)
    tr.key(T_JUMP + 0.12, "out", squash=0.16, lean=-4, eye_open=0.05, eye_tilt=0.2, leg0_knee=0, leg1_knee=0,
           leg2_knee=0, leg3_knee=0, leg0_swing=-30, leg1_swing=-30, leg2_swing=-30, leg3_swing=-30)
    tr.key(T_LAND - 0.03, "inout", squash=0.06, leg0_swing=20, leg1_swing=20, leg2_swing=20, leg3_swing=20)
    tr.key(T_LAND + 0.06, "out", squash=-0.2, lean=16, eye_open=1.0, pupil=0.8, eye_tilt=0.3, leg0_swing=0,
           leg1_swing=0, leg2_swing=0, leg3_swing=0, legs_splay=8)
    tr.key(T_LAND + 0.3, "inout", squash=0.02, lean=4)
    # looks up at the sky: the eye is up there
    tr.key(1.18, "inout", look_y=0.85, look_x=0.0, head_nod=-12, eye_tilt=-0.4, pupil=1.0, eye_open=0.85, legs_splay=3)
    # the GUST: leans into it, squints
    tr.key(T_GUST + 0.12, "out", lean=12, eye_open=0.42, eye_tilt=-0.65, squash=-0.06, head_nod=4, look_y=0.2)
    # creak: looks up at the turning hub, eyes wide
    tr.key(T_CREAK + 0.1, "inout", look_y=1.0, head_nod=-16, eye_open=1.0, pupil=0.85, eye_tilt=0.2, lean=6)
    # LIFT: pressed down by the jerk, eyes squeezed...
    tr.key(T_LIFT + 0.12, "out", squash=-0.2, eye_open=0.15, eye_tilt=0.1, lean=10, head_nod=6, legs_splay=10)
    # ...then rising: eyes fly open - wonder
    tr.key(T_LIFT + 0.55, "inout", squash=0.08, eye_open=1.0, pupil=1.22, eye_happy=0.25, look_y=0.6, eye_tilt=-0.1,
           head_nod=-10, lean=-6, legs_splay=4)
    tr.key(T_TURN, "inout", squash=0.02, look_y=0.9, eye_happy=0.35, look_x=0.4)
    tr.key(dur, "inout", look_y=0.8, look_x=0.0, eye_happy=0.2, eye_tilt=-0.3, lean=-4, head_nod=-12)

    def life(t, p):
        if T_LAND < t < T_LAND + 0.9:             # wobble on landing
            u = t - T_LAND
            p["roll"] = p.get("roll", 0) + 11 * math.exp(-4.5 * u) * math.sin(u * 2 * math.pi * 2.6)
            p["lean_w"] = 5 * math.exp(-4.0 * u) * math.sin(u * 2 * math.pi * 2.1)
        if t < T_CROUCH:                          # balancing on the rail
            p["roll"] = p.get("roll", 0) + 3.0 * math.sin(t * 2 * math.pi * 1.7)
        if t > T_GUST:                            # buffeted by the wind
            w = min(1.0, (t - T_GUST) / 0.3)
            p["roll"] = p.get("roll", 0) + w * 2.5 * anim.snoise(t, 7, 2.2)
            p["head_tilt"] = p.get("head_tilt", 0) + w * 3.0 * anim.snoise(t, 8, 1.7)
    tr.layer(life)
    tr.layer(anim.breathe(0.012, 0.35))
    anim.anchor(tr, C_DEF)
    c = W.claude()
    held = {}

    def after_c(f, t, p):
        bpy.context.view_layer.update()
        held[f] = (hold_point(c), c.rig.matrix_world.to_3x3().normalized())
    bake(c, tr, f0, f1, orient=c_orient, after=after_c)

    # ------------------------------------------------------------------ the star, held to its chest: dim, weak
    s = W.star()
    s.light_scale = 5.0
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, scale=STAR_SCALE, glow=0.36, warmth=0.34, eye_open=0.5, look_y=0.2, droop=40,
                         curl=18))
    st.key(T_LAND + 0.05, "out", squash=-0.2, eye_open=0.9, pupil=0.85)
    st.key(T_LAND + 0.3, "inout", squash=0.0, eye_open=0.55)
    st.key(T_GUST + 0.2, "inout", eye_open=0.3, curl=30)
    st.key(T_LIFT + 0.6, "inout", eye_open=0.75, look_y=0.8, glow=0.42, warmth=0.42, curl=12, droop=30)
    st.key(dur, "inout", eye_open=0.85, look_y=0.9, glow=0.5, warmth=0.5, head=-10)
    st.layer(anim.tremble(0.0, dur, amp=1.2, freq=13.0, seed=9))
    anim.anchor(st, S_DEF)

    def s_orient(t, p):
        f = f0 + int(round(t * FPS))
        hp, Rc = held[f]
        return hp, frame_from(Rc @ Vector((0, -1, 0)), Rc @ Vector((0, 0, 1)))
    bake(s, st, f0, f1, orient=s_orient)

    # ------------------------------------------------------------------ petals torn loose by the gust, streaming past
    from lu import fx
    fG = f0 + int(round(T_GUST * FPS))
    if hasattr(fx, "petal_gust"):
        fx.petal_gust((2.0, -2.8), 2.2, fG, fG + 30, n=170, wind=(-0.5, 5.5, 2.2), seed=50, size=(0.022, 0.036))
        fx.petal_gust((1.0, 0.2), 2.0, fG + 6, fG + 40, n=90, wind=(-0.4, 5.0, 3.0), seed=51)
    else:
        for i, (dx, dy, n) in enumerate(((2.9, -3.9, 60), (1.6, -2.6, 60), (0.2, -1.4, 50), (2.2, -1.0, 40))):
            g = W.ground(dx, dy)
            petals(f"PetalG{i}", (dx, dy, g + 0.35), T_GUST + 0.05 * i, f0, f1, n=n, speed=(0.8, 2.2), up=1.4,
                   drag=0.8, fall=0.05, seed=50 + i, spread=0.7, size=(0.02, 0.034), wind=(-0.6, 5.0, 2.6))

    # ------------------------------------------------------------------ camera: low in the south meadow; cranes up
    # and pulls wide as the sail swings Claude up
    E0 = Vector((3.3, -4.9, W.ground(3.3, -4.9) + 0.38))
    T0 = Vector((0.1, 1.5, 6.5))
    E1 = Vector((3.15, -4.6, E0.z + 0.05))
    E2 = Vector((7.6, -11.2, 9.8))
    # tall grass and flowers right in front of the lens: the gust runs through them
    fwd = (T0 - E0)
    fwd.z = 0
    fwd.normalize()
    from shots.sh10 import dress
    if dress is not None and hasattr(dress, "patch"):
        for i, (d, r, n) in enumerate(((0.9, 0.55, 140), (1.9, 1.0, 320))):
            q = E0 + fwd * d
            try:
                dress.patch((q.x, q.y), r, count=n, flowers=0.35, seed=150 + i, name=f"MeadowFore15_{i}")
            except Exception as e:
                print("SH15: dress.patch failed", e)
    bpy.context.scene.render.motion_blur_shutter = 0.1

    def follow(t):
        p = feet(t) + Vector((0, 0, 0.4))
        ahead = feet(min(t + 0.25, dur)) + Vector((0, 0, 0.4))
        w = 0.12 + 0.33 * anim.ease("inout", (t - T_LIFT) / (dur - T_LIFT))
        return p.lerp(ahead, 0.35).lerp(hub_p, w)

    def cam_layer(t, p):
        if t > ARC_T0 - 0.2:
            u = anim.ease("inout", (t - ARC_T0 + 0.2) / 0.7)
            q = T0.lerp(follow(t), u)
            p.update(tx=q.x, ty=q.y, tz=q.z)
    cam = cam_track("Cam", [
        (0.0, "linear", E0, T0, 36, 0.0, None),
        (T_GUST, "soft", E1, T0, 38, 0.0, None),
        (ARC_T0, "linear", E1 + Vector((0, 0, 0.05)), T0, 37, 0.0, None),
        (dur, "inout", E2, T0, 22, 0.0, None)], f0, f1, seed=151,
        shake=lambda t: 0.12 if t < T_GUST else (0.3 if t < T_LIFT + 0.6 else 0.15), layer=cam_layer)
    bpy.context.scene.camera = cam

    # petals already airborne, streaming through the frame toward the mill (the camera looks up, over the meadow)
    flat_v = (T0 - E0)
    flat_v.z = 0
    flat_v.normalize()
    for i, (d, n) in enumerate(((1.2, 36), (2.2, 40), (3.4, 40))):
        q = E0 + flat_v * d + Vector((0.5 * (i - 1), 0.0, -0.1))
        petals(f"PetalAir{i}", q, T_GUST - 0.15 + 0.05 * i, f0, f1, n=n, speed=(0.4, 1.2), up=1.0, drag=1.0,
               fall=0.0, seed=70 + i, spread=0.8, size=(0.02, 0.036), wind=(-0.4, 3.6, 2.8))
    # ------------------------------------------------------------------ lights: the mill's front is in moon-shadow;
    # a soft cool sky fill and a moon rim keep Claude readable, the porch lantern is the warm practical below
    def fill_pos(t):
        return feet(t)
    fk = aimed_light("FillC", c.col, E0 + Vector((0, 0, 2.0)), T0, 22.0, col=(0.62, 0.74, 1.0), size=3.0)
    aimed_light("RimC", c.col, O + Vector((3.0, 1.0, 14.0)), L0, 60.0, col=(0.6, 0.75, 1.0), size=2.0)
    aimed_light("StarFill", s.col, E0 + Vector((0, 0, 1.5)), L0, 4.0, col=(0.85, 0.9, 1.0), size=1.5)
    for ob in (fk,):
        con = ob.constraints.new("TRACK_TO")
        tgt_e = bpy.data.objects.new("FillTarget", None)
        bpy.context.scene.collection.objects.link(tgt_e)
        for f in range(f0, f1, 2):
            tgt_e.location = feet((f - f0) / FPS) + Vector((0, 0, 0.4))
            tgt_e.keyframe_insert("location", frame=f)
            ob.location = cam.matrix_world.translation if False else ob.location
        con.target = tgt_e
        con.track_axis = "TRACK_NEGATIVE_Z"
        con.up_axis = "UP_Y"
    return dict(post=night_post(W, bloom=0.8, mist_start=60.0, mist_depth=2500.0, vignette=0.36))
