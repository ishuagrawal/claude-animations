"""B09 (24.38-26.25 s, 3 beats): the slope collapses. Claude bounds up the ash sheet over the scree (left to right
and up, seen from the bench below, against the storm); at T_SLIP the sheet cracks into plates under its feet, it
pitches back onto its back, holding the sprout up off the ground, slides with the cascade of plates, stones and ash,
goes over the edge of the step in a backward somersault and lands face down in the ash at T_STOP. Handheld; the
camera whips down after the fall and is jolted by the landing."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky, mountain
from shots import act_climb as A

T_SLIP = 0.4
T_STOP = 1.6

SLIDE = 6.0          # metres slid down the fall line
PEAK_DROP = 0.08


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("storm", focus=(17.0, 106.0), frames=(f0, f1), storm=0.86, ambient=False)
    W.set_env(Wet=0.0)
    C = A.make_claude(W)
    S = A.make_sprout(C)
    G = A.fast_ground(10.0, 26.0, 99.0, 116.0, res=0.05)
    SC = W.mtn["scree"]
    cen, down, side = SC["center"], SC["down"], SC["side"]
    down3 = Vector((down.x, down.y, 0.0))
    side3 = Vector((side.x, side.y, 0.0))
    P0 = Vector((cen.x, cen.y, 0.0)) - down3 * (mountain.SCREE_SIZE[1] * 0.3)      # where the sheet first breaks
    h_up = A.heading_to(-down.x, -down.y)
    fs = f0 + int(round(T_SLIP * A.FPS))

    # ---- the collapse: plates and stones slide, dust where they go
    puffs = mountain.scree_slide(W.mtn, fs, dur=1.5, run=7.0, origin=(P0.x, P0.y))
    for i, (pp, fpp) in enumerate(puffs[::2]):          # (fx.slide_dust in a darker ash so Claude reads through it)
        fx.dust_puff((pp.x, pp.y, pp.z), fpp, size=0.9, n=5, seed=4000 + i, opacity=0.35, color=(0.17, 0.17, 0.19))

    # ---- Claude
    v_run = 2.4
    run_from = P0 + down3 * (v_run * (T_SLIP + 0.35))
    path = anim.Path([(-0.35, run_from.x, run_from.y), (T_SLIP, P0.x, P0.y)], ease_="linear")

    def slide_s(t):                     # metres slid down the fall line since T_SLIP (accelerate, brake at the foot)
        if t <= T_SLIP:
            return 0.0
        u = min(1.0, (t - T_SLIP) / (T_STOP - T_SLIP))
        return SLIDE * (u * u * (3 - 2 * u)) ** 0.9

    # backward pitch about the side axis (0 upright facing uphill, -90 on its back, -288 face down head uphill)
    TH = [(T_SLIP, 0.0), (0.55, -38.0), (0.72, -96.0), (1.0, -112.0), (1.22, -200.0), (1.38, -262.0),
          (1.52, -294.0), (T_STOP, -288.0)]

    def theta(t):
        if t <= TH[0][0]:
            return 0.0
        for (ta, a), (tb, b) in zip(TH, TH[1:]):
            if ta <= t <= tb:
                u = (t - ta) / (tb - ta)
                return a + (b - a) * (u * u * (3 - 2 * u))
        return TH[-1][1]

    def wob(t):                         # chaos: a sideways roll and a yaw wobble while it tumbles
        k = A.window(t, 0.5, 1.5, 0.12)
        return 18.0 * k * math.sin((t - 0.5) * 9.0), 14.0 * k * math.sin((t - 0.5) * 6.0 + 1.0)

    def centre(t):
        s = slide_s(t)
        q = P0 + down3 * s + side3 * (0.25 * math.sin(max(0.0, t - T_SLIP) * 5.0) * A.window(t, 0.5, 1.4))
        th = math.radians(theta(t))
        r = 0.27 + 0.18 * abs(math.cos(th))
        hop = 0.0
        if 1.0 <= t <= 1.38:            # airborne over the edge of the step
            u = (t - 1.0) / 0.38
            hop = 0.35 * 4 * u * (1 - u)
        if 0.66 <= t <= 0.74:           # the back hits: a little rebound
            hop += 0.05 * math.sin(math.pi * (t - 0.66) / 0.08)
        return Vector((q.x, q.y, G(q.x, q.y) + r + hop + 0.03))

    tr = anim.Track(claude.DEFAULT)
    P = dict(acting.B_RUN_HOLD)
    P.update(acting.F_DETERMINED)
    P.update(ash=0.25, vivid=0.3, brand=0.9, eye_open=0.75, eye_tilt=-0.8, lower_lid=0.35, look_y=0.35)
    tr.pose(0.0, P)
    tr.key(T_SLIP - 0.02, ash=0.25)
    # the slip: eyes snap wide (alarm), arms push the sprout up and away from the falling body
    tr.key(T_SLIP + 0.08, "out", eye_open=1.3, eye_tilt=0.7, lower_lid=0.0, pupil=0.7, look_y=-0.4, mouth_o=0.6,
           mouth_open=0.35, squash=0.12)
    tr.key(0.62, handL_y=-0.46, handR_y=-0.46, handL_z=0.30, handR_z=0.30, cradle_y=-0.13, cradle_z=0.03,
           armL_pole=-10.0, armR_pole=-10.0, legs_ik=0.0, leg0_swing=55.0, leg3_swing=55.0, leg1_swing=40.0,
           leg2_swing=40.0)
    tr.key(0.72, "out", squash=-0.16, eye_open=0.2, eye_squeeze=0.8, eye_tilt=-0.4, mouth_o=0.0, mouth_open=0.0)
    tr.key(0.82, squash=0.0)
    # tumbling: curled tight round the sprout, eyes squeezed shut
    tr.key(1.0, handL_y=-0.27, handR_y=-0.27, handL_z=0.25, handR_z=0.25, cradle_y=0.0, cradle_z=0.0, bend=12.0,
           crouch=0.6, eye_squeeze=1.0, eye_open=0.0, leg0_swing=-30.0, leg3_swing=-30.0, leg1_swing=60.0,
           leg2_swing=60.0, ash=0.35)
    tr.key(1.38, bend=14.0, leg0_swing=70.0, leg3_swing=70.0, leg1_swing=-20.0, leg2_swing=-20.0)
    tr.key(1.52, "out", squash=-0.18, ash=0.42, bend=6.0, crouch=0.3, leg0_swing=-50.0, leg3_swing=-50.0,
           leg1_swing=-55.0, leg2_swing=-55.0, handL_y=-0.36, handR_y=-0.36, handL_z=0.18, handR_z=0.18,
           cradle_y=-0.08, cradle_z=-0.06)
    tr.key(T_STOP, squash=-0.06)
    tr.key(dur, squash=0.0, eye_squeeze=0.9)
    A.freeze(tr, T_SLIP, claude.DEFAULT)
    tr.layer(acting.run(path, z_fn=lambda x, y: G(x, y) + 0.03, stride=0.36, phases=(0.0, 0.76, 0.76, 0.0),
                        lean=14.0, squash=0.1, flight=0.08, v_full=1.0))

    def tumble(t, p):
        if t <= T_SLIP:
            return
        th = theta(t)
        rl, yw = wob(t)
        R = (Matrix.Rotation(math.radians(yw), 3, "Z") @ Matrix.Rotation(math.radians(-th), 3, side3)
             @ Matrix.Rotation(math.radians(rl), 3, down3) @ Matrix.Rotation(math.radians(h_up), 3, "Z"))
        # blend out of the run's own root over the first frames after the slip
        A.rot_about_centre(p, R, centre(t), zc=0.45 - 0.15 * p.get("crouch", 0.0))
        for i in range(4):
            p.pop(f"foot{i}_x", None)
            p.pop(f"foot{i}_y", None)
            p.pop(f"foot{i}_z", None)
        p["lean"] = p.get("lean", 0.0) * max(0.0, 1 - (t - T_SLIP) / 0.15)
    tr.layer(tumble)
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)

    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=170.0, glow=1.7, health=0.55, eye_open=0.5))
    st.key(T_SLIP + 0.1, eye_open=1.1, leafL_reach=40.0, leafR_reach=40.0, leafL_curl=-0.2, leafR_curl=-0.2)
    st.key(1.0, eye_open=0.0, leafL_reach=-10.0, leafR_reach=-10.0, leafL_curl=0.9, leafR_curl=0.9, lean=6.0)
    st.key(dur, eye_open=0.2, glow=1.3)
    st.layer(acting.sprout_shiver(0.0, dur, amp=0.7, freq=13.0))
    st.layer(acting.sprout_shiver(T_SLIP, T_STOP, amp=1.6, freq=7.0, seed=3))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- impact dust + ash clods thrown up
    for (t, k) in ((0.72, 2.0), (1.12, 1.4), (1.40, 2.2), (1.52, 2.6), (T_STOP, 1.4)):
        c = centre(t)
        fx.dust_puff((c.x, c.y), f0 + int(round(t * A.FPS)), size=k * 0.6, n=6, color=(0.16, 0.165, 0.18), opacity=0.32,
                     drift=(down.x * 0.5, down.y * 0.5, 0.15))
        fx.chips((c.x, c.y, G(c.x, c.y) + 0.1), f0 + int(round(t * A.FPS)), n=9, direction=(down.x, down.y, 1.2),
                 speed=(1.0, 2.4), size=(0.015, 0.04), color=(0.30, 0.29, 0.28), inner=(0.20, 0.19, 0.19),
                 seed=int(t * 100), name="Clod")
    for k in range(10):                 # the trail of ash it ploughs through
        t = T_SLIP + 0.12 + k * 0.11
        c = centre(t)
        fx.dust_puff((c.x, c.y), f0 + int(round(t * A.FPS)), size=0.6, n=4, color=(0.16, 0.165, 0.18), opacity=0.25,
                     drift=(down.x * 0.8, down.y * 0.8, 0.2))

    # ---- camera: on the upper bench beside the sheet, at Claude's level (it bounds toward camera-right, face lit by
    # the sprout); at the slip the operator runs to the lip and the camera whips down after the fall
    E0 = Vector((22.5, 111.3, 0.0))
    E0.z = G(E0.x, E0.y) + 1.0
    E1 = Vector((20.9, 108.15, 0.0))
    E1.z = G(E1.x, E1.y) + 1.15
    cs = {}
    for f in range(f0 - 1, f1 + 2):
        cs[f] = centre((f - f0) / A.FPS)
    # target = Claude's centre followed by a lagging critically-damped spring (the operator chasing the fall)
    tgt = {}
    y = cs[f0 - 1] + Vector((0, 0, 0.25))
    v = Vector((0, 0, 0))
    w = 2 * math.pi * 2.6
    dt = 1.0 / A.FPS
    for f in range(f0 - 1, f1 + 2):
        x = cs[f] + Vector((0, 0, 0.25))
        a = (x - y) * (w * w) - v * (2 * 0.9 * w)
        v = v + a * dt
        y = y + v * dt
        tgt[f] = y.copy()

    def cam_layer(t, p):
        f = f0 + int(round(t * A.FPS))
        g = tgt[min(max(f, f0 - 1), f1 + 1)]
        u = A.smooth((t - 0.45) / 0.8)
        e = E0.lerp(E1, u)
        p.update(cx=e.x, cy=e.y, cz=e.z, tx=g.x, ty=g.y, tz=g.z)
        p["focus"] = (g - e).length
    ct = anim.Track(anim.CAM_DEFAULT)
    ct.key(0.0, lens=26.0, fstop=4.0)
    ct.key(0.5, lens=26.0)
    ct.key(1.25, lens=24.0)
    ct.key(1.62, "out", lens=34.0)                       # punch in on the stop
    ct.layer(cam_layer)
    ct.layer(A.handheld(amp=0.03, ang=0.8, freq=1.8, seed=91,
                        env=lambda t: 0.6 + 1.4 * A.window(t, 0.45, 1.55, 0.1)))
    ct.layer(A.impact_shake([T_SLIP, 0.72, 1.52], amp=0.03, ang=1.4, dur=0.3))
    cam = A.make_camera("CamB09", ct, f0, f1, seed=9)

    # ---- lights (keyed to follow the fall without inheriting its spin)
    sc = bpy.context.scene
    sc.frame_set(f0 + 6)
    cl = cam.matrix_world.translation.copy()
    fl = C.face_light(cl, energy=5.0, col=(0.85, 0.9, 1.0), dist=1.8, size=1.0)
    rim = C.rim_light(cl, sky.storm_vec() + Vector((0, 0, 0.6)), col=(0.82, 0.84, 1.0), energy=320.0, dist=2.2)
    for lo in (fl, rim):
        A.follow_fn(lo, centre, f0, f1)

    # ---- wind and ash
    cz = G(P0.x, P0.y)
    W.fx["wind_ash"] = fx.wind_ash((6.0, 108.0, cz + 1.0), (24.0, 20.0, 4.0), 2600, f0, wind=(9.5, -3.2))
    W.fx["ash"] = fx.ash_snow((4.0, 108.0, cz + 6.0), (30.0, 30.0, 14.0), 3000, f0, wind=(4.2, -1.5), fall=0.9)
    sky.flash(f0 + 4, 0.55, az=160.0, el=16.0)
    W.gust(f0, f1, 1.4)
    return dict(post=A.post_storm(focus_xy=(0.5, 0.5), haze_amt=0.7))
