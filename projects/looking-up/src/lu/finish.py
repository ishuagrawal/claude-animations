"""Shot finishing applied by render_shot after a shot's make(): an interior "face key", i.e. a soft warm cheat light
from between the camera and the brightest practical, light-linked to the characters only, so their faces and
expressions read in dark rooms (the film-lighting trick; the set keeps its moody practical-only light)."""
import bpy
from mathutils import Vector

from . import framing
from .scene import look_at

PRACTICALS = ("OilLamp", "StoveGlow", "Candle", "Lantern", "StarLight", "Star")


def _practical_lights():
    out = []
    for o in bpy.context.scene.objects:
        if o.type == "LIGHT" and o.data.type == "POINT" and o.data.energy > 0 and not o.hide_render:
            out.append(o)
    return out


def face_key(energy=40.0, col=(1.0, 0.74, 0.5), dist=2.2, size=1.4):
    sc = bpy.context.scene
    chars = framing._scene_chars()
    if not chars or not sc.camera:
        return []
    fm = (sc.frame_start + sc.frame_end) // 2
    sc.frame_set(fm)
    bpy.context.view_layer.update()
    cam = sc.camera.matrix_world.translation.copy()
    lights = _practical_lights()
    made = []
    for ch in chars:
        head = ch.rig.matrix_world.translation + Vector((0, 0, 0.55 if hasattr(ch, "BODY_H") or "Claude" in ch.rig.name else 0.1))
        to_cam = cam - head
        to_cam.z = 0
        if to_cam.length < 1e-3:
            continue
        to_cam.normalize()
        # nearest bright practical that isn't inside this character
        best, bw = None, 0.0
        for lo in lights:
            if lo.parent and lo.parent == ch.rig or lo.name.startswith(ch.rig.name):
                continue
            d = (lo.matrix_world.translation - head)
            w = lo.data.energy / max(d.length_squared, 0.25)
            if w > bw:
                best, bw = lo, w
        if best is not None:
            to_l = best.matrix_world.translation - head
            to_l.z = 0
            to_l = to_l.normalized() if to_l.length > 1e-3 else to_cam
            dirv = (to_cam * 0.6 + to_l * 0.4)
            dirv = dirv.normalized() if dirv.length > 1e-3 else to_cam
            c = best.data.color
            lc = (0.5 * col[0] + 0.5 * c[0], 0.5 * col[1] + 0.5 * c[1], 0.5 * col[2] + 0.5 * c[2])
        else:
            dirv, lc = to_cam, col
        ld = bpy.data.lights.new(f"FaceKey_{ch.rig.name}", "AREA")
        ld.energy = energy
        ld.color = lc
        ld.size = size
        ld.use_shadow = False
        ob = bpy.data.objects.new(ld.name, ld)
        sc.collection.objects.link(ob)
        look_at(ob, head + dirv * dist + Vector((0, 0, 0.9)), head)
        ob.light_linking.receiver_collection = ch.col
        made.append(ob)
    return made


OUTSIDE = ("Meadow", "Patch", "Cloud", "Massif", "Pine", "Bush", "Rock", "Terrain", "Sea", "Floor")


def interior_shadow_cull():
    """Interior shots build the whole exterior for the window views; the room's practical lights would render all of
    it (55k grass cards, cloud heaps, trees) into their shadow maps. Outside-only geometry doesn't cast shadows."""
    for o in bpy.context.scene.objects:
        if o.type in ("MESH", "CURVE", "META") and o.name.startswith(OUTSIDE):
            o.visible_shadow = False


def apply(ctx, kind):
    if kind == "int":
        interior_shadow_cull()
    fk = ctx.get("face_key", 40.0 if kind == "int" else 0.0)
    if fk:
        face_key(energy=fk)
