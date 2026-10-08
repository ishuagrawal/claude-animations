"""Automatic camera framing: fit subjects in frame for a lens, keep a clear line of sight (raycast), stay inside
the room for interiors. Directions are given relative to a character's front so faces read."""
import math
import bpy
from mathutils import Vector, Matrix

from .scene import W, H

IGNORE = ("Balloon", "SewnBalloon", "Lantern", "Rope", "rope", "Rain", "Bolt", "Ray", "Meadow", "Patch", "Grass", "Mote", "Beam", "Puff", "Spark", "Trail", "Cloud", "Flour", "Steam", "Smoke",
          "Dust", "Petal", "Bump", "Hiss", "Tap", "CS_", "CL_", "Meteor", "Comet", "Quilt", "Massif", "Star_light",
          "Splinter", "Ceil", "LandSparks", "FallStreak", "Crater", "Rug")


def fov(lens, sensor=36.0):
    h = 2 * math.atan(sensor / 2 / lens)
    v = 2 * math.atan(math.tan(h / 2) * H / W)
    return h, v


def _blocked(eye, pts, ignore_objs):
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    for p in pts:
        d = p - eye
        L = d.length
        if L < 1e-4:
            continue
        o = eye.copy()
        dn = d.normalized()
        travelled = 0.0
        for _ in range(8):
            hit, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, o, dn, distance=L - travelled - 0.12)
            if not hit:
                break
            name = ob.name if ob else ""
            if ob in ignore_objs or any(name.startswith(k) for k in IGNORE) or (ob and ob.parent in ignore_objs):
                step = (loc - o).length + 0.02
                o = loc + dn * 0.02
                travelled += step
                continue
            return True
    return False


def auto(subjects, facing=None, yaw=25.0, elev=12.0, lens=35.0, margin=1.08, pad=0.15, room=None, chars=(),
         search=(0, 12, -12, 24, -24, 36, -36, 50, -50), dist=None, min_dist=0.6):
    """Return (eye, target, lens).
    subjects: list of Vectors to keep in frame. facing: (pos, heading_deg) of the main character — yaw is measured
    from its front (0 = straight on, + = toward screen-right of the character). If facing is None, yaw is a world
    azimuth (deg, 0 = +X). room: (centre Vector, radius) to keep the camera inside an interior."""
    pts = [Vector(p) for p in subjects]
    c = sum(pts, Vector()) / len(pts)
    r = max((p - c).length for p in pts) + pad
    hf, vf = fov(lens)
    d_fit = r * margin / math.sin(min(hf, vf) / 2)
    d = dist or d_fit
    ignore = set()
    for ch in chars:
        ignore.add(ch.rig)
        for o in getattr(ch, "parts", []):
            ignore.add(o)
        for o in getattr(ch, "eyes", []):
            ignore.add(o)
        if hasattr(ch, "body"):
            ignore.add(ch.body)
    best = None
    for s in search:
        if facing is not None:
            pos, hd = facing
            h = math.radians(hd + yaw + s)
            az = Vector((math.sin(h), -math.cos(h), 0))
        else:
            a = math.radians(yaw + s)
            az = Vector((math.cos(a), math.sin(a), 0))
        e = math.radians(elev)
        dirv = (az * math.cos(e) + Vector((0, 0, math.sin(e)))).normalized()
        dd = d
        ln = lens
        if room is not None:
            rc, rr = room
            # pull in until inside the room; widen the lens to keep the subjects in frame
            for _ in range(40):
                eye = c + dirv * dd
                if math.hypot(eye.x - rc.x, eye.y - rc.y) <= rr:
                    break
                dd *= 0.92
            dd = max(dd, min_dist)
            if dd < d_fit:
                need = math.atan(r * margin / dd) * 2
                vf_need = need
                hf_need = 2 * math.atan(math.tan(vf_need / 2) * W / H)
                ln = max(14.0, min(lens, 18.0 / math.tan(hf_need / 2)))
        eye = c + dirv * dd
        if not _blocked(eye, pts, ignore):
            if s != search[0]:
                print(f"FRAMING: yaw offset {s} used (preferred view blocked)")
            return eye, c, ln
        if best is None:
            best = (eye, c, ln)
    print("FRAMING WARNING: every candidate view is blocked; using the preferred one")
    return best


