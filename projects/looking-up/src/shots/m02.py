"""M02 — INT evening, at the workbench: Claude taps the last rivets into a little brass lantern (three hammer taps)
while the star watches from the bench, curious. Claude opens its little door — the star hops inside, turns, and curls
up: it fits perfectly. The lantern fills with warm light; Claude glows too (happy squint, a tiny bounce)."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_HOP = 2.55
T_IN = 3.05


def make(f0, f1):
    W = world.World("int", "dusk")
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    W.practicals(lamp=4.0, stove=3.0, fill=3.0, candle=2.5)
    tbl = W.I["table"]["top"]
    seat = W.I["table"]["seat"]
    for nm in ("cup", "pot"):
        W.I["table"][nm].hide_render = True
    lan = interior.lantern(bpy.data.collections.get("Interior") or bpy.context.scene.collection, W.I["mats"])
    lp = O + tbl + Vector((-0.1, -0.06, 0.0))
    lan["root"].location = lp
    c = W.claude()
    hammer = W.I["bench"]["hammer"]
    hammer.hide_render = True
    hm = geo.join([geo.box("HHandle", (0.03, 0.3, 0.03), mat=W.I["mats"]["wood"]),
                   geo.box("HHead", (0.12, 0.05, 0.05), loc=(0, 0.15, 0), mat=W.I["mats"]["iron"])], "HammerHeld")
    cpos = O + Vector((seat.x, seat.y, 0))
    hd = S.heading_to((seat.x, seat.y), (tbl.x, tbl.y))
    sit = S.C_SIT(seat.z)
    # the hammer in the near (left) hand, its head resting on the lantern's roof (character-local coordinates)
    hold = dict(armL_fwd=62, armL_up=18, armR_fwd=50, armR_up=0, lean=10)
    hp = dict(hold, x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0)
    c.apply(hp)
    bpy.context.view_layer.update()
    hand = c.rig.matrix_world @ c.rig.pose.bones["armL2"].tail
    h = math.radians(hd)
    dl = lp - cpos
    fwd = Vector((math.sin(h), -math.cos(h), 0))
    lan_local = Vector(((dl.x * math.cos(h) + dl.y * math.sin(h)), -(dl.dot(fwd)), lp.z - (O.z + sit["hop"])))
    # the rivet: on the lantern's base band, on the side facing Claude's hand
    side = (hand - lan_local)
    side.z = 0
    head_at = lan_local + side.normalized() * 0.13 + Vector((0, 0, 0.07))
    d = head_at - hand
    k = min(d.length / 0.3, 1.25)
    hmat = Matrix.Translation(head_at - d.normalized() * 0.3 * k * 0.5 - d.normalized() * 0.03) @ \
        d.to_track_quat("Y", "Z").to_matrix().to_4x4() @ Matrix.Diagonal((1.0, k, 1.0, 1.0))
    S.attach(hm, c, "armL2", hmat, pose=hold)
    # ...set down on the table when the work is done
    rest = hm.copy()
    rest.data = hm.data
    bpy.context.scene.collection.objects.link(rest)
    rest.parent = None
    S.vis_range(hm, f0, f0 + int(1.95 * 24), f0, f1)
    S.vis_range(rest, f0 + int(1.95 * 24), f1 + 1, f0, f1)
    # the taps are a wrist flick: the hammer pivots about the grip (lift, then snap down onto the rivet)
    hb = hm.matrix_basis.copy()
    grip = Vector((0.0, -0.15, 0.0))
    impacts = (0.53, 1.13, 1.73)

    def lift(t):
        a = 0.0
        for ti in impacts:
            if ti - 0.4 <= t < ti:
                u = (t - (ti - 0.4)) / 0.4
                a = max(a, 50 * (math.sin(math.pi * min(u / 0.6, 1.0) * 0.5) if u < 0.6 else 1 - anim.ease("in", (u - 0.6) / 0.4)))
            elif ti <= t < ti + 0.1:
                a = max(a, 4 * math.sin(math.pi * (t - ti) / 0.1))       # little rebound
        return a
    for f in range(f0, f0 + int(2.0 * 24)):
        a = math.radians(lift((f - f0) / 24))
        hm.matrix_basis = hb @ Matrix.Translation(grip) @ Matrix.Rotation(a, 4, "X") @ Matrix.Translation(-grip)
        hm.keyframe_insert("location", frame=f)
        hm.keyframe_insert("rotation_euler", frame=f)
        hm.keyframe_insert("scale", frame=f)
    hm.matrix_basis = hb
    sw = Vector((side.x * math.cos(h) - side.y * math.sin(h), side.x * math.sin(h) + side.y * math.cos(h), 0)).normalized()
    rivet = lp + sw * 0.12 + Vector((0, 0, 0.07))
    # lying flat on the table by the lantern, handle toward Claude
    rest.matrix_world = Matrix.Translation(lp + sw * 0.3 + Vector((0, 0, 0.02))) @ \
        Matrix.Rotation(math.atan2(sw.y, sw.x) + math.radians(70), 4, "Z")
    tr = Track()
    base = S.merge(sit, hold, dict(x=cpos.x, y=cpos.y, z=O.z, heading=hd, look_y=-0.35, look_x=0.15, eye_open=0.88,
                                   eye_tilt=-0.15))
    tr.pose(0.0, S.merge(base, squash=0.0, armL_bend=0.0, eye_happy=0.0, head_turn=0.0, pupil=1.0, head_tilt=0.0))
    # three taps (impacts at 0.53, 1.13, 1.73): the body bobs into each blow (the hammer flick is keyed below)
    for t in (0.35, 0.95, 1.55):
        tr.key(t, "in", squash=0.03, lean=8)
        tr.key(t + 0.18, "snap", squash=-0.03, lean=12)
    # done: sets the hammer down, looks to the star and opens the little door for it: "in you go"
    tr.key(2.0, "inout", armL_up=5, armL_fwd=40, armR_fwd=55, armR_up=10, lean=4, look_x=-0.65, look_y=0.15, head_turn=4,
           eye_happy=0.35, eye_tilt=0.0, squash=0.0)
    tr.key(2.35, "inout", armL_fwd=75, armL_up=22, armL_bend=-12, eye_happy=0.55, head_tilt=8)
    # watches the star hop in... delight
    tr.key(T_IN, "inout", look_x=-0.2, look_y=-0.05, head_turn=0, pupil=1.15, armL_fwd=40, armL_up=5, armL_bend=0)
    tr.key(T_IN + 0.35, "back", **S.merge(S.C_HAPPY, armL_up=40, armR_up=40, squash=0.1, eye_happy=0.85))
    tr.key(dur, "soft", eye_happy=0.8, squash=0.04, armL_up=20, armR_up=20)
    tr.layer(anim.blinks(times=[2.2], dur=0.15))
    tr.layer(anim.breathe(0.012, 0.35))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    for t in (0.53, 1.13, 1.73):
        fx.sparks(f"Tap{t}", rivet, t, f0, n=8, speed=(0.6, 1.4), life=(0.15, 0.3), gravity=-4,
                  strength=14, size=0.007, seed=int(t * 100))
    s = W.star()
    s.light_scale = 6.0
    cam_eye = O + Vector((0.8, 2.52, 1.06))
    beside = lp + Vector((0.12, 0.3, 0.17))
    inside = lp + Vector((0, 0, 0.17))
    hs0 = S.heading_to((beside.x, beside.y), (cam_eye.x, cam_eye.y)) + 30
    hs_in = S.heading_to((inside.x, inside.y), (cam_eye.x, cam_eye.y))
    st = Track()
    st.pose(0.0, S.merge(S.S_CURIOUS, x=beside.x, y=beside.y, z=beside.z, heading=hs0, glow=1.1, look_x=-0.5, look_y=-0.3,
                         squash=0.0, scale=1.0, curl=0.0, eye_happy=0.0, arms=0.0))
    st.key(1.0, "inout", look_x=-0.6, look_y=-0.1, head=-12)
    st.key(2.1, "inout", look_x=0.4, look_y=0.1, pupil=1.15, heading=hs0 - 25)
    st.key(T_HOP - 0.1, "in", squash=-0.15, x=beside.x, y=beside.y)
    st.key(T_HOP + 0.1, "out", squash=0.12, x=(beside.x + inside.x) / 2, y=(beside.y + inside.y) / 2)
    st.key(T_IN, "inout", x=inside.x, y=inside.y, z=inside.z, scale=0.55, squash=-0.05, heading=hs_in + 40)
    st.key(T_IN + 0.5, "inout", **S.merge(S.S_HAPPY, curl=20, glow=1.45, eye_happy=0.85, scale=0.55, heading=hs_in))
    st.key(dur, "soft", eye_happy=0.9, glow=1.5, scale=0.55)
    st.layer(anim.hop_arc(T_HOP, T_IN, 0.28, 0.1))

    def hopz(t, p):
        p["z"] = p.get("z", 0) + p.pop("hop", 0.0)
    st.layer(hopz)
    st.layer(anim.blinks(times=[0.6, 1.7], dur=0.13))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # from the workbench side, across the corner of the table: Claude 3/4 front (right), lantern + star (left)
    eye = cam_eye
    tgt = (cpos + Vector((0, 0, 0.8)) + lp + Vector((0, 0, 0.2))) / 2 + Vector((0, 0, 0.02))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 25, push=0.1, lens_end=27, fstop=2.8, seed=22, focus_on=lp, chars=[c])
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.5)), cam.location, (-0.3, 0.8, 0.3), rim_col=(1.0, 0.7, 0.4), rim_w=14.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.55, bloom_thr=0.7, kuw_near=3, kuw_far=4, vignette=0.38))
