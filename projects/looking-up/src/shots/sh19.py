"""SH19 (7 beats) - the bookend of SH01. Wide from the south, out over the edge of the island peak: the windmill on
its summit above the moonlit sea of clouds, Claude tiny, sitting on the tip of the top sail, and above them the whole
Claude-shaped constellation, its new eye shining gold. The eye twinkles twice back (TWINKLES). A slow pull back;
"LOOKING UP" fades in over the lower third (T_TITLE, composited in assemble.py - the lower third is kept clear)."""
import math
import bpy
from mathutils import Vector

from lu import anim, stage as S, sky, props
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots.sh10 import aimed_light, cam_track, night_post, FPS, heading_frame, bake, act1
from shots.sh15 import south_world, mount_matrix, key_sails, ride_point

TWINKLES = (0.9, 1.55)  # the new eye twinkles twice back
T_TITLE = 1.6           # the title fades in (assemble.py reads this)


def make(f0, f1):
    W, K = south_world()
    dur = (f1 - f0) / FPS
    O = W.origin
    Mm = mount_matrix(W)
    key_sails(W, f0, f1, lambda t: 360.0)
    F = ride_point(Mm, 360.0)
    sky.emotion(0.6, f0)
    sky.emotion(0.45, f1)
    if K is not None:
        eo = K["eye"]
        eo["eye"] = 1.7
        if hasattr(props, "twinkle"):
            props.twinkle(eo, f0, TWINKLES, dur=0.42, peak=2.4, spike=2.6)
        elif act1 is not None:
            act1.key_eye(K, f0, f1, act1.twinkle_fn(TWINKLES, base=1.7, peak=4.0))
        props.key_lines(1.0, f0)
        props.key_lines(0.75, f1)

    # ------------------------------------------------------------------ Claude: sitting on the tip, facing the sky
    tr = Track()
    seat = 0.0
    tr.pose(0.0, S.merge(S.C_SIT(seat), heading=180.0, look_y=0.9, eye_happy=0.6, head_nod=-14, lean=-6,
                         armL_up=-20, armR_up=-20))
    tr.layer(anim.breathe(0.012, 0.25))

    def swing(t, p):            # feet swinging gently over the edge
        for i, ph in enumerate((0.0, 1.6, 0.5, 2.1)):
            p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0) + 10 * math.sin(t * 2 * math.pi * 0.55 + ph)
    tr.layer(swing)
    anim.anchor(tr, C_DEF)
    c = W.claude()
    bake(c, tr, f0, f1, orient=lambda t, p: (F + Vector((0, 0.04, p.get("hop", 0.0))), heading_frame(180.0)))

    # ------------------------------------------------------------------ camera: SH01's postcard, a touch closer at
    # first, pulling slowly back to it
    def look(el_deg, az_deg=92.3):
        az, el = math.radians(az_deg), math.radians(el_deg)
        return Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    e0 = Vector((2.85, -43.0, 1.5))
    e1 = Vector((3.1, -50.0, 0.55))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, e0 + look(17.6) * 60.0, 18.5, 0.0, None),
        (dur, "soft", e1, e1 + look(15.8) * 60.0, 18, 0.0, None)], f0, f1, seed=191, shake=0.04)
    bpy.context.scene.camera = cam
    # Claude is tiny: a soft cool key + gold kicker from the eye keep its silhouette readable on the tip
    head = F + Vector((0, 0, 0.45))
    aimed_light("ClaudeKey", c.col, head + Vector((1.5, -3.0, 1.5)), head, 40.0, col=(0.7, 0.8, 1.0), size=2.0)
    aimed_light("ClaudeGold", c.col, head + Vector((-0.3, 3.0, 2.2)), head, 40.0, col=(1.0, 0.72, 0.36), size=2.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=70.0, mist_depth=2200.0, bloom=0.85,
                          bloom_thr=0.45, vignette=0.38))
