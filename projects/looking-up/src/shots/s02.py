"""S02 — INT evening: Claude pushes a heavy flour sack across the room, heaves it onto the pile (thump, dust),
wipes its brow and lets out a tired breath. Routine, effort, solitude."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, geo, interior
from lu.anim import Track, CAM_DEFAULT, Path
from lu.claude import DEFAULT as CDEF
from shots import s06 as S6


def make(f0, f1):
    W = world.World("int", "dusk")
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    pr = W.practicals(lamp=16.0, stove=9.0, fill=9.0)
    dur = (f1 - f0) / 24
    c = W.claude()
    sack_m = W.I["mats"]["sack"]
    sack = geo.rounded_box("HaulSack", (0.46, 0.36, 0.52), 0.14, seg=(2, 2, 2), n_r=3, mat=sack_m)
    geo.displace_noise(sack, 0.025, 0.18, seed=7)
    pile = W.I["flour"]["pos"]
    stop = (pile.x + 0.55, pile.y - 0.95)
    path = Path([(0.0, O.x + 0.15, O.y - 1.95), (1.25, O.x - 0.2, O.y - 0.35), (2.5, O.x + stop[0], O.y + stop[1])], ease_="smooth")
    # one camera low by the bed: Claude pushes the sack toward us across the room (three-quarter front, right to
    # left), heaves it up onto the pile in profile, then turns round to us, wipes its brow and sags.
    cam_end = L(-2.05, 0.4, 0.72)
    h_arrive = path.heading(2.45)
    h_pile = S.heading_to(stop, (pile.x, pile.y))
    h_turn = S.heading_to(stop, (cam_end.x - O.x, cam_end.y - O.y))
    h_turn = h_pile + ((h_turn - h_pile + 180.0) % 360.0 - 180.0)      # turn the short way round
    h_heave = h_pile + 0.4 * (h_turn - h_pile)                        # heaves half-turned toward us
    tr = Track()
    tr.layer(anim.walk(path, stride=0.11, swing=24, knee=26, bob=0.012, sway=2.5, z_fn=lambda x, y: O.z))
    push = S.merge(lean=10, head_nod=-9, armL_fwd=72, armR_fwd=72, armL_up=-4, armR_up=-4, eye_open=0.8, eye_tilt=-0.2,
                   look_y=0.0, squash=-0.03)
    tr.pose(0.0, push, heading=h_arrive)
    tr.pose(2.5, push, heading=h_arrive)
    # squares up to the pile, heave: anticipation squash, then lift
    tr.key(2.7, "inout", heading=h_heave)
    tr.key(2.75, "inout", squash=-0.12, lean=10, head_nod=0, armL_up=-20, armR_up=-20, eye_open=0.55, eye_tilt=-0.5)
    tr.key(3.2, "back", squash=0.12, lean=-6, armL_up=70, armR_up=70, armL_fwd=40, armR_fwd=40, eye_open=0.6)
    tr.key(3.45, "out", squash=-0.05, armL_up=40, armR_up=40, heading=h_heave)
    # turns round (back to the pile, toward us)
    tr.key(3.85, "inout", heading=h_turn, armL_up=-10, armR_up=-10, armL_fwd=0, armR_fwd=0, lean=0, squash=0.0,
           eye_open=0.7, eye_tilt=0.1, look_y=-0.05, armR_curl=0)
    # wipe brow: right arm sweeps across the top of the head
    tr.key(4.0, "inout", armR_up=85, armR_curl=-30, armL_up=-30, eye_open=0.6, eye_tilt=0.25, head_tilt=0,
           eye_happy=0.0)
    tr.key(4.35, "inout", armR_curl=55, head_tilt=8, eye_open=0.4, eye_happy=0.25, slump=0, look_x=0.0)
    # exhale: sag, eyes drift aside over the empty room
    tr.key(4.7, "out", **S.merge(S.C_TIRED, armR_up=-40, armR_curl=0, head_tilt=4, eye_happy=0.0, eye_open=0.62,
                                 eye_tilt=0.35, look_x=-0.25))
    tr.key(dur, "soft", slump=14, squash=-0.05, look_x=-0.45, look_y=-0.3)

    def steps(t, p):
        # little shuffle steps while turning round
        if 3.45 <= t <= 3.95:
            u = (t - 3.45) / 0.5
            ph = u * 4 * math.pi
            for i in range(4):
                p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0.0) + 16 * math.sin(ph + (0 if i in (0, 2) else math.pi)) * math.sin(math.pi * u)
            p["hop"] = p.get("hop", 0.0) + 0.01 * abs(math.sin(ph))
    tr.layer(steps)
    S6.anchor(tr, CDEF)
    tr.layer(anim.breathe(0.01, 0.35))
    tr.layer(anim.blinks(times=[1.3, 3.6], dur=0.16))
    tr.layer(anim.wobble("squash", 3.45, 4.0, 0.04, 3.0, 4.0))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)

    # sack follows the push, then is heaved onto the pile
    def sack_at(t):
        p = tr.at(min(t, 2.5))
        h = math.radians(p.get("heading", 0))
        fwd = Vector((math.sin(h), -math.cos(h), 0))
        base = Vector((p["x"], p["y"], O.z)) + fwd * (0.62 - 0.1 * anim.ease("inout", (t - 2.2) / 0.3))
        rest = Matrix.Translation(base + Vector((0, 0, 0.26))) @ Matrix.Rotation(h, 4, "Z")
        top = Matrix.Translation(L(pile.x + 0.35, pile.y - 0.45, 0.62 + 0.26)) @ Matrix.Rotation(h + 0.4, 4, "Z")
        if t < 2.75:
            wob = Matrix.Rotation(0.05 * math.sin(t * 9), 4, "Y")
            return rest @ wob
        u = anim.ease("inout", (t - 2.75) / 0.7)
        hop = Vector((0, 0, 0.6 * math.sin(math.pi * u)))
        loc = rest.translation.lerp(top.translation, u) + hop
        return Matrix.Translation(loc) @ Matrix.Rotation(h + 0.4 * u, 4, "Z")
    S.key_obj_path(sack, f0, f1 - 1, sack_at)
    fx.puff("SackDust", L(pile.x + 0.35, pile.y - 0.45, 0.62), 3.45, f0, n=8, spread=0.15, grow=(0.04, 0.16),
            life=(0.9, 1.8), rise=0.08, color=(0.85, 0.8, 0.72), opacity=0.25, seed=3)

    cam = scene.camera("Cam", lens=30)
    ct = Track(CAM_DEFAULT)
    e0 = L(-2.42, 0.22, 1.0)
    sw = L(stop[0], stop[1], 0.0)
    lead = lambda t, d=0.3: Vector((*path.pos(min(t + d, 2.5)), 0.0))
    for t in (0.0, 0.5, 1.0, 1.5, 2.0):
        q = lead(t)
        ct.key(t, "linear", cx=e0.x, cy=e0.y, cz=e0.z, tx=q.x, ty=q.y, tz=O.z + 0.4, lens=32 + t, fstop=3.5,
               focus=(q - e0).length)
    pt = L(pile.x + 0.35, pile.y - 0.45, 0.0)
    m0 = sw.lerp(pt, 0.3)
    ct.key(2.6, "inout", tx=m0.x, ty=m0.y, tz=O.z + 0.62, lens=31, focus=(sw - e0).length)
    ct.key(3.45, "inout", tx=m0.x, ty=m0.y, tz=O.z + 0.68)
    ct.key(4.1, "inout", cx=e0.x + 0.12, cy=e0.y + 0.06, cz=e0.z - 0.15, tx=sw.x - 0.08, ty=sw.y - 0.05,
           tz=O.z + 0.45, lens=35)
    ct.key(dur, "soft", cx=cam_end.x, cy=cam_end.y, cz=cam_end.z, tx=sw.x - 0.08, ty=sw.y - 0.05, tz=O.z + 0.4,
           lens=38, focus=(sw - cam_end).length - 0.25)
    ct.layer(lambda t, p: p.update(shake=0.3 + 1.2 * max(0.0, 1 - abs(t - 3.47) / 0.2)))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=2)
    scene.char_lights(c.col, sw + Vector((0, 0, 0.4)), cam_end, (-0.6, 0.6, 0.3), rim_col=(1.0, 0.65, 0.4), rim_w=30.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.4, bloom_thr=0.85, kuw_near=3, kuw_far=4, vignette=0.35))
