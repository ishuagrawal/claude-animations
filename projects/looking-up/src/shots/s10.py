"""S10 — INT night: the reveal. In a crater of spilled flour sits a tiny living star — trembling, glow
flickering, wisps of smoke. It looks up (at Claude, off-screen), eyes huge, and shrinks into itself. The broom's
straw tip edges into frame."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP
from lu.anim import Track, CAM_DEFAULT
from lu.star import DEFAULT as SDEF
from shots import s06 as S6


def crater_pos(W):
    pile = W.I["flour"]["pos"]
    return W.origin + Vector((pile.x + 0.55, pile.y - 0.55, 0.0))


# where Claude stands relative to the crater: front-left, the side it crept in from in S09
TOWARD = (-0.61, -0.79)


def lift_crater(W, dz=0.03):
    """The crater's central dip sinks below the floor planks (wood shows through under the star); sit it on top."""
    cr = W.I.get("crater") if W.I else None
    if cr is not None:
        cr.location.z += dz


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(crater=True))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=0.8)
    cp = crater_pos(W)
    lift_crater(W)
    s = W.star()
    s.light_scale = 4.5
    toward = Vector((*TOWARD, 0.0)).normalized()         # where Claude stands (front-left of the crater)
    h = math.degrees(math.atan2(toward.x, -toward.y))
    tr = Track()
    base = S.merge(S.S_SCARED, x=cp.x, y=cp.y, z=cp.z + 0.16, heading=h, pitch=-8, glow=1.0, eye_open=0.9, look_y=-0.4)
    tr.pose(0.0, base)
    tr.key(1.4, "inout", look_y=-0.2, look_x=0.2, head=-4)
    # notices the looming figure: looks up, eyes widen, shrinks
    tr.key(2.0, "back", look_y=0.85, look_x=0.0, pupil=1.15, eye_open=1.0, head=-18, curl=26, squash=0.06, glow=1.25)
    tr.key(2.6, "inout", curl=44, squash=-0.18, pupil=0.85, glow=1.05, droop=18, look_y=0.8)
    tr.key(dur, "linear", curl=46, squash=-0.19, pupil=0.82)
    S6.anchor(tr, SDEF)
    tr.layer(anim.tremble(0.0, dur, amp=2.5, freq=17, ramp=0.2))

    def flicker(t, p):
        p["glow"] = p.get("glow", 1.0) * (1 + 0.12 * math.sin(t * 31) + 0.08 * math.sin(t * 13.7))
    tr.layer(flicker)
    tr.layer(anim.blinks(times=[0.6, 1.25], dur=0.14))
    s.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    fx.puff("StarSmoke", cp + Vector((0, 0, 0.25)), 0.0, f0, n=5, spread=0.06, grow=(0.03, 0.14), life=(2.5, 3.6), rise=0.12,
            color=(0.55, 0.5, 0.48), opacity=0.25, seed=12)
    fx.motes("FlourAir2", cp + Vector((0.0, 0.0, 0.32)), (0.8, 0.8, 0.5), n=70, f0=f0, f1=f1, drift=(0, 0, -0.02),
             strength=1.2, seed=6)
    side = Vector((-toward.y, toward.x, 0.0))            # screen-right, seen from Claude's side of the crater
    # broom straw edges into frame from the lower right (held by unseen Claude, behind the camera)
    br = HP.broom()
    hdir = (toward * 0.45 + side * 0.75 + Vector((0, 0, 0.5))).normalized()
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = anim.ease("inout", (t - 2.3) / 1.6)
        tip = cp + toward * (0.5 - 0.2 * u) + side * (0.36 - 0.16 * u) + Vector((0, 0, 0.24 - 0.08 * u))
        tip += side * 0.004 * math.sin(t * 40)
        q = (-hdir).to_track_quat("-Z", "Y").to_matrix().to_4x4()
        br.matrix_world = Matrix.Translation(tip + hdir * 0.845 * 0.8) @ q @ Matrix.Diagonal((0.8, 0.8, 0.8, 1.0))
        br.keyframe_insert("location", frame=f)
        br.keyframe_insert("rotation_euler", frame=f)
        br.keyframe_insert("scale", frame=f)
    # Claude's eye-line, looking down into the crater: the star looks up into the lens
    cam = scene.camera(lens=45)
    ct = Track(CAM_DEFAULT)
    eye = cp + toward * 0.95 + side * 0.08 + Vector((0, 0, 0.55))
    tgt = cp + Vector((0, 0, 0.13)) + side * 0.03
    ct.key(0, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=45, fstop=2.8, focus=(tgt - eye).length)
    e2 = cp + toward * 0.82 + side * 0.06 + Vector((0, 0, 0.5))
    ct.key(dur, "soft", cx=e2.x, cy=e2.y, cz=e2.z, tx=tgt.x, ty=tgt.y, tz=tgt.z + 0.01, lens=50, fstop=2.8,
           focus=(tgt - e2).length)
    ct.layer(lambda t, p: p.update(shake=0.35))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=10)
    return dict(post=dict(haze_amt=0.0, bloom=0.8, bloom_thr=0.6, bloom_size=8, kuw_near=2, kuw_far=4, vignette=0.5))
