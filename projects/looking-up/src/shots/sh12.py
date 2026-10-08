"""SH12 (4 beats) - the turn. Close on the star (long lens, low over Claude's feet - soft orange shapes in the
foreground), nestled in the flowers at Claude's side. It gazes up at the sky, longing; its glow sputters, catches,
sputters - and at T_DIM drains: gold to pale, its points droop, it shivers. The scene cools with it."""
import math
import bpy
from mathutils import Vector

from lu import anim, stage as S
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import meadow_world, bake, aimed_light, cam_track, night_post, FPS, STAR_SCALE, mow_all, key_energy
from shots.sh11 import lying_transform, star_nestle, C_LIE

T_DIM = 1.6             # the star's glow drains (gold -> pale)


def make(f0, f1):
    W, K = meadow_world(frames=(f0, f1))
    dur = (f1 - f0) / FPS
    c = W.claude()
    s = W.star()
    s.light_scale = 6.0
    if s.light:
        s.light.data.shadow_soft_size = 0.25
        s.light.location = (0, -0.12, 0)
    loc, R = lying_transform(W)
    sp, SR = star_nestle(loc, R)
    mow_all((sp.x, sp.y), 0.3)

    # ------------------------------------------------------------------ Claude: still, breathing (feet in foreground)
    tr = Track()
    tr.pose(0.0, S.merge(C_LIE, eye_happy=0.4, eye_open=0.85, look_x=-0.4, look_y=-0.2))
    tr.layer(anim.breathe(0.014, 0.28))

    def toes(t, p):
        p["leg3_swing"] = p.get("leg3_swing", 0) + 6 * math.sin(t * 2 * math.pi * 0.5) * max(0.0, 1 - t / T_DIM)
    tr.layer(toes)
    anim.anchor(tr, C_DEF)
    bake(c, tr, f0, f1, orient=lambda t, p: (loc, R))

    # ------------------------------------------------------------------ the star: longing, then fading
    st = Track()
    st.pose(0.0, S.merge(S.S_LONGING, scale=STAR_SCALE, glow=1.0, warmth=1.0, eye_open=0.9, eye_tilt=0.35,
                         pupil=1.15, look_y=0.55, look_x=0.15, head=-10, arms=6, eye_happy=0.15, droop=6))
    st.key(0.9, "inout", eye_happy=0.0, eye_tilt=0.5, look_y=0.65)
    st.key(T_DIM - 0.1, "linear", glow=0.92, warmth=0.95, droop=8, eye_open=0.92, pupil=1.15)
    st.key(T_DIM + 0.45, "out", glow=0.3, warmth=0.28, droop=44, arms=-12, legs=-10, head=16, eye_tilt=0.85,
           eye_open=0.55, pupil=0.95, look_y=0.1, curl=12, squash=-0.06)
    st.key(dur, "inout", glow=0.24, warmth=0.22, droop=48, head=20, eye_open=0.48, look_y=0.0, curl=16)

    def sputter(t, p):
        # first hiccups at ~0.95 and ~1.25 s, then the drain at T_DIM
        for (tc, depth, w) in ((0.95, 0.45, 0.09), (1.27, 0.6, 0.12), (T_DIM - 0.02, 0.35, 0.08)):
            u = (t - tc) / w
            if 0 <= u <= 1:
                p["glow"] = p.get("glow", 1) * (1 - depth * math.sin(math.pi * u))
    st.layer(sputter)
    st.layer(anim.tremble(T_DIM + 0.15, dur, amp=2.2, freq=15.0, seed=2))
    anim.anchor(st, S_DEF)

    def s_orient(t, p):
        q = sp.copy()
        if t > T_DIM:          # a shiver in place
            q += Vector((0.0015 * math.sin(t * 95), 0.0, 0.0012 * math.sin(t * 83 + 1)))
        return q, SR
    bake(s, st, f0, f1, orient=s_orient)

    # ------------------------------------------------------------------ camera: long lens, low over Claude's feet,
    # slow push in
    face_n = SR @ Vector((0, -1, 0))
    d = Vector((0.22, 0.92, 0.0)).normalized() * 0.93 + Vector((0, 0, 0.36))
    for k in (0.35, 0.6, 0.85):            # keep the line of sight to its face clear of flower heads
        q = sp + d.normalized() * k
        mow_all((q.x, q.y), 0.16 + 0.05 * k)
    e0 = sp + d.normalized() * 1.55
    e1 = sp + d.normalized() * 1.42
    tgt = sp + Vector((0.0, 0.0, 0.012))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, tgt, 85, 2.0, None),
        (dur, "soft", e1, tgt, 95, 2.0, None)], f0, f1, seed=121, shake=0.08)
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ light: the star is the warm practical; a
    # cool moon rim on the star; the warm bounce on Claude's feet dies as it dims
    aimed_light("StarRim", s.col, sp + Vector((-0.6, -0.9, 0.9)), sp, 3.5, col=(0.6, 0.75, 1.0), size=0.6)
    sk = aimed_light("StarKey", s.col, e0 + Vector((0.2, 0.0, 0.5)), sp, 2.2, col=(1.0, 0.86, 0.7), size=0.8)
    key_energy(sk, f0, f1, lambda t: 2.2 if t < T_DIM else 2.2 - 1.2 * anim.ease("out", (t - T_DIM) / 0.5))
    aimed_light("FeetCool", c.col, sp + Vector((-0.4, 1.4, 1.2)), loc + R @ Vector((0, 0, 0.1)), 4.0,
                col=(0.55, 0.7, 1.0), size=1.5)
    return dict(post=night_post(W, bloom=0.75, vignette=0.42, mist_start=60.0))
