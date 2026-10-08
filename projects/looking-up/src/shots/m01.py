"""M01 — INT morning: Claude holds up a flour sack with a star-shaped hole burned clean through it, eyes flat.
The star, hovering beside, looks anywhere but at Claude (sheepish). Claude's look softens — a sigh, a tiny smile."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.d01 import anchor


def settle(tr, defaults, max_gap=0.8):
    """Track params hold their first key's value before it and glide across the whole gap between two keys. Anchor
    every param at t=0 (its default unless the t=0 pose sets it), and insert a hold so no change takes longer than
    max_gap seconds: each move starts at most max_gap before the key that ends it (montage acting is quick)."""
    anchor(tr, defaults)
    extra = []
    for k, ks in tr._chan().items():
        for (t0, v0, _), (t1, v1, _) in zip(ks, ks[1:]):
            if t1 - t0 > max_gap + 1e-6 and abs(v1 - v0) > 1e-9:
                extra.append((t1 - max_gap, k, v0))
    for t, k, v in extra:
        tr.key(t, "linear", **{k: v})
    return tr


def star_hole_sack(name="HoleSack"):
    sack_m = bpy.data.materials.get("IntSack")
    sk = geo.rounded_box(name, (0.46, 0.18, 0.56), 0.08, seg=(4, 2, 4), n_r=3, mat=sack_m)
    geo.displace_noise(sk, 0.012, 0.15, seed=31)
    # charred star-shaped hole decal on the front face
    from lu.star import _profile
    verts, faces = [(0.0, -0.095, 0.02)], []
    n = 60
    for i in range(n):
        th = 2 * math.pi * i / n
        R = _profile(th) * 0.95
        verts.append((math.sin(th) * R, -0.096, 0.02 + math.cos(th) * R))
    for i in range(n):
        faces.append((0, 1 + i, 1 + (i + 1) % n))
    hm = bpy.data.materials.get("Char") or mat.painterly("Char", (0.03, 0.02, 0.015), stroke="strokes_fine", scale=6,
                                                         emission=(1.0, 0.35, 0.08), emit_str=0.0)
    hole = geo.obj_from(name + "_hole", verts, faces, None, hm, smooth=False)
    rim = []
    for i in range(n):
        th = 2 * math.pi * i / n
        R = _profile(th) * 1.05
        rim.append((math.sin(th) * R, -0.0965, 0.02 + math.cos(th) * R))
    rv, rf = [], []
    for i in range(n):
        th = 2 * math.pi * i / n
        R0, R1 = _profile(th) * 0.95, _profile(th) * 1.18
        rv += [(math.sin(th) * R0, -0.097, 0.02 + math.cos(th) * R0), (math.sin(th) * R1, -0.097, 0.02 + math.cos(th) * R1)]
    for i in range(n):
        a, b = 2 * i, 2 * ((i + 1) % n)
        rf.append((a, b, b + 1, a + 1))
    sm = bpy.data.materials.get("Scorch") or mat.painterly("Scorch", (0.16, 0.09, 0.05), stroke="strokes_fine", scale=6, tex_amt=1.2)
    scorch = geo.obj_from(name + "_scorch", rv, rf, None, sm, smooth=False)
    return geo.join([sk, hole, scorch], name)


def make(f0, f1):
    W = world.World("int", "day", sun_dir=(0.6, -0.65, 0.35))
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    W.practicals(fill=8.0, stove=2.5)
    pos = L(-0.3, -0.5)
    cam_xy = L(1.4, -2.05)
    hd = S.heading_to((pos.x, pos.y), (cam_xy.x, cam_xy.y)) - 22      # 3/4 to camera, turned a little to the star
    c = W.claude()
    sack = star_hole_sack()
    # the evidence, held up beside its head in the left (near) hand, the burnt star hole facing out
    hold = dict(armL_up=58, armL_fwd=22, armL_bend=8, armR_up=-20)
    hp = dict(hold, x=0.0, y=0.0, z=0.0, heading=0.0)
    c.apply(hp)
    bpy.context.view_layer.update()
    hand = c.rig.matrix_world @ c.rig.pose.bones["armL2"].tail
    # gripped by its bottom corner, the sack hangs beside Claude's head
    S.attach(sack, c, "armL2", Matrix.Translation(hand + Vector((0.2, 0.06, 0.22))) @
             Matrix.Rotation(math.radians(10), 4, "Y"), pose=hold)
    s = W.star()
    s.light_scale = 6.0
    sp = pos - Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0)) * 0.72 + Vector((0, 0, 0.8))
    lk = S.look_params((pos.x, pos.y), hd, pos.z + 0.57, sp)
    lk_sack = S.look_params((pos.x, pos.y), hd, pos.z + 0.57, pos + Vector((0, 0, 0.8)) +
                            Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0)) * 0.6)
    tr = Track()
    tr.pose(0.0, S.merge(hold, x=pos.x, y=pos.y, z=O.z, heading=hd, eye_open=0.55, eye_tilt=-0.2, look_x=lk["look_x"],
                         look_y=lk["look_y"], head_turn=-6, lean=-3, slump=0, squash=0, head_nod=0, eye_happy=0,
                         head_tilt=0))
    # a pointed glance at the hole... and back to the culprit (flat, unamused)
    tr.key(0.7, "inout", look_x=lk_sack["look_x"], look_y=lk_sack["look_y"], head_turn=8, eye_open=0.5)
    tr.key(1.3, "inout", look_x=lk["look_x"], look_y=lk["look_y"], head_turn=-10, eye_open=0.5, eye_tilt=-0.3, armL_up=66)
    tr.key(2.2, "linear", head_turn=-12)
    # the sigh: deflates, eyes drop, the sack sags...
    tr.key(2.75, "inout", slump=10, squash=-0.05, eye_open=0.32, eye_tilt=0.25, look_y=-0.3, armL_up=48, head_nod=6)
    # ...and softens: a little smile, head tilt
    tr.key(3.4, "inout", slump=3, squash=0.01, eye_happy=0.5, eye_open=0.8, eye_tilt=0.0, head_tilt=10, head_nod=0,
           look_x=lk["look_x"], look_y=lk["look_y"], armL_up=54)
    tr.key(dur, "soft", eye_happy=0.6, head_tilt=12)
    tr.layer(anim.blinks(times=[0.35, 1.9], dur=0.18))
    tr.layer(anim.breathe(0.012, 0.3))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    hs = S.heading_to((sp.x, sp.y), (cam_xy.x, cam_xy.y))
    st = Track()
    # sheepish: curled in, looking anywhere but at Claude (up, away, down...)
    st.pose(0.0, S.merge(S.S_SHY, x=sp.x, y=sp.y, z=sp.z, heading=hs - 10, glow=0.95, look_x=-0.7, look_y=-0.35,
                         eye_tilt=0.45, eye_open=0.9, eye_happy=0, arms=0))
    st.key(0.9, "inout", look_x=-0.75, look_y=0.25, roll=-6, heading=hs - 25)
    st.key(1.5, "inout", look_x=-0.2, look_y=-0.55, roll=6, heading=hs - 5, eye_open=0.8)
    st.key(2.2, "inout", look_x=-0.65, look_y=-0.3, eye_open=0.85, heading=hs - 20)
    # a peek at Claude as it sighs... then a relieved, grateful little smile
    st.key(2.85, "inout", look_x=0.75, look_y=0.0, eye_open=0.85, heading=hs + 15, droop=10, curl=10)
    st.key(3.4, "inout", **S.merge(S.S_HAPPY, look_x=0.8, look_y=0.05, glow=1.25, curl=8, eye_tilt=0.0, heading=hs + 20))
    st.key(dur, "soft", eye_happy=0.65)

    def hover(t, p):
        p["z"] = p.get("z", 0) + 0.025 * math.sin(t * 2.6)
        p["roll"] = p.get("roll", 0) + 3 * math.sin(t * 1.7)
    st.layer(hover)
    st.layer(anim.blinks(times=[0.65, 2.0], dur=0.13))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    eye = L(1.4, -2.05, 0.86)
    tgt = pos + Vector((0.1, 0.05, 0.62))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 30, push=0.08, lens_end=32, fstop=3.2, seed=21, chars=[c],
                      focus_on=pos + Vector((0, 0, 0.55)))
    scene.char_lights(c.col, pos + Vector((0, 0, 0.5)), cam.location, (0.6, -0.65, 0.35), rim_col=(1.0, 0.85, 0.65), rim_w=16.0)
    return dict(post=dict(haze_amt=0.0, bloom=0.4, bloom_thr=0.8, kuw_near=3, kuw_far=4, vignette=0.3, exposure=0.15))
