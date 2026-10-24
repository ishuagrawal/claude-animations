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
    M["mortar"] = mat.painterly("Mortar", (0.22, 0.21, 0.19), stroke="strokes_broad", scale=1.2, tex_amt=0.9, breakup=1.1,
                                color2=(0.14, 0.2, 0.08), c2_thresh=(0.5, 0.62), ao=0.6)
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
    M["canvas"] = mat.painterly("Canvas", (0.70, 0.62, 0.48), stroke="strokes_vert", scale=1.1, tex_amt=1.1,
                                breakup=1.3, translucent=0.45, wrap=0.15, bump=0.12, backface=True,
                                color2=(0.50, 0.41, 0.30), c2_thresh=(0.56, 0.68), c2_scale=0.5)
    M["iron"] = mat.painterly("Iron", (0.07, 0.065, 0.06), stroke="strokes_fine", scale=3, tex_amt=0.8, spec=0.5,
                              rough=0.35, breakup=0.8)
    M["glass"] = mat.painterly("WindowGlass", (0.04, 0.05, 0.07), stroke="strokes_fine", scale=2, tex_amt=0.4,
                               spec=0.9, rough=0.12, emission=(1.0, 0.60, 0.26), emit_str=0.0)
    M["sack"] = mat.painterly("Sack", (0.40, 0.31, 0.20), stroke="strokes_fine", scale=2.5, tex_amt=1.2, breakup=1.3,
                              bump=0.35, color2=(0.30, 0.23, 0.15), c2_thresh=(0.55, 0.66), ao=0.5)
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
                    sb = geo.rounded_box("St", (w - 0.06, 0.22, hrow - 0.05), 0.04, seg=(2, 1, 1), n_r=2, collection=col,
                                         mat=M["stone"])
                    geo.displace_noise(sb, 0.03, 0.1, seed=int(rng.integers(0, 1_000_000)))
                    zc = z0 + hrow / 2
                    v = rng.uniform(0.78, 1.12)
                    hue = rng.normal(0, 0.04)
                    moss = max(0.0, 1 - zc / 1.1) * rng.uniform(0.3, 1.0) if rng.random() < 0.7 else 0.0
                    sc_ = np.array([v * (1 + hue), v, v * (1 - hue)])
                    sc_ = sc_ * (1 - 0.45 * moss) + np.array([0.48, 0.6, 0.3]) * 0.45 * moss
                    _tint_attr(sb, lambda co, c=sc_: np.tile(c, (len(co), 1)))
                    p = nrm * (BASE_R + 0.05) + tang * uc + Vector((0, 0, z0 + hrow / 2))
                    sb.location = p
                    sb.rotation_euler = (rng.normal(0, 0.03), rng.normal(0, 0.03), fa + math.pi / 2 + rng.normal(0, 0.03))
                    sb.scale = (1, rng.uniform(0.8, 1.2), rng.uniform(0.85, 1.05))
                    stones.append(sb)
                u += w
    st = geo.join(stones, "BaseStones")
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
        row = np.floor((z - BASE_H) / (TOWER_H / nb) + 0.02)
        side = np.round(ang / (2 * K)) % SIDES
        h = np.sin(row * 12.9898 + side * 78.233) * 43758.5453
        rnd = h - np.floor(h)                                   # one random value per board
        h2 = np.sin(row * 4.123 + side * 19.71 + 3.3) * 9631.17
        rnd2 = h2 - np.floor(h2)
        streak = np.clip(np.sin(ang * 23 + z * 0.3) * 0.5 + 0.5, 0, 1) ** 3 * 0.22
        top = np.clip((z - CAP_Z + 1.4) / 1.4, 0, 1) * 0.25          # under the cap's drip line
        low = np.clip(1 - (z - BASE_H) / 0.9, 0, 1)                    # splash zone above the gallery
        n = np.sin(co[:, 0] * 1.7 + z * 2.9) * 0.05
        g = (0.80 + 0.32 * rnd) * (1 - streak - top + n) * (1 - 0.18 * low)
        warm = 1 + 0.10 * (rnd2 - 0.5)
        c = np.stack([g * warm, g * 0.98, g * (0.95 - 0.08 * (rnd2 - 0.5))], 1)
        moss = (low * 0.55 * (rnd2 > 0.35))[:, None]
        return c * (1 - moss) + np.array([0.55, 0.66, 0.38]) * g[:, None] * moss
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
    # fantail on the cap's rear (north): a small wind rotor that keeps the sails turned into the wind. It replaces the
    # long tail pole, which would run down into the north meadow (the story's stage) and across the north view.
    ft = []
    for sx in (-0.45, 0.45):
        st = geo.box("FantailStrut", (0.1, 1.9, 0.1), collection=col, mat=M["wood_grey"], bevel=0.01)
        st.location = (sx, 3.95, cz + 1.25)
        st.rotation_euler = (math.radians(-28), 0, 0)
        ft.append(st)
        up = geo.box("FantailPost", (0.09, 0.09, 1.3), collection=col, mat=M["wood_grey"], bevel=0.01)
        up.location = (sx, 4.75, cz + 1.65)
        ft.append(up)
    ft.append(geo.box("FantailBeam", (1.1, 0.12, 0.12), loc=(0, 4.75, cz + 2.25), collection=col, mat=M["wood_dark"], bevel=0.01))
    ft.append(geo.box("FantailAxle", (1.05, 0.07, 0.07), loc=(0, 4.75, cz + 2.0), collection=col, mat=M["iron"]))
    add(geo.join(ft, "FantailFrame"))
    rot = []
    for k in range(8):
        aa = math.pi * 2 * k / 8
        bl = geo.box("FantailVane", (0.03, 0.3, 0.62), collection=col, mat=M["canvas"])
        bl.matrix_basis = Matrix.Rotation(aa, 4, "X") @ Matrix.Translation((0, 0, 0.42)) @ Matrix.Rotation(0.5, 4, "Z")
        rot.append(bl)
        sp = geo.box("FantailSpoke", (0.03, 0.03, 0.8), collection=col, mat=M["wood_grey"])
        sp.matrix_basis = Matrix.Rotation(aa, 4, "X") @ Matrix.Translation((0, 0, 0.4))
        rot.append(sp)
    fr = geo.join(rot, "Fantail")
    fr.location = (0.0, 4.75, cz + 2.0)
    add(fr)

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

    # ---------------- door lamp hook (the yard itself is dressed by dress.yard)
    hookp = [geo.box("LampHook", (0.05, 0.42, 0.05), loc=(0.95, fy - 0.2, 2.15), collection=col, mat=M["iron"]),
             geo.box("LampHookPlate", (0.14, 0.03, 0.2), loc=(0.95, fy + 0.01, 2.12), collection=col, mat=M["iron"])]
    add(geo.join(hookp, "LampHook"))
    # ---------------- ivy on the stone base, window flower boxes
    add(_ivy(col, np.random.default_rng(23)))
    for o in _flower_boxes(col, M, root):
        add(o)
    return dict(root=root, hub=hub, sails=sails, windows=windows, mats=M, parts=parts, mount=mount,
                origin=Vector(origin))


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
            parts.append(geo.box("SailBar", (x1 - x0 + 0.1, 0.065, 0.065), loc=((x0 + x1) / 2, 0.06, z), collection=col, mat=M["wood_dark"]))
        parts.append(geo.box("Hemlath", (0.08, 0.1, z1 - z0), loc=(x1, 0.06, (z0 + z1) / 2), collection=col, mat=M["wood_dark"]))
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


