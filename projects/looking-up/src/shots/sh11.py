"""SH11 (4 beats) - content. Straight down on the two of them lying side by side in a carpet of flowers (Claude's head
at the top of frame, the star nestled at its right side under its curled arm), fireflies drifting between us and
them; a slow push down. Both gaze up, content; Claude's slow contented blink, a lazy kick of one foot. At the very
end, T_FLICKER: a tiny sputter in the star's glow - the first sign.

Also the shared lying tableau for SH11/SH12/SH14 (Claude's lying transform, the star's nestled spot)."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, stage as S
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import (meadow_world, frame_from, lie_frame, bake, LIE, STAR_SCALE, aimed_light, cam_track,
                        night_post, fireflies, act1, petals, FPS, mow_all)

T_FLICKER = 2.3         # the tiny flicker in the star's glow (the first sign it is fading)

BETA_LIE = 17.0                              # head raised a little (uphill, a tussock): face tipped toward the feet
STAR_LOCAL = Vector((-0.6, -0.03, 0.36))      # the star's nestle, in Claude's rig space (its right side, below the arm)
STAR_RECLINE = 38.0                          # the star half sits up against Claude, face toward the north sky
C_LIE = dict(armR_up=-8, armR_fwd=42, armR_curl=-48, armR_bend=0, armL_up=-30, armL_fwd=10, leg0_swing=28,
             leg1_swing=22, leg2_swing=24, leg3_swing=30, head_nod=8)


def _hull_min_z(R):
    pts = [(x, y, z) for x in (-0.34, 0.34) for y in (-0.2, 0.2) for z in (0.2, 0.68)]
    return min((R @ Vector(p)).z for p in pts)


def lying_transform(W, beta=BETA_LIE, center=None, sink=0.035):
    """Claude lying on its back at LIE, head south. Returns (rig location, rotation Matrix3)."""
    R = lie_frame(beta)
    cx, cy = (center or (LIE.x, LIE.y))
    gz = W.ground(cx, cy)
    bc = R @ Vector((0, 0, 0.44))
    loc = Vector((cx - bc.x, cy - bc.y, 0.0))
    loc.z = gz - sink - _hull_min_z(R)
    return loc, R


def star_nestle(loc, R, recline=STAR_RECLINE, local=STAR_LOCAL):
    """The star's world position and orientation snuggled at Claude's right: reclined, face to the north sky, its
    head tipped toward Claude's shoulder."""
    p = loc + R @ local
    face = Vector((0.0, math.sin(math.radians(recline + 10)), math.cos(math.radians(recline + 10))))
    face = (face + Vector((-0.12, 0, 0))).normalized()
    up = (Vector((0, -1, 0.3)) + Vector((-0.35, 0, 0))).normalized()
    return p, frame_from(face, up)


