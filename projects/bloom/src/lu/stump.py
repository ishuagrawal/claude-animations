"""The giant charred stump of Claude's home tree (hero set, B02-B07) at layout.STUMP, with its rope swing.

  build(detail="hi")   -> dict(stump, inner, floor, roots, branch, swing (pivot Empty), seat, ropes, door (world point
                          at the threshold), door_dir, pivot (world), ground_z, keep_clear [(x, y, r)])
  swing_creak(S, f0, f1, amp=4.0, period=3.4, phase=0.0, tilt=6.0)   keys the charred swing's slow creaking sway
  swing_push(S, frame, amp=12.0, decay=2.5)                         a push (a gust, a touch) that dies away

The stump: ~3 m wide trunk (layout.STUMP_R at chest height) flaring into 8 root buttresses and roots that snake into
the ash; a jagged, broken, hollow top (one charred spike rising to ~5.5 m); an arched door-hole facing layout.DOOR_AZ
into the dark hollow where Claude lived (a charred stool and shelf still inside). The bark is real geometry: blocky
alligator char checks with deep grooves (vertex attribute "groove" lights the embers in them), on top of the
char_bark shader. A dead branch reaches east at ~3 m; the swing's two charred ropes hang from it to a cracked plank
(one rope a little shorter: the seat hangs askew). detail="lo" builds a cheap version for distant views."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, layout, terrain, envmat
from .terrain import ss, fbm, mesh_from

TAU = 2 * math.pi


def _cells(u, v, cw, ch, nu, seed=3):
    """Jittered-grid voronoi on (u, v) (u periodic with nu cells): returns (edge distance, cell id hash 0..1)."""
    gu, gv = u / cw, v / ch
    iu, iv = np.floor(gu), np.floor(gv)
    best1 = np.full(u.shape, 1e9)
    best2 = np.full(u.shape, 1e9)
    cid = np.zeros(u.shape)
    for du in (-1, 0, 1):
        for dv in (-1, 0, 1):
            cu, cv = iu + du, iv + dv
            cuw = np.mod(cu, nu)
            h1 = np.sin(cuw * 127.1 + cv * 311.7 + seed * 17.0) * 43758.5453
            h2 = np.sin(cuw * 269.5 + cv * 183.3 + seed * 31.0) * 43758.5453
            h1 -= np.floor(h1)
            h2 -= np.floor(h2)
            pu = cu + 0.15 + 0.7 * h1
            pv = cv + 0.15 + 0.7 * h2
            d = np.hypot((gu - pu) * cw, (gv - pv) * ch)
            closer = d < best1
            best2 = np.where(closer, best1, np.minimum(best2, d))
            cid = np.where(closer, h1 * 0.6 + h2 * 0.4, cid)
            best1 = np.where(closer, d, best1)
    return (best2 - best1) * 0.5, cid


def _radius(th, z, R, rph, nroots=8):
    """Outer radius of the trunk at angle th, height z (above its ground)."""
    zc = np.maximum(z, 0.0)
    flare = 1 + 0.42 * np.exp(-zc / 0.55) + 0.12 * np.exp(-zc / 1.6)
    lobes = np.maximum(0.0, np.cos(nroots * th + rph + 0.4 * np.sin(3 * th))) ** 2.2
    butt = 1 + 0.38 * np.exp(-zc / 0.65) * lobes
    wob = 1 + 0.035 * np.sin(3 * th + 0.7 * z + rph) + 0.025 * np.sin(5 * th - 1.3 * z) + 0.05 * fbm(th * 4, z * 1.4, 61, 1.0, 2)
    taper = 1 - 0.035 * zc
    return R * flare * butt * wob * taper


def _top(th, rph):
    """Jagged broken top height around the trunk: a ragged rim ~2.9-3.6 m and one charred spike to ~5.5 m."""
    spike = np.exp(-((np.angle(np.exp(1j * (th - (rph + 2.2)))) / 0.42) ** 2)) * 2.3
    shoulder = np.exp(-((np.angle(np.exp(1j * (th - (rph + 1.5)))) / 0.9) ** 2)) * 0.6
    rag = 0.28 * np.abs(np.sin(th * 7 + rph)) + 0.16 * fbm(th * 9, np.zeros_like(th) + 3.0, 62, 1.0, 3)
    return 3.0 + spike + shoulder + rag


SILL = 0.12            # the door's charred sill (the trunk wall stays below it)


def _door_inside(th, z, door_th, hw=0.36, h=1.30, rag=True):
    dth = np.angle(np.exp(1j * (th - door_th)))
    q = dth / hw
    top = 0.88 + (h - 0.88) * np.sqrt(np.clip(1 - q * q, 0, 1))
    if rag:
        top = top + 0.05 * np.sin(th * 41.0) + 0.03 * np.sin(z * 37.0)
        q = q * (1 + 0.04 * np.sin(z * 23.0))
    return (np.abs(q) < 1.0) & (z < top) & (z > SILL)


def build(detail="hi", collection=None):
    col = collection or geo.coll("Stump")
    sx, sy = layout.STUMP
    g0 = float(terrain.height(sx, sy))
    R = layout.STUMP_R
    rng = np.random.default_rng(42)
    rph = 0.35
    door_th = math.radians(layout.DOOR_AZ)
    hi = detail == "hi"
    m = envmat.char_bark("StumpChar", cell=20.0, geo_crack=True)
    NU = 512 if hi else 96
    NV = 300 if hi else 40
    th = np.linspace(0, TAU, NU, endpoint=False)
    v = np.linspace(0.0, 1.0, NV)
    TH, V = np.meshgrid(th, v)
    top = _top(TH, rph)
    Z = -0.35 + (top + 0.35) * V
    Rr = _radius(TH, Z, R, rph)
    # alligator checks: blocky cells (wider than tall near the base, taller up the trunk) with deep grooves
    U = TH * R
    edge, cid = _cells(U, Z, 0.14, 0.2, int(round(TAU * R / 0.14)), seed=5)
    groove = 1 - ss(0.0, 0.022, edge)
    if hi:
        Rr = Rr - 0.026 * groove + 0.012 * ss(0.02, 0.07, edge) * (0.4 + cid) - 0.006 * (cid > 0.75)
    # the top rim burns thin and ragged: the wall narrows toward it
    X = sx + Rr * np.cos(TH)
    Y = sy + Rr * np.sin(TH)
    Zw = g0 + Z
    verts = np.stack([X.ravel(), Y.ravel(), Zw.ravel()], 1)
    nv = len(verts)
    # quads (wrap around in u)
    j = np.arange(NV - 1)[:, None]
    i = np.arange(NU)[None, :]
    a = j * NU + i
    b = j * NU + (i + 1) % NU
    quads = np.stack([a, b, b + NU, a + NU], -1).reshape(-1, 4)
    # cut the door (quad centres inside the outline)
    qc_th = (TH[:-1, :] + np.roll(TH[:-1, :], -1, 1)) * 0.5
    qc_th[:, -1] = TH[0, -1] + (TAU / NU) * 0.5
    qc_z = (Z[:-1, :] + Z[1:, :]) * 0.5
    door = _door_inside(qc_th.ravel(), qc_z.ravel(), door_th)
    quads = quads[~door]
    ob = mesh_from("Stump", verts, quads.astype(np.int32), col, m)
    att = ob.data.attributes.new("groove", "FLOAT", "POINT")
    att.data.foreach_set("value", (groove.ravel() * (0.6 + 0.4 * (Z.ravel() < 1.4))).astype(np.float32))
    out = dict(stump=ob, ground_z=g0)
    # ------------------------------------------------ inner wall + rim + floor (the hollow)
    NUi, NVi = (256, 90) if hi else (64, 16)
    thi = np.linspace(0, TAU, NUi, endpoint=False)
    vi = np.linspace(0.0, 1.0, NVi)
    THi, Vi = np.meshgrid(thi, vi)
    topi = _top(THi, rph)
    Zi = -0.1 + (topi - 0.03 + 0.1) * Vi
    wall = 0.22 + 0.14 * (1 - ss(0.0, 2.5, Zi)) + 0.06 * np.sin(THi * 3 + 1.0)
    wall = wall * (1 - 0.55 * ss(0.75, 1.0, Vi))                       # thin, ragged rim
    Ri = _radius(THi, Zi, R, rph) - wall - 0.05 * np.exp(-np.maximum(Zi, 0) / 0.6)
    Ri = Ri + 0.01 * fbm(THi * 12, Zi * 6, 63, 1.0, 2)
    Xi = sx + Ri * np.cos(THi)
    Yi = sy + Ri * np.sin(THi)
    vin = np.stack([Xi.ravel(), Yi.ravel(), (g0 + Zi).ravel()], 1)
    j = np.arange(NVi - 1)[:, None]
    i = np.arange(NUi)[None, :]
    a = j * NUi + i
    b = j * NUi + (i + 1) % NUi
    qi = np.stack([a, a + NUi, b + NUi, b], -1).reshape(-1, 4)            # facing inward
    qc_th = (THi[:-1, :] + np.roll(THi[:-1, :], -1, 1)) * 0.5
    qc_th[:, -1] = THi[0, -1] + (TAU / NUi) * 0.5
    qc_z = (Zi[:-1, :] + Zi[1:, :]) * 0.5
    di = _door_inside(qc_th.ravel(), qc_z.ravel(), door_th, hw=0.40, rag=False)
    qi = qi[~di]
    # rim strip: outer top row -> inner top row (sampled at the outer columns)
    rim_v, rim_q = [], []
    base = len(vin)
    k = NU // NUi
    for c in range(NUi):
        rim_v.append(verts[(NV - 1) * NU + c * k])
    rim_v = np.array(rim_v)
    rim_v[:, 2] += 0.005
    allv = np.concatenate([vin, rim_v], 0)
    for c in range(NUi):
        c2 = (c + 1) % NUi
        ia, ib = (NVi - 1) * NUi + c, (NVi - 1) * NUi + c2
        oa, ob_ = base + c, base + c2
        rim_q.append((ia, oa, ob_, ib))
    allq = np.concatenate([qi, np.array(rim_q)], 0)
    inner = mesh_from("StumpInner", allv, allq.astype(np.int32), col, m)
    out["inner"] = inner
    # door jamb: a tunnel through the wall along the door outline (charred edge)
    n_o = 48 if hi else 16
    outline = []
    for t in np.linspace(0, 1, n_o):
        # walk: bottom-left -> up the left side -> arch -> down the right side -> bottom-right
        if t < 0.25:
            q, zz = -1.0, SILL + (0.88 - SILL) * (t / 0.25)
        elif t < 0.75:
            ang = math.pi * (t - 0.25) / 0.5
            q, zz = -math.cos(ang), 0.88 + (1.30 - 0.88) * math.sin(ang)
        else:
            q, zz = 1.0, SILL + (0.88 - SILL) * (1 - (t - 0.75) / 0.25)
        outline.append((door_th + q * 0.36, zz))
    outline.append((door_th - 0.36, SILL))          # close the loop along the sill
    jv, jq = [], []
    for (tt, zz) in outline:
        ro = float(_radius(np.array([tt]), np.array([zz]), R, rph)[0]) + 0.01
        ri = ro - 0.42
        for rr in (ro, ri):
            jv.append((sx + rr * math.cos(tt), sy + rr * math.sin(tt), g0 + zz + (0.02 if rr == ro else 0.0)))
    for s_ in range(n_o - 1):
        a0, a1 = 2 * s_, 2 * s_ + 1
        b0, b1 = 2 * (s_ + 1), 2 * (s_ + 1) + 1
        jq.append((a0, b0, b1, a1))
    jamb = mesh_from("StumpDoorJamb", np.array(jv), np.array(jq, dtype=np.int32), col, m)
    out["door_dir"] = Vector((math.cos(door_th), math.sin(door_th), 0.0))
    rd = float(_radius(np.array([door_th]), np.array([0.2]), R, rph)[0])
    out["door"] = Vector((sx + math.cos(door_th) * (rd + 0.3), sy + math.sin(door_th) * (rd + 0.3), g0))
    # floor of the hollow: ash with charred debris, dark
    fl = geo.lathe("StumpFloor", [(0.0, 0.06), (R * 0.6, 0.03), (R * 0.9, -0.12)], seg=48, collection=col,
                   mat=envmat.ground(), cap_top=False, cap_bot=False)
    fl.location = (sx, sy, g0)
    me = fl.data
    co = np.array([vv.co for vv in me.vertices])
    for nm, c in (("ashc", (0.08, 0.07, 0.065, 1)), ("grnc", (0.05, 0.12, 0.04, 0)), ("msk", (0, 0.1, 0.0, 0))):
        at = me.color_attributes.new(nm, "FLOAT_COLOR", "POINT")
        at.data.foreach_set("color", np.tile(np.array(c, dtype=np.float32), len(co)))
    out["floor"] = fl
    if hi:
        out["home"] = _home_remnants(col, sx, sy, g0, door_th)
    # ------------------------------------------------ roots snaking into the ash
    from .dress import MB, tube
    mb = MB()
    nroots = 8
    for r_ in range(nroots):
        a = (math.pi * (2 * r_) - rph) / nroots + rng.normal(0, 0.08)
        a = (TAU * r_ / nroots) - rph / nroots
        if abs(math.atan2(math.sin(a - door_th), math.cos(a - door_th))) < 0.35:
            continue
        L = rng.uniform(1.6, 3.4)
        pts, rad = [], []
        r0 = rng.uniform(0.16, 0.26)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0))
        for t in np.linspace(0, 1, 9 if hi else 5):
            rr = R * 1.15 + L * t
            p = Vector((sx, sy, 0)) + d * rr + side * (0.25 * math.sin(t * 4 + r_) * t)
            gz = float(terrain.height(p.x, p.y))
            rad_t = r0 * (1 - 0.8 * t) + 0.02
            p.z = gz + rad_t * (0.55 - 0.9 * t) + 0.25 * (1 - t) ** 3
            pts.append(p)
            rad.append(rad_t)
        tube(mb, pts, rad, 12 if hi else 6, (1, 1, 1), (1, 1, 1), jitter=0.05, rng=rng)
    roots = mb.build("StumpRoots", col, envmat.char_bark("StumpRootChar", cell=26.0))
    out["roots"] = roots
    # ------------------------------------------------ the dead branch (east) and the swing
    mb = MB()
    swx, swy = layout.SWING
    pz = g0 + layout.SWING_PIVOT_Z
    pts = [Vector((sx + 0.55, swy + 0.18, pz + 0.62)), Vector((sx + 1.15, swy + 0.12, pz + 0.42)),
           Vector((sx + 1.75, swy + 0.02, pz + 0.26)), Vector((swx - 0.35, swy - 0.02, pz + 0.16)),
           Vector((swx + 0.3, swy, pz + 0.11)), Vector((swx + 0.85, swy - 0.06, pz + 0.12)),
           Vector((swx + 1.3, swy - 0.14, pz + 0.2))]
    rad = [0.30, 0.22, 0.16, 0.115, 0.095, 0.075, 0.05]
    tube(mb, pts, rad, 14 if hi else 6, (1, 1, 1), (1, 1, 1), cap=False, jitter=0.04, rng=rng)
    # splintered broken end
    tipc = pts[-1]
    for k in range(7):
        a = TAU * k / 7
        dv = Vector((0.6, math.cos(a) * 0.5, math.sin(a) * 0.5)).normalized()
        tube(mb, [tipc, tipc + dv * rng.uniform(0.05, 0.16)], [0.02, 0.003], 4, (1, 1, 1), (1, 1, 1))
    for (t, a, L) in ((0.35, 1.2, 0.35), (0.6, -0.9, 0.25), (0.8, 2.0, 0.2)):
        i = int(t * (len(pts) - 1))
        q = pts[i]
        dv = Vector((0.4, math.cos(a), math.sin(a) * 0.6 + 0.3)).normalized()
        tube(mb, [q, q + dv * L], [rad[i] * 0.35, rad[i] * 0.1], 6, (1, 1, 1), (1, 1, 1))
    out["branch"] = mb.build("StumpBranch", col, m)
    out.update(_swing(col, swx, swy, pz, hi))
    out["pivot"] = Vector((swx, swy, pz))
    out["keep_clear"] = [(sx, sy, R * 1.45), (swx, swy, 0.45)]
    return out


def _home_remnants(col, sx, sy, g0, door_th):
    """A charred stool and a slumped shelf inside the hollow (Claude's home)."""
    m = envmat.char_bark("CharSmall", cell=40.0, base_glow=False)
    d = Vector((math.cos(door_th), math.sin(door_th), 0.0))
    side = Vector((-d.y, d.x, 0.0))
    c = Vector((sx, sy, g0)) - d * 0.25 + side * 0.35
    parts = []
    seat = geo.lathe("StoolSeat", [(0.0, 0.32), (0.16, 0.32), (0.17, 0.35), (0.0, 0.35)], seg=14, collection=col, mat=m)
    seat.location = c
    parts.append(seat)
    for k in range(3):
        a = TAU * k / 3 + 0.3
        lg = geo.box("StoolLeg", (0.035, 0.035, 0.34), loc=c + Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, 0.16)),
                     collection=col, mat=m)
        lg.rotation_euler = (0.12 * math.sin(a), -0.12 * math.cos(a), 0)
        parts.append(lg)
    sh = geo.box("Shelf", (0.6, 0.18, 0.03), loc=(Vector((sx, sy, g0)) - d * 0.75 - side * 0.3 + Vector((0, 0, 0.95))),
                 collection=col, mat=m)
    sh.rotation_euler = (0.0, 0.25, math.atan2(side.y, side.x))
    parts.append(sh)
    return geo.join(parts, "StumpHome")