# ===================================================================== lived-in detail
def _wall_r(a, z=0.5):
    """Distance from the mill axis to the face of the stone base (incl. protruding stones) along direction a."""
    d = a - face_angle(a)
    return (BASE_R + 0.17) / max(math.cos(d), 0.5)


def _ivy_mat():
    m = bpy.data.materials.get("Ivy")
    if m:
        return m
    return mat.painterly("Ivy", (1, 1, 1), stroke="strokes_fine", scale=6.0, tex_amt=0.8, hue_jit=0.06, bump=0.1,
                         breakup=1.3, wrap=0.25, translucent=0.25, vcol="col", backface=True, snow=0.0)


def _ivy(col, rng):
    """Ivy climbing the fieldstone base (heavier on the shady west/north faces), avoiding the door and windows."""
    from . import dress
    mb = dress.MB()
    starts = []
    for a_deg, n in ((180, 7), (140, 5), (215, 6), (110, 2), (250, 4), (-65, 3), (-118, 4), (20, 2), (65, 1), (-20, 2)):
        for k in range(n):
            starts.append(math.radians(a_deg + rng.normal(0, 9)))
    leaf_dark, leaf_lit = (0.035, 0.10, 0.035), (0.11, 0.24, 0.07)

    def blocked(a, z):
        dg = (math.degrees(a) + 540) % 360 - 180
        if abs(dg + 90) < 17 and z < 2.6:                       # door
            return True
        for w in (-45, 45):
            if abs(dg - w) < 13 and 0.45 < z < 1.75:              # ground floor windows (+ flower boxes)
                return True
        return False

    def grow(a, z, length, depth):
        pts = []
        da = rng.normal(0, 0.01)
        for i in range(int(length / 0.07)):
            if z > BASE_H - 0.05 or blocked(a, z):
                break
            r = _wall_r(a) + 0.015
            nrm = Vector((math.cos(a), math.sin(a), 0))
            p = Vector((r * math.cos(a), r * math.sin(a), z))
            pts.append((p, nrm))
            da = da * 0.85 + rng.normal(0, 0.012)
            a += da
            z += rng.uniform(0.05, 0.085)
            if depth < 2 and rng.random() < 0.11:
                grow(a, z, length * rng.uniform(0.3, 0.6), depth + 1)
        # stem
        for (p0, n0), (p1, n1) in zip(pts, pts[1:]):
            side = (p1 - p0).cross(n0).normalized() * 0.006
            i0 = mb.vert(p0 - side, (0, 0), (0.12, 0.08, 0.05), n0)
            i1 = mb.vert(p0 + side, (0.1, 0), (0.12, 0.08, 0.05), n0)
            i2 = mb.vert(p1 + side, (0.1, 0.1), (0.12, 0.08, 0.05), n0)
            i3 = mb.vert(p1 - side, (0, 0.1), (0.12, 0.08, 0.05), n0)
            mb.face(i0, i1, i2, i3)
        # leaves: 3-lobed ivy leaves on short petioles, facing out and a little up
        for (p, nrm) in pts:
            for k in range(int(rng.integers(2, 5))):
                tang = Vector((-nrm.y, nrm.x, 0))
                off = tang * rng.normal(0, 0.07) + Vector((0, 0, rng.normal(0, 0.035)))
                s = rng.uniform(0.04, 0.075) * (1.15 if depth == 0 else 0.9)
                fn = (nrm * 0.75 + Vector((0, 0, 0.55)) + Vector(rng.normal(0, 0.2, 3))).normalized()
                up = (Vector((0, 0, 1)) - fn * fn.z).normalized()
                rt = fn.cross(up).normalized()
                c = p + nrm * rng.uniform(0.02, 0.06) + off
                tone = rng.random()
                cl = tuple(leaf_dark[j] + (leaf_lit[j] - leaf_dark[j]) * tone for j in range(3))
                ci = mb.vert(c, (0.5, 0.5), cl, fn)
                ring = []
                for j in range(9):
                    t = j / 8.0
                    ang = -math.pi * 0.95 + 1.9 * math.pi * t
                    lobe = 0.75 + 0.35 * abs(math.cos(ang * 1.5))
                    q = c + (up * math.cos(ang) * 1.05 + rt * math.sin(ang)) * s * lobe
                    ring.append(mb.vert(q, (0.5 + 0.5 * math.sin(ang), 0.5 + 0.5 * math.cos(ang)),
                                        tuple(min(1, x * 1.2) for x in cl), fn))
                for j in range(8):
                    mb.face(ci, ring[j], ring[j + 1])

    for a in starts:
        grow(a, -0.05, rng.uniform(1.2, 3.4), 0)
    return mb.build("Ivy", col, _ivy_mat())


