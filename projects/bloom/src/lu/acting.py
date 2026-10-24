"""Acting library for BLOOM's characters: emotion presets (face + body) and procedural layers for Claude (and the
Sprout), in the anim.Track / pose-dict style.

Acting notes behind the presets (body language must read from 20 m by silhouette alone; the face reads up close):
  (Faces act with the SHAPE of the mascot's black square eyes; a mouth appears only where noted.)
  grief      collapses down and in: knees folded, spine curled, head hung, arms heavy; eyes droop sad, gaze down.
  curious    leans in and tilts the head; one lid a touch higher, pupils open, a small 'oo' mouth.
  wonder     opens up and lifts: chest back, head up, eyes wide and dilated, catch-lights up, a soft open smile.
  worried    contracts: shoulders/arms in, a little squash, brows up in the middle, lips pulled tight and wobbling.
  determined sets: lids lowered and angled down at the inner corners (the brow), lips pressed, chin forward.
  effort     strains: lean into it, squash, gritted teeth, squeezed angry lids.
  flinch     snaps shut: eyes squeezed, teeth bared, body squashed and turned away.
  despair    the deepest collapse; brows fully up, eyes swimming with tears, a wobbling open frown.
  crying     eyes squeezed into wet slits, open wobbling mouth, shoulders shaking (use shiver()).
  laugh      arches back and opens: eyes squeezed into crescents, a huge open smile, happy tears.
  sleep      soft and slack: lids closed with a gentle downward curve, a faint smile, head tipped.
Every preset is a plain dict; combine with stage.merge / acting.mix and key with Track.pose(t, preset, ...).

Claude presets (face F_*, body B_*, both in EMOTIONS):
  F_NEUTRAL F_GRIEF F_CURIOUS F_WONDER F_WORRIED F_DETERMINED F_EFFORT F_FLINCH F_DESPAIR F_CRYING F_LAUGH F_SLEEP
  F_SMILE F_GASP F_TENDER F_RELIEF
  B_STAND B_GRIEF B_SIFT B_CURIOUS B_WONDER B_WORRIED B_HOLD B_DETERMINED B_EFFORT B_CURL B_HAUL B_KNEEL_PLANT
  B_JOY B_LAUGH B_SIT B_WIPE B_HUG B_LIMP B_FACEDOWN B_RUN_HOLD
Sprout presets: S_SEED S_SPROUT S_SHY S_HAPPY S_WILT S_REACH S_CURL_FINGER S_TOUCH S_DRINK S_SHIVER S_HUG
Layers: breathe, blinks, saccades (anim), shiver, gait (walk/run/crawl with IK-planted feet), sprout_shiver,
        sprout_breathe, look_at().
"""
import math
import numpy as np
from mathutils import Vector

from . import anim

# ================================================================ Claude: faces
# The mascot acts with the SHAPE of its black square eyes; a mouth (a tiny flat black graphic) appears only in the
# presets where it really helps (laugh, gasp, despair, crying, effort, flinch, smile line).
F_NEUTRAL = dict()
F_GRIEF = dict(eye_open=0.72, eye_tilt=0.8, lower_lid=0.05, look_y=-0.7, pupil=0.95)
F_CURIOUS = dict(eye_open=1.1, eyeL_open=0.12, eye_tilt=0.25, pupil=1.12, look_y=-0.3, look_x=0.25)
F_WONDER = dict(eye_open=1.3, eye_tilt=0.3, pupil=1.35, glint=1.0, look_y=0.25)
F_WORRIED = dict(eye_open=1.0, eye_tilt=0.85, pupil=0.85, lower_lid=0.1)
F_DETERMINED = dict(eye_open=0.72, eye_tilt=-0.85, lower_lid=0.18, pupil=0.95)
F_EFFORT = dict(eye_open=0.42, eye_tilt=-0.9, lower_lid=0.12, teeth=1.0, mouth_wide=0.4)
F_FLINCH = dict(eye_open=0.0, eye_squeeze=1.0, teeth=0.8, mouth_wide=0.3)
F_DESPAIR = dict(eye_open=0.62, eye_tilt=1.0, lower_lid=0.12, look_y=-0.35, tears=1.0, smile=-0.6, wobble=0.9,
                 pupil=1.1)