def _rope_mat():
    m = bpy.data.materials.get("CharRope")
    if m:
        return m
    from . import mat
    return mat.painterly("CharRope", (0.075, 0.05, 0.035), stroke="strokes_vert", scale=30.0, tex_amt=1.2,
                         breakup=1.3, bump=0.4, color2=(0.02, 0.016, 0.014), c2_thresh=(0.5, 0.6), c2_scale=0.6,
                         snow=0.0)


def _swing(col, swx, swy, pz, hi):
    from .dress import MB, tube
    piv = bpy.data.objects.new("SwingPivot", None)
    col.objects.link(piv)
    piv.location = (swx, swy, pz)
    piv.empty_display_size = 0.3
    rm = _rope_mat()
    seat_h = pz - (float(terrain.height(swx, swy)) + 0.45)
    ropes = []
    for k, (dx, L) in enumerate(((-0.27, seat_h), (0.27, seat_h - 0.05))):
        mb = MB()
        n = 18 if hi else 6
        pts = [Vector((dx, 0.0, 0.02)) + Vector((0.004 * math.sin(t * 9), 0.004 * math.cos(t * 7), -L * t))
               for t in np.linspace(0, 1, n)]
        tube(mb, pts, [0.014] * n, 7 if hi else 4, (1, 1, 1), (1, 1, 1), cap=False)
        # the knot wrapped round the branch
        ring = [Vector((dx + 0.012 * math.sin(a * 3), 0.1 * math.cos(a), 0.1 + 0.1 * math.sin(a))) for a in
                np.linspace(0, TAU, 12)]
        tube(mb, ring, [0.016] * 12, 6, (1, 1, 1), (1, 1, 1), cap=False)
        r = mb.build(f"SwingRope{k}", col, rm)
        r.parent = piv
        ropes.append(r)
    seat = geo.box("SwingSeat", (0.62, 0.2, 0.035), collection=col,
                   mat=envmat.char_bark("CharPlank", cell=34.0, base_glow=False), bevel=0.008)
    seat.parent = piv
    seat.location = (0.0, 0.0, -seat_h + 0.02)
    seat.rotation_euler = (0.0, math.atan2(-0.05, 0.54), 0.0)
    return dict(swing=piv, seat=seat, ropes=ropes)