def _flower_boxes(col, M, root):
    """Planter boxes under the two ground-floor windows, spilling flowers (cover prototypes, instanced)."""
    from . import dress
    out = []
    lib = dress.protos()
    pts = []
    for a_deg in (-45, 45):
        a = math.radians(a_deg)
        nrm = Vector((math.cos(a), math.sin(a), 0))
        tang = Vector((-nrm.y, nrm.x, 0))
        r = BASE_R + 0.17 + 0.14
        c = nrm * r + Vector((0, 0, 0.52))
        parts = [geo.box("FBox", (0.98, 0.26, 0.2), collection=col, mat=M["wood"], bevel=0.015)]
        parts.append(geo.box("FBoxRim", (1.02, 0.3, 0.035), loc=(0, 0, 0.1), collection=col, mat=M["wood_dark"]))
        parts.append(geo.box("FBoxSoil", (0.92, 0.2, 0.02), loc=(0, 0, 0.085), collection=col, mat=M["mortar"]))
        for sx in (-0.38, 0.38):
            parts.append(geo.box("FBoxBracket", (0.05, 0.2, 0.22), loc=(sx, 0.05, -0.17), collection=col, mat=M["iron"]))
        b = geo.join(parts, f"FlowerBox{a_deg}")
        b.matrix_basis = Matrix.Translation(c) @ Matrix.Rotation(a + math.pi / 2, 4, "Z")
        out.append(b)
        rng = np.random.default_rng(abs(a_deg))
        for k in range(16):
            u = rng.uniform(-0.42, 0.42)
            v = rng.uniform(-0.07, 0.07)
            p = c + tang * u + nrm * v + Vector((0, 0, 0.09))
            kind = ["daisy", "pclover", "violet", "butter", "geranium", "geranium", "geranium"][int(rng.integers(0, 7))]
            if kind not in lib:
                kind = "pclover"
            pts.append((p, lib[kind][int(rng.integers(0, len(lib[kind])))], rng.uniform(0.75, 1.0)))
        for k in range(5):                                       # trailing fern fronds over the front edge
            u = rng.uniform(-0.45, 0.45)
            p = c + tang * u + nrm * 0.1 + Vector((0, 0, 0.08))
            pts.append((p, lib["fern"][int(rng.integers(0, len(lib["fern"])))], rng.uniform(0.35, 0.5)))
    n = len(pts)
    rng = np.random.default_rng(5)
    P = dict(co=np.array([tuple(p) for p, _, _ in pts]), proto=np.array([i for _, i, _ in pts], dtype=np.int32),
             rot=np.stack([rng.normal(0, 0.1, n), rng.normal(0, 0.1, n), rng.uniform(0, 6.28, n)], 1),
             scale=np.array([s for _, _, s in pts]), tint=np.ones((n, 3)), flex=np.full(n, 0.5), lean=np.zeros((n, 3)))
    fl = dress._cloud("WinBoxFlowers", P, col)
    out.append(fl)
    return out


