"""SH03 - the ritual. CU on Claude's face from the front, slightly low (55 mm), its lantern warm at screen left,
moonlight cool from above, a cool rim; behind it the dark timber tower. Wistful - inner brows a touch up - a small
hopeful smile grows, then two slow, deliberate blinks (BLINKS: hello, goodnight). It ends with the eyes open, looking
up, waiting, leaning in a hair."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, windmill, finish
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots import act1 as A

BLINKS = (0.9, 1.75)
BLINK_DUR = 0.42


def cu_camera(p, hd, dist=2.6, lens=45.0):
    """The SH03/SH05 close-up set-up: in front of Claude, 24 deg toward its right (screen left, the lantern side),
    a little below its eyes looking up; Claude left of centre with lead room to the right where it looks."""
    h = math.radians(hd - 24.0)
    front = Vector((math.sin(h), -math.cos(h), 0.0))
    face = p + Vector((0, 0, A.C_EYE - 0.06))
    eye = face + front * dist + Vector((0, 0, -0.16))
    side = Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0))      # Claude's left (screen right)
    tgt = face + Vector((0, 0, 0.06)) + side * 0.02
    return eye, tgt


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 8.0, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    G = A.gallery_set(W, f0, f1, sway=0.04, seed=3)
    p, hd = G["p"], G["hd"]
    A.constellation(O, lines=0.3, eye=1.0)
    c = W.claude()
    tr = Track()
    # looking up at the constellation (north, 30 deg up): head tipped back, eyes up; wistful
    tr.pose(0.0, dict(x=p.x, y=p.y, z=p.z, heading=hd, head_nod=-22, lean=-13, look_y=1.3, look_x=0.12, eye_open=0.9,
                      eye_tilt=0.28, eye_happy=0.0, armL_up=-12, armR_up=-10, head_tilt=-3, pupil=1.05))
    # a small hopeful smile gathers before the ritual
    tr.key(0.7, "inout", eye_happy=0.28, eye_tilt=0.12, head_tilt=-6, eye_open=0.86)
    # between the blinks: the smile warms
    tr.key(BLINKS[1] - 0.05, "inout", eye_happy=0.36, eye_tilt=0.06)
    # after: eyes wide open again, waiting - pupils bigger, leaning in a hair, the smile held but expectant
    tr.key(BLINKS[1] + BLINK_DUR + 0.25, "out", eye_happy=0.14, eye_open=1.0, pupil=1.16, lean=-10, head_nod=-24,
           eye_tilt=0.0, head_tilt=-4)
    tr.key(dur, "soft", eye_happy=0.1, pupil=1.18, lean=-9, head_nod=-25)
    for b in BLINKS:
        tr.layer(anim.blink_at(b, BLINK_DUR))
    tr.layer(anim.breathe(0.012, 0.28))
    anim.anchor(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    eye, tgt = cu_camera(p, hd)
    e1 = eye + (tgt - eye) * 0.025
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", eye, tgt, 45.0, None), (dur, "soft", e1, tgt, 45.0, None)],
                     shake=0.04, seed=303, fstop=2.0)
    bpy.context.scene.camera = cam
    A.moon_flag()                       # the tower behind drops into soft shadow
    lamp = G["lan"]["root"].matrix_world.translation + Vector((0, 0, 0.1))
    finish.face_light(c, eye, lamp_loc=lamp, energy=10.0, col=(1.0, 0.66, 0.38), dist=1.6, size=0.8)
    scene.char_lights(c.col, p + Vector((0, 0, 0.45)), eye, (0.3, 0.8, 0.5), rim_col=(0.6, 0.76, 1.0), rim_w=30.0,
                      fill_col=(0.55, 0.66, 1.0), fill_w=3.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.3, mist_start=40.0, mist_depth=1800.0, bloom=0.85, bloom_thr=0.5,
                          vignette=0.45))
