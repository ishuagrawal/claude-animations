"""B16 (41.25-44.38, 5 beats): wide low angle on the last ledge below the summit.
Battered, wet Claude limps and scrambles up the final metres with the dim sprout at its chest, stumbling once. The
storm tears open (T_BEAM) and one golden shaft strikes the summit just ahead of it; Claude falters and looks up into
it, the gold rimming its silhouette, then walks on into the light and sinks to its knees there, lifting the sprout.
The camera sits low behind it on the slope (Claude moves left -> right and up, into the light)."""
import math
import bpy
import numpy as np
from mathutils import Vector

from lu import world, layout, post, fx, sky, anim, acting, claude, sprout, framing, scene, dress
from shots import act_bloom as A

T_BEAM = 1.6

S2 = (29.80, 147.78)                       # where it kneels (by the soil; B17 continues from A.KNEEL)
DIRV = (0.766, 0.643)                      # travel direction (az ~40: up the SW lip toward the soil)
KNEEL_AT = 2.45


def _profile():
    """Speed profile (m/s) -> distance table: a stumbling scramble, a falter when the light strikes, a few steps on
    into the light, stop."""
    ts = np.linspace(0.0, 3.2, 641)
    v = np.full_like(ts, 1.12)
    v *= 1.0 - 0.72 * np.exp(-((ts - 0.84) / 0.10) ** 2)                     # the stumble
    falter = 1.0 - 0.82 * np.clip((ts - T_BEAM) / 0.12, 0, 1) * np.clip((1.98 - ts) / 0.2, 0, 1)
    v *= falter
    v *= np.clip((KNEEL_AT - ts) / 0.35, 0, 1)                                 # slows to a stop as it kneels
    d = np.concatenate([[0.0], np.cumsum((v[1:] + v[:-1]) / 2 * np.diff(ts))])
    return ts, d


_TS, _D = _profile()
S0 = (S2[0] - DIRV[0] * _D[-1], S2[1] - DIRV[1] * _D[-1])


def route(t):
    dd = float(np.interp(t, _TS, _D))
    return (S0[0] + DIRV[0] * dd, S0[1] + DIRV[1] * dd)


def summit_dressing(W, lane=(), prefix=("Cover",)):
    """Shared summit tweaks for B16-B19: nudge the crown rock that crowds the approach, clear a lane (in the bloom
    pass prefix=("CoverAsh",) so only the dead debris goes and the new meadow stays)."""
    r = bpy.data.objects.get("Crown4")
    if r is not None:
        r.location.x -= 0.45
    for p in lane:
        dress.mow(p, 0.8, prefix=prefix)


