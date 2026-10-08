"""SH07 - CU, high angle: Claude's point of view, looking down into the crater by lantern light. The tiny star lies
curled in the charred bowl - dim, smoking, trembling. It senses someone, peeks, and looks up with huge scared eyes;
Claude's lantern swings in overhead and its warm light lands on it (T_FLINCH) - it flinches, squeezing shut, then
peeks out again. A weak flicker of its own glow, a pleading look up. Pity."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, layout, fx
from lu.anim import Track
from lu.star import DEFAULT as S_DEF
from shots import act1 as A
from shots.sh06 import claude_mark

T_FLINCH = 1.3        # the lantern light lands on the star: it flinches (the soundtrack reads this)
T_PEEK = 0.5          # eyes crack open
T_LOOK = 0.92         # looks up at Claude, eyes huge


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 20.7, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    A.hide_tail()
    A.constellation(O, lines=0.3, eye=0.0)
    cx, cy = layout.CRATER
    from shots.sh04 import TOUCH
    h_in = math.degrees(math.atan2(cx - TOUCH[0], -(cy - TOUCH[1])))
    CR = A.crater(W, (cx, cy), f0, f1, radius=0.5, heading=h_in, furrow=2.2, seed=7, glow=0.65, smoke=False)
    P2, hc = claude_mark()
    gz = W.ground(P2.x, P2.y)
    fwd = Vector((math.sin(math.radians(hc)), -math.cos(math.radians(hc)), 0))
    right = Vector((-fwd.y, fwd.x, 0)) * -1                 # Claude's right
    eye = Vector((P2.x, P2.y, gz)) + fwd * 0.06 + Vector((0, 0, 0.5))
    sp = CR["center"] + Vector((0, 0, 0.055))
    # ---------------- the star
    s = W.star()
    s.light_scale = 6.0
    to_cam = eye - sp
    hs = math.degrees(math.atan2(to_cam.x, -to_cam.y))      # face toward Claude
    tr = Track()
    O38, O44, O34, O40 = (A.star_rot(hs, p_) for p_ in (-38, -44, -34, -40))
    tr.pose(0.0, dict(x=sp.x, y=sp.y, z=sp.z, **O38, scale=A.STAR_SCALE, curl=46, squash=-0.16,
                      droop=16, glow=0.75, warmth=1.0, eye_open=0.0, eye_tilt=0.5, pupil=1.0, look_x=0.0, look_y=-0.3,
                      head=10, legs=-6, arms=-4))
    # senses something: the eyes crack open, a peek up
    tr.key(T_PEEK + 0.25, "inout", eye_open=0.45, look_y=0.4, head=4, curl=40)
    # looks up at Claude: huge, scared, a little uncurled
    tr.key(T_LOOK + 0.18, "out", eye_open=1.0, pupil=1.12, eye_tilt=0.62, look_y=0.85, curl=30, head=-6, squash=-0.1,
           **O44)
    # the light lands on it: FLINCH - squeezes shut and balls up
    tr.key(T_FLINCH - 0.02, "linear", eye_open=1.0, curl=30, squash=-0.1)
    tr.key(T_FLINCH + 0.09, "snap", eye_open=0.05, curl=54, squash=-0.24, head=14, droop=24, glow=0.4, **O34)
    # ...peeks out again into the warm light, eyes big and wet
    tr.key(T_FLINCH + 0.6, "inout", eye_open=0.78, pupil=1.1, curl=42, squash=-0.16, head=6, look_y=0.75, glow=0.5,
           **O40, droop=18)
    # a weak flicker of glow - a tiny hope - and a pleading look up
    tr.key(2.05, "inout", glow=0.95, warmth=1.0, eye_open=0.92, eye_tilt=0.7, look_y=0.9, curl=36, head=0)
    tr.key(dur, "soft", glow=0.75, warmth=1.0, eye_open=0.88, pupil=1.14)
    tr.layer(anim.tremble(0.0, dur, amp=2.2, freq=16, ramp=0.15))

    def flick(t, p):
        p["glow"] = p.get("glow", 0.3) * (1 + 0.14 * math.sin(t * 29) + 0.1 * math.sin(t * 12.3))
    tr.layer(flick)
    tr.layer(anim.blinks(times=[2.35], dur=0.14))
    anim.settle(tr, S_DEF, max_gap=0.45)
    s.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    fx.smoke("StarSmoke", sp + Vector((0, 0, 0.03)), f0, f1, rate=3.0, seed=17, color=(0.45, 0.44, 0.47), opacity=0.06,
             rise=0.16, grow=(0.01, 0.05), drift=(0.04, 0.06, 0.0))
    # ---------------- the lantern swings in overhead (Claude's right hand, just outside the top of frame)
    lan = A.lantern("Lantern", energy=10.0)
    lan["halo"].hide_render = True                          # just above frame: only its light shows
    hold0 = eye + right * 0.5 + fwd * 0.02 + Vector((0, 0, 0.05))
    hold1 = sp + (eye - sp) * 0.62 + right * 0.12 + Vector((0, 0, 0.42))

    def pivot(t):
        u = anim.ease("inout", (t - (T_FLINCH - 0.42)) / 0.42)
        return hold0.lerp(hold1, u) + Vector((0, 0, 0.04 * math.sin(math.pi * u)))
    A.hang(lan, pivot, f0, f1, init=(0.0, 0.0), damp=1.8, seed=7)
    # the pool of lantern light: a soft spot from the lantern whose pool slides across the bowl and onto the star
    sd = bpy.data.lights.new("LanternPool", "SPOT")
    sd.color = (1.0, 0.64, 0.32)
    sd.spot_size = math.radians(30)
    sd.spot_blend = 0.7
    sd.shadow_soft_size = 0.05
    pool = bpy.data.objects.new("LanternPool", sd)
    bpy.context.scene.collection.objects.link(pool)
    off = sp + right * 0.55 - fwd * 0.15
    for f in range(f0, f1 + 1):
        t = (f - f0) / 24
        u = anim.ease("inout", (t - (T_FLINCH - 0.42)) / 0.48)
        src = pivot(t) + Vector((0, 0, -0.12))
        aim = off.lerp(sp, u)
        pool.location = src
        pool.rotation_mode = "QUATERNION"
        pool.rotation_quaternion = (aim - src).to_track_quat("-Z", "Y")
        sd.energy = 20.0 + 160.0 * u
        pool.keyframe_insert("location", frame=f)
        pool.keyframe_insert("rotation_quaternion", frame=f)
        sd.keyframe_insert("energy", frame=f)
    # ...and the light itself, painted: a soft warm cone from the lantern that swings onto the star
    L0 = 0.62
    bm = fx.beam("LanternBeam", Vector((0, 0, 0)), Vector((0, 0, L0)), 0.02, 0.12, color=(1.0, 0.6, 0.28), strength=0.12)
    for f in range(f0, f1 + 1):
        t = (f - f0) / 24
        u = anim.ease("inout", (t - (T_FLINCH - 0.42)) / 0.48)
        src = pivot(t) + Vector((0, 0, -0.1))
        aim = off.lerp(sp, u)
        d = aim - src
        w = 0.15 + 0.85 * u
        bm.matrix_world = Matrix.Translation(src) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
            Matrix.Diagonal((w, w, d.length / L0, 1.0))
        bm.keyframe_insert("location", frame=f)
        bm.keyframe_insert("rotation_euler", frame=f)
        bm.keyframe_insert("scale", frame=f)
    # ---------------- camera: Claude's eyes, looking down into the bowl; leaning in a little; breath
    tgt = sp + Vector((0, 0, 0.05)) + fwd * 0.1 + right * 0.02
    e1 = eye + (tgt - eye) * 0.08
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", eye, tgt, 32.0, (sp - eye).length), (dur, "soft", e1, tgt, 34.0, (sp - e1).length)],
                     shake=0.12, seed=707, fstop=2.0)
    bpy.context.scene.camera = cam
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.0, mist_start=40.0, mist_depth=1800.0, bloom=0.6, bloom_thr=0.65,
                          vignette=0.6, kuw_near=2, kuw_far=3, lift=(0.95, 1.0, 1.12), gain=(1.04, 1.0, 0.95)))
