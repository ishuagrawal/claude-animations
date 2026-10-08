"""World assembly per shot: sky/time-of-day, exterior peak or interior room, characters. Layout is fixed so
continuity holds across shots (the windmill, trees, rocks and the lookout spot never move)."""
import math
import bpy
import numpy as np
from mathutils import Vector

from . import scene, sky, terrain, windmill, foliage, clouds, claude, star, post, mat, geo, interior, props, dress

WM_XY = terrain.WINDMILL
LOOKOUT = (10.5, -18.5)          # the cliff-edge spot (M11), a lone pine beside it

# hero pines (x, y, height): the plateau's framing pine edges. The north view (layout.NORTH_VIEW from GALLERY_N and
# CRATER) stays free of tall trees; short rim firs on the north rim give low meadow cameras a "pine edge".
PINES = [(-12.5, -7.5, 9), (-14.5, -3.5, 11), (-10.8, -10.5, 6.5), (14.5, 3.0, 10), (16.5, -2.0, 8),
         (9.0, 15.5, 12), (-8.0, 16.0, 10), (13.0, 9.5, 7), (-16.5, 6.0, 9), (-11.5, 19.5, 8), (12.5, 19.5, 11),
         (17.5, 8.5, 9.5), (-18.0, -1.0, 7), (13.2, -17.2, 7.5), (-6.5, -19.0, 6), (19.5, -8.5, 6.5)]
PINES_EDGE = [(17.0, 14.5, 9), (15.5, 18.5, 7.5), (11.0, 22.0, 6), (-14.0, 17.5, 9), (-9.5, 22.0, 7), (-17.5, 12.5, 8),
              (-20.5, 3.0, 8.5), (-19.0, -6.5, 9), (-21.5, -2.0, 6.5), (19.0, 5.0, 8), (21.0, -4.0, 7.5),
              (18.5, 12.0, 6.5), (-10.0, -17.5, 8), (8.0, -21.0, 6.0), (-15.5, -13.5, 7.0), (16.5, -12.5, 7.5)]
RIM_FIRS = [(5.6, 21.6, 3.9), (6.6, 21.0, 3.1), (4.6, 22.3, 2.6), (-1.2, 22.6, 3.4), (-2.4, 22.0, 4.2), (-3.6, 23.0, 2.9)]
SLOPE_PINES = [(-24.0, 12.0, 9), (-27.0, 4.0, 10), (-26.0, -8.0, 9), (-20.0, -18.0, 8), (-12.0, -25.0, 9),
               (10.0, -26.0, 8), (20.0, -19.0, 10), (26.0, -6.0, 9), (27.0, 5.0, 11), (23.0, 15.0, 9),
               (-22.0, 18.0, 10), (0.5, -28.0, 7), (-5.5, -27.5, 8), (5.5, -27.8, 7.5), (16.0, 22.5, 8), (-16.0, 23.0, 8)]
BUSHES = [(-3.8, 3.4, 0.8), (4.6, 3.2, 0.7), (-6.5, -2.0, 1.1), (7.5, -9.0, 0.8), (-9.5, 9.0, 1.0), (10.5, 6.0, 0.9),
          (12.0, -14.5, 0.7), (-11.0, -14.0, 0.9), (-6.8, 12.5, 0.9), (8.5, 12.0, 0.8), (-5.5, 18.5, 1.0),
          (7.5, 19.5, 0.9), (-4.5, -9.5, 0.7), (5.2, -12.0, 0.8)]
BLOSSOM = {0: 0.25, 1: 0.2, 9: 0.15, 12: 0.2}          # wild roses: bush index -> blossom density
ROCKS = [(-15.0, -12.0, 1.6), (20.5, 2.0, 1.8), (-20.0, 8.0, 2.0),
         (6.0, -22.5, 1.4), (-8.5, -21.5, 1.2), (16.0, 14.0, 1.7), (-14.0, 15.0, 1.5), (9.5, 24.0, 2.0),
         (-3.0, -12.0, 0.5), (5.8, -4.2, 0.45), (-9.2, 6.8, 0.55)]


def all_pines():
    return PINES + PINES_EDGE


