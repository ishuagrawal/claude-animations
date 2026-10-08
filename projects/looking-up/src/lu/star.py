"""The fallen star: a plump, glowing five-point 'pillow' star with expressive eyes.

Body language channels: its five points (0 = top/head, 1 = upper-right arm, 2 = lower-right leg,
3 = lower-left leg, 4 = upper-left arm, as seen from the front) can droop, perk, curl forward (hug /
fear) or reach; the whole body squashes; its glow brightens with joy, flickers with fear and dims as it
weakens; eyes use the same shader as Claude's (rounder).

Faces -Y. Origin at the star's centre.
"""
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector

from . import geo, mat

R_TIP = 0.17      # metres (tip radius)
R_IN = 0.088      # inner (valley) radius
THICK = 0.075     # half-thickness at the centre

DEFAULT = dict(
    x=0.0, y=0.0, z=0.0, heading=0.0, pitch=0.0, roll=0.0, spin=0.0, squash=0.0, scale=1.0,
    curl=0.0, droop=0.0, arms=0.0, head=0.0, legs=0.0,
    p0=0.0, p1=0.0, p2=0.0, p3=0.0, p4=0.0,          # extra in-plane swing per point (deg)
    c0=0.0, c1=0.0, c2=0.0, c3=0.0, c4=0.0,          # extra curl per point (deg)
    glow=1.0, warmth=1.0,
    eye_open=1.0, eye_tilt=0.0, eye_happy=0.0, eye_round=0.42, look_x=0.0, look_y=0.0, glint=1.0, pupil=1.0,
    eyeL_open=0.0, eyeR_open=0.0,
)

GLOW_WARM = (1.0, 0.40, 0.05)
GLOW_HOT = (1.0, 0.70, 0.24)
GLOW_DIM = (0.34, 0.38, 0.46)


def _profile(theta):
    """Star outline radius at angle theta (0 = up), rounded tips and soft valleys."""
    k = (theta / (2 * math.pi / 5)) % 1.0
    c = math.cos(k * 2 * math.pi)       # 1 at tips, -1 at valleys
    t = (c + 1) / 2
    t = t ** 1.6
    return R_IN + (R_TIP - R_IN) * t


def point_angle(i):
    return math.pi / 2 - i * 2 * math.pi / 5     # world angle in the XZ plane (0 = +X), i=0 top


def star_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)

    def prop(p):
        return nb.n("ShaderNodeAttribute", attribute_name=p, attribute_type="OBJECT").outputs["Fac"]

    rad = nb.n("ShaderNodeAttribute", attribute_name="radial", attribute_type="GEOMETRY").outputs["Fac"]
    glow = prop("glow")
    warmth = prop("warmth")
    hot = nb.n("ShaderNodeRGB")
    hot.outputs[0].default_value = (*GLOW_HOT, 1)
    warm = nb.n("ShaderNodeRGB")
    warm.outputs[0].default_value = (*GLOW_WARM, 1)
    dim = nb.n("ShaderNodeRGB")
    dim.outputs[0].default_value = (*GLOW_DIM, 1)
    # core is hotter, tips warmer
    col = nb.mix(nb.mapr(rad, 0.15, 0.95), hot.outputs[0], warm.outputs[0])
    # as warmth drops the star cools and greys out
    col = nb.mix(nb.sub(1.0, warmth), col, dim.outputs[0])
    # painterly variation (brush strokes) so it isn't a flat sticker
    tc = nb.n("ShaderNodeAttribute", attribute_name="rest", attribute_type="GEOMETRY").outputs["Vector"]
    st = mat.tex_node(nb, "strokes_soft", tc, 6.0)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    strength = nb.mul(glow, nb.add(nb.mul(nb.sub(sv, 0.5), 0.5), nb.sub(1.6, nb.mul(rad, 0.7))))
    # facing: edges a touch brighter (rim glow)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.4})
    strength = nb.add(strength, nb.mul(lw.outputs["Fresnel"], nb.mul(glow, 0.6)))
    # never fully dark: an ember remains
    strength = nb.math("MAXIMUM", strength, 0.06)
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", col)
    nb.inp(em, "Strength", nb.mul(strength, 0.62))
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(em.outputs[0], out.inputs["Surface"])
    return m


