"""B01 (0.00-5.00, 8 beats): EWS of the burnt valley. A slow lateral drift (24 mm) across endless charred trunks like
black needles, ash falling like slow snow, smoke columns leaning on the wind, embers glinting in the ash dunes. Tiny
orange Claude trudges left to right in the lower third, head hung, toward the stump of its home. Far off, above it,
the peak, where a soft patch of gold sun falls through a hole in the overcast: the goal, planted.
Feeling: desolation, loneliness (valence -2)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, sky
from lu.anim import Track
from shots import act_ash as A

# Claude's trudge (world xy, metres): small in the lower third, walking east toward the stump
WALK_FROM = (-6.6, -19.2)
WALK_TO = (-4.8, -18.7)


def make(f0, f1):
    dur = (f1 - f0) / 24
    W = world.World("ash", focus=(-3.0, -22.0), frames=(f0, f1))
    g = W.ground
    # framing trunks: a tall snag close on the left, a leaning dead tree and a fallen log on the right
    A.hero_trunks([(-5.4, -29.4, "snag", 13.0, 40, 2.0, -3.0), (-7.4, -27.0, "stub", 2.4, 120),
                   (5.6, -27.0, "dead", 6.0, 210, -4.0, 2.0), (-0.6, -28.2, "log", 0.9, 75),
                   (-12.5, -22.0, "snag", 10.5, 300), (9.5, -22.5, "snag", 11.5, 15, 3.0, 0.0)], name="ForestB01")
    # ---- Claude: a weary trudge, head hung, arms heavy
    c = W.claude()
    path = anim.Path([(0.0, *WALK_FROM), (dur, *WALK_TO)], ease_="linear")
    tr = Track()
    tr.pose(0.0, dict(A.ASH, lean=3.0, bend=7.0, head_nod=12.0, head_tilt=-3.0, squash=-0.04, armL_up=-62.0,
                      armR_up=-60.0, armL_bend=10.0, armR_bend=12.0, eye_open=0.55, eye_tilt=0.8, look_y=-0.5,
                      smile=-0.4))
    tr.key(2.6, "soft", head_nod=15.0, head_tilt=2.0)
    tr.key(dur, "soft", head_nod=12.0, head_tilt=-2.0)
    tr.layer(acting.breathe(0.012, 0.22, arms=1.0))
    tr.layer(anim.blinks(seed=3, every=(2.0, 3.2), dur=0.22))
    tr.layer(acting.walk(path, z_fn=g, stride=0.2, duty=0.66, lift=0.035, bob=0.012, lean=2.0, sway=3.0,
                         arm_swing=6.0, v_full=0.3))
    A.bake_claude(c, tr, f0, f1, settle=99.0)
    # footfall puffs (tiny at this distance, but they sell the soft ash)
    for k in range(8):
        t = 0.55 + k * 0.56
        x, y = path.pos(t)
        fx.dust_puff((x + 0.12, y - 0.1), f0 + int(t * 24), size=0.7, n=4, opacity=0.4, seed=110 + k,
                     color=A.ASH_PUFF)
    # ---- camera: a slow lateral drift right; Claude in the left third, the peak and its hole of sun above right
    e0 = Vector((-2.4, -35.0, g(-2.4, -35.0) + 1.35))
    e1 = Vector((-1.75, -34.95, g(-1.75, -34.95) + 1.4))
    az, el = math.radians(87.0), math.radians(5.5)
    t0 = e0 + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * 120.0
    t1 = t0 + (e1 - e0)
    A.cam_move("CamB01", f0, f1, [(0.0, "linear", e0, t0, 24.0, None), (dur, "linear", e1, t1, 24.0, None)],
               shake=0.04, seed=101)
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("ash", focus_xy=(0.33, 0.32), sat=A.SAT))
