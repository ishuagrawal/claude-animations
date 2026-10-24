"""Interior: the miller's room in the windmill's stone base (octagonal, apothem RI).

Walls are built face by face with real openings (front door at -90°, front window at -45°, side window at
45°) so sun/moon light falls through. Windows have INTERIOR shutters that Claude can close. Layout (mill
local coords, floor at z=0, +X right / -Y front):
  bed nook 180°, stove 135°, flour pile 112°, workbench 90°, ladder 0°, telescope near 45° window,
  table + stool near the -45° window, shelves -135°, rug centre, main shaft at the centre.
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

from . import geo, mat
from .windmill import SIDES, K

RI = 3.05           # interior apothem
H_ROOM = 3.3
FACE_W = 2 * RI * math.tan(K)


def face_frame(a_deg, u=0.0, z=0.0, inset=0.0):
    """Matrix for a point on the interior wall face whose normal is at angle a (inward normal = -dir)."""
    a = math.radians(a_deg)
    n = Vector((math.cos(a), math.sin(a), 0))
    t = Vector((-n.y, n.x, 0))
    p = n * (RI - inset) + t * u + Vector((0, 0, z))
    rot = Matrix.Rotation(a + math.pi / 2, 4, "Z")      # local +Y -> -n (into the room)... see usage
    return Matrix.Translation(p) @ rot


def mats():
    M = {}
    M["plaster"] = mat.painterly("IntPlaster", (0.70, 0.58, 0.44), stroke="strokes_broad", scale=0.7, tex_amt=1.0,
                                 hue_jit=0.04, bump=0.15, breakup=1.3, color2=(0.56, 0.47, 0.38), c2_thresh=(0.68, 0.74),
                                 c2_scale=0.5, vcol="tint", ao=0.6)
    M["floor"] = mat.painterly("IntFloor", (0.40, 0.26, 0.15), stroke="strokes_horiz", scale=1.0, tex_amt=1.2,
                               breakup=1.3, bump=0.2, color2=(0.30, 0.19, 0.11), c2_thresh=(0.58, 0.66), vcol="tint", ao=0.6)
    M["beam"] = mat.painterly("IntBeam", (0.26, 0.16, 0.10), stroke="strokes_horiz", scale=1.5, tex_amt=1.2,
                              breakup=1.3, bump=0.25, ao=0.6)
    M["wood"] = mat.painterly("IntWood", (0.45, 0.29, 0.17), stroke="strokes_horiz", scale=1.8, tex_amt=1.1,
                              breakup=1.2, bump=0.2, color2=(0.52, 0.37, 0.24), ao=0.6)
    M["iron"] = mat.painterly("IntIron", (0.06, 0.055, 0.05), stroke="strokes_fine", scale=3, tex_amt=0.9, spec=0.6,
                              rough=0.3, breakup=0.8, ao=0.5)
    M["brass"] = mat.painterly("Brass", (0.62, 0.42, 0.16), stroke="strokes_soft", scale=4, tex_amt=0.6, spec=1.0,
                               rough=0.22, spec_col=(1.0, 0.85, 0.55), breakup=0.7)
    def patchwork(nb, co):
        # hand-sewn patchwork: a grid of squares in four fabrics, darker seams between them
        g = nb.vmath("MULTIPLY", co, (5.0, 5.0, 0.0))
        wn = nb.n("ShaderNodeTexWhiteNoise", noise_dimensions="3D", inputs={"Vector": nb.vmath("FLOOR", g)})
        rmp = nb.n("ShaderNodeValToRGB")
        cr = rmp.color_ramp
        cr.interpolation = "CONSTANT"
        cr.elements[0].color = (0.16, 0.32, 0.44, 1)
        cr.elements[1].position = 0.80
        cr.elements[1].color = (0.74, 0.54, 0.18, 1)
        for pos, c in ((0.36, (0.60, 0.22, 0.12)), (0.62, (0.80, 0.72, 0.56))):
            el = cr.elements.new(pos)
            el.color = (*c, 1)
        nb.link(wn.outputs["Value"], rmp.inputs[0])
        fr = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": nb.vmath("FRACTION", g)})
        e = nb.math("MINIMUM", nb.math("MINIMUM", fr.outputs[0], nb.sub(1.0, fr.outputs[0])),
                    nb.math("MINIMUM", fr.outputs[1], nb.sub(1.0, fr.outputs[1])))
        return nb.mix(nb.mapr(e, 0.015, 0.05), (0.10, 0.07, 0.06), rmp.outputs[0])
    M["quilt"] = mat.painterly("Quilt", (0.18, 0.34, 0.44), stroke="strokes_soft", scale=3.0, tex_amt=0.7, breakup=1.2,
                               albedo_fn=patchwork, bump=0.15, ao=0.6)
    M["linen"] = mat.painterly("Linen", (0.80, 0.74, 0.64), stroke="strokes_fine", scale=2.2, tex_amt=0.9, breakup=1.1,
                               bump=0.15, ao=0.5, translucent=0.15)
    M["sheet"] = mat.painterly("DustSheet", (0.66, 0.62, 0.55), stroke="strokes_fine", scale=1.6, tex_amt=1.0, breakup=1.2,
                               bump=0.15, ao=0.5)
    M["sack"] = mat.painterly("IntSack", (0.46, 0.36, 0.22), stroke="strokes_fine", scale=2.5, tex_amt=1.0, breakup=1.2,
                              bump=0.25, ao=0.6, color2=(0.62, 0.55, 0.42), c2_thresh=(0.58, 0.66))
    M["flour"] = mat.painterly("Flour", (0.86, 0.83, 0.78), stroke="strokes_soft", scale=3, tex_amt=0.6, breakup=0.9, ao=0.4)
    M["glass"] = mat.painterly("IntGlass", (0.35, 0.42, 0.40), stroke="strokes_soft", scale=2, tex_amt=0.2, spec=0.25,
                               rough=0.2, alpha_tex=lambda nb: 0.05)
    M["ceramic"] = mat.painterly("Ceramic", (0.75, 0.70, 0.62), stroke="strokes_soft", scale=5, tex_amt=0.5, spec=0.6,
                                 rough=0.25, breakup=0.7)
    M["teal"] = mat.painterly("PaintTeal", (0.14, 0.32, 0.34), stroke="strokes_fine", scale=3, tex_amt=0.8, breakup=1.0, ao=0.5)
    M["red"] = mat.painterly("PaintRed", (0.50, 0.12, 0.08), stroke="strokes_fine", scale=3, tex_amt=0.8, breakup=1.0, ao=0.5)
    M["book_blue"] = mat.painterly("BookBlue", (0.08, 0.13, 0.30), stroke="strokes_soft", scale=6, tex_amt=0.5, breakup=0.8, ao=0.4)
    M["gold"] = mat.painterly("Gold", (0.85, 0.62, 0.20), stroke="strokes_soft", scale=6, tex_amt=0.4, spec=0.8, rough=0.3)
    M["fire"] = mat.emissive("Fire", (1.0, 0.45, 0.10), 6.0)
    M["flame"] = mat.emissive("Flame", (1.0, 0.70, 0.30), 9.0)
    return M


def _tint(ob, fn):
    me = ob.data
    co = np.array([v.co for v in me.vertices])
    cc = fn(co)
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.concatenate([cc, np.ones((len(cc), 1))], 1).ravel())


def _quad(verts, faces, a, b, c, d):
    i = len(verts)
    verts += [a, b, c, d]
    faces.append((i, i + 1, i + 2, i + 3))


OPENINGS = {   # face angle -> (u_center, width, z0, z1)
    -90: (0.0, 1.0, 0.0, 2.1),     # door
    -45: (0.0, 0.8, 0.72, 1.6),    # front window (low sill: Claude peeks out from a step crate)
    45: (0.0, 0.8, 0.72, 1.6),     # side window (behind the table)
}


def walls(col, M):
    """Inward-facing octagonal walls with openings, plus reveals (wall thickness) around openings."""
    verts, faces = [], []
    T = 0.45
    for f in range(SIDES):
        a_deg = f * 45 if f * 45 <= 180 else f * 45 - 360
        a = math.radians(a_deg)
        n = Vector((math.cos(a), math.sin(a), 0))
        t = Vector((-n.y, n.x, 0))
        hw = FACE_W / 2

        def P(u, z, depth=0.0):
            return n * (RI + depth) + t * u + Vector((0, 0, z))
        op = OPENINGS.get(a_deg)
        if op is None:
            _quad(verts, faces, P(hw, 0), P(-hw, 0), P(-hw, H_ROOM), P(hw, H_ROOM))
        else:
            uc, w, z0, z1 = op
            u0, u1 = uc - w / 2, uc + w / 2
            # left / right / below / above (winding: inward normal)
            _quad(verts, faces, P(hw, 0), P(u1, 0), P(u1, H_ROOM), P(hw, H_ROOM))
            _quad(verts, faces, P(u0, 0), P(-hw, 0), P(-hw, H_ROOM), P(u0, H_ROOM))
            if z0 > 0:
                _quad(verts, faces, P(u1, 0), P(u0, 0), P(u0, z0), P(u1, z0))
            _quad(verts, faces, P(u1, z1), P(u0, z1), P(u0, H_ROOM), P(u1, H_ROOM))
            # reveals
            _quad(verts, faces, P(u1, z0), P(u1, z0, T), P(u1, z1, T), P(u1, z1))
            _quad(verts, faces, P(u0, z1), P(u0, z1, T), P(u0, z0, T), P(u0, z0))
            _quad(verts, faces, P(u0, z1), P(u1, z1), P(u1, z1, T), P(u0, z1, T))
            if z0 > 0:
                _quad(verts, faces, P(u1, z0), P(u0, z0), P(u0, z0, T), P(u1, z0, T))
        # outer skin so the room is light-tight (back faces of the walls, slightly outside)
        _quad(verts, faces, P(-hw, 0, T + 0.01), P(hw, 0, T + 0.01), P(hw, H_ROOM, T + 0.01), P(-hw, H_ROOM, T + 0.01))
    w = geo.obj_from("IntWalls", verts, faces, col, M["plaster"], smooth=False)
    # cut the outer skin where openings are by simply deleting faces that cover an opening
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(w.data)
    kill = []
    for fc in bm.faces:
        c = fc.calc_center_median()
        r = math.hypot(c.x, c.y)
        if r > RI + T * 0.9:
            ang = math.degrees(math.atan2(c.y, c.x))
            for a_deg, (uc, ww, z0, z1) in OPENINGS.items():
                if abs((ang - a_deg + 180) % 360 - 180) < 23:
                    kill.append(fc)
    # rebuild those skins with holes
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(w.data)
    bm.free()
    verts2, faces2 = [], []
    for a_deg, (uc, ww, z0, z1) in OPENINGS.items():
        a = math.radians(a_deg)
        n = Vector((math.cos(a), math.sin(a), 0))
        t = Vector((-n.y, n.x, 0))
        hw = FACE_W / 2
        d = T + 0.01

        def P(u, z):
            return n * (RI + d) + t * u + Vector((0, 0, z))
        u0, u1 = uc - ww / 2, uc + ww / 2
        _quad(verts2, faces2, P(-hw, 0), P(u0, 0), P(u0, H_ROOM), P(-hw, H_ROOM))
        _quad(verts2, faces2, P(u1, 0), P(hw, 0), P(hw, H_ROOM), P(u1, H_ROOM))
        if z0 > 0:
            _quad(verts2, faces2, P(u0, 0), P(u1, 0), P(u1, z0), P(u0, z0))
        _quad(verts2, faces2, P(u0, z1), P(u1, z1), P(u1, H_ROOM), P(u0, H_ROOM))
    skin = geo.obj_from("IntSkin", verts2, faces2, col, M["plaster"], smooth=False)
    w = geo.join([w, skin], "IntWalls")

    def tint(co):
        z = co[:, 2]
        n = np.sin(co[:, 0] * 2.1 + z * 1.3) * np.cos(co[:, 1] * 1.7)
        soot = np.clip((z - 2.2) / 1.1, 0, 1) * 0.35
        damp = np.clip(1 - z / 0.6, 0, 1) * 0.25
        g = 1 + 0.06 * n - soot - damp
        return np.stack([g, g * 0.97, g * 0.92], 1)
    _tint(w, tint)
    return w


def floor_ceiling(col, M, rng):
    R = RI / math.cos(K) + 0.1
    fl = geo.lathe("IntFloor", [(R, 0.0), (0.0, 0.0)], seg=SIDES, collection=col, mat=M["floor"], cap_top=False,
                   cap_bot=False, smooth=False)
    fl.rotation_euler = (0, 0, K)
    # planks: per-vertex tint stripes along X
    sub = geo.box("FloorPlanks", (2 * R, 2 * R, 0.02), loc=(0, 0, 0.01), collection=col, mat=M["floor"])
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(sub.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=40, use_grid_fill=True)
    bm.to_mesh(sub.data)
    bm.free()

    def ftint(co):
        plank = np.floor((co[:, 1] + 10) / 0.22)
        r = np.sin(plank * 12.9898) * 43758.5453
        r = r - np.floor(r)
        g = 0.82 + 0.3 * r
        seam = np.abs(((co[:, 1] + 10) / 0.22) % 1 - 0.5) > 0.47
        g = g * np.where(seam, 0.55, 1.0)
        return np.stack([g, g * 0.95, g * 0.9], 1)
    _tint(sub, ftint)
    bpy.data.objects.remove(fl)
    ceil = geo.box("IntCeiling", (2 * R, 2 * R, 0.08), loc=(0, 0, H_ROOM + 0.04), collection=col, mat=M["wood"])
    beams = []
    for i in range(-3, 4):
        beams.append(geo.box("Joist", (2 * R, 0.2, 0.26), loc=(0, i * 0.95, H_ROOM - 0.13), collection=col, mat=M["beam"], bevel=0.02))
    beams.append(geo.box("MainBeam", (0.32, 2 * R, 0.34), loc=(0, 0, H_ROOM - 0.43), collection=col, mat=M["beam"], bevel=0.03))
    bj = geo.join(beams, "Joists")
    return sub, ceil, bj


def main_shaft(col, M):
    sh = geo.lathe("MainShaft", [(0.2, 0), (0.2, H_ROOM)], seg=8, collection=col, mat=M["beam"], smooth=False)
    parts = [sh]
    for z in (0.3, 1.6, 2.9):
        parts.append(geo.lathe("Band", [(0.215, z - 0.04), (0.215, z + 0.04)], seg=16, collection=col, mat=M["iron"],
                               cap_top=False, cap_bot=False))
    # spur wheel under the ceiling with wooden cogs
    wheel = geo.lathe("SpurWheel", [(0.25, H_ROOM - 0.75), (1.05, H_ROOM - 0.75), (1.05, H_ROOM - 0.6), (0.25, H_ROOM - 0.6)],
                      seg=40, collection=col, mat=M["wood"])
    parts.append(wheel)
    for i in range(28):
        a = 2 * math.pi * i / 28
        parts.append(geo.box("Cog", (0.12, 0.08, 0.16), loc=(1.1 * math.cos(a), 1.1 * math.sin(a), H_ROOM - 0.62), rot=(0, 0, a),
                             collection=col, mat=M["beam"]))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        parts.append(geo.box("Arm", (0.8, 0.1, 0.12), loc=(0.6 * math.cos(a), 0.6 * math.sin(a), H_ROOM - 0.68), rot=(0, 0, a),
                             collection=col, mat=M["beam"]))
    return geo.join(parts, "MainShaftAssy")


def bed(col, M):
    p = []
    a = math.radians(180)
    # along the -X wall: bed centred at (-RI+0.55, 0)
    cx, cy = -RI + 0.52, 0.0
    p.append(geo.box("BedFrame", (0.95, 1.9, 0.32), loc=(cx, cy, 0.3), collection=col, mat=M["wood"], bevel=0.02))
    for sy in (-0.95, 0.95):
        p.append(geo.box("BedEnd", (1.0, 0.08, 0.75 if sy > 0 else 0.55), loc=(cx, cy + sy, 0.38 if sy > 0 else 0.28),
                         collection=col, mat=M["wood"], bevel=0.02))
    frame = geo.join(p, "Bed")
    mattress = geo.rounded_box("Mattress", (0.88, 1.8, 0.16), 0.06, seg=(3, 5, 1), n_r=3, collection=col, mat=M["linen"],
                               center=(cx, cy, 0.53))
    quilt = geo.rounded_box("Quilt", (0.96, 1.25, 0.08), 0.04, seg=(6, 8, 1), n_r=3, collection=col, mat=M["quilt"],
                            center=(cx + 0.02, cy - 0.28, 0.64))
    geo.displace_noise(quilt, 0.02, 0.15, seed=3)
    pillow = geo.rounded_box("Pillow", (0.6, 0.36, 0.14), 0.07, seg=(3, 2, 1), n_r=3, collection=col, mat=M["linen"],
                             center=(cx, cy + 0.66, 0.68))
    geo.displace_noise(pillow, 0.015, 0.1, seed=4)
    return dict(frame=frame, mattress=mattress, quilt=quilt, pillow=pillow, pos=(cx, cy, 0.62))


def stove(col, M):
    a = math.radians(135)
    n = Vector((math.cos(a), math.sin(a), 0))
    c = n * (RI - 0.75)
    parts = []
    body = geo.lathe("StoveBody", [(0.0, 0.18), (0.26, 0.2), (0.33, 0.45), (0.34, 0.7), (0.3, 0.92), (0.22, 1.0), (0.0, 1.02)],
                     seg=24, collection=col, mat=M["iron"])
    parts.append(body)
    for i in range(3):
        aa = 2 * math.pi * i / 3
        parts.append(geo.box("StoveLeg", (0.05, 0.05, 0.2), loc=(0.22 * math.cos(aa), 0.22 * math.sin(aa), 0.1), collection=col, mat=M["iron"]))
    pipe = geo.lathe("StovePipe", [(0.08, 1.0), (0.08, H_ROOM + 0.2)], seg=12, collection=col, mat=M["iron"], cap_top=False, cap_bot=False)
    parts.append(pipe)
    st = geo.join(parts, "Stove")
    st.location = c
    st.rotation_euler = (0, 0, a + math.pi / 2)
    # fire window (front, facing room centre) - emissive, flickered per shot
    fw = geo.box("StoveFire", (0.2, 0.02, 0.14), collection=col, mat=M["fire"])
    fw.parent = st
    fw.location = (0, -0.335, 0.55)
    kettle = geo.lathe("Kettle", [(0.0, 0.0), (0.12, 0.0), (0.14, 0.06), (0.12, 0.14), (0.04, 0.17), (0.0, 0.17)], seg=16,
                       collection=col, mat=M["teal"])
    kettle.parent = st
    kettle.location = (0, 0, 1.02)
    return dict(stove=st, fire=fw, pos=Vector(c), front=(-n))


def table(col, M):
    tx, ty = 1.45, 1.2
    parts = [geo.box("TableTop", (0.95, 0.7, 0.06), loc=(0, 0, 0.74), collection=col, mat=M["wood"], bevel=0.015)]
    for sx in (-0.4, 0.4):
        for sy in (-0.28, 0.28):
            parts.append(geo.box("TableLeg", (0.06, 0.06, 0.72), loc=(sx, sy, 0.36), collection=col, mat=M["wood"]))
    tb = geo.join(parts, "Table")
    tb.location = (tx, ty, 0)
    tb.rotation_euler = (0, 0, math.radians(45))
    stool = [geo.lathe("StoolSeat", [(0.0, 0.46), (0.19, 0.46), (0.19, 0.5), (0.0, 0.5)], seg=20, collection=col, mat=M["wood"])]
    for i in range(3):
        aa = 2 * math.pi * i / 3
        stool.append(geo.box("StoolLeg", (0.04, 0.04, 0.48), loc=(0.13 * math.cos(aa), 0.13 * math.sin(aa), 0.23),
                             rot=(0.12 * math.sin(aa), -0.12 * math.cos(aa), 0), collection=col, mat=M["wood"]))
    sj = geo.join(stool, "Stool")
    sj.location = (tx - 0.5, ty - 0.45, 0)
    cup = geo.lathe("Cup", [(0.0, 0.0), (0.04, 0.0), (0.05, 0.02), (0.055, 0.09), (0.05, 0.095), (0.0, 0.095)], seg=16,
                    collection=col, mat=M["ceramic"])
    cup.location = (tx - 0.12, ty - 0.12, 0.77)
    pot = geo.lathe("Teapot", [(0.0, 0.0), (0.08, 0.0), (0.11, 0.06), (0.1, 0.13), (0.05, 0.16), (0.02, 0.19), (0.0, 0.19)],
                    seg=20, collection=col, mat=M["ceramic"])
    pot.location = (tx + 0.18, ty + 0.05, 0.77)
    candle = geo.lathe("Candle", [(0.0, 0.0), (0.035, 0.0), (0.035, 0.12), (0.0, 0.12)], seg=12, collection=col, mat=M["linen"])
    candle.location = (tx + 0.22, ty - 0.22, 0.77)
    flame = geo.lathe("CandleFlame", [(0.0, 0.0), (0.012, 0.012), (0.009, 0.03), (0.0, 0.045)], seg=8, collection=col, mat=M["flame"])
    flame.location = (tx + 0.22, ty - 0.22, 0.895)
    stool2 = [geo.lathe("Stool2Seat", [(0.0, 0.46), (0.19, 0.46), (0.19, 0.5), (0.0, 0.5)], seg=20, collection=col, mat=M["wood"])]
    for i in range(3):
        aa = 2 * math.pi * i / 3
        stool2.append(geo.box("Stool2Leg", (0.04, 0.04, 0.48), loc=(0.13 * math.cos(aa), 0.13 * math.sin(aa), 0.23),
                              rot=(0.12 * math.sin(aa), -0.12 * math.cos(aa), 0), collection=col, mat=M["wood"]))
    s2 = geo.join(stool2, "Stool2")
    s2.location = (tx + 0.42, ty + 0.55, 0)       # the second stool, tucked away under the far side
    return dict(table=tb, stool=sj, stool2=s2, cup=cup, pot=pot, candle=candle, flame=flame, top=Vector((tx, ty, 0.77)),
                seat=Vector((tx - 0.5, ty - 0.45, 0.5)), candle_pos=Vector((tx + 0.22, ty - 0.22, 0.92)))


def shelves(col, M, rng):
    a = math.radians(-135)
    n = Vector((math.cos(a), math.sin(a), 0))
    t = Vector((-n.y, n.x, 0))
    base = n * (RI - 0.18)
    rot = a + math.pi / 2
    parts, books = [], []
    for k, z in enumerate((1.1, 1.55, 2.0)):
        b = geo.box("Shelf", (1.7, 0.3, 0.04), collection=col, mat=M["wood"])
        b.location = base + Vector((0, 0, z))
        b.rotation_euler = (0, 0, rot)
        parts.append(b)
        u = -0.75
        while u < 0.75:
            if rng.random() < 0.55:
                w = rng.uniform(0.05, 0.09)
                hh = rng.uniform(0.2, 0.3)
                m = [M["red"], M["teal"], M["book_blue"], M["wood"]][int(rng.integers(0, 4))]
                bk = geo.box("Book", (w, 0.2, hh), collection=col, mat=m, bevel=0.005)
                bk.location = base + t * u + Vector((0, 0, z + hh / 2 + 0.02))
                bk.rotation_euler = (0, rng.normal(0, 0.04), rot)
                books.append(bk)
                u += w + 0.005
            else:
                jar = geo.lathe("Jar", [(0.0, 0.0), (0.06, 0.0), (0.065, 0.12), (0.045, 0.16), (0.045, 0.19), (0.0, 0.19)],
                                seg=14, collection=col, mat=[M["glass"], M["ceramic"], M["teal"]][int(rng.integers(0, 3))])
                jar.location = base + t * u + Vector((0, 0, z + 0.02))
                parts.append(jar)
                u += 0.16
    # the star book (blue with a gold star) lies flat on the middle shelf, easy to pick up
    sb = geo.box("StarBook", (0.26, 0.2, 0.05), collection=col, mat=M["book_blue"], bevel=0.008)
    sb.location = base + t * 0.55 + Vector((0, 0, 1.55 + 0.045))
    sb.rotation_euler = (0, 0, rot + 0.1)
    for b in (geo.join(parts, "ShelfStuff"), geo.join(books, "Books")):
        pass
    return dict(star_book=sb)


def workbench(col, M, rng):
    a = math.radians(90)
    n = Vector((math.cos(a), math.sin(a), 0))
    c = n * (RI - 0.42)
    parts = [geo.box("BenchTop", (1.5, 0.6, 0.07), loc=(0, 0, 0.85), collection=col, mat=M["wood"], bevel=0.015)]
    for sx in (-0.65, 0.65):
        for sy in (-0.24, 0.24):
            parts.append(geo.box("BenchLeg", (0.08, 0.08, 0.84), loc=(sx, sy, 0.42), collection=col, mat=M["wood"]))
    parts.append(geo.box("Rack", (1.4, 0.04, 0.6), loc=(0, 0.3, 1.35), collection=col, mat=M["wood"]))
    for i in range(6):
        parts.append(geo.box("Tool", (0.03, 0.03, rng.uniform(0.25, 0.45)), loc=(-0.55 + i * 0.22, 0.26, 1.35), collection=col, mat=M["iron"]))
    wb = geo.join(parts, "Workbench")
    wb.location = c
    wb.rotation_euler = (0, 0, a + math.pi / 2)
    hammer = geo.join([geo.box("HammerHandle", (0.03, 0.28, 0.03), loc=(0, 0, 0), collection=col, mat=M["wood"]),
                       geo.box("HammerHead", (0.1, 0.04, 0.04), loc=(0, 0.14, 0), collection=col, mat=M["iron"])], "Hammer")
    hammer.location = c + Vector((0.35, -0.1, 0.905))
    return dict(bench=wb, hammer=hammer, top=c + Vector((0, 0, 0.885)))


def flour_pile(col, M, rng):
    a = math.radians(112)
    n = Vector((math.cos(a), math.sin(a), 0))
    c = n * (RI - 0.7)
    sacks = []
    for i in range(6):
        hh = rng.uniform(0.5, 0.7)
        sk = geo.rounded_box(f"FSack{i}", (0.5, 0.4, hh), 0.15, seg=(2, 2, 2), n_r=3, collection=col, mat=M["sack"])
        geo.displace_noise(sk, 0.03, 0.2, seed=10 + i)
        off = Vector((rng.normal(0, 0.35), rng.normal(0, 0.25), 0))
        sk.location = c + off + Vector((0, 0, hh / 2 + (0.5 if i >= 4 else 0)))
        sk.rotation_euler = (rng.normal(0, 0.08), rng.normal(0, 0.08), rng.uniform(0, 6.28))
        sacks.append(sk)
    return dict(sacks=sacks, pos=c)


def flour_crater(col, M, at):
    """Spilled flour mound with a crater where the star lands."""
    verts, faces = [], []
    nr, nt = 14, 40
    for j in range(nr + 1):
        r = 0.9 * j / nr
        for i in range(nt):
            a = 2 * math.pi * i / nt
            h = 0.12 * math.exp(-((r - 0.32) / 0.16) ** 2) - 0.03 * math.exp(-(r / 0.14) ** 2) + 0.004
            h *= 1 + 0.25 * math.sin(a * 5 + r * 9)
            h = max(h, 0.0)          # the dish never dips below the planks (shots lift it 3 cm above the floor)
            verts.append((r * math.cos(a), r * math.sin(a), h))
    for j in range(nr):
        for i in range(nt):
            i2 = (i + 1) % nt
            faces.append((j * nt + i, j * nt + i2, (j + 1) * nt + i2, (j + 1) * nt + i))
    o = geo.obj_from("FlourCrater", verts, faces, col, M["flour"])
    o.location = at
    return o


def ladder(col, M):
    a = math.radians(20)
    n = Vector((math.cos(a), math.sin(a), 0))
    c = n * (RI - 0.45)
    parts = []
    L = H_ROOM + 0.3
    for s in (-0.25, 0.25):
        parts.append(geo.box("LadderRail", (0.06, 0.08, L), loc=(0, s, L / 2), collection=col, mat=M["wood"]))
    for k in range(9):
        parts.append(geo.box("Rung", (0.04, 0.5, 0.04), loc=(0, 0, 0.3 + k * 0.36), collection=col, mat=M["wood"]))
    ld = geo.join(parts, "Ladder")
    ld.location = c
    ld.rotation_euler = (0, math.radians(-12), a)
    return ld


def telescope(col, M):
    """Brass telescope on a tripod by the side window, with a dust sheet that can be pulled off."""
    a = math.radians(-26)
    n = Vector((math.cos(a), math.sin(a), 0))
    base = n * (RI - 0.72)
    root = bpy.data.objects.new("Telescope", None)
    col.objects.link(root)
    root.location = base
    parts = []
    for i in range(3):
        aa = 2 * math.pi * i / 3 + 0.3
        lg = geo.box("TriLeg", (0.035, 0.035, 1.25), collection=col, mat=M["wood"])
        lg.location = (0.22 * math.cos(aa), 0.22 * math.sin(aa), 0.58)
        lg.rotation_euler = (math.radians(14) * math.sin(aa), -math.radians(14) * math.cos(aa), 0)
        parts.append(lg)
    tri = geo.join(parts, "Tripod")
    tri.parent = root
    tube = geo.lathe("TeleTube", [(0.0, -0.5), (0.05, -0.5), (0.055, -0.1), (0.065, 0.3), (0.075, 0.55), (0.08, 0.6), (0.0, 0.6)],
                     seg=24, collection=col, mat=M["brass"])
    tube.parent = root
    tube.location = (0, 0, 1.2)
    tube.rotation_euler = (math.radians(-55), 0, math.radians(-45) - math.pi / 2)
    eyepiece = geo.lathe("Eyepiece", [(0.0, -0.62), (0.025, -0.62), (0.03, -0.5), (0.0, -0.5)], seg=12, collection=col, mat=M["brass"])
    eyepiece.parent = tube
    # dust sheet: draped cone with folds
    verts, faces = [], []
    nt, nz = 36, 12
    for j in range(nz + 1):
        z = 1.75 * (1 - j / nz)
        r = 0.08 + 0.55 * (j / nz) ** 1.4
        for i in range(nt):
            ang = 2 * math.pi * i / nt
            rr = r * (1 + 0.12 * math.sin(ang * 6) * (j / nz))
            verts.append((rr * math.cos(ang), rr * math.sin(ang), z))
    verts.append((0, 0, 1.82))
    top = len(verts) - 1
    for j in range(nz):
        for i in range(nt):
            i2 = (i + 1) % nt
            faces.append((j * nt + i, j * nt + i2, (j + 1) * nt + i2, (j + 1) * nt + i))
    for i in range(nt):
        faces.append((top, (i + 1) % nt, i))
    sheet = geo.obj_from("DustSheet", verts, faces, col, M["sheet"])
    sheet.parent = root
    return dict(root=root, tube=tube, sheet=sheet, eye=Vector(base) + Vector((0, 0, 1.2)))


def rug(col, M):
    verts, faces, cols = [], [], []
    nr, nt = 10, 48
    palette = [(0.55, 0.18, 0.10), (0.75, 0.55, 0.25), (0.20, 0.35, 0.38), (0.62, 0.3, 0.14), (0.8, 0.7, 0.5)]
    for j in range(nr + 1):
        for i in range(nt):
            a = 2 * math.pi * i / nt
            verts.append((1.25 * j / nr * math.cos(a), 0.85 * j / nr * math.sin(a), 0.012))
            cols.append(palette[j % len(palette)])
    for j in range(nr):
        for i in range(nt):
            i2 = (i + 1) % nt
            faces.append((j * nt + i, j * nt + i2, (j + 1) * nt + i2, (j + 1) * nt + i))
    m = mat.painterly("Rug", (1, 1, 1), stroke="strokes_fine", scale=3, tex_amt=1.0, breakup=1.2, vcol="tint", bump=0.2, ao=0.5)
    o = geo.obj_from("Rug", verts, faces, col, m)
    att = o.data.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.array([(*c, 1) for c in cols]).ravel())
    o.location = (0.2, -0.55, 0)
    return o


def window_interior(col, M, a_deg, name):
    """Interior window: frame, glass, and two interior shutters hinged at the reveal edges."""
    a = math.radians(a_deg)
    n = Vector((math.cos(a), math.sin(a), 0))
    t = Vector((-n.y, n.x, 0))
    uc, w, z0, z1 = OPENINGS[a_deg]
    zc = (z0 + z1) / 2
    h = z1 - z0
    rot = Matrix.Rotation(a + math.pi / 2, 4, "Z")
    base = n * (RI + 0.3) + Vector((0, 0, zc))
    objs = []
    g = geo.box(name + "_glass", (w, 0.03, h), collection=col, mat=M["glass"])
    g.matrix_basis = Matrix.Translation(base) @ rot
    objs.append(g)
    for (sz, off) in [((0.05, 0.06, h), (0, 0, 0)), ((w, 0.06, 0.05), (0, 0, 0.05))]:
        b = geo.box(name + "_mull", sz, collection=col, mat=M["wood"])
        b.matrix_basis = Matrix.Translation(base) @ rot @ Matrix.Translation(off)
        objs.append(b)
    sill = geo.box(name + "_sill", (w + 0.25, 0.42, 0.06), collection=col, mat=M["wood"], bevel=0.01)
    sill.matrix_basis = Matrix.Translation(n * (RI + 0.12) + Vector((0, 0, z0 - 0.02))) @ rot
    objs.append(sill)
    frame = geo.join(objs, name)
    shutters = []
    for side in (-1, 1):
        sh = geo.box(f"{name}_ishutter", (w / 2 - 0.01, 0.04, h - 0.02), collection=col, mat=M["wood"], bevel=0.01)
        brace = geo.box(f"{name}_ibrace", (w / 2 - 0.05, 0.02, 0.06), loc=(0, 0.03, 0), collection=col, mat=M["beam"])
        s = geo.join([sh, brace], f"{name}_ishutter{'L' if side > 0 else 'R'}")
        piv = bpy.data.objects.new(f"{name}_ihinge{'L' if side > 0 else 'R'}", None)
        col.objects.link(piv)
        hinge = n * (RI - 0.02) + t * (side * w / 2) + Vector((0, 0, zc))
        piv.matrix_basis = Matrix.Translation(hinge) @ rot
        piv["base_rot"] = piv.rotation_euler.z
        piv["side"] = side
        s.parent = piv
        s.location = (-side * (w / 4), 0, 0)
        shutters.append(piv)
    return frame, shutters


def set_ishutter(piv, openness):
    """openness 1 = folded open against the inner wall, 0 = closed across the window."""
    piv.rotation_euler.z = piv["base_rot"] - piv["side"] * math.radians(100) * openness


def lantern(col, M, name="Lantern"):
    """The star's lantern: brass frame, glass panes, little door, ring handle. Origin at its base."""
    root = bpy.data.objects.new(name, None)
    col.objects.link(root)
    parts = []
    parts.append(geo.lathe(name + "_base", [(0.0, 0.0), (0.12, 0.0), (0.125, 0.03), (0.11, 0.045), (0.0, 0.045)], seg=6,
                           collection=col, mat=M["brass"], smooth=False))
    parts.append(geo.lathe(name + "_top", [(0.0, 0.3), (0.12, 0.3), (0.08, 0.36), (0.03, 0.4), (0.0, 0.41)], seg=6,
                           collection=col, mat=M["brass"], smooth=False))
    for i in range(6):
        a = 2 * math.pi * i / 6
        parts.append(geo.box(name + "_post", (0.015, 0.015, 0.26), loc=(0.112 * math.cos(a), 0.112 * math.sin(a), 0.172),
                             collection=col, mat=M["brass"]))
    ring = geo.lathe(name + "_ring", [(0.04, -0.008), (0.05, 0.0), (0.04, 0.008)], seg=16, collection=col, mat=M["brass"],
                     cap_top=False, cap_bot=False)
    ring.location = (0, 0, 0.44)
    ring.rotation_euler = (math.radians(90), 0, 0)
    parts.append(ring)
    frame = geo.join(parts, name + "_frame")
    frame.parent = root
    glass = geo.lathe(name + "_glass", [(0.106, 0.045), (0.106, 0.3)], seg=6, collection=col, mat=M["glass"], cap_top=False,
                      cap_bot=False, smooth=False)
    glass.parent = root
    gm = glass.data.materials[0]
    return dict(root=root, frame=frame, glass=glass, inside=Vector((0, 0, 0.17)))


