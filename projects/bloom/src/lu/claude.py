"""Claude, the block mascot of refs/claude-mascot.png, built as a painterly 3D toy for BLOOM: a crisp terracotta
block (#DA7758) with two flat matte-black square eyes, straight rectangular side arms and four rectangular legs, exactly
the pixel mascot from the front. Acting comes from the SHAPE of the black squares (blink bar, '^' happy arcs, sad /
angry slants, '> <' squeeze), squash/stretch, a bending spine and block arms that bend at an elbow; a tiny flat black
mouth appears only when a mouth channel is used. Keyable material states (ash, wet, damage, gold kintsugi) and tears.

Units: metres. Faces -Y; its LEFT is +X. Root (x, y, z) = the ground point under it. Proportions measured from the
reference (body width W = 147 px = 0.70 m): body 0.70 w x 0.51 h x 0.44 d on 0.186 m legs (top at 0.696); eyes 0.081 m
squares, centres x = +-0.214, z = 0.577 (top edge 0.117 below the body top); arms 0.172 tall, sticking out 0.175 from
each side, centre z = 0.443; legs 0.085 wide at x = +-0.129 / +-0.306 (outer legs flush with the sides). Bevel 0.025.

RIG (armature object = root; one action holds everything):
  base (crouch) -> hips -> belly -> chest -> head (deform spine; B-bones). head carries the face, the arms and the
  cradle (where the sprout is held). head -> armL1 (pivot 0.15 m inside the body, so more arm emerges when it swings)
  -> armL2 (elbow just outside the side) -> handL (a rounded block end) -> fingL/thumbL (point helpers; and R).
  ikHandL/R (root level; IK targets, optionally following the upper body), poleArmL/R. base -> legN1 -> legN2 ->
  footN (N = 0..3 from -X to +X; outer legs 0/3 stand forward, inner legs 1/2 back), ikFootN (planted), poleLegN.
  Each arm is one clean rounded block skinned to upper / fore / hand (soft clay bends); IK may stretch it ~30 %.

POSE CHANNELS (pose dict; missing keys = DEFAULT). Degrees for angles, metres for positions.
  root      x, y, z, heading (0 = faces -Y, + turns toward +X), hop (lifts the whole character, feet too),
            tilt_x (+ pitches forward, e.g. face-down in the ash), tilt_y (+ rolls toward its left)
  body      crouch (0..1: the body sinks 0.15 m on folding legs; 1 = kneel/squat), lean (+ forward, from the hips),
            roll (+ toward its left), twist (+ upper body turns to its left), bend (spine curl: + hunch/curl
            forward, - arch back), side_bend (+ toward its left), squash (-0.5..0.6 volume-preserving: + stretch,
            - squash), head_nod (+ face down), head_tilt (+ toward its left), head_turn (+ toward its left)
  arms      armL_up (+ raise from horizontal, - lower; 0 = straight out like the mascot), armL_fwd (+ swing forward),
            armL_twist (+ front face turns up), armL_bend (elbow; + forearm folds forward/in), handL_bend (+ the
            hand block bends down), handL_curl (0..1 extra hand bend, to hold), handL_thumb (kept for compatibility,
            no effect)                                                                     [same channels for R]
            armL_ik (0..1 IK blend), handL_x/y/z (IK wrist target, character space at rest), armL_follow (1 = the
            target rides with the upper body (lean/bend/squash/crouch), 0 = fixed in root space: a hand planted on a
            ledge), armL_pole (deg: rotates the elbow about the arm axis; + = elbow lifts/out)
  legs      legs_ik (0..1), footN_x/y/z (planted sole positions, character space; defaults = the rest stance),
            legN_swing / legN_knee (FK when legs_ik < 1: + swing forward / + knee bends back), legs_splay
  eyes      eye_open (0 = closed: a thin bar .. 1 = square .. 1.35 = wide), eyeL_open / eyeR_open (offsets: winks),
            lower_lid (0..1 the bottom edge rises: squint), eye_tilt (+ sad/worried: the top edge droops toward the
            outside; - angry/determined: it slants down toward the centre), eye_happy (0..1 upturned '^' arcs),
            lid_sag (0..1 closed eyes curve down: sleep), eye_squeeze (0..1 '> <' chevrons), look_x (+ toward its
            left = screen-right when it faces the camera), look_y (+ up): the squares shift across the face,
            pupil (0.5..1.6: the square scales slightly, < 1 tense, > 1 wonder), glint (0..1 one tiny soft
            highlight), tears (0..1 water wells under the squares, a bead hangs), iris_glow (no effect; compat)
  mouth     invisible at 0 (the mascot has no mouth). mouth_open (0..1 a small 'D' laugh), smile (-1 frown line ..
            +1 smile line), mouth_wide, mouth_o (0..1 round gasp), teeth (0..1 gritted bar), wobble (0..1 wavy
            despair line), mouth_skew (-1..1), mouth_press (0..1 short tight line)
  cradle    cradle_x/y/z (offset of the held-prop point in front of the chest; follows the upper body)
  material  ash, wet, damage, gold (0..1 each, progressive), brand (0..1: how much the light's hue is neutralised
            on Claude; 0.5 default; lower it to let a practical (the seed's green) tint the face), vivid (0..1:
            exposure lift in dark sets so Claude stays the brightest warm note; 0.65 default; 0 = purely physical)

API
  c = Claude(name, collection=None, detail=1)        detail = body subdivision at render
  c.apply(pose) / c.key(frame) / c.bake(fn(frame) -> pose, f0, f1)     bake is fast (direct F-curve write)
  c.point(where, frame=None) -> world Vector         where: cradle, head, face, mouth, eyeL/R, handL/R, palmL/R,
                                                     thumbL/R (inner front edge of the hand block), fingL/R (tip)
  c.attach(obj, where='cradle'|'handL'|'palmR'|..., at=None, pose=None)   parent a prop (stage.attach)
  c.tear(side, f0, dur=1.4)                           a tear wells under the eye, rolls down the face, drops
  c.face_light(cam_loc, ...), c.rim_light(cam_loc, sun_dir, ...)     light-linked to Claude only
Pose presets and procedural layers (walk, run, crawl, breathing, blinks, shiver): src/lu/acting.py.

IMPLEMENTATION NOTES
  * Everything keyable lives on the rig object (pose bones + custom props); parts copy shading channels through
    simple-expression drivers. EEVEE allows only a few object attributes per material, so channels are packed three
    to a vector property (charmat.PACKS).
  * Body: crisp rounded box, Armature -> Subsurf (render 1) -> GN damage relief; the shader draws chips / cracks /
    gold veins per pixel from the same layout (charmat.damage_fields). The lower 30 % bends; the face block is rigid.
  * Eyes: a plane per eye 0.8 mm in front of the face; the square is an SDF in charmat.eye_flat_mat.
  * IK targets with armX_follow are computed analytically from the spine pose (_chain_matrix); point()/attach()
    evaluate the rig with a full frame_set so driver-switched IK is current.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

from . import geo, charmat

# ---------------------------------------------------------------- dimensions (metres; W = 0.70 = 147 ref px)
PX = 0.70 / 147.0
BODY_W, BODY_H, BODY_D = 0.70, 107 * PX, 0.44
HX, HY, HZ = BODY_W / 2, BODY_D / 2, BODY_H / 2
LEG_H = 39 * PX                      # 0.186
Z0 = LEG_H                           # body bottom
ZC = Z0 + HZ                         # body centre height
ZTOP = Z0 + BODY_H
BEVEL = 0.025
ORANGE = (0.701, 0.184, 0.0976)      # #DA7758 linear
FRONT_Y = -HY

# face
EYE_X = 45 * PX                      # 0.214
EYE_HALF = 8.5 * PX                  # 0.0405 (17 px squares)
EYE_Z = ZTOP - 25 * PX               # centre 25 px below the top
MOUTH_Z = EYE_Z - 0.088
MOUTH_S = 0.030

# limbs
ARM_T = 36 * PX                      # 0.171 tall
ARM_D = 0.19                         # deep
ARM_OUT = 37 * PX                    # 0.176 out from each side
ARM_Z = ZTOP - 35 * PX - ARM_T / 2   # 0.443
ARM_Y = FRONT_Y + 0.012 + ARM_D / 2  # front faces nearly flush with the body front
SH = (HX - 0.17, ARM_Y, ARM_Z)       # left shoulder pivot (rest), 0.17 m inside the body side: hidden arm length
ELB_X = HX + 0.012                   # elbow right at the body side: at rest the visible block is forearm + hand
ARM_SLIDE = 0.15                     # how far the arm telescopes out of the body (IK holds, raised arms)
WR_X = HX + ARM_OUT - 0.045
HAND_L = 0.045
LEG_X = (-0.306, -0.129, 0.129, 0.306)
LEG_Y = (-0.07, 0.07, 0.07, -0.07)
LEG_W, LEG_D = 18 * PX, 0.10
KNEE_Z, ANKLE_Z = 0.10, 0.03
CROUCH_D = 0.15
CRADLE = (0.0, -0.31, 0.36)

DEFAULT = dict(
    x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0, tilt_x=0.0, tilt_y=0.0,
    crouch=0.0, lean=0.0, roll=0.0, twist=0.0, bend=0.0, side_bend=0.0, squash=0.0,
    head_nod=0.0, head_tilt=0.0, head_turn=0.0,
    armL_up=0.0, armL_fwd=0.0, armL_twist=0.0, armL_bend=0.0, handL_bend=0.0, handL_curl=0.0, handL_thumb=0.0,
    armR_up=0.0, armR_fwd=0.0, armR_twist=0.0, armR_bend=0.0, handR_bend=0.0, handR_curl=0.0, handR_thumb=0.0,
    armL_ik=0.0, armL_follow=1.0, armL_pole=0.0, handL_x=0.10, handL_y=-0.33, handL_z=0.36,
    armR_ik=0.0, armR_follow=1.0, armR_pole=0.0, handR_x=-0.10, handR_y=-0.33, handR_z=0.36,
    legs_ik=1.0, legs_splay=0.0,
    eye_open=1.0, eyeL_open=0.0, eyeR_open=0.0, lower_lid=0.0, eye_tilt=0.0, eye_happy=0.0, lid_sag=0.0,
    eye_squeeze=0.0, look_x=0.0, look_y=0.0, pupil=1.0, glint=1.0, tears=0.0, iris_glow=0.42,
    mouth_open=0.0, smile=0.0, mouth_wide=0.0, mouth_o=0.0, teeth=0.0, wobble=0.0, mouth_skew=0.0,
    mouth_press=0.0,
    cradle_x=0.0, cradle_y=0.0, cradle_z=0.0,
    ash=0.0, wet=0.0, damage=0.0, gold=0.0, brand=0.5, vivid=0.65,
)
for _i in range(4):
    DEFAULT.update({f"foot{_i}_x": LEG_X[_i], f"foot{_i}_y": LEG_Y[_i], f"foot{_i}_z": 0.0,
                    f"leg{_i}_swing": 0.0, f"leg{_i}_knee": 0.0})

MAT_PROPS = ("ash", "wet", "damage", "gold", "brand", "vivid")
MOUTH_PROPS = ("mouth_open", "smile", "mouth_wide", "mouth_o", "teeth", "wobble", "mouth_skew", "mouth_press")
EYE_RIG = ("eye_tilt", "eye_happy", "lid_sag", "eye_squeeze", "lower_lid", "look_x", "look_y", "pupil", "glint",
           "tears", "_eyeL_open", "_eyeR_open")
RIG_PROPS = MAT_PROPS + MOUTH_PROPS + EYE_RIG + ("armL_ik", "armR_ik", "legs_ik")
LOC_BONES = ("base", "cradle", "ikHandL", "ikHandR", "poleArmL", "poleArmR") + tuple(f"ikFoot{i}" for i in range(4))


# ---------------------------------------------------------------- small helpers
def _ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def _rest_attr(ob):
    me = ob.data
    att = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    att.data.foreach_set("vector", co)


def _weights(ob, fn):
    """fn(co Vector) -> {group: weight}; normalised, creates vertex groups."""
    groups = {}
    for v in ob.data.vertices:
        w = fn(v.co)
        tot = sum(w.values()) or 1.0
        for b, val in w.items():
            if val <= 1e-4:
                continue
            g = groups.get(b) or ob.vertex_groups.new(name=b)
            groups[b] = g
            g.add([v.index], val / tot, "REPLACE")


def spine_weights(z):
    """Body weights by rest height: the lower 30 % bends (hips/belly/chest); the face block above is rigid."""
    zr = z - Z0
    tri = lambda c, w: max(0.0, 1 - abs(zr - c) / w)
    w = {"hips": tri(0.0, 0.06) if zr > 0 else 1.0, "belly": tri(0.06, 0.055), "chest": tri(0.115, 0.06),
         "head": _ss(0.105, 0.19, zr)}
    w["chest"] *= 1 - _ss(0.13, 0.19, zr)
    return w


def _wrist(sx):
    return Vector((WR_X * sx, ARM_Y, ARM_Z))


def _block(name, x0, x1, sx, col, m, shrink=1.0, r=0.028, seg=4):
    """A rounded arm block from x0 to x1 (positive distances from the centre line, mirrored by sx)."""
    L = x1 - x0
    ob = geo.rounded_box(name, (L, ARM_D * shrink, ARM_T * shrink), r, seg=(seg, 3, 3), n_r=3, collection=col,
                         mat=m, center=(sx * (x0 + x1) / 2, ARM_Y, ARM_Z))
    _rest_attr(ob)
    return ob


def _leg_mesh(name, i, col, m):
    lx, ly = LEG_X[i], LEG_Y[i]
    h = Z0 + 0.03
    ob = geo.rounded_box(name, (LEG_W, LEG_D, h), 0.012, seg=(2, 2, 12), n_r=3, collection=col, mat=m,
                         center=(lx, ly, h / 2))
    _rest_attr(ob)

    def wfn(co):
        z = co.z
        hp = _ss(Z0 - 0.012, Z0 + 0.008, z)
        sh = _ss(KNEE_Z + 0.02, KNEE_Z - 0.02, z)
        ft = _ss(ANKLE_Z + 0.008, ANKLE_Z - 0.008, z)
        return {"hips": hp, f"leg{i}1": (1 - hp) * (1 - sh), f"leg{i}2": sh * (1 - ft), f"foot{i}": ft}
    _weights(ob, wfn)
    return ob


def _eye_plane(name, col, m, size=0.085):
    """A flat plane in XZ (local origin = the eye centre) that carries the SDF eye."""
    verts = [(-size, 0.0, -size), (size, 0.0, -size), (size, 0.0, size), (-size, 0.0, size)]
    ob = geo.obj_from(name, verts, [(0, 1, 2, 3)], col, m, smooth=False)
    me = ob.data
    me.update()
    if me.polygons[0].normal.y > 0:
        me.polygons[0].flip()
        me.update()
    return ob


# ---------------------------------------------------------------- the character
class Claude:
    BODY_H = BODY_H

    def __init__(self, name="Claude", collection=None, color=ORANGE, detail=1):
        self.name = name
        col = collection or geo.coll(name)
        self.col = col
        self.tears_made = []
        face = dict(front_y=FRONT_Y, z=MOUTH_Z, s=MOUTH_S, box=((HX, HY, HZ), (0.0, 0.0, ZC)))
        self.m_body = charmat.clay(f"{name}_clay", color, "body", face=face, z_feet=Z0)
        self.m_limb = charmat.clay(f"{name}_clayLimb", color, "limb", z_feet=Z0)
        self.m_water = charmat.water_mat(f"{name}_tearwater")
        self.m_eyes = {s: charmat.eye_flat_mat(f"{name}_eye{s}", side=sx, half=EYE_HALF)
                       for s, sx in (("L", 1.0), ("R", -1.0))}
        self.body_mat = self.m_body
        # ---------------- armature
        ad = bpy.data.armatures.new(name + "_rig")
        rig = bpy.data.objects.new(name, ad)
        col.objects.link(rig)
        self.rig = rig
        for k in RIG_PROPS:
            rig[k] = float(DEFAULT.get(k, 1.0 if k.startswith("_eye") else 0.0))
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        eb = ad.edit_bones

        def bone(n, h, t, parent=None, deform=True, connect=False, seg=1, inherit="FULL"):
            b = eb.new(n)
            b.head = Vector(h)
            b.tail = Vector(t)
            b.roll = 0.0
            b.use_deform = deform
            if parent:
                b.parent = eb[parent]
                b.use_connect = connect
            b.bbone_segments = seg
            b.inherit_scale = inherit
            return b

        V = Vector
        bone("base", (0, 0, Z0), (0, 0, Z0 + 0.05), deform=False)
        bone("hips", (0, 0, Z0), (0, 0, Z0 + 0.05), "base", seg=3)
        bone("belly", (0, 0, Z0 + 0.05), (0, 0, Z0 + 0.10), "hips", connect=True, seg=3)
        bone("chest", (0, 0, Z0 + 0.10), (0, 0, Z0 + 0.15), "belly", connect=True, seg=3)
        bone("head", (0, 0, Z0 + 0.15), (0, 0, ZTOP), "chest", connect=True)
        bone("cradle", CRADLE, V(CRADLE) + V((0, 0, 0.03)), "head", deform=False)
        for side, sx in (("L", 1), ("R", -1)):
            S = V((SH[0] * sx, SH[1], SH[2]))
            E = V((ELB_X * sx, ARM_Y, ARM_Z))
            Wr = _wrist(sx)
            K = Wr + V((sx * HAND_L, 0, 0))
            bone(f"arm{side}1", S, E, "head")
            bone(f"arm{side}2", E, Wr, f"arm{side}1", connect=True)
            bone(f"hand{side}", Wr, K, f"arm{side}2", connect=True, inherit="NONE")
            bone(f"fing{side}", K, K + V((sx * 0.02, 0, 0)), f"hand{side}", connect=True, deform=False)
            T0 = Wr + V((sx * HAND_L * 0.6, -ARM_D * 0.5, 0))
            bone(f"thumb{side}", T0, T0 + V((0, -0.02, 0)), f"hand{side}", deform=False)
            bone(f"ikHand{side}", Wr, Wr + V((0, 0.04, 0)), deform=False)
            P = E + V((sx * 0.25, 0.20, -0.12))
            bone(f"poleArm{side}", P, P + V((0, 0.04, 0)), "head", deform=False)
        for i in range(4):
            lx, ly = LEG_X[i], LEG_Y[i]
            bone(f"leg{i}1", (lx, ly, Z0 + 0.015), (lx, ly - 0.014, KNEE_Z), "base")
            bone(f"leg{i}2", (lx, ly - 0.014, KNEE_Z), (lx, ly, ANKLE_Z), f"leg{i}1", connect=True)
            bone(f"foot{i}", (lx, ly, ANKLE_Z), (lx, ly + 0.04, ANKLE_Z), f"leg{i}2")
            bone(f"ikFoot{i}", (lx, ly, ANKLE_Z), (lx, ly + 0.04, ANKLE_Z), deform=False)
            bone(f"poleLeg{i}", (lx, ly - 0.35, KNEE_Z), (lx, ly - 0.31, KNEE_Z), "base", deform=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        self.rest = {b.name: b.matrix_local.copy() for b in ad.bones}
        self.rest3 = {k: v.to_3x3() for k, v in self.rest.items()}
        self.rest3i = {k: v.inverted() for k, v in self.rest3.items()}
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
        # ---------------- constraints (IK arms with a little stretch / legs, flat feet)
        for side in "LR":
            c = rig.pose.bones[f"arm{side}2"].constraints.new("IK")
            c.target, c.subtarget = rig, f"ikHand{side}"
            c.pole_target, c.pole_subtarget = rig, f"poleArm{side}"
            c.chain_count = 2
            c.use_stretch = True
            for bn in (f"arm{side}1", f"arm{side}2"):
                rig.pose.bones[bn].ik_stretch = 0.25
            charmat.drive(c, "influence", rig, f"arm{side}_ik")
        for i in range(4):
            c = rig.pose.bones[f"leg{i}2"].constraints.new("IK")
            c.target, c.subtarget = rig, f"ikFoot{i}"
            c.pole_target, c.pole_subtarget = rig, f"poleLeg{i}"
            c.chain_count = 2
            charmat.drive(c, "influence", rig, "legs_ik")
            cr = rig.pose.bones[f"foot{i}"].constraints.new("COPY_ROTATION")
            cr.target, cr.subtarget = rig, f"ikFoot{i}"
            charmat.drive(cr, "influence", rig, "legs_ik")
        # ---------------- meshes
        nx, ny, nz = 44, 28, 32
        body = geo.rounded_box(name + "_body", (BODY_W, BODY_D, BODY_H), BEVEL, seg=(nx, ny, nz), n_r=3,
                               collection=col, mat=self.m_body, center=(0, 0, ZC))
        _rest_attr(body)
        _weights(body, lambda co: spine_weights(co.z))
        self.body_mesh = body
        parts = [body]
        self.limbs = []
        for i in range(4):
            self.limbs.append(_leg_mesh(f"{name}_leg{i}", i, col, self.m_limb))
        for p in parts + self.limbs:
            p.parent = rig
            md = p.modifiers.new("rig", "ARMATURE")
            md.object = rig
            md.use_deform_preserve_volume = p is not body
        if detail > 0:
            ss = body.modifiers.new("smooth", "SUBSURF")
            ss.levels = 0
            ss.render_levels = detail
        g, s_d, s_g = charmat.damage_group(f"{name}_damageGN", (HX, HY, HZ), (0.0, 0.0, ZC))
        gm = body.modifiers.new("damage", "NODES")
        gm.node_group = g
        charmat.drive(body, f'modifiers["damage"]["{s_d}"]', rig, "damage")
        charmat.drive(body, f'modifiers["damage"]["{s_g}"]', rig, "gold")
        # arms: one clean rounded block each (exactly the mascot's side block at rest), skinned to upper / fore / hand
        # bones; it bends like soft clay at the elbow and wrist, and IK may stretch it a little
        self.arm_parts = []
        for side, sx in (("L", 1), ("R", -1)):
            x0, x1 = SH[0] - 0.03, HX + ARM_OUT
            arm = geo.rounded_box(f"{name}_arm{side}", (x1 - x0, ARM_D, ARM_T), BEVEL, seg=(26, 4, 4), n_r=3,
                                  collection=col, mat=self.m_limb, center=(sx * (x0 + x1) / 2, ARM_Y, ARM_Z))
            _rest_attr(arm)

            def warm(co, side=side, sx=sx):
                x = co.x * sx
                f = _ss(ELB_X - 0.03, ELB_X + 0.03, x)
                hnd = _ss(WR_X - 0.012, WR_X + 0.012, x)
                return {f"arm{side}1": 1 - f, f"arm{side}2": f * (1 - hnd), f"hand{side}": hnd}
            _weights(arm, warm)
            arm.parent = rig
            md = arm.modifiers.new("rig", "ARMATURE")
            md.object = rig
            md.use_deform_preserve_volume = True
            self.arm_parts.append(arm)
        self.limbs += self.arm_parts
        parts += self.limbs[:4] + self.arm_parts
        # ---------------- eyes: flat SDF squares flush on the face
        self.eyes = []
        for side, sx in (("L", 1), ("R", -1)):
            e = _eye_plane(f"{name}_eye{side}", col, self.m_eyes[side])
            self._bone_parent(e, "head", Matrix.Translation((sx * EYE_X, FRONT_Y - 0.0008, EYE_Z)))
            e.visible_shadow = False
            self.eyes.append(e)
            eo = f"_eye{side}_open"
            charmat.drive_pack(e, "eyeA", rig, {"e_open": eo, "e_tilt": "eye_tilt", "e_happy": "eye_happy"})
            charmat.drive_pack(e, "eyeB", rig, {"e_sag": "lid_sag", "e_squeeze": "eye_squeeze",
                                                "e_lower": "lower_lid"})
            charmat.drive_pack(e, "eyeC", rig, {"e_lookx": "look_x", "e_looky": "look_y", "e_pupil": "pupil"})
            charmat.drive_pack(e, "eyeD", rig, {"e_glint": "glint", "e_tears": "tears", "e_wet": "wet"})
        self.parts = parts + self.eyes
        # ---------------- drivers: shading channels from the rig to every part
        for p in parts:
            for pk in ("matA", "matB", "mouthC"):
                charmat.drive_pack(p, pk, rig)
        for pk in ("mouthA", "mouthB"):
            charmat.drive_pack(body, pk, rig)
        self._calibrate_poles()
        self.apply({})

    # ------------------------------------------------------------------ rig utilities
    def _bone_parent(self, ob, bname, M_arm):
        """Parent ob to bone bname so that at rest its local frame sits at armature-space matrix M_arm."""
        b = self.rig.data.bones[bname]
        tail = self.rest[bname] @ Matrix.Translation((0, b.length, 0))
        ob.parent = self.rig
        ob.parent_type = "BONE"
        ob.parent_bone = bname
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.matrix_basis = tail.inverted() @ M_arm

    def _set(self, bname, R=None, loc=None, scale=None):
        pb = self.rig.pose.bones[bname]
        if R is not None:
            pb.rotation_quaternion = (self.rest3i[bname] @ R @ self.rest3[bname]).to_quaternion()
        if loc is not None:
            pb.location = self.rest3i[bname] @ Vector(loc)
        if scale is not None:
            pb.scale = scale

    def _calibrate_poles(self):
        """Pick the IK pole angles so knees bend forward (-Y) and elbows point back/down toward their pole bones."""
        rig = self.rig
        drivers = rig.animation_data.drivers if rig.animation_data else []
        for d in drivers:
            d.mute = True
        tests = [(f"leg{i}2", f"leg{i}1", f"ikFoot{i}", (0, 0, 0.07), f"poleLeg{i}") for i in range(4)]
        tests += [(f"arm{s}2", f"arm{s}1", f"ikHand{s}", ((-0.10 if s == "L" else 0.10), -0.10, 0.0), f"poleArm{s}")
                  for s in "LR"]
        for (chain, upper, tgt, off, pole) in tests:
            c = rig.pose.bones[chain].constraints["IK"]
            rig.pose.bones[tgt].location = self.rest3i[tgt] @ Vector(off)
            c.influence = 1.0
            best, bang = -1e9, 0.0
            for ang in (0, 90, -90, 180):
                c.pole_angle = math.radians(ang)
                bpy.context.view_layer.update()
                joint = rig.pose.bones[upper].tail.copy()
                score = -(rig.pose.bones[pole].head - joint).length
                if score > best:
                    best, bang = score, ang
            c.pole_angle = math.radians(bang)
            c.influence = 0.0
            rig.pose.bones[tgt].location = (0, 0, 0)
        for d in drivers:
            d.mute = False
        bpy.context.view_layer.update()

    def _spine_rots(self, P):
        r = math.radians
        Rx = lambda a: Matrix.Rotation(r(a), 3, "X")
        Ry = lambda a: Matrix.Rotation(r(a), 3, "Y")
        Rz = lambda a: Matrix.Rotation(r(a), 3, "Z")
        tw, bd, sb = P["twist"], P["bend"], P["side_bend"]
        nod = P["head_nod"]
        return {
            "hips": Rz(tw * 0.2) @ Ry(P["roll"] + sb * 0.3) @ Rx(P["lean"] + bd * 0.3),
            "belly": Rz(tw * 0.35) @ Ry(sb * 0.35) @ Rx(bd * 0.36 + nod * 0.15),
            "chest": Rz(tw * 0.45) @ Ry(sb * 0.35) @ Rx(bd * 0.34 + nod * 0.25),
            "head": Rz(P["head_turn"]) @ Ry(P["head_tilt"]) @ Rx(nod * 0.6),
        }

    def _chain_matrix(self, P):
        """Armature-space transform of the face block (head bone) for pose P: IK targets that follow the body."""
        T = Matrix.Translation
        R = self._spine_rots(P)
        s = P["squash"]
        sxy = 1 / math.sqrt(max(1 + s, 0.2))
        Sm = Matrix.Diagonal((sxy, sxy, 1 + s, 1.0))
        M = T((0, 0, -P["crouch"] * CROUCH_D))
        for bn in ("hips", "belly", "chest", "head"):
            h = self.rest[bn].translation
            Rb = R[bn].to_4x4()
            if bn == "hips":
                Rb = Rb @ Sm
            M = M @ T(h) @ Rb @ T(-h)
        return M

    # ------------------------------------------------------------------ posing
    def apply(self, p):
        """Apply a pose dict (missing keys = DEFAULT) to the rig at the current frame."""
        P = dict(DEFAULT)
        P.update(p)
        if "slump" in p:                       # legacy (looking-up) channel
            P["bend"] += p["slump"] * 0.6
            P["head_nod"] += p["slump"] * 0.4
        r = math.radians
        rig = self.rig
        Rx = lambda a: Matrix.Rotation(r(a), 3, "X")
        Ry = lambda a: Matrix.Rotation(r(a), 3, "Y")
        Rz = lambda a: Matrix.Rotation(r(a), 3, "Z")
        rig.location = (P["x"], P["y"], P["z"] + P["hop"])
        rig.rotation_mode = "YXZ"           # heading outermost: tilts act in the character frame
        rig.rotation_euler = (r(P["tilt_x"]), r(P["tilt_y"]), r(P["heading"]))
        # ---- spine
        self._set("base", loc=(0, 0, -P["crouch"] * CROUCH_D))
        s = P["squash"]
        sxy = 1 / math.sqrt(max(1 + s, 0.2))
        R = self._spine_rots(P)
        self._set("hips", R["hips"], scale=(sxy, 1 + s, sxy))
        for bn in ("belly", "chest", "head"):
            self._set(bn, R[bn])
        self._set("cradle", loc=(P["cradle_x"], P["cradle_y"], P["cradle_z"]))
        # ---- arms
        H = None
        for side, sg in (("L", 1), ("R", -1)):
            up, fwd, tw, bend = P[f"arm{side}_up"], P[f"arm{side}_fwd"], P[f"arm{side}_twist"], P[f"arm{side}_bend"]
            # the arm telescopes out of the body (hidden length) so a stubby mascot arm can still cradle, hug and
            # reach: fully when IK holds something, and as an FK arm swings away from straight-out
            ik = P[f"arm{side}_ik"]
            fk_sl = min(1.0, max(abs(up), abs(fwd)) / 55.0)
            slide = ARM_SLIDE * (ik + (1.0 - ik) * fk_sl)
            self._set(f"arm{side}1", Rz(-sg * fwd) @ Ry(-sg * up) @ Rx(-tw), loc=(sg * slide, 0.0, 0.0))
            self._set(f"arm{side}2", Rz(-sg * bend))
            self._set(f"hand{side}", Ry(sg * (P[f"hand{side}_bend"] + 50.0 * P[f"hand{side}_curl"])))
            tgt = Vector((P[f"hand{side}_x"], P[f"hand{side}_y"], P[f"hand{side}_z"]))
            f = P[f"arm{side}_follow"]
            if f > 0 and P[f"arm{side}_ik"] > 0:
                if H is None:
                    H = self._chain_matrix(P)
                tgt = tgt.lerp(H @ tgt, f)
            self._set(f"ikHand{side}", loc=tgt - self.rest[f"ikHand{side}"].translation)
            off0 = Vector((sg * 0.25, 0.20, -0.12))
            self._set(f"poleArm{side}", loc=Rx(sg * P[f"arm{side}_pole"]) @ off0 - off0)
        # ---- legs
        for i in range(4):
            spl = P["legs_splay"] * (1 if LEG_X[i] > 0 else -1) * (1.0 if abs(LEG_X[i]) > 0.2 else 0.4)
            self._set(f"leg{i}1", Ry(spl) @ Rx(-P[f"leg{i}_swing"]))
            self._set(f"leg{i}2", Rx(P[f"leg{i}_knee"]))
            sole = Vector((P[f"foot{i}_x"], P[f"foot{i}_y"], P[f"foot{i}_z"] + ANKLE_Z))
            self._set(f"ikFoot{i}", loc=sole - self.rest[f"ikFoot{i}"].translation)
        # ---- eyes (the SDF squares read these) + material / mouth channels
        for side in "LR":
            rig[f"_eye{side}_open"] = float(min(max(P["eye_open"] + P[f"eye{side}_open"], 0.0), 1.35))
        for k in MAT_PROPS + MOUTH_PROPS + EYE_RIG[:10] + ("armL_ik", "armR_ik", "legs_ik"):
            rig[k] = float(P[k])

    # ------------------------------------------------------------------ keying
    def _keyed(self):
        """(owner, data_path, n) of everything apply() writes."""
        out = [(self.rig, "location", 3), (self.rig, "rotation_euler", 3)]
        for pb in self.rig.pose.bones:
            n = pb.name
            if n in LOC_BONES:
                out.append((self.rig, f'pose.bones["{n}"].location', 3))
                continue
            if n in ("armL1", "armR1"):
                out.append((self.rig, f'pose.bones["{n}"].location', 3))
            if n.startswith("poleLeg"):
                continue
            out.append((self.rig, f'pose.bones["{n}"].rotation_quaternion', 4))
            if n == "hips":
                out.append((self.rig, f'pose.bones["{n}"].scale', 3))
        for k in RIG_PROPS:
            out.append((self.rig, f'["{k}"]', 1))
        return out

    def key(self, frame):
        for (owner, path, n) in self._keyed():
            owner.keyframe_insert(path, frame=frame)

    def bake(self, fn, f0, f1):
        """fn(frame) -> pose dict. Keys every frame (linear) so motion blur samples are exact. Values are written
        straight into the F-curves (fast), merging with any keys outside [f0, f1]."""
        from bpy_extras import anim_utils
        rig = self.rig
        chans = self._keyed()
        frames = list(range(f0, f1 + 1))
        vals = {(path, i): [] for (_, path, n) in chans for i in range(n)}
        for f in frames:
            self.apply(fn(f))
            for (owner, path, n) in chans:
                v = owner.path_resolve(path)
                if n == 1:
                    vals[(path, 0)].append(float(v))
                else:
                    for i in range(n):
                        vals[(path, i)].append(float(v[i]))
        if rig.animation_data is None or rig.animation_data.action is None:
            rig.keyframe_insert("location", frame=f0)
        act = rig.animation_data.action
        cb = anim_utils.action_ensure_channelbag_for_slot(act, rig.animation_data.action_slot)
        for (path, i), vs in vals.items():
            fc = cb.fcurves.find(path, index=i) or cb.fcurves.new(path, index=i)
            old = [(kp.co[0], kp.co[1]) for kp in fc.keyframe_points if not (f0 - 0.5 <= kp.co[0] <= f1 + 0.5)]
            pts = sorted(old + list(zip(frames, vs)))
            fc.keyframe_points.clear()
            fc.keyframe_points.add(len(pts))
            fc.keyframe_points.foreach_set("co", np.array(pts, dtype=np.float32).ravel())
            fc.keyframe_points.foreach_set("interpolation", np.full(len(pts), 1, dtype=np.int32))   # LINEAR
            fc.update()

    # ------------------------------------------------------------------ helpers for shots
    # name -> (bone, rest armature-space point)
    POINTS = {
        "cradle": ("cradle", CRADLE),
        "head": ("head", (0.0, 0.0, EYE_Z)),
        "face": ("head", (0.0, FRONT_Y, EYE_Z - 0.05)),
        "mouth": ("head", (0.0, FRONT_Y, MOUTH_Z)),
        "eyeL": ("head", (EYE_X, FRONT_Y, EYE_Z)),
        "eyeR": ("head", (-EYE_X, FRONT_Y, EYE_Z)),
        "handL": ("handL", tuple(_wrist(1) + Vector((HAND_L * 0.5, 0, 0)))),
        "handR": ("handR", tuple(_wrist(-1) + Vector((-HAND_L * 0.5, 0, 0)))),
        "palmL": ("handL", tuple(_wrist(1) + Vector((HAND_L * 0.5, 0, -ARM_T * 0.5)))),
        "palmR": ("handR", tuple(_wrist(-1) + Vector((-HAND_L * 0.5, 0, -ARM_T * 0.5)))),
        "thumbL": ("handL", tuple(_wrist(1) + Vector((HAND_L * 0.6, -ARM_D * 0.5, 0.0)))),
        "thumbR": ("handR", tuple(_wrist(-1) + Vector((-HAND_L * 0.6, -ARM_D * 0.5, 0.0)))),
        "fingL": ("handL", tuple(_wrist(1) + Vector((HAND_L, 0, 0)))),
        "fingR": ("handR", tuple(_wrist(-1) + Vector((-HAND_L, 0, 0)))),
    }

    def point(self, where, frame=None):
        """World position of a named point (see POINTS) at frame (evaluates the rig)."""
        sc = bpy.context.scene
        sc.frame_set(frame if frame is not None else sc.frame_current)    # full update: drivers (IK switches) too
        bn, p = self.POINTS[where]
        pb = self.rig.pose.bones[bn]
        return self.rig.matrix_world @ pb.matrix @ self.rest[bn].inverted() @ Vector(p)

    def attach(self, obj, where="cradle", at=None, pose=None):
        """Parent obj to the bone behind a named point. at: character-space position (in `pose`) for obj's origin;
        default = the named point."""
        from . import stage
        bn, p = self.POINTS.get(where, (where, None))
        if at is None:
            q = dict(pose or {})
            q.update(x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0, tilt_x=0.0, tilt_y=0.0)
            self.apply(q)
            bpy.context.view_layer.update()
            pb = self.rig.pose.bones[bn]
            at = pb.matrix @ self.rest[bn].inverted() @ Vector(p if p is not None else self.rest[bn].translation)
        return stage.attach(obj, self, bn, Vector(at), pose=pose)

    def face_light(self, cam_loc, energy=30.0, col=(1.0, 0.86, 0.72), dist=1.6, size=0.9, frame=None, lamp_loc=None):
        """Soft key on the face from the camera side (light-linked to Claude only): the catch-lights and the
        expression read. Returns the light object."""
        from . import finish
        return finish.face_light(self, cam_loc, lamp_loc=lamp_loc, energy=energy, col=col, dist=dist, size=size,
                                 frame=frame)

    def rim_light(self, cam_loc, sun_dir, col=(1.0, 0.78, 0.5), energy=220.0, dist=2.2, frame=None):
        """Light-linked rim from behind, biased to the sun side (scene.char_lights, Claude only)."""
        from . import scene
        if frame is not None:
            bpy.context.scene.frame_set(frame)
        t = self.rig.matrix_world.translation + Vector((0, 0, 0.45))
        return scene.char_lights(self.col, t, cam_loc, sun_dir, rim_col=col, rim_w=energy, fill_w=0.0,
                                 rim_dist=dist, name=f"{self.name}_Rim")["rim"]

    # ------------------------------------------------------------------ tears
    def tear(self, side, f0, dur=1.4, x_off=0.022, run=0.13, fall=True):
        """Spawn a tear at frame f0 on eye 'L' or 'R': it swells at the lower lid's outer corner, rolls down the face
        (accelerating, leaving a wet glossy streak) and drops off. Parented to the face (follows head motion)."""
        sx = 1 if side == "L" else -1
        col = self.col
        n = len(self.tears_made)
        drop = geo.lathe(f"{self.name}_tear{side}{n}", [(0.0, -0.007), (0.0045, -0.0045), (0.0055, 0.0),
                                                         (0.0035, 0.005), (0.0, 0.0095)], seg=14, collection=col,
                         mat=self.m_water)
        drop.visible_shadow = False
        x0 = sx * (EYE_X + x_off)
        z0 = EYE_Z - EYE_HALF - 0.006
        y0 = FRONT_Y - 0.0045
        nseg = 16
        sv, sf, su = [], [], []
        for k in range(nseg + 1):
            u = k / nseg
            z = z0 - run * u
            w = 0.0022 * (1 - 0.4 * u)
            sv += [(x0 - w, FRONT_Y - 0.0012, z), (x0 + w, FRONT_Y - 0.0012, z)]
            su += [u, u]
        for k in range(nseg):
            a = 2 * k
            sf.append((a, a + 1, a + 3, a + 2))
        strip = geo.obj_from(f"{self.name}_tearStreak{side}{n}", sv, sf, col, self._streak_mat())
        strip.data.attributes.new("u", "FLOAT", "POINT").data.foreach_set("value", np.array(su, dtype=np.float32))
        strip.visible_shadow = False
        self._bone_parent(strip, "head", Matrix.Identity(4))
        fps = 24
        f_end = f0 + int(dur * fps)
        for f in range(f0 - 1, f_end + 2):
            t = (f - f0) / fps
            u = min(max(t / dur, 0.0), 1.0)
            swell = _ss(0.0, 0.18, u)
            roll = _ss(0.15, 1.0, u) ** 1.6
            z = z0 - run * roll
            y = y0
            sc = 0.35 + 0.65 * swell
            if fall and u > 0.82:
                k = (u - 0.82) / 0.18
                z -= 0.04 * k * k
                y -= 0.03 * k
                sc *= 1 - 0.7 * k
            vis = 1.0 if f0 <= f <= f_end else 0.0
            self._bone_parent(drop, "head", Matrix.Translation((x0, y, z)) @
                              Matrix.Diagonal((sc, sc, sc * (1 + 0.5 * roll), 1)))
            drop.keyframe_insert("location", frame=f)
            drop.keyframe_insert("scale", frame=f)
            drop["tears"] = vis
            drop.keyframe_insert('["tears"]', frame=f)
            strip["reveal"] = roll
            strip.keyframe_insert('["reveal"]', frame=f)
            strip["tears"] = vis * (1 - _ss(0.85, 1.0, u) * 0.5)
            strip.keyframe_insert('["tears"]', frame=f)
        self.tears_made.append((drop, strip))
        return drop, strip

    def _streak_mat(self):
        m = bpy.data.materials.get(f"{self.name}_tearStreak")
        if m:
            return m
        m, nb = charmat._new(f"{self.name}_tearStreak")
        u = nb.gattr("u")
        rv = nb.prop("reveal")
        a = nb.mul(nb.ss(nb.add(rv, 0.02), rv, u), nb.c01(nb.prop("tears")))
        a = nb.c01(nb.mul(a, 0.85))
        nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
        S = charmat._gloss(nb, nrm, 0.05)
        col = nb.cadd(nb.cmul(S, 1.4), nb.rgb((0.06, 0.03, 0.02)))
        em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
        nb.inp(em, "Color", col)
        tr = nb.n("ShaderNodeBsdfTransparent", inputs={"Color": (0.55, 0.45, 0.42)})
        add = nb.n("ShaderNodeAddShader")
        nb.link(tr.outputs[0], add.inputs[0])
        nb.link(em.outputs[0], add.inputs[1])
        full = nb.n("ShaderNodeBsdfTransparent")
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", a)
        nb.link(full.outputs[0], mx.inputs[1])
        nb.link(add.outputs[0], mx.inputs[2])
        out = nb.n("ShaderNodeOutputMaterial")
        nb.link(mx.outputs[0], out.inputs["Surface"])
        m.surface_render_method = "BLENDED"
        return m
