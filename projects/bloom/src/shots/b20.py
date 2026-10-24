"""B20 (54.38-58.75, 7 beats): coda, years later, a warm golden afternoon.
The sprout has become a great blossoming tree crowning the summit; a new wooden swing hangs from its long low limb.
Claude, its cracks and chips mended with glinting gold, naps on the swing, rocking gently, hands resting on the ropes,
backlit by the low sun with petals drifting through the light. One petal floats down and lands on its head like a
pat (T_PAT); Claude stirs, squeezes its sleeping eyes happily and nestles in. The camera pulls slowly back to reveal
the tree, and the title fades in over the shadowed meadow (T_TITLE)."""
import math
import bpy
from mathutils import Vector

from lu import world, layout, post, fx, sky, anim, acting, claude, sprout, framing, scene, dress
from shots import act_bloom as A

T_PAT = 1.6
T_TITLE = 2.2

SWING_DIR = (0.5, -0.866)          # the swing limb reaches SSE: seen side-on from the SW, trunk to the left
FACE_AZ = 212.0                    # Claude on the swing faces SW: toward the camera and the low sun behind it


def make(f0, f1):
    fp = f0 + int(round(T_PAT * 24))
    W = world.World("coda", focus=layout.PEAK, frames=(f0, f1))
    px, py = layout.PEAK_SOIL
    B = Vector((px, py, W.ground(px, py)))
    # the great tree takes the soil patch's place: clear the cover under it and the crown rock under the swing
    for nm in ("SummitSoil", "Crown5"):
        o = bpy.data.objects.get(nm)
        if o is not None:
            o.hide_render = True
            o.hide_viewport = True
    dress.mow((px, py), 1.9)
    T = sprout.great_tree("GreatTree", base=tuple(B), height=7.5, swing_dir=SWING_DIR, ground_fn=W.ground)
    hd = math.degrees(math.atan2(math.cos(math.radians(FACE_AZ)), -math.sin(math.radians(FACE_AZ))))
    sw = sprout.swing("Swing", hang_point=T["swing_point"], length=T["swing_length"], heading=hd)
    seat = sw["seat_top"]
    dress.mow(tuple(seat[:2]), 0.7)
    dress.flatten(tuple(seat[:2]), 1.4)
    for k, o in enumerate(bpy.data.objects):
        if o.name.startswith("Crown") and (Vector(o.location[:2]) - Vector(seat[:2])).length < 1.5:
            o.hide_render = True
    sprout.rock_swing(sw, f0, f1, amp=4.0, period=3.6, phase=0.6)

    # ---------------------------------------------------------------- Claude napping on the swing (gold kintsugi)
    C = W.claude("Claude")
    tr = anim.Track(claude.DEFAULT)
    sit = sprout.sit_on(C, sw)
    nap = dict(acting.emotion("sleep"), **sit)
    nap.update(A.MAT_CODA)
    nap.update(head_tilt=11.0, head_nod=9.0, bend=7.0, roll=3.0, lid_sag=0.8, smile=0.25,
               armL_ik=1.0, armR_ik=1.0, armL_follow=0.0, armR_follow=0.0, handL_x=0.40, handR_x=-0.40,
               handL_y=0.0, handR_y=0.0, handL_z=0.56, handR_z=0.56, handL_curl=0.85, handR_curl=0.85,
               handL_thumb=0.8, handR_thumb=0.8, armL_twist=-10.0, armR_twist=-10.0, armL_pole=-20.0,
               armR_pole=-20.0)
    tr.pose(0.0, nap)
    tr.pose(T_PAT - 0.02, nap)
    # the pat: a little stir, a happy squeeze of the sleeping eyes, a nestle, settling deeper
    tr.pose(T_PAT + 0.18, dict(nap, squash=0.05, head_tilt=6.0, head_nod=5.0, eye_happy=0.3, eye_squeeze=0.25,
                               lid_sag=0.4, smile=0.45), ease="out")
    tr.pose(T_PAT + 0.7, dict(nap, squash=-0.02, head_tilt=13.0, head_nod=10.0, eye_happy=0.15, lid_sag=0.7,
                              smile=0.4, roll=4.0), ease="inout")
    tr.pose(4.5, dict(nap, head_tilt=14.0, head_nod=11.0, eye_happy=0.1, lid_sag=0.75, smile=0.38, roll=4.5))
    tr.layer(acting.breathe(amp=0.02, rate=0.28, arms=0.0))
    anim.settle(tr, claude.DEFAULT, max_gap=1.0)
    C.bake(lambda f: tr.at((f - f0) / 24), f0, f1)

    # the pat: a petal lands on the top of its head and stays there
    sc = bpy.context.scene
    tgt = bpy.data.objects.new("PatTarget", None)           # keyed to ride the top of its head (on the swing)
    sc.collection.objects.link(tgt)
    pb = C.rig.pose.bones["head"]
    top = Vector((0.06, -0.15, claude.ZTOP + 0.004))
    for f in range(fp - int(1.45 * 24) - 2, f1 + 1):
        sc.frame_set(f)
        tgt.location = C.rig.matrix_world @ pb.matrix @ C.rest["head"].inverted() @ top
        tgt.keyframe_insert("location", frame=f)
    fx.falling_petal(tgt, fp, dur=1.45, height=1.5, sway=0.32, size=0.075, seed=20)

    # ---------------------------------------------------------------- camera: from the meadow, into the low sun,
    # medium on the nap, then a slow pull back and up to the tree
    sc.frame_set(f0)
    head0 = seat + Vector((0, 0, 0.42))
    fa = math.radians(FACE_AZ)
    away = Vector((math.cos(fa), math.sin(fa), 0))
    side = Vector((-away.y, away.x, 0))
    e0 = head0 + away * 3.2 + side * 0.25 + Vector((0, 0, 0.16))
    e1 = head0 + away * 15.5 + side * 0.6 + Vector((0, 0, 4.2))
    t0 = head0 + Vector((0, 0, -0.04))
    t1 = head0.lerp(B + Vector((0, 0, 4.7)), 0.72)
    # keep the pull-back corridor clear of crown rocks
    for o in bpy.data.objects:
        if o.name.startswith("Crown") and not o.hide_render:
            p2 = Vector(o.location[:2])
            a2, b2 = Vector(seat[:2]), Vector(e1[:2])
            ab = b2 - a2
            u = max(0.0, min(1.0, (p2 - a2).dot(ab) / ab.length_squared))
            if (a2 + ab * u - p2).length < 2.0:
                o.hide_render = True
                o.hide_viewport = True

    def cam_fn(t):
        u = 0.07 * A.smooth(t / 1.7) + 0.93 * A.smoother((t - 1.45) / 2.925)     # hold for the pat, then away
        return dict(eye=A.vlerp(e0, e1, u), tgt=A.vlerp(t0, t1, u), lens=A.lerp(40.0, 22.0, u), fstop=4.0,
                    focus=(head0 - A.vlerp(e0, e1, u)).length)
    cam = scene.camera("CamB20", lens=40.0)
    A.bake_cam(cam, cam_fn, f0, f1 - 1, shake=lambda t: 0.12, seed=20)
    sc.camera = cam

    sc.frame_set(f0 + 20)
    fl = C.face_light(e0, energy=1.2, col=(1.0, 0.86, 0.68))
    rim = C.rim_light(e0, sky.sun_vec(), col=(1.0, 0.8, 0.5), energy=90.0)
    lo = bpy.data.objects.get("LU_Sun")             # its own key so the warm sun doesn't turn the clay neon
    if lo is not None:
        A.exclude_from_light(lo, (C,))
    key = A.char_key(C, sky.sun_vec(), 120.0, col=(1.0, 0.90, 0.78), dist=3.0, size=2.0)

    A.animatic_readable((C,), extra=("GreatTree_petal",))
    P = post.preset("coda", focus_xy=(0.5, 0.55))
    ss = sky.sun_screen(cam, f0 + 60)
    if ss is not None:
        P.update(sun_xy=ss, sun_glow=0.55, sun_size=1.1, sun_col=(1.0, 0.7, 0.36))
    return dict(post=P)