F_CRYING = dict(eye_open=0.25, eye_squeeze=1.0, tears=1.0, smile=-0.5, mouth_open=0.4, wobble=0.6)
F_LAUGH = dict(eye_open=0.8, eye_happy=1.0, smile=0.8, mouth_open=1.0, mouth_wide=0.3, tears=0.5)
F_SLEEP = dict(eye_open=0.0, lid_sag=0.8)
F_SMILE = dict(eye_open=0.9, eye_happy=0.75, smile=0.7)
F_GASP = dict(eye_open=1.32, pupil=0.85, mouth_open=0.7, mouth_o=1.0)
F_TENDER = dict(eye_open=0.9, eye_happy=0.55, eye_tilt=0.35, look_y=-0.3)
F_RELIEF = dict(eye_open=0.7, eye_tilt=0.55, eye_happy=0.35, tears=0.6)

# ================================================================ Claude: bodies
# hand IK targets are character-space WRIST positions (metres). With IK on, the arm telescopes 0.15 m out of the body
# (the mascot's stubby arms grow to hold things) and may stretch ~25 % more: the upper arm comes forward along the
# side, the elbow sits at the front corner and the forearm wraps in. armX_follow=1: targets ride with the upper body.
_HOLD = dict(armL_ik=1.0, armR_ik=1.0, handL_x=0.13, handL_y=-0.36, handL_z=0.33, handR_x=-0.13, handR_y=-0.36,
             handR_z=0.33, handL_bend=30.0, handR_bend=30.0)
B_STAND = dict()
B_GRIEF = dict(crouch=0.55, lean=6.0, bend=8.0, head_nod=11.0, head_tilt=5.0, squash=-0.08, armL_up=-70.0,
               armR_up=-70.0, armL_fwd=10.0, armR_fwd=10.0, armL_bend=10.0, armR_bend=10.0, handL_bend=15.0,
               handR_bend=15.0)
B_SIFT = dict(crouch=0.85, lean=14.0, bend=8.0, head_nod=12.0, squash=-0.06, armL_ik=1.0, armR_ik=1.0,
              armL_follow=0.0, armR_follow=0.0, handL_x=0.15, handL_y=-0.36, handL_z=0.13, handR_x=-0.13,
              handR_y=-0.37, handR_z=0.12, handL_bend=40.0, handR_bend=40.0, handL_curl=0.3, handR_curl=0.3,
              armL_pole=25.0, armR_pole=25.0)
B_CURIOUS = dict(lean=10.0, bend=6.0, head_tilt=14.0, head_nod=6.0, armL_up=-25.0, armR_up=-40.0, armL_fwd=20.0)
B_WONDER = dict(lean=-5.0, bend=-8.0, head_nod=-8.0, squash=0.07, armL_up=-15.0, armR_up=-15.0, armL_fwd=35.0,
                armR_fwd=35.0, armL_bend=25.0, armR_bend=25.0)
B_WORRIED = dict(crouch=0.18, squash=-0.06, bend=10.0, head_nod=4.0, armL_ik=1.0, armR_ik=1.0, handL_x=0.11,
                 handL_y=-0.30, handL_z=0.42, handR_x=-0.11, handR_y=-0.30, handR_z=0.42, handL_bend=30.0,
                 handR_bend=30.0, armL_twist=20.0, armR_twist=20.0)
