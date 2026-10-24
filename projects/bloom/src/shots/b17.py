"""B17 (44.38-46.88, 4 beats): CU, Claude kneeling in the beam at the soil.
It lowers the dim, limp sprout and presses it into the soil (T_PLANT), pats the earth round it, then sits back with
its hands clasped at its chest, waiting, afraid to hope. In the gold light the sprout slowly lifts its head, then
drinks the light (T_SURGE): its glow surges to brilliant emerald, the leaves spread and it shoots up. Claude's eyes
fly wide and fill with its green light; the focus racks from the sprout to Claude's welling eyes."""
import math
import bpy
from mathutils import Vector

from lu import world, layout, post, fx, sky, anim, acting, claude, sprout, framing, scene
from shots import act_bloom as A
from shots.b16 import summit_dressing

T_PLANT = 0.6
T_SURGE = 1.4


def make(f0, f1):
    fp = f0 + int(round(T_PLANT * 24))
    fs = f0 + int(round(T_SURGE * 24))
    W = world.World("beam", focus=tuple(A.PLANT[:2]), tear=0.5, frames=(f0, f1))
    summit_dressing(W, [tuple(A.KNEEL[:2]), tuple(A.PLANT[:2])])
    sky.key(f0, Tear=0.5, Rays=0.75)
    from lu import dress
    _az = math.radians(A.HEADING - 118.0)
    dress.mow((A.PLANT.x + math.cos(_az) * 1.1, A.PLANT.y + math.sin(_az) * 1.1), 0.75)
    sky.key(f1, Tear=0.56, Rays=0.85)
    beam = fx.sunbeam(f0=f0, keys=[(f0, 1.0), (fs - 1, 1.0), (fs + 4, 1.35), (f1, 1.2)], motes_n=420)
    for k in ("beam", "contact"):              # the camera sits inside the shaft here: keep only its light + motes
        if beam.get(k) is not None:
            beam[k].hide_render = True
    if W.volume is not None:
        A.key_prop(W.volume, "density", [(f0, 0.0048), (fs, 0.0048), (fs + 6, 0.006)])
    if "rain" in W.fx:
        fx.amount(W.fx["rain"], f0, 0.14)
    sp_l = bpy.data.objects.get("LU_SunPatch")

    K = A.on_ground(W, A.KNEEL)
    zs = A.surface_z(A.PLANT.x, A.PLANT.y, top=K.z + 3.0) or W.ground(A.PLANT.x, A.PLANT.y)
    SP = Vector((A.PLANT.x, A.PLANT.y, zs))
    H = A.HEADING
    lp = A.world_to_local(K, H, SP)                       # the plant point in Claude's root space (~(0, -0.47, ~0))

    # ---------------------------------------------------------------- the sprout (world-placed, hands follow it)
    S = sprout.Sprout("Sprout")
    framing.register_char(S)

    def lift(t):                                          # height of the sprout's base above the soil
        if t < T_PLANT:
            u = A.smooth(t / T_PLANT)
            return 0.16 * (1 - u) ** 1.4
        return -0.012 * A.smooth((t - T_PLANT) / 0.12)
    st = anim.Track(sprout.DEFAULT)
    limp = dict(acting.S_SPROUT, glow=0.42, health=0.25, droop=0.65, head_nod=22.0, leafL_droop=0.6,
                leafR_droop=0.65, eye_open=0.3, look_y=-0.5, mouth=-0.2, heading=H - 180.0, grow=1.0)
    st.pose(0.0, limp)
    st.pose(0.95, limp)
    # in the light it slowly lifts its face to it ...
    st.pose(T_SURGE - 0.05, dict(limp, glow=0.75, health=0.5, droop=0.25, head_nod=-18.0, leafL_droop=0.25,
                                 leafR_droop=0.3, eye_open=0.15, look_y=0.9, mouth=0.0), ease="soft")
    # ... and drinks it: the surge
    drink = dict(acting.S_DRINK, heading=H - 180.0, grow=1.55, glow=2.2, health=1.0)
    st.pose(T_SURGE + 0.22, drink, ease="snap")
    st.pose(T_SURGE + 0.65, dict(drink, grow=2.05, glow=1.7, lean=-6.0, head_nod=-20.0), ease="back")
    happy = dict(acting.S_HAPPY, heading=H - 180.0, grow=2.1, glow=1.5, lean=6.0, head_nod=-12.0, look_y=0.55,
                 leafL_reach=45.0, leafR_reach=50.0)
    st.pose(2.2, happy, ease="inout")
    st.pose(2.6, dict(happy, leafL_reach=52.0, leafR_reach=40.0))
    st.layer(lambda t, p: p.update(x=SP.x, y=SP.y, z=SP.z + lift(t)))
    st.layer(acting.sprout_breathe(amp=0.02, rate=0.6))
    st.layer(anim.blinks(times=[0.4, 2.05], dur=0.14))
    anim.anchor(st, sprout.DEFAULT)
    S.bake(lambda f: st.at((f - f0) / 24), f0, f1)
    A.scale_sprout_light(S, 0.4)

    # ---------------------------------------------------------------- Claude
    C = W.claude("Claude")
    tr = anim.Track(claude.DEFAULT)

    def hands(t_, z, dx=0.15, dy=0.03, extra=None):
        d = dict(armL_ik=1.0, armR_ik=1.0, armL_follow=0.0, armR_follow=0.0, handL_x=lp.x + dx, handR_x=lp.x - dx,
                 handL_y=lp.y + dy, handR_y=lp.y + dy, handL_z=z, handR_z=z, armL_twist=60.0, armR_twist=60.0,
                 handL_curl=0.5, handR_curl=0.5, handL_bend=10.0, handR_bend=10.0, armL_pole=30.0, armR_pole=30.0)
        if extra:
            d.update(extra)
        return d
    tender = dict(eye_open=0.8, eye_tilt=0.7, lower_lid=0.22, look_y=-0.75, pupil=1.25, glint=1.2, smile=0.0,
                  tears=0.25)
    base = dict(x=K.x, y=K.y, z=K.z, heading=H, crouch=1.0, lean=9.0, bend=5.0, head_nod=7.0, squash=-0.02)
    base.update(A.MAT_BEAM, brand=0.2, vivid=0.0, wet=0.05)
    tr.pose(0.0, dict(base, **tender), **hands(0, 0.21))
    # lowering it ...
    tr.pose(T_PLANT - 0.05, dict(base, lean=13.0, head_nod=10.0, squash=-0.05, **tender), ease="inout",
            **hands(0, 0.05))
    # ... pressing it in, then two small pats of the earth round it
    tr.key(T_PLANT + 0.08, "out", squash=-0.07, handL_z=0.03, handR_z=0.03)
    for k, tt in enumerate((0.78, 0.95)):
        tr.key(tt - 0.07, "out", handL_z=0.075, handR_z=0.075, handL_x=lp.x + 0.12, handR_x=lp.x - 0.12)
        tr.key(tt, "in", handL_z=0.03, handR_z=0.03, squash=-0.05 + 0.01 * k)
    # sits back, hands clasped at its chest: waiting, afraid to hope
    wait = dict(lean=3.0, bend=3.0, head_nod=6.0, squash=0.0, armL_ik=0.0, armR_ik=0.0, armL_up=-62.0,
                armR_up=-62.0, armL_fwd=38.0, armR_fwd=38.0, armL_bend=35.0, armR_bend=35.0, armL_twist=20.0,
                armR_twist=20.0, handL_curl=0.7, handR_curl=0.7, eye_open=0.95, eye_tilt=0.95, lower_lid=0.2, look_y=-0.6, pupil=1.35, tears=0.4,
                mouth_press=0.3, smile=-0.1)
    tr.pose(1.28, wait, ease="inout")
    tr.pose(T_SURGE - 0.02, dict(wait, look_y=-0.45, eye_open=1.0))
    # T_SURGE: the light flares, its eyes fly wide, it rocks back
    gasp = dict(lean=-5.0, bend=-4.0, head_nod=2.0, squash=0.07, eye_open=1.32, eye_tilt=0.25, lower_lid=0.0,
                pupil=1.55, glint=1.45, look_y=-0.3, mouth_o=0.5, mouth_open=0.22, mouth_press=0.0, smile=0.0,
                tears=0.5, armL_up=-45.0, armR_up=-45.0, armL_fwd=30.0, armR_fwd=30.0, armL_bend=20.0, armR_bend=20.0)
    tr.pose(T_SURGE + 0.12, gasp, ease="snap")
    # ... and wonder: soft wide eyes brimming, the first smile, the hands opening
    wonder = dict(gasp, lean=-2.0, bend=-6.0, head_nod=4.0, squash=0.03, eye_open=1.15, eye_tilt=0.5,
                  eye_happy=0.3, pupil=1.5, look_y=-0.2, mouth_o=0.15, mouth_open=0.12, smile=0.45, tears=0.85,
                  armL_up=-35.0, armR_up=-35.0, armL_fwd=22.0, armR_fwd=22.0, armL_bend=30.0, armR_bend=30.0,
                  handL_curl=0.3, handR_curl=0.3)
    tr.pose(2.05, wonder, ease="inout")
    tr.pose(2.6, dict(wonder, eye_happy=0.4, smile=0.55, head_tilt=-6.0))
    tr.layer(acting.breathe(amp=0.016, rate=0.6, arms=1.0))
    tr.layer(anim.blink_at(1.02, dur=0.4, depth=0.9))                  # a slow, hoping blink
    tr.layer(anim.blinks(times=[0.3, 2.3], dur=0.15))
    tr.layer(anim.saccades(seed=17, amp=0.05, every=(0.4, 0.9)))
    anim.settle(tr, claude.DEFAULT, max_gap=0.8)
    C.bake(lambda f: tr.at((f - f0) / 24), f0, f1)
    C.tear("R", fs + 14, dur=1.2)

    # ---------------------------------------------------------------- FX: soil crumbs, the surge burst
    # the surge flare: a soft green-gold glow blooming out of the sprout (a lit-haze card, not post bloom)
    flare = fx.glow_orb(SP + Vector((0, 0, 0.16)), 0.55, 0.0, name="SurgeFlare")
    A.key_prop(flare, "glow", [(fs - 2, 0.0), (fs + 2, 0.75), (fs + 10, 0.35), (f1, 0.22)])
    # (kept clear of the lens: specks right at the camera smear into a milky wash)
    pb = fx.pollen(tuple(SP + Vector((-0.05, -0.05, 0.22))), (0.55, 0.55, 0.45), 90, fs, seed=17, name="SurgePollen")
    fx.amount(pb, fs - 1, 0.0)
    fx.amount(pb, fs + 2, 1.0)
    fx.motes(tuple(SP + Vector((-0.25, -0.25, 1.0))), (1.0, 1.0, 1.0), 120, f0, mote=(0.003, 0.007),
             color=(1.0, 0.85, 0.5), k=5.0, speed=0.06, amp=0.3, rise=-0.02, seed=71, name="PlantMotes")

    # ---------------------------------------------------------------- camera: CU from Claude's front-right, low
    sc = bpy.context.scene
    # low in front of the sprout, looking up past it at Claude's face bowed over it (its eyes come to us)
    az = math.radians(H - 90.0 - 28.0)
    e0 = SP + Vector((math.cos(az), math.sin(az), 0)) * 1.2 + Vector((0, 0, 0.34))
    face0 = K + Vector((0, 0, 0.40)) + A.FWD * 0.05
    mid0 = (SP + Vector((0, 0, 0.08))).lerp(face0, 0.45)
    e1 = e0 + (mid0 - e0).normalized() * 0.06 + Vector((0, 0, 0.03))
    mid1 = (SP + Vector((0, 0, 0.14))).lerp(face0, 0.45)

    def cam_fn(t):
        u = A.smooth(t / 2.5)
        rack = A.smoother((t - (T_SURGE + 0.15)) / 0.55)
        eye = A.vlerp(e0, e1, u)
        f_sp = (SP + Vector((0, 0, 0.06)) - eye).length
        f_face = (face0 - eye).length
        return dict(eye=eye, tgt=A.vlerp(mid0, mid1, u), lens=30.0, fstop=2.2, focus=A.lerp(f_sp, f_face, rack))
    cam = scene.camera("CamB17", lens=30.0)
    A.bake_cam(cam, cam_fn, f0, f1 - 1, shake=lambda t: 0.25, seed=17)
    sc.camera = cam

    # ---------------------------------------------------------------- lights: gold beam rim + soft face key
    sc.frame_set(f0 + 12)
    sun_dir = sky.sun_vec()
    rim = C.rim_light(e0, sun_dir, col=(1.0, 0.70, 0.36), energy=25.0)
    # the beam on Claude: its own gold key from the sun direction (the set's hot spot would burn the clay white)
    for ln in ("LU_SunPatch", "LU_Sun"):          # (the cool storm sun would turn the clay lilac)
        lo = bpy.data.objects.get(ln)
        if lo is not None:
            A.exclude_from_light(lo, (C,))
    key = A.char_key(C, sun_dir, 60.0, col=(1.0, 0.58, 0.26), dist=3.0, size=1.5)
    fl = C.face_light(e0, energy=0.6, col=(1.0, 0.82, 0.6))

    A.animatic_readable((C, S), extra=("SurgeFlare", "PlantMotes", "SurgePollen"))
    P = post.preset("beam", focus_xy=(0.5, 0.5))
    P["bloom"] = [(f0, 0.25), (fs - 1, 0.25), (fs + 3, 0.4), (fs + 30, 0.3)]     # the lit clay must not bloom
    P["bloom_thr"] = 0.95
    P["exposure"] = [(f0, -0.05), (fs - 1, -0.05), (fs + 3, 0.02), (fs + 24, -0.06)]
    return dict(post=P)
