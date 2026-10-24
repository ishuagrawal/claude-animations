"""B19 (51.88-54.38, 4 beats): CU, Claude in the bloomed summit meadow beside the new sapling.
It is laughing through happy tears, shoulders shaking, eyes squeezed into crescents, while colour and petals wash past
its face in the warm wind. On T_LEAN the sapling turns and leans its head against Claude's cheek, both leaves wrapping
round it: a hug. Claude's laugh melts into a long teary, blissful squeeze; it tips its head onto the sapling and
curls an arm round it."""
import math
import bpy
from mathutils import Vector

from lu import world, layout, post, fx, sky, anim, acting, claude, sprout, framing, scene, dress
from shots import act_bloom as A
from shots.b16 import summit_dressing

T_LEAN = 1.2

# staging: the sapling stands where it was planted; Claude sits beside it, the sapling at its left shoulder
SAP_LOCAL = (0.50, -0.16)


def laugh_layer(t0, t1, rate=4.6, amp=1.0):
    """Joyful chuckles: quick squash pulses with a head bob and a shoulder hitch, fading out."""
    def f(t, p):
        if not (t0 <= t <= t1):
            return
        w = min(1.0, (t - t0) / 0.15, (t1 - t) / 0.4) * amp
        ph = (rate * (t - t0)) % 1.0
        k = math.exp(-((ph - 0.15) / 0.12) ** 2)
        p["squash"] = p.get("squash", 0.0) + 0.045 * w * k
        p["head_nod"] = p.get("head_nod", 0.0) - 4.0 * w * k
        p["hop"] = p.get("hop", 0.0) + 0.008 * w * k
        for s in "LR":
            p[f"arm{s}_up"] = p.get(f"arm{s}_up", -38.0) + 6.0 * w * k
    return f


