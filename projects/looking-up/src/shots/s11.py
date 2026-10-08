"""S11 — INT night, side two-shot: Claude sets the broom down, leans in and slowly reaches out a curious arm…
the star flares and HISSES sparks — Claude yanks back, shakes its singed arm (a curl of smoke), squeezes its eyes,
then gives the star a wounded look. The star huffs, still bristling."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as CDEF
from lu.star import DEFAULT as SDEF
from shots import s06 as S6
from shots.s10 import crater_pos, lift_crater, TOWARD

T_HISS = 2.05
CHEAT_C, CHEAT_S = -40.0, 45.0      # heading cheats (deg) that open both faces toward the camera


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(crater=True))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=1.0)
    cp = crater_pos(W)
    lift_crater(W)
    toward = Vector((*TOWARD, 0.0)).normalized()
    cpos = cp + toward * 0.7
    near = cp + toward * 0.56          # the careful step in
    back = cp + toward * 0.84          # where the yank lands it
    # --- star
    s = W.star()
    s.light_scale = 10.0
    hs = math.degrees(math.atan2(toward.x, -toward.y)) + CHEAT_S       # faces Claude, cheated open to camera
    st = Track()
    st.pose(0.0, S.merge(S.S_SCARED, x=cp.x, y=cp.y, z=cp.z + 0.16, heading=hs, curl=40, squash=-0.15, glow=1.5,
                        look_y=0.5, look_x=-0.55, pupil=0.85))
    st.key(1.5, "inout", look_y=0.3, look_x=-0.35, pupil=0.95)
    st.key(T_HISS - 0.08, "in", squash=-0.2, curl=48, glow=1.4, eye_tilt=0.0, arms=0.0, legs=0.0, eye_open=1.0)
    st.key(T_HISS + 0.1, "snap", **S.merge(S.S_ANGRY, curl=-20, squash=0.2, glow=3.6, arms=-25, legs=10))
    st.key(T_HISS + 0.7, "out", curl=10, squash=0.05, glow=2.0, eye_tilt=-0.6, eye_open=0.6)
    st.key(dur, "soft", curl=22, squash=-0.06, glow=1.6, eye_tilt=-0.3, eye_open=0.75, look_y=0.45)
    S6.anchor(st, SDEF)
    st.layer(anim.tremble(0.0, dur, amp=1.8, freq=16))
    st.layer(anim.blinks(times=[0.8], dur=0.14))
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    fx.sparks("Hiss", cp + Vector((0, 0, 0.18)), T_HISS, f0, n=60, speed=(1.2, 3.0), life=(0.25, 0.6), gravity=-2.5, up=0.5,
              strength=35, size=0.012, seed=21, cone=(toward.x, toward.y, 0.4))
    # --- Claude
    c = W.claude()
    br = HP.broom()
    br.matrix_world = Matrix.Translation(cpos + Vector((-0.35, 0.15, 0.03))) @ Matrix.Rotation(math.radians(85), 4, "Y") @ \
        Matrix.Rotation(math.radians(30), 4, "Z")
    hc = math.degrees(math.atan2(-toward.x, toward.y)) + CHEAT_C       # faces the star, cheated open to camera
    tr = Track()
    base = S.merge(dict(x=cpos.x, y=cpos.y, z=O.z, heading=hc), S.C_CURIOUS, squash=-0.06, lean=4, pupil=0.95,
                   look_x=0.8, head_turn=4)
    tr.pose(0.0, base, armL_up=-30, armR_up=-30)
    # lean in, reach out the near (right) arm, silhouetted against the glow (slow, careful: the arm leads)
    # it turns toward the star as it reaches (the near, right arm swings out, silhouetted against the glow); the
    # yank spins it back open to us for the singed-arm shake and the wounded look
    tr.key(0.7, "inout", x=cpos.x, y=cpos.y, lean=10, head_tilt=10, pupil=1.12, armR_fwd=40, armR_up=8)
    tr.key(1.9, "inout", x=near.x, y=near.y, heading=hc + 30, lean=24, head_turn=-6, armR_fwd=88, armR_curl=15,
           armR_up=10, armR_bend=-8, pupil=1.15, head_tilt=8, look_y=-0.6, look_x=0.9, squash=0.0)
    # yank back!
    tr.key(T_HISS + 0.18, "snap", x=back.x, y=back.y, heading=hc - 12, lean=-20, head_turn=4, squash=-0.14,
           armR_fwd=-20, armR_curl=0, armR_up=72, armR_bend=40, eye_open=0.05, eye_happy=0.0, pupil=0.8, head_tilt=-6)
    # shake the singed arm
    tr.key(T_HISS + 0.45, "out", lean=-8, squash=0.0, eye_tilt=0.0)
    tr.key(T_HISS + 1.25, "linear", armR_up=50, slump=0)
    tr.key(T_HISS + 1.55, "inout", heading=hc - 6, armR_up=-20, armR_fwd=10, armR_bend=0, eye_open=0.7, eye_tilt=0.55,
           look_y=-0.55, look_x=0.85, lean=-4, head_turn=4, head_tilt=-12)
    tr.key(dur, "soft", eye_open=0.65, eye_tilt=0.6, slump=6)

    def shake(t, p):
        if T_HISS + 0.45 <= t <= T_HISS + 1.3:
            p["armR_up"] = p.get("armR_up", 0) + 22 * math.sin((t - T_HISS) * 38)
            p["armR_bend"] = p.get("armR_bend", 0) + 25 * math.sin((t - T_HISS) * 38 + 1)
            p["roll"] = p.get("roll", 0) + 3 * math.sin((t - T_HISS) * 38)
    tr.layer(shake)
    tr.layer(anim.blinks(times=[0.5], dur=0.15))
    S6.anchor(tr, CDEF)
    tr.layer(anim.breathe(0.012, 0.4))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # smoke curl from the singed arm tip (roughly where the right arm ends up, raised at its side)
    hr = math.radians(hc)
    c_left = Vector((math.cos(hr), math.sin(hr), 0.0))
    arm_tip = back - c_left * 0.5 + Vector((0.0, 0.0, 0.75))
    fx.puff("ArmSmoke", arm_tip, T_HISS + 0.3, f0, n=6, spread=0.03, grow=(0.02, 0.1), life=(1.2, 1.8), rise=0.25,
            color=(0.45, 0.42, 0.42), opacity=0.35, seed=22)
    # side two-shot, both cheated open to the lens: Claude left (three-quarter), star right (three-quarter)
    side = Vector((-toward.y, toward.x, 0.0))
    mid = (cp + cpos) / 2
    cdir = side
    eye = mid + cdir * 2.15 + Vector((0, 0, 0.62))
    tg = mid + Vector((0, 0, 0.3)) - side * 0.05
    cam = scene.camera(lens=32)
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=eye.x, cy=eye.y, cz=eye.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=32, fstop=3.2, focus=(tg - eye).length)
    e2 = eye - cdir * 0.15 + Vector((0, 0, -0.02))
    ct.key(dur, "soft", cx=e2.x, cy=e2.y, cz=e2.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=34, focus=(tg - e2).length)
    ct.layer(lambda t, p: p.update(shake=0.3 + 3.0 * max(0, 1 - abs(t - T_HISS - 0.05) / 0.25)))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=11)
    return dict(post=dict(haze_amt=0.0, bloom=0.8, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.45))
