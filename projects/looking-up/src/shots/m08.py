"""M08 — EXT night, the gallery. (A) Claude and the star side by side at the rail, the telescope beside them;
Claude points up — star by star, faint lines join into the Claude-shaped constellation. (B) Close on the star: its
eyes travel to the empty eye of the constellation and rest there — a long, quiet look (longing). (C) Claude notices,
looks at the star, then up at the gap too.

Staging: Claude sits on the gallery's top rail, legs dangling, the star perched beside it. (A) low from behind on the
gallery floor: their silhouettes and Claude's raised arm against the sky, the constellation (lower in the sky this
season) drawing itself above them. (B) and (C) are reverse angles from out beyond the rail: they look up past the
lens, so the faces read, lit by the star's own glow, the dark tower behind."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, props, windmill, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_B = 3.3
T_C = 5.1
SKY_C = (60.0, 44.0)     # the constellation's place in tonight's sky (az, el)


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=20.0))
    O = W.origin
    dur = (f1 - f0) / 24
    K = props.constellation(center=SKY_C, origin=(O.x, O.y, 0), lines=0.0)
    # lines light up one by one (0.6 .. 2.9 s), following Claude's finger
    n = len(K["lines"])
    for i, ln in enumerate(K["lines"]):
        t_on = 0.6 + 2.3 * i / n
        for f in range(f0, f1, 2):
            t = (f - f0) / 24
            ln["line"] = 0.65 * anim.ease("out", (t - t_on) / 0.35)
            ln.keyframe_insert('["line"]', frame=f)
    # Claude sits on the gallery's top rail, legs dangling out over the drop, facing the constellation;
    # the star perches on the rail at its right
    fz = O.z + windmill.GALLERY_Z + 0.17
    seat = 0.98                                        # top of the upper rail above the gallery floor
    a = math.radians(70)
    out = Vector((math.cos(a), math.sin(a), 0))
    right = Vector((out.y, -out.x, 0))                 # Claude's right when facing out
    r_rail = windmill.BASE_R / math.cos(windmill.K) + 0.9 - 0.07
    cpos = Vector((O.x, O.y, fz)) + out * r_rail
    hd = math.degrees(math.atan2(out.x, -out.y))
    c_dir = props.const_dir(0, 0, SKY_C)
    eye_dir = props.const_dir(5.2, 2.6, SKY_C)          # the missing eye
    c = W.claude()
    tr = Track()
    sit = S.merge(S.C_SIT(seat), dict(leg0_swing=70, leg1_swing=70, leg2_swing=70, leg3_swing=70, leg0_knee=-30,
                                      leg1_knee=-30, leg2_knee=-30, leg3_knee=-30))
    tr.pose(0.0, S.merge(sit, S.C_WONDER, x=cpos.x, y=cpos.y, z=fz, heading=hd, look_y=1.0, head_nod=-10, lean=-12,
                         armL_up=-30, armR_up=-30, eye_tilt=0.0, eye_happy=0.3, roll=0, armR_fwd=0, armR_bend=0,
                         head_turn=0, look_x=0.0))
    tr.key(0.5, "inout", armR_up=72, armR_fwd=2, armR_bend=-18, lean=-15, eye_happy=0.45, eye_open=0.9, roll=-8,
           armL_up=-10)

    def point(t, p):
        # the finger traces the figure, star to star; the dangling legs swing a little
        if 0.5 < t < 3.0:
            w = min(1.0, (t - 0.5) / 0.3, (3.0 - t) / 0.3)
            p["armR_fwd"] = p.get("armR_fwd", 0) + 14 * w * math.sin((t - 0.5) * 2.6)
            p["armR_up"] = p.get("armR_up", 0) + 9 * w * math.sin((t - 0.5) * 3.4)
            p["twist"] = p.get("twist", 0) + 6 * w * math.sin((t - 0.5) * 2.6)
        for k in range(4):
            p[f"leg{k}_knee"] = p.get(f"leg{k}_knee", 0) + 9 * math.sin(t * 2.4 + (0 if k % 2 else math.pi))
    tr.layer(point)
    tr.key(3.0, "inout", armR_up=-30, armR_fwd=0, armR_bend=0, lean=-12, eye_happy=0.35, roll=0)
    # C: notices the star has gone quiet; looks at it, then up at the gap too
    tr.key(T_C + 0.15, "linear", look_x=0.0, look_y=1.0, head_turn=0, eye_happy=0.3)
    tr.key(T_C + 0.55, "inout", look_x=-0.95, look_y=0.2, head_turn=-16, eye_happy=0.0, eye_open=0.95, lean=-5,
           head_nod=-2, eye_tilt=0.15)
    tr.key(T_C + 1.15, "inout", look_x=-0.2, look_y=1.0, head_turn=-4, eye_tilt=0.45, eye_open=0.85, lean=-11, head_nod=-8)
    tr.key(dur, "soft", eye_tilt=0.5, eye_open=0.82)
    tr.layer(anim.blinks(times=[2.2, T_C + 0.35], dur=0.15))
    tr.layer(anim.breathe(0.012, 0.3))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    s = W.star()
    s.light_scale = 11.0
    sp = cpos + right * 1.22 + Vector((0, 0, seat + 0.2))
    lk_c = S.look_params((sp.x, sp.y), hd, sp.z, sp + c_dir * 50)
    lk_e = S.look_params((sp.x, sp.y), hd, sp.z, sp + eye_dir * 50)
    st = Track()
    st.pose(0.0, S.merge(S.S_JOY, x=sp.x, y=sp.y, z=sp.z, heading=hd, pitch=20, head=-16, glow=1.3, legs=-15,
                         look_x=lk_c["look_x"], look_y=0.9, eye_tilt=0.0, droop=0, roll=0, pupil=1.0, eye_open=1.0))
    st.key(3.3, "linear", eye_happy=0.9, arms=45)
    # B: the joy fades into a long look at the empty eye
    st.key(3.55, "inout", look_x=lk_c["look_x"] - 0.6, look_y=0.3, eye_happy=0.5, roll=0, pupil=1.0)
    # the smile fades as the eyes travel up across the figure to the empty eye... and stay there
    st.key(4.2, "inout", **S.merge(S.S_LONGING, look_x=lk_e["look_x"] + 0.65, look_y=0.72, head=-18, glow=1.05, arms=10,
                                   legs=-15, squash=0.0, eye_happy=0.0, eye_open=1.0, pupil=1.02, roll=-8, z=sp.z + 0.04,
                                   pitch=34))
    st.key(4.7, "inout", eye_open=0.92, eye_tilt=0.55, droop=8, glow=0.98, arms=6)
    st.key(T_C, "linear", eye_tilt=0.6)
    st.key(dur, "soft", eye_tilt=0.62, droop=12, glow=0.92, eye_open=0.86)

    def hover(t, p):
        p["z"] = p.get("z", 0) + 0.015 * math.sin(t * 2.0)
    st.layer(hover)
    st.layer(anim.blinks(times=[1.4, 4.75], dur=0.22))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # ---------------------------------------------------------------- cameras
    head = cpos + Vector((0, 0, seat + 0.45))
    mid = (head + sp) / 2
    # A: low behind them on the gallery floor, looking up past their silhouettes to the sky
    eA = cpos - out * 1.25 + right * 0.9 + Vector((0, 0, 0.3))
    to_c = (head + Vector((0, 0, -0.25)) - eA).normalized()
    va = (to_c * 0.45 + props.const_dir(0, -4, SKY_C) * 0.55).normalized()
    tA = eA + va * 10
    tA2 = eA + (to_c * 0.3 + ((eye_dir + c_dir) / 2) * 0.7).normalized() * 10
    camA = scene.camera("CamA", lens=18)
    ca = Track(CAM_DEFAULT)
    ca.key(0, cx=eA.x, cy=eA.y, cz=eA.z, tx=tA.x, ty=tA.y, tz=tA.z, lens=18, fstop=0, shake=0.12)
    ca.key(2.4, "soft", tx=tA.x, ty=tA.y, tz=tA.z, lens=18)
    ca.key(T_B, "inout", tx=tA2.x, ty=tA2.y, tz=tA2.z - 1.2, lens=20, shake=0.12)
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=28)
    # B: close on the star from out beyond the rail (it looks up past the lens)
    eB = sp + out * 1.45 - right * 0.02 + Vector((0, 0, -0.04))
    camB = FR.shot_cam("CamB", f0, f1, eB, sp - right * 0.15 + Vector((0, 0, 0.02)), 50, push=0.08, fstop=2.4, seed=29,
                       check=False, focus_on=sp)
    # C: the two of them on the rail, from out in front
    eC = mid + out * 2.0 + right * 0.15 + Vector((0, 0, 0.18))
    camC = FR.shot_cam("CamC", f0, f1, eC, mid + (head - sp) * 0.14 + Vector((0, 0, -0.06)), 30, push=0.05, fstop=2.8, seed=30,
                       check=False)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_B * 24))
    S.cut(camC, f0 + int(T_C * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, head + Vector((0, 0, -0.1)), eC, (0.3, 0.8, 0.4), rim_col=(0.6, 0.75, 1.0), rim_w=16.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.4, mist_start=60.0, mist_depth=2000.0, bloom=0.6, bloom_thr=0.6))
