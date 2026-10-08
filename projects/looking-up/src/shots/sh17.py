"""SH17 (4 beats) - home. Low behind Claude on the sail tip, looking up past its raised arms (soft, in the lower right
of frame) at the constellation: the star streaks away from Claude's hands in a growing gold trail, diagonally across
the figure, and reaches the empty eye - IGNITION (T_IGNITE): a burst of gold rays, the chart lines flare, the eye is
whole and blazing, the sky round the constellation glows violet and pink, gold light washes over Claude. Claude
jolts with joy and slowly lowers its arms."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, stage as S, sky, props
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import (bake, frame_from, aimed_light, cam_track, night_post, FPS, STAR_SCALE, heading_frame,
                        key_energy, sparkle_trail)
from shots.sh15 import south_world, mount_matrix, key_sails, ride_point
from shots.sh16 import apex_angle, release_path, T_RELEASE as T_REL16

T_IGNITE = 1.33         # the star reaches the eye: ignition
SH16_DUR = 2.6667


def make(f0, f1):
    W, K = south_world()
    dur = (f1 - f0) / FPS
    Mm = mount_matrix(W)
    key_sails(W, f0, f1, lambda t: apex_angle(SH16_DUR + t))
    F = ride_point(Mm, 360.0)
    fI = f0 + int(round(T_IGNITE * FPS))
    sky.emotion(0.6, f0)
    sky.emotion(0.6, fI - 1)
    sky.emotion(0.85, fI + 20)
    sky.emotion(0.7, f1)
    if K is not None:
        props.key_lines(0.3, f0)
        props.key_lines(0.32, fI - 2)
        K["eye"]["eye"] = 0.0

    # ------------------------------------------------------------------ Claude: reaching after it; the jolt of joy
    tr = Track()
    tr.pose(0.0, dict(heading=180.0, armL_up=46, armR_up=34, armL_fwd=42, armR_fwd=20, armL_bend=18, armR_bend=8,
                      squash=0.06, lean=-12, head_nod=-24, look_y=1.15, eye_happy=0.55, eye_open=0.95, eye_tilt=0.45))
    tr.key(0.6, "inout", armL_up=50, armL_fwd=36, armL_bend=24)               # reaching after it
    tr.key(T_IGNITE, "linear", squash=0.06, hop=0.0, armL_up=50, armR_up=34)
    tr.key(T_IGNITE + 0.12, "out", squash=0.18, hop=0.07, armL_up=60, armR_up=58, armR_fwd=6, armL_fwd=10, lean=-16,
           armL_bend=34, armR_bend=34)
    tr.key(T_IGNITE + 0.38, "inout", squash=-0.05, hop=0.0, armL_up=54, armR_up=52)
    tr.key(T_IGNITE + 0.6, "inout", squash=0.03)
    tr.key(dur, "inout", armL_up=34, armR_up=30, armL_fwd=30, armR_fwd=30, armL_bend=4, armR_bend=4, lean=-10,
           head_nod=-20, squash=0.02, head_tilt=6)
    tr.layer(anim.breathe(0.012, 0.3))
    anim.anchor(tr, C_DEF)
    c = W.claude()
    bake(c, tr, f0, f1, orient=lambda t, p: (F + Vector((0, 0, p.get("hop", 0.0))), heading_frame(180.0)))

    # ------------------------------------------------------------------ camera: low behind Claude, off its left side
    cdir = props.const_dir(0.0, -1.5)
    flat = Vector((cdir.x, cdir.y, 0)).normalized()
    E0 = F + Vector((-1.45, -3.25, -0.35))
    T0 = E0 + (flat * math.cos(math.radians(23.0)) + Vector((0, 0, math.sin(math.radians(23.0))))) * 50.0
    T1 = E0 + (flat * math.cos(math.radians(24.0)) + Vector((0, 0, math.sin(math.radians(24.0))))) * 50.0

    # ------------------------------------------------------------------ the streak: from just above Claude's hands up
    # into the eye (props.falling_star in reverse), the living star itself visible at first
    start = F + Vector((0.0, 0.25, 1.35))       # (a cheat: closer than it left SH16's frame, so it rises from the hands)
    eye_p = props.eye_world(K) if K is not None else props.const_world(*props.EYE_R, origin=(W.origin.x, W.origin.y, 0))
    st_fx = None
    if hasattr(props, "falling_star"):
        try:
            st_fx = props.falling_star(start_world=start, end_world=eye_p, f0=f0, f1=fI, view_from=E0, bow=0.06,
                                       ease=1.75, trail=0.42, head_deg=1.0, head_min=0.035, trail_deg=0.28,
                                       sparkle=1.0, drain=6, flash=0.0, take_eye=False, name="RiseStreak")
        except Exception as e:
            print("SH17: falling_star failed", e)
    if st_fx is not None:
        pos = st_fx["pos"]
        lo = st_fx.get("light")
        if lo is not None and lo.data.animation_data and lo.data.animation_data.action:
            # its warm practical is tuned for a landing in the meadow; this close above Claude it would blow out
            for fc in props._fcurves(lo.data.animation_data.action):
                if fc.data_path == "energy":
                    for kp in fc.keyframe_points:
                        kp.co.y = min(kp.co.y * 0.02, 14.0)
                        kp.handle_left.y = kp.handle_right.y = kp.co.y
    else:
        def pos(t):
            u = min(1.0, max(0.0, t / T_IGNITE)) ** 1.75
            return start.lerp(eye_p, u)
    s = W.star()
    s.light_scale = 1.0
    bpy.context.scene.render.motion_blur_shutter = 0.12
    st = Track()
    st.pose(0.0, S.merge(S.S_JOY, scale=STAR_SCALE, glow=2.2, warmth=1.0, eye_happy=0.7, arms=40, legs=10))
    st.key(0.5, "inout", glow=3.0)
    anim.anchor(st, S_DEF)
    t_hide = 0.55

    def s_orient(t, p):
        q = pos(min(t, T_IGNITE))
        d = max((q - E0).length, 0.5)
        ang = math.radians(4.2 * (1 - min(1.0, t / t_hide)) + 0.6)
        sc = min(STAR_SCALE * 1.0, d * math.tan(ang) / 0.17) if t > 0.02 else STAR_SCALE
        p["scale"] = max(sc, 1e-3) if t < t_hide else 1e-4
        return q, frame_from((E0 - q).normalized(), Vector((0, 0.2, 1.0)))

    def s_light(f, t, p):
        if s.light:
            s.light.data.energy *= max(0.0, 1 - t / 0.5)
    bake(s, st, f0, f1, orient=s_orient, after=s_light)

    # ------------------------------------------------------------------ IGNITION
    ig = None
    if K is not None and hasattr(props, "ignite"):
        try:
            ig = props.ignite(fI, K, burst=1.0, rays=True, line_peak=3.0, line_after=1.2, eye_peak=5.0, eye_after=1.7)
        except Exception as e:
            print("SH17: ignite failed", e)

    cam = cam_track("Cam", [
        (0.0, "linear", E0, T0, 19, 2.8, 60.0),
        (T_IGNITE, "soft", E0 + Vector((0.04, 0.09, -0.02)), T1, 19.5, 2.8, 60.0),
        (dur, "soft", E0 + Vector((0.08, 0.18, -0.03)), T1 + Vector((0, 0, 0.3)), 20.5, 2.8, 60.0)],
        f0, f1, seed=171, shake=lambda t: 0.05 + 0.5 * math.exp(-6 * max(0.0, t - T_IGNITE)) * (t > T_IGNITE))
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ light: the ignition's gold washes Claude
    head = F + Vector((0, 0, 0.55))
    gk = aimed_light("GoldWash", c.col, head + cdir * 3.0, head, 0.0, col=(1.0, 0.7, 0.36), size=2.5)
    key_energy(gk, f0, f1, lambda t: 0.0 if t < T_IGNITE - 0.04 else
               60.0 * math.exp(-1.6 * (t - T_IGNITE)) + 22.0 * anim.ease("out", (t - T_IGNITE) / 0.3))
    aimed_light("RimMoon", c.col, F + Vector((2.0, 1.0, 2.0)), head, 18.0, col=(0.6, 0.74, 1.0), size=1.2)
    return dict(post=night_post(W, bloom=1.0, bloom_thr=0.42, bloom_size=9, mist_start=80.0, mist_depth=3000.0,
                                vignette=0.36))