B_HOLD = dict(_HOLD, bend=3.0, head_nod=6.0)
B_DETERMINED = dict(_HOLD, lean=5.0, squash=0.05, crouch=0.12, head_nod=-3.0, bend=4.0)
B_EFFORT = dict(crouch=0.35, lean=12.0, squash=-0.1, bend=6.0, head_nod=-6.0)
B_CURL = dict(_HOLD, crouch=0.85, lean=10.0, bend=14.0, head_nod=14.0, squash=-0.13, handL_y=-0.33, handR_y=-0.33,
              handL_z=0.30, handR_z=0.30, legs_splay=4.0)
B_HAUL = dict(hop=0.12, lean=9.0, bend=4.0, head_nod=-20.0, squash=0.07, armL_ik=1.0, armL_follow=0.0,
              handL_x=0.17, handL_y=-0.33, handL_z=0.80, handL_bend=60.0, handL_curl=0.5, armL_twist=-30.0,
              armL_pole=35.0, armR_ik=1.0, handR_x=-0.13, handR_y=-0.36, handR_z=0.33, handR_bend=30.0,
              foot0_y=-0.235, foot0_z=0.05, foot3_y=-0.235, foot3_z=0.11,
              foot1_z=-0.07, foot2_z=-0.07)
B_KNEEL_PLANT = dict(crouch=1.0, lean=16.0, bend=10.0, head_nod=12.0, armL_ik=1.0, armR_ik=1.0, armL_follow=0.0,
                     armR_follow=0.0, handL_x=0.10, handL_y=-0.38, handL_z=0.13, handR_x=-0.10, handR_y=-0.38,
                     handR_z=0.13, armL_twist=30.0, armR_twist=30.0, handL_bend=45.0, handR_bend=45.0,
                     armL_pole=30.0, armR_pole=30.0)
B_JOY = dict(armL_up=58.0, armR_up=58.0, armL_fwd=6.0, armR_fwd=6.0, armL_bend=0.0, armR_bend=0.0,
             squash=0.13, bend=-10.0, head_nod=-12.0, lean=-5.0)
B_LAUGH = dict(bend=-16.0, head_nod=-12.0, squash=0.08, armL_up=10.0, armR_up=10.0, armL_fwd=35.0, armR_fwd=35.0,
               armL_bend=50.0, armR_bend=50.0)
B_SIT = dict(legs_ik=0.0, leg0_swing=82.0, leg1_swing=82.0, leg2_swing=82.0, leg3_swing=82.0, leg0_knee=-8.0,
             leg1_knee=-8.0, leg2_knee=-8.0, leg3_knee=-8.0, crouch=0.0, bend=10.0, head_nod=10.0, head_tilt=10.0,
             armL_up=-55.0, armR_up=-55.0, armL_bend=20.0, armR_bend=20.0)
B_WIPE = dict(armR_ik=1.0, handR_x=-0.14, handR_y=-0.33, handR_z=0.54, armR_twist=-20.0, handR_bend=35.0,
              armR_pole=60.0, head_nod=10.0, head_turn=8.0, bend=8.0)
B_HUG = dict(armL_ik=1.0, armR_ik=1.0, handL_x=0.01, handL_y=-0.36, handL_z=0.37, handR_x=-0.01, handR_y=-0.37,
             handR_z=0.35, armL_pole=60.0, armR_pole=60.0, handL_bend=30.0, handR_bend=30.0, armL_twist=20.0,
             armR_twist=20.0, bend=6.0, head_tilt=10.0)
B_LIMP = dict(crouch=0.45, lean=8.0, bend=8.0, head_nod=10.0, roll=-6.0, squash=-0.05, foot0_z=0.03)
B_FACEDOWN = dict(tilt_x=72.0, z=0.43, crouch=0.2, legs_ik=0.0, leg0_swing=-60.0, leg1_swing=-60.0,
                  leg2_swing=-60.0, leg3_swing=-60.0, armL_up=10.0, armR_up=10.0, armL_fwd=60.0, armR_fwd=60.0,
                  armL_bend=30.0, armR_bend=30.0)
