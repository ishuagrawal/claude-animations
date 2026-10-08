"""Scene / render settings shared by every shot."""
import bpy
import math
from mathutils import Vector, Matrix

W, H = 1920, 816          # 2.35:1 scope (the reference's active picture), padded to 1080 at encode
FPS = 24


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = W
    sc.render.resolution_y = H
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    ee = sc.eevee
    ee.taa_render_samples = 64
    ee.use_shadows = True
    ee.shadow_ray_count = 2
    ee.shadow_step_count = 8
    ee.shadow_pool_size = "1024"     # storm/finale scenes overflow the default 512 MB pool
    ee.use_raytracing = False
    ee.volumetric_tile_size = "4"
    ee.volumetric_samples = 64
    ee.use_volumetric_shadows = True
    ee.bokeh_max_size = 60
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    ee.motion_blur_steps = 1
    vs = sc.view_settings
    vs.view_transform = "Standard"
    vs.look = "None"
    vs.exposure = 0.0
    vs.gamma = 1.0
    sc.display_settings.display_device = "sRGB"
    sc.sequencer_colorspace_settings.name = "sRGB"
    return sc


def world_color(top, horizon, strength=1.0, bottom=None):
    """Simple gradient world used for ambient light (the visible sky is built separately)."""
    w = bpy.data.worlds.get("LU_World") or bpy.data.worlds.new("LU_World")
    bpy.context.scene.world = w
    w.use_nodes = True
    t = w.node_tree
    t.nodes.clear()
    tc = t.nodes.new("ShaderNodeTexCoord")
    sep = t.nodes.new("ShaderNodeSeparateXYZ")
    t.links.new(tc.outputs["Generated"], sep.inputs[0])
    rmp = t.nodes.new("ShaderNodeValToRGB")
    t.links.new(sep.outputs[2], rmp.inputs[0])
    cr = rmp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*(bottom or horizon), 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (*top, 1)
    e = cr.elements.new(0.5)
    e.color = (*horizon, 1)
    bg = t.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    t.links.new(rmp.outputs[0], bg.inputs[0])
    out = t.nodes.new("ShaderNodeOutputWorld")
    t.links.new(bg.outputs[0], out.inputs[0])
    return w


def sun(name, rot_deg, color, energy, angle=2.0, shadow=True):
    ld = bpy.data.lights.new(name, "SUN")
    ld.color = color
    ld.energy = energy
    ld.angle = math.radians(angle)
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = [math.radians(a) for a in rot_deg]
    return ob


def point(name, loc, color, energy, radius=0.1, shadow=True):
    ld = bpy.data.lights.new(name, "POINT")
    ld.color = color
    ld.energy = energy
    ld.shadow_soft_size = radius
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    return ob


def camera(name="Cam", lens=35.0, loc=(0, -5, 1), target=(0, 0, 0.5), fstop=None, focus=None, sensor=36.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = sensor
    cd.sensor_fit = "HORIZONTAL"
    cd.clip_start = 0.05
    cd.clip_end = 5000
    ob = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    look_at(ob, loc, target)
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus if focus else (Vector(target) - Vector(loc)).length
    return ob


def look_at(ob, loc, target, roll=0.0):
    ob.location = loc
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = q @ Matrix.Rotation(math.radians(roll), 4, "Z").to_quaternion()


def render_still(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def sun_screen(cam, sun_dir):
    """Screen position (0..1, 0..1 from bottom-left) of a direction as seen by the camera."""
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    p = cam.matrix_world.translation + Vector(sun_dir).normalized() * 3000.0
    v = world_to_camera_view(bpy.context.scene, cam, p)
    return (v.x, v.y) if v.z > 0 else None


def char_lights(collection, target, cam_loc, sun_dir, rim_col=(1.0, 0.7, 0.45), rim_w=350.0,
                fill_col=(0.75, 0.82, 1.0), fill_w=0.0, rim_dist=2.6, name="CharRig"):
    """Light-linked rim (from behind, sun side) + optional soft fill for characters only."""
    t = Vector(target)
    cam = Vector(cam_loc)
    view = (t - cam)
    view.z = 0
    view.normalize()
    sd = Vector(sun_dir)
    sd.z = 0
    sd = sd.normalized() if sd.length > 1e-4 else view
    # rim sits behind the subject, biased toward the sun side
    back = (view * 0.6 + sd * 0.8).normalized()
    out = {}
    for key, pos, col, w, size in (("rim", t + back * rim_dist + Vector((0, 0, 1.1)), rim_col, rim_w, 1.2),
                                   ("fill", t - view * 3.0 + Vector((0, 0, 1.4)) + view.cross(Vector((0, 0, 1))) * 1.2, fill_col, fill_w, 3.0)):
        if w <= 0:
            continue
        ld = bpy.data.lights.new(f"{name}_{key}", "AREA")
        ld.color = col
        ld.energy = w
        ld.size = size
        ld.use_shadow = key == "rim"
        ob = bpy.data.objects.new(f"{name}_{key}", ld)
        bpy.context.scene.collection.objects.link(ob)
        look_at(ob, pos, t + Vector((0, 0, 0.35)))
        ob.light_linking.receiver_collection = collection
        out[key] = ob
    return out
