"""BLOOM's world: one builder for every shot, with phases of the colour script.

  W = world.World(phase, focus=None, **options)

phase: "ash" (B01-B04), "threat" (B05-B07), "storm" (B08-B13), "low" (B14-B15), "beam" (B16-B17), "bloom" (B18-B19),
       "coda" (B20). Each sets the sky + light rig (sky.PHASES), the environment controls (wet ground, ember glow,
       lushness), the ground cover (ash dressing or spring meadow) and whether the forest is in leaf.
options (all optional):
  focus=(x, y)          where the camera looks: ambient FX boxes (ash snow, rain, pollen) are centred here
  hero=("stump", ...)   which high-res terrain patches to build (default: by phase; stump / climb / summit)
  stump="hi"|"lo"|None  the home-tree stump (default hi for ash/threat, lo elsewhere)
  mountain=True         rock outcrops, the ledge, the hail-spot rock band, the summit crown + soil, the scree
  forest=True           the charred forest (leaves in bloom/coda)    cover=True   ground cover    ridges=True
  ambient=True          the phase's ambient FX around focus (W.ambient_fx)
  wave=False            B18: build ash cover AND meadow AND leaves, the wave not started (key it: W.bloom_wave)
  storm/hole/tear/part  sky controls at build (see sky.key); bloom=R sets the wave radius (m) explicitly
  storm_wall=None       the 3D cumulonimbus wall's advance (default 0.3 threat, 0.85 storm, none otherwise; False
                        to skip); W.storm = dict(obj, rig, rain). Default 0.0 threat (over the west ridge), 0.85
                        storm (its front over the valley)
  frames=(f0, f1)       the shot's frame range (FX timing)

Attributes / methods
  W.marks               dict of world-space Vectors: STUMP, SEED, DOOR, SWING_PIVOT, SLOPE_START, SCREE, LEDGE_TOP,
                        LEDGE_LIP, LEDGE_FOOT, HAIL_SPOT, PEAK, PEAK_SOIL (soil top), ... (z on the ground)
  W.ground(x, y)        terrain height;  W.lights (sun, patch);  W.stump (stump.build dict);  W.mtn (mountain dict)
  W.bloom_wave(f_start, f_end, r_end=layout.BLOOM_R_END, burst=True)   key the BLOOM (and its petal burst)
  W.sky_transition(f0, f1, a, b, **ctl)   key sky + lights + grade-look from phase a to phase b
  W.storm_advance(f0, f1, s0, s1)         key the storm wall rolling in (sky Storm control)
  W.set_env(frame=None, Wet=, Ember=, Flash=, Lush=)
  W.cull_cover(f0, f1)  camera culling + LOD of cover, forest, leaves (render_shot calls it)
  W.gust(f0, f1, strength)                wind through cover and FX
  W.claude(name)        the character (character agent's claude.Claude), registered for framing
"""
import math
import bpy
import numpy as np
from mathutils import Vector

from . import scene, sky, terrain, envmat, layout, dress, foliage, fx, geo

PHASE_ENV = {
    "ash": dict(Wet=0.0, Ember=1.0, Lush=0.0, CloudShade=0.0),
    "threat": dict(Wet=0.0, Ember=0.8, Lush=0.0, CloudShade=0.3),
    "storm": dict(Wet=1.0, Ember=0.0, Lush=0.0, CloudShade=0.0),
    "low": dict(Wet=1.0, Ember=0.0, Lush=0.0, CloudShade=0.0),
    "beam": dict(Wet=0.85, Ember=0.0, Lush=0.0, CloudShade=0.0),
    "bloom": dict(Wet=0.25, Ember=0.7, Lush=0.3, CloudShade=0.75),
    "coda": dict(Wet=0.0, Ember=0.0, Lush=1.0, CloudShade=0.6),
}
BLOOMED = ("bloom", "coda")
SMOKE_SPOTS = [(-62.0, 48.0, 95.0), (48.0, 22.0, 70.0), (-118.0, 128.0, 120.0), (96.0, 170.0, 110.0),
               (-34.0, -66.0, 60.0), (132.0, -24.0, 90.0), (-158.0, -40.0, 100.0), (14.0, 210.0, 130.0)]


