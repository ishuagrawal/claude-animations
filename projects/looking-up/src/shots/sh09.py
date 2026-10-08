"""SH09 - joy, the brightest frame so far. Wider, handheld energy, from the north-east among the fireflies (same side
of the action as SH10-SH14): the star bursts up out of Claude's arms and zips around it in a looping, sparkling
trail - up, a loop-the-loop, skimming low over the flowers; Claude pops up out of its crouch and spins after it,
hopping, laughing (eyes squeezed), carried along toward the flower bed; the fireflies swirl in the star's wake.

Continuity -> SH10: ends with Claude at sh10.STAND (layout.LIE + 0.42 m north), heading 150 (facing the SH10 lens),
laughing, arms up; the star ~1.7 m to its west-north-west, ~1.2 m up, still swinging round on its loop."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, layout, fx
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots import act1 as A
from shots.sh06 import claude_mark

T_BURST = 0.12        # the star bursts out of Claude's arms
T_HOPS = (0.62, 1.5)  # Claude's happy hops
T_LOOP = 1.05         # the star's loop-the-loop


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 26.7, window_glow=0.9))
    O = W.origin
    dur = (f1 - f0) / 24
    A.hide_tail()
    A.constellation(O, lines=0.3, eye=0.0)
    cx, cy = layout.CRATER
    from shots.sh04 import TOUCH
    h_in = math.degrees(math.atan2(cx - TOUCH[0], -(cy - TOUCH[1])))
    A.crater(W, (cx, cy), f0, f1, radius=0.5, heading=h_in, furrow=2.2, seed=7, glow=0.3, smoke=True)
    P2, hc0 = claude_mark()
    hc0 = hc0 + 24.0                                         # as SH08 ended (cheated toward that lens)
    stand = Vector((layout.LIE[0], layout.LIE[1] + 0.42, 0))
    for k in range(6):
        q = P2.lerp(stand, k / 5)
        A.mow((q.x, q.y, 0), 0.5)

    def c_xy(t):
        u = anim.ease("inout", (t - 0.3) / 2.1)
        return P2.lerp(stand, u)

    # ---------------- the star's flight, in Claude-relative cylinder coords (theta = azimuth around Claude)
    th0 = hc0 - 90.0                                          # in front of Claude (where its arms held it)
    th_end = 144.8 + 360.0                                     # SH10 picks it up WNW of Claude

    def star_pos(t):
        u = min(max(t / dur, 0.0), 1.0)
        th = th0 + (th_end - th0) * (0.15 * u + 0.85 * anim.ease("inout", u))
        r = 0.32 + 1.0 * anim.ease("out", min(1.0, t / 0.55)) + 0.38 * anim.ease("inout", (t - 1.6) / 1.0) \
            - 0.25 * math.exp(-((t - 1.3) / 0.25) ** 2)
        h = 0.32 + 0.75 * anim.ease("out", min(1.0, t / 0.45)) - 0.55 * math.exp(-((t - 1.45) / 0.22) ** 2) \
            + 0.35 * anim.ease("inout", (t - 1.7) / 0.9)
        p = c_xy(t) + Vector((math.cos(math.radians(th)), math.sin(math.radians(th)), 0)) * r
        # the loop-the-loop: a vertical circle in the plane of travel
        lu = (t - T_LOOP) / 0.42
        if 0 <= lu <= 1:
            a = 2 * math.pi * anim.ease("inout", lu)
            tang = Vector((-math.sin(math.radians(th)), math.cos(math.radians(th)), 0))
            p += tang * (0.28 * math.sin(a)) * 0.6
            h += 0.32 * (1 - math.cos(a))
        p.z = W.ground(p.x, p.y) + h
        return p

    def star_vel(t):
        return (star_pos(t + 0.02) - star_pos(t - 0.02)) / 0.04

    # ---------------- Claude: pops up, spins after it laughing, hops along toward the flower bed
    c = W.claude()
    tr = Track()
    tr.pose(0.0, dict(squash=-0.15, lean=4, armL_fwd=74, armR_fwd=74, armL_up=-20, armR_up=-20, armL_curl=34,
                      armR_curl=34, eye_happy=0.9, eye_open=0.72, head_tilt=12, look_y=-0.3, armL_bend=0, armR_bend=0))
    # the star bursts out: arms fly up, body pops up (surprise -> delight)
    tr.key(T_BURST + 0.2, "back", squash=0.12, lean=-8, armL_fwd=0, armR_fwd=0, armL_up=70, armR_up=64, armL_curl=0,
           armR_curl=0, armL_bend=20, armR_bend=18, eye_happy=0.4, eye_open=1.0, look_y=0.7, head_tilt=0)
    # laughing: eyes squeezed, arms up, a bounce in everything
    tr.key(0.62, "inout", eye_happy=1.0, eye_open=0.5, squash=0.04, lean=-4, armL_up=58, armR_up=52, head_tilt=-6)
    tr.key(1.4, "inout", head_tilt=8, lean=2, armL_up=66, armR_up=40)
    tr.key(2.1, "inout", head_tilt=-4, armL_up=50, armR_up=58, lean=-3)
    # ends facing the SH10 lens, laughing, arms up (SH10's opening pose)
    tr.key(dur, "inout", head_tilt=8, armL_up=50, armR_up=42, armL_bend=18, armR_bend=18, eye_happy=0.95,
           eye_open=0.7, lean=0, squash=0.02)

    def spin(t, p):
        xy = c_xy(t)
        p["x"], p["y"] = xy.x, xy.y
        p["z"] = W.ground(xy.x, xy.y)
        # heading chases the star round (lagging), then settles facing the SH10 lens for the cut
        sp = star_pos(max(t - 0.14, 0.0))
        d = sp - xy
        h_star = math.degrees(math.atan2(d.x, -d.y))
        h_lin = hc0 + (h_star - hc0 + 180) % 360 - 180
        u = anim.ease("inout", min(1.0, t / 2.25))
        h_chase = hc0 + 342.0 * u                                 # one full turn after it
        k = anim.ease("inout", (t - 2.1) / 0.5)
        p["heading"] = h_chase * (1 - k) + (150.0 + 360.0) * k
        # laughter: quick little squash bounces; giggles in the arms
        if t > 0.5:
            p["squash"] = p.get("squash", 0.0) + 0.035 * math.sin(t * 2 * math.pi * 5.5)
            p["roll"] = p.get("roll", 0.0) + 3.0 * math.sin(t * 2 * math.pi * 2.6)
    tr.layer(spin)
    for th in T_HOPS:
        tr.layer(anim.hop_arc(th, th + 0.3, 0.13, squash=0.12))
    tr.layer(anim.breathe(0.01, 0.6))
    anim.settle(tr, C_DEF, max_gap=0.5)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)

    # ---------------- the star: joyful, glowing gold; banks into its turns
    s = W.star()
    s.light_scale = 32.0
    st = Track()
    st.pose(0.0, dict(scale=A.STAR_SCALE, glow=1.3, warmth=1.0, eye_happy=0.85, eye_open=0.8, arms=28, legs=8, head=-8,
                      curl=4, squash=0.0, droop=0, pupil=1.0))
    st.key(T_BURST + 0.15, "out", squash=0.22, arms=55, legs=18, glow=1.7, eye_happy=0.95, head=-16)
    st.key(0.6, "inout", squash=0.06, arms=45, glow=1.6)
    st.key(dur, "soft", arms=40, legs=14, glow=1.55, head=-12, eye_happy=0.9, squash=0.0)

    def fly(t, p):
        q = star_pos(t)
        p["x"], p["y"], p["z"] = q.x, q.y, q.z
        v = star_vel(t)
        if v.length > 1e-3:
            hv = math.degrees(math.atan2(v.x, -v.y))
            # face mostly the direction of travel but cheated round toward the camera; bank into the turn
            p.update(A.star_rot(hv - 65.0, -8.0 - 6.0 * math.sin(t * 7.0), 22.0 * math.sin(t * 3.1)))
        p["spin"] = 0.0
    st.layer(fly)
    anim.settle(st, S_DEF, max_gap=0.5)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # sparkling trail (SH10's look) + a burst of sparkles as it leaves the arms
    try:
        from shots.sh10 import sparkle_trail
        sparkle_trail("PlayTrail", star_pos, f0, f1 + 1, n=22, lag=0.024, size=0.022, strength=18.0)
    except Exception as e:
        print("SH09: sh10.sparkle_trail unavailable, using act1.streak:", e)
        A.streak("PlayTrail", star_pos, 0.0, dur, f0, f1, lambda t: Vector((4.6, 17.2, 1.8)), n=26, tail=0.4,
                 size=0.003, head=1.2, sparkle_n=40)
    fx.sparks("BurstSparks", star_pos(T_BURST), T_BURST, f0, n=24, speed=(0.6, 1.8), life=(0.35, 0.8), gravity=-1.5,
              up=0.7, color=(1.0, 0.78, 0.38), strength=30.0, size=0.012, seed=91)
    if hasattr(fx, "pollen_burst"):
        fx.pollen_burst(Vector((stand.x, stand.y, W.ground(stand.x, stand.y) + 0.2)), f0 + int(1.75 * 24), n=50, seed=92)
    # ---------------- fireflies swirling in its wake
    if hasattr(fx, "fireflies") and hasattr(fx, "lag_target"):
        lag = fx.lag_target(s.rig, f0, f1, 6)
        fx.fireflies((1.6, 14.4), 3.2, 80, f0, f1, seed=93, height=(0.15, 1.5),
                     attract=dict(obj=s.rig, radius=1.5, swirl=2.6, pull=0.42, lag=lag))
    else:
        A.fireflies((1.6, 14.4, 0.9), 60, f0, f1, seed=93, spread=(6.0, 6.0, 1.4),
                    wake=(star_pos, star_vel, 1.2, 1.0))
    # ---------------- camera: wider, handheld, from the north-east; drifts with them toward the flower bed
    e0 = Vector((4.75, 17.3, 0))
    e0.z = W.ground(e0.x, e0.y) + 0.85
    t0 = Vector((1.75, 14.25, W.ground(1.75, 14.25) + 0.8))
    e1 = e0 + Vector((-0.55, -0.15, 0.05))
    t1 = Vector((1.15, 14.1, W.ground(1.15, 14.1) + 0.82))
    A.mow((e0.x, e0.y, 0), 0.6)
    foc0, foc1 = (t0 - e0).length, (t1 - e1).length
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", e0, t0, 30.0, foc0), (dur, "inout", e1, t1, 30.0, foc1)],
                     shake=0.45, seed=909, fstop=4.0)
    bpy.context.scene.camera = cam
    scene.char_lights(c.col, Vector((1.5, 14.2, W.ground(1.5, 14.2) + 0.4)), e0, (0.3, 0.8, 0.5),
                      rim_col=(0.6, 0.76, 1.0), rim_w=18.0, fill_col=(1.0, 0.72, 0.42), fill_w=4.0)
    # the brightest frame so far: a warm wash where the star plays
    A.glow_pool("PlayGlow", Vector((1.5, 14.2, W.ground(1.5, 14.2) + 0.3)), 1.6, f0, f1, lambda t: 0.5, strength=0.6,
                alpha=0.18, light=0.0)
    scene.point("PlayFill", Vector((2.6, 15.6, W.ground(2.6, 15.6) + 1.6)), (1.0, 0.7, 0.4), 60.0, 1.0, shadow=False)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.3, mist_start=40.0, mist_depth=1800.0, bloom=1.0, bloom_thr=0.4,
                          vignette=0.32, exposure=0.18))
