"""Finale assets: the patchwork balloon (sewn from the windmill's sail canvas), storm cloud walls, rain, lightning,
the open star book, the scrap telescope of the coda, patched sail canvas."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat, fx


def canvas_mats():
    out = []
    for name, col in (("CanvasA", (0.82, 0.74, 0.58)), ("CanvasB", (0.74, 0.64, 0.48)), ("CanvasC", (0.86, 0.80, 0.66)),
                      ("PatchRed", (0.62, 0.22, 0.14)), ("PatchBlue", (0.22, 0.36, 0.48)), ("PatchQuilt", (0.18, 0.34, 0.44))):
        m = bpy.data.materials.get(name) or mat.painterly(name, col, stroke="strokes_fine", scale=1.4, tex_amt=0.9,
                                                          breakup=1.1, translucent=0.4, wrap=0.15, bump=0.12, backface=True)
        out.append(m)
    return out


def balloon(name="Balloon", height=3.3, radius=1.35, gores=12, sag=0.0):
    """Envelope (origin at the mouth, opening downward), ropes and a crate basket hanging below.
    Returns dict(root, envelope, basket, lantern_hook, basket_top)."""
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    mats = canvas_mats()
    # envelope: lathe-like gore panels; profile radius r(z) for z in [0, H]
    nz, per = 18, 6
    verts, faces, mids = [], [], []
    def r_of(u):    # u in [0,1] mouth -> crown
        return radius * (0.22 + 0.78 * math.sin(math.pi * min(1.0, u * 0.62 + 0.06)) ** 0.9) * (1 - 0.15 * u ** 6)
    segs = gores * per
    for j in range(nz + 1):
        u = j / nz
        z = height * u
        for i in range(segs):
            a = 2 * math.pi * i / segs
            bulge = 1 + 0.06 * math.sin(math.pi * (i % per) / per)          # panels puff between seams
            rr = r_of(u) * bulge * (1 - sag * 0.25 * math.sin(math.pi * u))
            verts.append((rr * math.cos(a), rr * math.sin(a), z - sag * 0.3 * u * u))
    for j in range(nz):
        for i in range(segs):
            i2 = (i + 1) % segs
            faces.append((j * segs + i, j * segs + i2, (j + 1) * segs + i2, (j + 1) * segs + i))
            mids.append((i // per, j))
    verts.append((0, 0, height * 1.002 - sag * 0.3))
    top = len(verts) - 1
    for i in range(segs):
        faces.append((top, nz * segs + i, nz * segs + (i + 1) % segs))
        mids.append((i // per, nz))
    env = geo.obj_from(name + "_env", verts, faces, None, None)
    for m in mats:
        env.data.materials.append(m)
    rng = np.random.default_rng(7)
    # sewn panels: each gore is cut into 3-row blocks; a few blocks are patches (red, blue, the quilt square)
    for p, (g, j) in zip(env.data.polygons, mids):
        blk = j // 3
        h = (g * 7919 + blk * 104729) % 100
        k = (g + blk) % 3
        if h < 13 or (g == 4 and blk == 2) or (g == 9 and blk == 3):
            k = 3 + (h % 3)
        p.material_index = k
    env.parent = root
    # seams (rope lines over the envelope) ending in a load ring at the mouth; from the ring, four rope bundles run
    # down to the basket's corner posts (the basket's sides stay open, so faces read between the ropes), and two
    # cross lines over the mouth carry the lantern
    rope_m = bpy.data.materials.get("Rope") or mat.painterly("Rope", (0.42, 0.33, 0.22), stroke="strokes_fine", scale=6)
    ropes = []
    basket_z = -1.35
    HB = 0.52                      # basket half-width

    def rope(p0, p1, r=0.012):
        d = p1 - p0
        c = geo.lathe("rope", [(r, 0.0), (r, d.length)], seg=5, mat=rope_m, cap_top=False, cap_bot=False)
        c.matrix_basis = Matrix.Translation(p0) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        ropes.append(c)
    for gi in range(gores):
        a = 2 * math.pi * gi / gores
        pts = [Vector((r_of(j / nz) * 1.06 * math.cos(a), r_of(j / nz) * 1.06 * math.sin(a), height * j / nz)) for j in range(nz + 1)]
        for p0, p1 in zip(pts[:-1], pts[1:]):
            rope(p0, p1)
    ring_r = r_of(0.0) * 1.07
    ring = geo.lathe("LoadRing", [(ring_r - 0.02, -0.02), (ring_r + 0.02, -0.02), (ring_r + 0.02, 0.02), (ring_r - 0.02, 0.02)],
                     seg=32, mat=rope_m, cap_top=False, cap_bot=False)
    ropes.append(ring)
    for k in range(4):
        ca = math.pi / 4 + k * math.pi / 2
        post_top = Vector((HB * math.sqrt(2) * math.cos(ca), HB * math.sqrt(2) * math.sin(ca), basket_z + 0.56))
        for da in (-0.32, 0.0, 0.32):
            p_ring = Vector((ring_r * math.cos(ca + da), ring_r * math.sin(ca + da), 0.0))
            rope(post_top, p_ring, 0.011)
    for a in (0.0, math.pi / 2):
        rope(Vector((ring_r * math.cos(a), ring_r * math.sin(a), 0.02)),
             Vector((-ring_r * math.cos(a), -ring_r * math.sin(a), 0.02)), 0.009)
    rp = geo.join(ropes, name + "_ropes")
    rp.parent = root
    # basket: a slatted wooden crate (Claude-sized), chest-high so Claude's face and arms ride above the rim
    wood = bpy.data.materials.get("IntWood") or mat.painterly("BasketWood", (0.45, 0.29, 0.17), stroke="strokes_horiz", scale=2)
    parts = [geo.box("BasketFloor", (2 * HB, 2 * HB, 0.05), loc=(0, 0, basket_z), mat=wood, bevel=0.01)]
    for side in range(4):
        a = side * math.pi / 2
        for k in range(3):
            z = basket_z + 0.08 + k * 0.12
            b = geo.box("BasketSlat", (2 * HB + 0.02, 0.05, 0.085), mat=wood, bevel=0.008)
            b.matrix_basis = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((0, HB, z))
            parts.append(b)
        rim = geo.box("BasketRim", (2 * HB + 0.1, 0.09, 0.05), mat=wood, bevel=0.012)
        rim.matrix_basis = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((0, HB + 0.01, basket_z + 0.42))
        parts.append(rim)
    for sx in (-HB, HB):
        for sy in (-HB, HB):
            parts.append(geo.box("BasketPost", (0.075, 0.075, 0.58), loc=(sx, sy, basket_z + 0.28), mat=wood, bevel=0.01))
    bk = geo.join(parts, name + "_basket")
    bk.parent = root
    hook = Vector((0, 0, 0.05))
    return dict(root=root, envelope=env, ropes=rp, basket=bk, lantern_hook=hook, basket_floor=Vector((0, 0, basket_z + 0.03)),
                rim_z=basket_z + 0.445)


def storm_material():
    """Storm-cloud paint: near-black blue-grey masses with mottled value (big + small billow noise, broad brush
    strokes), cooler lighter tops, edges that catch a cold rim of light, real light from the lightning (diffuse +
    translucent, so a flash glows through thin cloud) and a scene-wide flash term (scene property 'storm_flash') that
    sets every cloud edge alight for the length of a strike. Brushed, partly transparent silhouettes."""
    m = bpy.data.materials.get("StormCloud")
    if m:
        return m
    m = bpy.data.materials.new("StormCloud")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    g = nb.n("ShaderNodeNewGeometry")
    tc = nb.n("ShaderNodeTexCoord")
    nbig = nb.n("ShaderNodeTexNoise", inputs={"Scale": 0.07, "Detail": 5.0, "Roughness": 0.62})
    nb.link(g.outputs["Position"], nbig.inputs["Vector"])
    nmid = nb.n("ShaderNodeTexNoise", inputs={"Scale": 0.16, "Detail": 3.0, "Roughness": 0.55})
    nb.link(g.outputs["Position"], nmid.inputs["Vector"])
    big, mid = nbig.outputs["Fac"], nmid.outputs["Fac"]
    st = mat.tex_node(nb, "strokes_broad", tc.outputs["Object"], 0.05)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    up = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": g.outputs["Normal"]}).outputs[2]
    flash = nb.n("ShaderNodeAttribute", attribute_name="storm_flash", attribute_type="VIEW_LAYER").outputs["Fac"]
    # value structure: tops lighter, undersides near black, mottled
    v = nb.add(nb.add(nb.mul(up, 0.42), nb.mul(nb.sub(big, 0.5), 1.5)), nb.mul(nb.sub(sv, 0.5), 0.45))
    v = nb.mapr(nb.add(v, nb.mul(nb.sub(mid, 0.5), 0.6)), -0.55, 0.75)
    ramp = nb.n("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.018, 0.022, 0.034, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.17, 0.19, 0.25, 1)
    e = cr.elements.new(0.55)
    e.color = (0.045, 0.052, 0.075, 1)
    nb.link(v, ramp.inputs[0])
    base = ramp.outputs[0]
    # real light (lightning, moon): diffuse + translucent through thin edges
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    trn = nb.n("ShaderNodeBsdfTranslucent", inputs={"Color": (0.7, 0.7, 0.7)})
    add = nb.n("ShaderNodeAddShader")
    nb.link(dif.outputs[0], add.inputs[0])
    nb.link(trn.outputs[0], add.inputs[1])
    s2r = nb.n("ShaderNodeShaderToRGB")
    nb.link(add.outputs[0], s2r.inputs[0])
    Lv = nb.mapr(nb.bw(s2r.outputs["Color"]), 0.15, 5.0)          # bounded: a strike lights, never blows out
    Lv = nb.mul(nb.mul(Lv, nb.add(0.45, mid)), 0.42)
    lit = nb.mix(1.0, nb.n("ShaderNodeCombineColor", inputs={"Red": Lv, "Green": Lv, "Blue": Lv}).outputs[0],
                 (0.78, 0.86, 1.0), blend="MULTIPLY")
    col = nb.mix(1.0, base, lit, blend="ADD")
    # cold rim on the silhouettes (stronger on top edges), flaring with each strike
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    rim = nb.mapr(nb.add(lw.outputs["Facing"], nb.mul(nb.sub(sv, 0.5), 0.25)), 0.5, 0.92)
    rim = nb.mul(rim, nb.add(0.25, nb.math("MAXIMUM", up, 0.0)))
    rim = nb.mul(rim, nb.add(0.16, nb.mul(flash, 1.6)))
    rimc = nb.n("ShaderNodeRGB")
    rimc.outputs[0].default_value = (0.42, 0.5, 0.7, 1)
    col = nb.mix(rim, col, nb.mix(1.0, col, rimc.outputs[0], blend="ADD"))
    # the whole storm lit from inside during a strike (patchy)
    fl = nb.mul(flash, nb.add(0.05, nb.mul(big, 0.55)))
    flc = nb.n("ShaderNodeRGB")
    flc.outputs[0].default_value = (0.32, 0.36, 0.5, 1)
    col = nb.mix(nb.math("MINIMUM", fl, 1.0), col, nb.mix(1.0, col, flc.outputs[0], blend="ADD"))
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    # brushed, partly transparent silhouettes
    al = nb.mapr(nb.add(nb.add(lw.outputs["Facing"], nb.mul(nb.sub(sv, 0.5), 0.55)), nb.mul(nb.sub(mid, 0.5), 0.5)),
                 0.68, 0.97, 1.0, 0.0)
    trp = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", al)
    nb.link(trp.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "DITHERED"
    return m


def _seg_dist(p, A, B_):
    ab = B_ - A
    h = max(0.0, min(1.0, (p - A).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (A + ab * h)).length


def billow_heap(name, center, size, rng, collection, mat_, flat=0.3, n_core=(3, 6), n_billow=(22, 36), sub=3):
    """One storm-cloud heap as a cauliflower of overlapping billows (separate displaced spheres, so every bulge reads),
    with a flattened dark base. Returns (object, bounding radius)."""
    import bmesh
    C = Vector(center)
    bm = bmesh.new()
    spheres = []
    cores = []
    for _ in range(int(rng.integers(*n_core))):
        rr = rng.uniform(0.55, 1.0) * size
        p = C + Vector((rng.normal(0, 0.75 * size), rng.normal(0, 0.75 * size), rng.normal(0, 0.3 * size)))
        cores.append((p, rr))
        spheres.append((p, rr, sub))
    for _ in range(int(rng.integers(*n_billow))):
        p, rr = cores[int(rng.integers(0, len(cores)))]
        d = Vector(rng.normal(0, 1, 3))
        d.z = abs(d.z) * 1.1 + 0.25
        d.normalize()
        rb = rng.uniform(0.22, 0.48) * rr
        spheres.append((p + d * rr * rng.uniform(0.72, 0.95), rb, max(1, sub - 1)))
    for p, rr, sd in spheres:
        bmesh.ops.create_icosphere(bm, subdivisions=sd, radius=rr, matrix=Matrix.Translation(p))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    collection.objects.link(o)
    me.shade_smooth()
    geo.displace_noise(o, 0.12 * size, 0.55 * size, seed=int(rng.integers(0, 9999)))
    geo.displace_noise(o, 0.04 * size, 0.16 * size, seed=int(rng.integers(0, 9999)))
    base = C.z - flat * size
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    low = co[:, 2] < base
    co[low, 2] = base + (co[low, 2] - base) * 0.22
    me.vertices.foreach_set("co", co.ravel())
    me.update()
    me.materials.append(mat_)
    o.visible_shadow = False
    rad = max((p - C).length + rr for p, rr, _ in spheres)
    return o, rad


def storm_clouds(center, radius=60.0, n=26, seed=3, level_lo=-25.0, level_hi=25.0, collection=None, near=0.35,
                 size=1.0, avoid=(), f0=None, f1=None, drift=(0.0, 0.0, 0.0)):
    """Churning storm-cloud heaps around a point (the balloon in the storm): cauliflower heaps of billows, bigger and
    softer with distance. avoid: [(point, clearance)] or [(A, B, clearance)] (segments: camera paths, sight lines,
    the balloon's path) keep every heap clear of the action. With f0/f1 the heaps drift and turn slowly (boiling)."""
    col = collection or geo.coll("Storm")
    m = storm_material()
    bpy.context.scene["storm_flash"] = 0.0
    rng = np.random.default_rng(seed)
    C = Vector(center)
    objs = []
    for k in range(n):
        for _try in range(40):
            a = rng.uniform(0, 2 * math.pi)
            r = rng.uniform(radius * near, radius)
            z = rng.uniform(level_lo, level_hi)
            hc = Vector((C.x + r * math.cos(a), C.y + r * math.sin(a), C.z + z))
            sz = size * (7.0 + 9.0 * r / max(radius, 1e-3)) * rng.uniform(0.75, 1.2)
            ext = sz * 2.1
            ok = True
            for av in avoid:
                if len(av) == 2:
                    ok = ok and (hc - Vector(av[0])).length > av[1] + ext
                else:
                    ok = ok and _seg_dist(hc, Vector(av[0]), Vector(av[1])) > av[2] + ext
            if ok:
                break
        else:
            continue
        sub = 3 if r < radius * 0.6 else 2
        o, rad = billow_heap(f"StormHeap{k}", hc, sz, rng, col, m, sub=sub)
        if f0 is not None:
            o_rot = rng.uniform(-0.03, 0.03)
            dv = Vector(drift) + Vector(rng.normal(0, 0.25, 3))
            # origin at the heap centre so it turns in place
            o.data.transform(Matrix.Translation(-hc))
            for f in (f0, f1):
                t = (f - f0) / 24.0
                o.location = hc + dv * t
                o.rotation_euler = (0, 0, o_rot * t)
                o.keyframe_insert("location", frame=f)
                o.keyframe_insert("rotation_euler", frame=f)
        objs.append(o)
    return objs


def rain(center, size=(30, 30, 30), n=1400, f0=0, f1=100, speed=22.0, slant=(4.0, 2.0), seed=1, collection=None,
         length=0.6, width=0.006, strength=0.6, color=(0.55, 0.62, 0.75)):
    """Rain streaks: one mesh of thin quads, translated down and wrapped by keyframing two cycling copies."""
    col = collection or geo.coll("Storm")
    rng = np.random.default_rng(seed)
    verts, faces = [], []
    d = Vector((slant[0], slant[1], -speed)).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized() * width
    for i in range(n):
        p = Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(size)
        L = length * rng.uniform(0.6, 1.3)
        a, b = p, p + d * L
        k = len(verts)
        verts += [a - side, a + side, b + side, b - side]
        faces.append((k, k + 1, k + 2, k + 3))
    mname = f"Rain_{strength:.2f}"
    m = bpy.data.materials.get(mname) or mat.emissive(mname, color, strength)
    out = []
    for c in range(2):
        o = geo.obj_from(f"Rain{c}", verts, faces, col, m, smooth=False)
        o.visible_shadow = False
        H = size[2]
        cycle = H / speed
        for f in range(f0, f1 + 1):
            t = (f - f0) / 24 + c * cycle * 0.5
            u = (t % cycle) / cycle
            o.location = Vector(center) + Vector((slant[0], slant[1], -speed)) * (u * cycle) \
                - Vector((slant[0], slant[1], -speed)) * cycle * 0.5
            o.keyframe_insert("location", frame=f)
        out.append(o)
    return out


_FLASH = {}


def _bolt_path(rng, S0, E0, seg, jag):
    pts = [S0]
    for i in range(1, seg):
        u = i / seg
        pts.append(S0.lerp(E0, u) + Vector(rng.normal(0, jag, 3)) * (1 - abs(u - 0.5)) * 1.4)
    pts.append(E0)
    return pts


def lightning(name, start, end, t_flash, f0, branches=3, seed=0, flash_energy=60000.0, collection=None):
    """A jagged, forking emissive bolt visible for ~0.15 s around t_flash, a big flash light, and the scene-wide
    'storm_flash' value (cloud edges light up; double flicker)."""
    col = collection or geo.coll("Storm")
    rng = np.random.default_rng(seed)
    m = bpy.data.materials.get("Bolt") or mat.emissive("Bolt", (0.85, 0.9, 1.0), 40.0)
    S0, E0 = Vector(start), Vector(end)
    Ltot = (E0 - S0).length
    paths = [(_bolt_path(rng, S0, E0, 16, Ltot * 0.05), 0.14)]
    for bi in range(branches):
        main = paths[0][0]
        i0 = int(rng.integers(3, len(main) - 4))
        p0 = main[i0]
        dirv = (E0 - S0).normalized() + Vector(rng.normal(0, 0.7, 3))
        p1 = p0 + dirv.normalized() * Ltot * rng.uniform(0.2, 0.4)
        paths.append((_bolt_path(rng, p0, p1, 7, Ltot * 0.03), 0.07))
    parts = []
    for pts, rad in paths:
        for a, b in zip(pts[:-1], pts[1:]):
            d = b - a
            c = geo.lathe("bolt", [(rad, 0.0), (rad * 0.7, d.length)], seg=5, mat=m, cap_top=False, cap_bot=False)
            c.matrix_basis = Matrix.Translation(a) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
            parts.append(c)
    bolt = geo.join(parts, name)
    bolt.visible_shadow = False
    fa = f0 + int(t_flash * 24)
    for f in (fa - 1, fa, fa + 2, fa + 3, fa + 4):
        bolt.hide_render = not (fa <= f < fa + 4 and f != fa + 2)
        bolt.keyframe_insert("hide_render", frame=f)
    ld = bpy.data.lights.new(name + "_flash", "POINT")
    ld.color = (0.8, 0.85, 1.0)
    ld.shadow_soft_size = 3.0
    lo = bpy.data.objects.new(name + "_flash", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = S0.lerp(E0, 0.5)
    sc = bpy.context.scene
    for k in range(-2, 9):
        f = fa + k
        w = (max(0.0, 1 - k / 7.0) ** 2 if k >= 0 else 0.0)
        if k == 2:
            w *= 0.35     # double-flicker
        ld.energy = flash_energy * w + 0.01
        ld.keyframe_insert("energy", frame=f)
        _FLASH[f] = max(_FLASH.get(f, 0.0), w * min(1.5, flash_energy / 60000.0))
    for f in sorted(set(fr for fr in _FLASH if fa - 3 <= fr <= fa + 10)):
        sc["storm_flash"] = _FLASH[f]
        sc.keyframe_insert('["storm_flash"]', frame=f)
    return bolt, lo


def star_book(open_=True, page="page_comet"):
    """Open book: two slightly curved pages (left notes, right comet drawing) + cover. Origin at the spine."""
    pm = []
    for nm in ("page_notes", page):
        m = bpy.data.materials.get("Page_" + nm)
        if m is None:
            m = bpy.data.materials.new("Page_" + nm)
            m.use_nodes = True
            t = m.node_tree
            t.nodes.clear()
            nb = mat.NB(t)
            uv = nb.n("ShaderNodeUVMap")
            tx = nb.n("ShaderNodeTexImage", image=mat.image(nm, "sRGB"), interpolation="Cubic")
            nb.link(uv.outputs[0], tx.inputs[0])
            dif = nb.n("ShaderNodeBsdfDiffuse")
            nb.link(tx.outputs[0], dif.inputs["Color"])
            s2r = nb.n("ShaderNodeShaderToRGB")
            nb.link(dif.outputs[0], s2r.inputs[0])
            em = nb.n("ShaderNodeEmission")
            col = nb.mix(1.0, tx.outputs[0], nb.mix(1.0, s2r.outputs["Color"], (0.06, 0.05, 0.05), blend="ADD"), blend="MULTIPLY")
            nb.inp(em, "Color", col)
            out = nb.n("ShaderNodeOutputMaterial")
            nb.link(em.outputs[0], out.inputs[0])
        pm.append(m)
    pages = []
    W_, H_ = 0.24, 0.3
    for side, m in ((-1, pm[0]), (1, pm[1])):
        verts, faces, uvs = [], [], []
        nx = 10
        for j in range(2):
            for i in range(nx + 1):
                u = i / nx
                x = side * W_ * u
                z = 0.025 * math.sin(math.pi * u) + 0.01
                verts.append((x, (j - 0.5) * H_, z))
                uvs.append((u if side > 0 else 1 - u, j))
        for i in range(nx):
            faces.append((i, i + 1, nx + 1 + i + 1, nx + 1 + i))
        o = geo.obj_from("Page", verts, faces, None, m)
        uvl = o.data.uv_layers.new(name="UVMap")
        for li, loop in enumerate(o.data.loops):
            uvl.data[li].uv = uvs[loop.vertex_index]
        pages.append(o)
    cov = bpy.data.materials.get("BookBlue") or mat.painterly("BookBlue", (0.08, 0.13, 0.30))
    cover = geo.box("Cover", (0.5, 0.32, 0.012), loc=(0, 0, 0.0), mat=cov, bevel=0.004)
    return geo.join(pages + [cover], "StarBookOpen")


def scrap_telescope():
    """Coda: a home-made telescope — a wooden tube banded with salvaged brass and twine, on a little tripod."""
    wood = bpy.data.materials.get("IntWood") or mat.painterly("TeleWood", (0.45, 0.29, 0.17), stroke="strokes_horiz", scale=4)
    brass = bpy.data.materials.get("Brass") or mat.painterly("Brass", (0.62, 0.42, 0.16), spec=1.0, rough=0.22)
    root = bpy.data.objects.new("ScrapTelescope", None)
    bpy.context.scene.collection.objects.link(root)
    parts = []
    for i in range(3):
        a = 2 * math.pi * i / 3
        lg = geo.box("TL", (0.035, 0.035, 0.75), mat=wood)
        lg.location = (0.16 * math.cos(a), 0.16 * math.sin(a), 0.35)
        lg.rotation_euler = (math.radians(13) * math.sin(a), -math.radians(13) * math.cos(a), 0)
        parts.append(lg)
    tri = geo.join(parts, "ScrapTripod")
    tri.parent = root
    tube = geo.lathe("ScrapTube", [(0.0, -0.4), (0.045, -0.4), (0.05, 0.0), (0.06, 0.4), (0.0, 0.4)], seg=10, mat=wood)
    bands = [geo.lathe("Band", [(0.055, z - 0.02), (0.058, z + 0.02)], seg=16, mat=brass, cap_top=False, cap_bot=False)
             for z in (-0.3, 0.05, 0.35)]
    tj = geo.join([tube] + bands, "ScrapTube")
    tj.parent = root
    tj.location = (0, 0, 0.75)
    tj.rotation_euler = (math.radians(-50), 0, 0)
    return dict(root=root, tube=tj)


def patch_canvas():
    """Turn the windmill's canvases into mismatched patchwork (after the balloon): swap materials per face."""
    mats = canvas_mats()
    rng = np.random.default_rng(11)
    for k in range(4):
        cv = bpy.data.objects.get(f"Canvas{k}")
        if cv is None:
            continue
        me = cv.data
        me.materials.clear()
        for m in mats:
            me.materials.append(m)
        for p in me.polygons:
            c = p.center
            blk = int((c.z) / 1.3) * 3 + int(c.x / 0.6)
            r = (blk * 2654435761 + k * 97) % 100
            p.material_index = 3 + (r % 3) if r < 45 else (r % 3)