class Star:
    def __init__(self, name="Star", collection=None, light=True):
        self.name = name
        col = collection or geo.coll(name)
        self.col = col
        # ---------------- rig
        ad = bpy.data.armatures.new(name + "_rig")
        rig = bpy.data.objects.new(name, ad)
        col.objects.link(rig)
        self.rig = rig
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        eb = ad.edit_bones
        b = eb.new("core")
        b.head = (0, 0, 0)
        b.tail = (0, 0, R_IN * 0.8)
        for i in range(5):
            a = point_angle(i)
            d = Vector((math.cos(a), 0, math.sin(a)))
            pb = eb.new(f"pt{i}")
            pb.head = d * R_IN * 0.55
            pb.tail = d * R_TIP
            pb.parent = eb["core"]
        bpy.ops.object.mode_set(mode="OBJECT")
        self.rest = {bb.name: bb.matrix_local.to_3x3() for bb in ad.bones}
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
        # ---------------- mesh (pillow star)
        nth, nr = 160, 14
        verts, faces, radial, rest = [], [], [], []
        for side in (-1, 1):     # front (-Y) and back (+Y)
            verts.append((0.0, side * THICK, 0.0))
            radial.append(0.0)
            for j in range(1, nr + 1):
                t = j / nr
                for i in range(nth):
                    th = 2 * math.pi * i / nth
                    R = _profile(th)
                    x = math.sin(th) * R * t
                    z = math.cos(th) * R * t
                    yy = side * THICK * (1 - t ** 2) ** 0.55 * (0.55 + 0.45 * (1 - (R - R_IN) / (R_TIP - R_IN) * t))
                    verts.append((x, yy, z))
                    radial.append(t * (R / R_TIP))
        per = 1 + nr * nth
        for s in range(2):
            o = s * per
            for i in range(nth):
                i2 = (i + 1) % nth
                f = (o, o + 1 + i, o + 1 + i2) if s == 1 else (o, o + 1 + i2, o + 1 + i)
                faces.append(f)
            for j in range(nr - 1):
                for i in range(nth):
                    i2 = (i + 1) % nth
                    a = o + 1 + j * nth + i
                    b_ = o + 1 + j * nth + i2
                    c = o + 1 + (j + 1) * nth + i2
                    d = o + 1 + (j + 1) * nth + i
                    faces.append((a, b_, c, d) if s == 1 else (a, d, c, b_))
        # stitch rims
        for i in range(nth):
            i2 = (i + 1) % nth
            f0 = 1 + (nr - 1) * nth
            a, b_ = f0 + i, f0 + i2
            c, d = per + f0 + i2, per + f0 + i
            faces.append((a, b_, c, d))
        body = geo.obj_from(name + "_body", verts, faces, col, star_material(name + "_glow"))
        me = body.data
        att = me.attributes.new("radial", "FLOAT", "POINT")
        att.data.foreach_set("value", np.array(radial))
        att2 = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
        att2.data.foreach_set("vector", np.array(verts).ravel())
        # weights: by angular proximity to each point, ramping with radius
        groups = {n: body.vertex_groups.new(name=n) for n in ["core"] + [f"pt{i}" for i in range(5)]}
        for v in me.vertices:
            p = v.co
            r = math.hypot(p.x, p.z)
            ang = math.atan2(p.z, p.x)
            w = {}
            rt = min(max((r - R_IN * 0.45) / (R_TIP - R_IN * 0.45), 0.0), 1.0)
            for i in range(5):
                da = abs((ang - point_angle(i) + math.pi) % (2 * math.pi) - math.pi)
                wa = max(0.0, 1 - da / (2 * math.pi / 5 * 0.62))
                w[f"pt{i}"] = wa * rt ** 0.8
            tot = sum(w.values())
            w["core"] = max(0.0, 1 - tot)
            s = sum(w.values()) or 1
            for n_, val in w.items():
                if val > 1e-4:
                    groups[n_].add([v.index], val / s, "REPLACE")
        self.body = body
        # ---------------- eyes
        self.eyes = []
        ew = 0.05
        for side, sx in (("L", 1), ("R", -1)):
            em = mat.eye_material(f"{name}_eye{side}", side=sx, color=(0.03, 0.018, 0.012), glint_col=(1, 1, 1),
                                  rim=(0.12, 0.06, 0.03))
            n = 3
            vs, fs, uv = [], [], []
            cx, cz = sx * 0.036, 0.014
            for j in range(n + 1):
                for i in range(n + 1):
                    u, w_ = i / n - 0.5, j / n - 0.5
                    x, z = cx + u * ew / 0.8, cz + w_ * ew / 0.8 * 1.25
                    vs.append((x, -THICK * 0.97 - 0.0015, z))
                    uv.append((u, 0.0, w_))
            for j in range(n):
                for i in range(n):
                    a = j * (n + 1) + i
                    fs.append((a, a + 1, a + n + 2, a + n + 1))
            e = geo.obj_from(f"{name}_eye{side}", vs, fs, col, em, smooth=False)
            e.data.attributes.new("eyeuv", "FLOAT_VECTOR", "POINT").data.foreach_set("vector", np.array(uv).ravel())
            for k, v in mat.EYE_PROPS.items():
                e[k] = v
            e["eye_round"] = 0.42
            e.vertex_groups.new(name="core").add(list(range(len(vs))), 1.0, "REPLACE")
            self.eyes.append(e)
        for p in [body] + self.eyes:
            p.parent = rig
            md = p.modifiers.new("rig", "ARMATURE")
            md.object = rig
        body["glow"] = 1.0
        body["warmth"] = 1.0
        body.visible_shadow = False
        for e in self.eyes:
            e.visible_shadow = False
        # ---------------- light
        self.light = None
        if light:
            ld = bpy.data.lights.new(name + "_light", "POINT")
            ld.color = GLOW_WARM
            ld.energy = 60.0
            ld.shadow_soft_size = 0.12
            ld.use_shadow = True
            lo = bpy.data.objects.new(name + "_light", ld)
            col.objects.link(lo)
            lo.parent = rig
            lo.location = (0, -0.05, 0)
            self.light = lo
        self.light_scale = 60.0

    # ------------------------------------------------------------------ posing
    def _set(self, bname, R):
        M = self.rest[bname]
        self.rig.pose.bones[bname].rotation_quaternion = (M.inverted() @ R @ M).to_quaternion()

    def apply(self, p):
        P = dict(DEFAULT)
        P.update(p)
        r = math.radians
        rig = self.rig
        rig.location = (P["x"], P["y"], P["z"])
        rig.rotation_mode = "XYZ"
        rig.rotation_euler = (r(P["pitch"]), r(P["roll"]) + r(P["spin"]) * 0, r(P["heading"]))
        rig.rotation_mode = "ZXY"
        rig.rotation_euler = (r(P["pitch"]), r(P["spin"]) + r(P["roll"]), r(P["heading"]))
        s = P["squash"]
        sc = P["scale"]
        rig.scale = (sc / math.sqrt(max(1 + s, 0.2)), sc, sc * (1 + s))
        for i in range(5):
            a = point_angle(i)
            d = Vector((math.cos(a), 0, math.sin(a)))
            tang = Vector((0, 1, 0)).cross(d)   # in-plane axis for curling toward -Y
            curl = P["curl"] + P[f"c{i}"]
            swing = P[f"p{i}"]
            if i in (1, 4):
                swing += P["arms"] * (1 if i == 4 else -1)     # +arms raises both arms
                swing += -P["droop"] * (1 if i == 4 else -1)
            if i in (2, 3):
                swing += P["legs"] * (1 if i == 2 else -1)
            if i == 0:
                curl += P["head"]
            R = Matrix.Rotation(r(swing), 3, Vector((0, 1, 0))) @ Matrix.Rotation(r(-curl), 3, tang)
            self._set(f"pt{i}", R)
        self.body["glow"] = P["glow"]
        self.body["warmth"] = P["warmth"]
        if self.light:
            self.light.data.energy = self.light_scale * max(P["glow"], 0.0) ** 1.2
            w = P["warmth"]
            self.light.data.color = tuple(GLOW_WARM[k] * w + GLOW_DIM[k] * (1 - w) for k in range(3))
        for e, side in zip(self.eyes, ("L", "R")):
            for k in mat.EYE_PROPS:
                v = P[k]
                if k == "eye_open":
                    v = min(max(v + P[f"eye{side}_open"], 0.0), 1.0)
                e[k] = v

    def key(self, frame):
        rig = self.rig
        for prop in ("location", "rotation_euler", "scale"):
            rig.keyframe_insert(prop, frame=frame)
        for pb in rig.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        self.body.keyframe_insert('["glow"]', frame=frame)
        self.body.keyframe_insert('["warmth"]', frame=frame)
        if self.light:
            self.light.data.keyframe_insert("energy", frame=frame)
            self.light.data.keyframe_insert("color", frame=frame)
        for e in self.eyes:
            for k in mat.EYE_PROPS:
                e.keyframe_insert(f'["{k}"]', frame=frame)

    def bake(self, fn, f0, f1):
        for f in range(f0, f1 + 1):
            self.apply(fn(f))
            self.key(f)
