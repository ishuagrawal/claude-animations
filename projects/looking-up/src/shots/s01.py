"""S01 — EWS dusk: the peak above the sea of clouds, the windmill backlit against the last light, its window
glowing; sails turning slowly; slow push-in. (Title is composited at encode.)"""
import math
from mathutils import Vector
from lu import world, anim, scene, windmill
from lu.anim import Track, CAM_DEFAULT


def make(f0, f1):
    W = world.World("ext", "dusk", windmill_state=dict(window_glow=1.0, sails_angle=10.0))
    O = W.origin
    dur = (f1 - f0) / 24
    # sails turn slowly
    hub = W.wm["hub"]
    for f in range(f0, f1):
        t = (f - f0) / 24
        windmill.sails_set_angle(hub, 10.0 + 9.0 * t)
        hub.keyframe_insert("rotation_euler", frame=f)
    cam = scene.camera(lens=50)
    sd = Vector(W.P["sun_dir"])
    away = Vector((-sd.x, -sd.y, 0)).normalized()
    c0 = O + away * 112 + Vector((0, 0, 9.0))
    c1 = O + away * 96 + Vector((0, 0, 8.0))
    tgt = O + Vector((0, 0, 6.0))
    tr = Track(CAM_DEFAULT)
    tr.key(0, cx=c0.x, cy=c0.y, cz=c0.z, tx=tgt.x, ty=tgt.y, tz=tgt.z + 1.0, lens=50, fstop=0)
    tr.key(dur, "soft", cx=c1.x, cy=c1.y, cz=c1.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=52)
    anim.bake_camera(cam, tr, f0, f1 - 1)
    sxy = scene.sun_screen(cam, W.P["sun_dir"])
    return dict(post=dict(haze=(0.30, 0.22, 0.34), haze_warm=W.P["haze"], haze_amt=0.5, mist_start=125.0,
                          mist_depth=2200.0, bloom=0.6, bloom_thr=0.7, sun_xy=sxy, sun_glow=0.9, sun_size=0.95,
                          gamma=(0.95, 0.95, 0.95), sat=1.1))