B_RUN_HOLD = dict(_HOLD, lean=6.0, squash=0.04, bend=3.0, head_nod=-5.0)

EMOTIONS = {
    "neutral": (F_NEUTRAL, B_STAND), "grief": (F_GRIEF, B_GRIEF), "curious": (F_CURIOUS, B_CURIOUS),
    "wonder": (F_WONDER, B_WONDER), "worried": (F_WORRIED, B_WORRIED), "determined": (F_DETERMINED, B_DETERMINED),
    "effort": (F_EFFORT, B_EFFORT), "flinch": (F_FLINCH, B_CURL), "despair": (F_DESPAIR, B_GRIEF),
    "crying": (F_CRYING, B_GRIEF), "laugh": (F_LAUGH, B_LAUGH), "sleep": (F_SLEEP, B_SIT), "smile": (F_SMILE, B_STAND),
    "gasp": (F_GASP, B_WONDER), "tender": (F_TENDER, B_HOLD),
}


def mix(a, b, t, defaults=None):
    """Blend two pose dicts (missing keys take defaults, e.g. claude.DEFAULT)."""
    d = defaults or {}
    out = {}
    for k in set(a) | set(b):
        va, vb = a.get(k, d.get(k, 0.0)), b.get(k, d.get(k, 0.0))
        out[k] = va + (vb - va) * t
    return out


def emotion(name, **extra):
    f, b = EMOTIONS[name]
    out = dict(b)
    out.update(f)
    out.update(extra)
    return out


# ================================================================ Claude: procedural layers
def breathe(amp=0.014, rate=0.25, seed=0.0, arms=1.5):
    """Breathing: squash pulse + a little shoulder rise (arms follow)."""
    def f(t, p):
        s = math.sin(2 * math.pi * rate * t + seed)
        p["squash"] = p.get("squash", 0.0) + amp * s
        for side in "LR":
            k = f"arm{side}_up"
            if k in p or True:
                p[k] = p.get(k, 0.0) + arms * s
    return f


def sob(t0, t1, rate=2.6, amp=1.0, seed=0.0):
    """Crying sobs: jerky in-breaths (squash + head bob), lip tremble and a shoulder hitch."""
    def f(t, p):
        if not (t0 <= t <= t1):
            return
        w = min(1.0, (t - t0) / 0.25, (t1 - t) / 0.25)
        ph = (rate * (t - t0) + seed) % 1.0
        hitch = math.exp(-((ph - 0.1) / 0.06) ** 2)
        p["squash"] = p.get("squash", 0.0) + 0.035 * amp * w * hitch
        p["head_nod"] = p.get("head_nod", 0.0) - 3.0 * amp * w * hitch
        p["wobble"] = min(1.0, p.get("wobble", 0.0) + 0.3 * w)
        for side in "LR":
            p[f"arm{side}_up"] = p.get(f"arm{side}_up", 0.0) + 4.0 * amp * w * hitch
    return f


def shiver(t0, t1, amp=1.0, freq=17.0, seed=0, ramp=0.15):
    """Cold/fear shiver: fast small roll and lateral jitter, trembling lids and arms."""
    def f(t, p):
        if not (t0 <= t <= t1):
            return
        w = min(1.0, (t - t0) / ramp, (t1 - t) / ramp) * amp
        s1 = math.sin(2 * math.pi * freq * t + seed)
        s2 = math.sin(2 * math.pi * freq * 1.37 * t + seed * 2.1)
        p["roll"] = p.get("roll", 0.0) + 1.6 * w * s1
        p["x"] = p.get("x", 0.0) + 0.002 * w * s2
        p["squash"] = p.get("squash", 0.0) + 0.006 * w * s2
        p["eye_open"] = p.get("eye_open", 1.0) - 0.04 * w * (1 + s1) / 2
        for side in "LR":
            p[f"arm{side}_up"] = p.get(f"arm{side}_up", 0.0) + 2.0 * w * s2
    return f


