"""B08 (21.88-24.38 s, 4 beats): wide tracking shot alongside. Claude races up the ash slope, the sprout clutched to
its chest, ash kicking from every footfall and streaming past in the headwind; behind it the storm swallows the
valley (the wall towers higher and its deck rolls overhead, rain curtains sweep the charred forest, lightning
flickers inside it). Screen direction: left to right and up.

The gallop lands on the score's drive grid: one bound (front pair, then back pair 0.075 s later) every half beat
after B07 T_GO (shot-local 0.075, 0.3875, ...), like the foley's footsteps."""
import math
from mathutils import Vector

from lu import world, acting, anim, claude, sprout, fx, post, sky, layout
from shots import act_climb as A

# (no named timing constants in the script for B08; the gallop follows the drive grid from B07 T_GO)
STEP0 = 0.075            # first landing on the drive grid, shot-local
STEP = 0.3125            # one bound per half beat
STRIDE = 0.36


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    # the threat sky of B05-B07 turns into the storm over the shot: the violet wall towers up behind Claude and its
    # deck rolls overhead, the light drains to the storm's indigo (palette, lights and grade keyed threat -> storm)
    W = world.World("threat", focus=(12.0, 95.0), frames=(f0, f1), storm=0.5, ambient=False)
    sky.key_phase(f0, "threat", Storm=0.5, Hole=0.0)
    sky.key_phase(f0 + 14, "threat", Storm=0.58, Hole=0.0)
    sky.key_phase(f1, "storm", Storm=0.86)
    W.set_env(f0, Wet=0.0, Ember=0.5)
    W.set_env(f1, Wet=0.0, Ember=0.0)
    C = A.make_claude(W)
    S = A.make_sprout(C)
    G = A.fast_ground(4.0, 24.0, 84.0, 104.0, res=0.05)

    # ---- the run: a straight line up the slope at the drive grid's speed
    cyc = 2 * STRIDE
    v = cyc / STEP
    p0 = Vector((14.7, 91.6))           # up the spine of the low ridge below the scree (the ground falls away to
    p1 = Vector((15.3, 98.1))           # both sides: from the east the camera looks up at Claude against the sky)
    dvec = (p1 - p0).normalized()
    d3 = Vector((dvec.x, dvec.y, 0.0))
    t_s = STEP0 - STEP                       # the path starts one bound before the shot (a foot lands at STEP0)
    t_e = dur + 0.3
    pa = p0 - dvec * (v * (0.0 - t_s))
    pb = pa + dvec * (v * (t_e - t_s))
    path = anim.Path([(t_s, pa.x, pa.y), (t_e, pb.x, pb.y)], ease_="linear")
    hd = A.heading_to(dvec.x, dvec.y)

    tr = anim.Track(claude.DEFAULT)
    P = dict(acting.B_RUN_HOLD)
    P.update(acting.F_DETERMINED)
    P.update(mouth_press=0.0, look_y=0.25, look_x=0.15, ash=0.25, head_nod=-8.0, eye_tilt=-0.8, eye_open=0.72,
             lower_lid=0.35, vivid=0.3, brand=0.9, cradle_y=-0.02)
    tr.pose(0.0, P)
    tr.layer(acting.run(path, z_fn=G, stride=STRIDE, phases=(0.0, 0.76, 0.76, 0.0), lean=11.0, squash=0.11,
                        flight=0.09, v_full=1.0))
    tr.layer(anim.blinks(times=[0.55, 2.05], dur=0.13))
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)

    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=165.0, x=0.0, y=0.0, z=0.0, glow=1.7, health=0.55,
                      eye_open=0.45, look_y=0.4))
    st.layer(acting.sprout_shiver(0.0, dur, amp=0.8, freq=13.0))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- camera: tracking alongside from below the slope (south-east), looking up-slope toward the storm wall in
    # the west-north-west: Claude runs left to right across it in near profile, the storm towering behind it
    import numpy as np
    look_az = math.radians(178.0)
    L = Vector((math.cos(look_az), math.sin(look_az), 0.0))
    D = 6.0
    ts = np.linspace(0.0, dur, 11)

    def tgt_xy(t):
        x, y = path.pos(t * 0.92 + 0.12)
        return Vector((x, y, 0.0)) + d3 * 0.5

    ez_need, tz_need = [], []
    for t in ts:
        tg = tgt_xy(t)
        gz = G(tg.x, tg.y)
        e = tg - L * D
        ez = G(e.x, e.y) + 0.22
        foot = Vector((tg.x, tg.y, gz + 0.32))          # (sight line to its body: the feet may dip behind the crest)
        e3 = Vector((e.x, e.y, 0.0))
        for k in range(1, 16):
            u = k / 16
            q = e3.lerp(foot, u)
            ez = max(ez, (G(q.x, q.y) + 0.1 - u * foot.z) / (1 - u))
        ez_need.append(ez)
        tz_need.append(gz)
    ka = np.polyfit(ts, ez_need, 2)
    kb = np.polyfit(ts, tz_need, 1)
    print("B08 cam heights", [round(z, 2) for z in ez_need], [round(z, 2) for z in tz_need])

    def cam_layer(t, p):
        tg = tgt_xy(t)
        tg.z = float(np.polyval(kb, t)) + 0.82
        e = tg - L * D
        e.z = float(np.polyval(ka, t)) + 0.1
        p.update(cx=e.x, cy=e.y, cz=e.z, tx=tg.x, ty=tg.y, tz=tg.z)
    ct = anim.Track(anim.CAM_DEFAULT)
    ct.key(0.0, lens=34.0, fstop=5.6, focus=D)
    ct.key(dur, lens=34.0)
    ct.layer(cam_layer)
    ct.layer(A.handheld(amp=0.03, ang=0.55, freq=1.6, seed=81))
    ct.layer(A.impact_shake([STEP0 + STEP * k for k in range(9)], amp=0.006, ang=0.12, dur=0.12))
    cam = A.make_camera("CamB08", ct, f0, f1, seed=8)
    for t in np.linspace(0.0, dur, 7):                  # no tufts / twigs between the lens and Claude
        tg = tgt_xy(t)
        A.clear_line(tg - L * D, tg, radius=0.6, u0=0.05, u1=0.85)

    # ---- lights: the sprout's glow is the warm-living note; a cool storm rim separates Claude from the sky
    sc_ = __import__("bpy").context.scene
    sc_.frame_set(f0 + 30)
    cl = cam.matrix_world.translation.copy()
    fl = C.face_light(cl, energy=5.0, col=(0.85, 0.9, 1.0), dist=1.8, size=1.0)
    rim = C.rim_light(cl, sky.storm_vec() + Vector((0, 0, 0.3)), col=(0.86, 0.88, 1.0), energy=900.0, dist=2.0)
    for lo in (fl, rim):
        A.follow_root(lo, tr, f0, f1)

    # ---- FX: footfall dust, the headwind ash, distant rain curtains on the valley, lightning in the wall
    falls = A.footfalls(path, f0, (0.0, dur), G, STRIDE, (0.0, 0.76, 0.76, 0.0))
    A.footfall_dust(falls, f0, size=0.8, drift=(-dvec.x * 0.6 + 0.4, -dvec.y * 0.6 - 0.15, 0.1), opacity=0.35,
                    color=(0.20, 0.205, 0.22))
    cx, cy = 14.0, 95.0
    cz = W.ground(cx, cy)
    # (boxes end ~1.5 m short of the camera's track so no flake passes the lens)
    W.fx["wind_ash"] = fx.wind_ash((3.0, cy, cz + 1.4), (34.0, 30.0, 3.5), 3600, f0, wind=(9.5, -3.2), amount_=1.0)
    W.fx["ash"] = fx.ash_snow((-4.0, cy, cz + 6.0), (48.0, 46.0, 14.0), 5000, f0, wind=(4.2, -1.5), fall=0.9)
    sky.flash(f0 + 17, 0.75, az=163.0, el=14.0)
    sky.flash(f0 + 41, 0.45, az=171.0, el=9.0, double=False)
    W.gust(f0, f1, 1.4)
    return dict(post=post.transition("threat", "storm", f0 + 14, f1, focus_xy=(0.45, 0.4), sat=[(f0, 0.95), (f1, 1.05)],
                                 lift=(1.0, 1.0, 1.01), gamma=(1.0, 1.0, 1.01),
                                 gain=[(f0, (1.02, 0.99, 0.95)), (f1, (0.97, 0.99, 1.03))]))