class World:
    current = None

    def __init__(self, phase="ash", focus=None, hero=None, stump=None, mountain=True, forest=True, cover=True,
                 ridges=True, ambient=True, wave=False, storm=None, hole=None, tear=None, part=None, bloom=None,
                 frames=None, detail=1.0, kind="ext", storm_wall=None):
        World.current = self
        self.kind = kind
        self.phase = phase
        self.detail = detail
        self.chars = {}
        sc = bpy.context.scene
        self.frames = frames or (sc.frame_start, sc.frame_end)
        self.focus = focus or self._default_focus(phase)
        ctl = {k: v for k, v in (("Storm", storm), ("Hole", hole), ("Tear", tear), ("Part", part)) if v is not None}
        self.lights, self.P = sky.build(phase, **ctl)
        envmat.env_group()
        envmat.set_env(**PHASE_ENV[phase])
        E = envmat.bloom_empty()
        if bloom is not None:
            E.location.x = bloom
        elif wave:
            E.location.x = -5.0
        else:
            E.location.x = layout.BLOOM_R_END + 200 if phase in BLOOMED else -80.0
        E.location.y = 7.0
        foliage.wind()
        if phase in ("threat", "storm"):
            foliage.breeze(2.2)
        elif phase in ("low", "beam"):
            foliage.breeze(0.6)
        self.H = terrain.height
        # ---- terrain
        if hero is None:
            hero = {"ash": ("stump", "climb", "summit"), "threat": ("stump", "climb", "summit"),
                    "storm": ("climb", "summit"), "low": ("climb", "summit"), "beam": ("climb", "summit"),
                    "bloom": ("climb", "summit", "stump"), "coda": ("summit", "climb")}[phase]
        self.terrain = terrain.build(hero=hero)
        if ridges:
            self.ridges = terrain.ridges()
        keep = []
        # ---- the stump
        if stump is None:
            stump = "hi" if phase in ("ash", "threat") else "lo"
        self.stump = None
        if stump:
            from . import stump as S
            self.stump = S.build(detail=stump)
            keep += self.stump["keep_clear"]
            if phase in ("ash", "threat"):
                f0, f1 = self.frames
                S.swing_creak(self.stump, f0, f1, amp=3.0 if phase == "ash" else 7.0, period=3.6)
        # ---- the mountain
        self.mtn = None
        if mountain:
            from . import mountain as M
            self.mtn = M.build(detail=detail)
            keep += self.mtn["keep_clear"]
        dress.KEEP[:] = keep
        # ---- forest + cover
        self.forest = None
        if forest:
            self.forest = foliage.forest(density=detail, leaves=(phase in BLOOMED) or wave,
                                         extra=self._hero_trunks())
        self.cover = {}
        if cover:
            if phase not in BLOOMED or wave:
                self.cover["ash"] = dress.ash_cover(wither=True, density=detail)
            if phase in BLOOMED or wave:
                self.cover["meadow"] = dress.meadow(density=detail, lush=1.25 if phase == "coda" else 1.0)
        envmat.cloud_shadows()
        # the 3D cumulonimbus wall (threat: rising over the west ridge; storm: its front over the valley)
        self.storm = None
        if storm_wall is None:
            storm_wall = {"threat": 0.0, "storm": 0.85}.get(phase)
        if storm_wall is not None and storm_wall is not False:
            from . import clouds
            self.storm = clouds.storm_wall(advance=float(storm_wall))
        self.marks = self._marks()
        self.volume = None
        if phase == "beam":
            self.volume = self.light_volume()
        self.fx = {}
        if ambient:
            self.ambient_fx()

    # ------------------------------------------------------------------ layout helpers
    @staticmethod
    def _default_focus(phase):
        return {"ash": layout.STUMP, "threat": layout.STUMP, "storm": layout.LEDGE, "low": layout.HAIL_SPOT,
                "beam": layout.PEAK, "bloom": layout.PEAK, "coda": layout.PEAK}[phase]

    @staticmethod
    def _hero_trunks():
        """A few placed trunks framing the stump (B02-B07 backgrounds) and the foot of the climb."""
        return [(-9.5, 6.0, "snag", 13.0, 20), (-12.0, -3.0, "snag", 9.5, 80), (8.5, 9.5, "snag", 12.0, 140),
                (11.0, -6.5, "dead", 6.5, 200), (-6.0, 14.0, "stub", 2.6, 10), (6.5, -11.0, "log", 1.0, 35),
                (-8.0, -9.0, "snag", 11.0, 300), (14.5, 3.0, "snag", 14.0, 250), (-15.5, 11.0, "dead", 7.0, 60),
                (3.0, 16.5, "snag", 10.5, 170), (9.0, 86.0, "snag", 11.0, 40), (20.0, 84.0, "dead", 6.0, 120)]

    def _marks(self):
        H = lambda p: Vector((p[0], p[1], float(dress.surface(np.array([p[0]]), np.array([p[1]]))[0])))
        m = {n: H(getattr(layout, n)) for n in ("STUMP", "SEED", "SLOPE_START", "SCREE", "LEDGE", "HAIL_SPOT", "PEAK",
                                                "PEAK_SOIL")}
        if self.stump:
            m["DOOR"] = self.stump["door"]
            m["SWING_PIVOT"] = self.stump["pivot"]
        if self.mtn:
            m["LEDGE_TOP"] = self.mtn["ledge"]["top"]
            m["LEDGE_LIP"] = self.mtn["ledge"]["lip"]
            m["LEDGE_FOOT"] = self.mtn["ledge"]["foot"]
            m["PEAK_SOIL"] = self.mtn["crown"]["soil_top"]
        return m

    def ground(self, x, y):
        return float(dress.surface(np.array([x]), np.array([y]))[0])

    # ------------------------------------------------------------------ ambient FX per phase
    def aim_fx(self, cam=None):
        """Point the camera-facing FX (smoke columns, rain sheets, glows) at the shot camera (call once the camera
        exists; render_shot-built shots usually make the camera after the world)."""
        objs = [o for o in bpy.data.objects if o.constraints and o.name.startswith(
            ("SmokeCol", "SmokeWisp", "RainSheet", "PatchGlow", "GlowOrb", "StormWallRain", "SunbeamContact"))]
        fx.track_camera(objs, cam)

    def ambient_fx(self, focus=None, frames=None):
        """The phase's ambient effects around focus (ash snow + embers + smoke columns / wind ash / rain, sheets and
        splashes / pollen and drifting petals). Returns a dict of the FX (keyable amounts via fx.amount)."""
        f0, f1 = frames or self.frames
        fx_ = self.fx
        cx, cy = focus or self.focus
        cz = self.ground(cx, cy)
        ph = self.phase
        if ph in ("ash", "threat"):
            fx_["ash_snow"] = fx.ash_snow((cx, cy, cz + 9.0), (90.0, 90.0, 26.0), 9000, f0,
                                          wind=(0.5, -0.18) if ph == "ash" else (1.6, -0.6), fall=0.5)
            fx_["embers"] = fx.embers((cx, cy), (26.0, 26.0, 6.0), 160 if ph == "ash" else 90, f0)
            fx_["smoke"] = [fx.smoke_column((x, y), h, name=f"SmokeCol{i}", lean=0.3 if ph == "ash" else 0.55,
                                            opacity=0.5) for i, (x, y, h) in enumerate(SMOKE_SPOTS)]
            fx_["wisps"] = fx.smoke_wisps((cx, cy), 22.0, 9, seed=13)
            # the patch of sun on the summit: soft shafts from the hole in the overcast + lit haze round the crown
            px, py = layout.PEAK_SOIL
            pz = self.ground(px, py)
            fx_["patch_beam"] = fx.sunbeam((px, py, pz - 6.0), radius=13.0, spread=1.9, motes_n=0, name="PatchBeam",
                                           strength=0.22)
            fx_["patch_glow"] = fx.glow_orb((px, py, pz + 6.0), 34.0, 0.32, name="PatchGlow")
            if ph == "threat":
                fx_["wind_ash"] = fx.wind_ash((cx, cy, cz + 2.0), (60.0, 60.0, 5.0), 3500, f0, amount_=0.6)
        elif ph in ("storm", "low"):
            k = 1.0 if ph == "storm" else 0.35
            fx_["rain"] = fx.rain((cx, cy, cz + 10.0), (50.0, 50.0, 24.0), int(9000 * k), f0, amount_=1.0)
            fx_["sheets"] = fx.rain_sheets((cx, cy), 90.0, 12 if ph == "storm" else 6)
            fx_["splash"] = fx.rain_splashes((cx, cy), 9.0, int(600 * k), f0)
        elif ph == "beam":
            fx_["rain"] = fx.rain((cx, cy, cz + 10.0), (50.0, 50.0, 24.0), 2500, f0, amount_=0.4)
        elif ph in ("bloom", "coda"):
            fx_["pollen"] = fx.pollen((cx, cy, cz + 1.5), (30.0, 30.0, 4.0), 900 if ph == "bloom" else 500, f0)
            fx_["petals"] = fx._make_field("DriftPetals", "fall", (cx, cy, cz + 7.0), (40.0, 40.0, 14.0),
                                           700 if ph == "bloom" else 260, f0, fx._petal_meshes(),
                                           dict(fall=0.55, fall_var=0.4, wind=(0.8, -0.3), flutter=0.45,
                                                flutter_f=1.4, spin=3.0, size=(0.02, 0.035)), 41)
        return fx_

    def light_volume(self, center=None, size=(150.0, 150.0, 140.0), density=0.0045, aniso=0.72, name="LightVolume"):
        """Real volumetric light (EEVEE): a thin scattering haze around the summit so the sun patch / beam spot
        draws a true shaft with shadows (the sun and fill lights don't scatter in it, only the spot). Keyable via
        obj['density'] (shader reads it)."""
        from . import mat as M
        c = Vector(center) if center else Vector((layout.PEAK_SOIL[0], layout.PEAK_SOIL[1],
                                                  self.ground(*layout.PEAK_SOIL) + size[2] * 0.35))
        m = bpy.data.materials.new(name + "Mat")
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()
        nb = M.NB(nt)
        at = nb.n("ShaderNodeAttribute", attribute_name="density", attribute_type="OBJECT").outputs["Fac"]
        tc = nb.n("ShaderNodeTexCoord").outputs["Object"]
        nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.0, "Detail": 2.0})
        nb.link(tc, nz.inputs["Vector"])
        dens = nb.mul(at, nb.mapr(nz.outputs["Fac"], 0.3, 0.7, 0.6, 1.4))
        oz = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": tc}).outputs[2]
        dens = nb.mul(dens, nb.mapr(oz, 0.5, -0.1))                   # thins out upward (no hard top)
        pv = nb.n("ShaderNodeVolumePrincipled", inputs={"Color": (0.92, 0.9, 0.88), "Anisotropy": aniso})
        nb.inp(pv, "Density", dens)
        out = nb.n("ShaderNodeOutputMaterial")
        nb.link(pv.outputs[0], out.inputs["Volume"])
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=c)
        o = bpy.context.active_object
        o.name = name
        o.scale = size
        o.data.materials.append(m)
        o["density"] = density
        o.visible_shadow = False
        sc = bpy.context.scene
        sc.eevee.volumetric_end = 800.0
        sc.eevee.volumetric_tile_size = "8"
        sc.eevee.volumetric_samples = 48
        for ln in ("LU_Sun", "LU_Fill"):
            lo = bpy.data.objects.get(ln)
            if lo:
                lo.data.volume_factor = 0.0
        return o

    # ------------------------------------------------------------------ keyable world changes
    def bloom_wave(self, f_start, f_end, r_end=None, power=1.25, pop=0.12, burst=True, burst_count=9000):
        """THE BLOOM: the wave leaves PEAK_SOIL at f_start and reaches r_end (default layout.BLOOM_R_END, the far
        valley) at f_end. Radius r(u) = r_end * (pop * smooth(u/0.15) + (1-pop) * u^power) - a quick burst out of the
        soil, then racing on. Grass, flowers, moss grow in behind it (springy), the ash dressing withers, leaves and
        blossom burst onto the trunks bottom-up, the bark turns living, the front glows; burst=True adds the swirl
        of petals, leaves and pollen at the front (fx.bloom_burst)."""
        r_end = r_end or layout.BLOOM_R_END
        E = envmat.bloom_empty()
        E.location.x = -5.0
        E.keyframe_insert("location", index=0, frame=f_start - 1)
        n = max(1, f_end - f_start)
        for f in range(f_start, f_end + 1, 2):
            u = (f - f_start) / n
            r = r_end * (pop * min(1.0, u / 0.15) ** 0.5 + (1 - pop) * u ** power)
            E.location.x = r
            E.keyframe_insert("location", index=0, frame=f)
        E.location.x = r_end + 300.0
        E.keyframe_insert("location", index=0, frame=f_end + 24)
        if burst:
            self.fx["bloom_burst"] = fx.bloom_burst(f_start, f_end + 48, count=burst_count)
        return E

    def sky_transition(self, f0, f1, a, b, env=True, **ctl):
        sky.key_phase(f0, a)
        sky.key_phase(f1, b, **ctl)
        if env:
            envmat.set_env(f0, **PHASE_ENV[a])
            envmat.set_env(f1, **PHASE_ENV[b])

    def storm_advance(self, f0, f1, s0, s1, wall=None):
        """Key the storm rolling in: the painted sky (Storm control s0 -> s1) and, if built, the 3D cumulonimbus wall
        (advance = wall=(a0, a1), default the same numbers as the sky)."""
        sky.key(f0, Storm=s0)
        sky.key(f1, Storm=s1)
        if self.storm is not None:
            from . import clouds
            a0, a1 = wall if wall is not None else (s0, s1)
            clouds.storm_advance(self.storm, f0, f1, max(a0, 0.0), min(a1, 1.2))

    def set_env(self, frame=None, **kw):
        envmat.set_env(frame, **kw)

    def cull_cover(self, f0=None, f1=None, **kw):
        """Drop cover / forest / leaf instances no camera of the shot sees, LOD the far ones (render_shot calls it).
        Also aims the camera-facing FX billboards at the shot camera."""
        self.aim_fx()
        return dress.cull(f0, f1, **kw)

    def gust(self, f0, f1, strength=1.0, **kw):
        return foliage.gust(f0, f1, strength, **kw)

    # ------------------------------------------------------------------ characters
    def claude(self, name="Claude", **kw):
        from . import claude, framing
        c = claude.Claude(name, **kw)
        self.chars[name] = c
        framing.register_char(c)
        return c
