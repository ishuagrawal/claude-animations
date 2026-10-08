"""Staging helpers: pose library (emotion through body language), prop attachment to bones, visibility keys,
camera cuts, look-at helpers.

Body-language reference used for the pose library (animation acting principles): sadness collapses downward
(slump, lowered head, heavy arms, slow); joy opens up and rises (arms up, chest up, bounce, quick); fear
contracts and retreats (lean back, squash, arms in front, trembling, small pupils); curiosity leans in with a
head tilt; tiredness sags; guilt averts the eyes and turns the body away."""
import math
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- Claude poses
C_IDLE = dict()
C_TIRED = dict(slump=12, lean=6, armL_up=-38, armR_up=-38, eye_open=0.72, eye_tilt=0.25, squash=-0.04, look_y=-0.2)
C_SAD = dict(slump=24, lean=10, armL_up=-58, armR_up=-58, eye_open=0.5, eye_tilt=0.9, look_y=-0.7, squash=-0.07)
C_GUILT = dict(slump=18, lean=4, armL_up=-50, armR_up=-45, armR_fwd=25, eye_open=0.55, eye_tilt=0.7, look_x=-0.8,
               look_y=-0.5, head_turn=-14, squash=-0.05)
C_HAPPY = dict(eye_happy=0.8, armL_up=32, armR_up=32, squash=0.06, head_tilt=6)
C_CHEER = dict(armL_up=78, armR_up=78, armL_bend=22, armR_bend=22, eye_happy=0.9, squash=0.12, lean=-6)
C_FEAR = dict(lean=-11, squash=-0.12, pupil=0.72, eye_open=1.0, armL_up=42, armL_fwd=55, armL_bend=48,
              armR_up=42, armR_fwd=55, armR_bend=48, legs_splay=6)
C_SURPRISE = dict(squash=0.16, eye_open=1.0, pupil=1.18, armL_up=62, armR_up=62, lean=-8)
C_CURIOUS = dict(head_tilt=14, lean=9, pupil=1.08, eye_open=1.0)
C_DETERMINED = dict(squash=0.08, lean=-3, eye_tilt=-0.55, eye_open=0.82, armL_up=-10, armR_up=-10)
C_TENDER = dict(eye_happy=0.55, eye_open=0.85, head_tilt=10, slump=4, armL_up=-20, armR_up=-20)
C_WONDER = dict(eye_open=1.0, pupil=1.15, lean=-12, head_nod=-10, squash=0.05, armL_up=-15, armR_up=-15, look_y=0.8)


def C_SIT(seat_z=0.0):
    """Sitting: legs stick forward, body lowered so the leg tops rest on the seat."""
    return dict(leg0_swing=82, leg1_swing=82, leg2_swing=82, leg3_swing=82, leg0_knee=-8, leg1_knee=-8,
                leg2_knee=-8, leg3_knee=-8, hop=seat_z - 0.7 * 0.27 + 0.02)


C_SLEEP = dict(eye_open=0.0, slump=4, armL_up=-30, armR_up=-30, squash=-0.03)

# ---------------------------------------------------------------- star poses
S_IDLE = dict()
S_SCARED = dict(curl=38, squash=-0.14, glow=1.7, pupil=0.78, eye_open=1.0, droop=12)
S_HAPPY = dict(eye_happy=0.8, arms=26, glow=1.35, head=-8)
S_JOY = dict(eye_happy=0.95, arms=45, legs=12, glow=1.6, head=-14, squash=0.1)
S_CURIOUS = dict(head=-16, pupil=1.12, eye_open=1.0, roll=10)
S_SHY = dict(curl=18, droop=18, look_x=-0.7, look_y=-0.4, eye_open=0.75, glow=1.0, roll=-8)
S_SLEEP = dict(eye_open=0.0, curl=14, droop=10, glow=0.55, squash=-0.06)
S_SAD = dict(droop=40, legs=-8, eye_tilt=0.8, eye_open=0.55, look_y=-0.6, head=18, glow=0.8)
S_DIM = dict(droop=48, legs=-12, glow=0.22, warmth=0.18, eye_open=0.45, eye_tilt=0.8, look_y=-0.6, head=22)
S_LONGING = dict(head=-22, pupil=1.1, eye_open=0.95, look_y=0.9, arms=8, glow=1.15)
S_ANGRY = dict(curl=-10, squash=0.12, glow=2.2, eye_tilt=-0.8, eye_open=0.7, pupil=0.9, arms=-15)


