"""L01 — INT night: Claude, hollow, sits at the table with the old star book, turning pages without seeing them... a page
stops it: a comet arcing over a little peak with a windmill — and three moons in a row: three nights. Claude's body
straightens; the eyes set. Determination."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, finale, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.d01 import lantern_on_table, anchor, face_light, close_door

T_SEE = 1.6
T_RESOLVE = 3.0
T_B = 1.75          # cut to the page
T_C = 2.72          # back on Claude


def make(f0, f1):
    W = world.World("int", "night")
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    pr = W.practicals(stove=0.6, candle=3.2)
    close_door(W)
    tbl = W.I["table"]["top"]
    seat = W.I["table"]["seat"]
    for nm in ("cup", "pot"):
        W.I["table"][nm].hide_render = True
    W.I["shelves"]["star_book"].hide_render = True
    book = finale.star_book()
    cpos = O + Vector((seat.x, seat.y, 0))
    hd = S.heading_to((seat.x, seat.y), (tbl.x, tbl.y))
    fwd = Vector((math.sin(math.radians(hd)), -math.cos(math.radians(hd)), 0))
    rgt = Vector((-math.cos(math.radians(hd)), -math.sin(math.radians(hd)), 0))     # Claude's right
    bp = O + tbl - fwd * 0.14 + Vector((0, 0, 0.005))
    book.location = bp
    book.rotation_euler = (0, 0, math.radians(hd + 180))       # page tops away from Claude: it reads them upright
    page_c = bp + rgt * 0.12 + Vector((0, 0, 0.03))           # the comet page (right-hand page)
    c = W.claude()
    tr = Track()
    tr.pose(0.0, S.merge(S.C_SIT(seat.z), S.C_SAD, x=cpos.x, y=cpos.y, z=O.z, heading=hd, look_y=-0.85, slump=14,
                         armL_fwd=62, armR_fwd=62, armL_up=-2, armR_up=-2, eye_open=0.45, eye_tilt=0.7))

    def turn_pages(t, p):
        # turning pages, slowly, without seeing them
        if t < T_SEE - 0.1:
            p["armR_curl"] = p.get("armR_curl", 0) + 32 * max(0, math.sin(t * 3.6))
            p["armR_fwd"] = p.get("armR_fwd", 0) + 6 * math.sin(t * 3.6)
    tr.layer(turn_pages)
    tr.key(T_SEE, "linear", eye_open=0.45, slump=14)
    # ...a page stops it
    tr.key(T_SEE + 0.25, "snap", eye_open=0.98, pupil=1.18, slump=8, look_y=-0.7, eye_tilt=0.1, squash=0.03)
    tr.key(T_RESOLVE, "inout", look_y=-0.55, eye_tilt=0.0, head_nod=4, pupil=1.12)
    # straightens; the eyes set
    tr.key(T_RESOLVE + 0.7, "back", **S.merge(S.C_DETERMINED, slump=0, look_y=0.1, look_x=0.0, head_nod=-5, armL_up=12,
                                              armR_up=12, armL_fwd=30, armR_fwd=30, pupil=1.0))
    tr.key(dur, "soft", eye_tilt=-0.62, squash=0.1, eye_open=0.85)
    tr.layer(anim.breathe(0.012, 0.3))
    tr.layer(anim.blinks(times=[0.9, 4.3], dur=0.2))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # the lantern, the star asleep in it, barely glowing, at the far corner of the table
    lan, lp, sp = lantern_on_table(W)
    lp = O + tbl + fwd * 0.28 + rgt * 0.2
    lan["root"].location = lp
    s = W.star()
    s.light_scale = 2.0
    sp = lp + Vector((0, 0, 0.17))
    # cameras: A/C across the table from the window side, B Claude's view down onto the page
    eA = O + Vector((1.2, 2.42, 1.02))
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=sp.x, y=sp.y, z=sp.z, scale=0.55, glow=0.26, warmth=0.38, droop=40,
                         heading=S.heading_to((sp.x, sp.y), (eA.x, eA.y)) - 25))
    st.layer(lambda t, p: p.update(glow=0.26 * (1 + 0.12 * math.sin(t * 1.5))))
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    lan["root"].rotation_euler.z = math.atan2(eA.y - lp.y, eA.x - lp.x) - math.radians(30)
    # move the candle beside the book so the page is lit
    cnd, flm = W.I["table"]["candle"], W.I["table"]["flame"]
    cnd_p = O + tbl + fwd * 0.05 + rgt * 0.3
    for o in (cnd, flm):
        o.parent = None
    cnd.location = cnd_p
    flm.location = cnd_p + Vector((0, 0, 0.125))
    if pr.get("candle"):
        pr["candle"].location = cnd_p + Vector((0, 0, 0.17))
    face = cpos + Vector((0, 0, 0.88))
    tA = face * 0.5 + bp * 0.25 + sp * 0.25
    camA = FR.shot_cam("CamA", f0, f0 + int(T_B * 24), eA, tA, 30, push=0.05, fstop=2.8, seed=61, check=False,
                       focus_on=face * 0.7 + bp * 0.3)
    # B: down onto the page — the comet over the windmill on its peak, three moons in a row
    eB = page_c - fwd * 0.26 - rgt * 0.03 + Vector((0, 0, 0.74))
    camB = FR.shot_cam("CamB", f0 + int(T_B * 24), f0 + int(T_C * 24), eB, page_c + fwd * 0.015 - rgt * 0.03, 40, push=0.1,
                       fstop=4.0, shake=0.1, seed=62, check=False)
    # C: back on Claude's face as it resolves
    eC = O + Vector((1.25, 2.3, 0.98))
    tC = face * 0.75 + sp * 0.25 + Vector((0, 0, 0.05))
    camC = FR.shot_cam("CamC", f0 + int(T_C * 24), f1, eC, tC, 38, push=0.06, fstop=2.6, seed=63, check=False,
                       focus_on=face)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_B * 24))
    S.cut(camC, f0 + int(T_C * 24))
    bpy.context.scene.camera = camC
    face_light(c, eA, cnd_p, energy=34.0, frame=f0 + int(3.8 * 24))
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.5, bloom_thr=0.65, kuw_near=3, kuw_far=4, vignette=0.5))