def make(f0, f1):
    fb = f0 + int(round(T_BEAM * 24))
    W = world.World("beam", focus=(29.4, 147.0), tear=0.0, frames=(f0, f1))
    lane = [route(t) for t in np.linspace(0.0, 3.0, 9)] + [(29.6, 144.9), (29.4, 145.6), (29.75, 145.9),
                                                            (29.2, 146.3)]
    summit_dressing(W, lane)

    # ---------------------------------------------------------------- sky: the storm tears open on T_BEAM
    W.sky_transition(fb - 1, fb + 10, "low", "beam", Tear=0.5, Rays=0.75)
    sky.key(f1, Tear=0.6, Rays=0.85)
    beam = fx.sunbeam(f0=f0, keys=[(fb - 1, 0.0), (fb + 3, 0.75), (fb + 9, 1.0)], motes_n=320)
    if beam.get("contact") is not None:          # the ground glow reads as a flat bar from this low camera
        A.key_prop(beam["contact"], "glow", [(fb - 1, 0.0), (fb + 9, 0.1)])
    if W.volume is not None:
        A.key_prop(W.volume, "density", [(fb - 1, 0.0012), (fb + 10, 0.0048)])
    if "rain" in W.fx:
        fx.amount(W.fx["rain"], fb, 0.45)
        fx.amount(W.fx["rain"], fb + 20, 0.16)

    # ---------------------------------------------------------------- Claude
    C = W.claude("Claude")
    S = sprout.Sprout("Sprout")
    framing.register_char(S)
    S.ride(C, "cradle")
    hd_travel = math.degrees(math.atan2(DIRV[0], -DIRV[1]))

    tr = anim.Track(claude.DEFAULT)
    tired = dict(eye_open=0.55, eye_tilt=-0.35, lower_lid=0.36, mouth_open=0.36, teeth=0.45, mouth_wide=0.3,
                 smile=-0.3, look_y=0.25, pupil=0.95)
    base = dict(acting.B_HOLD)
    base.update(acting.B_LIMP, crouch=0.35, lean=10.0, bend=7.0, head_nod=-6.0)
    base.update(tired)
    base.update(A.MAT_BEAM)
    tr.pose(0.0, base, heading=hd_travel)
    tr.key(2.3, heading=hd_travel)
    tr.key(2.9, heading=A.HEADING)
    tr.pose(0.72, base)
    # the stumble: a leg gives, the body drops and pitches; it catches itself
    tr.key(0.84, "out", crouch=0.72, lean=19.0, roll=-11.0, head_nod=10.0, squash=-0.08, eye_open=0.2,
           eye_squeeze=0.5, teeth=1.0, mouth_open=0.5)
    tr.key(1.12, "inout", crouch=0.38, lean=11.0, roll=-5.0, head_nod=-6.0, squash=0.0, eye_open=0.55,
           eye_squeeze=0.0, teeth=0.6, mouth_open=0.36)
    tr.pose(1.55, base)
    # T_BEAM: light floods the summit ahead; it falters, looks up, a gasp
    tb = T_BEAM
    tr.key(tb + 0.07, "out", squash=0.09, lean=-3.0, crouch=0.2, bend=0.0, head_nod=-26.0, eye_open=1.32,
           pupil=0.72, mouth_o=0.85, mouth_open=0.55, teeth=0.0, smile=0.0, mouth_wide=-0.25, eye_tilt=0.35,
           lower_lid=0.05, look_y=0.85, roll=0.0)
    tr.key(tb + 0.4, "inout", squash=0.03, lean=2.0, head_nod=-22.0, eye_open=1.18, pupil=1.4, glint=1.4,
           mouth_o=0.35, mouth_open=0.32, smile=0.25, eye_tilt=0.55, look_y=0.75)
    # it walks on into the light and sinks to its knees, chest opening, lifting the sprout toward the beam
    tr.key(2.3, "inout", crouch=0.28, bend=3.0, head_nod=-20.0, lean=4.0)
    kneel = dict(crouch=1.0, lean=2.0, bend=-6.0, head_nod=-18.0, squash=-0.03, handL_z=0.36, handR_z=0.36,
                 handL_y=-0.34, handR_y=-0.34, eye_open=1.0, eye_tilt=0.65, pupil=1.45, tears=0.55, smile=0.2,
                 look_y=0.6, mouth_open=0.0, mouth_o=0.0)
    tr.pose(2.72, kneel, ease="soft")
    # ...and lifts the sprout up into the light in both hands (an offering; B17 lowers it into the soil)
    offer = dict(kneel, bend=-13.0, lean=-2.0, head_nod=-24.0, squash=0.05, handL_x=0.10, handR_x=-0.10,
                 handL_y=-0.30, handR_y=-0.30, handL_z=0.66, handR_z=0.66, cradle_y=-0.02, cradle_z=0.39,
                 handL_bend=-25.0, handR_bend=-25.0, eye_happy=0.25, look_y=0.9)
    tr.pose(3.12, offer, ease="inout")
    tr.pose(3.3, offer)
    # layers: the scramble (IK-planted feet up the slope), a limp, panting, blinks, saccades
    pts = [(t, *route(t)) for t in np.linspace(0.0, 3.2, 129)]
    path = anim.Path(pts, ease_="linear")
    tr.layer(acting.gait(path, z_fn=W.ground, stride=0.21, duty=0.6, lift=0.05, bob=0.014, lean=6.0, sway=4.0,
                         arm_swing=0.0, crouch=0.12, v_full=0.35, face=False))

    def limp_layer(t, p):
        d = path.dist(t)
        amt = min(1.0, path.speed(t) / 0.5)
        dip = max(0.0, math.sin(2 * math.pi * d / 0.42 + 0.6)) ** 3 * amt
        p["crouch"] = p.get("crouch", 0.0) + 0.14 * dip
        p["roll"] = p.get("roll", 0.0) - 5.5 * dip
        p["head_tilt"] = p.get("head_tilt", 0.0) - 3.0 * dip
    tr.layer(limp_layer)
    pant = acting.breathe(amp=0.03, rate=1.9, arms=2.5)
    calm = acting.breathe(amp=0.022, rate=0.75, arms=2.0)
    tr.layer(lambda t, p: pant(t, p) if t < tb + 0.4 else calm(t, p))
    tr.layer(anim.blinks(times=[0.35, 1.3, 2.1, 2.98], dur=0.16))
    tr.layer(anim.saccades(seed=16, amp=0.08, every=(0.5, 1.2)))
    anim.settle(tr, claude.DEFAULT, max_gap=0.9)
    C.bake(lambda f: tr.at((f - f0) / 24), f0, f1)

    # the sprout at its chest: limp and dim; it feels the light and lifts its head a little toward it
    st = anim.Track(sprout.DEFAULT)
    dim = dict(acting.S_SPROUT, glow=0.28, health=0.18, droop=0.6, head_nod=18.0, leafL_droop=0.65,
               leafR_droop=0.7, eye_open=0.3, look_y=-0.4, mouth=-0.2, heading=0.0, z=0.02)
    st.pose(0.0, dim)
    st.pose(tb + 0.35, dim)
    st.pose(tb + 1.25, dict(dim, glow=0.5, health=0.32, droop=0.32, head_nod=-14.0, leafL_droop=0.4,
                            leafR_droop=0.45, eye_open=0.55, look_y=0.8, mouth=0.05), ease="soft")
    st.layer(acting.sprout_shiver(0.0, tb + 0.3, amp=0.35))
    anim.anchor(st, sprout.DEFAULT)
    S.bake(lambda f: st.at((f - f0) / 24), f0, f1)

    # grit kicked loose at the stumble, the knees going down in the wet ground
    for tt, sz in ((0.84, 0.55), (2.7, 0.6)):
        fx.dust_puff(route(tt), f0 + int(tt * 24), size=sz, n=6, color=(0.20, 0.19, 0.21), opacity=0.35)

    # ---------------------------------------------------------------- camera: low behind it on the slope
    sc = bpy.context.scene
    e0 = A.on_ground(W, (29.95, 144.15), 0.7)
    t0 = A.on_ground(W, (28.95, 146.9), 0.55)
    e1 = e0 + Vector((-0.1, 0.15, -0.05))
    t1 = A.on_ground(W, (29.95, 148.5), 1.3)

    def cam_fn(t):
        u = A.smoother((t - (tb + 0.05)) / 1.35)
        return dict(eye=A.vlerp(e0, e1, u), tgt=A.vlerp(t0, t1, u), lens=A.lerp(22.0, 18.0, u))
    cam = scene.camera("CamB16", lens=20.0)
    A.bake_cam(cam, cam_fn, f0, f1 - 1, shake=lambda t: 1.0 if t < tb else 1.0 - 0.8 * A.smooth((t - tb) / 0.8),
               seed=16)
    sc.camera = cam

    # ---------------------------------------------------------------- character light: the gold rim of the beam
    sc.frame_set(fb + 6)
    sun_dir = sky.sun_vec()
    rim = C.rim_light(e1, sun_dir, col=(1.0, 0.72, 0.36), energy=360.0)
    A.key_energy(rim, [(fb - 1, 0.0), (fb + 6, 360.0)])
    A.follow_light(rim, C, rim.location - C.rig.matrix_world.translation, f0, f1)
    fill = C.face_light(e0, energy=5.0, col=(0.62, 0.70, 0.95))
    A.follow_light(fill, C, fill.location - C.rig.matrix_world.translation, f0, f1)

    A.animatic_readable((C, S))
    P = post.transition("low", "beam", fb - 1, fb + 12, focus_xy=(0.45, 0.42))
    P["exposure"] = [(fb - 1, -0.12), (fb + 3, 0.16), (fb + 16, 0.0)]
    P["bloom"] = [(fb - 1, 0.45), (fb + 6, 1.05), (fb + 30, 0.9)]
    return dict(post=P)
