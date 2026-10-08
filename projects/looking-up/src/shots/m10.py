"""M10 — EXT summer night, the meadow full of fireflies. The star darts among them, blinking its glow at them as if
saying hello — they drift away, unanswering. It droops, dimmer. Claude scoops it up in both arms and hugs it close.

(A) medium: the star bobbing among the fireflies (screen right), Claude watching, smiling (left). (B) close on Claude:
the star sinks into frame in front of it, dim and drooping, and Claude gathers it up against its chest, both faces to
camera."""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, geo, mat, props, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_DROOP = 2.3
T_SCOOP = 3.0
T_CUT = 2.0       # from the fireflies to the close two-shot, just as the star's smile goes


def fireflies(center, n, f0, f1, seed=0, spread=(3.0, 3.0, 1.2), away=None):
    rng = np.random.default_rng(seed)
    m = bpy.data.materials.get("Firefly")
    if m is None:
        from lu.fx import _life_emissive
        m = _life_emissive("Firefly", (0.75, 1.0, 0.35), 40.0)
    objs = []
    for i in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012)
        o = bpy.context.active_object
        o.name = f"Firefly{i}"
        o.data.materials.append(m)
        o.visible_shadow = False
        p0 = Vector(center) + Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(spread)
        ph = rng.uniform(0, 6.28, 4)
        fq = rng.uniform(0.3, 0.8, 3)
        for f in range(f0, f1, 2):
            t = (f - f0) / 24
            d = Vector((math.sin(t * fq[0] + ph[0]) * 0.4, math.cos(t * fq[1] + ph[1]) * 0.4, math.sin(t * fq[2] + ph[2]) * 0.2))
            if away is not None and t > 1.2:
                dv = (p0 - Vector(away))
                dv.z = 0
                d += dv.normalized() * (t - 1.2) * 0.5
            o.location = p0 + d
            o["life"] = max(0.0, math.sin(t * 2.2 + ph[3])) ** 3
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    return objs