# ===================================================================== lanterns
def _flame_mat():
    m = bpy.data.materials.get("WM_LanternFlame")
    if m:
        return m
    return mat.emissive("WM_LanternFlame", (1.0, 0.62, 0.22), 16.0)


def _glow_mat():
    """Soft amber glow ball around a lantern flame (screen-facing falloff, additive)."""
    m = bpy.data.materials.get("WM_LanternGlow")
    if m:
        return m
    m = bpy.data.materials.new("WM_LanternGlow")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    a = nb.math("POWER", nb.mapr(lw.outputs["Facing"], 0.0, 1.0, 1.0, 0.0, interp="LINEAR"), 2.6)
    em = nb.n("ShaderNodeEmission", inputs={"Color": (1.0, 0.55, 0.2)})
    nb.inp(em, "Strength", nb.mul(a, 1.6))
    tr = nb.n("ShaderNodeBsdfTransparent")
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(add.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m


def hanging_lantern(name, ring_pos, energy=12.0, scale=0.7, parent=None, col=None):
    """A brass lantern (interior.lantern) hanging by its ring at ring_pos (world), with flame, glow and a warm point
    light. Returns dict(root, light, flame, glow, ring_h)."""
    from . import interior
    col = col or geo.coll("Windmill")
    Mi = interior.mats()
    L = interior.lantern(col, Mi, name=name)
    root = L["root"]
    root.scale = (scale, scale, scale)
    ring_h = 0.44 * scale
    root.location = Vector(ring_pos) - Vector((0, 0, ring_h))
    fl = geo.lathe(name + "_flame", [(0.0, 0.0), (0.022, 0.02), (0.016, 0.05), (0.0, 0.085)], seg=10, collection=col,
                   mat=_flame_mat())
    fl.parent = root
    fl.location = (0, 0, 0.1)
    fl.visible_shadow = False
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.32)
    g = bpy.context.active_object
    for c in g.users_collection:
        c.objects.unlink(g)
    col.objects.link(g)
    g.name = name + "_glow"
    g.data.materials.append(_glow_mat())
    g.data.shade_smooth()
    g.parent = root
    g.location = (0, 0, 0.17)
    g.visible_shadow = False
    ld = bpy.data.lights.new(name + "_light", "POINT")
    ld.color = (1.0, 0.6, 0.26)
    ld.energy = energy
    ld.shadow_soft_size = 0.05
    lo = bpy.data.objects.new(name + "_light", ld)
    col.objects.link(lo)
    lo.parent = root
    lo.location = (0, 0, 0.17)
    if parent is not None:
        mw = root.matrix_world.copy() if False else Matrix.Translation(root.location) @ Matrix.Diagonal((scale, scale, scale, 1))
        root.parent = parent
        root.matrix_parent_inverse = parent.matrix_world.inverted()
    return dict(root=root, light=lo, flame=fl, glow=g, ring_h=ring_h)


