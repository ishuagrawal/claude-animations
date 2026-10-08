"""SH05 - CU Claude, the SH03 set-up. Its eyes snap wide (pupils tiny) and its head whips down, tracking the falling
star as it skids in toward the windmill; a white-gold impact flash from the meadow below lights its face from beneath
(T_FLASH) - it flinches. A frozen beat of shock... then it snatches the lantern off its hook and bolts off the perch,
out of frame to screen left (east, toward the gallery stairs) (T_BOLT)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, finish, layout
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots import act1 as A
from shots.sh03 import cu_camera

T_FLASH = 0.67
T_BOLT = 1.3
T_GRAB = T_BOLT + 0.12        # the hand closes on the lantern ring


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 15.3, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    G = A.gallery_set(W, f0, f1, lantern_on_hook=False)
    p, hd = G["p"], G["hd"]
    hp = G["hook"]
    A.constellation(O, lines=0.3, eye=0.0)
    c = W.claude()
    dz = A.deck_z(O)
    tr = Track()
    base = dict(x=p.x, y=p.y, z=p.z, heading=hd, head_nod=-25, lean=-9, look_y=1.3, look_x=0.1, eye_open=1.0,
                eye_tilt=0.0, eye_happy=0.1, pupil=1.18, armL_up=-12, armR_up=-10, head_tilt=-4, squash=0.0,
                head_turn=0.0, twist=0.0, armL_fwd=0, armR_fwd=0, armL_bend=0, armR_bend=0, hop=0.0)
    tr.pose(0.0, base)
    # (0.05) the eyes snap wide - pupils pin-small - a startled stretch
    tr.key(0.13, "snap", eye_open=1.0, pupil=0.66, eye_happy=0.0, eye_tilt=-0.05, squash=0.07, armL_up=8, armR_up=10)
    # (0.13-0.45) the head whips down after it, body following; tracking it in toward the windmill (its right)
    tr.key(0.45, "snap", head_nod=9, look_y=-0.55, look_x=-0.3, lean=9, head_turn=-10, twist=-6, squash=0.02, pupil=0.72)
    tr.key(T_FLASH - 0.02, "inout", head_nod=12, look_y=-0.7, look_x=-0.4, lean=11, head_turn=-14)
    # (0.67) FLASH from below: flinch - squint, recoil, arms up in front
    tr.key(T_FLASH + 0.08, "snap", eye_open=0.22, squash=-0.1, lean=-6, head_nod=8, armL_up=34, armR_up=30,
           armL_fwd=40, armR_fwd=36, armL_bend=30, armR_bend=30, pupil=0.7)
    # shock: eyes wide again, frozen, staring down into the glow
    tr.key(T_FLASH + 0.3, "out", eye_open=1.0, squash=-0.04, lean=6, head_nod=10, look_y=-0.65, look_x=-0.3, pupil=0.66,
           armL_up=14, armR_up=12, armL_fwd=20, armR_fwd=18, armL_bend=12, armR_bend=12)
    tr.hold(T_BOLT - 0.16, "eye_open", "squash", "lean", "head_nod", "look_y", "look_x", "pupil", "armL_up", "armR_up",
            "armL_fwd", "armR_fwd", "armL_bend", "armR_bend", "head_turn", "twist", "heading", "x", "y", "z", "hop")
    # anticipation: a quick crouch, eyes flick to the lantern (its right)
    tr.key(T_BOLT, "inout", squash=-0.13, lean=2, look_x=-1.0, look_y=0.2, head_turn=-22, head_nod=4, twist=-10)
    # the snatch: hops up and right, right arm reaching up to the ring
    gx = p.x + 0.34
    tr.key(T_GRAB, "out", x=gx, hop=0.1, squash=0.1, armR_up=62, armR_fwd=18, armR_bend=-10, heading=hd - 22,
           look_x=-0.6, armL_up=30)
    # and bolts: turns east, leaps off the perch down to the deck and runs out of frame (screen left)
    tr.key(T_GRAB + 0.14, "inout", heading=hd - 85, x=gx + 0.25, hop=0.12, squash=-0.04, armR_up=40, lean=14,
           look_x=0.0, look_y=-0.2, head_turn=0, head_nod=0)
    tr.key(T_GRAB + 0.32, "in", x=gx + 0.85, y=p.y - 0.05, hop=-A.PERCH_H, squash=-0.1, lean=16)
    tr.key(dur, "linear", x=gx + 1.85, y=p.y - 0.5, heading=hd - 100, hop=-A.PERCH_H, squash=0.03)
    tr.layer(anim.tremble(T_FLASH + 0.3, T_BOLT - 0.15, amp=1.0, freq=13))
    tr.layer(anim.blinks(times=[T_FLASH + 0.42], dur=0.12))

    def run(t, pp):             # a scamper once it is down on the deck
        if t > T_GRAB + 0.32:
            u = (t - T_GRAB - 0.32) * 9.0
            for i in range(4):
                s = math.sin(u * math.pi + (0 if i in (0, 2) else math.pi))
                pp[f"leg{i}_swing"] = pp.get(f"leg{i}_swing", 0.0) + 30 * s
            pp["hop"] = pp.get("hop", 0.0) + 0.03 * abs(math.sin(u * math.pi))
    tr.layer(run)
    anim.settle(tr, C_DEF, max_gap=0.22)
    trk = A.bake_tracking(c, lambda f: tr.at((f - f0) / 24), f0, f1 - 1, bones=("armR2",))
    hands = trk["armR2"]

    def pivot(t):
        i = min(max(int(round(t * 24)), 0), len(hands) - 1)
        hand = hands[i] + Vector((0, 0, -0.01))
        if t < T_GRAB - 0.04:
            return hp
        k = anim.ease("out", (t - (T_GRAB - 0.04)) / 0.08)
        return hp.lerp(hand, k)
    A.hang(G["lan"], pivot, f0, f1, init=(0.03, 0.02), damp=1.4, seed=5)
    # the impact flash: from the crater below, white-gold, decaying into a steady glow
    cr = layout.CRATER
    fl = scene.point("ImpactFlash", (cr[0], cr[1], W.ground(*cr) + 0.6), (1.0, 0.86, 0.62), 0.0, 0.5, shadow=True)
    for f in range(f0, f1 + 1):
        t = (f - f0) / 24
        u = t - T_FLASH
        e = 0.0 if u < -0.03 else (9000.0 * math.exp(-max(u, 0) * 6.0) + 1400.0 * min(1.0, (u + 0.03) / 0.03))
        fl.data.energy = e
        fl.data.color = (1.0, 0.86 - 0.2 * min(1, max(u, 0) * 2), 0.62 - 0.32 * min(1, max(u, 0) * 2))
        fl.data.keyframe_insert("energy", frame=f)
        fl.data.keyframe_insert("color", frame=f)
    eye, tgt = cu_camera(p, hd)
    e1 = eye + (tgt - eye) * 0.02

    def jolt(t, pp):            # the camera flinches with the flash
        pp["shake"] = pp.get("shake", 0.0) + 0.9 * math.exp(-((t - T_FLASH - 0.05) / 0.12) ** 2)
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", eye, tgt, 45.0, None), (dur, "soft", e1, tgt, 45.0, None)],
                     shake=0.05, seed=505, fstop=2.0, layers=(jolt,))
    bpy.context.scene.camera = cam
    A.moon_flag()                       # the tower behind drops into soft shadow
    lamp = hp + Vector((0, 0, -0.15))
    finish.face_light(c, eye, lamp_loc=lamp, energy=9.0, col=(1.0, 0.66, 0.38), dist=1.6, size=0.8)
    scene.char_lights(c.col, p + Vector((0, 0, 0.45)), eye, (0.3, 0.8, 0.5), rim_col=(0.6, 0.76, 1.0), rim_w=30.0,
                      fill_col=(0.55, 0.66, 1.0), fill_w=3.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.3, mist_start=40.0, mist_depth=1800.0, bloom=0.9, bloom_thr=0.45,
                          vignette=0.45))