def merge(*ds, **kw):
    out = {}
    for d in ds:
        out.update(d)
    out.update(kw)
    return out


# ---------------------------------------------------------------- props on bones
def attach(prop, char, bone, world_at, pose=None):
    """Parent prop to char's bone. With the character at the origin (heading 0) in `pose` (dict; None = rest pose),
    the prop sits at world_at (Matrix 4x4 or Vector, character-local metres). Call before baking."""
    rig = char.rig
    p = dict(pose or {})
    p.update(x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0)
    char.apply(p)
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    tail = rig.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    if isinstance(world_at, Vector) or (isinstance(world_at, (tuple, list)) and len(world_at) == 3):
        world_at = Matrix.Translation(Vector(world_at))
    prop.parent = rig
    prop.parent_type = "BONE"
    prop.parent_bone = bone
    prop.matrix_parent_inverse = Matrix.Identity(4)
    prop.matrix_basis = tail.inverted() @ world_at
    return prop


def vis(obj, frame, visible):
    obj.hide_render = not visible
    obj.hide_viewport = not visible
    obj.keyframe_insert("hide_render", frame=frame)
    obj.keyframe_insert("hide_viewport", frame=frame)


def vis_range(obj, f_on, f_off, f_start, f_end):
    """Visible only in [f_on, f_off)."""
    vis(obj, f_start, f_start >= f_on and f_start < f_off)
    if f_on > f_start:
        vis(obj, f_on, True)
    if f_off <= f_end:
        vis(obj, f_off, False)


def cut(cam_obj, frame):
    m = bpy.context.scene.timeline_markers.new(f"cut_{cam_obj.name}_{frame}", frame=frame)
    m.camera = cam_obj
    return m


def heading_to(src_xy, dst_xy):
    """Character heading (deg, 0 = facing -Y) to face from src toward dst."""
    dx, dy = dst_xy[0] - src_xy[0], dst_xy[1] - src_xy[1]
    return math.degrees(math.atan2(dx, -dy))


def look_params(char_xy, heading_deg, eye_z, target):
    """look_x / look_y (approx -1..1) for eyes looking at a world target from a character at char_xy."""
    h = math.radians(heading_deg)
    fwd = Vector((math.sin(h), -math.cos(h), 0))
    right = Vector((math.cos(h), math.sin(h), 0)) * -1      # character's right (screen-left when facing camera)
    d = Vector(target) - Vector((char_xy[0], char_xy[1], eye_z))
    horiz = math.atan2(-d.dot(right), max(d.dot(fwd), 1e-3))
    vert = math.atan2(d.z, math.hypot(d.x, d.y))
    return dict(look_x=max(-1.2, min(1.2, horiz / 0.7)), look_y=max(-1.2, min(1.2, vert / 0.6)))


def key_obj_path(obj, f0, f1, fn):
    """Keyframe an object's transform from fn(t) -> Matrix (world)."""
    for f in range(f0, f1 + 1):
        t = (f - f0) / 24.0
        obj.matrix_world = fn(t)
        obj.keyframe_insert("location", frame=f)
        obj.keyframe_insert("rotation_euler", frame=f)
        obj.keyframe_insert("scale", frame=f)


def cam_from(target, heading_deg, yaw=30.0, dist=2.0, height=0.0, look_z=0.0):
    """Camera position relative to a character: yaw degrees around from its FRONT (0 = straight on,
    +yaw = toward its left/screen-right), at dist metres, raised by height. Returns (eye, look_target)."""
    h = math.radians(heading_deg + yaw)
    front = Vector((math.sin(h), -math.cos(h), 0.0))
    t = Vector(target)
    eye = t + front * dist + Vector((0, 0, height))
    return eye, t + Vector((0, 0, look_z))