def swing_creak(S, f0, f1, amp=4.0, period=3.4, phase=0.0, tilt=0.0):
    """Key a slow creaking sway (deg) of the swing between absolute frames f0..f1 (with a little hitch per swing)."""
    piv = S["swing"] if isinstance(S, dict) else S
    fps = bpy.context.scene.render.fps
    for f in range(f0, f1 + 1, 2):
        t = (f - f0) / fps
        a = amp * math.sin(TAU * t / period + phase) * (1 + 0.08 * math.sin(TAU * t / (period * 2.7)))
        a += 0.6 * math.sin(TAU * t * 2.3 / period) * abs(math.cos(TAU * t / period + phase))
        piv.rotation_euler = (math.radians(a), math.radians(tilt * math.sin(TAU * t / (period * 1.9))), 0.0)
        piv.keyframe_insert("rotation_euler", frame=f)


def swing_push(S, frame, amp=12.0, decay=2.5, period=3.0, f1=None):
    """A push that swings the seat out and dies away (damped)."""
    piv = S["swing"] if isinstance(S, dict) else S
    fps = bpy.context.scene.render.fps
    f1 = f1 or frame + int(fps * decay * 2.5)
    for f in range(frame, f1 + 1, 2):
        t = (f - frame) / fps
        a = amp * math.sin(TAU * t / period) * math.exp(-t / decay)
        piv.rotation_euler = (math.radians(a), 0.0, 0.0)
        piv.keyframe_insert("rotation_euler", frame=f)
