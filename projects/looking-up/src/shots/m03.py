"""M03 — EXT spring day, flower meadow below the windmill: flying lessons. The star launches — wobbles — and tumbles
into the flowers (twice). Claude winces, encourages. Third try: it lifts and hovers! Claude cheers, arms up, hopping."""
import math
import bpy
import bmesh
from mathutils import Vector
from lu import world, anim, scene, stage as S, fx, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle


def mow(center, radius, names=("Meadow",)):
    """Remove tall meadow cards around a spot so the characters and the flower bed read."""
    c = Vector(center)
    for nm in names:
        for o in [o for o in bpy.data.objects if o.name.startswith(nm) and o.type == "MESH"]:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            mw = o.matrix_world
            dead = [f for f in bm.faces if ((mw @ f.calc_center_median()) - c).to_2d().length < radius]
            bmesh.ops.delete(bm, geom=dead, context="FACES")
            bm.to_mesh(o.data)
            bm.free()


def make(f0, f1):
    W = world.World("ext", "day", season="spring", windmill_state=dict(sails_angle=15.0))
    O = W.origin
    dur = (f1 - f0) / 24
    cx, cy = 3.2, -8.6
    gz = W.ground(cx, cy)
    mow((cx - 0.5, cy - 1.6, gz), 3.6)
    W.grass_patch((cx - 0.5, cy - 1.4), 3.8, 26000, blade=(0.04, 0.11), flowers=0.3, seed=31)
    hub = W.wm["hub"]
    from lu import windmill
    for f in range(f0, f1):
        windmill.sails_set_angle(hub, 15.0 + 10.0 * (f - f0) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    c = W.claude()
    sx, sy = cx - 0.95, cy - 0.05
    sz = W.ground(sx, sy)
    hd = -42                                            # toward the star, cheated toward camera
    tr = Track()
    tr.pose(0.0, dict(x=cx, y=cy, z=gz, heading=hd, eye_open=1.0, lean=6, armL_up=-10, armR_up=-10, armL_fwd=0, armR_fwd=0,
                      squash=0.0, pupil=1.1, eye_happy=0.0, armL_bend=0, armR_bend=0, eye_tilt=0.1))
    # wince at fall 1 (1.0), at fall 2 (2.2), cheer at 3.4
    tr.key(0.9, "inout", lean=10, pupil=1.1, look_y=0.1)
    tr.key(1.15, "snap", squash=-0.08, eye_open=0.35, lean=-4, armL_up=30, armR_up=30, armL_fwd=40, armR_fwd=40, eye_happy=0.0,
           eye_tilt=0.6)
    tr.key(1.6, "inout", squash=0.0, eye_open=0.9, lean=8, armL_up=5, armR_up=5, armL_fwd=20, armR_fwd=20, eye_happy=0.35,
           eye_tilt=0.15)
    tr.key(2.3, "snap", squash=-0.08, eye_open=0.3, armL_up=30, armR_up=30, eye_happy=0.0, eye_tilt=0.6)
    tr.key(2.8, "inout", eye_open=1.0, pupil=1.15, lean=10, squash=0.02, eye_happy=0.0, eye_tilt=0.2, armL_up=10, armR_up=10)
    # (arms ~35 deg up with bent forearms: fully raised, the stubby arms vanish against the body's own orange)
    cheer = S.merge(S.C_CHEER, armL_up=36, armR_up=36, armL_bend=38, armR_bend=38, armL_fwd=0, armR_fwd=0)
    tr.key(3.2, "linear", heading=hd)
    tr.key(3.45, "back", **S.merge(cheer, heading=-14))
    tr.key(dur, "linear", **S.merge(cheer, armL_up=42, armR_up=30))

    def wave(t, p):
        if t > 3.45:
            w = min(1.0, (t - 3.45) / 0.2)
            p["armL_up"] = p.get("armL_up", 0) + 10 * w * math.sin((t - 3.45) * 17)
            p["armR_up"] = p.get("armR_up", 0) + 10 * w * math.sin((t - 3.45) * 17 + 1.6)
    tr.layer(wave)
    tr.layer(anim.hop_arc(3.55, 3.85, 0.12, 0.1))
    tr.layer(anim.hop_arc(3.9, 4.2, 0.12, 0.1))
    tr.layer(anim.hop_arc(4.25, 4.55, 0.12, 0.1))
    tr.layer(anim.hop_arc(4.6, 4.9, 0.12, 0.1))
    tr.layer(anim.blinks(times=[0.4, 2.6], dur=0.14))
    tr_ref = {}

    def eyes_on_star(t, p):
        q = tr_ref.get("st")
        if q is None:
            return
        sp = q.at(t)
        lp = S.look_params((cx, cy), p["heading"], gz + p.get("hop", 0) + 0.57, (sp["x"], sp["y"], sp["z"]))
        if p.get("eye_open", 1) > 0.5:
            p["look_x"], p["look_y"] = lp["look_x"], lp["look_y"]
    tr.layer(eyes_on_star)
    s = W.star()
    s.light_scale = 2.0
    st = Track()
    st.pose(0.0, S.merge(S.S_IDLE, x=sx, y=sy, z=sz + 0.14, heading=-20, glow=1.2, eye_open=1.0, look_y=0.6, squash=-0.1,
                         arms=10, head=-10, roll=0, eye_tilt=0.0, eye_happy=0.0))
    # attempt 1: launch 0.35 -> peak 0.7 -> tumble down 1.05
    tr1 = [(0.35, sz + 0.14), (0.7, sz + 0.75), (1.05, sz + 0.1)]
    st.key(0.3, "in", squash=-0.2, z=sz + 0.12)
    st.key(0.7, "out", z=sz + 0.75, squash=0.15, arms=50, roll=20, x=sx + 0.15)
    st.key(1.05, "in", z=sz + 0.08, roll=-110, arms=30, x=sx + 0.25, eye_open=0.1)
    st.key(1.4, "out", z=sz + 0.12, roll=0, squash=-0.12, eye_open=0.8, x=sx + 0.2, arms=0)
    # attempt 2
    st.key(1.55, "in", squash=-0.22)
    st.key(1.9, "out", z=sz + 0.95, squash=0.15, arms=55, roll=-25, x=sx + 0.05)
    st.key(2.25, "in", z=sz + 0.08, roll=120, x=sx - 0.15, eye_open=0.1)
    st.key(2.6, "out", z=sz + 0.12, roll=0, squash=-0.14, eye_open=0.9, eye_tilt=-0.5, x=sx - 0.1)
    # attempt 3: lift and hover
    st.key(2.85, "in", squash=-0.24, eye_tilt=-0.6)
    st.key(3.4, "back", z=sz + 1.1, squash=0.1, arms=40, roll=0, eye_tilt=0.0, x=sx + 0.1, glow=1.6, eye_happy=0.7)
    st.key(dur, "soft", z=sz + 1.2, arms=35, eye_happy=0.9, glow=1.7, x=sx + 0.2)

    def wob(t, p):
        if t > 3.4:
            p["z"] = p.get("z", 0) + 0.04 * math.sin(t * 5)
            p["roll"] = p.get("roll", 0) + 6 * math.sin(t * 3.7)
    st.layer(wob)
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    tr_ref["st"] = st
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    for t, x in ((1.05, sx + 0.25), (2.25, sx - 0.15)):
        fx.puff(f"Petals{t}", (x, sy, sz + 0.1), t, f0, n=6, spread=0.12, grow=(0.02, 0.07), life=(0.6, 1.0), rise=0.2,
                color=(1.0, 0.8, 0.85), opacity=0.5, seed=int(t * 10))
        fx.sparks(f"Bump{t}", (x, sy, sz + 0.12), t, f0, n=10, speed=(0.5, 1.2), life=(0.2, 0.4), gravity=-2, strength=10,
                  size=0.008, seed=int(t * 20))
    # two-shot from the south, at their eye level: the windmill up the slope behind them
    mid = Vector(((cx + sx) / 2, (cy + sy) / 2, gz + 0.62))
    eye = mid + Vector((0.15, -3.3, 0.05))
    cam = FR.shot_cam("Cam", f0, f1, eye, mid + Vector((0, 0, 0.1)), 30, push=0.06, fstop=4.0, rise=0.08, seed=23,
                      check=False, focus_on=Vector((cx, cy, gz + 0.45)))
    scene.char_lights(c.col, Vector((cx, cy, gz + 0.4)), cam.location, W.P["sun_dir"], rim_col=(1.0, 0.95, 0.85), rim_w=60.0,
                      fill_col=(1.0, 0.9, 0.78), fill_w=60.0)
    sxy = scene.sun_screen(cam, W.P["sun_dir"])
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=80.0, mist_depth=2500.0, bloom=0.3, bloom_thr=0.9,
                          sun_xy=sxy, sun_glow=0.15, sun_size=0.5))
