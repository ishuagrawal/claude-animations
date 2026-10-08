"""SH01 - "Once upon a time". EWS, twilight into night. We start low in the south meadow among the flowers (blades and
petals soft in the foreground, fireflies drifting), looking up at the windmill; the camera cranes up and back on a
long slow arc - over the peak's edge and out into the air - until the windmill stands small on its island peak above
the endless moonlit sea of clouds, layered peaks beyond, and above its cap the Claude-shaped constellation, whose
chart lines breathe in so the figure reads. Held as a postcard for the last beat."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, windmill, props
from shots import act1 as A

T_LINES = 1.6        # the constellation's chart lines start breathing in
T_HOLD = 3.85        # the crane has settled: postcard


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0, window_glow=0.85, door_lantern=True))
    O = W.origin
    dur = (f1 - f0) / 24
    A.hide_tail()
    hub = W.wm["hub"]
    for f in range(f0, f1, 2):
        windmill.sails_set_angle(hub, 14.0 + 4.5 * (f - f0) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    K = A.constellation(O, lines=0.0, eye=1.0)
    A.key_lines(K, f0, f1, lambda t: 0.6 * anim.ease("soft", (t - T_LINES) / 2.2))
    # the crane: low in the flowers -> up and back over the rim -> out in the air, level with the island's top
    g0 = W.ground(1.3, -12.5)
    e0 = Vector((1.3, -12.5, g0 + 0.2))
    t0 = Vector((0.0, 7.0, 6.8))
    e1 = Vector((3.1, -49.0, 0.5))
    az, el = math.radians(92.3), math.radians(15.2)
    t1 = e1 + Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * 60.0
    W.grass_patch((1.0, -9.5), 3.2, 12000, blade=(0.12, 0.36), flowers=0.16, seed=11)
    fwd = (t0 - e0).normalized()
    fwd.z = 0
    A.fg_flowers("PatchFG01", e0 + fwd * 1.1, 1.0, 150, W.ground, seed=12, height=(0.1, 0.3))
    A.fg_flowers("PatchFG01b", e0 + fwd * 3.2, 2.2, 220, W.ground, seed=13, height=(0.12, 0.34))
    A.fireflies((1.0, -9.5, g0 + 0.7), 46, f0, f1, seed=3, spread=(6.0, 6.0, 1.4))
    mill = O + Vector((0, 0, 6.0))

    def bez(u, pts):
        while len(pts) > 1:
            pts = [a.lerp(b, u) for a, b in zip(pts, pts[1:])]
        return pts[0]
    ctrl = [e0, Vector((1.4, -16.0, g0 + 3.8)), Vector((2.8, -36.0, 7.0)), e1]
    cam = A.scene.camera("Cam", lens=17)
    tr = anim.Track(anim.CAM_DEFAULT)
    n = 9
    for i in range(n + 1):
        t = T_HOLD * i / n
        u = anim.ease("inout", t / T_HOLD)
        u = 0.82 * u + 0.18 * anim.ease("out", t / T_HOLD)      # leaves the flowers a touch sooner, lands softer
        e = bez(u, list(ctrl))
        tg = t0.lerp(t1, anim.ease("smooth", min(1.0, u * 1.08)))
        fd = (mill - e).length
        tr.key(t, "linear", cx=e.x, cy=e.y, cz=e.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=17, fstop=2.0 + 9.0 * u, focus=fd)
    e2 = e1 + Vector((0.2, -0.9, 0.05))
    tr.key(dur, "soft", cx=e2.x, cy=e2.y, cz=e2.z, tx=t1.x, ty=t1.y, tz=t1.z, fstop=11.0, focus=(mill - e2).length)
    tr.layer(lambda t, p: p.update(shake=0.12 * (1 - anim.ease("soft", t / T_HOLD))))
    anim.bake_camera(cam, tr, f0, f1 - 1, seed=101)
    bpy.context.scene.camera = cam
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=70.0, mist_depth=2200.0, bloom=0.8, bloom_thr=0.45,
                          vignette=0.38))
