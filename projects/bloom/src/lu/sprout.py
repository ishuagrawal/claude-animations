"""The Sprout: the old tree's last seed, alive. An acorn whose shell cracks open on an emerald glow; out of it a jade
bulb of a head (two tiny glossy dot eyes, a hint of a mouth, the acorn cap riding on top like a hat) rises on a curled
stem that unfurls; two leaves are its arms. It grows continuously from seed to a 0.6 m sapling (`grow` 0..3); the great
blossoming tree of the coda is a separate builder (great_tree), with a swing (swing).

Units: metres. Origin = the soil/ground point under the seed. Faces -Y; its LEFT is +X (like Claude).
Sizes: seed 0.046 tall; grow 1 (sprout, 2 leaves) ~0.10; grow 2 (bigger, 6 leaves) ~0.19; grow 3 (sapling) ~0.60.
It is a practical light: a point light in the head (and a soft halo) whose brightness is `glow` and whose colour is
`health` (dim grey-green .. brilliant emerald). Leaves and head colour follow health too (limp grey-olive when dying).

POSE CHANNELS (pose dict; missing keys = DEFAULT)
  root     x, y, z, heading (0 = faces -Y), pitch (+ tips forward), roll (+ toward its left), scale
  growth   grow (0 seed .. 1 sprout with two leaves .. 2 bigger, 6 leaves .. 3 sapling ~0.6 m), crack (0..1: glowing
           cracks spread over the shell, then the halves fall open), unfurl (0 = stem hooked, head bowed .. 1 upright),
           leaf_open (0 = leaves folded up against the head like a bud .. 1 open), hat (0..1 acorn-cap hat visible),
           hat_tilt (deg), clod (0..1 a clump of ash/soil round the base, for carrying)
  body     lean (+ forward), side (+ toward its left), bend (curl of the upper stem), droop (0..1 wilt: the stem
           arcs over), squash (-0.3..0.3), head_nod (+ face down), head_tilt (+ toward its left), head_turn (+ left)
  leaves   leafL_reach / leafR_reach (deg: + up and forward), leafL_curl / leafR_curl (-1..1: + the blade curls
           round something (a finger), - flares back), leafL_droop / leafR_droop (0..1 limp)
  face     eye_open (0..1.2), eyeL_open / eyeR_open (offsets), eye_happy (0..1 '^ ^'), look_x (+ toward its left),
           look_y (+ up), pupil (dot size 0.7..1.3), mouth (-1 frown .. 0 none .. 1 smile), blush (0..1)
  light    glow (0..3 brightness of glow + light), health (0..1 colour of glow, leaves and head)

API  s = Sprout(name, collection=None, light=True) ; s.apply(pose) ; s.key(frame) ; s.bake(fn, f0, f1)
     s.point(where) -> world Vector ('head', 'face', 'leafL_tip', 'leafR_tip', 'base', 'top')
     s.attach(obj, where, at=None, pose=None)       parent a prop to the sprout
     s.ride(claude, where='cradle'|'palmL'|'palmR')  carry it on Claude (pose x/y/z/heading become local offsets)
     s.reach_leaf(side, world_target, pose, mode='tip'|'wrap') -> leaf channels (touch a cheek / curl round a finger)
     great_tree(name, base, height=7.5, swing_dir, seed, ground_fn=None) -> dict (swing_point, swing_length, ...)
     swing(name, hang_point, length) -> dict ; sit_on(claude, swing) -> pose offsets ; rock_swing(swing, f0, f1)
     falling_petals(name, center, radius, top, bottom)   (scene-time GN; great_tree adds them by default)
Presets and layers (S_SEED, S_SPROUT, S_SHY, S_HAPPY, S_WILT, S_CURL_FINGER, S_TOUCH, S_DRINK, sprout_shiver, ...)
live in acting.py.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

from . import geo, mat, charmat

DEFAULT = dict(
    x=0.0, y=0.0, z=0.0, heading=0.0, pitch=0.0, roll=0.0, scale=1.0,
    grow=1.0, crack=1.0, unfurl=1.0, leaf_open=1.0, hat=1.0, hat_tilt=14.0, clod=0.0,
    lean=0.0, side=0.0, bend=0.0, droop=0.0, squash=0.0, head_nod=0.0, head_tilt=0.0, head_turn=0.0,
    leafL_reach=0.0, leafL_curl=0.0, leafL_droop=0.0, leafR_reach=0.0, leafR_curl=0.0, leafR_droop=0.0,
    eye_open=1.0, eyeL_open=0.0, eyeR_open=0.0, eye_happy=0.0, look_x=0.0, look_y=0.0, pupil=1.0,
    mouth=0.25, blush=0.0,
    glow=1.0, health=1.0,
)

# ---------------------------------------------------------------- dimensions (rest = grow 1)
STEM_Z0 = 0.012                 # stem base (inside the shell)
N_STEM = 5
SEG = 0.02                      # rest bone length (rest stem 0.10)
STEM_R = 0.0055                 # rest stem radius at the base
RH0 = 0.020                     # rest head radius
LEAF0 = 0.016                   # rest leaf segment length (3 segments)
NUT_H, NUT_R = 0.040, 0.0175
GLOW_DIM = (0.30, 0.40, 0.26)
GLOW_HOT = (0.16, 1.00, 0.36)
LEAF_DIM = (0.20, 0.21, 0.12)
LEAF_HOT = (0.13, 0.50, 0.09)
LIGHT_E = 1.3                   # W at glow 1
LIGHT_REACH = 2.5

# growth tables (grow = 0, 1, 2, 3)
_G = np.array([0.0, 1.0, 2.0, 3.0])
_L = np.array([0.004, 0.055, 0.13, 0.50])        # stem length
_RS = np.array([0.6, 1.0, 1.45, 4.4])            # stem base thickness scale (sapling: a sturdy ~5 cm trunk, tapering)
_RH = np.array([0.0125, 0.020, 0.026, 0.064])    # head radius
_LF = np.array([0.35, 1.0, 1.35, 4.3])           # arm-leaf size scale (sapling arms ~0.2 m: a hug)


def _gi(tab, g):
    return float(np.interp(min(max(g, 0.0), 3.0), _G, tab))


def _ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- materials
def _jade_mat(name):
    """The head: a translucent jade bulb with an inner emerald glow (glow x health), painterly-lit by the scene, with
    a small drawn mouth and blush (object coords: origin = head centre, front = -Y)."""
    m, nb = charmat._new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    glow, health = nb.prop("glow"), nb.prop("health")
    mouth, blush = nb.prop("mouth"), nb.prop("blush")
    co = nb.n("ShaderNodeTexCoord").outputs["Object"]
    px, py, pz = nb.xyz(co)
    st = mat.tex_node(nb, "strokes_soft", co, 40.0)
    s_val = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    dim, hot = nb.rgb((0.30, 0.34, 0.24)), nb.rgb((0.20, 0.62, 0.26))
    alb = nb.mix(health, dim, hot)
    # pale vein lines (a cotyledon seam over the crown)
    seam = nb.mul(nb.ss(0.0016, 0.0004, nb.abs(px)), nb.ss(-0.002, 0.012, pz))
    alb = nb.mix(nb.mul(seam, 0.35), alb, nb.rgb((0.55, 0.80, 0.45)))
    # mouth: a tiny arc below the eyes; blush ovals
    u = nb.div(px, 0.0052)
    v = nb.div(nb.add(pz, 0.0058), 0.0052)
    yc = nb.mul(mouth, nb.mul(0.55, nb.sub(nb.sq(u), 0.35)))
    mline = nb.mul(nb.mul(nb.ss(0.16, 0.08, nb.abs(nb.sub(v, yc))), nb.ss(1.05, 0.85, nb.abs(u))),
                   nb.ss(0.05, 0.15, nb.abs(mouth)))
    front = nb.ss(-0.010, -0.016, py)
    mline = nb.mul(mline, front)
    alb = nb.mix(nb.mul(mline, 0.9), alb, nb.rgb((0.02, 0.06, 0.03)))
    bd = nb.sqrt(nb.add(nb.sq(nb.div(nb.sub(nb.abs(px), 0.0115), 0.0042)), nb.sq(nb.div(nb.add(pz, 0.0035), 0.0028))))
    bl = nb.mul(nb.mul(nb.ss(1.0, 0.3, bd), blush), front)
    alb = nb.mix(nb.mul(bl, 0.55), alb, nb.rgb((0.95, 0.42, 0.40)))
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    light, E, lit_f = charmat._paint_light(nb, look, nrm, s_val, ao=0.0, front_fill=0.6, brand=nb.val(0.2))
    col = nb.cmulc(alb, light)
    # inner glow: brighter in the body of the bulb (facing), a rim of light at the edges (subsurface feel)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    fac = lw.outputs["Facing"]
    gcol = nb.mix(health, nb.rgb(GLOW_DIM), nb.rgb(GLOW_HOT))
    inner = nb.add(nb.mul(nb.sub(1.0, fac), 0.85), nb.mul(fac, 0.45))
    inner = nb.mul(inner, nb.add(0.85, nb.mul(nb.sub(s_val, 0.5), 0.6)))
    em = nb.mul(nb.mul(glow, inner), nb.lerp(health, 0.25, 1.0))
    col = nb.cadd(nb.cmul(col, nb.sub(1.0, nb.mul(nb.c01(nb.mul(glow, 0.5)), 0.25))),
                  nb.cmul(gcol, nb.mul(em, 0.32)))
    col = nb.mix(nb.mul(mline, 0.9), col, nb.cmul(nb.rgb((0.02, 0.05, 0.03)), nb.add(nb.bw(light), 0.1)))
    S = charmat._gloss(nb, nrm, 0.18)
    col = nb.cadd(col, nb.cmul(S, nb.mul(nb.ss(0.5, 0.8, nb.add(nb.bw(S), nb.mul(nb.sub(s_val, 0.5), 0.4))), 0.35)))
    nb.emission_out(col)
    return m


def _leaf_mat(name):
    """Leaves: fresh painterly green with a pale midrib and side veins, translucent when backlit, a faint emerald
    glow in the veins (glow x health); limp grey-olive when health drops. UV: u along the blade, v across."""
    m, nb = charmat._new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    glow, health = nb.prop("glow"), nb.prop("health")
    uvn = nb.n("ShaderNodeUVMap")
    uu, vv, _ = nb.xyz(uvn.outputs[0])
    co = nb.gattr("rest", "Vector")
    st = mat.tex_node(nb, "strokes_fine", co, 60.0)
    s_val = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    base = nb.mix(health, nb.rgb(LEAF_DIM), nb.rgb(LEAF_HOT))
    tipc = nb.mix(health, nb.rgb((0.28, 0.26, 0.12)), nb.rgb((0.32, 0.62, 0.12)))
    alb = nb.mix(nb.ss(0.2, 1.0, uu), base, tipc)
    av = nb.abs(nb.sub(vv, 0.5))
    rib = nb.ss(0.035, 0.012, av)
    vein = nb.mul(nb.ss(0.10, 0.02, nb.abs(nb.sub(nb.math("FRACT", nb.add(nb.mul(uu, 5.5), nb.mul(av, 7.0))), 0.5))),
                  nb.ss(0.48, 0.2, av))
    vein = nb.mul(vein, 0.5)
    vm = nb.mx(rib, vein)
    alb = nb.mix(nb.mul(vm, 0.55), alb, nb.mix(health, nb.rgb((0.42, 0.42, 0.28)), nb.rgb((0.60, 0.85, 0.40))))
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    dif = nb.n("ShaderNodeBsdfTranslucent", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    trans = s2.outputs["Color"]
    light, E, lit_f = charmat._paint_light(nb, look, nrm, s_val, ao=0.2, front_fill=0.5, brand=nb.val(0.15))
    light = nb.cadd(light, nb.cmul(trans, 0.45))
    col = nb.cmulc(alb, light)
    gcol = nb.mix(health, nb.rgb(GLOW_DIM), nb.rgb(GLOW_HOT))
    col = nb.cadd(col, nb.cmul(gcol, nb.mul(nb.mul(glow, nb.add(0.06, nb.mul(vm, 0.25))), health)))
    S = charmat._gloss(nb, nrm, 0.25)
    col = nb.cadd(col, nb.cmul(S, nb.mul(nb.ss(0.5, 0.8, nb.add(nb.bw(S), nb.mul(nb.sub(s_val, 0.5), 0.5))), 0.25)))
    nb.emission_out(col)
    m.use_backface_culling = False
    return m


def _stem_mat(name):
    """Stem: tender pale green near the head turning to woody brown at the base as it grows (rest z based)."""
    m, nb = charmat._new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    glow, health, wood = nb.prop("glow"), nb.prop("health"), nb.prop("wood")
    co = nb.gattr("rest", "Vector")
    _, _, rz = nb.xyz(co)
    st = mat.tex_node(nb, "strokes_vert", co, 90.0)
    s_val = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    green = nb.mix(health, nb.rgb((0.30, 0.32, 0.20)), nb.rgb((0.30, 0.60, 0.20)))
    bark = nb.rgb((0.24, 0.15, 0.09))
    woodm = nb.mul(wood, nb.ss(0.10, 0.03, rz))
    alb = nb.mix(woodm, green, bark)
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    light, E, lit_f = charmat._paint_light(nb, look, nrm, s_val, ao=0.0, front_fill=0.5, brand=nb.val(0.15))
    col = nb.cmulc(alb, light)
    gcol = nb.mix(health, nb.rgb(GLOW_DIM), nb.rgb(GLOW_HOT))
    col = nb.cadd(col, nb.cmul(gcol, nb.mul(nb.mul(glow, 0.10), nb.sub(1.0, woodm))))
    nb.emission_out(col)
    return m


def _shell_mat(name):
    """Acorn shell: glossy chestnut with darker vertical streaks; glowing emerald cracks spread with 'crack'."""
    m, nb = charmat._new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    glow, health, crack = nb.prop("glow"), nb.prop("health"), nb.prop("crack")
    co = nb.gattr("rest", "Vector")
    cx, cy, cz = nb.xyz(co)
    st = mat.tex_node(nb, "strokes_vert", co, 70.0)
    s_val = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    alb = nb.mix(nb.ss(0.35, 0.75, s_val), nb.rgb((0.20, 0.085, 0.035)), nb.rgb((0.36, 0.17, 0.07)))
    tip = nb.ss(0.006, 0.0, cz)
    alb = nb.mix(tip, alb, nb.rgb((0.10, 0.06, 0.04)))
    # crack network: the zigzag split line (x = zig(z)) first, then branches spreading as crack rises
    zig = nb.mul(0.0024, nb.math("SINE", nb.mul(cz, 520.0)))
    split = nb.ss(0.0016, 0.0003, nb.abs(nb.sub(cx, zig)))
    split = nb.mul(split, nb.ss(0.0, 0.25, crack))
    vc = nb.vor(co, 140.0, "DISTANCE_TO_EDGE")
    net = nb.mul(nb.ss(0.028, 0.008, vc), nb.ss(nb.mul(crack, 0.009), nb.sub(nb.mul(crack, 0.009), 0.003),
                                              nb.abs(nb.sub(cx, zig))))
    net = nb.mul(net, nb.mul(nb.ss(0.15, 0.5, crack), nb.ss(0.45, 0.6, nb.noise(co, 180.0, 2.0))))
    cr = nb.mx(split, net)
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    light, E, lit_f = charmat._paint_light(nb, look, nrm, s_val, ao=0.2, front_fill=0.6, brand=nb.val(0.0))
    col = nb.cmulc(alb, light)
    S = charmat._gloss(nb, nrm, 0.12)
    col = nb.cadd(col, nb.cmul(S, nb.mul(nb.ss(0.45, 0.75, nb.add(nb.bw(S), nb.mul(nb.sub(s_val, 0.5), 0.6))), 0.6)))
    gcol = nb.mix(health, nb.rgb(GLOW_DIM), nb.rgb(GLOW_HOT))
    # a faint glow seeps through the whole shell, the cracks blaze
    col = nb.cadd(col, nb.cmul(gcol, nb.mul(glow, nb.add(nb.mul(cr, 2.2), 0.012))))
    nb.emission_out(col)
    return m


def _cap_mat(name):
    m, nb = charmat._new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    co = nb.gattr("rest", "Vector")
    cell = nb.vor(co, 900.0, "F1", "Distance")
    edge = nb.vor(co, 900.0, "DISTANCE_TO_EDGE")
    alb = nb.mix(nb.ss(0.05, 0.25, edge), nb.rgb((0.10, 0.07, 0.035)), nb.rgb((0.36, 0.27, 0.15)))
    alb = nb.cmul(alb, nb.add(0.8, nb.mul(nb.noise(co, 300.0), 0.4)))
    bmp = nb.n("ShaderNodeBump", inputs={"Strength": 0.5, "Distance": 0.001})
    nb.inp(bmp, "Height", nb.ss(0.0, 0.3, edge))
    nrm = bmp.outputs[0]
    light, E, lit_f = charmat._paint_light(nb, look, nrm, nb.val(0.5), ao=0.3, front_fill=0.6, brand=nb.val(0.0))
    nb.emission_out(nb.cmulc(alb, light))
    return m


def _eye_mat(name):
    """Tiny glossy black dot eyes with a crisp painted catch-light (camera space) + real reflections."""
    m, nb = charmat._new(name)
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    S = charmat._gloss(nb, nrm, 0.05)
    vt = nb.n("ShaderNodeVectorTransform", vector_type="NORMAL", convert_from="WORLD", convert_to="CAMERA")
    nb.inp(vt, "Vector", nrm)
    nx, ny, nz = nb.xyz(vt.outputs[0])
    d1 = nb.sqrt(nb.add(nb.sq(nb.sub(nx, -0.35)), nb.sq(nb.sub(ny, 0.42))))
    d2 = nb.sqrt(nb.add(nb.sq(nb.sub(nx, 0.30)), nb.sq(nb.sub(ny, -0.35))))
    hl = nb.add(nb.ss(0.30, 0.20, d1), nb.mul(nb.ss(0.16, 0.10, d2), 0.6))
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    L = nb.add(0.45, nb.math("POWER", nb.mx(nb.bw(s2.outputs["Color"]), 0.0), 0.5))
    col = nb.cadd(nb.cadd(nb.rgb((0.008, 0.01, 0.01)), nb.cmul(S, 0.12)), nb.cmul(nb.rgb((1, 1, 1)), nb.mul(hl, L)))
    nb.emission_out(col)
    return m


def _halo_mat(name):
    """Soft additive glow halo (a sphere: bright through its middle, fading to the silhouette)."""
    m, nb = charmat._new(name)
    glow, health = nb.prop("glow"), nb.prop("health")
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    fac = nb.sub(1.0, lw.outputs["Facing"])
    inten = nb.mul(nb.math("POWER", fac, 4.0), nb.mul(nb.math("POWER", nb.mx(glow, 0.0), 1.4), 0.16))
    inten = nb.mul(inten, nb.lerp(health, 0.25, 1.0))
    gcol = nb.mix(health, nb.rgb(GLOW_DIM), nb.rgb(GLOW_HOT))
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", gcol)
    nb.inp(em, "Strength", inten)
    tr = nb.n("ShaderNodeBsdfTransparent")
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(add.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


# ---------------------------------------------------------------- meshes
def _rest(ob):
    me = ob.data
    att = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    att.data.foreach_set("vector", co)


def _uv_sphere(name, r, col, m, nu=32, nv=18, sz=1.0, center=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=nu, v_segments=nv, radius=r)
    for v in bm.verts:
        v.co.z *= sz
        v.co += Vector(center)
    return geo.bm_to_obj(name, bm, col, m)


def _leaf_mesh(name, length, width, col, m, nu=14, nv=7, fold=0.25, cup=0.12, side=1.0, curve=0.0):
    """Leaf blade along +X (local), lying in XY with its face up (+Z); petiole first 12%. UV u along, v across."""
    verts, uvs, faces = [], [], []
    for i in range(nu + 1):
        t = i / nu
        if t < 0.12:
            w = width * 0.06
        else:
            tt = (t - 0.12) / 0.88
            w = width * (math.sin(math.pi * tt) ** 0.75) * (1 - 0.25 * tt) + width * 0.02
        for j in range(nv + 1):
            s = j / nv - 0.5
            x = t * length
            y = s * w * 2
            z = fold * abs(y) + cup * (y * y) / max(width, 1e-4) - curve * (t ** 2) * length
            verts.append((x * side, y, z))
            uvs.append((t, j / nv))
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            faces.append((a, a + nv + 1, a + nv + 2, a + 1) if side > 0 else (a, a + 1, a + nv + 2, a + nv + 1))
    ob = geo.obj_from(name, verts, faces, col, m)
    uvl = ob.data.uv_layers.new(name="UVMap")
    for li, loop in enumerate(ob.data.loops):
        uvl.data[li].uv = uvs[loop.vertex_index]
    return ob


def _tube(name, pts, radii, col, m, n=10):
    """Tube along points (list of Vector) with radii."""
    verts, faces = [], []
    P = [Vector(p) for p in pts]
    for i, p in enumerate(P):
        d = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        a = d.orthogonal().normalized()
        b = d.cross(a).normalized()
        for k in range(n):
            th = 2 * math.pi * k / n
            verts.append(tuple(p + (a * math.cos(th) + b * math.sin(th)) * radii[i]))
    for i in range(len(P) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((i * n + k, i * n + k2, (i + 1) * n + k2, (i + 1) * n + k))
    verts.append(tuple(P[0]))
    verts.append(tuple(P[-1]))
    c0, c1 = len(verts) - 2, len(verts) - 1
    o = (len(P) - 1) * n
    for k in range(n):
        faces.append((c0, (k + 1) % n, k))
        faces.append((c1, o + k, o + (k + 1) % n))
    ob = geo.obj_from(name, verts, faces, col, m)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


# ---------------------------------------------------------------- the character
class Sprout:
    def __init__(self, name="Sprout", collection=None, light=True):
        self.name = name
        col = collection or geo.coll(name)
        self.col = col
        self.m_jade = _jade_mat(f"{name}_jade")
        self.m_leaf = _leaf_mat(f"{name}_leaf")
        self.m_stem = _stem_mat(f"{name}_stem")
        self.m_shell = _shell_mat(f"{name}_shell")
        self.m_cap = _cap_mat(f"{name}_cap")
        self.m_eye = _eye_mat(f"{name}_eye")
        self.m_halo = _halo_mat(f"{name}_halo")
        self.m_clod = mat.painterly(f"{name}_clod", (0.13, 0.115, 0.105), stroke="strokes_fine", scale=40.0,
                                    tex_amt=1.0, color2=(0.42, 0.40, 0.38), c2_scale=0.3)
        # ---------------- armature
        ad = bpy.data.armatures.new(name + "_rig")
        rig = bpy.data.objects.new(name, ad)
        col.objects.link(rig)
        self.rig = rig
        self.PROPS = ("glow", "health", "crack", "wood", "mouth", "blush", "_light_e", "_light_r", "_light_g",
                      "_light_b", "_eyeL_happy", "_eyeR_happy")
        for k in self.PROPS:
            rig[k] = 1.0
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        eb = ad.edit_bones
        V = Vector

        def bone(n, h, t, parent=None, connect=False, seg=1, inherit="FULL", deform=True):
            b = eb.new(n)
            b.head, b.tail = V(h), V(t)
            b.roll = 0.0
            b.use_deform = deform
            if parent:
                b.parent = eb[parent]
                b.use_connect = connect
            b.inherit_scale = inherit
            b.bbone_segments = seg
            return b

        bone("base", (0, 0, 0), (0, 0, 0.01), deform=False)
        z = STEM_Z0
        prev = "base"
        for i in range(N_STEM):
            bone(f"stem{i}", (0, 0, z), (0, 0, z + SEG), prev, connect=i > 0, seg=4, inherit="NONE")
            prev = f"stem{i}"
            z += SEG
        ztop = z
        bone("head", (0, 0, ztop), (0, 0, ztop + 0.02), "stem4", connect=True, inherit="NONE", deform=False)
        hc = V((0, 0, ztop + RH0 * 0.6))
        self.head_c = hc
        for s, sx in (("L", 1), ("R", -1)):
            bone(f"eye{s}", hc, hc + V((0, -0.01, 0)), "head", deform=False)
            a = V((sx * 0.003, -0.001, ztop - 0.011))
            bone(f"leaf{s}0", a, a + V((sx * LEAF0, 0, 0)), "stem4", inherit="NONE")
            bone(f"leaf{s}1", a + V((sx * LEAF0, 0, 0)), a + V((sx * 2 * LEAF0, 0, 0)), f"leaf{s}0", connect=True)
            bone(f"leaf{s}2", a + V((sx * 2 * LEAF0, 0, 0)), a + V((sx * 3 * LEAF0, 0, 0)), f"leaf{s}1", connect=True)
            bone(f"shell{s}", (sx * 0.004, 0, 0.004), (sx * 0.004, 0, 0.014), "base", deform=False)
        bone("cap", hc + V((0, 0, RH0 * 0.55)), hc + V((0, 0, RH0 * 0.55 + 0.01)), "head", deform=False)
        # extra leaf pairs (stage 2) and sapling branches (stage 3)
        self.extra = []
        for (bn, parent, az, el, zf) in (("leafB0", "stem2", 140, 35, 0.6), ("leafB1", "stem2", -140, 35, 0.6),
                                         ("leafC0", "stem1", 70, 25, 0.4), ("leafC1", "stem1", -70, 25, 0.4)):
            pz = STEM_Z0 + SEG * (int(parent[-1]) + zf)
            d = V((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
            bone(bn, (0, 0, pz), V((0, 0, pz)) + d * 0.02, parent, inherit="NONE", deform=False)
            self.extra.append((bn, az, el))
        self.branches = []
        for (bn, parent, az, el, ln, zf) in (("br0", "stem1", 125, 18, 0.21, 0.5), ("br1", "stem2", -120, 22, 0.20, 0.3),
                                             ("br2", "stem2", 40, 26, 0.19, 0.9), ("br3", "stem3", -35, 30, 0.18, 0.6)):
            pz = STEM_Z0 + SEG * (int(parent[-1]) + zf)
            d = V((math.sin(math.radians(az)), -math.cos(math.radians(az)), 0))
            bone(bn, (0, 0, pz), V((0, 0, pz)) + d * 0.02, parent, inherit="NONE", deform=False)
            self.branches.append((bn, az, el, ln))
        bone("clod", (0, 0, 0.0), (0, 0, 0.01), "base", deform=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        self.rest = {b.name: b.matrix_local.copy() for b in ad.bones}
        self.rest3 = {k: v.to_3x3() for k, v in self.rest.items()}
        self.rest3i = {k: v.inverted() for k, v in self.rest3.items()}
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
        # ---------------- meshes
        parts = []
        # stem tube (skinned to the stem chain)
        nz = 26
        pts = [V((0, 0, STEM_Z0 - 0.004 + (N_STEM * SEG + 0.008) * k / (nz - 1))) for k in range(nz)]
        radii = [STEM_R * (1 - 0.25 * k / (nz - 1)) for k in range(nz)]
        stem = _tube(f"{name}_stem", pts, radii, col, self.m_stem, n=10)
        _rest(stem)
        for i in range(N_STEM):
            stem.vertex_groups.new(name=f"stem{i}")
        for v in stem.data.vertices:
            f = (v.co.z - STEM_Z0) / SEG - 0.5
            i0 = int(math.floor(f))
            t = f - i0
            for i, w in ((i0, 1 - t), (i0 + 1, t)):
                i = min(max(i, 0), N_STEM - 1)
                stem.vertex_groups[f"stem{i}"].add([v.index], w, "ADD")
        parts.append(stem)
        self.stem = stem
        # arm leaves (skinned to 3-bone chains)
        self.leaves = []
        for s, sx in (("L", 1), ("R", -1)):
            lf = _leaf_mesh(f"{name}_leaf{s}", 3 * LEAF0, 0.0165, col, self.m_leaf, side=sx, fold=0.18, cup=0.14)
            a = V((sx * 0.003, -0.001, ztop - 0.011))
            lf.data.transform(Matrix.Translation(a))
            _rest(lf)
            for k in range(3):
                lf.vertex_groups.new(name=f"leaf{s}{k}")
            for v in lf.data.vertices:
                f = abs(v.co.x - a.x) / LEAF0 - 0.5
                i0 = int(math.floor(f))
                t = f - i0
                for i, w in ((i0, 1 - t), (i0 + 1, t)):
                    i = min(max(i, 0), 2)
                    lf.vertex_groups[f"leaf{s}{i}"].add([v.index], w, "ADD")
            parts.append(lf)
            self.leaves.append(lf)
        for p in parts:
            p.parent = rig
            md = p.modifiers.new("rig", "ARMATURE")
            md.object = rig
        # head, eyes, cap, extra leaves, branches, shell, clod: bone-parented
        head = _uv_sphere(f"{name}_head", RH0, col, self.m_jade, sz=0.92)
        bm = bmesh.new()
        bm.from_mesh(head.data)
        for v in bm.verts:   # a bean: slightly fuller at the bottom, a soft crease on the crown
            v.co.x *= 1.0 + 0.06 * max(0.0, -v.co.z / RH0)
            v.co.z -= 0.0015 * max(0.0, v.co.z / RH0) * math.exp(-(v.co.x / 0.004) ** 2)
        bm.to_mesh(head.data)
        bm.free()
        self._bp(head, "head", Matrix.Translation(hc))
        self.head = head
        self.eyes = []
        for s, sx in (("L", 1), ("R", -1)):
            e = _uv_sphere(f"{name}_eye{s}", 0.0036, col, self.m_eye, nu=16, nv=10)
            me = e.data
            # flatten against the head surface, then place on it
            az, el = math.radians(22 * sx), math.radians(6)
            dirv = V((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
            R = dirv.to_track_quat("-Y", "Z").to_matrix()
            base_co = [v.co.copy() for v in me.vertices]
            for v, c in zip(me.vertices, base_co):
                c2 = V((c.x * 0.95, c.y * 0.45, c.z * 1.25))
                v.co = R @ c2 + dirv * (RH0 * 0.985)
            e.shape_key_add(name="Basis")
            sk = e.shape_key_add(name="happy")
            for i, c in enumerate(base_co):
                x = c.x * 1.3
                zz = c.z * 0.32 + 0.0028 * (1 - min(1.0, (c.x / 0.0036) ** 2)) - 0.0012
                sk.data[i].co = R @ V((x, c.y * 0.45, zz)) + dirv * (RH0 * 0.985)
            self._bp(e, f"eye{s}", Matrix.Translation(hc))
            charmat.drive(e.data.shape_keys, 'key_blocks["happy"].value', rig, f"_eye{s}_happy")
            self.eyes.append(e)
        cap = geo.lathe(f"{name}_cap", [(0.0, -0.0060), (0.0150, -0.0058), (0.0195, -0.0035), (0.0205, 0.0005),
                                         (0.0185, 0.0035), (0.012, 0.0058), (0.004, 0.0066), (0.0012, 0.0068),
                                         (0.0012, 0.0115), (0.0, 0.012)], seg=40, collection=col, mat=self.m_cap)
        _rest(cap)
        self._bp(cap, "cap", Matrix.Translation(hc + V((0, 0, RH0 * 0.55))))
        self.cap = cap
        # shell halves: an acorn nut split along a zigzag
        prof = []
        for k in range(22):
            zz = 0.0375 * k / 21
            u = zz / 0.0375
            rr = NUT_R * (math.sin(min(1.0, u / 0.55) * math.pi / 2) ** 0.75) * (1 - 0.16 * max(0.0, (u - 0.55) / 0.45) ** 1.5)
            prof.append((max(rr, 0.0), zz))
        prof[0] = (0.0, 0.0)
        nut = geo.lathe(f"{name}_nut", prof, seg=56, collection=col, mat=self.m_shell, cap_top=False)
        _rest(nut)
        bm = bmesh.new()
        bm.from_mesh(nut.data)
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-0.0012)
        left, right = [], []
        for f in bm.faces:
            c = f.calc_center_median()
            zig = 0.0024 * math.sin(c.z * 520.0)
            (left if c.x - zig > 0 else right).append(f)
        meL, meR = bpy.data.meshes.new(f"{name}_shellL"), bpy.data.meshes.new(f"{name}_shellR")
        for faces_, me_ in ((right, meR), (left, meL)):
            b2 = bm.copy()
            keep = {tuple(np.round(f.calc_center_median(), 6)) for f in faces_}
            rm = [f for f in b2.faces if tuple(np.round(f.calc_center_median(), 6)) not in keep]
            bmesh.ops.delete(b2, geom=rm, context="FACES")
            b2.to_mesh(me_)
            b2.free()
        bm.free()
        bpy.data.objects.remove(nut)
        self.shells = []
        for s, me_ in (("L", meL), ("R", meR)):
            me_.materials.append(self.m_shell)
            me_.shade_smooth()
            ob = bpy.data.objects.new(f"{name}_shell{s}", me_)
            col.objects.link(ob)
            _rest(ob)
            self._bp(ob, f"shell{s}", Matrix.Identity(4))
            ob.visible_shadow = False
            self.shells.append(ob)
        # extra leaves
        self.extra_obs = []
        for (bn, az, el) in self.extra:
            lf = _leaf_mesh(f"{name}_{bn}", 0.05, 0.012, col, self.m_leaf, fold=0.2, cup=0.1, curve=0.12)
            _rest(lf)
            p0 = self.rest[bn].translation
            Rm = (Matrix.Rotation(math.radians(az - 90), 4, "Z") @ Matrix.Rotation(math.radians(-el), 4, "Y"))
            self._bp(lf, bn, Matrix.Translation(p0) @ Rm)
            self.extra_obs.append(lf)
        # sapling leaves (stage 3): a short woody twig and one big broad leaf each (reads at close-up)
        self.branch_obs = []
        for (bn, az, el, ln) in self.branches:
            p0 = self.rest[bn].translation
            tw = 0.028
            pts_ = [V((tw * t, 0, tw * 0.25 * t)) for t in np.linspace(0, 1, 5)]
            br = _tube(f"{name}_{bn}", pts_, [0.0042 * (1 - 0.5 * t) for t in np.linspace(0, 1, 5)], col,
                       self.m_stem, n=7)
            ntube = len(br.data.vertices)
            lf = _leaf_mesh(f"{name}_{bn}_leaf", ln, ln * 0.27, col, self.m_leaf, nu=16, nv=8, fold=0.14, cup=0.12,
                            curve=0.10)
            lf.data.transform(Matrix.Translation(pts_[-1]) @ Matrix.Rotation(0.25, 4, "Y"))
            ob = geo.join([br, lf], f"{name}_{bn}")
            ob.data.materials.clear()
            ob.data.materials.append(self.m_stem)
            ob.data.materials.append(self.m_leaf)
            for poly in ob.data.polygons:
                poly.material_index = 0 if all(vi < ntube for vi in poly.vertices) else 1
            _rest(ob)
            Rm = (Matrix.Rotation(math.radians(az - 90), 4, "Z") @ Matrix.Rotation(math.radians(-el), 4, "Y"))
            self._bp(ob, bn, Matrix.Translation(p0) @ Rm)
            self.branch_obs.append(ob)
        # clod
        clod = _uv_sphere(f"{name}_clod", 0.03, col, self.m_clod, nu=20, nv=12, sz=0.55, center=(0, 0, 0.004))
        geo.displace_noise(clod, 0.004, 0.012, seed=3)
        self._bp(clod, "clod", Matrix.Identity(4))
        self.clod = clod
        # halo + light
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        hme = bpy.data.meshes.new(f"{name}_halo")
        bm.to_mesh(hme)
        bm.free()
        hme.materials.append(self.m_halo)
        for f in hme.polygons:
            f.use_smooth = True
        halo = bpy.data.objects.new("MoteHalo_" + name, hme)
        col.objects.link(halo)
        self._bp(halo, "head", Matrix.Translation(hc) @ Matrix.Diagonal((0.052, 0.052, 0.052, 1)))
        halo.visible_shadow = False
        self.halo = halo
        self.light = None
        if light:
            ld = bpy.data.lights.new(name + "_light", "POINT")
            ld.color = GLOW_HOT
            ld.energy = LIGHT_E
            ld.shadow_soft_size = 0.02
            if hasattr(ld, "use_custom_distance"):
                ld.use_custom_distance = True
                ld.cutoff_distance = LIGHT_REACH
            lo = bpy.data.objects.new(name + "_light", ld)
            col.objects.link(lo)
            self._bp(lo, "head", Matrix.Translation(hc + V((0, -0.004, 0))))
            charmat.drive(ld, "energy", rig, "_light_e")
            for i, ch in enumerate("rgb"):
                fc = ld.driver_add("color", i)
                fc.driver.type = "SCRIPTED"
                fc.driver.expression = "v"
                vv = fc.driver.variables.new()
                vv.name = "v"
                vv.targets[0].id_type = "OBJECT"
                vv.targets[0].id = rig
                vv.targets[0].data_path = f'["_light_{ch}"]'
            self.light = lo
        # drivers: shading props from the rig
        shaded = [stem, head, cap, clod, halo] + self.leaves + self.extra_obs + self.branch_obs + self.shells
        for o in shaded:
            for k in ("glow", "health", "crack", "wood", "mouth", "blush"):
                charmat.drive(o, k, rig)
        for o in [head, halo] + self.eyes + [cap]:
            o.visible_shadow = o is cap
        self.parts = parts + [head, cap, clod] + self.eyes + self.extra_obs + self.branch_obs + self.shells
        if self.light is not None:
            # the practical lights the world (and Claude's face), not the sprout's own leaves 1 cm away (they would
            # blow out); its own parts glow by emission instead
            ex = bpy.data.collections.new(f"{name}_selfExclude")
            for o in self.parts:
                if o.type == "MESH" and o not in self.shells:
                    ex.objects.link(o)
            self.light.light_linking.receiver_collection = ex
            for co in ex.collection_objects:
                co.light_linking.link_state = "EXCLUDE"
        self.body = head          # framing.py treats characters with .body as small (a point)
        self.apply({})

    # ------------------------------------------------------------------ utilities
    def _bp(self, ob, bname, M_arm):
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

    # ------------------------------------------------------------------ posing
    def apply(self, p):
        P = dict(DEFAULT)
        P.update(p)
        r = math.radians
        rig = self.rig
        Rx = lambda a: Matrix.Rotation(r(a), 3, "X")
        Ry = lambda a: Matrix.Rotation(r(a), 3, "Y")
        Rz = lambda a: Matrix.Rotation(r(a), 3, "Z")
        g = min(max(P["grow"], 0.0), 3.0)
        sc = P["scale"]
        rig.location = (P["x"], P["y"], P["z"])
        rig.rotation_mode = "YXZ"           # heading outermost: tilts act in the character frame
        rig.rotation_euler = (r(P["pitch"]), r(P["roll"]), r(P["heading"]))
        rig.scale = (sc, sc, sc)
        sq = P["squash"]
        L = _gi(_L, g) * (1 + sq)
        rs = _gi(_RS, g) / math.sqrt(max(1 + sq, 0.3))
        rh = _gi(_RH, g) / RH0
        lf = _gi(_LF, g)
        # stem: length, thickness, lean / side / bend / droop / unfurl hook
        uf = min(max(P["unfurl"], 0.0), 1.0)
        dr = min(max(P["droop"], 0.0), 1.0)
        wl = (0.30, 0.25, 0.2, 0.15, 0.10)
        for i in range(N_STEM):
            hook = (1 - uf) * (0.0, 22.0, 45.0, 48.0, 45.0)[i] * _ss(0.04, 0.45, g)
            wilt = dr * (4.0 + 14.0 * i)
            ang = P["lean"] * wl[i] + P["bend"] * (i / 10.0) + hook + wilt + (3.0, -4.0, -3.0, 2.0, 4.0)[i]
            taper = 1.0 - 0.42 * _ss(1.5, 3.0, g) * (i / (N_STEM - 1)) ** 0.8
            self._set(f"stem{i}", Rz(P["head_turn"] * 0.05) @ Ry(P["side"] * wl[i] + (2.0, 3.0, -2.0, -3.0, 0.0)[i])
                      @ Rx(ang),
                      scale=(rs * taper, L / (N_STEM * SEG), rs * taper))
        # head
        self._set("head", Rz(P["head_turn"]) @ Ry(P["head_tilt"]) @ Rx(P["head_nod"] - dr * 25.0),
                  scale=(rh, rh * (1 + sq * 0.5), rh))
        cap_nat = STEM_Z0 + _gi(_L, g) + 1.15 * RH0 * rh - 0.006
        lift = max(0.0, NUT_H - 0.0015 - cap_nat) * (1 - _ss(0.2, 0.6, min(max(P["crack"], 0.0), 1.0)) * _ss(0.05, 0.4, g))
        cs = max(1.0, rh) / max(rh, 1e-3)          # the cap keeps the nut's size while the kernel head is small
        self._set("cap", Ry(P["hat_tilt"] * _ss(0.2, 0.8, g)), loc=(0, 0, lift / max(rh, 1e-3)),
                  scale=(cs,) * 3 if P["hat"] > 0.02 else (1e-4,) * 3)
        # eyes: gaze + blink (vertical squash) ; hidden inside the shell at grow 0
        vis_eye = _ss(0.35, 0.7, g)
        for s, sg in (("L", 1), ("R", -1)):
            op = min(max(P["eye_open"] + P[f"eye{s}_open"], 0.0), 1.25) * vis_eye
            pu = P["pupil"]
            ve = max(vis_eye, 1e-3)
            self._set(f"eye{s}", Rz(P["look_x"] * 16.0) @ Rx(-P["look_y"] * 12.0),
                      scale=(pu * ve, pu * ve, max(0.06, op) * pu * ve))
            rig[f"_eye{s}_happy"] = float(P["eye_happy"])
        # arm leaves
        lo = min(max(P["leaf_open"], 0.0), 1.0)
        for s, sg in (("L", 1), ("R", -1)):
            reach, curl, ldr = P[f"leaf{s}_reach"], P[f"leaf{s}_curl"], min(max(P[f"leaf{s}_droop"], 0.0), 1.0)
            up = 4.0 + 85.0 * (1 - lo) + reach * 0.75 - ldr * 80.0 - dr * 30.0
            fwd = reach * 0.6
            self._set(f"leaf{s}0", Rz(-sg * fwd) @ Ry(-sg * up), scale=(lf, lf, lf))
            for k in (1, 2):
                c = curl * 62.0 + ldr * 28.0 + dr * 15.0 - (1 - lo) * 20.0 + 7.0
                self._set(f"leaf{s}{k}", Ry(sg * c))
        # extra leaves (stage 2) and branches (stage 3)
        for j, (bn, az, el) in enumerate(self.extra):
            v = _ss(1.2 + 0.25 * j, 1.7 + 0.25 * j, g) * (1.0 + 1.9 * _ss(2.0, 3.0, g))
            droop = (dr * 40.0 + (1 - P["health"]) * 25.0)
            self._set(bn, Matrix.Rotation(r(droop), 3, Vector((math.cos(r(az)), math.sin(r(az)), 0))),
                      scale=(max(v, 1e-4),) * 3)
        for j, (bn, az, el, ln) in enumerate(self.branches):
            v = _ss(2.15 + 0.12 * j, 2.85 + 0.05 * j, g)
            self._set(bn, Matrix.Rotation(r(dr * 25.0), 3, Vector((math.cos(r(az)), math.sin(r(az)), 0))),
                      scale=(max(v, 1e-4) * 1.0,) * 3)
        # shell: crack opens the halves; clod
        ck = min(max(P["crack"], 0.0), 1.0)
        op = _ss(0.45, 1.0, ck) * 32.0 + _ss(1.5, 2.5, g) * 20.0
        self._set("shellL", Ry(op))
        self._set("shellR", Ry(-op))
        self._set("clod", scale=(max(P["clod"], 1e-4),) * 3)
        # shading + light
        glow, health = max(P["glow"], 0.0), min(max(P["health"], 0.0), 1.0)
        rig["glow"] = float(glow)
        rig["health"] = float(health)
        rig["crack"] = float(ck)
        rig["wood"] = float(_ss(1.6, 3.0, g))
        rig["mouth"] = float(P["mouth"]) * vis_eye
        rig["blush"] = float(P["blush"])
        cc = [GLOW_DIM[i] + (GLOW_HOT[i] - GLOW_DIM[i]) * health for i in range(3)]
        rig["_light_e"] = float(LIGHT_E * glow ** 1.2 * (0.35 + 0.65 * health) * (0.35 + 0.65 * _ss(0.0, 0.6, ck + g)))
        rig["_light_r"], rig["_light_g"], rig["_light_b"] = (float(c) for c in cc)
        self._P = P

    # ------------------------------------------------------------------ keying
    def _keyed(self):
        out = [(self.rig, "location", 3), (self.rig, "rotation_euler", 3), (self.rig, "scale", 3)]
        for pb in self.rig.pose.bones:
            if pb.name == "base":
                continue
            out.append((self.rig, f'pose.bones["{pb.name}"].rotation_quaternion', 4))
            out.append((self.rig, f'pose.bones["{pb.name}"].scale', 3))
            if pb.name == "cap":
                out.append((self.rig, f'pose.bones["{pb.name}"].location', 3))
        for k in self.PROPS:
            out.append((self.rig, f'["{k}"]', 1))
        return out

    def key(self, frame):
        for (o, path, n) in self._keyed():
            o.keyframe_insert(path, frame=frame)

    def bake(self, fn, f0, f1):
        """fn(frame) -> pose dict; keys every frame (fast F-curve write, merges with keys outside [f0, f1])."""
        from bpy_extras import anim_utils
        rig = self.rig
        chans = self._keyed()
        frames = list(range(f0, f1 + 1))
        vals = {(path, i): [] for (_, path, n) in chans for i in range(n)}
        for f in frames:
            self.apply(fn(f))
            for (o, path, n) in chans:
                v = o.path_resolve(path)
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
            fc.keyframe_points.foreach_set("interpolation", np.full(len(pts), 1, dtype=np.int32))
            fc.update()

    # ------------------------------------------------------------------ helpers
    def point(self, where, frame=None):
        """World position: 'head' (centre), 'face' (front of the head), 'top', 'leafL_tip', 'leafR_tip', 'base'."""
        sc = bpy.context.scene
        sc.frame_set(frame if frame is not None else sc.frame_current)    # full update: drivers (IK switches) too
        rig = self.rig
        if where in ("head", "face", "top"):
            pb = rig.pose.bones["head"]
            off = {"head": Vector((0, 0, 0)), "face": Vector((0, -RH0, 0)), "top": Vector((0, 0, RH0))}[where]
            return rig.matrix_world @ pb.matrix @ self.rest["head"].inverted() @ (self.head_c + off)
        if where.startswith("leaf"):
            pb = rig.pose.bones[f"leaf{where[4]}2"]
            return rig.matrix_world @ pb.tail
        return rig.matrix_world.translation.copy()

    def ride(self, char, where="cradle", follow_rotation=None):
        """Carry the sprout on a character at char.POINTS[where] ('cradle', 'palmL', 'palmR', 'head', ...): an anchor
        empty rides the carrier's bone. follow_rotation (default: True for the cradle, False for palms): True = the
        pose's x, y, z, heading become offsets in the carrier's frame at that point (heading 180 = facing the carrier;
        it tilts with the body); False = it follows the point's position only and stays upright (x, y, z add a world
        offset; heading stays world). unride() returns it to plain world placement."""
        self.unride()
        bn, p = char.POINTS[where]
        if follow_rotation is None:
            follow_rotation = not where.startswith(("palm", "hand", "fing", "thumb"))
        an = bpy.data.objects.new(f"{self.name}_ride", None)
        self.col.objects.link(an)
        char._bone_parent(an, bn, Matrix.Translation(Vector(p)))
        if follow_rotation:
            c = self.rig.constraints.new("CHILD_OF")
            c.target = an
            c.inverse_matrix = Matrix.Identity(4)
            c.set_inverse_pending = False
        else:
            c = self.rig.constraints.new("COPY_LOCATION")
            c.target = an
            c.use_offset = True
        c.name = "ride"
        self.anchor = an
        self.carrier = (char, where)
        return an

    def unride(self):
        c = self.rig.constraints.get("ride")
        if c:
            self.rig.constraints.remove(c)
        an = getattr(self, "anchor", None)
        if an is not None and an.name in bpy.data.objects:
            bpy.data.objects.remove(an)
        self.anchor = None
        self.carrier = None

    def reach_leaf(self, side, target, pose=None, frame=None, curl_range=(0.0, 1.0), reach_range=(-30.0, 90.0),
                   mode="tip"):
        """Solve leaf `side` ('L'/'R') onto a world target: mode 'tip' touches it with the leaf tip (a cheek), 'wrap'
        puts the target inside the curl (a finger). Returns the pose channels to merge (leafX_reach, leafX_curl,
        lean, side). Evaluates the rig (grid search, ~0.5 s)."""
        P = dict(DEFAULT)
        P.update(pose or {})
        T = Vector(target)
        best, best_p = 1e9, {}
        sc = bpy.context.scene
        fr = frame if frame is not None else sc.frame_current
        for lean in (P["lean"], P["lean"] + 10.0, P["lean"] + 20.0):
            for sd in (P["side"] - 15.0, P["side"], P["side"] + 15.0):
                for reach in np.linspace(reach_range[0], reach_range[1], 9):
                    for curl in np.linspace(curl_range[0], curl_range[1], 5):
                        q = dict(P, lean=lean, side=sd)
                        q[f"leaf{side}_reach"] = float(reach)
                        q[f"leaf{side}_curl"] = float(curl)
                        self.apply(q)
                        sc.frame_set(fr)
                        pb = self.rig.pose.bones
                        mw = self.rig.matrix_world
                        if mode == "tip":
                            err = (mw @ pb[f"leaf{side}2"].tail - T).length
                        else:
                            a1, a2, a3 = mw @ pb[f"leaf{side}1"].head, mw @ pb[f"leaf{side}2"].head, mw @ pb[f"leaf{side}2"].tail
                            ab, ac = a2 - a1, a3 - a1
                            nrm = ab.cross(ac)
                            cc = (a1 + a3) / 2 if nrm.length < 1e-9 else a1 + (nrm.cross(ab) * ac.length_squared +
                                                                               ac.cross(nrm) * ab.length_squared) / (2 * nrm.length_squared)
                            err = (cc - T).length + 0.3 * abs(curl - 0.7) * 0.05
                        err += 0.0004 * abs(lean - P["lean"]) / 10.0
                        if err < best:
                            best, best_p = err, {f"leaf{side}_reach": float(reach), f"leaf{side}_curl": float(curl),
                                                 "lean": lean, "side": sd}
        self.apply(dict(P, **best_p))
        best_p["_error"] = best
        return best_p

    def attach(self, obj, where="head", at=None, pose=None):
        from . import stage
        bn = {"head": "head", "face": "head", "leafL_tip": "leafL2", "leafR_tip": "leafR2", "base": "base"}[where]
        if at is None:
            q = dict(pose or {})
            q.update(x=0.0, y=0.0, z=0.0, heading=0.0, pitch=0.0, roll=0.0)
            self.apply(q)
            at = self.point(where) - self.rig.matrix_world.translation
        return stage.attach(obj, self, bn, Vector(at), pose=pose)


# ====================================================================== the great tree (coda) + swing
def _blossom_cells(cell=256, grid=4, seed=61):
    """Atlas of painted blossom clusters (5-petal flowers, a few buds): RGB = value/hue jitter, A = coverage."""
    from . import tex as T
    rng = np.random.default_rng(seed)
    n = cell * grid
    yy, xx = np.mgrid[0:cell, 0:cell] / cell
    out = np.zeros((n, n, 4))
    for gy in range(grid):
        for gx in range(grid):
            a = np.zeros((cell, cell))
            v = np.zeros((cell, cell))
            for _ in range(int(rng.integers(5, 9))):
                cx, cy = rng.uniform(0.22, 0.78, 2)
                rr = rng.uniform(0.07, 0.13)
                rot = rng.uniform(0, 2 * np.pi)
                dx, dy = xx - cx, yy - cy
                ang = np.arctan2(dy, dx) + rot
                d = np.hypot(dx, dy)
                petal = rr * (0.62 + 0.38 * np.abs(np.cos(2.5 * ang)) ** 0.6)
                m = T.smoothstep(petal, petal * 0.82, d)
                shade = 0.75 + 0.25 * (1 - d / rr) + rng.normal(0, 0.03)
                a = np.maximum(a, m)
                v = np.where(m > 0.5, np.maximum(v, shade - 0.35 * T.smoothstep(rr * 0.3, 0.0, d)), v)
            hue = T.fnoise(cell, 6, int(rng.integers(0, 999)))
            out[gy * cell:(gy + 1) * cell, gx * cell:(gx + 1) * cell] = np.stack([v, hue, v, a], -1)
    return out


def _cards(name, specs, collection, material, grid=4):
    """specs: (center, right, up, normal, cell, tint)."""
    verts, faces, uvs, nrms, tints = [], [], [], [], []
    for (c, rt, up, nn, cell, tint) in specs:
        b = len(verts)
        for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(c + rt * sx + up * sy)
        faces.append((b, b + 1, b + 2, b + 3))
        gx, gy = cell % grid, cell // grid
        u0, v0 = gx / grid, 1 - (gy + 1) / grid
        du = 1 / grid
        uvs += [(u0, v0), (u0 + du, v0), (u0 + du, v0 + du), (u0, v0 + du)]
        nrms += [nn] * 4
        tints += [tint] * 4
    ob = geo.obj_from(name, verts, faces, collection, material, smooth=True)
    me = ob.data
    uvl = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        uvl.data[li].uv = uvs[loop.vertex_index]
    me.normals_split_custom_set([nrms[l.vertex_index] for l in me.loops])
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.array([(*t, 1.0) for t in tints]).ravel())
    return ob


def _card_mat(name, atlas, translucent=0.3, scale=1.5):
    m = bpy.data.materials.get(name)
    if m:
        return m

    def alpha(nb):
        uv = nb.n("ShaderNodeUVMap")
        t = nb.n("ShaderNodeTexImage", image=mat.image(atlas), interpolation="Cubic", extension="CLIP")
        nb.link(uv.outputs[0], t.inputs[0])
        return nb.mapr(t.outputs["Alpha"], 0.35, 0.6)
    return mat.painterly(name, (1, 1, 1), stroke="strokes_fine", scale=scale, tex_amt=0.6, hue_jit=0.05, bump=0.0,
                         breakup=1.2, wrap=0.25, translucent=translucent, vcol="tint", alpha_tex=alpha,
                         backface=True, snow=0.0)


def _branch_path(p0, d, length, rng, n=10, droop=0.0, wander=0.25, sweep=0.0):
    """Gnarled branch centreline: random wander, gravity droop and an end sweep upward (sweep > 0)."""
    pts = [Vector(p0)]
    d = Vector(d).normalized()
    step = length / (n - 1)
    for i in range(1, n):
        u = i / (n - 1)
        d = (d + Vector(rng.normal(0, wander, 3)) * 0.35 + Vector((0, 0, -droop * u + sweep * u * u))).normalized()
        pts.append(pts[-1] + d * step)
    return pts


def _rock(name, center, radius, rng, col, m, squash=0.6):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=radius)
    for v in bm.verts:
        v.co.z *= squash
        v.co.x *= rng.uniform(0.85, 1.25)
    ob = geo.bm_to_obj(name, bm, col, m)
    geo.displace_noise(ob, radius * 0.22, radius * 0.6, seed=int(rng.integers(0, 999)))
    ob.location = Vector(center)
    return ob


def _petal_proto(name, col, m):
    """One cupped petal (3 cm), used as the falling-petal instance."""
    verts, faces = [], []
    n = 6
    for i in range(n + 1):
        t = i / n
        w = 0.011 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7 + 0.001
        for j in (-1, 0, 1):
            verts.append((t * 0.03 - 0.015, j * w, 0.004 * (j * j) + 0.003 * t * t))
    for i in range(n):
        for j in range(2):
            a = i * 3 + j
            faces.append((a, a + 3, a + 4, a + 1))
    ob = geo.obj_from(name, verts, faces, col, m)
    return ob


def falling_petals(name, center, radius, top, bottom, count=260, seed=9, fall=0.35, drift=(0.25, 0.08),
                   collection=None, colors=None):
    """Petals drifting down under / around a canopy, animated by scene time in geometry nodes (no keys): each petal
    falls at its own speed, sways and tumbles, and wraps to the top when it reaches `bottom`. Cheap (instances of one
    3 cm petal). Returns the points object (named Petal* so framing ignores it)."""
    rng = np.random.default_rng(seed)
    col = collection or geo.coll(name)
    c = Vector(center)
    pts = []
    for i in range(count):
        a = rng.uniform(0, 2 * math.pi)
        r = radius * math.sqrt(rng.uniform(0.0, 1.0))
        pts.append((c.x + r * math.cos(a), c.y + r * math.sin(a), rng.uniform(bottom, top)))
    me = bpy.data.meshes.new(name + "_pts")
    me.from_pydata(pts, [], [])
    att = me.attributes.new("seed", "FLOAT", "POINT")
    att.data.foreach_set("value", rng.random(count).astype(np.float32))
    ob = bpy.data.objects.new("Petal_" + name, me)
    col.objects.link(ob)
    pm = bpy.data.materials.get("PetalMat") or mat.painterly("PetalMat", (0.98, 0.70, 0.78), stroke="strokes_fine",
                                                             scale=60.0, tex_amt=0.5, translucent=0.4, wrap=0.3,
                                                             hue_jit=0.06, snow=0.0)
    proto = _petal_proto(name + "_proto", col, pm)
    proto.hide_render = True
    proto.hide_viewport = True
    g = bpy.data.node_groups.new(name + "_petalsGN", "GeometryNodeTree")
    if hasattr(g, "is_modifier"):
        g.is_modifier = True
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nb = charmat.G(g)
    gi, go = nb.n("NodeGroupInput"), nb.n("NodeGroupOutput")
    t = nb.n("GeometryNodeInputSceneTime").outputs["Seconds"]
    sd = nb.n("GeometryNodeInputNamedAttribute", data_type="FLOAT")
    sd.inputs["Name"].default_value = "seed"
    sv = sd.outputs["Attribute"]
    P = nb.n("GeometryNodeInputPosition").outputs["Position"]
    px, py, pz = nb.xyz(P)
    H = top - bottom
    spd = nb.mul(fall, nb.add(0.6, nb.mul(sv, 0.8)))
    z = nb.add(bottom, nb.math("FLOORED_MODULO", nb.sub(nb.sub(pz, bottom), nb.mul(t, spd)), H))
    sway = nb.math("SINE", nb.add(nb.mul(t, nb.add(0.8, sv)), nb.mul(sv, 6.28)))
    x = nb.add(nb.add(px, nb.mul(sway, 0.22)), nb.mul(t, drift[0]))
    y = nb.add(nb.add(py, nb.mul(nb.math("COSINE", nb.add(nb.mul(t, 0.7), nb.mul(sv, 9.0))), 0.15)), nb.mul(t, drift[1]))
    sp = nb.n("GeometryNodeSetPosition")
    nb.link(gi.outputs[0], sp.inputs["Geometry"])
    nb.link(nb.vec(x, y, z), sp.inputs["Position"])
    oi = nb.n("GeometryNodeObjectInfo")
    oi.inputs["Object"].default_value = proto
    rot = nb.n("FunctionNodeEulerToRotation")
    nb.link(nb.vec(nb.add(nb.mul(t, nb.mul(sv, 3.0)), nb.mul(sv, 17.0)), nb.add(nb.mul(t, 2.1), nb.mul(sv, 5.0)),
                   nb.mul(sv, 40.0)), rot.inputs["Euler"])
    io = nb.n("GeometryNodeInstanceOnPoints")
    nb.link(sp.outputs[0], io.inputs["Points"])
    nb.link(oi.outputs["Geometry"], io.inputs["Instance"])
    nb.link(rot.outputs[0], io.inputs["Rotation"])
    nb.inp(io, "Scale", nb.add(0.8, nb.mul(sv, 0.5)))
    nb.link(io.outputs[0], go.inputs[0])
    md = ob.modifiers.new("petals", "NODES")
    md.node_group = g
    ob.visible_shadow = False
    return ob


def great_tree(name="GreatTree", base=(0.0, 0.0, 0.0), height=7.5, swing_dir=(1.0, -0.3), seed=4, collection=None,
               blossom=1.0, density=1.0, ground_fn=None, rocks=True, petals=True, swing_height=3.1):
    """The coda's great tree grown from the sprout: a massive gnarled trunk (~1.3 m thick, buttressed, twisting
    furrows) on flaring roots that grip a few boulders and snake over the ground; six broad sheltering limbs (one long
    near-horizontal swing limb toward swing_dir at ~swing_height); a full layered canopy of clumps, each a dark core
    plus pink / white blossom and fresh-green leaf cards, tinted for clear value structure (lit crowns, mauve-green
    undersides); falling petals (scene-time GN). ground_fn(x, y) -> z (default: flat at base z).
    Returns dict(objects, swing_point (under the swing limb), swing_length (rope length for a 0.45 m seat),
    seat_height, swing_branch=(p0, p1), canopy_center, top, tips, petals)."""
    from . import tex as T
    rng = np.random.default_rng(seed)
    col = collection or geo.coll(name)
    B = Vector(base)
    s = height / 7.5
    gz = ground_fn or (lambda x, y: B.z)
    bark = bpy.data.materials.get(f"{name}_bark") or mat.painterly(
        f"{name}_bark", (0.27, 0.19, 0.13), stroke="strokes_vert", scale=1.0, tex_amt=1.2, breakup=1.25, bump=0.4,
        color2=(0.20, 0.24, 0.13), c2_scale=0.5, c2_thresh=(0.58, 0.70), ao=0.5, snow=0.0)
    objs = []
    # ---- trunk: buttressed, twisting furrows, a gentle lean, forking at ~3 m
    nz, nr = 36, 64
    verts, faces = [], []
    th_top = 3.0 * s
    lean = Vector((-0.15, 0.10, 0)) * s

    def trunk_c(t):
        return Vector((lean.x * t * t + 0.10 * s * math.sin(t * 3.1), lean.y * t * t + 0.07 * s * math.sin(t * 2.3 + 1),
                       t * th_top))
    for i in range(nz):
        t = i / (nz - 1)
        c = trunk_c(t)
        rad = (0.66 - 0.16 * t) * s + 0.95 * s * max(0.0, 0.3 - t) ** 2 / 0.09 * 0.55
        tw = t * 1.3
        for k in range(nr):
            a = 2 * math.pi * k / nr
            lobe = 1 + (0.65 * max(0.0, 0.32 - t) / 0.32) * max(0.0, math.cos(6 * (a - 0.4 * tw) + 0.7)) ** 2.5
            furrow = 1 - 0.07 * max(0.0, math.cos(13 * (a - tw))) ** 6 + 0.035 * math.sin(7 * a + t * 9)
            knot = 1 + 0.09 * math.exp(-((t - 0.55) / 0.06) ** 2) * max(0.0, math.cos(a - 2.0)) ** 8
            rr = rad * lobe * furrow * knot
            x, y = B.x + c.x + rr * math.cos(a), B.y + c.y + rr * math.sin(a)
            z = B.z + c.z
            if i == 0:
                z = gz(x, y) - 0.15 * s
            verts.append((x, y, z))
    for i in range(nz - 1):
        for k in range(nr):
            k2 = (k + 1) % nr
            faces.append((i * nr + k, i * nr + k2, (i + 1) * nr + k2, (i + 1) * nr + k))
    objs.append(geo.obj_from(f"{name}_trunk", verts, faces, col, bark))
    top = B + trunk_c(1.0)
    # ---- boulders gripped by the roots
    rock_m = bpy.data.materials.get(f"{name}_rock") or mat.painterly(
        f"{name}_rock", (0.36, 0.34, 0.32), stroke="strokes_broad", scale=1.4, tex_amt=1.1, color2=(0.42, 0.45, 0.24),
        c2_scale=0.6, c2_thresh=(0.55, 0.66), bump=0.4, snow=0.0)
    rock_pts = []
    if rocks:
        for k in range(4):
            a = rng.uniform(0, 2 * math.pi) if k else math.atan2(-swing_dir[1], -swing_dir[0])
            d = rng.uniform(1.2, 1.9) * s
            cxy = (B.x + d * math.cos(a), B.y + d * math.sin(a))
            r = rng.uniform(0.45, 0.8) * s
            rock_pts.append((Vector((cxy[0], cxy[1], gz(*cxy))), r))
            objs.append(_rock(f"{name}_boulder{k}", (cxy[0], cxy[1], gz(*cxy) + r * 0.12), r, rng, col, rock_m))
    # ---- roots: 9 buttress roots flaring out, arching over the boulders and diving into the ground
    for k in range(9):
        a = 2 * math.pi * k / 9 + rng.uniform(-0.2, 0.2)
        dirv = Vector((math.cos(a), math.sin(a), 0))
        L = rng.uniform(2.0, 3.4) * s
        r0 = rng.uniform(0.22, 0.32) * s
        pts, rad = [], []
        for i in range(12):
            u = i / 11
            xy = B.xy + (dirv.xy * (0.55 * s + L * u)) + Vector((-dirv.y, dirv.x)) * (0.25 * s * math.sin(u * 4 + k))
            g = gz(xy.x, xy.y)
            lift = 0.0
            for (rc, rr) in rock_pts:
                dd = (Vector((xy.x, xy.y)) - rc.xy).length
                if dd < rr * 1.05:
                    lift = max(lift, math.sqrt(max(0.0, (rr * 1.05) ** 2 - dd * dd)) * 0.55)
            z = g + lift + (0.75 * s) * (1 - u) ** 2.2 - 0.06 * s * u
            pts.append(Vector((xy.x, xy.y, z)))
            rad.append(r0 * (1 - 0.8 * u) ** 1.2 + 0.02 * s)
        objs.append(_tube(f"{name}_root{k}", pts, rad, col, bark, n=12))
    # ---- limbs: six broad spreading limbs; limb 0 is the swing limb
    sd = Vector((swing_dir[0], swing_dir[1], 0)).normalized()
    limb_specs = [(sd, 0.10, 5.6, 0.34, True)]
    base_a = math.atan2(sd.y, sd.x)
    for k in range(5):
        a = base_a + math.radians(70 + 56 * k + rng.uniform(-12, 12))
        limb_specs.append((Vector((math.cos(a), math.sin(a), 0)), rng.uniform(0.45, 0.85), rng.uniform(4.0, 5.2),
                           rng.uniform(0.26, 0.33), False))
    tips, swing_limb = [], None
    for j, (d, up, ln, r0, is_swing) in enumerate(limb_specs):
        dd = (d + Vector((0, 0, up))).normalized()
        if is_swing:
            p0 = B + trunk_c(swing_height * 0.98 / max(th_top, 1e-3) if swing_height < th_top else 0.95)
            p0 = Vector((p0.x, p0.y, B.z + min(swing_height + 0.25 * s, th_top)))
            pts = _branch_path(p0, dd, ln * s, rng, n=14, droop=0.06, wander=0.07, sweep=0.12)
        else:
            p0 = top + Vector((0, 0, rng.uniform(-0.2, 0.25) * s))
            pts = _branch_path(p0, dd, ln * s, rng, n=13, droop=0.0, wander=0.22, sweep=0.18)
        rad = [r0 * s * (1 - 0.78 * (i / (len(pts) - 1)) ** 0.85) for i in range(len(pts))]
        objs.append(_tube(f"{name}_limb{j}", pts, rad, col, bark, n=16))
        if is_swing:
            swing_limb = (pts, rad)
        for q in range(4):
            i0 = int(rng.integers(5, len(pts) - 2))
            p1 = pts[i0]
            tang = (pts[i0] - pts[i0 - 1]).normalized()
            side = tang.cross(Vector((0, 0, 1))).normalized() * (1 if q % 2 else -1)
            d2 = (tang * 0.6 + side * 0.7 + Vector((0, 0, 0.55))).normalized()
            sub = _branch_path(p1, d2, rng.uniform(1.2, 2.0) * s, rng, n=8, wander=0.3, sweep=0.15)
            objs.append(_tube(f"{name}_br{j}_{q}", sub, [rad[i0] * 0.5 * (1 - 0.85 * i / 7) for i in range(8)], col,
                              bark, n=9))
            tips += [sub[-1], sub[4]]
        tips += [pts[-1], pts[int(len(pts) * 0.72)]]
    # ---- canopy: clumps (dark core + blossom/leaf cards), value-structured
    bl_path = T.cached("dab_blossom", _blossom_cells)
    mat.textures()["dab_blossom"] = bl_path
    m_bl = _card_mat(f"{name}_blossomMat", "dab_blossom", translucent=0.25, scale=3.0)
    m_lf = _card_mat(f"{name}_leafMat", "dab_leaf", translucent=0.35, scale=1.5)
    m_core = bpy.data.materials.get(f"{name}_core") or mat.painterly(
        f"{name}_core", (0.62, 0.38, 0.45), stroke="strokes_fine", scale=0.8, tex_amt=1.0, color2=(0.30, 0.44, 0.15),
        c2_scale=0.5, wrap=0.3, edge_break=0.0, snow=0.0)
    cen = sum(tips, Vector()) / len(tips)
    zlo = min(p.z for p in tips) - 0.8 * s
    zhi = max(p.z for p in tips) + 1.3 * s
    clumps = []
    for tp in tips:
        if all((tp - c).length > 0.9 * s for c, _ in clumps):
            clumps.append((tp + Vector((0, 0, 0.25 * s)), rng.uniform(1.35, 1.85) * s))
    for k in range(7):     # crown fillers knit the clumps into one broad, layered dome
        a = 2 * math.pi * k / 7 + rng.uniform(-0.3, 0.3)
        clumps.append((cen + Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(0.8, 2.4) * s +
                       Vector((0, 0, rng.uniform(0.7, 1.5) * s)), rng.uniform(1.5, 2.1) * s))
    clumps.append((cen + Vector((0, 0, 1.9 * s)), 1.9 * s))
    pink_lit, pink_mid, white = np.array((1.0, 0.87, 0.91)), np.array((1.0, 0.64, 0.75)), np.array((1.0, 0.97, 0.96))
    mauve, g_lit, g_mid, g_dk = (np.array((0.80, 0.50, 0.58)), np.array((0.64, 0.82, 0.30)),
                                 np.array((0.34, 0.60, 0.14)), np.array((0.13, 0.28, 0.09)))
    spec_b, spec_l, cores = [], [], []
    for ci, (cc, cr) in enumerate(clumps):
        core = _rock(f"{name}_core{ci}", cc, cr * 0.80, rng, col, m_core, squash=0.56)
        cores.append(core)
        n_cards = int(230 * density * (cr / s) ** 2)
        for i in range(n_cards):
            d = Vector(rng.normal(0, 1, 3)).normalized()
            d.z = d.z * 0.62
            if d.z < -0.1 and rng.random() < 0.55:
                d.z *= 0.3
            d.normalize()
            rr = rng.uniform(0.72, 1.02) if rng.random() < 0.85 else rng.uniform(1.02, 1.22)   # broken edges
            p = cc + Vector((d.x * cr, d.y * cr, d.z * cr * 0.58)) * rr
            nrm = d
            up_l = max(-1.0, min(1.0, nrm.z * 1.4 + 0.15 * (p.z - cc.z) / cr))
            h = (p.z - zlo) / max(zhi - zlo, 1e-3)
            lit = (0.30 + 0.70 * min(1.0, max(0.0, 0.5 + 0.5 * up_l))) * (0.72 + 0.28 * h) + rng.normal(0, 0.06)
            lit = min(1.0, max(0.0, lit))
            sz = rng.uniform(0.20, 0.36) * s * (0.75 if rr > 1.02 else 1.0)
            rt = nrm.cross(Vector((0, 0, 1)))
            rt = (rt if rt.length > 1e-3 else Vector((1, 0, 0))).normalized() * sz
            upv = nrm.cross(rt).normalized() * sz
            if rng.random() < (0.42 + 0.45 * lit) * blossom:     # blossom crowns the light, green fills the shade
                base_c = white if rng.random() < (0.22 + 0.35 * lit) else pink_mid
                c = mauve * (1 - lit) + (base_c * 0.55 + pink_lit * 0.45 if lit > 0.6 else base_c) * lit
                spec_b.append((p, rt, upv, nrm, int(rng.integers(0, 16)), tuple(np.clip(c, 0, 1))))
            else:
                c = g_dk * (1 - lit) + (g_lit if lit > 0.65 else g_mid) * lit
                spec_l.append((p, rt * 0.9, upv * 0.9, nrm, int(rng.integers(0, 16)), tuple(np.clip(c, 0, 1))))
    core_ob = geo.join(cores, f"{name}_canopyCore")
    objs.append(core_ob)
    objs.append(_cards(f"{name}_blossom", spec_b, col, m_bl))
    objs.append(_cards(f"{name}_leaves", spec_l, col, m_lf))
    # ---- the swing point: under the swing limb, ~55% along (strong part), and the rope length for a 0.45 m seat
    pts, rad = swing_limb
    i_sw = int(len(pts) * 0.5)
    sp = pts[i_sw] - Vector((0, 0, rad[i_sw] * 0.9))
    seat_h = 0.45
    swing_len = sp.z - gz(sp.x, sp.y) - seat_h
    pet = None
    if petals:
        pet = falling_petals(name, cen, 4.5 * s, zlo + 0.5 * s, B.z - 0.1, count=int(300 * density), seed=seed,
                             collection=col)
        objs.append(pet)
    return dict(objects=objs, swing_point=sp, swing_length=swing_len, seat_height=seat_h,
                swing_branch=(pts[0], pts[-1]), canopy_center=cen, top=top, tips=tips, petals=pet)


def swing(name="Swing", hang_point=(0, 0, 3.0), length=1.9, seat=(0.92, 0.36, 0.05), collection=None, heading=0.0):
    """A new wooden swing hanging from hang_point: two ropes (wrapped round the branch at the top) and a plank seat
    wide enough for Claude, rigged on a pivot empty (rotate its X to rock it: rock_swing). Use the great tree's
    swing_point / swing_length for a 0.45 m seat. Returns dict(pivot, seat, seat_top (world point at rest), ropes)."""
    col = collection or geo.coll(name)
    H = Vector(hang_point)
    wood = bpy.data.materials.get(f"{name}_wood") or mat.painterly(
        f"{name}_wood", (0.50, 0.32, 0.17), stroke="strokes_horiz", scale=6.0, tex_amt=1.0, spec=0.05, breakup=1.0,
        snow=0.0)
    rope = bpy.data.materials.get(f"{name}_rope") or mat.painterly(
        f"{name}_rope", (0.58, 0.48, 0.33), stroke="strokes_vert", scale=30.0, tex_amt=1.0, snow=0.0)
    piv = bpy.data.objects.new(f"{name}_pivot", None)
    col.objects.link(piv)
    piv.location = H
    piv.rotation_euler = (0, 0, math.radians(heading))
    sw, sdp, st = seat
    plank = geo.rounded_box(f"{name}_seat", (sw, sdp, st), 0.012, seg=(6, 3, 1), n_r=2, collection=col, mat=wood,
                            center=(0, 0, -length))
    plank.parent = piv
    ropes = []
    for sx in (-1, 1):
        x = sx * (sw / 2 - 0.06)
        r_ = geo.lathe(f"{name}_rope{sx}", [(0.013, -length + st / 2), (0.013, 0.06)], seg=8, collection=col,
                       mat=rope, cap_top=False, cap_bot=False)
        r_.location = (x, 0, 0)
        r_.parent = piv
        knot = _tube(f"{name}_wrap{sx}", [Vector((x, 0.0, 0.06 + 0.07 * math.sin(a))) +
                                          Vector((0, 0.07 * math.cos(a), 0)) for a in np.linspace(0, 2 * math.pi, 14)],
                     [0.015] * 14, col, rope, n=6)
        knot.parent = piv
        ropes += [r_, knot]
    seat_top = H + Vector((0, 0, -length + st / 2))
    return dict(pivot=piv, seat=plank, seat_top=seat_top, ropes=ropes, length=length)


def rock_swing(sw, f0, f1, amp=5.0, period=3.4, phase=0.0, fps=24):
    """Key a gentle rocking on the swing pivot (degrees about its X)."""
    piv = sw["pivot"]
    for f in range(f0, f1 + 1):
        t = (f - f0) / fps
        piv.rotation_euler.x = math.radians(amp * math.sin(2 * math.pi * t / period + phase))
        piv.keyframe_insert("rotation_euler", index=0, frame=f)


def sit_on(char, sw):
    """Seat a character on the swing: its rig follows the plank (rocking included). Returns the pose offsets to merge
    (x, y, z relative to the plank; heading 0 = facing the swing's -Y). Use with acting.B_SIT / F_SLEEP."""
    c = char.rig.constraints.get("swing") or char.rig.constraints.new("CHILD_OF")
    c.name = "swing"
    c.target = sw["seat"]
    c.inverse_matrix = Matrix.Identity(4)
    c.set_inverse_pending = False
    from . import claude as Cl
    return dict(x=0.0, y=0.03, z=sw["seat_top"].z - sw["pivot"].location.z - Cl.Z0 + 0.005)
