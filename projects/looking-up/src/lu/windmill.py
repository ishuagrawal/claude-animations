"""The windmill: a storybook octagonal smock mill — weatherboarded timber tower on a fieldstone base, a
wooden gallery (stage) at the top of the base, a boat-shaped shingled cap, lattice sails with canvas, a
tail pole, shuttered windows and the miller's yard props. Front (door, sails) faces -Y. All parts are
built in the mill's local space and parented to the 'Windmill' empty."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

from . import geo, mat

BASE_H = 3.4          # fieldstone base height (ground floor: the miller's room)
BASE_R = 3.5          # base apothem (flat-face distance)
TOWER_H = 7.4         # timber smock tower above the base
R_BOT = 3.05          # timber tower apothem at its foot
R_TOP = 2.15          # at its top
CAP_Z = BASE_H + TOWER_H
SHAFT_Z = CAP_Z + 1.25
GALLERY_Z = BASE_H
SIDES = 8
K = math.pi / SIDES


def tower_r(z):
    if z <= BASE_H:
        return BASE_R
    t = (z - BASE_H) / TOWER_H
    return R_BOT + (R_TOP - R_BOT) * t


def face_angle(a):
    """Angle of the octagon face normal nearest to direction a (faces centred on multiples of 2K)."""
    return round(a / (2 * K)) * 2 * K


def mats():
    M = {}
    M["boards"] = mat.painterly("Boards", (0.70, 0.62, 0.50), stroke="strokes_horiz", scale=0.55, tex_amt=1.0,
                                hue_jit=0.05, bump=0.15, breakup=1.3, color2=(0.42, 0.32, 0.24), c2_thresh=(0.6, 0.7),
                                c2_scale=0.6, vcol="tint", ao=0.5)
    M["stone"] = mat.painterly("Stone", (0.55, 0.50, 0.46), stroke="strokes_broad", scale=0.9, tex_amt=1.1,
                               breakup=1.4, bump=0.3, color2=(0.34, 0.40, 0.20), c2_thresh=(0.62, 0.7), vcol="tint", ao=0.6)
    M["mortar"] = mat.painterly("Mortar", (0.36, 0.33, 0.30), stroke="strokes_broad", scale=1.2, tex_amt=0.8, breakup=1.0, ao=0.6)
    M["wood"] = mat.painterly("Wood", (0.38, 0.24, 0.14), stroke="strokes_horiz", scale=1.4, tex_amt=1.2,
                              breakup=1.3, bump=0.25, color2=(0.48, 0.35, 0.24), ao=0.5)
    M["wood_dark"] = mat.painterly("WoodDark", (0.17, 0.11, 0.08), stroke="strokes_horiz", scale=1.6, tex_amt=1.1,
                                   breakup=1.2, bump=0.2, ao=0.5)
    M["wood_grey"] = mat.painterly("WoodGrey", (0.46, 0.40, 0.34), stroke="strokes_vert", scale=1.6, tex_amt=1.2,
                                   breakup=1.3, bump=0.25, color2=(0.32, 0.26, 0.20), ao=0.5)
    M["trim"] = mat.painterly("Trim", (0.46, 0.13, 0.09), stroke="strokes_vert", scale=1.8, tex_amt=1.1,
                              breakup=1.2, bump=0.15, color2=(0.30, 0.18, 0.12), c2_thresh=(0.62, 0.72), ao=0.5)
    M["shingle"] = mat.painterly("Shingle", (0.26, 0.19, 0.15), stroke="strokes_horiz", scale=1.6, tex_amt=1.3,
                                 breakup=1.4, bump=0.35, color2=(0.36, 0.38, 0.22), c2_thresh=(0.6, 0.68), vcol="tint", ao=0.5)
    M["canvas"] = mat.painterly("Canvas", (0.82, 0.74, 0.58), stroke="strokes_fine", scale=1.2, tex_amt=0.8,
                                breakup=1.1, translucent=0.45, wrap=0.15, bump=0.1, backface=True)
    M["iron"] = mat.painterly("Iron", (0.07, 0.065, 0.06), stroke="strokes_fine", scale=3, tex_amt=0.8, spec=0.5,
                              rough=0.35, breakup=0.8)
    M["glass"] = mat.painterly("WindowGlass", (0.04, 0.05, 0.07), stroke="strokes_fine", scale=2, tex_amt=0.4,
                               spec=0.9, rough=0.12, emission=(1.0, 0.60, 0.26), emit_str=0.0)
    M["sack"] = mat.painterly("Sack", (0.64, 0.54, 0.38), stroke="strokes_fine", scale=2.5, tex_amt=1.0, breakup=1.2,
                              bump=0.25, ao=0.5)
    return M


def set_window_glow(strength):
    """Interior light seen through the glass (0 = dark)."""
    m = bpy.data.materials.get("WindowGlass")
    if not m:
        return
    for n in m.node_tree.nodes:
        if n.type == "MIX" and n.data_type == "RGBA" and n.blend_type == "MIX" and not n.inputs[6].is_linked \
                and tuple(n.inputs[6].default_value)[:3] == (0.0, 0.0, 0.0) and n.inputs[7].is_linked:
            n.inputs[0].default_value = strength


def _tint_attr(ob, fn):
    me = ob.data
    co = np.array([v.co for v in me.vertices])
    cc = fn(co)
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.concatenate([cc, np.ones((len(cc), 1))], 1).ravel())


def _stone_base(col, M, rng):
    """Fieldstone base: an octagonal mortar core plus individually shaped protruding stones."""
    R_circ = BASE_R / math.cos(K)
    core = geo.lathe("BaseCore", [(R_circ * 1.0, -0.6), (R_circ * 0.995, BASE_H)], seg=SIDES, collection=col,
                     mat=M["mortar"], cap_top=True, cap_bot=False, smooth=False)
    core.rotation_euler = (0, 0, K)   # lathe vertex 0 at angle 0 -> rotate so faces centre on 0, 2K, ...
    stones = []
    rows = 9
    hrow = (BASE_H + 0.15) / rows
    face_w = 2 * BASE_R * math.tan(K)
    for f in range(SIDES):
        fa = f * 2 * K
        nrm = Vector((math.cos(fa), math.sin(fa), 0))
        tang = Vector((-nrm.y, nrm.x, 0))
        for r in range(rows):
            z0 = -0.25 + r * hrow
            u = -face_w / 2 + rng.uniform(-0.25, 0.0) + (0.2 if r % 2 else 0.0)
            while u < face_w / 2:
                w = rng.uniform(0.42, 0.8)
                uc = u + w / 2
                deg = math.degrees(fa) if math.degrees(fa) <= 180 else math.degrees(fa) - 360
                door = abs(deg + 90) < 1 and abs(uc) < 0.85 and z0 < 2.35
                win = abs(abs(deg) - 45) < 1 and deg != 0 and abs(uc) < 0.6 and 0.55 < z0 + hrow / 2 < 1.8 and \
                    (abs(deg + 45) < 1 or abs(deg - 45) < 1)
                if not door and not win and abs(uc) < face_w / 2 + 0.05:
                    sb = geo.rounded_box("St", (w - 0.05, 0.22, hrow - 0.04), 0.07, seg=(1, 1, 1), n_r=2, collection=col,
                                         mat=M["stone"])
                    geo.displace_noise(sb, 0.025, 0.12, seed=int(rng.integers(0, 1_000_000)))
                    p = nrm * (BASE_R + 0.05) + tang * uc + Vector((0, 0, z0 + hrow / 2))
                    sb.location = p
                    sb.rotation_euler = (rng.normal(0, 0.03), rng.normal(0, 0.03), fa + math.pi / 2 + rng.normal(0, 0.03))
                    sb.scale = (1, rng.uniform(0.8, 1.2), rng.uniform(0.85, 1.05))
                    stones.append(sb)
                u += w
    st = geo.join(stones, "BaseStones")

    def tint(co):
        z = co[:, 2]
        n = np.sin(co[:, 0] * 3.1 + co[:, 1] * 2.3) * np.cos(co[:, 2] * 4.7)
        base = np.stack([0.95 + 0.1 * n, 0.92 + 0.08 * n, 0.88 + 0.06 * n], 1)
        moss = np.clip(1 - z / 1.2, 0, 1)[:, None]
        return base * (1 - 0.3 * moss) + np.array([0.55, 0.62, 0.35]) * 0.3 * moss
    _tint_attr(st, tint)
    return core, st


def _timber_tower(col, M):
    """Octagonal smock tower clad in overlapping weatherboards (each board kicks out at its lower edge)."""
    verts, faces = [], []
    nb = 26
    for i in range(nb):
        z0 = BASE_H + i * TOWER_H / nb
        z1 = z0 + TOWER_H / nb + 0.05
        R0 = (tower_r(z0) + 0.04) / math.cos(K)
        R1 = tower_r(z1) / math.cos(K)
        for s in range(SIDES):
            fa = 2 * K * s
            c0, c1 = fa - K, fa + K
            nrm = Vector((math.cos(fa), math.sin(fa), 0))
            off = nrm * 0.035
            p00 = Vector((R0 * math.cos(c0), R0 * math.sin(c0), z0)) + off
            p10 = Vector((R0 * math.cos(c1), R0 * math.sin(c1), z0)) + off
            p11 = Vector((R1 * math.cos(c1), R1 * math.sin(c1), z1))
            p01 = Vector((R1 * math.cos(c0), R1 * math.sin(c0), z1))
            b = len(verts)
            verts += [p00, p10, p11, p01, p00 - off, p10 - off]
            faces.append((b, b + 1, b + 2, b + 3))
            faces.append((b + 4, b + 5, b + 1, b))
    tw = geo.obj_from("Tower", verts, faces, col, M["boards"], smooth=False)

    def tint(co):
        z = co[:, 2]
        ang = np.arctan2(co[:, 1], co[:, 0])
        streak = np.clip(np.sin(ang * 23 + z * 0.3) * 0.5 + 0.5, 0, 1) ** 3 * 0.25
        top = np.clip((z - CAP_Z + 1.4) / 1.4, 0, 1) * 0.25
        n = np.sin(co[:, 0] * 1.7 + z * 2.9) * 0.06
        g = 1 - streak - top + n
        return np.stack([g, g * 0.98, g * 0.95], 1)
    _tint_attr(tw, tint)
    posts = []
    for s in range(SIDES):
        a = 2 * K * s + K
        p0 = Vector((tower_r(BASE_H) / math.cos(K) * math.cos(a), tower_r(BASE_H) / math.cos(K) * math.sin(a), BASE_H))
        p1 = Vector((tower_r(CAP_Z) / math.cos(K) * math.cos(a), tower_r(CAP_Z) / math.cos(K) * math.sin(a), CAP_Z))
        d = p1 - p0
        b = geo.box("CornerPost", (0.17, 0.17, d.length), collection=col, mat=M["wood_grey"], bevel=0.02)
        b.matrix_basis = Matrix.Translation((p0 + p1) / 2 + Vector((math.cos(a), math.sin(a), 0)) * 0.06) @ \
            d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        posts.append(b)
    return tw, geo.join(posts, "CornerPosts")


def build(origin=(0.0, 7.0, 1.38), collection=None, sails_angle=0.0, canvas=(1, 1, 1, 1), shutters_open=1.0):
    col = collection or geo.coll("Windmill")
    M = mats()
    rng = np.random.default_rng(17)
    root = bpy.data.objects.new("Windmill", None)
    col.objects.link(root)
    root.location = origin
    parts = []

    def add(o):
        o.parent = root
        parts.append(o)
        return o

    core, stones = _stone_base(col, M, rng)
    add(core)
    add(stones)
    tw, posts = _timber_tower(col, M)
    add(tw)
    add(posts)
    sill = geo.lathe("Sill", [(BASE_R * 1.07 / math.cos(K), BASE_H - 0.14), (BASE_R * 1.07 / math.cos(K), BASE_H + 0.1),
                              (R_BOT * 1.02 / math.cos(K), BASE_H + 0.14)], seg=SIDES, collection=col, mat=M["wood_dark"],
                     cap_top=False, cap_bot=True, smooth=False)
    sill.rotation_euler = (0, 0, K)
    add(sill)

    # ---------------- door (front, -Y) with timber frame + porch roof
    fy = -BASE_R - 0.06
    door = []
    for i in range(5):
        x = -0.48 + (i + 0.5) * 0.192
        door.append(geo.box(f"DoorPlank{i}", (0.18, 0.07, 2.05), loc=(x, fy - 0.02, 1.05), collection=col, mat=M["trim"], bevel=0.01))
    for zz in (0.55, 1.6):
        door.append(geo.box("DoorBrace", (0.96, 0.05, 0.11), loc=(0, fy - 0.07, zz), collection=col, mat=M["wood_dark"], bevel=0.01))
        door.append(geo.box("Hinge", (0.45, 0.03, 0.05), loc=(-0.26, fy - 0.1, zz), collection=col, mat=M["iron"]))
    door.append(geo.box("Latch", (0.07, 0.06, 0.07), loc=(0.36, fy - 0.11, 1.1), collection=col, mat=M["iron"]))
    add(geo.join(door, "Door"))
    fr = [geo.box("DoorLintel", (1.5, 0.3, 0.22), loc=(0, fy - 0.05, 2.2), collection=col, mat=M["wood_grey"], bevel=0.02)]
    for sx in (-0.62, 0.62):
        fr.append(geo.box("DoorJamb", (0.18, 0.28, 2.15), loc=(sx, fy - 0.04, 1.07), collection=col, mat=M["wood_grey"], bevel=0.02))
    add(geo.join(fr, "DoorFrame"))
    pr = geo.box("PorchRoof", (1.9, 1.0, 0.08), collection=col, mat=M["shingle"], bevel=0.02)
    pr.location = (0, fy - 0.42, 2.62)
    pr.rotation_euler = (math.radians(-24), 0, 0)
    _tint_attr(pr, lambda co: np.ones((len(co), 3)))
    add(pr)
    for sx in (-0.85, 0.85):
        br = geo.box("PorchBracket", (0.08, 0.7, 0.08), collection=col, mat=M["wood_dark"])
        br.location = (sx, fy - 0.3, 2.3)
        br.rotation_euler = (math.radians(40), 0, 0)
        add(br)
    stp = geo.box("Step0", (1.8, 0.75, 0.22), loc=(0, fy - 0.45, 0.06), collection=col, mat=M["stone"], bevel=0.05)
    _tint_attr(stp, lambda co: np.ones((len(co), 3)))
    add(stp)

    # ---------------- windows with shutters
    windows = {}

    def window(name, a_deg, z, w=0.78, h=0.9, open_=1.0):
        a = math.radians(a_deg)
        r = tower_r(z) + 0.07
        nrm = Vector((math.cos(a), math.sin(a), 0))
        p = nrm * r + Vector((0, 0, z))
        rot = Matrix.Rotation(a + math.pi / 2, 4, "Z")
        objs = []
        for (sz, off) in [((w + 0.2, 0.16, 0.12), (0, 0, h / 2 + 0.06)), ((w + 0.26, 0.24, 0.1), (0, -0.04, -h / 2 - 0.05)),
                          ((0.1, 0.16, h), (-w / 2 - 0.05, 0, 0)), ((0.1, 0.16, h), (w / 2 + 0.05, 0, 0)),
                          ((0.05, 0.08, h), (0, -0.02, 0)), ((w, 0.08, 0.05), (0, -0.02, 0.06))]:
            b = geo.box(name + "_f", sz, collection=col, mat=M["wood_grey"], bevel=0.01)
            b.matrix_basis = Matrix.Translation(p) @ rot @ Matrix.Translation(off)
            objs.append(b)
        g = geo.box(name + "_glass", (w, 0.04, h), collection=col, mat=M["glass"])
        g.matrix_basis = Matrix.Translation(p) @ rot @ Matrix.Translation((0, 0.04, 0))
        objs.append(g)
        frm = add(geo.join(objs, name))
        shutters = []
        for side in (-1, 1):
            sh = []
            for kk in range(3):
                sh.append(geo.box(f"{name}_sh{kk}", (w / 6 - 0.01, 0.05, h + 0.05),
                                  loc=(side * (kk + 0.5) * (w / 6), 0, 0), collection=col, mat=M["trim"], bevel=0.008))
            for zz in (0.25, -0.25):
                sh.append(geo.box(f"{name}_shb", (w / 2 - 0.02, 0.03, 0.09), loc=(side * w / 4, -0.04, h * zz), collection=col, mat=M["wood_dark"]))
            s = geo.join(sh, f"{name}_shutter{'L' if side > 0 else 'R'}")
            piv = bpy.data.objects.new(f"{name}_hinge{'L' if side > 0 else 'R'}", None)
            col.objects.link(piv)
            piv.parent = root
            piv.matrix_basis = Matrix.Translation(p) @ rot @ Matrix.Translation((side * (w / 2 + 0.09), -0.12, 0))
            piv["base_rot"] = piv.rotation_euler.z
            piv["side"] = side
            s.parent = piv
            s.location = (-side * (w / 2 + 0.09), 0, 0)
            set_shutter(piv, open_)
            shutters.append(piv)
        windows[name] = (frm, shutters)

    window("WinFront", -45, 1.16, h=0.85, open_=shutters_open)
    window("WinSide", 45, 1.16, h=0.85, open_=shutters_open)
    window("WinTower", -90, BASE_H + 2.6, 0.62, 0.72)
    window("WinTower2", 135, BASE_H + 4.3, 0.55, 0.65)

    # ---------------- gallery (stage) on top of the stone base
    gz = GALLERY_Z
    ri = R_BOT - 0.1
    ro = BASE_R / math.cos(K) + 0.9
    planks = []
    n = 80
    for i in range(n):
        a = 2 * math.pi * i / n
        rm = (ri + ro) / 2
        planks.append(geo.box("GP", (ro - ri, rm * 2 * math.pi / n - 0.025, 0.09),
                              loc=(rm * math.cos(a), rm * math.sin(a), gz + 0.12 + rng.normal(0, 0.006)),
                              rot=(rng.normal(0, 0.01), rng.normal(0, 0.01), a), collection=col, mat=M["wood"], bevel=0.01))
    add(geo.join(planks, "GalleryFloor"))
    rail = []
    npost = 32
    for i in range(npost):
        a = 2 * math.pi * i / npost
        rail.append(geo.box("Post", (0.09, 0.09, 1.05), loc=((ro - 0.07) * math.cos(a), (ro - 0.07) * math.sin(a), gz + 0.65),
                            rot=(0, 0, a), collection=col, mat=M["wood_grey"], bevel=0.012))
        if i % 2 == 0:
            br = geo.box("Brace", (1.5, 0.1, 0.1), collection=col, mat=M["wood_dark"], bevel=0.012)
            mid = BASE_R + 0.55
            br.location = (mid * math.cos(a), mid * math.sin(a), gz - 0.42)
            br.rotation_euler = Euler((0, math.radians(-40), a), "XYZ")
            rail.append(br)
    for hz in (0.62, 1.12):
        seg = 96
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            am = (a0 + a1) / 2
            L = (ro - 0.07) * (a1 - a0) + 0.012
            rail.append(geo.box("Rail", (0.07, L, 0.065), loc=((ro - 0.07) * math.cos(am), (ro - 0.07) * math.sin(am), gz + hz),
                                rot=(0, 0, am), collection=col, mat=M["wood_grey"]))
    add(geo.join(rail, "GalleryRail"))
    gd = geo.box("GalleryDoor", (0.8, 0.07, 1.75), collection=col, mat=M["trim"], bevel=0.01)
    a = math.radians(-135)
    gd.location = ((tower_r(gz + 1) + 0.07) * math.cos(a), (tower_r(gz + 1) + 0.07) * math.sin(a), gz + 1.05)
    gd.rotation_euler = (0, 0, a + math.pi / 2)
    add(gd)

    # ---------------- cap: boat-shaped, shingled
    cz = CAP_Z
    curb = geo.lathe("Curb", [(R_TOP / math.cos(K) + 0.1, cz - 0.1), (R_TOP / math.cos(K) + 0.18, cz + 0.05),
                              (R_TOP / math.cos(K) + 0.18, cz + 0.25), (R_TOP / math.cos(K), cz + 0.28)],
                     seg=SIDES, collection=col, mat=M["wood_dark"], cap_top=False, cap_bot=False, smooth=False)
    curb.rotation_euler = (0, 0, K)
    add(curb)
    cap_prof = [(2.5, 0.0), (2.52, 0.25), (2.35, 0.8), (2.0, 1.35), (1.45, 1.85), (0.85, 2.18), (0.3, 2.34), (0.0, 2.38)]
    cap = geo.lathe("Cap", cap_prof, seg=64, collection=col, mat=M["shingle"], cap_bot=True, jitter=0.004, seed=6)
    cap.location = (0, 0.25, cz + 0.22)
    cap.scale = (0.92, 1.38, 1.0)
    _tint_attr(cap, lambda co: np.stack([0.9 + 0.15 * np.clip(co[:, 2] / 2.3, 0, 1)] * 3, 1))
    add(cap)
    add(geo.box("CapRidge", (0.18, 5.6, 0.14), loc=(0, 0.25, cz + 0.22 + 2.36), collection=col, mat=M["wood_dark"], bevel=0.03))
    gab = geo.box("CapGable", (1.6, 0.3, 1.5), collection=col, mat=M["boards"], bevel=0.03)
    gab.location = (0, -3.05, SHAFT_Z)
    gab.rotation_euler = (math.radians(5), 0, 0)
    _tint_attr(gab, lambda co: np.ones((len(co), 3)) * 0.9)
    add(gab)
    # tail pole (back) down to the ground with a wheel
    tp = geo.box("TailPole", (0.22, 12.5, 0.22), collection=col, mat=M["wood_grey"], bevel=0.02)
    tp.location = (0, 6.0, cz - 4.4)
    tp.rotation_euler = (math.radians(-44), 0, 0)
    add(tp)
    for s in (-1, 1):
        st = geo.box("TailStrut", (0.12, 7.0, 0.12), collection=col, mat=M["wood_grey"], bevel=0.01)
        st.location = (s * 1.0, 3.8, cz - 2.2)
        st.rotation_euler = (math.radians(-32), 0, math.radians(s * 9))
        add(st)
    wheel = geo.lathe("TailWheel", [(0.05, -0.07), (0.5, -0.07), (0.55, 0.0), (0.5, 0.07), (0.05, 0.07)], seg=24,
                      collection=col, mat=M["wood_dark"])
    wheel.location = (0, 10.4, 0.5)
    wheel.rotation_euler = (0, math.radians(90), 0)
    add(wheel)

    # ---------------- windshaft + sails
    sh_dir = Vector((0, -1, math.tan(math.radians(5)))).normalized()
    shaft_base = Vector((0, -2.8, SHAFT_Z))
    shaft = geo.lathe("Windshaft", [(0.3, 0), (0.28, 2.75), (0.0, 2.75)], seg=20, collection=col, mat=M["wood_dark"])
    shaft.matrix_basis = Matrix.Translation(shaft_base) @ sh_dir.to_track_quat("Z", "Y").to_matrix().to_4x4()
    add(shaft)
    mount = bpy.data.objects.new("SailMount", None)
    col.objects.link(mount)
    mount.parent = root
    mount.matrix_basis = Matrix.Translation(shaft_base + sh_dir * 2.9) @ sh_dir.to_track_quat("Z", "Y").to_matrix().to_4x4()
    hub = bpy.data.objects.new("SailHub", None)
    col.objects.link(hub)
    hub.parent = mount
    sails = build_sails(hub, col, M, canvas)
    poll = geo.box("PollEnd", (0.7, 0.7, 0.62), collection=col, mat=M["iron"], bevel=0.06)
    poll.parent = hub
    sails_set_angle(hub, sails_angle)

    # ---------------- yard props
    props = [geo.box("LampHook", (0.05, 0.42, 0.05), loc=(0.95, fy - 0.2, 2.15), collection=col, mat=M["iron"])]
    bench = [geo.box("BenchSeat", (1.6, 0.42, 0.08), loc=(0, 0, 0.48), collection=col, mat=M["wood"], bevel=0.015)]
    for s in (-0.65, 0.65):
        bench.append(geo.box("BenchLeg", (0.08, 0.36, 0.45), loc=(s, 0, 0.22), collection=col, mat=M["wood_dark"], bevel=0.01))
    bj = geo.join(bench, "Bench")
    bj.location = (-2.35, fy - 0.55, 0.0)
    bj.rotation_euler = (0, 0, math.radians(14))
    props.append(bj)
    for i, (x, y, rz, hh) in enumerate([(2.1, fy - 0.45, 0.3, 0.72), (2.65, fy - 0.2, -0.4, 0.62), (2.35, fy - 0.15, 0.9, 0.55)]):
        sk = geo.rounded_box(f"Sack{i}", (0.55, 0.42, hh), 0.16, seg=(2, 2, 2), n_r=3, collection=col, mat=M["sack"])
        geo.displace_noise(sk, 0.03, 0.2, seed=i)
        sk.location = (x, y, hh / 2 - 0.04 + (0.62 if i == 2 else 0))
        sk.rotation_euler = (0, math.radians(8 * (i - 1)), rz)
        props.append(sk)
    barrel = geo.lathe("Barrel", [(0.34, 0), (0.4, 0.2), (0.43, 0.45), (0.4, 0.7), (0.34, 0.9)], seg=24, collection=col, mat=M["wood"])
    barrel.location = (-3.4, -2.9, 0.0)
    props.append(barrel)
    wood = []
    for i in range(14):
        lg = geo.lathe("Log", [(0.0, -0.45), (0.11, -0.45), (0.12, 0.45), (0.0, 0.45)], seg=10, collection=col, mat=M["wood"])
        lg.location = (3.9, 0.6 + (i % 5) * 0.24, 0.12 + (i // 5) * 0.22)
        lg.rotation_euler = (0, math.radians(90), math.radians(rng.normal(0, 4)))
        wood.append(lg)
    props.append(geo.join(wood, "WoodPile"))
    for o in props:
        add(o)
    return dict(root=root, hub=hub, sails=sails, windows=windows, mats=M, parts=parts)


def set_shutter(piv, openness):
    """openness 1 = folded flat against the wall, 0 = closed over the window."""
    piv.rotation_euler.z = piv["base_rot"] + piv["side"] * math.radians(162) * openness


def build_sails(hub, col, M, canvas):
    sails = []
    for k in range(4):
        arm = bpy.data.objects.new(f"SailArm{k}", None)
        col.objects.link(arm)
        arm.parent = hub
        arm.rotation_euler = (0, 0, k * math.pi / 2)
        parts = []
        L = 7.8
        parts.append(geo.box(f"Stock{k}", (0.26, 0.22, L), loc=(0, 0, L / 2 + 0.2), collection=col, mat=M["wood_grey"], bevel=0.02))
        x0, x1 = 0.2, 1.85
        z0, z1 = 1.5, L
        nb = 18
        for i in range(nb):
            z = z0 + (z1 - z0) * i / (nb - 1)
            parts.append(geo.box("SailBar", (x1 - x0 + 0.1, 0.065, 0.065), loc=((x0 + x1) / 2, 0.06, z), collection=col, mat=M["wood_grey"]))
        parts.append(geo.box("Hemlath", (0.08, 0.1, z1 - z0), loc=(x1, 0.06, (z0 + z1) / 2), collection=col, mat=M["wood_grey"]))
        parts.append(geo.box("Leadboard", (0.42, 0.04, z1 - z0 - 0.6), loc=(-0.33, 0.02, (z0 + z1) / 2 + 0.3), collection=col, mat=M["wood"]))
        frame = geo.join(parts, f"SailFrame{k}")
        frame.parent = arm
        frame.rotation_euler = (-math.pi / 2, 0, 0)     # built along +Z; the sail plane is perpendicular to the shaft
        cv = None
        if canvas[k]:
            nx, nz = 6, 24
            verts, faces = [], []
            for j in range(nz + 1):
                for i in range(nx + 1):
                    u, w = i / nx, j / nz
                    verts.append((x0 + (x1 - x0) * u, 0.15 + 0.2 * math.sin(math.pi * u) * math.sin(math.pi * w) ** 0.6, z0 + (z1 - z0) * w))
            for j in range(nz):
                for i in range(nx):
                    a = j * (nx + 1) + i
                    faces.append((a, a + 1, a + nx + 2, a + nx + 1))
            cv = geo.obj_from(f"Canvas{k}", verts, faces, col, M["canvas"])
            cv.parent = arm
            cv.rotation_euler = (-math.pi / 2, 0, 0)
        sails.append(dict(arm=arm, frame=frame, canvas=cv))
    return sails


def sails_set_angle(hub, deg):
    hub.rotation_mode = "XYZ"
    hub.rotation_euler = (0, 0, math.radians(deg))
