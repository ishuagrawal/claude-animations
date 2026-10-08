"""S13 — INT dawn. (A) Morning light slants through the window across the floor. The little star has crept to the
stove in the night and lies curled asleep on the folded blanket, glowing softly as it breathes; the water bowl
beside it. (B) Claude wakes, turns its head toward it — and its eyes soften into a gentle smile. First trust."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as CDEF
from lu.star import DEFAULT as SDEF
from shots import s06 as S6
from shots.s06 import bed_pose, quilt_over, face_point, ROLL, RECLINE

T_CUT = 2.4


def stove_spot(W, d=0.55):
    st = W.I["stove"]
    return W.origin + st["pos"] + st["front"] * d


def make(f0, f1):
    W = world.World("int", "golden", sun_dir=(0.62, -0.66, 0.2), interior_state=dict(crater=True))
    from shots.s10 import lift_crater
    lift_crater(W)
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 1.0)
    __import__("lu.sky", fromlist=["x"]).interior_mode("day", world_e=0.02)
    W.practicals(stove=2.0, fill=3.0)
    spot = stove_spot(W)
    bk = HP.blanket()
    bk.location = spot + Vector((0, 0, 0.035))
    bk.rotation_euler = (0, 0, 0.6)
    bw = HP.bowl()
    bw.location = spot + Vector((0.32, -0.28, 0.0))
    s = W.star()
    s.light_scale = 4.0
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=spot.x, y=spot.y, z=spot.z + 0.12, heading=25, pitch=-62, roll=8, glow=0.7))

    def breathe_glow(t, p):
        p["glow"] = p.get("glow", 0.7) * (1 + 0.18 * math.sin(t * 2.1))
        p["squash"] = p.get("squash", 0) + 0.03 * math.sin(t * 2.1)
    S6.anchor(st, SDEF)
    st.layer(breathe_glow)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # light shaft through the front window + dust motes
    win = O + Vector((2.1, -2.1, 1.15))
    hit = spot + Vector((0.6, -0.4, 0.0))
    fx.beam("DawnBeam", win, hit, 0.32, 0.8, color=(1.0, 0.78, 0.5), strength=0.22)
    fx.motes("DawnMotes", (win + hit) / 2, (1.6, 1.6, 1.2), n=260, f0=f0, f1=f1, drift=(0.01, 0.0, 0.006), strength=3.5, seed=8)
    # Claude in bed (same bed set-up as S06/S08: reclined on the pillow, turned a little toward the room)
    c = W.claude()
    quilt_over(W, top_y=-0.15, roll=ROLL, recline=RECLINE, thick=True)
    bed = bed_pose(W, c, roll=ROLL, recline=RECLINE)
    tr = Track()
    tr.pose(0.0, S.merge(bed, S.C_SLEEP, pupil=1.25, head_tilt=-4))
    tr.key(T_CUT + 0.2, "linear", eye_open=0.0, head_turn=0, head_tilt=-4)
    # stirs, blinks awake (two heavy blinks)
    tr.key(T_CUT + 0.5, "inout", eye_open=0.4, pupil=1.15, head_tilt=-2)
    tr.key(T_CUT + 0.7, "linear", eye_open=0.15)
    tr.key(T_CUT + 0.95, "inout", eye_open=0.75, look_x=0.0, look_y=0.0)
    # turns its head toward the stove, sees the sleeping star... a beat of surprise, then the eyes soften
    tr.key(T_CUT + 1.4, "inout", head_turn=6, look_x=1.0, look_y=0.45, eye_open=1.0, pupil=1.15, eye_happy=0.0,
           eye_tilt=0.0)
    tr.key(T_CUT + 2.0, "inout", eye_happy=0.55, eye_open=0.8, pupil=1.05, head_tilt=-8, eye_tilt=0.15)
    tr.key(dur, "soft", eye_happy=0.68, head_tilt=-9, look_x=0.95, head_turn=7)
    S6.anchor(tr, CDEF)
    tr.layer(anim.breathe(0.015, 0.25))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # (A) looking down across the sunlit floor: the star curled asleep on its blanket by the stove, the water bowl
    # beside it (the spilled flour of last night at the right)
    camA = scene.camera("CamA", lens=32)
    ea = spot + Vector((0.4, -1.65, 0.95))
    ta = spot + Vector((0.12, -0.1, 0.17))
    ca = Track(CAM_DEFAULT)
    ca.key(0, cx=ea.x, cy=ea.y, cz=ea.z, tx=ta.x, ty=ta.y, tz=ta.z, lens=35, fstop=2.8, focus=(ta - ea).length)
    e2 = ea + (ta - ea).normalized() * 0.25
    ca.key(T_CUT, "soft", cx=e2.x, cy=e2.y, cz=e2.z - 0.03, lens=38, focus=(ta - e2).length)
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=14)
    # (B) from the foot of the bed (as S06): Claude wakes; the stove glows in the background where the star sleeps
    face, fn = face_point(c, f0 + int(round(T_CUT * 24)))
    camB = scene.camera("CamB", lens=32)
    d0 = Vector((0.22, -0.7, 0.68)).normalized()
    eb = face + d0 * 1.75
    tb = face + Vector((0.0, 0.05, 0.02)) + Vector((0.3, 0, 0))
    eb1 = face + d0 * 1.3
    cb = Track(CAM_DEFAULT)
    cb.key(T_CUT, cx=eb.x, cy=eb.y, cz=eb.z, tx=tb.x, ty=tb.y, tz=tb.z, lens=32, fstop=2.8, focus=(face - eb).length,
           roll=-3)
    cb.key(dur, "soft", cx=eb1.x, cy=eb1.y, cz=eb1.z, tx=tb.x, ty=tb.y, tz=tb.z, lens=36, fstop=2.8,
           focus=(face - eb1).length, roll=-3)
    cb.layer(lambda t, p: p.update(shake=0.12))
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=13)
    tb = O + Vector((W.I["bed"]["pos"][0], W.I["bed"]["pos"][1], 0.95))
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    __import__("bpy").context.scene.camera = camA
    scene.char_lights(c.col, face, eb, (0.62, -0.66, 0.2), rim_col=(1.0, 0.8, 0.55), rim_w=14.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.6, bloom_thr=0.7, kuw_near=3, kuw_far=4, vignette=0.35,
                          lift=(1.02, 1.0, 0.98)))
