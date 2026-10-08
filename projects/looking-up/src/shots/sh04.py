"""SH04 - "Until one day". Claude's point of view from its perch, slightly wide: the constellation, big and clear.
Its right eye - the gold star - twinkles twice back (the ritual answered, TWINKLES). A warm beat. Then the eye flickers
(T_FLICKER), wobbles and breaks loose (T_FALL): it falls in a curving, sparkling streak down the frame, and the
camera tilts down after it until the meadow and the pine edge rise into frame; the streak dives into the far grass
with a gold flash (T_GONE). The constellation is left with a dark, empty eye socket.

Path logic (continuity with SH05-SH06): it touches down in the far meadow (TOUCH); out of sight it skids and bounces
back toward the windmill and slams to a stop at the CRATER with SH05's flash (the furrow runs from TOUCH's side)."""
import math
import bpy
import numpy as np
from mathutils import Vector
from lu import world, anim, scene, props, layout, fx
from shots import act1 as A

TWINKLES = (0.35, 1.0)
T_FLICKER = 1.9
T_FALL = 2.67
T_GONE = 4.3
TOUCH = (3.4, 21.2)          # where it first touches the meadow (then skids to layout.CRATER)


def sph(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def to_sph(v):
    return math.degrees(math.atan2(v.y, v.x)), math.degrees(math.atan2(v.z, math.hypot(v.x, v.y)))


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 10.7, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    fps = 24
    A.hide_tail()
    p, hd = A.gallery_spot(O)
    A.perch(W, p, hd)
    A.hook(W)
    K = A.constellation(O, lines=0.3, eye=1.0)
    eye = K["eye"]
    C = p + Vector((0, 0.24, A.C_EYE))                 # Claude's eyes, just in front of its face
    eye_pos = eye.location.copy()
    az_e, el_e = to_sph(eye_pos - C)
    T = Vector((TOUCH[0], TOUCH[1], W.ground(*TOUCH) + 0.08))
    az_t, el_t = to_sph(T - C)
    fF, fG = f0 + int(round(T_FALL * fps)), f0 + int(round(T_GONE * fps))

    # ---------------- the eye: twinkles back (shared helper), then flickers and wobbles until it tears free
    if hasattr(props, "twinkle"):
        props.twinkle(eye, f0, TWINKLES, dur=0.42, peak=2.6, spike=2.6)
    else:
        A.key_eye(K, f0, f1, A.twinkle_fn(TWINKLES, peak=3.4, dur=0.42, grow=0.6))
    rng = np.random.default_rng(4)
    flick_t = np.sort(rng.uniform(T_FLICKER, T_FALL - 0.12, 7))
    side = (eye_pos - C).cross(Vector((0, 0, 1))).normalized()
    upv = side.cross(eye_pos - C).normalized()
    for f in range(f0 + int(T_FLICKER * fps) - 1, fF - 1):
        t = (f - f0) / fps
        k = (t - T_FLICKER) / (T_FALL - T_FLICKER)
        b = 1.0
        for ft in flick_t:
            u = (t - ft) / 0.07
            if 0 <= u <= 1:
                b *= 1 - (0.55 + 0.35 * k) * math.sin(math.pi * u)
        if t > T_FALL - 0.2:                                # the last bright pop as it tears free
            b *= 1 + 1.6 * math.sin(math.pi * min(1.0, (t - (T_FALL - 0.2)) / 0.2))
        eye["eye"] = max(b, 0.05)
        eye.keyframe_insert('["eye"]', frame=f)
        r = 1800 * math.radians(0.3) * max(k, 0.0) ** 1.5
        eye.location = eye_pos + side * r * math.sin(t * 47) + upv * r * 0.6 * math.sin(t * 61 + 1)
        eye.keyframe_insert("location", frame=f)
    eye.location = eye_pos
    eye.keyframe_insert("location", frame=f0 + int(T_FLICKER * fps) - 2)
    eye.keyframe_insert("location", frame=fF)

    # ---------------- the fall: shared sparkling streak, designed as seen from Claude's eyes
    if hasattr(props, "falling_star"):
        FS = props.falling_star(start_world=eye_pos, end_world=T, f0=fF, f1=fG, view_from=C, bow=0.12, ease=1.7,
                                trail=0.36, flash=1.2, take_eye=True)
        fall_pos = FS["pos"]
    else:
        span = T_GONE - T_FALL

        def fall_pos(t):
            s = min(max(t / span, 0.0), 1.0) ** 1.55
            el = el_e + (el_t - el_e) * (s ** 0.9)
            az = az_e + (az_t - az_e) * (s ** 2.0) + 7.0 * math.sin(math.pi * min(1.0, s * 1.15)) * (1 - s)
            dist = math.exp(math.log(900.0) + (math.log((T - C).length) - math.log(900.0)) * (s ** 0.75))
            return C + sph(az, el) * dist
        A.streak("Fall", lambda t: fall_pos(t - T_FALL), T_FALL, T_GONE, f0, f1, lambda t: C, n=40, tail=0.5)
    fx.sparks("TouchSpark", T + Vector((0, 0, 0.1)), T_GONE - 0.02, f0, n=26, speed=(1.0, 3.0), life=(0.3, 0.8),
              gravity=-4.0, up=0.85, color=(1.0, 0.72, 0.3), strength=40.0, size=0.02, seed=6)
    if hasattr(fx, "petal_burst"):
        fx.petal_burst(T + Vector((0, 0, 0.05)), fG, n=30, seed=7)

    # ---------------- camera: Claude's eyes; a slow push on the constellation, then it tilts down after the streak
    az0, el0 = az_e - 4.5, el_e - 4.0
    az_end, el_end = az_t + 2.0, el_t + 5.0
    span = T_GONE - T_FALL

    # a critically damped follow: the camera chases the streak (lagging, so it starts gently and the star leads),
    # then settles on the far meadow where it went in
    w = 2 * math.pi * 2.0
    dt = 1.0 / fps
    aims = []
    x = Vector((az0, el0))
    v = Vector((0.0, 0.0))
    for i in range(0, f1 - f0 + 1):
        t = i / fps
        if t < T_FALL:
            u = anim.ease("soft", t / T_FALL)
            nx = Vector((az0 + 1.5 * u, el0 + 0.5 * u))
            v = (nx - x) / dt if i else Vector((0.0, 0.0))
            x = nx
        else:
            if t <= T_GONE:
                az_s, el_s = to_sph(fall_pos(t - T_FALL) - C)
                k = (t - T_FALL) / span
                tgt = Vector((az_s + 1.5, el_s + 6.0 - 3.0 * k))
            else:
                tgt = Vector((az_end, el_end))
            for _ in range(4):
                a = (tgt - x) * (w * w) - v * (2 * w)
                v = v + a * (dt / 4)
                x = x + v * (dt / 4)
        aims.append((x.x, x.y))

    def aim_fn(t):
        return aims[min(int(round(t * fps)), len(aims) - 1)]
    cam = scene.camera("Cam", lens=30)
    ct = anim.Track(anim.CAM_DEFAULT)
    for i in range(0, f1 - f0 + 1):
        t = i / 24
        az, el = aim_fn(t)
        tg = C + sph(az, el) * 30.0
        lens = 30.0 + 2.5 * anim.ease("soft", min(t, T_FALL) / T_FALL) - 4.5 * anim.ease("inout", (t - T_FALL) / 1.2)
        ct.key(t, "linear", cx=C.x, cy=C.y, cz=C.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=lens)
    ct.layer(lambda t, p: p.update(shake=0.03 + 0.12 * math.exp(-((t - T_FALL - 0.2) / 0.3) ** 2)))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=404)
    bpy.context.scene.camera = cam
    bpy.context.scene.render.use_motion_blur = False       # the whip-tilt smeared the star field into rain streaks
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=40.0, mist_depth=1800.0, bloom=0.95, bloom_thr=0.4,
                          vignette=0.4))