def mow(center, radius, names=("Meadow", "Patch")):
    """Remove tall grass cards around a spot (Claude's legs and the low cameras' foreground)."""
    c = Vector(center)
    for nm in names:
        for o in [o for o in bpy.data.objects if o.name.startswith(nm) and o.type == "MESH"]:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            mw = o.matrix_world
            dead = [f for f in bm.faces if ((mw @ f.calc_center_median()) - c).to_2d().length < radius]
            bmesh.ops.delete(bm, geom=dead, context="FACES")
            bm.to_mesh(o.data)
            bm.free()


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=25.0))
    O = W.origin
    dur = (f1 - f0) / 24
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    cx, cy = 4.2, -6.4
    gz = W.ground(cx, cy)
    C = Vector((cx, cy, gz))
    mow(C + Vector((0.2, -1.3, 0)), 2.9)
    W.grass_patch((cx + 0.3, cy - 1.0), 3.2, 16000, blade=(0.05, 0.12), flowers=0.03, seed=101)
    F = C + Vector((1.3, -1.15, 0))                     # the firefly cloud, front-left of Claude
    ff = fireflies(F + Vector((0, 0, 0.85)), 55, f0, f1, seed=4, spread=(2.4, 2.0, 1.0), away=F)
    eA = C + Vector((-0.75, -2.95, 0.48))
    eB = C + Vector((0.28, -2.15, 0.42))
    s = W.star()
    s.light_scale = 16.0
    droop_pt = C + Vector((0.38, -0.62, 0.3))
    hold_pt = C + Vector((0.0, -0.37, 0.43))
    path = [(0.0, F + Vector((0.55, 0.35, 0.72))), (0.8, F + Vector((-0.4, -0.2, 0.82))),
            (1.6, F + Vector((0.15, -0.05, 0.62))), (T_DROOP, C + Vector((0.66, -0.62, 0.52))),
            (T_SCOOP - 0.1, droop_pt)]
    hs_A = S.heading_to((F.x, F.y), (eA.x, eA.y))
    hs_B = S.heading_to((droop_pt.x, droop_pt.y), (eB.x, eB.y))
    st = Track()
    st.pose(0.0, S.merge(S.S_JOY, glow=1.6, x=path[0][1].x, y=path[0][1].y, z=path[0][1].z, heading=hs_A + 15, droop=0,
                         eye_tilt=0.0, curl=0, pupil=1.0, eye_open=1.0, look_x=0.0, look_y=0.0))
    for t, p in path[1:]:
        st.key(t, "inout", x=p.x, y=p.y, z=p.z)
    # hello! (glow blinks at 0.9, 1.25, 1.6) turning from one firefly to the next
    st.key(0.8, "inout", heading=hs_A - 35, eye_happy=0.7, look_x=0.5)
    st.key(1.25, "inout", heading=hs_A + 25, look_x=-0.4)
    st.key(1.6, "inout", heading=hs_A - 10, eye_happy=0.45, look_x=0.6, look_y=0.2)
    # ...no answer; they drift off. The smile goes, it sinks, dimmer, drooping
    st.key(2.0, "inout", eye_happy=0.0, pupil=1.1, look_x=0.3, look_y=0.4, arms=10)
    st.key(T_DROOP + 0.15, "inout", **S.merge(S.S_SAD, glow=0.75, heading=hs_B, droop=42, eye_open=0.6, eye_tilt=0.85,
                                             look_y=-0.7, head=20))
    st.key(T_SCOOP, "linear", glow=0.7)
    # scooped up (3.0) and held against Claude's chest, facing out
    st.key(T_SCOOP + 0.4, "inout", x=hold_pt.x, y=hold_pt.y, z=hold_pt.z, heading=hs_B, eye_open=0.85, look_y=0.3,
           look_x=-0.3, eye_tilt=0.4, droop=25, pupil=1.15, glow=0.85)
    st.key(dur, "soft", eye_happy=0.65, eye_open=0.6, eye_tilt=0.1, droop=8, glow=1.3, curl=16, look_x=0.0, look_y=0.0,
           pupil=1.0)

    def hello(t, p):
        for tb in (0.9, 1.25, 1.6):
            u = (t - tb) / 0.18
            if 0 <= u <= 1:
                p["glow"] = p.get("glow", 1) * (1 + 0.9 * math.sin(math.pi * u))
        if t < 2.0:
            p["z"] = p.get("z", 0) + 0.04 * math.sin(t * 6)
    st.layer(hello)
    st.layer(anim.blinks(times=[2.9], dur=0.2))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # held against Claude the star's own light would flood its chest: ease the lamp down as it nestles in
    if s.light:
        ld = s.light.data
        for f in range(f0 + int((T_SCOOP - 0.3) * 24), f1):
            u = min(1.0, max(0.0, ((f - f0) / 24 - (T_SCOOP - 0.3)) / 0.7))
            bpy.context.scene.frame_set(f)
            ld.energy = ld.energy * (1 - 0.8 * u)
            ld.keyframe_insert("energy", frame=f)
    c = W.claude()
    hc_A = S.heading_to((cx, cy), (F.x, F.y)) * 0.55          # watching the star, cheated toward camera
    hc_B = S.heading_to((cx, cy), (eB.x, eB.y))
    lkA = S.look_params((cx, cy), hc_A, gz + 0.57, F + Vector((0, 0, 0.9)))
    tr = Track()
    tr.pose(0.0, dict(x=cx, y=cy, z=gz, heading=hc_A, look_x=lkA["look_x"], look_y=lkA["look_y"], eye_happy=0.4,
                      eye_open=0.92, head_tilt=6, armL_up=-15, armR_up=-15, eye_tilt=0.0, lean=0, armL_fwd=0, armR_fwd=0,
                      armL_curl=0, armR_curl=0, roll=0, squash=0))
    tr.key(1.7, "inout", eye_happy=0.45)
    # notices the star drooping: the smile drops, brows go up in sympathy
    tr.key(T_DROOP + 0.3, "inout", heading=hc_B + 12, eye_happy=0.0, eye_tilt=0.55, eye_open=0.9, head_tilt=-8,
           look_x=0.35, look_y=-0.45, lean=6)
    # the scoop (3.0): leans down, both arms reach under it...
    tr.key(T_SCOOP, "inout", heading=hc_B, lean=20, armL_fwd=75, armR_fwd=75, armL_up=-25, armR_up=-25, look_y=-0.6,
           look_x=0.2)
    # ...and gathers it up into a hug, eyes closing contentedly
    tr.key(T_SCOOP + 0.45, "inout", lean=-4, armL_fwd=88, armR_fwd=88, armL_curl=45, armR_curl=45, armL_up=5, armR_up=5,
           eye_happy=0.8, eye_open=0.85, eye_tilt=0.0, look_y=-0.2, look_x=0.0, head_tilt=10, squash=0.03)
    tr.key(dur, "soft", eye_happy=0.88, eye_open=0.75, roll=5, head_tilt=13, lean=-6)
    tr.layer(anim.breathe(0.014, 0.3))
    tr.layer(anim.blinks(times=[0.6, 2.05], dur=0.15))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # A: the star among the fireflies (right), Claude watching (left)
    tA = (C + F) / 2 + Vector((0.1, 0, 0.62))
    camA = FR.shot_cam("CamA", f0, f1, eA, tA, 30, push=0.06, fstop=4.0, seed=32, check=False,
                       focus_on=F + Vector((0, 0, 0.8)))
    # B: in close on Claude as the star droops into its arms
    tB = C + Vector((0.1, -0.2, 0.42))
    camB = FR.shot_cam("CamB", f0, f1, eB, tB, 30, push=0.08, lens_end=32, fstop=2.8, seed=33, check=False,
                       focus_on=C + Vector((0, -0.3, 0.45)))
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, C + Vector((0, 0, 0.4)), eB, (0.3, 0.8, 0.4), rim_col=(0.6, 0.75, 1.0), rim_w=22.0,
                      fill_col=(1.0, 0.75, 0.45), fill_w=10.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=60.0, mist_depth=2000.0, bloom=0.8, bloom_thr=0.5))