HOOK_N_ANGLE = 78.75     # the north-gallery rail post (deg from +X) carrying Claude's lantern hook (east of its mark)
DOOR_HOOK = (0.95, -BASE_R - 0.06 - 0.41, 2.12)   # mill-local point the porch lantern's ring hangs from


def rail_r():
    return BASE_R / math.cos(K) + 0.9 - 0.07


def gallery_hook(origin, col=None, M=None):
    """Iron shepherd's hook on the north rail post (HOOK_N_ANGLE): returns the world point where a lantern ring hangs."""
    col = col or geo.coll("Windmill")
    M = M or mats()
    O = Vector(origin)
    dz = O.z + GALLERY_Z + 0.165
    a = math.radians(HOOK_N_ANGLE)
    out = Vector((math.cos(a), math.sin(a), 0))
    post = Vector((O.x, O.y, 0)) + out * rail_r()
    inward = -out
    parts = [geo.box("GHookBar", (0.03, 0.03, 0.52), loc=(post.x, post.y, dz + 1.26), collection=col, mat=M["iron"])]
    arm = geo.box("GHookArm", (0.03, 0.27, 0.025), collection=col, mat=M["iron"])
    arm.location = post + inward * 0.13 + Vector((0, 0, dz + 1.5))
    arm.rotation_euler = (0, 0, math.atan2(inward.y, inward.x) - math.pi / 2)
    parts.append(arm)
    hk = geo.lathe("GHookCurl", [(0.012, -0.03), (0.02, 0.0), (0.012, 0.01)], seg=8, collection=col, mat=M["iron"])
    tip = post + inward * 0.26
    hk.location = (tip.x, tip.y, dz + 1.48)
    parts.append(hk)
    geo.join(parts, "GalleryHook")
    return Vector((tip.x, tip.y, dz + 1.465))


def lanterns(wm, door=True, gallery=False, door_energy=14.0, gallery_energy=10.0):
    """Dress the mill's practical lanterns: the porch lantern on the door hook and/or the north-gallery hook (with a
    lantern on it when gallery='lantern'). Adds to wm: 'door_lantern', 'hook_n' (world ring point), 'gallery_lantern'."""
    O = wm["origin"]
    col = geo.coll("Windmill")
    if door:
        wm["door_lantern"] = hanging_lantern("PorchLanternWM", O + Vector(DOOR_HOOK), door_energy, 0.7, col=col)
    if gallery:
        wm["hook_n"] = gallery_hook(O, col, wm["mats"])
        if gallery == "lantern":
            wm["gallery_lantern"] = hanging_lantern("GalleryLantern", wm["hook_n"], gallery_energy, 0.6, col=col)
    return wm


# ===================================================================== sails: tips, spinning
SAIL_TIP = 8.0           # stock length from the hub axis to the tip (m)


def sail_dir_deg(k, sails_angle):
    """Clock direction of sail k as seen from the south (in front): 0 = straight up, 90 = pointing west (viewer's
    left), 180 = straight down, 270 = east. Sail k sits at k*90 + sails_angle."""
    return (k * 90.0 + sails_angle) % 360.0


