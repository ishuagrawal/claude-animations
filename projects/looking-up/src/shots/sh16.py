"""SH16 (4 beats) - the apex. Twenty metres up, Claude stands on the very tip of the top sail, the vast moonlit cloud
sea far below and stars all round; the sail settles, the wind drops. One last look: Claude looks down at the pale
star in its arms, the star looks up at Claude; a tiny nuzzle. Then Claude lifts it overhead with both arms - and
lets go (T_RELEASE). The star lifts off, brightening as it rises out of frame; Claude stays reaching after it."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, stage as S, sky, props
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import (bake, frame_from, hold_point, aimed_light, cam_track, night_post, FPS, STAR_SCALE,
                        heading_frame, key_energy, sparkle_trail)
from shots.sh15 import south_world, mount_matrix, key_sails, sail_angle, ride_point, ARC_T1

T_RELEASE = 2.0         # Claude lets go; the star lifts off

T_SETTLE = 0.45
T_LOOK = 0.55           # Claude looks down at the star; it looks up
T_NUZZLE = 1.0
T_RAISE = 1.32
SH15_DUR = 4.0


def eye_dir():
    """Direction from the top of the windmill to the constellation's eye."""
    from lu import layout
    try:
        e = props.eye_world()
        return (e - Vector((0.0, 2.0, 22.0))).normalized()
    except Exception:
        return props.const_dir(*props.EYE_R)


def release_path(base, u):
    """The star leaving Claude's hands: a little float up, then away toward its place in the sky (u = s since the
    release). SH17 continues from release_path(base, SH16 duration - T_RELEASE)."""
    return base + Vector((0, 0, 1)) * (0.5 * u) + eye_dir() * (3.0 * u * u)


def apex_angle(t):
    """The sail finishing its swing (SH15's motion) and settling at the top with a small rock."""
    a = sail_angle(SH15_DUR + t)
    if t > ARC_T1 - SH15_DUR:
        u = t - (ARC_T1 - SH15_DUR)
        a += 1.6 * math.exp(-3.0 * u) * math.sin(u * 2 * math.pi * 0.9)
    return a


