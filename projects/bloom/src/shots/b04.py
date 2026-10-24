"""B04 (10.63-15.00, 7 beats): the film's emotional anchor. A low two-shot over Claude's hands, its face above. Its left
hand brushes the ash away in three strokes: the seed, glowing emerald. Both hands slide under it and lift it up, close,
cupped: and at T_CRACK it splits open in their hands in a flash of green; Claude startles. A sprout unfurls out of it,
its two leaves opening; facing us, its tiny eyes blink open. Then it turns and looks up at Claude. Claude goes still,
eyes huge; the sprout reaches out and at T_CURL one leaf curls round the edge of Claude's hand. Claude melts: the
squares soften into happy arcs, the tiniest smile, the head tilts; green light on its face. The camera rises with the
lift and eases in.
Feeling: wonder and the first warmth (valence +2). The leaf on the hand returns in B15."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx
from lu import sprout as SP
from lu.anim import Track
from shots import act_ash as A

T_CRACK = 1.2
T_CURL = 3.0
T_STROKES = (0.12, 0.48, 0.85)       # the three brushes of the hand (the foley's brush hits)
T_SCOOP = (0.95, 1.12)               # the hands slide under the seed, and lift it
T_EYES = 2.2                         # the sprout's eyes open (facing us)
T_LOOK = 2.5                         # it turns and looks up at Claude
SPROUT_TURN = 165.0                  # its heading once it has turned to Claude (its left leaf to Claude's right hand)
HANDS_UP = 0.17                      # wrist height (root space) of the cupped hands (sprout below the eyes)
HAND_TOP = 0.05                      # the seed sits in the V between the hand blocks (wrist centre + this)


def make(f0, f1):
    dur = (f1 - f0) / 24
    F = lambda t: f0 + int(round(t * 24))
    kx, ky = A.KNEEL_XY
    hd = A.KNEEL_HEADING
    sx, sy = A.SEED_SPOT
    sz = A.ground_z(sx, sy)
    kz = A.ground_z(kx, ky)
    fw, lf = A.front(hd), A.left(hd)
    sc = bpy.context.scene
    # ================================================================ characters first (pose solves are cheap
    # before the World exists)
    c = A.new_claude()
    s = A.sprout("Sprout", light_scale=0.3)
    sift = dict(acting.B_SIFT)
    base = dict(sift)
    base.update(A.ASH, x=kx, y=ky, z=kz, heading=hd, lean=9.0, bend=3.0, head_nod=0.0, squash=-0.05,
                eye_open=1.2, eye_tilt=0.3, lower_lid=0.0, pupil=1.25, look_y=-0.9, brand=0.3, vivid=0.4,
                handL_x=0.17, handL_y=-0.37, handL_z=0.13, handR_x=-0.2, handR_y=-0.34, handR_z=0.12)
    cup = dict(handL_x=0.085, handL_y=-0.38, handL_z=HANDS_UP, handR_x=-0.085, handR_y=-0.38, handR_z=HANDS_UP,
               handL_bend=20.0, handR_bend=20.0, handL_curl=0.2, handR_curl=0.2, armL_pole=15.0, armR_pole=15.0)
    kneel_up = dict(crouch=0.62, lean=3.0, bend=2.0, head_nod=6.0, squash=-0.02)
    # ---- Claude's track
    tr = Track()
    tr.pose(0.0, base)
    for k, t in enumerate(T_STROKES):                  # three brushes: sweep toward its left over the heap
        tr.key(t - 0.06, "inout", handL_x=0.06, handL_y=-0.40, handL_z=0.15, handL_bend=45.0)
        tr.key(t + 0.16, "inout", handL_x=0.23 + 0.01 * k, handL_y=-0.38, handL_z=0.14, handL_bend=35.0)
        if k < 2:
            tr.key(t + 0.3, "inout", handL_x=0.12, handL_y=-0.39, handL_z=0.19, handL_bend=25.0)
    tr.key(T_SCOOP[0] - 0.12, "inout", handL_x=0.17, handL_y=-0.38, handL_z=0.15, lean=12.0, head_nod=4.0,
           eye_open=1.2)
    # slide under the seed ...
    tr.key(T_SCOOP[0], "inout", handL_x=0.085, handL_y=-0.40, handL_z=0.105, handR_x=-0.085, handR_y=-0.40,
           handR_z=0.105, handL_bend=30.0, handR_bend=30.0, handL_curl=0.3, handR_curl=0.3)
    # ... and lift it up close (the body rises out of the deep crouch)
    tr.key(T_SCOOP[1] + 0.06, "out", **cup, **kneel_up, eye_open=1.22, look_y=-0.55, pupil=1.35)
    # the crack in its hands: a startle
    tr.key(T_CRACK + 0.08, "out", squash=0.06, lean=-1.0, head_nod=2.0, eye_open=1.35, pupil=0.95,
           handL_z=HANDS_UP + 0.012, handR_z=HANDS_UP + 0.012)
    tr.key(T_CRACK + 0.4, "inout", squash=-0.01, lean=3.0, head_nod=6.0, eye_open=1.3, pupil=1.4,
           handL_z=HANDS_UP, handR_z=HANDS_UP)
    # wonder as the sprout rises
    tr.key(T_EYES, "inout", head_nod=4.0, look_y=-0.45, eye_open=1.32, pupil=1.6, lean=2.0)
    # it turns and looks up: Claude holds its breath, eyes on it
    tr.key(T_LOOK + 0.25, "inout", look_y=-0.5, look_x=-0.12, head_tilt=3.0, squash=0.01)
    # the curl: a tiny breath in, then melting
    tr.key(T_CURL + 0.08, "out", squash=0.03, eye_open=1.34, pupil=1.6, eye_happy=0.0, smile=0.0, eye_tilt=0.3,
           head_tilt=3.0, lean=2.0, head_nod=4.0)
    tr.key(T_CURL + 0.55, "inout", squash=-0.015, eye_open=0.92, eye_happy=0.85, eye_tilt=0.25, pupil=1.2,
           smile=0.55, head_tilt=10.0, lean=4.0, head_nod=8.0)
    tr.key(dur, "soft", eye_happy=0.9, smile=0.6, head_tilt=12.0, squash=-0.02)
    tr.layer(acting.breathe(0.008, 0.3, arms=0.0))
    tr.layer(anim.saccades(seed=41, amp=0.025, every=(0.6, 1.2)))
    tr.layer(anim.blink_at(T_EYES - 0.48, dur=0.18))
    tr.layer(anim.blink_at(3.98, dur=0.42, depth=0.55))
    A.bake_claude(c, tr, f0, f1, mouth=("smile",))
    # ---- where the cupped hands carry the seed (per frame, from the baked rig)
    up = Vector((0, 0, 1))
    hands = {}
    for f in range(f0, f1):
        hL, hR = c.point("handL", f), c.point("handR", f)
        hands[f] = (hL + hR) * 0.5 + up * HAND_TOP
    seat0 = Vector((sx, sy, sz - 0.012))
    # the leaf round the hand: find the top inner edge of Claude's right hand beside the sprout, slide the sprout on
    # the cupped hands until its left leaf's root sits ~3 cm from that edge, then curl the leaf over the edge
    fc = F(T_CURL + 0.1)
    look = dict(head_turn=26.0, head_nod=-26.0, look_x=0.35, look_y=0.85, lean=-6.0)
    curl = dict(acting.S_CURL_FINGER, heading=SPROUT_TURN, eye_happy=0.55, mouth=0.65, blush=0.55, glow=1.25,
                health=1.0, leafR_reach=25.0, leafR_curl=0.0, leafL_reach=30.0, leafL_curl=0.5, **look)
    # the leaf round the hand: the sprout sits in the V of the cupped hands, its left leaf just under the inner top
    # edge of Claude's right hand: it reaches up and curls over that edge (set by eye; a wrap solve has no room in
    # the V of the block hands)
    off = Vector((0.0, 0.0, 0.0))
    curl.update(leafL_reach=58.0, leafL_curl=0.85, lean=-4.0, side=-10.0)
    # ---- the sprout's track: placement (on the ground, then riding the hands) + acting
    st = Track()
    st.pose(0.0, dict(acting.S_SEED, heading=0.0, glow=0.55, health=0.85, hat=1.0))
    st.key(T_STROKES[2] + 0.1, "inout", glow=1.0, crack=0.12)
    st.key(T_CRACK - 0.05, "in", glow=1.3, crack=0.62, grow=0.0)
    st.key(T_CRACK + 0.06, "out", crack=1.0, glow=1.9, grow=0.06)
    st.key(T_CRACK + 0.4, "inout", glow=1.15)
    st.key(T_CRACK + 0.05, "linear", unfurl=0.0, leaf_open=0.0, eye_open=0.0, head_nod=24.0)
    st.key(T_CRACK + 0.85, "out", grow=1.0)
    st.key(T_CRACK + 1.0, "inout", unfurl=1.0, head_nod=4.0)
    st.key(T_CRACK + 0.6, "linear", leaf_open=0.0)
    st.key(T_EYES + 0.1, "out", leaf_open=1.0)
    st.key(T_EYES - 0.02, "linear", eye_open=0.0, mouth=0.0)
    st.key(T_EYES + 0.14, "out", eye_open=1.05, mouth=0.3, look_y=0.15)
    st.key(T_LOOK - 0.06, "linear", heading=0.0, head_turn=0.0, look_x=0.0, look_y=0.15, lean=0.0, head_nod=4.0)
    st.key(T_LOOK + 0.38, "inout", heading=SPROUT_TURN, **look, mouth=0.35)
    st.key(T_CURL - 0.35, "linear", leafL_reach=0.0, leafL_curl=0.0, leafR_reach=0.0)
    st.key(T_CURL - 0.06, "inout", leafL_reach=curl["leafL_reach"] + 12.0, leafL_curl=0.25, leafR_reach=25.0,
           lean=curl["lean"], side=curl["side"])
    st.key(T_CURL + 0.12, "out", leafL_reach=curl["leafL_reach"], leafL_curl=curl["leafL_curl"])
    st.key(T_CURL + 0.5, "inout", eye_happy=curl["eye_happy"], mouth=curl["mouth"], blush=curl["blush"],
           glow=curl["glow"], health=1.0)
    st.layer(acting.sprout_shiver(T_CRACK - 0.3, T_CRACK + 0.02, amp=0.5))
    st.layer(acting.sprout_breathe(0.02, 0.45))
    st.layer(anim.blink_at(T_EYES + 0.42, dur=0.14))
    anim.settle(st, SP.DEFAULT, max_gap=0.7)

    def place(t):
        f = f0 + int(round(t * 24))
        f = min(max(f, f0), f1 - 1)
        p = st.at(t)
        on = anim.ease("inout", (t - T_SCOOP[0]) / (T_SCOOP[1] - T_SCOOP[0] + 0.06))
        slide = anim.ease("inout", (t - T_SCOOP[1]) / 0.8)
        P = seat0.lerp(hands[f] + off * slide, on)
        p.update(x=P.x, y=P.y, z=P.z, clod=0.35 * on)
        return p
    s.bake(lambda f: place((f - f0) / 24), f0, f1 - 1)
    # ================================================================ the world
    W = world.World("ash", focus=A.SEED_SPOT, frames=(f0, f1))
    g = W.ground
    A.seed_ground(W)
    # the glow under the ash (continuing B03), fading as the seed's own light takes over
    dec, lt = A.glow_under_ash((sx, sy), g, radius=0.15, light_h=0.08)
    for t, gl, e in ((0.0, 0.62, 2.7), (T_STROKES[0], 0.75, 3.0), (T_STROKES[1] + 0.1, 0.5, 1.6),
                     (T_STROKES[2] + 0.15, 0.15, 0.3), (T_SCOOP[0], 0.0, 0.0)):
        A.key_glow(dec, lt, F(t), gl, e)
    # the heap of ash over the seed: each stroke pushes it toward Claude's left and flattens it into a ridge
    heap = A.ash_heap((sx, sy), g, radius=0.075, height=0.03)
    for t, d, k_z, k_xy in ((0.0, 0.0, 1.0, 1.0), (T_STROKES[0], 0.0, 1.0, 1.0),
                            (T_STROKES[0] + 0.18, 0.035, 0.62, 1.05), (T_STROKES[1], 0.035, 0.62, 1.05),
                            (T_STROKES[1] + 0.18, 0.085, 0.32, 1.1), (T_STROKES[2], 0.085, 0.32, 1.1),
                            (T_STROKES[2] + 0.15, 0.12, 0.2, 1.1)):
        heap.location = (sx + lf.x * d, sy + lf.y * d, sz - 0.002)
        heap.scale = (k_xy, k_xy * 0.8 if d > 0 else 1.0, k_z)
        heap.keyframe_insert("location", frame=F(t))
        heap.keyframe_insert("scale", frame=F(t))
    for k, t in enumerate(T_STROKES):
        px, py = sx + lf.x * (0.05 + 0.03 * k), sy + lf.y * (0.05 + 0.03 * k)
        fx.dust_puff((px, py), F(t + 0.12), size=0.18, n=4, opacity=0.4, seed=400 + k, color=A.ASH_PUFF,
                     drift=(lf.x * 0.25, lf.y * 0.25, 0.02))
    fx.dust_puff((sx, sy), F(T_SCOOP[1]), size=0.2, n=4, opacity=0.3, seed=419, color=A.ASH_PUFF)
    # ================================================================ camera: from the front and above the block arms
    # (they rise to the eyes' height): looking down on the brushing with the face above, then sinking with the lift
    # to a two-shot just above eye level, easing in for the curl
    E = (c.point("eyeL", F(T_CURL + 0.6)) + c.point("eyeR", F(T_CURL + 0.6))) * 0.5
    E0 = (c.point("eyeL", F(0.5)) + c.point("eyeR", F(0.5))) * 0.5
    Hd = hands[F(T_CURL)]
    S0 = Vector((sx, sy, sz))
    Hs = s.point("head", F(T_CURL))
    th = c.point("thumbR", F(T_CURL))
    # brushing: from above the block arms (they rise to eye height), the seed below, the face above
    m0 = S0.lerp(E0, 0.62)
    e0 = m0 + fw * 1.5 + lf * 0.2 + Vector((0, 0, 0.5))
    # the lift and the birth: a two-shot just above eye level
    m1 = Hd.lerp(E, 0.5) + Vector((0, 0, 0.03))
    e1 = m1 + fw * 1.6 + lf * 0.2 + Vector((0, 0, 0.2))
    # the curl and the melt: easing in on the two of them (the leaf over the edge of the hand reads against its
    # ash-grey top), focus on the sprout through the curl, then racking up to the eyes for the smile
    ms = Hs.lerp(E, 0.55) + Vector((0, 0, 0.02))
    es = ms + fw * 1.3 + lf * 0.13 + Vector((0, 0, 0.16))
    A.mow_line(e0, S0, 0.5)
    A.cam_move("CamB04", f0, f1, [(0.0, "linear", e0, m0, 45.0, (S0 - e0).length),
                                  (T_SCOOP[0], "linear", e0 + (m0 - e0) * 0.03, m0, 45.0, (S0 - e0).length),
                                  (T_CRACK + 0.35, "inout", e1, m1, 45.0, (Hd - e1).length),
                                  (T_LOOK - 0.1, "linear", e1 + (m1 - e1) * 0.04, m1, 45.0, (Hd - e1).length),
                                  (T_CURL + 0.25, "inout", es, ms, 50.0, (Hs - es).length),
                                  (T_CURL + 0.85, "inout", es + (ms - es) * 0.03, ms, 50.0, (E - es).length),
                                  (dur, "soft", es + (ms - es) * 0.06, ms + Vector((0, 0, 0.008)), 50.0,
                                   (E - es).length)],
               shake=0.02, seed=404, fstop=4.0)
    c.face_light(es, energy=1.2, col=(0.92, 0.95, 0.88), dist=1.0, size=0.7, frame=F(T_CURL))
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("ash", focus_xy=(0.5, 0.52), sat=A.SAT, bloom=0.85, bloom_thr=0.55))
