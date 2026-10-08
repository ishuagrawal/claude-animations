"""M07 — INT winter morning (snow outside the window): Claude grabs the dust sheet and yanks it off the old
telescope — a big puff of dust; Claude sneezes/coughs. The star zips straight to the eyepiece and peers in.

Staged from beside the snowy front window looking back into the warm room: Claude (3/4 front, screen left) at the
sheeted telescope (screen right); the sheet whips off away from camera, dust billows in the window light; the sneeze
plays to camera; the star darts down to the eyepiece and presses one eye to it."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_YANK = 1.0


def no_indoor_snow(mats):
    """The winter look snows on every up-facing surface; indoors there is none: zero the snow factor of the room's
    materials (the multiply fed by the look's Snow output and the material's own snow amount)."""
    for m in mats:
        if not m or not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            if n.type != "MATH":
                continue
            for s in n.inputs:
                if s.is_linked and s.links[0].from_socket.name == "Snow":
                    for l in n.outputs[0].links:
                        for s2 in l.to_node.inputs:
                            if not s2.is_linked:
                                s2.default_value = 0.0


def make(f0, f1):
    W = world.World("int", "winter", season="winter", sun_dir=(0.62, -0.68, 0.38),
                    interior_state=dict(telescope_covered=False))
    O = W.origin
    dur = (f1 - f0) / 24
    W.practicals(fill=13.0, stove=3.0)
    no_indoor_snow(list(W.I["mats"].values()) + [bpy.data.materials.get(n) for n in ("Char", "Scorch")])
    T = W.I["telescope"]
    base = O + T["root"].location
    sheet = T["sheet"]
    sheet.hide_render = False
    # telescope optics (world): the eyepiece is the tube's back end, the tube points out of the window
    tube = T["tube"]
    bpy.context.view_layer.update()
    axis = (tube.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    pivot = tube.matrix_world.translation.copy()
    eyep = pivot - axis * 0.62
    # Claude on the room side of the telescope, facing it
    cpos = base + Vector((-0.95, 0.4, 0.0))
    cpos.z = O.z
    hd = S.heading_to((cpos.x, cpos.y), (base.x, base.y))
    # the sheet whips off toward Claude and back over its shoulder (away from camera), crumples and drops
    # a sheet that hangs to just above the floor and hugs the tube (the full-length drape is a huge white cone in frame)
    s_full = sheet.matrix_world.copy()
    top = s_full.translation + Vector((0, 0, 1.82))
    s0 = Matrix.Translation(top) @ Matrix.Diagonal((0.82, 0.82, 0.78, 1.0)) @ Matrix.Translation(-top) @ s_full
    toward = Vector((0.25, 0.97, 0)).normalized()
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = (t - T_YANK) / 0.55
        if u < 0:
            m = s0
            w = 0.04 * max(0.0, 1 - abs(t - (T_YANK - 0.25)) / 0.25)      # the grab: a tug before the yank
            m = Matrix.Translation(toward * w) @ s0
        else:
            uu = min(u, 1.0)
            off = toward * 1.5 * anim.ease("out", uu) + Vector((0, 0, 0.9 * math.sin(math.pi * uu * 0.8) - 1.2 * uu * uu))
            m = Matrix.Translation(off) @ s0 @ Matrix.Diagonal((1 + 0.3 * uu, 1 + 0.3 * uu, max(0.08, 1 - 0.9 * uu), 1))
        sheet.matrix_world = m
        sheet.keyframe_insert("location", frame=f)
        sheet.keyframe_insert("rotation_euler", frame=f)
        sheet.keyframe_insert("scale", frame=f)
    S.vis_range(sheet, f0, f0 + int((T_YANK + 0.5) * 24), f0, f1)
    # dust: a billow off the telescope where the sheet was, drifting into the window light, plus a thinner trail
    fx.puff("SheetDust", base + Vector((0.05, 0.2, 1.2)), T_YANK, f0, n=22, spread=0.32, grow=(0.04, 0.17), life=(1.2, 2.2),
            rise=0.1, drift=(toward.x * 0.25, toward.y * 0.25, 0), color=(0.97, 0.95, 0.9), opacity=0.09, seed=71)
    fx.puff("SheetDust2", base + Vector((0.1, 0.35, 0.6)), T_YANK + 0.15, f0, n=12, spread=0.28, grow=(0.04, 0.14),
            life=(1.0, 1.8), rise=0.15, color=(0.97, 0.95, 0.9), opacity=0.08, seed=73)
    fx.motes("WinterMotes", base + Vector((-0.75, 0.75, 1.0)), (1.4, 1.2, 1.1), n=110, f0=f0, f1=f1, drift=(0.0, 0.0, -0.01),
             color=(1.0, 0.88, 0.65), strength=1.2, seed=12)
    c = W.claude()
    cam_xy = O + Vector((1.05, -2.72, 0))
    hd_cam = S.heading_to((cpos.x, cpos.y), (cam_xy.x, cam_xy.y))
    hd_sneeze = hd + (hd_cam - hd) * 0.62           # the sneeze plays to camera
    hd_end = hd_sneeze + 14
    lk = S.look_params((cpos.x, cpos.y), hd_end + 22, cpos.z + 0.57, eyep)
    tr = Track()
    tr.pose(0.0, dict(x=cpos.x, y=cpos.y, z=O.z, heading=hd, armR_up=38, armR_fwd=62, armR_bend=10, armL_up=-15, lean=8,
                      look_y=0.35, look_x=0.1, eye_open=0.95, eye_tilt=-0.2, pupil=1.0, head_nod=0, hop=0, head_turn=0,
                      eye_happy=0, head_tilt=0, squash=0, armL_fwd=0))
    # gets a grip... anticipation: lean in, then the yank (body throws back, arm whips back over the shoulder)
    tr.key(T_YANK - 0.3, "inout", lean=13, squash=-0.05, armR_up=42, armR_fwd=70, eye_tilt=-0.45, eye_open=0.8)
    tr.key(T_YANK - 0.05, "in", lean=16, squash=-0.08, armR_fwd=72)
    tr.key(T_YANK + 0.18, "snap", lean=-16, squash=0.07, armR_up=105, armR_fwd=-35, armR_bend=35, armL_up=25, eye_open=1.0,
           pupil=1.15, eye_tilt=0.0, look_y=0.5)
    # the dust reaches it: the sneeze builds (head tips back, eyes screw up)...
    tr.key(1.2, "linear", heading=hd)
    tr.key(1.45, "inout", lean=-4, squash=0.04, armR_up=10, armR_fwd=15, armR_bend=0, armL_up=0, eye_open=0.85, pupil=1.0,
           heading=hd_sneeze)
    tr.key(1.82, "in", lean=-15, squash=0.13, eye_open=0.25, eye_tilt=0.3, head_nod=-15, armL_up=24, armR_up=26,
           look_y=0.4)
    # ...ACHOO (1.9): snaps forward, eyes squeezed, arms fling
    tr.key(1.95, "snap", lean=8, squash=-0.1, eye_open=0.2, eye_tilt=0.65, eye_happy=0.0, head_nod=2, armL_up=-35,
           armR_up=-35, armL_fwd=45, armR_fwd=45, hop=0.05)
    tr.key(2.35, "out", lean=4, squash=0.0, eye_open=0.8, eye_tilt=0.1, eye_happy=0.0, head_nod=0, armL_up=-12, armR_up=-12,
           armL_fwd=10, armR_fwd=10, hop=0.0)
    # blinks, shakes it off, then turns to watch the star at the eyepiece (smiling)
    tr.key(2.4, "linear", heading=hd_sneeze)
    tr.key(2.85, "inout", heading=hd_end, look_x=lk["look_x"], look_y=lk["look_y"], head_turn=22, eye_open=0.95, pupil=1.08,
           eye_happy=0.45, head_tilt=9, eye_tilt=0.0)
    tr.key(dur, "soft", eye_happy=0.55, head_tilt=10)
    tr.layer(anim.wobble("roll", 2.0, 2.6, 7, freq=4.0, decay=5.0))
    tr.layer(anim.blinks(times=[0.35, 2.45], dur=0.14))
    tr.layer(anim.breathe(0.012, 0.35))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    fw = Vector((math.sin(math.radians(hd_sneeze)), -math.cos(math.radians(hd_sneeze)), 0))
    fx.puff("Sneeze", cpos + fw * 0.46 + Vector((0, 0, 0.4)), 1.91, f0, n=10, spread=0.05, grow=(0.03, 0.09), life=(0.35, 0.55),
            rise=0.03, drift=(fw.x * 0.9, fw.y * 0.9, -0.1), color=(0.97, 0.96, 0.93), opacity=0.26, seed=72)
    # cold morning light through the front window (behind camera) onto Claude and the telescope
    ld = bpy.data.lights.new("WinterKey", "AREA")
    ld.size = 1.2
    ld.color = (0.82, 0.88, 1.0)
    ld.energy = 38.0
    wk = bpy.data.objects.new("WinterKey", ld)
    bpy.context.scene.collection.objects.link(wk)
    scene.look_at(wk, O + Vector((1.75, -2.45, 1.65)), cpos + Vector((0.3, -0.1, 0.45)))
    # the star: hovers at Claude's shoulder watching; after the sneeze it zips to the eyepiece and peers in
    s = W.star()
    s.light_scale = 4.0
    sp0 = cpos + Vector((-0.25, 0.05, 1.02))
    look_dir = axis.copy()
    h_peer = math.degrees(math.atan2(look_dir.x, -look_dir.y))
    pitch_peer = -math.degrees(math.asin(max(-1.0, min(1.0, look_dir.z)))) * 0.7
    side = Vector((math.cos(math.radians(h_peer)), math.sin(math.radians(h_peer)), 0))
    peer = eyep - axis * 0.1 + side * 0.04          # one eye to the eyepiece
    st = Track()
    hs0 = S.heading_to((sp0.x, sp0.y), (base.x, base.y))
    st.pose(0.0, S.merge(S.S_CURIOUS, x=sp0.x, y=sp0.y, z=sp0.z, heading=hs0, glow=1.25, look_y=0.1, squash=0, arms=0,
                         pitch=0, eye_happy=0, legs=0, eyeL_open=0.0))
    st.key(T_YANK + 0.1, "snap", squash=0.12, eye_open=1.0, pupil=1.2, arms=25, look_x=0.4, look_y=0.35)
    st.key(1.75, "inout", squash=0.0, arms=10, pupil=1.15, look_x=0.6, look_y=-0.1)
    # anticipation, then the dart (audio: whoosh 2.0, tink on arrival 2.42)
    st.key(2.0, "in", squash=-0.15, x=sp0.x - 0.05, z=sp0.z + 0.05)
    st.key(2.42, "snap", x=peer.x, y=peer.y, z=peer.z, heading=h_peer, pitch=pitch_peer, squash=0.1, roll=0, pupil=1.2,
           eye_open=1.0, head=-10, glow=1.5, look_x=0.0, look_y=0.0)
    st.key(2.7, "inout", squash=0.0)
    st.key(3.0, "inout", eyeL_open=-0.85, eye_happy=0.25, glow=1.75, arms=30, legs=10)
    st.key(dur, "soft", glow=1.85, arms=38, eye_happy=0.35)

    def hover(t, p):
        if t < 2.0:
            p["z"] = p.get("z", 0) + 0.025 * math.sin(t * 2.6)
        else:
            p["roll"] = p.get("roll", 0) + 3 * math.sin(t * 3)
    st.layer(hover)
    st.layer(anim.blinks(times=[0.6, 1.5], dur=0.13))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # camera: by the front window, low-ish, looking back into the room past the telescope
    eye = O + Vector((1.05, -2.72, 0.86))
    tgt = cpos + Vector((0.4, -0.3, 0.64))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 22, push=0.07, lens_end=24, fstop=4.0, seed=27,
                      focus_on=cpos + Vector((0.3, 0, 0.5)), check_frame=f0 + 60, chars=[c])
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.4)), cam.location, (0.6, -0.6, 0.4), rim_col=(0.85, 0.9, 1.0), rim_w=20.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.4, bloom_thr=0.85, kuw_near=3, kuw_far=4, vignette=0.32, exposure=0.2),
                face_key=45.0)