def inside_mesh(eye):
    """True if eye is enclosed by geometry (most axis rays hit back faces nearby) - camera stuck in a wall/tree/body."""
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    back = 0
    for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((0, 0, -1))):
        hit, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, eye, d, distance=3.0)
        if hit and nrm.dot(d) > 0.05 and not any(ob.name.startswith(k) for k in ("Meadow", "Patch", "Grass", "Mote", "Beam", "Rain")):
            back += 1
    return back >= 3


def _char_points(chars):
    pts = []
    for ch in chars:
        rig = ch.rig
        o = rig.matrix_world.translation
        if hasattr(ch, "body"):           # star
            pts += [o]
        else:
            for dz in (0.25, 0.45, 0.62):
                pts.append(o + Vector((0, 0, dz)))
    return pts


def _too_close(eye, chars, min_d=0.45):
    for ch in chars:
        o = ch.rig.matrix_world.translation
        if hasattr(ch, "body"):
            if (eye - o).length < 0.22:
                return True
        else:
            c = o + Vector((0, 0, 0.4))
            if (eye - c).length < min_d:
                return True
    return False


def validate(eye, tgt, chars=(), extra_pts=(), frame=None, label="cam", min_d=0.45):
    """Return a camera position near `eye` (same target) that is not inside geometry, not inside/too close to a
    character, and sees the characters + extra points unobstructed. Searches rotations/elevations/pull-ins."""
    if frame is not None:
        at_frame(frame)
    pts = _char_points(chars) + [Vector(p) for p in extra_pts]
    ignore = set()
    for ch in chars:
        ignore.add(ch.rig)
        for o in getattr(ch, "parts", []) + getattr(ch, "eyes", []):
            ignore.add(o)
        if hasattr(ch, "body"):
            ignore.add(ch.body)
    eye, tgt = Vector(eye), Vector(tgt)

    def ok(e):
        if inside_mesh(e) or _too_close(e, chars, min_d):
            return False
        return not _blocked(e, pts, ignore) if pts else True
    if ok(eye):
        return eye
    off = eye - tgt
    for scale in (1.0, 0.85, 1.15, 0.7):
        for dz in (0.0, 0.25, -0.2, 0.5):
            for ang in (10, -10, 20, -20, 32, -32, 45, -45, 60, -60, 80, -80):
                R = Matrix.Rotation(math.radians(ang), 3, "Z")
                e = tgt + (R @ off) * scale + Vector((0, 0, dz))
                if ok(e):
                    print(f"CAMFIX {label}: rot {ang} scale {scale} dz {dz}")
                    return e
    print(f"CAMFIX {label}: no clear view found; keeping original")
    return eye


def shot_cam(name, f0, f1, eye, tgt, lens, push=0.08, lens_end=None, fstop=2.8, shake=0.2, t_eval=None, focus_on=None,
             rise=0.0, seed=0, chars=(), extra_pts=(), check_frame=None, check=True):
    """Make + bake a camera from an auto-framed (eye, target): slow push-in, optional lens change, gentle handheld.
    If chars/extra_pts are given (or any characters exist), the eye is validated first (see validate)."""
    from . import scene, anim
    from .anim import Track, CAM_DEFAULT
    if check:
        if not chars:
            chars = _scene_chars()
        eye = validate(eye, tgt, chars, extra_pts, frame=check_frame if check_frame is not None else (f0 + f1) // 2,
                       label=name)
    cam = scene.camera(name, lens=lens)
    dur = (f1 - f0) / 24
    d = (Vector(tgt) - Vector(eye))
    e1 = Vector(eye) + d.normalized() * d.length * push + Vector((0, 0, rise))
    ct = Track(CAM_DEFAULT)
    fd = (Vector(focus_on) - Vector(eye)).length if focus_on is not None else d.length
    ct.key(0, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=lens, fstop=fstop, focus=fd)
    ct.key(dur, "soft", cx=e1.x, cy=e1.y, cz=e1.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=lens_end or lens, fstop=fstop,
           focus=fd * (1 - push))
    ct.layer(lambda t, p: p.update(shake=shake))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=seed)
    return cam


_CHARS = []


def register_char(ch):
    _CHARS.append(ch)


def _scene_chars():
    return [c for c in _CHARS if c.rig.name in bpy.data.objects]


def at_frame(f):
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()
