"""SH08 - "Because of that". Two-shot, low and close: the star in the crater soft-sharp in the foreground, Claude
3/4 to camera behind it. Claude sets its lantern down in the grass, lowers itself all the way (squashed flat to be
small and safe) and slowly offers both arms, palms up. The star hesitates - looks at the arms... at Claude's face -
then gathers itself and hops in (T_HOP). Its glow swells back to warm gold, lighting Claude's face from below (T_GLOW);
Claude's eyes go soft and happy, crescents; the star smiles."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, layout, fx, finish
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots import act1 as A
from shots.sh06 import claude_mark

T_HOP = 2.0
T_GLOW = 2.67
T_SET = 0.55          # the lantern touches the grass
T_OFFER = 1.35        # arms fully offered
T_LAND = T_HOP + 0.32


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 23.3, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    A.hide_tail()
    A.constellation(O, lines=0.3, eye=0.0)
    cx, cy = layout.CRATER
    from shots.sh04 import TOUCH
    h_in = math.degrees(math.atan2(cx - TOUCH[0], -(cy - TOUCH[1])))
    fG = f0 + int(T_GLOW * 24)
    CR = A.crater(W, (cx, cy), f0, f1, radius=0.5, heading=h_in, furrow=2.2, seed=7, glow=1.2)
    P2, hc = claude_mark()
    gz = W.ground(P2.x, P2.y)
    fwd = Vector((math.sin(math.radians(hc)), -math.cos(math.radians(hc)), 0))
    right = -Vector((-fwd.y, fwd.x, 0))                  # Claude's right
    A.mow((P2.x, P2.y, 0), 0.45)
    sp0 = None
    # ---------------- camera (needed first: the star cheats toward it)
    # near-profile two-shot from Claude's left (north-west): the star in its bowl at screen left, Claude at screen
    # right facing left (SH06's screen direction), both cheated toward the lens; the hop crosses the frame
    M = (Vector((P2.x, P2.y, 0)) + Vector((cx, cy, 0))) * 0.5
    axis = Vector((cx - P2.x, cy - P2.y, 0)).normalized()
    perp = Vector((-axis.y, axis.x, 0))                   # Claude's left
    # the star has crept up the inner slope on Claude's side of the bowl
    sp0 = CR["center"] - axis * 0.22 + Vector((0, 0, 0.11))
    S_ = Vector((sp0.x, sp0.y, 0))
    ce = S_ + axis * 1.2 + perp * 0.5                      # across the bowl, behind the star's shoulder
    ce.z = W.ground(ce.x, ce.y) + 0.5
    A.mow((ce.x, ce.y, 0), 0.5)
    hc = hc - 16.0                                        # Claude cheats toward the lens
    fwd = Vector((math.sin(math.radians(hc)), -math.cos(math.radians(hc)), 0))
    right = -Vector((-fwd.y, fwd.x, 0))
    face0 = Vector((P2.x, P2.y, gz + 0.42))

    # ---------------- Claude
    c = W.claude()
    tr = Track()
    tr.pose(0.0, dict(x=P2.x, y=P2.y, z=gz, heading=hc, lean=15, squash=-0.14, head_nod=16, armR_up=12, armR_fwd=72,
                      armR_bend=-8, armL_up=-5, armL_fwd=36, look_y=-0.85, look_x=0.0, eye_tilt=0.45, pupil=1.08,
                      eye_open=0.95, eye_happy=0.0, hop=0.0, armL_curl=0, armR_curl=0, head_tilt=0))
    # sets the lantern down at its right, eyes never leaving the star
    tr.key(T_SET, "inout", armR_up=-38, armR_fwd=40, armR_bend=0, lean=20, squash=-0.17)
    tr.key(T_SET + 0.25, "inout", armR_up=-25, armR_fwd=20)
    # lowers itself all the way - small, flat, unthreatening
    tr.key(1.0, "inout", squash=-0.25, hop=-0.05, lean=8, head_nod=10, eye_tilt=0.3, eye_happy=0.2, pupil=1.12,
           look_y=-0.7)
    # ...and slowly offers both arms, palms up
    tr.key(T_OFFER, "soft", armL_fwd=84, armR_fwd=84, armL_up=-16, armR_up=-16, armL_curl=12, armR_curl=12, lean=12)
    tr.key(1.75, "inout", head_tilt=9, eye_happy=0.32, eye_tilt=0.22)
    tr.hold(T_HOP + 0.15, "armL_fwd", "armR_fwd", "armL_up", "armR_up", "armL_curl", "armR_curl", "lean", "squash",
            "hop", "head_tilt")
    # catches it: a soft give in the arms, then gathers it in toward the chest
    tr.key(T_LAND + 0.08, "out", squash=-0.29, armL_up=-30, armR_up=-30, armL_curl=26, armR_curl=26, look_y=-0.45,
           head_nod=6)
    tr.key(T_GLOW, "inout", squash=-0.18, armL_fwd=78, armR_fwd=78, armL_up=-24, armR_up=-24, armL_curl=34, armR_curl=34,
           lean=4, head_tilt=4, look_y=-0.35)
    # lit from below by the star's returning glow: eyes soft, happy crescents
    tr.key(T_GLOW + 0.4, "inout", eye_happy=0.88, eye_open=0.72, eye_tilt=0.0, pupil=1.0, head_tilt=10, squash=-0.12)
    tr.key(dur, "soft", eye_happy=0.92, head_tilt=12, squash=-0.1)
    tr.layer(anim.breathe(0.012, 0.32))
    tr.layer(anim.blinks(times=[0.8, 1.62], dur=0.15))
    anim.settle(tr, C_DEF, max_gap=0.6)
    trk = A.bake_tracking(c, lambda f: tr.at((f - f0) / 24), f0, f1 - 1, bones=("armR2", "armL2"))
    hR, hL = trk["armR2"], trk["armL2"]

    def hands(t):
        i = min(max(int(round(t * 24)), 0), len(hR) - 1)
        return (hR[i] + hL[i]) * 0.5 + fwd * 0.22 + Vector((0, 0, -0.08))

    # ---------------- the lantern: carried down and set in the grass, then it stays
    lan = A.lantern("Lantern", energy=6.0)
    gl = None

    def lan_pos(t):
        i = min(max(int(round(t * 24)), 0), len(hR) - 1)
        p = hR[i] - Vector((0, 0, lan["ring_h"] + 0.01))
        g = W.ground(p.x, p.y) + 0.005
        return Vector((p.x, p.y, max(p.z, g)))
    set_at = lan_pos(T_SET)
    for f in range(f0, f1 + 1):
        t = (f - f0) / 24
        p = lan_pos(t) if t < T_SET else set_at
        A.place_lantern(lan, p, yaw=hc)
        lan["root"].keyframe_insert("location", frame=f)
        lan["root"].keyframe_insert("rotation_euler", frame=f)
        lan["root"].keyframe_insert("scale", frame=f)
    A.mow((set_at.x, set_at.y, 0), 0.18)

    # ---------------- the star
    s = W.star()
    s.light_scale = 7.0
    to_c = face0 - sp0
    h_to_claude = math.degrees(math.atan2(to_c.x, -to_c.y))
    to_cam = ce - sp0
    h_to_cam = math.degrees(math.atan2(to_cam.x, -to_cam.y))
    dh = (h_to_cam - h_to_claude + 180) % 360 - 180
    h_cheat = h_to_claude + dh * 0.3                     # a sliver of its face toward the lens
    ha = hands(T_LAND + 0.1)
    hd_ = lambda v: math.degrees(math.atan2(v.x, -v.y))
    h_fc, h_cl = hd_(ce - ha), hd_(face0 + Vector((0, 0, 0.12)) - ha)
    h_arms = h_fc + 0.12 * ((h_cl - h_fc + 180) % 360 - 180)    # in the arms: turns round to the lens
    st = Track()
    st.pose(0.0, dict(x=sp0.x, y=sp0.y, z=sp0.z, **A.star_rot(h_cheat, -30), scale=A.STAR_SCALE, curl=36, squash=-0.14,
                      droop=16, glow=0.55, warmth=0.8, eye_open=0.88, eye_tilt=0.6, pupil=1.1, look_x=-0.5, look_y=0.5,
                      head=2, legs=-6, arms=-4, eye_happy=0.0))
    # watches the lantern come down (Claude's right hand)
    st.key(0.6, "inout", look_x=-0.8, look_y=0.1, head=6)
    # looks at the offered arms... uncurling a little, curious
    st.key(1.15, "inout", look_x=-0.35, look_y=-0.25, curl=26, head=-8, eye_tilt=0.4, pupil=1.15, **A.star_rot(h_cheat, -22))
    # ...then up at Claude's face; a weak, hopeful flicker; leans in
    st.key(1.6, "inout", look_x=-0.55, look_y=0.7, curl=20, head=-14, eye_tilt=0.25, glow=0.75, warmth=0.88,
           **A.star_rot(h_cheat, -14))
    # gathers itself (anticipation)
    st.key(T_HOP - 0.02, "inout", squash=-0.26, curl=32, head=4, eye_open=0.8)
    # the hop: stretch in the air
    st.key(T_HOP + 0.14, "out", squash=0.18, curl=6, arms=24, legs=10, head=-10, eye_open=1.0, look_y=0.6)
    # lands in the arms (squash), turns to Claude
    st.key(T_LAND + 0.06, "out", squash=-0.16, curl=14, arms=10, legs=-2, look_x=-0.4, look_y=0.65,
           **A.star_rot(h_arms, 6))
    st.key(T_GLOW - 0.1, "inout", squash=0.0, curl=10, eye_tilt=0.0, glow=0.75)
    # GLOW: warmth floods back; it smiles
    st.key(T_GLOW + 0.3, "out", glow=1.4, warmth=1.0, eye_happy=0.82, eye_open=0.8, arms=22, droop=0, curl=4,
           pupil=1.0)
    st.key(dur, "soft", glow=1.3, eye_happy=0.88, arms=28)
    st.layer(anim.tremble(0.0, 1.5, amp=1.6, freq=16, ramp=0.4))

    def hop_path(t, p):
        if t < T_HOP:
            return
        hp = hands(t)
        if t < T_LAND:
            u = (t - T_HOP) / (T_LAND - T_HOP)
            q = sp0.lerp(hp, anim.ease("smooth", u)) + Vector((0, 0, 0.22 * 4 * u * (1 - u)))
        else:
            q = hp
        p["x"], p["y"], p["z"] = q.x, q.y, q.z
    st.layer(hop_path)

    def flick(t, p):
        if t < T_GLOW:
            p["glow"] = p.get("glow", 0.6) * (1 + 0.1 * math.sin(t * 27) + 0.07 * math.sin(t * 11))
    st.layer(flick)
    st.layer(anim.blinks(times=[0.95], dur=0.13))
    anim.settle(st, S_DEF, max_gap=0.5)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # the crater cools as the star leaves it; a little burst of sparks as it hops
    fx.sparks("HopSparks", sp0 + Vector((0, 0, 0.03)), T_HOP + 0.02, f0, n=14, speed=(0.3, 0.9), life=(0.3, 0.6),
              gravity=-1.5, up=0.9, color=(1.0, 0.75, 0.35), strength=25.0, size=0.008, seed=81)
    # ---------------- camera: low and close beyond the crater; focus rides from the star to Claude as it hops
    tgt0 = sp0.lerp(face0, 0.42) + Vector((0, 0, 0.02)) + perp * 0.05
    tgt1 = tgt0 + Vector((0, 0, 0.05)) + (face0 - tgt0) * 0.25
    d_star, d_face = (sp0 - ce).length, (face0 - ce).length
    e1 = ce + (tgt0 - ce).normalized() * 0.1
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", ce, tgt0, 26.0, d_face - 0.1),
                                     (1.0, "inout", ce, tgt0, 26.0, d_star + 0.05),
                                     (T_HOP, "inout", ce, tgt0, 26.0, d_star + 0.1),
                                     (T_LAND + 0.25, "inout", ce + (e1 - ce) * 0.5, tgt1, 27.0, d_face - 0.1),
                                     (dur, "soft", e1, tgt1, 29.0, d_face - 0.12)],
                     shake=0.06, seed=808, fstop=3.5)
    bpy.context.scene.camera = cam
    scene.char_lights(c.col, face0, ce, (0.3, 0.8, 0.5), rim_col=(0.6, 0.76, 1.0), rim_w=18.0, fill_col=(0.55, 0.66, 1.0),
                      fill_w=1.5)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.12, mist_start=40.0, mist_depth=1800.0, bloom=0.85, bloom_thr=0.5,
                          vignette=0.45))