def blinks(**kw):
    return anim.blinks(**kw)


def saccades(**kw):
    return anim.saccades(**kw)


def look_at(pose, target, eye_z=0.548, head_share=0.35, max_turn=40.0):
    """Return look_x / look_y (+ head_turn / head_nod share) for a character in `pose` to look at world `target`."""
    h = math.radians(pose.get("heading", 0.0))
    fwd = Vector((math.sin(h), -math.cos(h), 0))
    left = Vector((math.cos(h), math.sin(h), 0))
    d = Vector(target) - Vector((pose.get("x", 0.0), pose.get("y", 0.0), pose.get("z", 0.0) + eye_z))
    yaw = math.degrees(math.atan2(d.dot(left), max(d.dot(fwd), 1e-4)))
    pitch = math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
    hturn = max(-max_turn, min(max_turn, yaw * head_share))
    hnod = max(-25.0, min(25.0, -pitch * head_share))
    return dict(look_x=max(-1.3, min(1.3, (yaw - hturn) / 24.0)), look_y=max(-1.3, min(1.3, (pitch + hnod) / 18.0)),
                head_turn=hturn, head_nod=hnod)


def _dist_to_t(path, d):
    return float(np.interp(d, path._d, path._ts))


def gait(path, z_fn=None, stride=0.17, duty=0.62, lift=0.045, bob=0.018, lean=6.0, sway=2.5, arm_swing=14.0,
         phases=(0.0, 0.5, 0.0, 0.5), crouch=0.0, flight=0.0, squash=0.0, heading_offset=0.0, face=True,
         rest=None, v_full=0.25):
    """Move along an anim.Path with IK-planted feet. Each foot lands, stays planted in the world while the body
    passes over it, then lifts and swings to its next landing (pure function of t; works on slopes via z_fn).
      walk:  gait(path)                                     (trot: diagonal pairs 0+2 / 1+3)
      run:   gait(path, stride=0.34, duty=0.38, lift=0.08, bob=0.0, flight=0.07, lean=16, squash=0.08,
                  phases=(0.0, 0.55, 0.55, 0.0))            (bound: front pair, then back pair; airborne phase)
      crawl: gait(path, stride=0.09, duty=0.78, lift=0.02, crouch=0.65, lean=20, bob=0.006)
    rest: (x, y) rest foot offsets (default: Claude's stance)."""
    from . import claude as C
    rest = rest or [(C.LEG_X[i], C.LEG_Y[i]) for i in range(4)]
    zf = z_fn or (lambda x, y: 0.0)
    D = float(path._d[-1])

    def frame_at(d):
        d = min(max(d, 0.0), D)
        tt = _dist_to_t(path, d)
        x, y = path.pos(tt)
        hd = path.heading(tt)
        if hd is None:
            hd = 0.0
        return x, y, math.radians(hd + heading_offset)

    def foot_world(i, d):
        x, y, h = frame_at(d)
        ox, oy = rest[i]
        wx = x + ox * math.cos(h) - oy * math.sin(h)
        wy = y + ox * math.sin(h) + oy * math.cos(h)
        return Vector((wx, wy, zf(wx, wy)))

    # airborne windows of the footfall pattern: the body flies only when every foot is in swing
    NS = 240
    free = [all(((k / NS + phases[i]) % 1.0) >= duty for i in range(4)) for k in range(NS)]
    hop_tab = np.zeros(NS)
    if flight > 0 and any(free) and not all(free):
        k0 = free.index(False)
        runs, cur = [], []
        for j in range(NS):
            k = (k0 + j) % NS
            if free[k]:
                cur.append(k)
            elif cur:
                runs.append(cur)
                cur = []
        if cur:
            runs.append(cur)
        for r_ in runs:
            n = len(r_)
            for j, k in enumerate(r_):
                hop_tab[k] = math.sin(math.pi * (j + 0.5) / n) * min(1.0, n / (NS * 0.25))

    def f(t, p):
        x, y = path.pos(t)
        d = path.dist(t)
        v = path.speed(t)
        amt = min(1.0, v / v_full)
        p["x"], p["y"] = x, y
        p["z"] = zf(x, y)
        if face:
            hd = path.heading(t)
            if hd is not None:
                p["heading"] = hd + heading_offset
        h = math.radians(p.get("heading", 0.0))
        cyc = 2.0 * stride
        # body: crouch, lean, bob (twice per cycle for a trot), flight hop for a run
        ph_b = d / cyc
        p["crouch"] = p.get("crouch", 0.0) + crouch * amt
        p["lean"] = p.get("lean", 0.0) + lean * amt
        hop = bob * amt * (0.5 - 0.5 * math.cos(4 * math.pi * ph_b))
        if flight > 0:
            fl = float(np.interp((ph_b % 1.0) * NS, np.arange(NS + 1), np.append(hop_tab, hop_tab[0])))
            hop += flight * amt * fl
            p["squash"] = p.get("squash", 0.0) + squash * amt * (fl - 0.3)
            p["lean"] = p.get("lean", 0.0) + 4.0 * amt * math.sin(2 * math.pi * ph_b)
        p["hop"] = p.get("hop", 0.0) + hop
        p["roll"] = p.get("roll", 0.0) + sway * amt * math.sin(2 * math.pi * ph_b)
        for side, sg in (("L", 1), ("R", -1)):
            p[f"arm{side}_fwd"] = p.get(f"arm{side}_fwd", 0.0) + arm_swing * amt * math.sin(
                2 * math.pi * ph_b + (0 if side == "L" else math.pi))
        root = Vector((x, y, p["z"] + p["hop"]))
        for i in range(4):
            c = (d / cyc + phases[i]) % 1.0
            d_mid = d - (c - duty / 2) * cyc if c < duty else None
            if c < duty:
                fw = foot_world(i, d_mid + stride * 0.0)
            else:
                u = (c - duty) / (1 - duty)
                d_prev = d - (c - duty / 2) * cyc
                d_next = d_prev + cyc
                a, b = foot_world(i, d_prev), foot_world(i, d_next)
                e = u * u * (3 - 2 * u)
                fw = a.lerp(b, e)
                fw.z += lift * min(1.0, amt * 1.5) * math.sin(math.pi * u)
            dl = fw - root
            lx = dl.x * math.cos(h) + dl.y * math.sin(h)
            ly = -dl.x * math.sin(h) + dl.y * math.cos(h)
            # settle into the rest stance when slow (starts/stops): the stride scales with speed
            sw = min(1.0, amt / 0.6)
            sw = sw * sw * (3 - 2 * sw)
            ox, oy = rest[i]
            gz = zf(x + ox * math.cos(h) - oy * math.sin(h), y + ox * math.sin(h) + oy * math.cos(h)) - root.z
            p[f"foot{i}_x"] = ox + (lx - ox) * sw
            p[f"foot{i}_y"] = oy + (ly - oy) * sw
            p[f"foot{i}_z"] = gz + (dl.z - gz) * sw
    return f


