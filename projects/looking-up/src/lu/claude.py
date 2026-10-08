"""Claude the mascot as a rigged 3D character (proportions measured from refs/claude-mascot.png).

Mascot units (body width = 1): body 1 x 0.72 (h) x DEPTH, arms 0.245 thick sticking out 0.245,
legs 0.27 tall x 0.125 wide (x centers ±0.437, ±0.184), eyes 0.116 squares at x ±0.307, 0.236 of the
body height below its top. Colour #DA7758.

Rig: armature object = root (position/heading). Bones: base (non-deform, body bottom) -> hips -> chest ->
head (deform spine); chest -> armL1 -> armL2 / armR1 -> armR2; base -> legN1 -> legN2 (N = 0..3, -X..+X).
The character faces -Y. Its LEFT is +X.

Pose parameters (all optional, degrees / metres / unitless), see DEFAULT.
"""
import math
import bpy
import numpy as np
from mathutils import Matrix, Vector, Euler, Quaternion

from . import geo, mat

S = 0.7            # metres per mascot unit (body width)
BODY_H = 0.72
DEPTH = 0.60
LEG_H = 0.27
LEG_W = 0.125
LEG_D = 0.20
LEG_X = (-0.437, -0.184, 0.184, 0.437)
ARM_T = 0.245      # arm thickness (vertical)
ARM_D = 0.22
ARM_L = 0.245      # how far the arm sticks out of the body
EYE = 0.116
EYE_X = 0.307
EYE_Z = LEG_H + BODY_H - 0.236 * BODY_H - EYE / 2 + EYE / 2   # eye centre height
ORANGE = (0.701, 0.184, 0.0976)   # linear of #DA7758

DEFAULT = dict(
    x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0, tilt_x=0.0, tilt_y=0.0,
    lean=0.0, roll=0.0, twist=0.0, squash=0.0, slump=0.0,
    head_tilt=0.0, head_nod=0.0, head_turn=0.0,
    armL_up=0.0, armL_fwd=0.0, armL_bend=0.0, armL_curl=0.0,
    armR_up=0.0, armR_fwd=0.0, armR_bend=0.0, armR_curl=0.0,
    leg0_swing=0.0, leg1_swing=0.0, leg2_swing=0.0, leg3_swing=0.0,
    leg0_knee=0.0, leg1_knee=0.0, leg2_knee=0.0, leg3_knee=0.0,
    legs_splay=0.0,
    eye_open=1.0, eye_tilt=0.0, eye_happy=0.0, eye_round=0.12, look_x=0.0, look_y=0.0, glint=1.0, pupil=1.0,
    eyeL_open=0.0, eyeR_open=0.0,   # per-eye offsets (wink / asym)
)


def _rest_attr(ob):
    """Store rest-space coordinates so brush textures stick to the surface under deformation."""
    me = ob.data
    att = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    att.data.foreach_set("vector", co)


def _weights(ob, fn):
    """fn(co) -> {bone: weight}; creates vertex groups."""
    groups = {}
    for v in ob.data.vertices:
        w = fn(v.co / S)
        tot = sum(w.values()) or 1.0
        for b, val in w.items():
            if val <= 1e-4:
                continue
            g = groups.get(b) or ob.vertex_groups.new(name=b)
            groups[b] = g
            g.add([v.index], val / tot, "REPLACE")


def _ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


