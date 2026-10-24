"""Shared staging for Act IV (THE BLOOM, B16-B19) and the coda (B20).

The summit: the soil patch at layout.PEAK_SOIL inside a ring of crown rocks. Claude arrives from the south (B16),
kneels at KNEEL facing NNE (HEADING) and plants the sprout at PLANT, just inside the near edge of the soil (B17).
The bloom wave leaves PEAK_SOIL (B18); the sapling stands at PLANT (B19); the great tree grows there (B20).
Sun: beam phase az 72 / el 50 (the shaft slants down from the ENE), bloom az 72 / el 36, coda az 215 / el 27."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, layout

FPS = 24
HEADING = 165.0                                    # Claude faces az 75 (NNE), toward the soil and the low sun
_h = math.radians(HEADING)
FWD = Vector((math.sin(_h), -math.cos(_h), 0.0))   # world forward of a character at HEADING
LEFT = Vector((math.cos(_h), math.sin(_h), 0.0))   # its left (+X local)
PLANT = Vector((29.97, 148.62, 0.0))               # where the sprout goes into the soil (z filled by the world)
KNEEL = PLANT - FWD * 0.47                         # Claude's root while kneeling and planting (hands reach 0.47 m)

# material states (continuity: ash from B01, wet from B11, damage from B12 on, gold only in B20)
MAT_BEAM = dict(ash=0.18, wet=0.8, damage=1.0, gold=0.0, vivid=0.0)
MAT_BLOOM = dict(ash=0.05, wet=0.1, damage=1.0, gold=0.0, vivid=0.0)
MAT_CODA = dict(ash=0.0, wet=0.0, damage=1.0, gold=1.0, vivid=0.0)


def gz(W, p):
    return W.ground(p[0], p[1])


def on_ground(W, p, dz=0.0):
    return Vector((p[0], p[1], W.ground(p[0], p[1]) + dz))


def local_to_world(root, heading, v):
    """Character-space (x left, y back, z up; character faces -Y) -> world, for a character at root / heading."""
    h = math.radians(heading)
    x, y, z = v
    return Vector((root[0] + x * math.cos(h) - y * math.sin(h), root[1] + x * math.sin(h) + y * math.cos(h),
                   root[2] + z))


def world_to_local(root, heading, p):
    h = math.radians(heading)
    dx, dy = p[0] - root[0], p[1] - root[1]
    return Vector((dx * math.cos(h) + dy * math.sin(h), -dx * math.sin(h) + dy * math.cos(h), p[2] - root[2]))


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def smoother(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * u * (u * (6 * u - 15) + 10)


def lerp(a, b, u):
    return a + (b - a) * u


def vlerp(a, b, u):
    return Vector(a).lerp(Vector(b), u)


def bake_cam(cam, fn, f0, f1, shake=None, seed=0):
    """Key a camera from fn(t) -> dict(eye, tgt, lens, [roll, fstop, focus]) per frame (t = shot-local seconds).
    shake(t) -> amplitude (handheld: same noise as anim.bake_camera)."""
    cd = cam.data
    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        p = fn(t)
        eye, tgt = Vector(p["eye"]), Vector(p["tgt"])
        sh = shake(t) if shake else 0.0
        if sh:
            eye = eye + Vector((anim.snoise(t, seed, 0.7) * 0.02, anim.snoise(t, seed + 1, 0.6) * 0.02,
                                anim.snoise(t, seed + 2, 0.8) * 0.015)) * sh
            tgt = tgt + Vector((anim.snoise(t, seed + 5, 0.9), anim.snoise(t, seed + 6, 0.8),
                                anim.snoise(t, seed + 7, 1.0))) * 0.012 * sh * (tgt - eye).length
        d = tgt - eye
        q = d.to_track_quat("-Z", "Y")
        roll = p.get("roll", 0.0) + (anim.snoise(t, seed + 3, 0.5) * 0.3 * sh if sh else 0.0)
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q @ Matrix.Rotation(math.radians(roll), 4, "Z").to_quaternion()
        cam.location = eye
        cd.lens = p["lens"]
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cd.keyframe_insert("lens", frame=f)
        if p.get("fstop"):
            cd.dof.use_dof = True
            cd.dof.aperture_fstop = p["fstop"]
            cd.dof.focus_distance = p.get("focus") or d.length
            cd.dof.keyframe_insert("focus_distance", frame=f)
            cd.dof.keyframe_insert("aperture_fstop", frame=f)
    return cam


def key_energy(light, keys):
    """keys = [(frame, energy), ...] on a light object's data."""
    for f, e in keys:
        light.data.energy = e
        light.data.keyframe_insert("energy", frame=f)


