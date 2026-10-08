"""S12 — INT night. (A) From low behind the wary star: Claude approaches slowly, sets a bowl of water down at a
respectful distance, nudges a folded blanket beside it, and backs away step by step. (B) In bed, Claude peeks over
the quilt edge — just its eyes — at the glow across the room."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP
from lu.anim import Track, CAM_DEFAULT, Path
from lu.claude import DEFAULT as CDEF
from lu.star import DEFAULT as SDEF
from shots import s06 as S6
from shots.s10 import crater_pos, lift_crater, TOWARD
from shots.s06 import bed_pose, quilt_over, face_point, ROLL, RECLINE

T_CUT = 2.85
PEEK_ROLL = -16.0


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(crater=True))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=1.2)
    cp = crater_pos(W)
    lift_crater(W)
    toward = Vector((*TOWARD, 0.0)).normalized()
    s = W.star()
    s.light_scale = 8.0
    hs = math.degrees(math.atan2(toward.x, -toward.y))
    st = Track()
    st.pose(0.0, S.merge(S.S_SCARED, x=cp.x, y=cp.y, z=cp.z + 0.16, heading=hs, curl=30, squash=-0.1, glow=1.1, look_y=0.4,
                        pupil=0.9))
    st.key(1.6, "inout", curl=18, squash=-0.04, pupil=1.05, head=-8, look_y=0.1)
    st.key(dur, "soft", curl=14, look_y=0.3, glow=1.05, head=-10)
    S6.anchor(st, SDEF)
    st.layer(anim.tremble(0.0, 1.4, amp=1.2, freq=15))
    st.layer(anim.blinks(seed=5, t_end=dur))
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # props: bowl held, then placed; blanket nudged
    side = Vector((-toward.y, toward.x, 0.0))
    place_b = cp + toward * 0.62 + side * 0.1          # at a respectful distance, clear of the flour ridge
    place_k = cp + toward * 0.6 - side * 0.3
    c = W.claude()
    bw = HP.bowl()
    S.attach(bw, c, "armR2", Matrix.Translation(Vector((-0.05, -0.47, 0.27))),
             pose=dict(armL_fwd=60, armR_fwd=60, armL_up=0, armR_up=0, armL_curl=20, armR_curl=20))
    bw_down = HP.bowl("BowlDown")
    bw_down.location = place_b
    bk = HP.blanket()
    hc = math.degrees(math.atan2(-toward.x, toward.y))
    far = cp + toward * 1.71            # walk length unchanged (0.73 m) so the cue sheet's footfalls stay in sync
    near = cp + toward * 0.98
    path = Path([(0.0, far.x, far.y), (1.0, near.x, near.y), (1.6, near.x, near.y), (2.8, far.x + 0.15, far.y - 0.1)])
    tr = Track()
    tr.layer(anim.walk(path, stride=0.08, swing=16, knee=18, bob=0.005, sway=1.0, z_fn=lambda x, y: O.z, face=False))
    hold = dict(armL_fwd=60, armR_fwd=60, armL_up=0, armR_up=0, armL_curl=20, armR_curl=20)
    tr.pose(0.0, S.merge(hold, heading=hc, lean=6, eye_open=0.9, look_y=-0.4, pupil=1.0, squash=-0.04))
    tr.key(1.0, "inout", lean=22, armL_up=-35, armR_up=-35, look_y=-0.7)
    tr.key(1.3, "inout", lean=10, armL_up=-30, armR_up=-30, armL_fwd=20, armR_fwd=20, look_y=-0.2, eye_happy=0.25)
    tr.key(1.6, "inout", lean=-2, armL_up=-40, armR_up=-40, armL_fwd=0, armR_fwd=0, eye_happy=0.0, pupil=1.05)
    tr.key(2.8, "linear", lean=-4)
    S6.anchor(tr, CDEF)
    tr.layer(anim.blinks(times=[1.75, 2.4], dur=0.15))
    tr.layer(anim.breathe(0.01, 0.35))
    # B: in bed, the quilt pulled up to its eyes, peeking across the room at the glow (re-posed after the cut)
    PEEK_RECLINE = RECLINE + 14
    bed = bed_pose(W, c, roll=ROLL, recline=PEEK_RECLINE)
    quilt_over(W, top_y=-0.24, roll=ROLL, recline=PEEK_RECLINE, thick=True)
    peek = S.merge(bed, eye_open=0.85, eye_tilt=0.25, look_y=-0.1, look_x=0.75, pupil=1.1, head_turn=16,
                   armL_up=-30, armR_up=-30, squash=-0.04)

    def pose_at(t):
        if t < T_CUT:
            return tr.at(t)
        p = dict(peek)
        u = t - T_CUT
        p["eye_open"] = 0.85 if not (0.62 < u < 0.78) else 0.1
        p["look_x"] = 0.75 + 0.06 * math.sin(u * 2)
        p["squash"] += 0.012 * math.sin(u * 1.4)
        return p
    c.bake(lambda f: pose_at((f - f0) / 24), f0, f1 - 1)
    S.vis_range(bw, f0, f0 + int(1.3 * 24), f0, f1)
    S.vis_range(bw_down, f0 + int(1.3 * 24), f1 + 10, f0, f1)
    # blanket: carried on Claude's head... simpler: it slides in from where Claude nudges it
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = anim.ease("out", (t - 1.35) / 0.4)
        p = place_k + toward * 0.25 * (1 - u)
        bk.location = p + Vector((0, 0, 0.035))
        bk.rotation_euler = (0, 0, math.radians(hc) + 0.3 * (1 - u))
        bk.keyframe_insert("location", frame=f)
        bk.keyframe_insert("rotation_euler", frame=f)
    S.vis_range(bk, f0 + int(1.3 * 24), f1 + 10, f0, f1)
    # cameras. (A) low behind the wary star (a small soft glow at the lower right), Claude approaching head-on
    camA = scene.camera("CamA", lens=30)
    ea = cp - toward * 1.05 + side * 0.6 + Vector((0, 0, 0.66))
    ta = cp + toward * 0.95 + side * 0.2 + Vector((0, 0, 0.36))
    ca = Track(CAM_DEFAULT)
    ca.key(0, cx=ea.x, cy=ea.y, cz=ea.z, tx=ta.x, ty=ta.y, tz=ta.z, lens=28, fstop=2.8, focus=(ta - ea).length + 0.4)
    ca.key(1.3, "soft", tz=ta.z - 0.08, focus=(ta - ea).length - 0.1)
    ca.key(T_CUT, "soft", tz=ta.z - 0.02, focus=(ta - ea).length + 0.3)
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=12)
    # (B) low at the foot of the bed: the quilt edge in the foreground, just the eyes peeking over it
    face, fn = face_point(c, f0 + int(round((T_CUT + 0.5) * 24)))
    camB = scene.camera("CamB", lens=42)
    eb = face + Vector((0.62, -1.55, 0.2))
    tb = face + Vector((0.12, 0.0, -0.08))
    cb = Track(CAM_DEFAULT)
    cb.key(T_CUT, cx=eb.x, cy=eb.y, cz=eb.z, tx=tb.x, ty=tb.y, tz=tb.z, lens=42, fstop=2.8, focus=(face - eb).length,
           roll=PEEK_ROLL)
    e2 = eb + (face - eb).normalized() * 0.12
    cb.key(dur, "soft", cx=e2.x, cy=e2.y, cz=e2.z, tx=tb.x, ty=tb.y, tz=tb.z, lens=44, focus=(face - e2).length,
           roll=PEEK_ROLL)
    cb.layer(lambda t, p: p.update(shake=0.15))
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=22)
    # the star's glow from across the room on the peeking face (B only; the automatic face key serves A)
    import bpy
    lg = bpy.data.lights.new("PeekGlow", "AREA")
    lg.color = (1.0, 0.66, 0.36)
    lg.size = 0.8
    lg.use_shadow = False
    og = bpy.data.objects.new("PeekGlow", lg)
    bpy.context.scene.collection.objects.link(og)
    scene.look_at(og, face + Vector((1.3, 0.9, 0.45)), face)
    og.light_linking.receiver_collection = c.col
    for f in (f0, f0 + int(T_CUT * 24) - 1):
        lg.energy = 0.0
        lg.keyframe_insert("energy", frame=f)
    lg.energy = 30.0
    lg.keyframe_insert("energy", frame=f0 + int(T_CUT * 24))
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    __import__("bpy").context.scene.camera = camA
    return dict(post=dict(haze_amt=0.0, bloom=0.7, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.45))
