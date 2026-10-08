"""SH18 (4 beats) - "And ever since". Close on Claude on the sail tip, from the north over the cap: its face lit gold
by the new eye (off-screen above the lens), the night sky and the cloud sea behind it. Wet-eyed - big catch-lights -
it smiles. Then two slow blinks (BLINKS), the same as the ritual in SH03."""
import math
import bpy
from mathutils import Vector

from lu import anim, stage as S, sky, props
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots.sh10 import aimed_light, cam_track, night_post, FPS, heading_frame, key_energy, bake
from shots.sh15 import south_world, mount_matrix, key_sails, ride_point
from shots import sh16

BLINKS = (0.9, 1.75)    # two slow blinks (the ritual)


def tear(c, f0, f1, t0=0.35, t1=2.3):
    """A single tiny tear welling at the lower corner of Claude's right eye and sliding down its face."""
    from lu import mat, geo
    m = bpy.data.materials.get("Tear") or mat.painterly("Tear", (0.75, 0.85, 1.0), stroke="strokes_fine", scale=6.0,
                                                         tex_amt=0.2, spec=0.9, rough=0.08, emission=(0.9, 0.95, 1.0),
                                                         emit_str=0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012)
    o = bpy.context.active_object
    o.name = "Tear"
    o.data.materials.append(m)
    o.data.shade_smooth()
    o.visible_shadow = False
    o.parent = c.rig
    o.parent_type = "BONE"
    o.parent_bone = "head"
    rest = c.rig.pose.bones["head"].bone
    from mathutils import Matrix
    tail = rest.matrix_local @ Matrix.Translation((0, rest.length, 0))
    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        u = min(1.0, max(0.0, (t - t0) / 0.5))
        v = min(1.0, max(0.0, (t - t0 - 0.6) / (t1 - t0 - 0.6)))
        # rig-rest space: below the right eye (-X side), on the face (-Y)
        p = Vector((-0.215 + 0.004 * v, -0.215, 0.535 - 0.2 * anim.ease("in", v)))
        s = 0.25 + 0.75 * anim.ease("out", u)
        o.matrix_basis = tail.inverted() @ Matrix.Translation(p) @ Matrix.Diagonal((s, s * 0.6, s * (1 + 0.3 * v), 1))
        o.keyframe_insert("location", frame=f)
        o.keyframe_insert("rotation_euler", frame=f)
        o.keyframe_insert("scale", frame=f)
    return o


def make(f0, f1):
    W, K = south_world()
    dur = (f1 - f0) / FPS
    Mm = mount_matrix(W)
    key_sails(W, f0, f1, lambda t: 360.0)
    F = ride_point(Mm, 360.0)
    sky.emotion(0.7, f0)
    sky.emotion(0.65, f1)
    if K is not None:
        K["eye"]["eye"] = 1.7
        props.key_lines(1.2, f0)
        props.key_lines(1.05, f1)

    tr = Track()
    tr.pose(0.0, dict(heading=180.0, look_y=0.95, look_x=0.08, head_nod=-16, lean=-8, eye_happy=0.3, eye_open=0.95,
                      eye_tilt=0.3, pupil=1.32, glint=1.8, squash=0.03, armL_up=22, armR_up=26, armL_fwd=30,
                      armR_fwd=34, armL_curl=20, armR_curl=20))
    tr.key(0.62, "inout", eye_happy=0.62, eye_tilt=0.12)                     # the smile grows
    tr.key(BLINKS[1] + 0.5, "inout", eye_happy=0.82, eye_tilt=0.05, head_tilt=7, head_nod=-12, eye_open=0.85)
    tr.key(dur, "inout", eye_happy=0.9, head_tilt=9, pupil=1.25, look_y=0.9)
    for b in BLINKS:
        tr.layer(anim.blink_at(b, 0.44))

    def life(t, p):      # the hands come together at its chest; a held breath, then a soft sigh after the blinks
        u = t - (BLINKS[1] + 0.45)
        if u > 0:
            p["squash"] = p.get("squash", 0) - 0.025 * math.sin(math.pi * min(1.0, u / 0.6))
    tr.layer(life)
    tr.layer(anim.breathe(0.01, 0.25))
    anim.anchor(tr, C_DEF)
    c = W.claude()
    bake(c, tr, f0, f1, orient=lambda t, p: (F, heading_frame(180.0)))

    # ------------------------------------------------------------------ camera: CU from the north, a touch below the
    # eye line, slow push in
    face = F + Vector((0.0, 0.21, 0.56))
    aim = F + Vector((0.0, 0.21, 0.47))
    e0 = face + Vector((0.55, 2.45, -0.36))
    e1 = face + Vector((0.5, 2.25, -0.33))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, aim, 48, 2.4, None),
        (dur, "soft", e1, aim + Vector((0, 0, 0.01)), 52, 2.4, None)], f0, f1, seed=181, shake=0.05)
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ light: gold from the new eye (north, high),
    # a cool moon rim from behind, the glints
    eye_dir = sh16.eye_dir()
    gold = aimed_light("EyeGold", c.col, face + eye_dir * 2.6, face, 95.0, col=(1.0, 0.76, 0.36), size=1.6)
    key_energy(gold, f0, f1, lambda t: 95.0 * (1 + 0.06 * math.sin(t * 5.1) + 0.04 * math.sin(t * 8.3)))
    # starlight motes drifting down through the frame (the last of the ignition's gold)
    from lu import fx
    fx.motes("GoldMotes", face + Vector((0.0, 0.6, 0.2)), (3.2, 1.6, 2.0), n=90, f0=f0, f1=f1, drift=(0.02, 0.0, -0.06),
             seed=18, color=(1.0, 0.72, 0.3), strength=2.2)
    aimed_light("EyeFill", c.col, e0 + Vector((0, 0, 0.5)), face, 4.0, col=(1.0, 0.85, 0.7), size=1.5)
    aimed_light("RimMoon", c.col, F + Vector((-1.6, -2.0, 1.6)), face, 30.0, col=(0.6, 0.74, 1.0), size=1.2)
    return dict(post=night_post(W, bloom=0.85, mist_start=80.0, mist_depth=3000.0, vignette=0.42))