def make(f0, f1):
    W, K = meadow_world(frames=(f0, f1))
    dur = (f1 - f0) / FPS
    c = W.claude()
    s = W.star()
    s.light_scale = 5.5
    if s.light:
        s.light.data.shadow_soft_size = 0.25
        s.light.location = (0, -0.12, 0)
    loc, R = lying_transform(W)
    sp, SR = star_nestle(loc, R)
    mow_all((sp.x, sp.y), 0.3)

    # ------------------------------------------------------------------ Claude: content
    tr = Track()
    tr.pose(0.0, S.merge(C_LIE, eye_happy=0.6, eye_open=0.78, eye_tilt=0.0, look_y=-0.25, look_x=-0.1, pupil=1.08,
                         head_tilt=-6))
    tr.key(0.9, "inout", look_x=0.05, look_y=-0.3)
    tr.key(1.9, "inout", eye_happy=0.68, head_tilt=-9)
    tr.key(T_FLICKER + 0.2, "inout", look_x=-0.35, look_y=-0.15, eye_happy=0.5)      # half-notices the flicker
    tr.key(dur, "inout", look_x=-0.4, eye_happy=0.45, eye_open=0.85)
    tr.layer(anim.blink_at(1.05, 0.5, 0.95))            # a slow, contented blink

    def kick(t, p):
        p["leg3_swing"] = p.get("leg3_swing", 0) + 14 * math.sin(t * 2 * math.pi * 0.75) ** 2
        p["leg2_swing"] = p.get("leg2_swing", 0) + 5 * math.sin(t * 2 * math.pi * 0.75 + 1.2)
    tr.layer(kick)
    tr.layer(anim.breathe(0.016, 0.3))
    anim.anchor(tr, C_DEF)
    bake(c, tr, f0, f1, orient=lambda t, p: (loc, R))

    # ------------------------------------------------------------------ the star: cosy, glowing; then the flicker
    st = Track()
    st.pose(0.0, S.merge(S.S_HAPPY, scale=act1.STAR_SCALE if act1 else STAR_SCALE, glow=1.05, eye_happy=0.62,
                         eye_open=0.8, arms=14, head=-6, look_y=0.15, look_x=0.1, droop=4))
    st.key(1.3, "inout", eye_happy=0.7, arms=18)
    st.key(T_FLICKER - 0.05, "linear", eye_happy=0.68, eye_open=0.8, glow=1.05, pupil=1.0)
    st.key(T_FLICKER + 0.22, "out", eye_happy=0.2, eye_open=0.95, pupil=1.1, droop=10)
    st.key(dur, "inout", eye_happy=0.25, eye_open=0.92, look_y=0.35, glow=0.95)

    def flick(t, p):
        p["glow"] = p.get("glow", 1) * (1 + 0.04 * math.sin(t * 2 * math.pi * 0.3))
        u = t - T_FLICKER
        if 0 <= u < 0.32:     # sputter: dip - catch - dip - recover
            k = [1.0, 0.42, 0.85, 0.5, 0.95]
            x = u / 0.32 * (len(k) - 1)
            i = min(int(x), len(k) - 2)
            p["glow"] *= k[i] + (k[i + 1] - k[i]) * (x - i)
            p["warmth"] = p.get("warmth", 1.0) * (0.75 + 0.25 * (k[i] + (k[i + 1] - k[i]) * (x - i)))
    st.layer(flick)
    st.layer(anim.breathe(0.02, 0.35, 1.0))
    anim.anchor(st, S_DEF)

    def s_orient(t, p):
        return sp + Vector((0, 0, 0.004 * math.sin(t * 2 * math.pi * 0.3))), SR
    bake(s, st, f0, f1, orient=s_orient)

    # ------------------------------------------------------------------ fireflies drifting between us and them
    mid = loc + R @ Vector((-0.15, 0.0, 0.44))
    from lu import fx
    ff = act1.fireflies if act1 and hasattr(act1, "fireflies") else fireflies
    if hasattr(fx, "fireflies"):
        fx.fireflies((mid.x + 0.2, mid.y), 1.8, 16, f0, f1, seed=31, height=(0.2, 0.7), size=0.007)
    elif ff is fireflies:
        ff(mid + Vector((0.2, 0.0, 0.45)), 14, f0, f1, seed=31, spread=(2.8, 1.6, 0.5))
    else:
        ff(mid + Vector((0.2, 0.0, 0.45)), 14, f0, f1, seed=31, spread=(2.8, 1.6, 0.5), size=0.007)

    # ------------------------------------------------------------------ camera: top down, head at frame top, push down
    ctr = (loc + R @ Vector((0.0, 0.0, 0.5))).lerp(sp, 0.3)
    ctr.z = mid.z
    e0 = ctr + Vector((0.05, 0.14, 3.35))
    e1 = ctr + Vector((0.0, 0.1, 2.85))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, ctr + Vector((0.0, -0.22, 0.0)), 35, 5.6, None),
        (dur, "soft", e1, ctr + Vector((0.0, -0.2, 0.0)), 35, 5.6, None)],
        f0, f1, seed=111, shake=0.06, layer=lambda t, p: p.update(roll=-4.0 + 3.0 * t / dur))
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ light: soft sky key on the faces from above
    head = loc + R @ Vector((0, -0.21, 0.57))
    aimed_light("FaceTop", c.col, head + Vector((0.4, 0.6, 2.2)), head, 10.0, col=(0.75, 0.82, 1.0), size=2.0)
    aimed_light("FaceWarm", c.col, sp + Vector((0.5, 0.2, 0.5)), head, 3.0, col=(1.0, 0.7, 0.4), size=0.8)
    aimed_light("StarTop", s.col, sp + Vector((0.2, 0.5, 1.4)), sp, 2.5, col=(1.0, 0.85, 0.65), size=1.0)
    return dict(post=night_post(W, bloom=0.75, vignette=0.38))