def make(f0, f1):
    fl_ = f0 + int(round(T_LEAN * 24))
    W = world.World("bloom", focus=tuple(A.PLANT[:2]), frames=(f0, f1))
    summit_dressing(W, [tuple(A.PLANT[:2])], prefix=("CoverAsh",))
    for nm in ("Crown4", "Crown7", "Crown3"):          # open the background onto the bloomed valley
        o = bpy.data.objects.get(nm)
        if o is not None:
            o.hide_render = True
            o.hide_viewport = True
    H = A.HEADING
    zs = A.surface_z(A.PLANT.x, A.PLANT.y, top=W.ground(*A.PLANT[:2]) + 3.0) or W.ground(*A.PLANT[:2])
    SP = Vector((A.PLANT.x, A.PLANT.y, zs - 0.012))
    off = A.local_to_world((0, 0, 0), H, (SAP_LOCAL[0], SAP_LOCAL[1], 0.0))
    CR = A.on_ground(W, (SP.x - off.x, SP.y - off.y))
    dress.mow(tuple(CR[:2]), 0.45)
    dress.flatten(tuple(CR[:2]), 0.8)

    # ---------------------------------------------------------------- the sapling: dances in the wind, then the hug
    S = sprout.Sprout("Sprout")
    framing.register_char(S)
    sap_h = H - 58.0
    st = anim.Track(sprout.DEFAULT)
    sap = dict(acting.S_HAPPY, x=SP.x, y=SP.y, z=SP.z, heading=sap_h + 25.0, grow=3.0, glow=1.2, lean=-4.0,
               head_nod=-14.0, look_y=0.6, leafL_reach=55.0, leafR_reach=62.0, side=6.0)
    st.pose(0.0, sap)
    st.pose(T_LEAN - 0.45, dict(sap, side=-2.0, head_turn=-14.0, look_x=-0.7, look_y=0.1))
    hug = dict(acting.S_HUG, x=SP.x, y=SP.y, z=SP.z, grow=3.0, heading=sap_h, lean=22.0, side=-4.0, head_nod=-6.0,
               leafL_reach=48.0, leafR_reach=58.0, leafL_curl=0.75, leafR_curl=0.6, glow=1.25, look_x=-0.3)
    st.pose(T_LEAN, hug, ease="inout")
    st.pose(2.6, dict(hug, lean=24.0, leafL_curl=0.7, leafR_curl=0.62, head_nod=-4.0))
    st.layer(acting.sprout_breathe(amp=0.015, rate=0.55))
    st.layer(anim.blinks(times=[0.5], dur=0.14))
    anim.anchor(st, sprout.DEFAULT)
    S.bake(lambda f: st.at((f - f0) / 24), f0, f1)
    A.scale_sprout_light(S, 0.35)

    # ---------------------------------------------------------------- Claude: laughing through tears -> the hug
    C = W.claude("Claude")
    tr = anim.Track(claude.DEFAULT)
    base = dict(x=CR.x, y=CR.y, z=CR.z, heading=H, crouch=0.55)
    base.update(A.MAT_BLOOM, wet=0.0, brand=0.6)
    laugh = dict(base)
    laugh.update(acting.B_LAUGH)
    laugh.update(acting.F_LAUGH, crouch=0.55, tears=1.0, head_tilt=-6.0, look_y=0.4, mouth_open=0.7, smile=1.0,
                 armL_up=-48.0, armR_up=-48.0, armL_fwd=-4.0, armR_fwd=-4.0, armL_bend=18.0, armR_bend=18.0)
    tr.pose(0.0, laugh)
    tr.pose(0.7, dict(laugh, bend=-18.0, head_nod=-15.0, head_tilt=4.0))
    tr.pose(T_LEAN - 0.15, dict(laugh, bend=-10.0, head_nod=-8.0, head_tilt=-4.0, head_turn=8.0))
    # the hug: it melts into it - head tipped onto the sapling, an arm round it, eyes squeezed in bliss
    melt = dict(base, crouch=0.6, bend=2.0, lean=-2.0, roll=-4.0, head_tilt=-12.0, head_turn=-10.0, head_nod=2.0,
                eye_open=0.55, eye_happy=1.0, eye_squeeze=0.25, lid_sag=0.3, tears=1.0, smile=0.75, mouth_open=0.12,
                look_x=0.7, look_y=0.1, armL_ik=1.0, armL_follow=0.0, handL_x=0.53, handL_y=0.02, handL_z=0.36,
                armL_twist=60.0, handL_curl=0.7, handL_thumb=0.6, armL_pole=20.0, armR_up=-30.0, armR_fwd=25.0,
                armR_bend=40.0, squash=0.04)
    tr.pose(T_LEAN + 0.3, melt, ease="inout")
    tr.pose(1.9, dict(melt, squash=-0.03, head_tilt=-15.0))                     # a long, shaky happy sigh
    tr.pose(2.6, dict(melt, squash=0.0, head_tilt=-14.0, eye_open=0.5))
    tr.layer(laugh_layer(0.0, T_LEAN + 0.15))
    tr.layer(acting.sob(1.55, 2.4, rate=2.2, amp=0.5))
    anim.settle(tr, claude.DEFAULT, max_gap=0.9)
    C.bake(lambda f: tr.at((f - f0) / 24), f0, f1)
    C.tear("L", f0 + 4, dur=1.3)
    C.tear("R", f0 + 16, dur=1.25)
    C.tear("R", fl_ + 12, dur=1.2)

    # ---------------------------------------------------------------- petals and pollen washing past in the wind
    sc = bpy.context.scene
    az = math.radians(H - 90.0 - 22.0)                     # camera 22 deg to Claude's right of its front
    face = CR + Vector((0, 0, 0.5))
    eye_c = face + Vector((math.cos(az), math.sin(az), 0)) * 2.7 + Vector((0, 0, 0.07))
    view = (face - eye_c).normalized()
    for k in range(0, 5):
        dress.mow(tuple(eye_c.lerp(face, k / 5.0)[:2]), 0.6)
    right = view.cross(Vector((0, 0, 1))).normalized()
    wind = right * 1.4
    # (kept clear of the lens: a petal at the camera is a big blurred blob)
    fx._make_field("WashPetals", "fall", tuple(face - view * 0.2 + Vector((0, 0, 0.45))), (2.8, 2.8, 2.0), 900, f0,
                   fx._petal_meshes(), dict(fall=0.25, fall_var=0.3, wind=(wind.x, wind.y), flutter=0.55,
                                            flutter_f=1.7, spin=3.4, size=(0.03, 0.05)), 191)
    fx.pollen(tuple(face), (3.0, 3.0, 1.6), 260, f0, seed=19, name="WashPollen")

    # ---------------------------------------------------------------- camera: long lens, shallow, a slow drift in
    mid = face.lerp(SP + Vector((0, 0, 0.5)), 0.3)
    e1 = eye_c + view * 0.22 + right * 0.08

    def cam_fn(t):
        u = A.smooth(t / 2.5)
        e = A.vlerp(eye_c, e1, u)
        return dict(eye=e, tgt=mid + Vector((0, 0, 0.01 * u)), lens=46.0, fstop=2.4, focus=(face - e).length)
    cam = scene.camera("CamB19", lens=46.0)
    A.bake_cam(cam, cam_fn, f0, f1 - 1, shake=lambda t: 0.3, seed=19)
    sc.camera = cam

    sc.frame_set(f0 + 30)
    fl = C.face_light(eye_c, energy=0.5, col=(1.0, 0.86, 0.7))
    rim = C.rim_light(eye_c, sky.sun_vec(), col=(1.0, 0.78, 0.5), energy=40.0)
    # the bloom sun is hot and very warm: Claude gets its own softer key from the sun's side (brand terracotta)
    lo = bpy.data.objects.get("LU_Sun")
    if lo is not None:
        A.exclude_from_light(lo, (C,))
    key = A.char_key(C, sky.sun_vec(), 70.0, col=(1.0, 0.92, 0.86), dist=3.0, size=2.0)

    A.animatic_readable((C, S))
    return dict(post=post.preset("bloom", focus_xy=(0.5, 0.55), sat=1.0))