def make(f0, f1):
    W, K = south_world()
    dur = (f1 - f0) / FPS
    bpy.context.scene.render.motion_blur_shutter = 0.2
    Mm = mount_matrix(W)
    key_sails(W, f0, f1, apex_angle)
    F = ride_point(Mm, 360.0)
    for f in (f0, f1):
        sky.emotion(0.45 if f == f0 else 0.6, f)

    def feet(t):
        return ride_point(Mm, apex_angle(t))

    tr = Track()
    hug = dict(armL_fwd=86, armR_fwd=86, armL_curl=44, armR_curl=44, armL_up=6, armR_up=6)
    tr.pose(0.0, S.merge(hug, heading=180.0, look_y=0.8, eye_open=1.0, pupil=1.18, eye_happy=0.2, eye_tilt=-0.2,
                         head_nod=-10, lean=-4, squash=0.02))
    # the sail settles: a little sway, then still
    tr.key(T_SETTLE, "inout", lean=0, head_nod=-6)
    # one last look: down at the star - bittersweet
    tr.key(T_LOOK + 0.25, "inout", look_y=-0.75, look_x=0.0, head_nod=14, eye_tilt=0.55, eye_happy=0.35, eye_open=0.8,
           pupil=1.25, glint=1.4, slump=6)
    # the nuzzle: head dips onto it, eyes close
    tr.key(T_NUZZLE, "inout", head_nod=22, head_tilt=8, eye_open=0.1, eye_happy=0.55, squash=-0.03, slump=10)
    tr.key(T_RAISE - 0.06, "inout", head_nod=10, head_tilt=0, eye_open=0.85, eye_happy=0.3, eye_tilt=0.45, slump=4)
    # lifts it overhead: stretches up, arms high, eyes on it
    tr.key(T_RELEASE - 0.12, "inout", armL_up=52, armR_up=52, armL_fwd=12, armR_fwd=12, armL_curl=0, armR_curl=0,
           armL_bend=28, armR_bend=28, squash=0.14, lean=-11, head_nod=-20, look_y=1.0, eye_open=0.95, eye_tilt=0.15,
           slump=0, eye_happy=0.35)
    # lets go: a little push up, arms fling open and high
    tr.key(T_RELEASE + 0.08, "out", squash=0.17, armL_up=60, armR_up=60, armL_fwd=6, armR_fwd=6, armL_bend=34,
           armR_bend=34, hop=0.035)
    tr.key(T_RELEASE + 0.3, "inout", squash=0.07, hop=0.0, armL_up=50, armR_up=42, armL_fwd=30, armR_fwd=14,
           eye_happy=0.45, eye_tilt=0.45, pupil=1.2)
    tr.key(dur, "inout", squash=0.06, armL_up=46, armR_up=34, armL_fwd=42, armR_fwd=20, armL_bend=18, armR_bend=8,
           look_y=1.15, head_nod=-24, lean=-12, eye_happy=0.55)

    def life(t, p):
        if t < T_SETTLE + 0.3:
            p["roll"] = p.get("roll", 0) + 4.0 * math.exp(-4 * t) * math.sin(t * 2 * math.pi * 1.4)
    tr.layer(life)
    tr.layer(anim.breathe(0.012, 0.3))
    anim.anchor(tr, C_DEF)

    def c_orient(t, p):
        return feet(t) + Vector((0, 0, p.get("hop", 0.0))), heading_frame(p.get("heading", 180.0))
    c = W.claude()
    held = {}

    def after_c(f, t, p):
        bpy.context.view_layer.update()
        held[f] = (hold_point(c), hold_point(c, Vector((0.0, -0.17, 0.83))), c.rig.matrix_world.to_3x3().normalized())
    bake(c, tr, f0, f1, orient=c_orient, after=after_c)

    # ------------------------------------------------------------------ the star
    s = W.star()
    s.light_scale = 7.0
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, scale=STAR_SCALE, glow=0.42, warmth=0.42, eye_open=0.75, look_y=0.6, droop=30,
                         curl=10, head=-6))
    st.key(T_LOOK + 0.3, "inout", look_y=0.95, eye_open=0.85, eye_tilt=0.6, pupil=1.25, glint=1.5, droop=24, head=-14)
    st.key(T_NUZZLE, "inout", eye_open=0.1, eye_happy=0.6, curl=20, head=-4)                    # nuzzles back
    st.key(T_RAISE, "inout", eye_open=0.85, eye_happy=0.2, eye_tilt=0.45, curl=4, look_y=-0.6)  # looks down at Claude
    st.key(T_RELEASE - 0.1, "inout", glow=0.55, warmth=0.6, droop=10, arms=10, look_y=-0.8)
    st.key(T_RELEASE + 0.35, "out", glow=1.4, warmth=1.0, droop=0, arms=34, legs=10, eye_happy=0.6, eye_tilt=0.3,
           look_y=-0.9, squash=0.06)
    st.key(dur, "inout", glow=2.2, arms=40, eye_happy=0.7)
    anim.anchor(st, S_DEF)
    cam_eye = Vector((F.x + 1.5, F.y + 5.2, F.z + 0.12))
    spath = {}

    def s_orient(t, p):
        f = f0 + int(round(t * FPS))
        chest, above, Rc = held[f]
        cface = Rc @ Vector((0, -1, 0))
        cup = Rc @ Vector((0, 0, 1))
        if t < T_RAISE:
            q = chest
            if T_NUZZLE - 0.2 < t < T_RAISE:
                q = q + cup * 0.04 * math.sin(math.pi * (t - T_NUZZLE + 0.2) / (T_RAISE - T_NUZZLE + 0.2))
            face = (cface * 0.4 + (cam_eye - q).normalized() * 0.6).normalized()
            if T_LOOK < t:       # turns its face up toward Claude's
                u = anim.ease("inout", (t - T_LOOK) / 0.35)
                face = face.lerp((-cface + cup * 1.4).normalized(), 0.45 * u).normalized()
            spath[f] = q
            return q, frame_from(face, cup)
        if t < T_RELEASE:
            u = anim.ease("inout", (t - T_RAISE) / (T_RELEASE - 0.1 - T_RAISE))
            q = chest.lerp(above, u)
            face = (cam_eye - q).normalized().lerp(Vector((0, 0, -1)), 0.35 * u).normalized()
            spath[f] = q
            return q, frame_from(face, cup)
        f_rel = f0 + int(round(T_RELEASE * FPS))
        base = held[f_rel][1]
        u = t - T_RELEASE
        q = release_path(base, u) + Vector((0.05 * math.sin(u * 7), 0, 0))
        face = (cam_eye - q).normalized().lerp(Vector((0, 0, -1)), 0.5).normalized()
        spath[f] = q
        return q, frame_from(face, Vector((0, 0.3, 1.0)))
    bake(s, st, f0, f1, orient=s_orient)

    def sp(t):
        f = f0 + int(round(min(max(t, 0.0), dur - 1 / FPS) * FPS))
        return spath[f]
    sparkle_trail("RiseTrail", sp, f0, f1, n=16, lag=0.03, size=0.022,
                  alive=lambda t: 0.0 if t < T_RELEASE else min(1.0, (t - T_RELEASE) / 0.15))

    # ------------------------------------------------------------------ camera: medium, from the north-east (front
    # three-quarter), a touch below - the sky all round, the cloud sea low in frame; tilts up after the star
    head = F + Vector((0, 0, 0.5))
    e0 = cam_eye
    e1 = cam_eye + Vector((-0.2, -0.35, -0.05))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, head + Vector((0, 0, 0.05)), 40, 0.0, None),
        (T_RELEASE, "soft", e1, head + Vector((0, 0, 0.18)), 42, 0.0, None),
        (dur, "inout", e1 + Vector((0, 0, 0.05)), head + Vector((0, 0.1, 0.62)), 40, 0.0, None)],
        f0, f1, seed=161, shake=0.06)
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ lights: moon key from behind the camera, a
    # warm kicker from the star (rises as it brightens), a cool rim from the south-west
    aimed_light("RimC", c.col, F + Vector((-2.5, -2.6, 1.8)), head, 40.0, col=(0.6, 0.74, 1.0), size=1.5)
    fk = aimed_light("FaceC", c.col, e0 + Vector((0.0, 0.0, 1.0)), head, 9.0, col=(0.72, 0.82, 1.0), size=2.0)
    gk = aimed_light("GoldC", c.col, F + Vector((0.3, 0.6, 2.4)), head, 0.0, col=(1.0, 0.72, 0.38), size=1.0)
    key_energy(gk, f0, f1, lambda t: 0.0 if t < T_RELEASE else 26.0 * anim.ease("out", (t - T_RELEASE) / 0.5))
    aimed_light("StarFill", s.col, e0, head, 3.0, col=(0.85, 0.9, 1.0), size=1.5)
    return dict(post=night_post(W, bloom=0.85, mist_start=80.0, mist_depth=3000.0, vignette=0.34))
