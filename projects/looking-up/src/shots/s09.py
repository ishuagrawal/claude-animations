"""S09 — INT night: armed with a broom, Claude creeps toward the pulsing glow behind the flour sacks —
hunched, trembling, tiny pupils. Flour dust hangs in the light. A flare: Claude flinches back, then edges on."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP
from lu.anim import Track, CAM_DEFAULT, Path
from lu.claude import DEFAULT as CDEF
from shots import s06 as S6


def star_glow(W, f0, f1, base=40.0, seed=0, flares=()):
    """Pulsing glow from the crater (the star is hidden behind the sacks / in the flour)."""
    O = W.origin
    pile = W.I["flour"]["pos"]
    p = O + Vector((pile.x + 0.55, pile.y - 0.55, 0.3))
    l = scene.point("CraterGlow", p, (1.0, 0.68, 0.32), base, 0.15)
    for f in range(f0, f1):
        t = (f - f0) / 24
        e = base * (1 + 0.25 * math.sin(t * 7.3 + seed) + 0.15 * math.sin(t * 17.1))
        for (tf, amp) in flares:
            u = (t - tf) / 0.4
            if 0 <= u <= 1:
                e += amp * math.sin(math.pi * u) ** 2
        l.data.energy = e
        l.data.keyframe_insert("energy", frame=f)
    return l, p


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(crater=True))
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=1.0)
    T_FLARE = 2.4
    gl, gp = star_glow(W, f0, f1, base=36.0, flares=((T_FLARE, 70.0),))
    fx.motes("FlourAir", L(-0.85, 0.75, 0.7), (1.3, 1.3, 1.0), n=110, f0=f0, f1=f1, drift=(0.0, 0.0, -0.03),
             color=(1.0, 0.85, 0.6), strength=1.0, seed=3)
    c = W.claude()
    br = HP.broom()
    # broom gripped in the right hand and held out in front, straw end first (prodding the unknown), beside the
    # face rather than across it - the straw tip that edges into S10
    creep_pose = dict(armL_up=30, armR_up=25, armL_fwd=60, armR_fwd=70, armR_bend=10)
    br.scale = (0.8, 0.8, 0.8)
    bd = Vector((-0.18, -0.95, -0.2)).normalized()
    grip = Vector((-0.52, -0.2, 0.55))
    S.attach(br, c, "armR2", Matrix.Translation(grip + bd * 0.36) @ bd.to_track_quat("-Z", "Y").to_matrix().to_4x4()
             @ Matrix.Diagonal((0.8, 0.8, 0.8, 1.0)), pose=creep_pose)
    path = Path([(0.0, O.x - 1.75, O.y - 0.45), (1.9, O.x - 1.3, O.y + 0.25), (2.4, O.x - 1.22, O.y + 0.36),
                 (2.9, O.x - 1.3, O.y + 0.25), (dur, O.x - 0.95, O.y + 0.82)], ease_="inout")
    tr = Track()
    tr.layer(anim.walk(path, stride=0.07, swing=18, knee=22, bob=0.006, sway=1.5, z_fn=lambda x, y: O.z, face=False))
    # always faces the glow - including the flinch back-step (it retreats without turning its back)
    tr.layer(lambda t, p: p.update(heading=S.heading_to((p["x"], p["y"]), (gp.x, gp.y))))
    creep = S.merge(S.C_FEAR, armL_up=30, armR_up=25, armL_fwd=60, armR_fwd=70, armR_bend=10, lean=6, squash=-0.1,
                    eye_open=1.0, pupil=0.7, eye_tilt=0.3)
    tr.pose(0.0, creep)
    tr.key(T_FLARE - 0.05, "linear", pupil=0.72)
    tr.key(T_FLARE + 0.12, "snap", lean=-16, squash=-0.16, pupil=0.55, armR_up=50, armR_fwd=40, armL_up=50)
    tr.key(T_FLARE + 0.9, "inout", lean=4, squash=-0.1, pupil=0.68, armR_up=25, armR_fwd=70, armL_up=30)
    tr.key(dur, "linear", lean=8, pupil=0.7)
    S6.anchor(tr, CDEF)
    tr.layer(anim.tremble(0.0, dur, amp=1.2, freq=14, ramp=0.3))
    tr.layer(anim.blinks(times=[0.9, 3.6], dur=0.12))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # from just beyond the glowing crater (it sits soft and bright in the near foreground), looking back at Claude
    # creeping toward us: face lit from below by the pulsing glow, broom raised, flour motes hanging in the light
    cam = scene.camera(lens=33)
    ct = Track(CAM_DEFAULT)
    a = L(0.45, 2.15, 0.62)
    pe = path.pos(dur)
    ps = path.pos(0.0)
    t0_ = Vector((ps[0], ps[1], O.z + 0.42))
    t1_ = Vector((pe[0], pe[1], O.z + 0.38))
    ct.key(0, cx=a.x, cy=a.y, cz=a.z, tx=t0_.x, ty=t0_.y, tz=t0_.z, lens=33, fstop=2.8, focus=(t0_ - a).length)
    pm = path.pos(T_FLARE)
    tm = Vector((pm[0], pm[1], O.z + 0.4))
    ct.key(T_FLARE, "inout", tx=tm.x, ty=tm.y, tz=tm.z, lens=35, focus=(tm - a).length)
    b = a + Vector((0.04, 0.03, 0.0))
    ct.key(dur, "inout", cx=b.x, cy=b.y, cz=b.z, tx=t1_.x, ty=t1_.y, tz=t1_.z, lens=33, focus=(t1_ - b).length)
    ct.layer(lambda t, p: p.update(shake=0.4 + 2.5 * max(0, 1 - abs(t - T_FLARE - 0.1) / 0.3)))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=9)
    scene.char_lights(c.col, t1_, a, (0.6, 0.9, 0.1), rim_col=(0.55, 0.62, 0.9), rim_w=10.0)
    return dict(face_key=28.0,
                post=dict(haze_amt=0.0, bloom=0.65, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.5))