class Claude:
    def __init__(self, name="Claude", collection=None, color=ORANGE, wear=0.0):
        self.name = name
        col = collection or geo.coll(name)
        self.col = col
        # ---------------- materials
        body_mat = mat.painterly(f"{name}_paint", color, stroke="strokes_soft", scale=1.5, coord="rest",
                                 tex_amt=0.28, hue_jit=0.012, bump=0.03, breakup=0.9, spec=0.14, rough=0.5, spec_col=(1.0, 0.72, 0.5),
                                 rim=0.35, ao=0.5, front_fill=1.0, snow=0.0)
        self.body_mat = body_mat
        # ---------------- armature
        arm_data = bpy.data.armatures.new(name + "_rig")
        rig = bpy.data.objects.new(name, arm_data)
        col.objects.link(rig)
        self.rig = rig
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        eb = arm_data.edit_bones

        def bone(n, h, t, parent=None, deform=True):
            b = eb.new(n)
            b.head = Vector(h) * S
            b.tail = Vector(t) * S
            b.roll = 0
            b.use_deform = deform
            if parent:
                b.parent = eb[parent]
            return b

        z0 = LEG_H
        bone("base", (0, 0, z0), (0, 0, z0 + 0.1), deform=False)
        bone("hips", (0, 0, z0), (0, 0, z0 + BODY_H * 0.33), "base")
        bone("chest", (0, 0, z0 + BODY_H * 0.33), (0, 0, z0 + BODY_H * 0.66), "hips")
        bone("head", (0, 0, z0 + BODY_H * 0.66), (0, 0, z0 + BODY_H), "chest")
        az = z0 + BODY_H * 0.505
        for side, sx in (("L", 1), ("R", -1)):
            bone(f"arm{side}1", (sx * 0.47, 0, az), (sx * (0.5 + ARM_L * 0.5), 0, az), "chest")
            bone(f"arm{side}2", (sx * (0.5 + ARM_L * 0.5), 0, az), (sx * (0.5 + ARM_L), 0, az), f"arm{side}1")
        for i, lx in enumerate(LEG_X):
            bone(f"leg{i}1", (lx, 0, z0 + 0.02), (lx, 0, z0 * 0.5), "base")
            bone(f"leg{i}2", (lx, 0, z0 * 0.5), (lx, 0, 0.0), f"leg{i}1")
        bpy.ops.object.mode_set(mode="OBJECT")
        self.rest = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"

        # ---------------- meshes
        parts = []
        body = geo.rounded_box(name + "_body", (1.0 * S, DEPTH * S, BODY_H * S), 0.095 * S, seg=(8, 6, 9), n_r=4,
                               collection=col, mat=body_mat, center=(0, 0, (z0 + BODY_H / 2) * S))
        _rest_attr(body)

        def wbody(c):
            zr = (c.z - z0) / BODY_H
            return {"hips": max(0.0, 1 - abs(zr - 0.12) / 0.4), "chest": max(0.0, 1 - abs(zr - 0.5) / 0.36),
                    "head": max(0.0, 1 - abs(zr - 0.9) / 0.4)}
        _weights(body, wbody)
        parts.append(body)
        for side, sx in (("L", 1), ("R", -1)):
            a = geo.rounded_box(f"{name}_arm{side}", ((ARM_L + 0.07) * S, ARM_D * S, ARM_T * S), 0.035 * S,
                                seg=(7, 3, 3), n_r=3, collection=col, mat=body_mat,
                                center=(sx * (0.5 + ARM_L / 2 - 0.035) * S, 0, az * S))
            _rest_attr(a)

            def warm(c, side=side):
                t = (abs(c.x) - 0.5) / ARM_L
                w2 = _ss(0.25, 0.75, t)
                ch = _ss(0.05, -0.12, t)
                return {f"arm{side}1": (1 - w2) * (1 - ch), f"arm{side}2": w2, "chest": ch}
            _weights(a, warm)
            parts.append(a)
        for i, lx in enumerate(LEG_X):
            lg = geo.rounded_box(f"{name}_leg{i}", (LEG_W * S, LEG_D * S, (LEG_H + 0.06) * S), 0.03 * S,
                                 seg=(2, 2, 7), n_r=3, collection=col, mat=body_mat,
                                 center=(lx * S, 0, (LEG_H + 0.06) / 2 * S))
            _rest_attr(lg)

            def wleg(c, i=i):
                t = (z0 - c.z) / LEG_H
                w2 = _ss(0.3, 0.7, t)
                hp = _ss(0.0, -0.15, t)
                return {f"leg{i}1": (1 - w2) * (1 - hp), f"leg{i}2": w2, "hips": hp}
            _weights(lg, wleg)
            parts.append(lg)
        # eyes: planes on the front face, shape drawn by the eye shader
        self.eyes = []
        pw = EYE / 0.8
        for side, sx in (("L", 1), ("R", -1)):
            em = mat.eye_material(f"{name}_eye{side}", side=sx)
            n = 4
            verts, faces, uv = [], [], []
            for j in range(n + 1):
                for i in range(n + 1):
                    u, w = i / n - 0.5, j / n - 0.5
                    verts.append(((sx * EYE_X + u * pw) * S, (-DEPTH / 2 - 0.003) * S, (EYE_Z + w * pw) * S))
                    uv.append((u, 0.0, w))
            for j in range(n):
                for i in range(n):
                    a = j * (n + 1) + i
                    faces.append((a, a + 1, a + n + 2, a + n + 1))
            e = geo.obj_from(f"{name}_eye{side}", verts, faces, col, em, smooth=False)
            att = e.data.attributes.new("eyeuv", "FLOAT_VECTOR", "POINT")
            att.data.foreach_set("vector", np.array(uv).ravel())
            for k, v in mat.EYE_PROPS.items():
                e[k] = v
            _weights(e, wbody)
            self.eyes.append(e)
        # parent everything to the rig with armature deformation
        for p in parts + self.eyes:
            p.parent = rig
            md = p.modifiers.new("rig", "ARMATURE")
            md.object = rig
        self.parts = parts

    # ------------------------------------------------------------------ posing
    def _set(self, bname, R=None, scale=None):
        pb = self.rig.pose.bones[bname]
        M = self.rest[bname]
        if R is None:
            R = Matrix.Identity(3)
        q = (M.inverted() @ R @ M).to_quaternion()
        pb.rotation_quaternion = q
        if scale is not None:
            pb.scale = scale

    def apply(self, p):
        """Apply a pose dict (missing keys = defaults) to the rig at the current frame."""
        P = dict(DEFAULT)
        P.update(p)
        r = math.radians
        rig = self.rig
        rig.location = (P["x"], P["y"], P["z"] + P["hop"])
        rig.rotation_mode = "ZXY"
        rig.rotation_euler = (r(P["tilt_x"]), r(P["tilt_y"]), r(P["heading"]))
        Rx = lambda a: Matrix.Rotation(r(a), 3, "X")
        Ry = lambda a: Matrix.Rotation(r(a), 3, "Y")
        Rz = lambda a: Matrix.Rotation(r(a), 3, "Z")
        lean, roll, tw, sl = P["lean"], P["roll"], P["twist"], P["slump"]
        s = P["squash"]
        sxy = 1 / math.sqrt(max(1 + s, 0.2))
        self._set("hips", Rz(tw * 0.3) @ Ry(roll * 0.55) @ Rx(lean * 0.55), scale=(sxy, 1 + s, sxy))
        self._set("chest", Rz(tw * 0.4) @ Ry(roll * 0.25) @ Rx(lean * 0.27 + sl * 0.5))
        self._set("head", Rz(tw * 0.3 + P["head_turn"]) @ Ry(roll * 0.2 + P["head_tilt"]) @ Rx(lean * 0.18 + sl * 0.5 + P["head_nod"]))
        for side, sg in (("L", 1), ("R", -1)):
            up, fwd, bend, curl = P[f"arm{side}_up"], P[f"arm{side}_fwd"], P[f"arm{side}_bend"], P[f"arm{side}_curl"]
            self._set(f"arm{side}1", Rz(-sg * fwd * 0.7) @ Ry(-sg * up))
            self._set(f"arm{side}2", Rz(-sg * (fwd * 0.3 + curl)) @ Ry(-sg * bend))
        for i in range(4):
            spl = P["legs_splay"] * (1 if LEG_X[i] > 0 else -1) * (1.0 if abs(LEG_X[i]) > 0.3 else 0.4)
            self._set(f"leg{i}1", Ry(spl) @ Rx(-P[f"leg{i}_swing"]))
            self._set(f"leg{i}2", Rx(P[f"leg{i}_knee"]))
        for e, side in zip(self.eyes, ("L", "R")):
            for k in mat.EYE_PROPS:
                v = P[k]
                if k == "eye_open":
                    v = min(max(v + P[f"eye{side}_open"], 0.0), 1.0)
                e[k] = v

    def key(self, frame):
        rig = self.rig
        rig.keyframe_insert("location", frame=frame)
        rig.keyframe_insert("rotation_euler", frame=frame)
        for pb in rig.pose.bones:
            if pb.name == "base":
                continue
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if pb.name == "hips":
                pb.keyframe_insert("scale", frame=frame)
        for e in self.eyes:
            for k in mat.EYE_PROPS:
                e.keyframe_insert(f'["{k}"]', frame=frame)

    def bake(self, fn, f0, f1):
        """fn(frame) -> pose dict. Keys every frame (linear) so motion blur samples are exact."""
        for f in range(f0, f1 + 1):
            self.apply(fn(f))
            self.key(f)