def key_prop(obj, prop, keys):
    for f, v in keys:
        obj[prop] = v
        obj.keyframe_insert(f'["{prop}"]', frame=f)


def follow_light(light, char, offset, f0, f1, step=2):
    """Key a light to ride with a moving character (world offset from its root), keeping its aim."""
    sc = bpy.context.scene
    rot = light.matrix_world.to_quaternion()
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f)
        light.location = char.rig.matrix_world.translation + Vector(offset)
        light.keyframe_insert("location", frame=f)
    light.rotation_mode = "QUATERNION"
    light.rotation_quaternion = rot


def animatic_readable(chars=(), extra=()):
    """--anim (Workbench) only: hide the volume / billboard FX that render as solid slabs there, and give the
    characters flat viewport colours so the blocking reads."""
    import sys
    if "--anim" not in sys.argv:
        return
    for o in bpy.data.objects:
        if o.name.startswith(("LightVolume", "Sunbeam", "GlowOrb", "PatchGlow", "PatchBeam", "SmokeCol", "SmokeWisp",
                              "RainSheet", "Dust", "Soil", "Puff") + tuple(extra)):
            o.hide_render = True
    cols = {"Claude": (0.85, 0.28, 0.10, 1.0), "Sprout": (0.35, 0.95, 0.35, 1.0)}
    for ch in chars:
        c = next((v for k, v in cols.items() if ch.rig.name.startswith(k)), (0.9, 0.9, 0.2, 1.0))
        for o in ch.col.all_objects:
            for s in getattr(o, "material_slots", []):
                if s.material:
                    n = s.material.name.lower()
                    dark = "eye" in n or "lash" in n or "pupil" in n
                    s.material.diffuse_color = (0.02, 0.02, 0.02, 1.0) if dark else c


SKIP = ("Cover", "Forest", "Leaves", "Petal", "Rain", "Mote", "Pollen", "Dust", "Sunbeam", "GlowOrb", "LightVolume",
        "Claude", "Sprout", "Bloom", "Ash", "Ember", "Smoke", "FX")


def surface_z(x, y, top=None):
    """Height of the first solid surface (terrain, the soil disc, rocks) under (x, y), skipping cover / FX / chars."""
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    o = Vector((x, y, (top if top is not None else 400.0)))
    d = Vector((0, 0, -1))
    for _ in range(12):
        hit, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, o, d, distance=1000.0)
        if not hit:
            return None
        if ob is not None and (ob.name.startswith(SKIP) or not ob.visible_get() or ob.hide_render):
            o = loc + d * 0.002
            continue
        return loc.z
    return None


def scale_sprout_light(S, k):
    """Scale the sprout's practical light (its glow drives it) for close shots where it would burn out faces."""
    for o in S.col.all_objects:
        if o.type == "LIGHT" and o.data.animation_data:
            for fc in o.data.animation_data.drivers:
                if fc.data_path == "energy" and fc.driver.type == "SCRIPTED":
                    fc.driver.expression = f"({fc.driver.expression})*{k}"


def exclude_from_light(light, chars):
    """Light-link `light` to skip the characters (so a hot set light doesn't blow out their faces in close-ups)."""
    coll = bpy.data.collections.get(f"Excl_{light.name}") or bpy.data.collections.new(f"Excl_{light.name}")
    for ch in chars:
        for o in ch.col.all_objects:
            if o.name not in coll.objects:
                coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = "EXCLUDE"
    light.light_linking.receiver_collection = coll
    return coll


def char_key(ch, direction, energy, col=(1.0, 0.76, 0.45), dist=3.0, size=1.2, frame=None, shadow=True):
    """A key light for one character from a world direction (e.g. the sun's), light-linked to it only."""
    sc = bpy.context.scene
    if frame is not None:
        sc.frame_set(frame)
    t = ch.rig.matrix_world.translation + Vector((0, 0, 0.42))
    ld = bpy.data.lights.new(f"{ch.rig.name}_Key", "AREA")
    ld.energy, ld.color, ld.size = energy, col, size
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(ld.name, ld)
    sc.collection.objects.link(ob)
    p = t + Vector(direction).normalized() * dist
    ob.location = p
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = (t - p).to_track_quat("-Z", "Y")
    ob.light_linking.receiver_collection = ch.col
    return ob
