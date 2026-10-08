"""D03 — INT night, the telescope at the open front window. (A) Claude at the eyepiece by candlelight. (B) Through the
eyepiece: the Claude-shaped constellation, its one empty eye. (C) Claude straightens, slowly turns to the lantern on the
sill: the star asleep inside, barely glowing. Understanding arrives — Claude's body sinks."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, props, mat, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.d01 import anchor, face_light

T_B = 1.9
T_C = 3.7


def eyepiece_mask(cam, lens, name="EyepieceMask"):
    """A black card just in front of the lens with a soft round hole: the view through the eyepiece."""
    d = 0.1
    fw = d * 36.0 / lens
    fh = fw * 816 / 1920
    r1 = fh * 0.47
    r0 = r1 * 0.86
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    ln = nb.n("ShaderNodeVectorMath", operation="LENGTH")
    nb.link(tc.outputs["Object"], ln.inputs[0])
    mr = nb.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    nb.link(ln.outputs["Value"], mr.inputs["Value"])
    mr.inputs["From Min"].default_value = r0
    mr.inputs["From Max"].default_value = r1
    em = nb.n("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.004, 0.003, 0.006, 1)
    em.inputs["Strength"].default_value = 1.0
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.link(mr.outputs["Result"], mx.inputs["Fac"])
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    bpy.ops.mesh.primitive_plane_add(size=fw * 1.6)
    p = bpy.context.active_object
    p.name = name
    p.data.materials.append(m)
    p.visible_shadow = False
    p.parent = cam
    p.matrix_parent_inverse = Matrix.Identity(4)
    p.location = (0, 0, -d)
    return p


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(telescope_covered=False))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1]:
        interior.set_ishutter(p, 1.0)
    for p in W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    pr = W.practicals(candle=3.2, stove=0.5)
    K = props.constellation(origin=(O.x, O.y, 0), lines=0.3)
    night = mat.emissive("EyepieceNight", (0.006, 0.010, 0.026), 1.0)
    cdir = props.const_dir(0.0, 0.0)
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=900.0, fill_type="NGON")
    bk = bpy.context.active_object
    bk.name = "EyepieceNightDisk"
    bk.data.materials.append(night)
    bk.matrix_world = Matrix.Translation(Vector((O.x, O.y, 0)) + cdir * 2400) @ cdir.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bk.visible_shadow = False
    import random
    rnd = random.Random(7)
    fs = mat.emissive("FieldStar", (0.8, 0.88, 1.0), 2.5)
    for i in range(70):
        u, v = rnd.uniform(-16, 16), rnd.uniform(-12, 10)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(1.8, 3.6),
                                              location=Vector((O.x, O.y, 0)) + props.const_dir(u, v) * 2000)
        o = bpy.context.active_object
        o.name = f"CS_field{i}"
        o.data.materials.append(fs)
        o.visible_shadow = False
    # the front window frame (mill-local): outward normal n, along-the-wall tangent t
    a = math.radians(-45)
    n = Vector((math.cos(a), math.sin(a), 0))
    t_ = Vector((-n.y, n.x, 0))
    win = lambda proj, u, z: O + n * proj + t_ * u + Vector((0, 0, z))
    # telescope: aimed out of the open front window, up at the night sky
    bpy.context.view_layer.update()
    T = W.I["telescope"]
    base = O + T["root"].location
    tube = T["tube"]
    c_tube = base + Vector((0, 0, 1.2))
    wc = win(3.05, 0.0, 1.16)
    hd_ = Vector((wc.x - c_tube.x, wc.y - c_tube.y, 0)).normalized()
    el = math.radians(22)
    look = (hd_ * math.cos(el) + Vector((0, 0, math.sin(el)))).normalized()
    tube.matrix_world = Matrix.Translation(c_tube) @ look.to_track_quat("Z", "Y").to_matrix().to_4x4()
    eyep = c_tube - look * 0.62
    # Claude on the step crate behind the eyepiece, its right eye to the glass
    hd = math.degrees(math.atan2(hd_.x, -hd_.y))
    R = Matrix.Rotation(math.radians(hd), 3, "Z")
    eye_r = R @ Vector((-CL.EYE_X * CL.S, -CL.DEPTH / 2 * CL.S, 0))
    cpos = Vector((eyep.x, eyep.y, 0)) - Vector((eye_r.x, eye_r.y, 0)) - hd_ * 0.035
    crate = W.I["crate"]["crate"]
    crate.matrix_world = Matrix.Translation(Vector((cpos.x, cpos.y, O.z))) @ Matrix.Rotation(math.radians(hd), 4, "Z")
    ctop = O.z + 0.42
    # the lantern on the sill, the candle beside it
    sill_z = 0.73
    lan = interior.lantern(bpy.context.scene.collection, W.I["mats"])
    lan_p = win(3.06, -0.12, sill_z)
    lan["root"].location = lan_p
    cnd, flm = W.I["table"]["candle"], W.I["table"]["flame"]
    cnd_p = win(3.08, 0.22, sill_z)
    for o in (cnd, flm):
        o.parent = None
    cnd.location = cnd_p
    flm.location = cnd_p + Vector((0, 0, 0.125))
    if pr.get("candle"):
        pr["candle"].location = cnd_p + Vector((0, 0, 0.16))
    s = W.star()
    s.light_scale = 2.4
    sp = lan_p + Vector((0, 0, 0.17))
    # cameras: A from the dark room behind Claude, C close beside the window
    eA = win(-0.25, 0.25, 1.42)
    eC = win(2.95, 1.18, 0.95)
    hs = S.heading_to((sp.x, sp.y), (eA.x, eA.y)) + 8
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=sp.x, y=sp.y, z=sp.z, heading=hs, scale=0.58, glow=0.4, warmth=0.55, droop=26,
                         curl=10))
    st.layer(lambda t, p: p.update(glow=0.4 * (1 + 0.12 * math.sin(t * 1.7))))
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    lan["root"].rotation_euler.z = math.atan2(eA.y - lan_p.y, eA.x - lan_p.x) - math.radians(30)
    c = W.claude()
    h_lan = S.heading_to((cpos.x, cpos.y), (sp.x, sp.y))
    tr = Track()
    tr.pose(0.0, dict(x=cpos.x, y=cpos.y, z=ctop, heading=hd, lean=7, armL_up=42, armL_fwd=58, armR_up=36, armR_fwd=62,
                      armL_curl=20, armR_curl=20, eye_open=0.0, eyeR_open=0.8, eye_happy=0.2, look_y=0.2, head_nod=-6))
    tr.key(T_C, "linear", lean=9)
    # straightens: pulls back from the eyepiece, both eyes open, still looking up at the sky
    back = cpos - hd_ * 0.2
    tr.key(T_C + 0.55, "out", x=back.x, y=back.y, lean=-5, squash=0.04, eye_open=0.92, eyeR_open=0.0, eye_happy=0.0, look_y=0.45, head_nod=-8,
           armL_up=-10, armR_up=-8, armL_fwd=30, armR_fwd=30, armL_curl=0, armR_curl=0)
    tr.key(T_C + 0.95, "inout", look_y=0.5)
    # ...and slowly lowers its eyes to the lantern on the sill: the star, asleep, barely glowing
    tr.key(T_C + 1.8, "inout", heading=h_lan, look_y=-0.3, look_x=-0.1, head_nod=3, pupil=1.12, eye_open=1.0, eye_tilt=0.35,
           squash=0.0)
    # understanding — the body sinks
    tr.key(T_C + 2.5, "inout", **S.merge(dict(slump=9, squash=-0.1, lean=2, armL_up=-52, armR_up=-52, armL_fwd=8,
                                               armR_fwd=8, eye_open=0.66, eye_tilt=0.85, pupil=1.05, look_y=-0.35,
                                               head_tilt=8, head_nod=-2)))
    tr.key(dur, "soft", slump=11, squash=-0.12, eye_open=0.6, eye_tilt=0.9, head_tilt=10)
    tr.layer(anim.blinks(times=[T_C + 0.75, T_C + 2.15], dur=0.24))
    tr.layer(anim.breathe(0.01, 0.22))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # --- A: from the dark room behind Claude: the telescope points out of the open window at the night sky; the candle
    # and the lantern (the star asleep in it) on the sill
    tA = Vector((cpos.x, cpos.y, ctop + 0.35)) * 0.55 + win(3.05, 0.0, 0.95) * 0.45
    camA = FR.shot_cam("CamA", f0, f0 + int(T_B * 24), eA, tA, 28, push=0.06, fstop=3.2, shake=0.15, seed=43, check=False,
                       focus_on=Vector((cpos.x, cpos.y, ctop + 0.55)))
    # --- B: through the eyepiece — the Claude-shaped constellation and its one empty eye
    eB = O + Vector((0, 0, 6.0))
    aim = props.const_dir(0.0, 0.9)
    camB = FR.shot_cam("CamB", f0 + int(T_B * 24), f0 + int(T_C * 24), eB, eB + aim * 100, 34, push=0.0, lens_end=37,
                       fstop=0, shake=0.35, seed=44, check=False)
    eyepiece_mask(camB, 35)
    # --- C: from outside, through the open window: the dim lantern soft in the foreground, Claude behind the telescope
    tC = Vector((cpos.x, cpos.y, ctop + 0.52))
    camC = FR.shot_cam("CamC", f0 + int(T_C * 24), f1, eC, tC, 25, push=0.07, fstop=3.5, shake=0.12, seed=45, check=False,
                       focus_on=Vector((cpos.x, cpos.y, ctop + 0.55)))
    # cheat the tripod out of the close-up from the window side (its legs would cross Claude's face)
    tri = bpy.data.objects.get("Tripod")
    if tri:
        S.vis_range(tri, f0, f0 + int(T_C * 24), f0, f1)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_B * 24))
    S.cut(camC, f0 + int(T_C * 24))
    bpy.context.scene.camera = camC
    fC = f0 + int((T_C + 1.5) * 24)
    face_light(c, eC, cnd_p, energy=45.0, frame=fC)
    face_light(s, eC, cnd_p, energy=8.0, frame=fC)
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.6, bloom_thr=0.55, kuw_near=3, kuw_far=4, vignette=0.45))