class World:
    current = None

    def __init__(self, kind="ext", preset="golden", season="summer", sun_dir=None, overrides=None,
                 windmill_state=None, interior_state=None, clouds_on=True, detail=1.0, with_interior=False):
        self.kind = kind
        World.current = self
        P = dict(sky.PRESETS[preset])
        if sun_dir:
            P["sun_dir"] = sun_dir
        if overrides:
            P.update(overrides)
        self.lights, self.P = sky.build(P)
        self.H = terrain.height
        self.season = season
        self.detail = detail
        look = {}
        if season == "winter":
            look["Snow"] = 1.0
        if season == "autumn":
            look["Autumn"] = 0.85
        if look:
            mat.set_look(**look)
        self.wm = None
        self.I = None
        self.origin = Vector((WM_XY[0], WM_XY[1], float(terrain.height(*WM_XY))))
        if kind in ("ext", "int"):
            self._exterior(full=(kind == "ext"), windmill_state=windmill_state or {}, clouds_on=clouds_on)
        if kind == "int" or with_interior:
            if kind == "int":
                sky.interior_mode("night" if preset in ("night", "dusk", "storm") else "day")
            st = interior_state or {}
            self.I = interior.build(origin=self.origin, telescope_covered=st.get("telescope_covered", True),
                                    crater=st.get("crater", False))
            if with_interior and self.wm:
                # the interior's walls replace the solid base core; exterior glass becomes see-through
                core = bpy.data.objects.get("BaseCore")
                if core:
                    bpy.data.objects.remove(core)
                for wn in ("WinFront", "WinSide"):
                    o = bpy.data.objects.get(wn)
                    if o:
                        o.hide_render = True
        self.chars = {}

    # ------------------------------------------------------------------ exterior
    def _exterior(self, full, windmill_state, clouds_on):
        H = terrain.height
        terrain.build()
        ws = dict(windmill_state)
        rk_m = mat.painterly("Rock", (0.42, 0.39, 0.42), stroke="strokes_vert", scale=0.9, tex_amt=1.0, breakup=1.4,
                             color2=(0.24, 0.33, 0.10), c2_thresh=(0.52, 0.62), bump=0.3, ao=0.4)
        for i, (x, y, s) in enumerate(ROCKS):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
            o = bpy.context.active_object
            o.name = f"Rock{i}"
            geo.displace_noise(o, 0.35, 0.9, seed=i)
            o.scale = (s * 1.2, s, s * 0.6)
            o.location = (x, y, float(H(x, y)) - s * 0.25)
            o.rotation_euler = (0.1 * math.sin(i), 0.1 * math.cos(i), i * 1.7)
            o.data.shade_smooth()
            o.data.materials.append(rk_m)
        foliage.wind(heading=ws.get("wind_heading"), breeze=ws.get("breeze"))
        keep = [(x, y, s * 1.05) for (x, y, s) in ROCKS]
        rects = []
        self.yard = None
        if full:
            self.wm = windmill.build(origin=tuple(self.origin), sails_angle=ws.get("sails_angle", 0.0),
                                     canvas=ws.get("canvas", (1, 1, 1, 1)), shutters_open=1.0)
            windmill.set_window_glow(ws.get("window_glow", 0.0))
            if ws.get("door_lantern") or ws.get("gallery_hook"):
                windmill.lanterns(self.wm, door=bool(ws.get("door_lantern")), gallery=ws.get("gallery_hook", False),
                                  door_energy=ws.get("door_energy", 14.0))
            if ws.get("yard", True):
                self.yard = dress.yard(self.origin)
                keep += self.yard["keep_clear"]
                rects.append(self.yard["garden"])
        d = self.detail
        for i, (x, y, h) in enumerate(PINES):
            foliage.pine(f"Pine{i}", (x, y, float(H(x, y))), height=h, radius=h * 0.3, seed=i, density=2.2 * d)
        for i, (x, y, h) in enumerate(PINES_EDGE):
            foliage.pine(f"PineE{i}", (x, y, float(H(x, y))), height=h, radius=h * 0.3, seed=40 + i, density=1.8 * d,
                         detail=0.8, broken=(i % 5 == 2))
        for i, (x, y, h) in enumerate(RIM_FIRS):
            foliage.pine(f"PineR{i}", (x, y, float(H(x, y))), height=h, radius=h * 0.32, seed=70 + i, density=2.2 * d)
        for i, (x, y, h) in enumerate(SLOPE_PINES):
            foliage.pine(f"PineS{i}", (x, y, float(H(x, y))), height=h, radius=h * 0.28, seed=90 + i, density=1.4 * d,
                         detail=0.45)
        keep += [(x, y, 0.45) for (x, y, h) in PINES + PINES_EDGE + RIM_FIRS]
        for i, (x, y, r) in enumerate(BUSHES):
            foliage.bush(f"Bush{i}", (x, y, float(H(x, y)) + r * 0.3), r, seed=i, blossoms=BLOSSOM.get(i, 0.0))
            keep.append((x, y, r * 0.55))

        def avoid(x, y):
            return (math.hypot(x - WM_XY[0], y - WM_XY[1]) < (4.4 if full else 3.2) or abs(x - terrain.path_x(y)) < 0.55
                    or math.hypot(x - LOOKOUT[0], y - LOOKOUT[1]) < 2.6)
        self.avoid = avoid
        self.cover = None
        if self.season != "winter":
            self.cover = dress.meadow(detail=d if full else d * 0.5, keep_clear=keep, keep_rects=rects)
        if clouds_on:
            clouds.sea()
            clouds.floor()
            clouds.massifs()

    def grass_patch(self, center, radius, count, blade=(0.12, 0.3), seed=5, flowers=0.06):
        """Extra-dense hero cover around a spot (close/foreground shots). count is in v1 'blade cards'; it maps to
        about count/12 instanced clumps (the v2 meadow is already dense). Short blades -> short clumps."""
        if self.season == "winter":
            return []
        n = int(max(50, min(count / 12.0, math.pi * radius * radius * 70)))
        return [dress.patch(center, radius, n, flowers=max(flowers, 0.12), seed=seed, short=blade[1] < 0.25)]

    def cull_cover(self, f0=None, f1=None, **kw):
        """Drop ground-cover instances no shot camera sees (call at the end of make(), after the camera is keyed)."""
        return dress.cull(f0, f1, **kw)

    def gust(self, f0, f1, strength=1.0, **kw):
        """Rolling bands of wind through the meadow (see foliage.gust)."""
        return foliage.gust(f0, f1, strength, **kw)

    def ground(self, x, y):
        return float(terrain.height(x, y))

    # ------------------------------------------------------------------ characters
    def claude(self, name="Claude"):
        from . import framing
        c = claude.Claude(name)
        self.chars[name] = c
        framing.register_char(c)
        return c

    def star(self, name="Star", light=True):
        from . import framing
        s = star.Star(name, light=light)
        self.chars[name] = s
        framing.register_char(s)
        return s

    def local_to_world(self, p):
        """Mill-local coordinates (interior/exterior layout) -> world."""
        return self.origin + Vector(p)

    # ------------------------------------------------------------------ interior practicals
    INT_GAIN = 2.6      # practical lights are scaled to the painterly ramp (daylight ~3 W/m^2)

    def practicals(self, lamp=0.0, stove=0.0, candle=0.0, fill=0.0):
        out = {}
        if self.I is None:
            return out
        g = self.INT_GAIN
        lamp, stove, candle, fill = lamp * g, stove * g, candle * g, fill * g
        O = self.origin
        if lamp > 0:
            tb = self.I["table"]["top"]
            out["lamp"] = scene.point("OilLamp", O + Vector((tb.x + 0.25, tb.y - 0.18, 0.95)), (1.0, 0.6, 0.28), lamp, 0.04)
        if stove > 0:
            st = self.I["stove"]
            out["stove"] = scene.point("StoveGlow", O + st["pos"] + st["front"] * 0.45 + Vector((0, 0, 0.5)), (1.0, 0.4, 0.12), stove, 0.15)
        if candle > 0:
            tb = self.I["table"]["top"]
            out["candle"] = scene.point("Candle", O + Vector((tb.x + 0.25, tb.y - 0.18, 0.92)), (1.0, 0.65, 0.3), candle, 0.02)
        if fill > 0:
            ld = bpy.data.lights.new("RoomFill", "AREA")
            ld.energy = fill
            ld.size = 4.0
            ld.color = (1.0, 0.75, 0.5)
            ld.use_shadow = False
            o = bpy.data.objects.new("RoomFill", ld)
            bpy.context.scene.collection.objects.link(o)
            o.location = O + Vector((0, 0, 3.1))
            out["fill"] = o
        return out