def sail_down_index(sails_angle):
    """Index of the sail pointing (most nearly) straight down at this sails_angle. Exactly down when
    sails_angle = 180 - 90*k (mod 360): k=2 at 0 deg, k=1 at 90, k=0 at 180, k=3 at 270."""
    return int(round((180.0 - sails_angle) / 90.0)) % 4


def sails_angle_for(k, clock_deg):
    """sails_angle that puts sail k at clock_deg (0 = up, 180 = down)."""
    return (clock_deg - 90.0 * k) % 360.0


def sail_tip(hub, sail_index, frame=None, along=SAIL_TIP, offset=(0.0, 0.0, 0.0)):
    """World matrix at sail `sail_index`'s tip (or `along` metres out from the hub on its stock). Axes: +Y points
    outward along the sail, +Z points forward (out of the sail face, toward the south/camera side), +X completes
    (the canvas side). offset is in that frame (e.g. (0, 0, 0.2) = in front of the lattice). frame: evaluate the
    animated sails at that frame (restores the current frame). Use .translation for the position."""
    sc = bpy.context.scene
    cur = sc.frame_current
    if frame is not None and frame != cur:
        sc.frame_set(frame)
    bpy.context.view_layer.update()
    arm = hub.children[[c.name.startswith(f"SailArm{sail_index}") for c in hub.children].index(True)]
    m = arm.matrix_world @ Matrix.Translation((offset[0], along + offset[1], offset[2]))
    if frame is not None and frame != cur:
        sc.frame_set(cur)
    return m.copy()


def sail_tip_empty(hub, sail_index, along=SAIL_TIP, offset=(0.0, 0.0, 0.0), name=None):
    """An Empty parented to sail `sail_index` at its tip (frame as in sail_tip): parent Claude (or a constraint
    target) to it to ride the sail."""
    arm = hub.children[[c.name.startswith(f"SailArm{sail_index}") for c in hub.children].index(True)]
    e = bpy.data.objects.new(name or f"SailTip{sail_index}", None)
    bpy.context.scene.collection.objects.link(e)
    e.empty_display_size = 0.3
    e.parent = arm
    e.location = (offset[0], along + offset[1], offset[2])
    return e


def key_sails(hub, keys, interp="BEZIER"):
    """Key the sails: keys = [(frame, sails_angle_deg), ...] (angles may exceed 360 to keep turning)."""
    hub.rotation_mode = "XYZ"
    for f, deg in keys:
        hub.rotation_euler = (0, 0, math.radians(deg))
        hub.keyframe_insert("rotation_euler", index=2, frame=f)
    ad = hub.animation_data
    if ad and ad.action and interp != "BEZIER":
        for fc in _fcurves(hub):
            if fc.data_path == "rotation_euler":
                for kp in fc.keyframe_points:
                    kp.interpolation = interp


def spin_sails(hub, f0, f1, rpm=6.0, start_deg=None, ease_in=0.0, ease_out=0.0, fps=24):
    """Turn the sails at a steady `rpm` between frames f0 and f1 with optional ease-in/out (seconds); keys every frame
    (deterministic). Positive rpm = sails_angle increases = counter-clockwise as seen from the front (south), the
    traditional direction: the 6 o'clock sail rises through the viewer's right (3 o'clock) to 12. Returns
    [(frame, sails_angle)]."""
    a0 = math.degrees(hub.rotation_euler.z) if start_deg is None else start_deg
    w = rpm * 6.0       # deg/s
    T = (f1 - f0) / fps
    keys = []
    for f in range(f0, f1 + 1):
        t = (f - f0) / fps
        # integrate a trapezoid speed profile
        def v(tt):
            s = 1.0
            if ease_in > 0 and tt < ease_in:
                s = tt / ease_in
            if ease_out > 0 and tt > T - ease_out:
                s = min(s, (T - tt) / ease_out)
            return max(0.0, s)
        n = 32
        acc = sum(v(t * (i + 0.5) / n) for i in range(n)) * t / n if t > 0 else 0.0
        keys.append((f, a0 + w * acc))
    key_sails(hub, keys, interp="LINEAR")
    return keys


def _fcurves(idb):
    ad = idb.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for cb in getattr(strip, "channelbags", []):
                out += list(cb.fcurves)
    return out