def walk(path, **kw):
    return gait(path, **kw)


def run(path, **kw):
    a = dict(stride=0.42, duty=0.38, lift=0.09, bob=0.0, flight=0.11, lean=5.0, squash=0.10,
             phases=(0.0, 0.5, 0.5, 0.0), arm_swing=0.0, sway=1.5, v_full=0.9)
    a.update(kw)
    return gait(path, **a)


def crawl(path, **kw):
    a = dict(stride=0.09, duty=0.78, lift=0.02, crouch=0.65, lean=10.0, bob=0.006, sway=4.0, arm_swing=0.0,
             v_full=0.12)
    a.update(kw)
    return gait(path, **a)


# ================================================================ Sprout presets & layers
S_SEED = dict(grow=0.0, crack=0.0, unfurl=0.0, eye_open=0.0, glow=0.35, health=0.7)
S_SPROUT = dict(grow=1.0, crack=1.0, unfurl=1.0, leaf_open=1.0, eye_open=1.0)
S_SHY = dict(S_SPROUT, lean=6.0, head_turn=-18.0, head_nod=14.0, look_x=-0.6, look_y=-0.5, eye_open=0.7,
             leafL_curl=0.45, leafR_curl=0.55, leafL_reach=-20.0, leafR_reach=-15.0, blush=0.8, mouth=0.2)
