"""B18 (46.88-51.88, 8 beats): THE BLOOM. One long crane up and pull-out from the summit over the valley.
It opens low and close on the glowing sprout and Claude kneeling behind it, the storm-dark valley beyond. On T_WAVE the
sprout flares and life bursts out of the soil: grass and flowers spring up round them in a racing ring, petals and
pollen swirl up, Claude rocks back, rises and flings its arms up in joy while the sprout shoots up into a sapling. The
camera launches up and back (north) and tilts down: the wave of colour pours down the mountain and across the whole
valley, blossom bursting onto the charred trunks, and reaches the far ridges on T_WAVE_END while the storm parts into
peach, rose and gold."""
import math
import bpy
from mathutils import Vector, Quaternion

from lu import world, layout, post, fx, sky, anim, acting, claude, sprout, framing, scene
from shots import act_bloom as A
from shots.b16 import summit_dressing

T_WAVE = 0.3
T_WAVE_END = 4.4


def make(f0, f1):
    fw = f0 + int(round(T_WAVE * 24))
    fe = f0 + int(round(T_WAVE_END * 24))
    W = world.World("bloom", focus=layout.PEAK, wave=True, frames=(f0, f1))
    summit_dressing(W, [tuple(A.KNEEL[:2]), tuple(A.PLANT[:2])], prefix=("CoverAsh",))
    W.bloom_wave(fw, fe)
    W.sky_transition(f0 + 3, fe + 4, "beam", "bloom")
    # the last of the beam still on the summit as the shot opens; it dissolves into full sun as the sky parts
    patch = sky._patch_light((1.0, 0.76, 0.42), 10.0, 3.6)
    A.key_energy(patch, [(f0, patch.data.energy), (fw + 2, patch.data.energy), (fw + 30, 0.0)])
    beam = fx.sunbeam(f0=f0, keys=[(f0, 1.0), (fw, 1.0), (fw + 4, 1.2), (fw + 14, 0.0)], motes_n=200)
    if beam.get("contact") is not None:
        beam["contact"].hide_render = True

    K = A.on_ground(W, A.KNEEL)
    zs = A.surface_z(A.PLANT.x, A.PLANT.y, top=K.z + 3.0) or W.ground(A.PLANT.x, A.PLANT.y)
    SP = Vector((A.PLANT.x, A.PLANT.y, zs - 0.012))
    H = A.HEADING

    # ---------------------------------------------------------------- the sprout: flares, shoots up into a sapling
    S = sprout.Sprout("Sprout")
    framing.register_char(S)
    st = anim.Track(sprout.DEFAULT)
    happy = dict(acting.S_HAPPY, x=SP.x, y=SP.y, z=SP.z, heading=H - 180.0, grow=2.1, glow=1.5, lean=6.0,
                 head_nod=-12.0, look_y=0.55, leafL_reach=45.0, leafR_reach=50.0)
    st.pose(0.0, happy)
    st.pose(T_WAVE - 0.04, dict(happy, squash=-0.12, lean=10.0, head_nod=8.0, eye_happy=0.0, eye_open=0.2,
                                leafL_reach=10.0, leafR_reach=10.0, glow=1.7), ease="in")      # gathers itself
    burst = dict(acting.S_DRINK, x=SP.x, y=SP.y, z=SP.z, heading=H - 180.0, grow=2.55, glow=2.6, squash=0.15,
                 leafL_reach=75.0, leafR_reach=75.0)
    st.pose(T_WAVE + 0.12, burst, ease="snap")
    sap = dict(acting.S_HAPPY, x=SP.x, y=SP.y, z=SP.z, heading=H - 180.0, grow=3.0, glow=1.6, lean=-4.0,
               head_nod=-16.0, look_y=0.6, leafL_reach=60.0, leafR_reach=65.0)
    st.pose(1.3, sap, ease="back")
    st.pose(5.0, dict(sap, leafL_reach=40.0, leafR_reach=55.0, lean=4.0))
    st.layer(acting.sprout_breathe(amp=0.02, rate=0.7))
    anim.anchor(st, sprout.DEFAULT)
    S.bake(lambda f: st.at((f - f0) / 24), f0, f1)
    A.scale_sprout_light(S, 0.25)

    # ---------------------------------------------------------------- Claude: startle, rise, arms up, hop for joy
    C = W.claude("Claude")
    tr = anim.Track(claude.DEFAULT)
    base = dict(x=K.x, y=K.y, z=K.z, heading=H)
    base.update(A.MAT_BLOOM)
    kneel = dict(base, crouch=1.0, lean=4.0, bend=2.0, head_nod=6.0, armL_up=-40.0, armR_up=-40.0, armL_fwd=20.0,
                 armR_fwd=20.0, armL_bend=30.0, armR_bend=30.0, eye_open=1.1, eye_happy=0.35, eye_tilt=0.45,
                 look_y=-0.25, tears=0.8, smile=0.4)
    tr.pose(0.0, kneel)
    tr.pose(T_WAVE, kneel)
    # the burst: it rocks back, arms flung out, eyes flying wide
    tr.pose(T_WAVE + 0.12, dict(kneel, crouch=0.75, lean=-12.0, bend=-10.0, head_nod=-6.0, squash=0.1,
                                armL_up=15.0, armR_up=15.0, armL_fwd=-5.0, armR_fwd=-5.0, armL_bend=10.0,
                                armR_bend=10.0, eye_open=1.32, eye_happy=0.0, eye_tilt=0.2, look_y=0.1, smile=0.0,
                                mouth_o=0.4, mouth_open=0.2), ease="snap")
    # it gets up, looking round as colour races out across the ground
    look_l = dict(base, crouch=0.15, lean=-2.0, bend=-4.0, head_nod=-4.0, head_turn=28.0, armL_up=-10.0,
                  armR_up=-10.0, armL_fwd=10.0, armR_fwd=10.0, armL_bend=25.0, armR_bend=25.0, eye_open=1.25,
                  eye_happy=0.1, look_x=0.8, look_y=0.0, tears=0.9, smile=0.3, mouth_o=0.2)
    tr.pose(0.95, look_l, ease="inout")
    tr.pose(1.3, dict(look_l, head_turn=-24.0, look_x=-0.8), ease="inout")
    # and throws its arms up: joy
    joy = dict(base)
    joy.update(acting.B_JOY)
    joy.update(crouch=0.0, eye_open=0.7, eye_happy=1.0, eye_tilt=0.0, look_y=0.5, tears=1.0, smile=1.0,
               mouth_open=0.45, mouth_o=0.0)
    tr.pose(1.7, joy, ease="back")
    tr.pose(2.4, dict(joy, head_tilt=10.0, armL_up=80.0, armR_up=64.0))
    tr.pose(3.1, dict(joy, head_tilt=-8.0, armL_up=66.0, armR_up=80.0, heading=H + 18.0))
    tr.pose(4.2, dict(joy, head_tilt=4.0, heading=H + 30.0))
    tr.layer(anim.hop_arc(1.62, 1.95, 0.13, squash=0.14))
    tr.layer(anim.hop_arc(2.5, 2.8, 0.10, squash=0.12))
    tr.layer(anim.hop_arc(3.35, 3.62, 0.08, squash=0.1))
    tr.layer(acting.breathe(amp=0.02, rate=0.9))
    tr.layer(anim.blinks(times=[0.12, 1.2], dur=0.15))
    anim.settle(tr, claude.DEFAULT, max_gap=0.9)
    C.bake(lambda f: tr.at((f - f0) / 24), f0, f1)

    # ---------------------------------------------------------------- FX at the summit: the burst from the soil
    fx.petal_burst(SP + Vector((0, 0, 0.15)), fw, n=90, f1=f1, speed=(1.2, 3.4), up=0.85, spread=0.35, seed=18)
    fx.pollen_burst(SP + Vector((0, 0, -0.3)), fw, n=160, f1=f1 + 24, seed=18)

    # ---------------------------------------------------------------- the crane
    face = K + Vector((0, 0, 0.42))
    pc = (SP + Vector((0, 0, 0.12))).lerp(face, 0.55)
    az0, el0, d0 = math.radians(H - 90.0 + 26.0), math.radians(11.0), 1.8
    az1, el1, d1 = math.radians(80.0), math.radians(32.0), 122.0

    def sph(az, el, d):
        return Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * d

    e_start = SP + sph(az0, el0, d0)
    e_end = SP + sph(az1, el1, d1)
    q0 = (pc - e_start).to_track_quat("-Z", "Y")
    yaw = math.atan2(0.0 - e_end.y, 5.0 - e_end.x)
    fwd_end = Vector((math.cos(yaw) * math.cos(math.radians(12.0)), math.sin(yaw) * math.cos(math.radians(12.0)),
                      -math.sin(math.radians(12.0))))
    q1 = fwd_end.to_track_quat("-Z", "Y")

    def cam_fn(t):
        u = max(0.0, (t - (T_WAVE - 0.05)) / (5.0 - T_WAVE + 0.05))
        launch = A.smooth(min(1.0, u / 0.07))
        s = (1 - (1 - u) ** 2.3) * launch                       # log-distance: fast launch, long glide
        d = d0 * (d1 / d0) ** s
        se = A.smoother(u ** 0.8)
        az = A.lerp(az0, az1, A.smooth(u * 1.4))
        el = A.lerp(el0, el1, se)
        eye = SP + sph(az, el, d)
        r = A.smoother((t - 0.55) / 3.6)
        q = q0.slerp(q1, r)
        fwd = q @ Vector((0, 0, -1))
        return dict(eye=eye, tgt=eye + fwd * 10.0, lens=A.lerp(28.0, 18.0, se))
    from lu import dress
    for k in range(5):
        dress.mow(tuple(e_start.lerp(pc, k / 5.0)[:2]), 0.7, prefix=("CoverAsh",))
    dress.mow(tuple(e_start[:2]), 1.8, prefix=("CoverAsh",))
    sc = bpy.context.scene
    cam = scene.camera("CamB18", lens=28.0)
    A.bake_cam(cam, cam_fn, f0, f1 - 1, shake=lambda t: 0.35 * (1 - A.smooth((t - 0.4) / 1.5)) + 0.08, seed=18)
    sc.camera = cam

    # ---------------------------------------------------------------- character light for the opening close-up
    sc.frame_set(f0 + 2)
    fl = C.face_light(e_start, energy=1.0, col=(1.0, 0.85, 0.65))
    A.key_energy(fl, [(f0, 1.0), (fw + 24, 1.0), (fw + 40, 0.0)])
    rim = C.rim_light(e_start, sky.sun_vec(), col=(1.0, 0.75, 0.42), energy=60.0)
    A.key_energy(rim, [(f0, 60.0), (fw + 30, 60.0), (fw + 48, 0.0)])
    A.exclude_from_light(patch, (C,))          # the beam spot would burn the clay pale in the close opening
    key = A.char_key(C, sky.sun_vec(), 45.0, col=(1.0, 0.62, 0.30), dist=3.0, size=1.5)
    A.key_energy(key, [(f0, 45.0), (fw + 24, 45.0), (fw + 40, 0.0)])

    A.animatic_readable((C, S), extra=("BloomBurst",))
    P = post.transition("beam", "bloom", f0 + 3, fe + 4, focus_xy=(0.5, 0.45))
    P["exposure"] = [(f0, -0.1), (fw - 1, -0.1), (fw + 3, 0.12), (fw + 20, 0.0), (fe, 0.05)]
    # the air clears as the storm parts: less haze, richer colour - the most saturated frame of the film
    P["haze_amt"] = [(f0 + 3, 0.7), (fw + 30, 0.36), (fe + 4, 0.2)]
    P["sat"] = [(f0 + 3, 0.95), (fw + 30, 1.3), (fe + 4, 1.45)]
    return dict(post=P)
