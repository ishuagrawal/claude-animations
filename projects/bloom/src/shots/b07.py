"""B07 (20.00-21.88, 3 beats): MS. Claude pulls the sprout in against its chest and wraps both arms round it, sinks
into a deep crouch (anticipation) and at T_GO launches into a run, an explosion of ash at its feet, racing out of frame
to the right (north, toward the climb), the storm wall towering behind it. The music's drive kicks in on T_GO.
Hands off to B08: a wide tracking shot of Claude racing up the ash slope, left to right."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, sky
from lu.anim import Track
from shots import act_ash as A

T_GO = 0.7
RUN_AZ = 64.0                         # the run's heading (azimuth): NNE, past the swing toward the climb
STORM = (0.66, 0.72)


def make(f0, f1):
    dur = (f1 - f0) / 24
    F = lambda t: f0 + int(round(t * 24))
    lx, ly = A.LOOKOUT_XY
    hd0 = A.PEAK_HEADING
    run_hd = RUN_AZ + 90.0
    W = world.World("threat", focus=(lx - 2.0, ly + 3.0), storm=STORM[0], frames=(f0, f1))
    g = W.ground
    from lu import dress
    W.storm_advance(f0, f1, STORM[0], STORM[1])
    sky.key(f0, Hole=0.17)
    sky.flash(F(1.25), 0.5, az=162.0, el=14.0)
    wa = W.fx.get("wind_ash")
    if wa:
        fx.amount(wa, f0, 0.8)
    W.gust(f0, f1 + 12, strength=1.2)
    # ---- the run path: still until T_GO, then accelerating hard to ~4 m/s
    d = Vector((math.cos(math.radians(RUN_AZ)), math.sin(math.radians(RUN_AZ)), 0.0))
    pts = [(0.0, lx, ly), (T_GO, lx, ly)]
    for t in (T_GO + 0.25, T_GO + 0.55, dur + 0.4):
        u = t - T_GO
        s_ = 0.5 * 5.5 * u * u if u < 0.6 else 0.5 * 5.5 * 0.36 + 3.3 * (u - 0.6)
        pts.append((t, lx + d.x * s_, ly + d.y * s_))
    path = anim.Path(pts, ease_="linear")
    dress.mow((lx, ly), 0.6)
    # ---- Claude
    c = W.claude()
    base = dict(acting.B_HOLD)
    base.update(A.ASH, x=lx, y=ly, z=g(lx, ly), heading=hd0, crouch=0.15, lean=6.0, bend=4.0, head_nod=-6.0,
                squash=0.05, eye_tilt=-0.9, eye_open=0.78, lower_lid=0.38, pupil=0.9, mouth_press=0.8, smile=-0.12,
                handL_curl=0.75, handR_curl=0.75, look_y=0.3)
    tr = Track()
    tr.pose(0.0, base)
    # pull the sprout in, turn to the run, sink into the crouch
    tr.key(0.28, "inout", **{k: v for k, v in acting.B_RUN_HOLD.items() if k.startswith(("hand", "arm"))},
           heading=run_hd - 8.0, cradle_y=0.04, head_nod=-2.0, look_y=0.1)
    tr.key(T_GO - 0.06, "inout", crouch=0.85, squash=-0.2, lean=18.0, bend=10.0, head_nod=-12.0, eye_open=0.7,
           heading=run_hd, look_y=0.35)
    # launch: stretch out of the crouch
    tr.key(T_GO + 0.08, "out", crouch=0.0, squash=0.16, lean=20.0, bend=2.0, head_nod=-10.0, eye_open=0.85)
    tr.key(T_GO + 0.3, "inout", squash=0.04, lean=10.0, bend=4.0, head_nod=-8.0)
    tr.layer(acting.breathe(0.012, 0.6, arms=0.5))
    tr.layer(acting.run(path, z_fn=g, heading_offset=0.0, v_full=2.2, lean=16.0, flight=0.12, squash=0.12))
    # keep the pre-launch facing while standing (the run layer faces the path only once it moves)
    A.bake_claude(c, tr, f0, f1)
    # ---- the sprout, cradled against the chest
    s = A.sprout("Sprout", light_scale=0.4)
    s.ride(c, "cradle")
    st = Track()
    st.pose(0.0, dict(acting.S_SHIVER, x=0.0, y=0.02, z=0.0, heading=180.0, clod=1.0, glow=0.55, health=0.45))
    st.key(T_GO, "inout", head_nod=22.0, leafL_curl=0.95, leafR_curl=0.95)
    st.layer(acting.sprout_shiver(0.0, dur + 0.5, amp=0.6, freq=13.0))
    A.bake_sprout(s, st, f0, f1)
    # ---- ash: the burst at the launch, puffs at the footfalls
    fx.dust_puff((lx, ly), F(T_GO), size=2.2, n=12, opacity=0.45, seed=700, color=A.ASH_PUFF,
                 drift=(-d.x * 0.5, -d.y * 0.5, 0.1))
    fx.dust_puff((lx - d.x * 0.15, ly - d.y * 0.15), F(T_GO - 0.25), size=0.7, n=5, opacity=0.4, seed=701,
                 color=A.ASH_PUFF)
    for k in range(6):
        t = T_GO + 0.18 + k * 0.19
        x, y = path.pos(t)
        fx.dust_puff((x, y), F(t), size=1.1, n=6, opacity=0.45, seed=710 + k, color=A.ASH_PUFF,
                     drift=(-d.x * 0.6, -d.y * 0.6, 0.05))
    # ---- camera: low, in front-right of the run (ENE of Claude) looking back south-west: Claude 3/4 to us, the storm
    #      wall behind; it launches toward camera-right and bursts out of frame right, a small pan right with it
    K = Vector((lx, ly, g(lx, ly)))
    caz = math.radians(26.0)
    e0 = K + Vector((math.cos(caz), math.sin(caz), 0.0)) * 3.0
    e0.z = g(e0.x, e0.y) + 0.3
    t0 = K + Vector((0, 0, 0.62)) + d * 0.15
    t1 = K + Vector((0, 0, 0.66)) + d * 0.7
    A.mow_line(e0, K, 0.6)
    A.mow_line(K, (K + d * 4.0), 0.5)
    A.cam_move("CamB07", f0, f1, [(0.0, "linear", e0, t0, 30.0, None), (T_GO, "linear", e0, t0, 30.0, None),
                                  (dur, "out", e0 + Vector((0, 0, 0.05)), t1, 30.0, None)],
               shake=0.1, seed=707)
    c.face_light(e0, energy=3.0, col=(1.0, 0.82, 0.6), dist=1.5, size=0.9, frame=F(0.4))
    c.rim_light(e0, (-0.95, 0.33, 0.2), col=(0.72, 0.6, 1.0), energy=60.0, dist=1.8, frame=F(0.4))
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("threat", focus_xy=(0.45, 0.45), sat=A.SAT))
