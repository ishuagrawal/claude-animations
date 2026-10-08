"""SH06 - Low in the north meadow, through soft foreground flowers, looking south toward the windmill (sails over the
cap, warm windows, the empty lantern hook up on the gallery). Midground: a scorched, smoking crater in the grass,
glowing gold, embers pulsing, the burnt furrow where the star skidded in. Claude comes running from under the gallery,
lantern swinging, and skids to a stop (T_SKID) - petals and dust kick up. Then, cautious: it lowers its body, holds the
lantern out, and creeps closer in small steps."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, finish, layout, fx
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots import act1 as A

T_SKID = 0.67
T_LOWER = 1.25            # sinks low, lantern out
T_CREEP = 1.65            # first small step


RUN_FROM = (0.85, 10.9)      # under the north gallery (it came down the stairs)
SKID_AT = (1.8, 13.95)       # skids to a stop here (T_SKID)
CREEP_TO = (2.08, 14.38)     # ...and creeps to here, at the crater's lip: Claude's mark for SH07-SH08


def claude_mark():
    """Claude's spot at the crater's lip and its heading (facing the crater) at the end of SH06."""
    cx, cy = layout.CRATER
    P2 = Vector((CREEP_TO[0], CREEP_TO[1], 0))
    return P2, math.degrees(math.atan2(cx - P2.x, -(cy - P2.y)))


def path_xy(t, P0, P1, P2):
    """Run (decelerating into the skid) then the creep."""
    if t <= T_SKID:
        u = t / T_SKID
        u = 1 - (1 - u) ** 1.7            # fast in, braking
        return P0.lerp(P1, u)
    if t < T_CREEP:
        return P1.copy()
    u = min(1.0, (t - T_CREEP) / 1.6)
    return P1.lerp(P2, u)


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 17.3, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    G = A.gallery_set(W, f0, f1, lantern_on_hook=False)
    G["lan"]["root"].name = "Lantern"
    A.constellation(O, lines=0.3, eye=0.0)
    cx, cy = layout.CRATER
    from shots.sh04 import TOUCH
    h_in = math.degrees(math.atan2(cx - TOUCH[0], -(cy - TOUCH[1])))      # it skidded in from TOUCH
    CR = A.crater(W, (cx, cy), f0, f1, radius=0.5, heading=h_in, furrow=2.2, seed=7, glow=2.0)
    A.glow_pool("CraterPool", CR["center"] + Vector((0, 0, 0.1)), 0.55, f0, f1,
                lambda t: 0.85 + 0.12 * math.sin(t * 7.0) + 0.08 * math.sin(t * 17.0), light=60.0)
    gz_c = CR["ground"]
    # the star lies curled in the bowl (barely seen from this low angle - the glow tells us it's there)
    s = W.star()
    s.light_scale = 45.0
    sp = CR["center"] + Vector((0, 0, 0.06))
    st = Track()
    st.pose(0.0, dict(x=sp.x, y=sp.y, z=sp.z, heading=200, pitch=-60, scale=A.STAR_SCALE, curl=40, squash=-0.12,
                      glow=0.55, warmth=0.75, eye_open=0.0, droop=14))
    st.layer(lambda t, p: p.update(glow=p["glow"] * (1 + 0.15 * math.sin(t * 9.0) + 0.1 * math.sin(t * 23.0))))
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)

    # Claude: run -> skid -> sink low, lantern out -> creep
    P0 = Vector((*RUN_FROM, 0))
    P1 = Vector((*SKID_AT, 0))
    P2 = Vector((*CREEP_TO, 0))
    for q in (P0.lerp(P1, 0.33), P0.lerp(P1, 0.66), P1, P2):
        A.mow((q.x, q.y, 0), 0.42)
    h_run = math.degrees(math.atan2(P1.x - P0.x, -(P1.y - P0.y)))
    h_cr = math.degrees(math.atan2(cx - P1.x, -(cy - P1.y)))
    c = W.claude()
    tr = Track()
    tr.pose(0.0, dict(heading=h_run, lean=14, squash=0.0, eye_open=1.0, pupil=0.75, look_y=-0.2, armL_up=20, armR_up=30,
                      armR_fwd=25, armL_fwd=-20, head_nod=4, eye_tilt=0.0))
    # the skid: weight thrown back, legs braced forward
    tr.key(T_SKID - 0.2, "inout", lean=8)
    tr.key(T_SKID, "out", lean=-17, squash=-0.09, heading=h_cr - 6, armL_up=40, armR_up=38, armR_fwd=30, armL_fwd=10,
           head_nod=-6, look_y=-0.5, pupil=0.7)
    # recovers forward, staring at the glow
    tr.key(T_SKID + 0.3, "back", lean=4, squash=0.03, heading=h_cr, armL_up=8, armR_up=20, armR_fwd=35, armL_fwd=0,
           head_nod=10, look_y=-0.8, look_x=0.0, eye_tilt=0.2, pupil=0.85)
    # sinks low; lantern held out in front (cautious)
    tr.key(T_LOWER + 0.3, "inout", lean=12, squash=-0.12, armR_up=12, armR_fwd=72, armR_bend=-8, armL_up=-5, armL_fwd=30,
           head_nod=14, look_y=-0.9, eye_tilt=0.35, eye_open=0.95, pupil=1.0)
    tr.key(dur, "soft", lean=15, squash=-0.14, head_nod=16, eye_tilt=0.45, pupil=1.08, armL_fwd=36)
    tr.layer(anim.blinks(times=[1.05, 2.6], dur=0.14))

    def legs(t, p):
        x, y = path_xy(t, P0, P1, P2).to_tuple()[:2]
        p["x"], p["y"] = x, y
        p["z"] = W.ground(x, y)
        if t < T_SKID - 0.18:                   # the run: a quick scamper with a bounce
            ph = t * 2 * math.pi * 4.2
            for i in range(4):
                s_ = math.sin(ph + (0 if i in (0, 2) else math.pi))
                p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0.0) + 34 * s_
                p[f"leg{i}_knee"] = p.get(f"leg{i}_knee", 0.0) + 30 * max(0.0, math.cos(ph + (0 if i in (0, 2) else math.pi)))
            p["hop"] = p.get("hop", 0.0) + 0.045 * abs(math.sin(ph))
            p["roll"] = p.get("roll", 0.0) + 4 * math.sin(ph)
        elif t < T_SKID + 0.15:                 # braced legs in the skid
            k = math.sin(math.pi * (t - (T_SKID - 0.18)) / 0.33)
            for i in range(4):
                p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0.0) - 28 * k
        elif t >= T_CREEP:                      # small careful steps
            u = (t - T_CREEP) / 1.6
            if u <= 1.0:
                ph = u * 2 * math.pi * 3.0
                for i in range(4):
                    s_ = math.sin(ph + (0 if i in (0, 2) else math.pi))
                    p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0.0) + 14 * s_
                    p[f"leg{i}_knee"] = p.get(f"leg{i}_knee", 0.0) + 14 * max(0.0, s_)
                p["roll"] = p.get("roll", 0.0) + 2.0 * math.sin(ph)
    tr.layer(legs)
    tr.layer(anim.breathe(0.016, 0.45))
    anim.anchor(tr, C_DEF)
    trk = A.bake_tracking(c, lambda f: tr.at((f - f0) / 24), f0, f1 - 1, bones=("armR2",))
    hands = trk["armR2"]

    def pivot(t):
        i = min(max(int(round(t * 24)), 0), len(hands) - 1)
        return hands[i] + Vector((0, 0, -0.01))
    A.hang(G["lan"], pivot, f0, f1, init=(-0.35, 0.25), damp=1.1, yaw_fn=lambda t: h_run, seed=6)
    # skid debris: dirt and petals kicked up at its feet
    sk = P1 + Vector((0, 0, W.ground(P1.x, P1.y) + 0.04))
    fx.puff("SkidDust", sk + Vector((0, 0.15, 0)), T_SKID - 0.12, f0, n=7, spread=0.12, grow=(0.04, 0.22), life=(0.6, 1.1),
            rise=0.12, drift=(0, 0.25, 0), color=(0.36, 0.33, 0.28), opacity=0.4, seed=8)
    fx.sparks("SkidPetals", sk + Vector((0, 0.1, 0.02)), T_SKID - 0.1, f0, n=18, speed=(0.6, 1.6), life=(0.5, 1.0),
              gravity=-2.5, up=0.8, color=(0.9, 0.85, 0.75), strength=1.5, size=0.012, seed=9, cone=(0, 1, 0.6))
    A.fireflies((2.6, 13.6, 0.9), 22, f0, f1, seed=61, spread=(4.5, 4.5, 1.2))
    # camera: low behind the crater (north), flowers soft in front; a slow creep in after the skid
    gc = W.ground(0.85, 17.45)
    e0 = Vector((0.85, 17.45, gc + 0.72))
    t0 = Vector((3.3, 12.3, 1.75))
    # a sightline: the grass between the lens and the crater is flattened (soft blades stay at the frame edges)
    for k in range(1, 6):
        q = e0.lerp(Vector((cx, cy, 0)), 0.18 + 0.14 * k)
        A.mow((q.x, q.y, 0), 0.32)
    e1 = e0 + (Vector((cx, cy, gc + 0.5)) - e0).normalized() * 0.4
    t1 = t0 + Vector((0.15, 0, -0.25))
    fwd = (t0 - e0)
    fwd.z = 0
    fwd.normalize()
    foc = (Vector((2.0, 14.3, gz_c + 0.35)) - e0).length
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", e0, t0, 24.0, foc), (T_SKID + 0.4, "inout", e0, t0, 24.0, foc),
                                     (dur, "soft", e1, t1, 26.0, foc - 0.35)], shake=0.22, seed=606, fstop=2.8)
    bpy.context.scene.camera = cam
    scene.char_lights(c.col, P1 + Vector((0, 0, gz_c + 0.4)), e0, (0.3, 0.8, 0.5), rim_col=(0.6, 0.76, 1.0),
                      rim_w=22.0, fill_col=(0.55, 0.66, 1.0), fill_w=2.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.35, mist_start=30.0, mist_depth=1600.0, bloom=0.9, bloom_thr=0.45,
                          vignette=0.42))