def crate(col, M):
    a = math.radians(-45)
    n = Vector((math.cos(a), math.sin(a), 0))
    c = n * (RI - 0.32)
    parts = [geo.box("CrateBox", (0.5, 0.42, 0.42), loc=(0, 0, 0.21), collection=col, mat=M["wood"], bevel=0.015)]
    for z in (0.1, 0.32):
        parts.append(geo.box("CrateSlat", (0.52, 0.44, 0.04), loc=(0, 0, z), collection=col, mat=M["beam"]))
    cr = geo.join(parts, "StepCrate")
    cr.location = c
    cr.rotation_euler = (0, 0, a + math.pi / 2)
    return dict(crate=cr, top=Vector(c) + Vector((0, 0, 0.42)))


def build(origin=(0.0, 0.0, 0.0), collection=None, telescope_covered=True, crater=False, lanterns=0):
    col = collection or geo.coll("Interior")
    M = mats()
    rng = np.random.default_rng(23)
    objs = {}
    objs["walls"] = walls(col, M)
    objs["floor"], objs["ceiling"], objs["joists"] = floor_ceiling(col, M, rng)
    objs["bed"] = bed(col, M)
    objs["stove"] = stove(col, M)
    objs["table"] = table(col, M)
    objs["shelves"] = shelves(col, M, rng)
    objs["bench"] = workbench(col, M, rng)
    objs["flour"] = flour_pile(col, M, rng)
    objs["ladder"] = ladder(col, M)
    objs["telescope"] = telescope(col, M)
    objs["rug"] = rug(col, M)
    objs["crate"] = crate(col, M)
    objs["win_front"] = window_interior(col, M, -45, "IWinFront")
    objs["win_side"] = window_interior(col, M, 45, "IWinSide")
    if crater:
        objs["crater"] = flour_crater(col, M, objs["flour"]["pos"] + Vector((0.55, -0.55, 0)))
    objs["telescope"]["sheet"].hide_render = not telescope_covered
    if telescope_covered:
        for o in objs["telescope"]["root"].children_recursive:
            if o.name != "DustSheet":
                o.hide_render = True
    root = bpy.data.objects.new("InteriorRoot", None)
    col.objects.link(root)
    root.location = origin
    for o in col.objects:
        if o.parent is None and o is not root:
            o.parent = root
    objs["root"] = root
    objs["mats"] = M
    return objs
