"""B06 (17.50-20.00, 4 beats): Claude's POV across the valley, a longish lens: the far peak, and on its summit the last
patch of gold sun through the hole in the overcast, while the edge of the violet storm slides across the sky toward
it and the gold shrinks (the clock). Cut back (T_BACK) to a CU of Claude, standing now, the shivering sprout cupped in
its mitts at its chest: its eyes go from the peak down to the sprout and back up; the brows set, the body firms and
draws itself up: resolve (T_RESOLVE). Gold from the peak on its face, the violet storm behind.
Feeling: the decision (tension 4)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, sky, layout
from lu.anim import Track
from shots import act_ash as A

T_BACK = 1.4
T_RESOLVE = 2.0
STORM = (0.56, 0.66)                  # the storm deck slides toward the peak during the shot
HOLE = (0.3, 0.17)                   # the hole of sun over the summit shrinks


def make(f0, f1):
    dur = (f1 - f0) / 24
    F = lambda t: f0 + int(round(t * 24))
    lx, ly = A.LOOKOUT_XY
    hd = A.PEAK_HEADING
    W = world.World("threat", focus=(lx + 4.0, ly + 14.0), storm=STORM[0], frames=(f0, f1))
    g = W.ground
    from lu import dress
    dress.mow((lx, ly), 1.6)
    # ---- the clock: the storm advances, the hole closes, the patch of sun on the summit shrinks
    W.storm_advance(f0, f1, STORM[0], STORM[1])
    sky.key(f0, Hole=HOLE[0])
    sky.key(F(T_BACK), Hole=HOLE[0] * 0.75 + HOLE[1] * 0.25)
    sky.key(f1, Hole=HOLE[1])
    pg = W.fx.get("patch_glow")
    if pg is not None:
        for t, v in ((0.0, 0.32), (T_BACK, 0.25), (dur, 0.18)):
            pg["glow"] = v
            pg.keyframe_insert('["glow"]', frame=F(t))
    sky.flash(F(0.55), 0.45, az=150.0, el=16.0)
    sky.flash(F(1.05), 0.25, az=128.0, el=11.0, double=False)
    wa = W.fx.get("wind_ash")
    if wa:
        fx.amount(wa, f0, 0.7)
    W.gust(f0, f1 + 12, strength=1.1)
    # ---- Claude: standing at the lookout, the sprout cupped at its chest
    c = W.claude()
    base = dict(acting.B_HOLD)
    base.update(A.ASH, x=lx, y=ly, z=g(lx, ly), heading=hd, crouch=0.25, lean=4.0, bend=6.0, head_nod=-6.0,
                squash=-0.03, eye_open=1.05, eye_tilt=0.85, lower_lid=0.15, pupil=0.85, look_y=0.25, look_x=0.0,
                smile=-0.35, wobble=0.1, cradle_y=-0.02)
    tr = Track()
    tr.pose(0.0, base)
    tr.key(T_BACK + 0.12, "linear", look_y=0.25, head_nod=-6.0, eye_tilt=0.85)
    # eyes lead down to the sprout, then the head follows
    tr.key(T_BACK + 0.2, "out", look_y=-0.8, eye_open=0.95)
    tr.key(T_BACK + 0.36, "inout", head_nod=9.0, bend=9.0, eye_tilt=1.0, squash=-0.05)
    # ... and back up to the peak, eyes first
    tr.key(T_RESOLVE - 0.24, "out", look_y=0.3)
    tr.key(T_RESOLVE - 0.06, "inout", head_nod=-4.0, bend=4.0)
    # resolve: the brows set (lids slant in), the body draws itself up, the mitts tighten round the sprout
    tr.key(T_RESOLVE + 0.12, "out", eye_tilt=-0.85, eye_open=0.78, lower_lid=0.38, pupil=0.9, glint=1.2,
           squash=0.06, crouch=0.15, lean=6.0, head_nod=-7.0, mouth_press=0.8, smile=-0.12, wobble=0.0,
           handL_curl=0.75, handR_curl=0.75)
    tr.key(T_RESOLVE + 0.3, "inout", squash=0.04, head_nod=-5.0)
    tr.key(dur, "soft", squash=0.05, head_nod=-6.0, eye_tilt=-0.9)
    tr.layer(acting.breathe(0.016, 0.5, arms=1.0))
    tr.layer(anim.blink_at(T_RESOLVE - 0.16, dur=0.12))
    A.bake_claude(c, tr, f0, f1)
    # ---- the sprout in its mitts: shivering, dim, curled
    s = A.sprout("Sprout", light_scale=0.4)
    s.ride(c, "cradle")
    sp = dict(acting.S_SHIVER, x=0.0, y=0.02, z=0.0, heading=180.0 + 25.0, clod=1.0, glow=0.5, health=0.42,
              head_nod=18.0)
    st = Track()
    st.pose(0.0, sp)
    st.key(T_RESOLVE + 0.15, "inout", glow=0.5, look_y=0.0)
    st.key(dur, "soft", glow=0.62, look_y=0.4, head_nod=10.0)
    st.layer(acting.sprout_shiver(0.0, dur + 0.5, amp=0.8, freq=13.0))
    A.bake_sprout(s, st, f0, f1)
    # ---- camera 1: the POV, at Claude's eye height, the peak a little right of centre, storm edge on the left
    eye = Vector((lx, ly, g(lx, ly) + 0.55))
    P = Vector((layout.PEAK[0], layout.PEAK[1], g(*layout.PEAK) + 4.0))
    dirp = (P - eye).normalized()
    side = dirp.cross(Vector((0, 0, 1))).normalized()
    t0 = P - side * 14.0 + Vector((0, 0, 6.0))
    cam1 = A.cam_move("CamB06pov", f0, f1, [(0.0, "linear", eye, t0, 50.0, None),
                                            (T_BACK, "linear", eye + dirp * 0.15, t0 + Vector((0, 0, -1.5)), 52.0,
                                             None)], shake=0.12, seed=606)
    # ---- camera 2: CU of Claude from just off its eyeline (between it and the peak), low; the storm behind it
    E = (c.point("eyeL", F(T_RESOLVE)) + c.point("eyeR", F(T_RESOLVE))) * 0.5
    fwc = A.front(hd)
    lfc = A.left(hd)
    e2 = E + fwc * 1.75 - lfc * 0.72 + Vector((0, 0, -0.1))
    tgt2 = E + Vector((0, 0, -0.1))
    e3 = e2 + (tgt2 - e2) * 0.1
    cam2 = A.cam_move("CamB06cu", f0, f1, [(0.0, "linear", e2, tgt2, 62.0, (E - e2).length),
                                           (T_BACK, "linear", e2, tgt2, 62.0, (E - e2).length),
                                           (dur, "soft", e3, tgt2 + Vector((0, 0, 0.01)), 62.0, (E - e3).length)],
                      shake=0.04, seed=607, fstop=2.8, bind=False)
    A.cut(cam1, f0)
    A.cut(cam2, F(T_BACK))
    A.hide_render_range([c.col, s.col], f0, F(T_BACK))       # the POV sees through Claude's eyes
    A.mow_line(e2, Vector((lx, ly, 0.0)), 0.45)
    bpy.context.scene.camera = cam1
    # gold from the far patch of sun on the face, violet from the storm behind
    c.face_light(e2, energy=3.0, col=(1.0, 0.8, 0.52), dist=1.3, size=0.8, frame=F(T_RESOLVE))
    c.rim_light(e2, (-0.95, 0.33, 0.2), col=(0.7, 0.58, 1.0), energy=60.0, dist=1.6, frame=F(T_RESOLVE))
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("threat", focus_xy=(0.5, 0.5), sat=A.SAT))
