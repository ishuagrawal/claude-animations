"""Mesh construction helpers (numpy -> bpy meshes)."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix


def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def obj_from(name, verts, faces, collection=None, mat=None, smooth=True, uv=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate()
    me.update()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def bm_to_obj(name, bm, collection=None, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def _band_samples(h, r, n_in, n_r):
    """Axis samples from -h..h: n_r samples (tan-spaced) inside each rounded band, n_in in between."""
    inner = np.linspace(-(h - r), h - r, n_in + 1)
    th = np.linspace(0, math.pi / 4, n_r + 1)[1:]
    band = (h - r) + r * np.tan(th)
    return np.concatenate([-band[::-1], inner, band])


def rounded_box(name, size, r, seg=(6, 6, 6), n_r=4, collection=None, mat=None, center=(0, 0, 0)):
    """Box of full size (sx, sy, sz) with rounded edges radius r. seg = inner segments per axis.
    Vertices are spread so the mesh deforms smoothly under armatures."""
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    r = min(r, hx * 0.99, hy * 0.99, hz * 0.99)
    ax = [_band_samples(hx, r, seg[0], n_r), _band_samples(hy, r, seg[1], n_r), _band_samples(hz, r, seg[2], n_r)]
    hs = [hx, hy, hz]
    bm = bmesh.new()
    vid = {}

    def vert(p):
        key = tuple(np.round(p, 6))
        v = vid.get(key)
        if v is None:
            v = bm.verts.new(p)
            vid[key] = v
        return v

    for axis in range(3):
        for sign in (-1, 1):
            a1, a2 = [i for i in range(3) if i != axis]
            A, B = ax[a1], ax[a2]
            grid = []
            for i in range(len(A)):
                row = []
                for j in range(len(B)):
                    p = [0.0, 0.0, 0.0]
                    p[axis] = sign * hs[axis]
                    p[a1] = A[i]
                    p[a2] = B[j]
                    row.append(vert(tuple(p)))
                grid.append(row)
            for i in range(len(A) - 1):
                for j in range(len(B) - 1):
                    q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                    # outward winding
                    n = Vector([0, 0, 0])
                    n[axis] = sign
                    e1 = Vector(q[1].co) - Vector(q[0].co)
                    e2 = Vector(q[3].co) - Vector(q[0].co)
                    if e1.cross(e2).dot(n) < 0:
                        q = q[::-1]
                    try:
                        bm.faces.new(q)
                    except ValueError:
                        pass
    # round
    inner = np.array([hx - r, hy - r, hz - r])
    for v in bm.verts:
        p = np.array(v.co)
        c = np.clip(p, -inner, inner)
        d = p - c
        L = np.linalg.norm(d)
        if L > 1e-9:
            v.co = Vector(c + d / L * r + np.array(center))
        else:
            v.co = Vector(p + np.array(center))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm_to_obj(name, bm, collection, mat)


def lathe(name, profile, seg=48, collection=None, mat=None, cap_top=True, cap_bot=True, smooth=True, jitter=0.0, seed=0):
    """Revolve profile [(radius, z), ...] (bottom to top) around Z."""
    rng = np.random.default_rng(seed)
    verts, faces = [], []
    n = len(profile)
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for (r, z) in profile:
            rr = r * (1 + (rng.normal(0, jitter) if jitter else 0))
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for i in range(seg):
        i2 = (i + 1) % seg
        for k in range(n - 1):
            faces.append((i * n + k, i2 * n + k, i2 * n + k + 1, i * n + k + 1))
    if cap_bot:
        verts.append((0, 0, profile[0][1]))
        c = len(verts) - 1
        for i in range(seg):
            faces.append((c, ((i + 1) % seg) * n, i * n))
    if cap_top:
        verts.append((0, 0, profile[-1][1]))
        c = len(verts) - 1
        for i in range(seg):
            faces.append((c, i * n + n - 1, ((i + 1) % seg) * n + n - 1))
    return obj_from(name, verts, faces, collection, mat, smooth)


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), collection=None, mat=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    ob = bm_to_obj(name, bm, collection, mat, smooth=bevel > 0)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def join(objs, name=None):
    """Merge unparented objects into one mesh whose origin is the world origin (identity transform), so
    every part keeps its placement and the result can then be moved/rotated as a unit. Single pass."""
    if len(objs) == 1:
        o = objs[0]
        o.data.transform(o.matrix_basis)
        o.matrix_basis = Matrix.Identity(4)
        if name:
            o.name = name
        return o
    base = objs[0]
    mats_ = []
    bm = bmesh.new()
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_basis)   # world matrices are stale until a depsgraph update; basis is current
        remap = []
        for m in me.materials:
            if m not in mats_:
                mats_.append(m)
            remap.append(mats_.index(m))
        if remap:
            for p in me.polygons:
                p.material_index = remap[p.material_index] if p.material_index < len(remap) else 0
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    newme = bpy.data.meshes.new((name or base.name) + "_m")
    bm.to_mesh(newme)
    bm.free()
    for m in mats_:
        newme.materials.append(m)
    # keep smooth/flat flags from the source polygons (from_mesh preserves them)
    ob = bpy.data.objects.new(name or base.name, newme)
    cols = base.users_collection
    for c in cols:
        c.objects.link(ob)
    for o in objs:
        old = o.data
        bpy.data.objects.remove(o)
        if old.users == 0:
            bpy.data.meshes.remove(old)
    if name:
        ob.name = name
    return ob


def displace_noise(ob, amount, scale, seed=0, axis_mask=(1, 1, 1)):
    """Cheap deterministic vertex displacement along normals using sum of sines (no Blender textures)."""
    me = ob.data
    rng = np.random.default_rng(seed)
    k = rng.normal(0, 1, (6, 3)) / scale
    ph = rng.random(6) * 6.28
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    nrm = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(-1, 3)
    d = np.zeros(len(co))
    for i in range(6):
        d += np.sin(co @ k[i] + ph[i]) / (i + 1)
    d *= amount / 1.6
    co += nrm * d[:, None] * np.array(axis_mask)
    me.vertices.foreach_set("co", co.ravel())
    me.update()


def set_custom_normals_from_center(ob, center):
    """Foliage trick: normals point away from a volume center so card clusters shade like a soft mass."""
    me = ob.data
    c = Vector(center)
    nrms = []
    for loop in me.loops:
        v = me.vertices[loop.vertex_index].co
        n = (v - c)
        nrms.append(n.normalized() if n.length > 1e-6 else Vector((0, 0, 1)))
    me.normals_split_custom_set(nrms)
