"""M11 — EXT autumn golden hour, the lookout at the cliff edge beside the lone pine: Claude and the star sit side by
side above the golden sea of clouds. (A) Wide from behind: two small silhouettes against the glow. (B) Closer, from the
side: the star leans its head against Claude; Claude's eyes soften and it tilts its head onto the star. Happiest."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_B = 3.0


def make(f0, f1):
    W = world.World("ext", "golden", season="autumn", sun_dir=(0.25, -0.95, 0.12),
                    windmill_state=dict(sails_angle=5.0))
    O = W.origin
    dur = (f1 - f0) / 24
    lx, ly = world.LOOKOUT
    gz = W.ground(lx, ly)
    face_dir = Vector((0.25, -0.95, 0)).normalized()          # toward the sun / clouds
    from shots.m10 import mow
    mow(Vector((lx, ly, gz)) - face_dir * 3.2, 3.6)
    W.grass_patch((lx, ly + 1.2), 3.6, 18000, blade=(0.06, 0.17), flowers=0.04, seed=111)
    hd = math.degrees(math.atan2(face_dir.x, -face_dir.y))
    side = Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0))
    cpos = Vector((lx, ly, gz))
    c = W.claude()
    tr = Track()
    sit = S.C_SIT(0.0)
    tr.pose(0.0, S.merge(sit, x=cpos.x, y=cpos.y, z=gz, heading=hd, eye_open=0.85, look_y=0.1, armL_up=-35, armR_up=-35,
                         slump=4))
    tr.key(T_B + 0.6, "linear", look_x=0.0)
    tr.key(T_B + 1.2, "inout", look_x=-0.5, look_y=-0.2, head_turn=-10, eye_happy=0.4)
    tr.key(T_B + 1.9, "inout", head_tilt=-16, roll=-6, eye_happy=0.85, eye_open=0.6, look_x=-0.2)
    tr.key(dur, "soft", head_tilt=-18, roll=-7, eye_happy=0.9, eye_open=0.5)
    tr.layer(anim.breathe(0.012, 0.25))
    tr.layer(anim.blinks(times=[1.2, T_B + 0.4], dur=0.18))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    s = W.star()
    s.light_scale = 2.0
    sp = cpos - side * 0.6 + Vector((0, 0, 0.2))
    st = Track()
    st.pose(0.0, S.merge(S.S_IDLE, x=sp.x, y=sp.y, z=sp.z, heading=hd, glow=1.2, eye_open=0.9, legs=-20, look_y=0.1))
    st.key(T_B + 0.5, "linear", roll=0)
    st.key(T_B + 1.3, "inout", roll=22, x=sp.x + side.x * 0.12, y=sp.y + side.y * 0.12, eye_happy=0.8, eye_open=0.6,
           look_x=0.5, glow=1.45, curl=8)
    st.key(dur, "soft", roll=24, eye_happy=0.9, glow=1.5)
    st.layer(anim.blinks(times=[0.8, 2.3], dur=0.16))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # A: wide from behind and above, the pair small against the golden sea of clouds
    mid = (cpos + sp) / 2 + Vector((0, 0, 0.3))
    eA = mid - face_dir * 5.2 - side * 0.25 + Vector((0, 0, 1.25))
    camA = FR.shot_cam("CamA", f0, f1, eA, mid + face_dir * 9 + Vector((0, 0, -0.75)), 30, push=0.06, fstop=5.6, seed=33,
                       focus_on=mid, check=False)
    # B: closer, from the front on the star's side: both faces 3/4 to camera, the star nearest
    eB = mid - side * 1.15 + face_dir * 1.6 + Vector((0, 0, 0.08))
    camB = FR.shot_cam("CamB", f0, f1, eB, mid + side * 0.05 + Vector((0, 0, -0.04)), 40, push=0.07, fstop=2.8, seed=34,
                       check=False, focus_on=mid)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_B * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.4)), eB, W.P["sun_dir"], rim_col=(1.0, 0.68, 0.38), rim_w=70.0)
    sxy = scene.sun_screen(camA, W.P["sun_dir"])
    return dict(post=dict(haze=(0.95, 0.62, 0.38), haze_warm=W.P["haze"], haze_amt=0.4, mist_start=60.0, mist_depth=2500.0,
                          bloom=0.5, bloom_thr=0.75, sun_xy=sxy, sun_glow=0.7, sun_size=0.75, sat=1.06,
                          gain=(1.06, 0.98, 0.84), gamma=(0.97, 0.98, 1.02)))