S_HAPPY = dict(S_SPROUT, lean=-6.0, head_nod=-10.0, eye_happy=1.0, leafL_reach=35.0, leafR_reach=35.0,
               leafL_curl=-0.15, leafR_curl=-0.15, glow=1.4, health=1.0, mouth=0.9, blush=0.5, look_y=0.4)
S_WILT = dict(S_SPROUT, droop=1.0, lean=12.0, head_nod=40.0, leafL_droop=1.0, leafR_droop=1.0, eye_open=0.35,
              glow=0.18, health=0.08, look_y=-0.6, mouth=-0.3)
S_REACH = dict(S_SPROUT, lean=14.0, leafR_reach=55.0, leafR_curl=-0.1, look_y=0.3, eye_open=1.1)
S_CURL_FINGER = dict(S_SPROUT, lean=8.0, leafR_reach=10.0, leafR_curl=1.0, head_nod=-4.0, eye_happy=0.6, mouth=0.6,
                     glow=1.2, health=1.0)
S_TOUCH = dict(S_SPROUT, lean=18.0, head_nod=-14.0, leafR_reach=70.0, leafR_curl=0.25, eye_open=0.6, look_y=0.5,
               glow=0.4, health=0.25, mouth=0.15)
S_DRINK = dict(S_SPROUT, lean=-12.0, head_nod=-26.0, leafL_reach=60.0, leafR_reach=60.0, leafL_curl=-0.2,
               leafR_curl=-0.2, glow=2.2, health=1.0, eye_open=0.0, eye_happy=0.7, mouth=0.5)
S_SHIVER = dict(S_SPROUT, lean=4.0, head_nod=12.0, leafL_curl=0.85, leafR_curl=0.85, leafL_reach=-10.0,
                leafR_reach=-10.0, eye_open=0.5, glow=0.55, health=0.45, mouth=-0.2)
S_HUG = dict(lean=22.0, side=-8.0, head_nod=-10.0, leafL_reach=40.0, leafR_reach=40.0, leafL_curl=0.6,
             leafR_curl=0.6, eye_happy=1.0, mouth=0.8, glow=1.3, health=1.0)


def sprout_shiver(t0, t1, amp=1.0, freq=15.0, seed=0, ramp=0.15):
    def f(t, p):
        if not (t0 <= t <= t1):
            return
        w = min(1.0, (t - t0) / ramp, (t1 - t) / ramp) * amp
        s1 = math.sin(2 * math.pi * freq * t + seed)
        s2 = math.sin(2 * math.pi * freq * 1.31 * t + seed * 1.7)
        p["side"] = p.get("side", 0.0) + 3.0 * w * s1
        p["head_tilt"] = p.get("head_tilt", 0.0) + 4.0 * w * s2
        for s in "LR":
            p[f"leaf{s}_reach"] = p.get(f"leaf{s}_reach", 0.0) + 5.0 * w * (s1 if s == "L" else s2)
    return f


def sprout_breathe(amp=0.03, rate=0.4, seed=0.0):
    """The sprout's idle: a slow glow pulse and a little sway."""
    def f(t, p):
        s = math.sin(2 * math.pi * rate * t + seed)
        p["glow"] = p.get("glow", 1.0) * (1 + 0.12 * s)
        p["side"] = p.get("side", 0.0) + 2.0 * s
        p["squash"] = p.get("squash", 0.0) + amp * s
    return f
