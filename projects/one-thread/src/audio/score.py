"""One Thread — score and sound. One pentatonic tune is handed from people to people every two bars (96 BPM), over the
pulse of a loom. Run: node render/cues.mjs && /usr/bin/python3 src/audio/score.py → out/soundtrack.wav"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import inst as I
from inst import P, hz
from dsp import SR, lp, hp, bp, filt, make_ir, convolve, compress, soft_clip, limiter, lufs_integrated, true_peak_db, write_wav, smooth_noise
from sampler import instrument, Note, render_notes, humanize
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
Q = json.load(open(os.path.join(ROOT, 'out', 'cues.json'))); C = Q['C']; DUR = Q['DURATION']; N = int((DUR + 2) * SR)
B = 0.625; BAR = 2.5
ST = {k: np.zeros((N, 2), np.float32) for k in ('lead', 'pluck', 'perc', 'low', 'strings', 'brass', 'choir', 'loom', 'sfx', 'amb')}
def add(stem, y, t, g=1.0, pan=0.0):
    if y is None: return
    y = np.asarray(y, np.float32); i = int(round(t * SR)); buf = ST[stem]
    if y.ndim == 1: a = (pan + 1) * math.pi / 4; y = np.stack([y * math.cos(a), y * math.sin(a)], 1) * 1.2
    if i < 0: y = y[-i:]; i = 0
    k = min(len(y), N - i)
    if k > 0: buf[i:i + k] += y[:k] * g
# --- the tune: (beat, length, degree) over eight beats
TUNE = [(0, 1, 0), (1, .5, 3), (1.5, .5, 2), (2, .5, 3), (2.5, .75, 4), (3.25, .25, 5), (3.5, .5, 4), (4, 1, 3), (5, .5, 2), (5.5, .5, 1), (6, .5, 2), (6.5, .5, 3), (7, 1, 0)]
MIN, MAJ = [0, 3, 5, 7, 10], [0, 2, 4, 7, 9]
def dg(scale, d): return scale[d % 5] + 12 * (d // 5)
def tune(root, scale=MIN, vel=.8, tr=0, a=0, b=8): return [((bt - a) * B, ln * B, root + dg(scale, d + tr), vel * (1.08 if bt % 1 == 0 else .92)) for bt, ln, d in TUNE if a <= bt < b]
def plucks(kind, notes, t0, g=.8, pan=0, dur=2.2, seed=0, stem='pluck', **k):
    for i, (t, d, m, v) in enumerate(notes): add(stem, P(kind, m, dur, v, seed + i, **k), t0 + t + (I.rng(seed, i).normal(0, .004) if i else 0), g, pan)
def pat(s, t0, step, fn, stem='perc', g=1.0, pan=0.0, hum=.004):
    for i, ch in enumerate(s):
        if ch in '. ': continue
        y = fn(ch, i);
        if y is not None: add(stem, y, t0 + i * step + I.rng(i, t0, 3).normal(0, hum) * (i > 0), g, pan)
V = {'x': .6, 'X': .95, 'o': .4}
def pn(i): return (-1) ** i * .25
HALL = make_ir(2.6, predelay=.022, seed=3, er=dict(n=14, gain=.5, spread=.05)); ROOM = make_ir(.9, predelay=.008, seed=5, bright=8000, er=dict(n=10, gain=.6, spread=.02)); CAVE = make_ir(4.2, predelay=.04, seed=8, bright=4200)

# ================================================================ the peoples
def australia(t):
    add('low', I.didge(5.2, [(i * B / 2, B / 2 * .95, 1.0 if i % 4 == 0 else (.7 if i % 8 == 3 else .15)) for i in range(16)], 38), t, .95)
    pat('x.x.x.x.x.x.x.xx', t, B / 2, lambda c, i: I.sticks(.8, 1250, i), g=.5, pan=.3); pat('..x...x...x...x.', t, B / 2, lambda c, i: I.clap(.5, i), g=.4, pan=-.4)
    add('choir', I.choir(tune(50, MIN, .7, a=0, b=8), 5.4, 'o', 5, 11, vib=None or (4.8, .1, .3)) if False else I.choir(tune(50, MIN, .7), 5.4, 'o', 5, 11), t, .5)
def ur(t):
    plucks('lyre', tune(62), t, .95, -.15, 2.4, 20); plucks('lyre', [(i * B, B, [50, 57, 62, 57][i % 4], .6) for i in range(8)], t, .7, .2, 2.4, 60)
    add('lead', I.reed(tune(74, MIN, .42), 5.3, .32, seed=2, vib=(5.4, .15, .2), glide=.03), t, .30, .25); pat('X.x.x.X.X.x.x.xx', t, B / 2, lambda c, i: I.frame(V[c], 96, i), g=.75); pat('..x...x...x...x.', t, B / 2, lambda c, i: I.rattle(.4, .1, 6800, i), g=.5, pan=.4)
def nile(t):
    s = [0, 3, 5, 7, 10]; n = tune(62, s, .75); orn = []
    for (a, d, m, v) in n: orn += ([(a, .07, m + 1, v * .8), (a + .07, d - .07, m, v)] if d >= .5 else [(a, d, m, v)])
    add('lead', I.reed(orn, 5.4, .22, ((760, 2.4, 9), (1700, 2, 5), (3000, 2, 0)), seed=4, vib=(5.8, .25, .2), glide=.025), t, .55, -.2); plucks('harp', [(i * B / 2, B, 50 + [0, 7, 12, 15, 19, 15, 12, 7][i % 8], .6) for i in range(16)], t, .65, .25, 2.6, 80)
    pat('x.xxx.xxx.xxx.xx', t, B / 2, lambda c, i: I.rattle(.6, .12, 7600, i, 34), g=.55, pan=.35); pat('X...x.x.X...x.x.', t, B / 2, lambda c, i: I.frame(V[c], 82, i), g=.8); add('sfx', I.twang(38, .9, 3), t + 1.25, .8)
def aegean(t):
    add('lead', I.reed(tune(67, [0, 3, 5, 7, 10], .7), 5.4, .4, ((520, 2, 8), (1300, 2, 7), (2600, 2, 3)), seed=6, vib=(5, .12, .25), glide=.03), t, .42, .2); plucks('kithara', tune(55, MIN, .8), t, .85, -.2, 2, 100); plucks('kithara', [(i * B + B / 2, B / 2, 62 + [0, 5, 7, 5][i % 4], .5) for i in range(8)], t, .6, -.1, 1.6, 130)
    pat('X..x..X.X..x..x.', t, B / 2, lambda c, i: I.frame(V[c], 110, i), g=.7); pat('..x.x...x.x...xx', t, B / 2, lambda c, i: I.modal(2400, [1, 1.48, 2.3], [1, .6, .4], [.4, .3, .2], .5, .3, i, .3, 6000), g=.35, pan=.4)
def india(t):
    n = tune(62, [0, 2, 4, 7, 9], .8)
    for i, (a, d, m, v) in enumerate(n): add('pluck', P('sitar', m, 2.0, v, 150 + i, bend=(np.array([0, .09, .4]), np.array([-2.0 if i % 3 == 1 else 0, 0, 0]))), t + a, .75, -.12)
    for i, m in enumerate([45, 50, 50, 38] * 2): add('pluck', P('tanpura', m, 3.2, .5, 190 + i), t + i * B, .42, .3)
    BOL = 'D.tTN.tTG.TtN.TTD.tTN.tTGgTtNnTT'
    pat(BOL, t, B / 4, lambda c, i: {'D': lambda: np.concatenate([I.tabla('ge', .9, i)]) , 'G': lambda: I.tabla('ge', .8, i), 'g': lambda: I.tabla('ge', .5, i), 'N': lambda: I.tabla('na', .85, i), 'n': lambda: I.tabla('na', .6, i), 't': lambda: I.tabla('te', .7, i), 'T': lambda: I.tabla('tin', .6, i)}[c](), g=.8, pan=.1); pat('X...X...X...X...', t, B / 2, lambda c, i: I.tibell(98 if i % 8 else 103, .16, 1.6, i), g=.5, pan=.5)
    add('lead', I.flute(tune(74, [0, 2, 4, 7, 9], .5), 5.4, .35, .2, 9, glide=.07, vib=(5, .2, .2)), t, .32, .35)
def china(t):
    plucks('guzheng', tune(65, MAJ, .85), t, .8, -.2, 2.6, 200)
    for k in (0, 4): # glissandi
        for j in range(14): add('pluck', P('guzheng', 53 + dg(MAJ, j), 2.0, .28 + .02 * j, 240 + j), t + k * B + j * .028, .6, -.5 + j * .07)
    for (a, d, m, v) in tune(77, MAJ, .5)[7:]:
        for j in range(int(d / .052)): add('pluck', P('pipa', m, .6, v * (.7 + .3 * (j % 2)), 300 + j), t + a + j * .052, .42, .3)
    add('lead', I.flute(tune(77, MAJ, .7), 5.4, .3, .55, 10, glide=.03, vib=(5.6, .22, .15)), t, .42, .15); add('perc', I.gong(41, .6, 5, 2), t, .7); pat('x...x.x.x...x.xx', t, B / 2, lambda c, i: I.log(.5, 520, i), g=.5, pan=.3); pat('X.......X.......', t, B / 2, lambda c, i: I.taiko(.6, 70, i), g=.6)
def steppe(t):
    add('lead', I.bowed(tune(55, MIN, .85), 5.4, seed=12, vib=(5.4, .28, .12), glide=.045), t, .62, -.15); add('low', I.throat(5.3, [(0, 2.5, 43, .9), (2.5, 2.6, 43, .9)], 5), t, .55, .1)
    for i in range(32):
        if i % 4 != 3: add('perc', I.hoof(.75 if i % 4 == 0 else .5, i), t + i * B / 4 + .0, .7, .3 * math.sin(i * .4))
    pat('X.......X...X...', t, B / 2, lambda c, i: I.taiko(.8, 60, i), g=.75); plucks('gut', [(i * B / 2, .3, 43 + [0, 0, 12, 7][i % 4], .6) for i in range(16)], t, .5, .35, .8, 330)
def persia(t):
    s = [0, 3, 5, 7, 10]; n = tune(62, s, .8)
    for i, (a, d, m, v) in enumerate(n):
        for j in range(max(1, int(d / .078))): add('pluck', P('santur', m, 1.6, v * (.9 if j == 0 else .5 + .2 * (j % 2)), 350 + i + j), t + a + j * .078, .5, -.25)
        add('pluck', P('santur', m - 12, 2, v * .5, 390 + i), t + a, .4, .2)
    add('lead', I.flute([(a, d, m + (-.5 if (m - 62) % 12 == 3 and i % 2 else 0), v) for i, (a, d, m, v) in enumerate(tune(74, s, .7))], 5.4, .75, .12, 13, glide=.06, vib=(4.8, .3, .2)), t, .42, .2)
    pat('D.k.D.kkD.k.DkDk', t, B / 2, lambda c, i: I.membrane(92, .8, .22, .7, .5, .4, .4, i) if c == 'D' else I.membrane(330, .55, .06, .3, .1, .8, .7, i, .3), g=.75); pat('x.xxx.xxx.xxx.xx', t, B / 2, lambda c, i: I.shaker(.3, i, 9000), g=.5, pan=.45)
def swahili(t):
    plucks('oud', tune(53, MAJ, .85), t, 1.0, -.2, 1.8, 420); plucks('qanun', [(a, d, m + 12, v * .6) for a, d, m, v in tune(65, MAJ)], t, .5, .3, 1.6, 450); plucks('oud', [(i * B / 2 + B / 4, .2, 53 + [0, 4, 7, 4][i % 4], .4) for i in range(16)], t, .5, .2, .9, 470)
    pat('b.ts.tb.b.ts.tst', t, B / 2, lambda c, i: I.djembe(c, .8, i), g=.75, pan=-.1); pat('xxxxxxxxxxxxxxxx', t, B / 2, lambda c, i: I.rattle(.5 if i % 2 else .3, .07, 6200, i, 16), g=.5, pan=.4); add('sfx', I.twang(41, .8, 8), t + 1.25, .7)
    add('lead', I.bowed(tune(65, MAJ, .5), 5.4, ((500, 2, 3), (1200, 2, 3), (2800, 2, 2)), 14, .05, 5200, vib=(5.8, .2, .12)), t, .22, .35)
def asante(t):
    tr = B / 3
    for i, c in enumerate('X.x.xx.x.x.xX.x.xx.x.x.x'):
        if c != '.': add('perc', I.bell(1040 if c == 'X' else 820, .6, i), t + i * tr, .42, .35)
    for i, c in enumerate('b.stt.b.s.ttb.stt.bbs.tt'):
        if c != '.': add('perc', I.djembe(c, .9, i), t + i * tr, .8, -.2)
    for i, c in enumerate('X..X.XX..X..X..X.XX..XXX'):
        if c != '.': add('perc', I.membrane(105 if i % 2 else 78, .85, .35, 1.0, .6, .4, .4, i), t + i * tr, .75, .1)
    plucks('kora', tune(60, MAJ, .8), t, .85, .25, 2, 500); plucks('kora', [(i * tr, .2, 48 + [0, 7, 12, 16, 12, 7][i % 6], .45) for i in range(24)], t, .55, -.3, 1.6, 520)
    call = tune(60, MAJ, .85)[:7]; add('choir', I.choir([(a, d, m, v) for a, d, m, v in call], 2.8, 'e', 4, 21, scoop=1), t, .5, 0); add('choir', I.choir([(0, B, 64, .9), (B, B, 67, .9), (2 * B, B * 2, 60, 1)], 2.9, 'a', 9, 22), t + 4 * B, .6); pat('..X...X...X...X.', t, B / 2, lambda c, i: I.clap(.7, i), g=.5, pan=-.35)
def norse(t):
    H = humanize([Note(t + a, int(m), d * 1.02, 96) for a, d, m, v in tune(50, [0, 3, 5, 7, 9])], 3); HORNS.extend(H)
    plucks('lyre', tune(62, [0, 3, 5, 7, 9], .7), t, .6, .25, 1.8, 560, bright=.55); add('low', I.bowed([(0, 5, 38, .8)], 5.3, seed=15, vib=(5, 0, 9), rough=.2), t, .35); add('low', I.bowed([(0, 5, 45, .6)], 5.3, seed=16, vib=(5, 0, 9), rough=.2), t, .25)
    pat('X...X.x.X...X.xx', t, B / 2, lambda c, i: I.taiko(V[c] * 1.0, 58, i), g=.9); pat('x.x.x.x.x.x.x.x.', t, B / 2, lambda c, i: I.foot(.5, i), g=.5); add('choir', I.choir([(0, 2.4, 38, .9), (0, 2.4, 45, .8), (2.5, 2.4, 41, .9), (2.5, 2.4, 45, .8)], 5.4, 'o', 8, 25), t, .55)
def ukraine(t):
    plucks('bandura', tune(67, [0, 3, 5, 7, 10], .85), t, .75, -.25, 2.2, 600); plucks('bandura', [(a + .02, d, m + (3 if i % 2 else 4) - 12, v * .5) for i, (a, d, m, v) in enumerate(tune(67, MIN))], t, .45, -.1, 2.2, 630)
    for i in range(16): # oom-pah
        if i % 2 == 0: add('low', P('gut', [43, 38][i // 2 % 2], .9, .9, i), t + i * B / 2, .9)
        else:
            for m in (55, 58, 62): add('pluck', P('bandura', m, .5, .42, i + m), t + i * B / 2, .4, .2)
    add('lead', I.bowed([(a, d * .9, m, v) for a, d, m, v in tune(79, MIN, .7)], 5.4, ((500, 2, 2), (1000, 2, 3), (2900, 2, 4)), 18, .08, 6500, vib=(6, .2, .08), glide=.02), t, .36, .25); pat('X.xxX.xxX.xxXxxx', t, B / 2, lambda c, i: I.rattle(.7 if c == 'X' else .4, .12, 8200, i, 40), g=.55, pan=.35); pat('X...X...X...X...', t, B / 2, lambda c, i: I.foot(.9, i), g=.8); pat('..X...X...X...X.', t, B / 2, lambda c, i: I.clap(.6, i), g=.4)
def arctic(t):
    for i in range(8): add('perc', I.frame(.95 if i % 2 == 0 else .6, 70, i), t + i * B, .95)
    for i in range(32): # throat-singing breath
        if i % 4 in (0, 1, 3): y = I.voice([(0, .1, 41 + (i % 4 == 1) * 7, .8)], .22, 'u', i, breath=1.2, vib=(5, 0, 9), att=.015, rel=.04); add('lead', y, t + i * B / 4, .34, -.4 if i % 2 else .4)
    for i, (a, d, m, v) in enumerate(tune(70, MAJ, .6)): add('lead', I.tibell(m + 12, v * .5, 3.4, i), t + a, .42, pn(i)); 
    add('choir', I.choir([(0, 5, 58, .7), (0, 5, 65, .6), (0, 5, 69, .5), (0, 5, 72, .4)], 5.8, 'u', 8, 28, att=1.0, rel=.8), t, .6); add('amb', I.wind(5.4, .5, 7), t, .5)
def wampum(t):
    add('lead', I.flute(tune(65, MAJ, .85), 5.4, .5, .18, 30, glide=.07, vib=(4.6, .35, .2), scoop=1.2), t, .62, -.1); pat('X.x.X.x.X.x.X.x.', t, B / 2, lambda c, i: I.membrane(128, V[c], .12, .5, .9, .4, .4, i), g=.8); pat('x.x.x.x.x.x.x.x.', t, B / 2, lambda c, i: I.rattle(.6, .13, 4200, i, 30), g=.6, pan=.35)
    add('choir', I.choir([(0, B * 2, 53, .8), (B * 2, B * 1.5, 50, .8), (B * 4, B * 2, 53, .8), (B * 6, B * 2, 48, .8)], 5.4, 'e', 6, 31, scoop=1.5), t, .5)
def maya(t):
    add('lead', I.flute(tune(72, MAJ, .8), 5.4, .35, .06, 33, glide=.04, vib=(5.2, .2, .2)), t, .5, .15); add('lead', I.flute([(a + .0, d, m - 5 if i % 2 else m - 12, v * .6) for i, (a, d, m, v) in enumerate(tune(72, MAJ, .7))], 5.4, .35, .06, 34, glide=.04), t, .3, -.3)
    pat('X.x.o.x.X.x.o.xx', t, B / 2, lambda c, i: I.log(V[c] * .95, 175 if i % 4 else 131, i), g=.9, pan=-.2); pat('..x...x.x.x...x.', t, B / 2, lambda c, i: I.modal(640, [1, 1.9, 3.4], [1, .5, .3], [.12, .08, .06], .3, .6, i, .6, 2200), g=.6, pan=.3); pat('xxxxxxxxxxxxxxxx', t, B / 2, lambda c, i: I.rattle(.35 if i % 2 else .5, .08, 5600, i), g=.5, pan=.45); add('brass', I.conch(48, 2.6, [(0, 2.0, 48, .9)], 3), t, .6, -.3); pat('X.......X.......', t, B / 2, lambda c, i: I.taiko(.8, 64, i), g=.7)
def andes(t):
    n = tune(74, MIN, .85); add('lead', I.flute([x for i, x in enumerate(n) if i % 2 == 0], 5.4, .65, .1, 36, 'pan', glide=.005, legato=False, vib=(5, .12, .15), rel=.1), t, .6, -.35); add('lead', I.flute([x for i, x in enumerate(n) if i % 2], 5.4, .65, .1, 37, 'pan', glide=.005, legato=False, vib=(5, .12, .15), rel=.1), t, .6, .35)
    for i in range(32): m = [62, 65, 69, 74][i // 2 % 4]; add('pluck', P('charango', m, .8, .6 if i % 4 == 0 else .38, 700 + i), t + i * B / 4, .42, .25); add('pluck', P('charango', m + 7, .8, .3, 740 + i), t + i * B / 4 + .008, .35, .3)
    pat('X..xX..xX..xX.xx', t, B / 2, lambda c, i: I.membrane(72, V[c], .4, 1.1, .6, .35, .5, i), g=.95); pat('..x...x...x...x.', t, B / 2, lambda c, i: I.rattle(.6, .1, 3600, i, 22), g=.5, pan=-.4); add('low', P('gut', 38, 2.4, .9, 1), t, .8); add('low', P('gut', 41, 2.4, .9, 2), t + BAR, .8)
def polynesia(t):
    for i, c in enumerate('X.xxX.x.xxX.x.xxX.xxX.x.xxXxxxxx'):
        if c != '.': add('perc', I.log(V[c] * .9, 240 if i % 3 else 180, i), t + i * B / 4, .62, .3)
    for i, c in enumerate('X..X..X.X..X..XX'):
        if c != '.': add('perc', I.membrane(64, .95, .5, 1.3, .6, .3, .4, i), t + i * B / 2, .95, -.1)
    up = tune(70, MAJ, .85); add('choir', I.choir(up, 5.4, 'a', 7, 41, scoop=.8), t, .5); add('choir', I.choir([(a, d, m - 5, v) for a, d, m, v in up], 5.4, 'a', 5, 42, scoop=.8), t, .34); add('choir', I.choir([(0, 2.4, 46, .9), (2.5, 2.5, 41, .9)], 5.4, 'o', 5, 43), t, .5); add('brass', I.conch(46, 3.2, [(0, 2.4, 46, .9)], 5), t - .1, .6, .35); add('amb', I.wind(5.4, .4, 9), t, .4)
def java(t):
    sl = [0, 2.4, 4.8, 7.2, 9.6]; f = lambda d, o=0: hz(60 + o * 12 + sl[d % 5] + 12 * (d // 5))
    for i, (bt, ln, d) in enumerate(TUNE): add('lead', I.metallophone(f(d, 1), .85, 2.4, i), t + bt * B, .62, -.15)
    for i in range(32): d = [0, 3, 2, 3, 4, 3, 2, 1][i % 8] + (2 if i % 16 > 7 else 0); add('lead', I.metallophone(f(d, 2), .4, .8, 50 + i), t + i * B / 4, .40, .3 if i % 2 else .45)
    for i in range(8): add('lead', I.metallophone(f([0, 2, 3, 2, 4, 3, 1, 0][i], 0), .7, 2.6, 90 + i), t + i * B, .55, -.35)
    add('perc', I.gong(36, .9, 7, 3), t, .9); add('perc', I.gong(43, .6, 4, 4), t + BAR, .7, .2); add('perc', I.gong(48, .4, 3, 5), t + BAR * 1.5, .6, -.2); pat('d.td.ttdd.tdtdtd', t, B / 2, lambda c, i: I.membrane(105, .7, .2, .6, .4, .5, .3, i) if c == 'd' else I.membrane(300, .45, .05, .3, .1, .8, .5, i), g=.6); add('lead', I.flute(tune(74, MIN, .4), 5.4, .6, .1, 45, glide=.1, vib=(4.5, .3, .2)), t, .22, .2)
def japan(t):
    s = [0, 1, 5, 7, 10]; plucks('koto', tune(62, s, .9), t, .95, -.2, 2.6, 800)
    for j in range(13): add('pluck', P('koto', 50 + dg(s, j), 2, .3, 840 + j), t + 3 * B + j * .03, .55, -.5 + j * .08)
    add('lead', I.flute([(0, 1.8, 74, .8), (1.9, .6, 75, .7), (2.5, 1.2, 79, .9), (3.7, 1.2, 74, .8)], 5.6, 1.0, .15, 47, glide=.09, vib=(4.2, .5, .35), scoop=1.4, rel=.3), t, .5, .25)
    for tt, v in ((0, 1.0), (1.25, .8), (2.5, 1.0), (3.125, .6), (3.75, .8), (4.0625, .6), (4.375, .85), (4.6875, 1.0)): add('perc', I.taiko(v, 56, int(tt * 8)), t + tt, 1.0, -.1)
    for i in range(8): add('perc', I.sticks(.4 + .05 * i, 1500, i), t + 4 * B + i * B / 2, .4, .4)
    add('perc', I.tibell(86, .5, 4, 3), t, .5, .4)
PEOPLES = [australia, ur, nile, aegean, india, china, steppe, persia, swahili, asante, norse, ukraine, arctic, wampum, maya, andes, polynesia, java, japan]
CH = {'Dm': [38, 45, 50, 53, 57], 'D5': [38, 45, 50, 57], 'Gm': [43, 50, 55, 58, 62], 'F': [41, 48, 53, 57, 60], 'C': [36, 43, 48, 52, 55], 'Bb': [34, 46, 53, 58, 62], 'A': [33, 45, 52, 57, 62], 'D': [38, 45, 50, 54, 57], 'Asus': [33, 45, 50, 52, 57]}
HARM = ['D5', 'Dm', 'D5', 'Gm', 'D5', 'F', 'Gm', 'Dm', 'F', 'C', 'Dm', 'Gm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'Asus']
HORNS, STR, TROM, BASS = [], [], [], []
def pad(t, d, chord, vel, layer=0): # sampled strings
    for j, m in enumerate(CH[chord]): STR.append(Note(t, m + (12 if j > 1 and layer else 0), d, vel - j * 2, (-.5 + j * .25)))
# ================================================================ assemble
print('peoples…')
for i, fn in enumerate(PEOPLES):
    t = Q['panels'][i]['t']; fn(t)
    lv = 34 + i * 1.5; pad(t, 5.1, HARM[i], lv, 0);
    if i >= 6: pad(t, 5.1, HARM[i], lv - 8, 1)
    r = CH[HARM[i]][0]; BASS += [Note(t, r if r > 35 else r + 12, 1.2, 74), Note(t + 2 * B, (r if r > 35 else r + 12), .6, 60), Note(t + BAR, r if r > 35 else r + 12, 1.2, 72)]
    if i in (6, 9, 10, 15, 16, 18): HORNS += [Note(t, CH[HARM[i]][2], 2.3, 62), Note(t + 2.5, CH[HARM[i]][3 if len(CH[HARM[i]]) > 3 else 2], 2.3, 70)]
    # the loom: thump on 1 and 3, shed clack on 2 and 4, shuttle on the eighths
    for k in range(8):
        add('loom', I.membrane(64, .6 if k % 4 == 0 else .42, .12, .4, .3, .2, .8, k), t + k * B, .55 if k % 2 == 0 else 0)
        if k % 2: add('loom', I.log(.5, 330, k), t + k * B, .42, .15); add('loom', I.sticks(.4, 820, k), t + k * B + .012, .3, -.15)
        add('loom', I.whoosh(.22, 900, 3400, .12, k, .4), t + k * B + B / 2 - .1, .5, -.5 if k % 2 else .5)
    # arrival: whoosh into the square, hit on the downbeat
    add('sfx', I.whoosh(.62, 240, 3000, .5, i, .62), t - .40, .62, -.3 if i % 2 else .3); add('sfx', I.boom(.55, 44, 1.8, i), t, .5); add('sfx', I.shimmer(1.1, .16, i, 86, 16), t + .1, .8)
# --- opening
add('amb', I.wind(15, .30, 3), 0, .8); add('amb', I.crackle(12.8, .55, 20, 4), C['ember'] - .1, .8); n = int(16 * SR); drone = I.voice([(0, 15, 38, .5)], 15.5, 'm', 3, vib=(5, 0, 9), att=4, rel=1.5); add('low', drone, 1.0, .55)
for k, v in ((C['spark1'], .55), (C['spark2'], .8)): add('sfx', I.modal(2300, [1, 1.7, 2.9, 4.3], [1, .7, .5, .4], [.07, .05, .04, .03], .3, v, 5, 1.0, 5200), k, .8); add('sfx', I.crackle(.5, v * .8, 60, 9), k + .02, .8)
add('sfx', I.whoosh(1.6, 120, 900, .5, 40, .8), C['ember'] - .2, .6)
for i in range(20): add('loom', I.rattle(.25 + .01 * i, .16, 2600, i, 14), C['spin'] + i * .12, .5, math.sin(i) * .4) # fibres rubbed between palms
plucks('gut', [(0, 1, 50, .5), (1.25, 1, 57, .5), (1.875, 1, 55, .5)], C['spin'], .8, 0, 2.6, 900)
add('sfx', I.boom(1.0, 40, 3.4, 2), C['bloom'], .95); add('sfx', I.whoosh(1.1, 160, 3800, .8, 41, .2), C['bloom'] - .1, .7); add('sfx', I.shimmer(2.0, .25, 3, 84), C['bloom'] + .2)
for j in range(8): add('sfx', lp(hp(I.whoosh(.35, 800, 1800, .5, 60 + j, .25), 500), 4000), C['bloom'] + .3 + j * B / 2, .42, pn(j) * 2) # blown ochre
for k in range(8): add('perc', I.frame(.5 + .05 * k, 74, k), C['bloom'] + k * B, .9)
for i in range(16): add('perc', I.foot(.5 + .03 * i, i), C['hunt'] + i * B / 2, .65, pn(i)); add('perc', I.clap(.4 + .02 * i, i), C['hunt'] + i * B / 2 + B / 4, .25 if i > 3 else 0, -pn(i))
for i in range(40): add('perc', I.hoof(.35 + .01 * i, i), C['hunt'] + i * B / 4, .35, math.sin(i * .3) * .6)
add('choir', I.choir([(0, 2.4, 50, .7), (2.5, 2.4, 53, .8)], 5.2, 'o', 6, 50, att=.5), C['hunt'], .5); add('choir', I.choir([(a, d, m, v) for a, d, m, v in tune(62, MIN, .7, a=4)], 2.8, 'a', 5, 51), C['figure'], .45); plucks('gut', tune(62, MIN, .8, a=0, b=4), C['figure'], .7, 0, 2.2, 940)
for j in range(4): add('sfx', I.twang(50 + [0, 3, 5, 7][j], .7, j), C['figure'] + B * (j + 1) - (0 if j < 3 else .02), .6); add('perc', I.frame(.8, 74, j), C['figure'] + j * B, .9)
add('sfx', I.whoosh(.7, 200, 4200, .8, 70, .7), C['title'] - .55, .8); pad(C['bloom'], 5, 'D5', 44); pad(C['figure'], 2.5, 'Dm', 50); pad(C['title'], 2.3, 'D', 66, 1); HORNS += [Note(C['title'], 50, 1.1, 84), Note(C['title'], 57, 1.1, 80), Note(C['title'] + 1.25, 62, 1.0, 92), Note(C['title'] + 1.25, 57, 1.0, 84)]
for i in range(8): add('sfx', I.twang(57 + [0, 2, 5, 7, 9, 12, 14, 17][i], .5, 20 + i), C['title'] + i * .118, .42, -.6 + i * .17)
add('sfx', I.boom(1.0, 42, 3, 9), C['title'], .8); add('perc', I.gong(38, .7, 6, 8), C['title'], .6); add('sfx', I.shimmer(1.8, .25, 5, 86), C['title'] + .4); add('choir', I.choir([(0, 2.3, m, .8) for m in (50, 57, 62, 66)], 3, 'a', 10, 53, att=.15), C['title'], .5); add('sfx', I.whoosh(.9, 200, 3600, .8, 71, .75), C['panels'] - .7, .8)
for i in range(6): add('perc', I.taiko(.5 + .08 * i, 60, i), C['panels'] - 6 * B / 4 + i * B / 4, .7)
# --- panel cues
KIND = {'twang': lambda s: I.twang(45, .7, s), 'thump': lambda s: I.membrane(62, .9, .2, .7, .6, .3, .7, s), 'stamp': lambda s: I.membrane(95, .9, .1, .4, .4, .4, 1.0, s, .3), 'whoosh': lambda s: I.whoosh(.5, 300, 2800, .4, s, .5), 'splash': lambda s: I.splash(.6, s), 'bell': lambda s: I.tibell(86, .4, 2.5, s), 'drum': lambda s: I.taiko(.8, 64, s), 'shimmer': lambda s: I.shimmer(1.0, .2, s, 86, 18), 'rattle': lambda s: I.rattle(.6, .16, 5200, s), 'flap': lambda s: I.flap(.5, s), 'hoof': lambda s: I.hoof(.6, s), 'wave': lambda s: I.splash(.5, s) * .8 + 0, 'crackle': lambda s: I.crackle(.9, .5, 40, s), 'chime': lambda s: I.tibell(93, .3, 2.2, s), 'click': lambda s: I.sticks(.6, 1400, s), 'roll': lambda s: lp(I.crackle(1.6, .6, 60, s), 1800) + I.wind(1.6, .3, s)[:int(1.6 * SR)], 'wind': lambda s: I.wind(1.8, .4, s), 'bird': lambda s: I.bird(.35, s), 'gong': lambda s: I.gong(43, .5, 4, s), 'pluck': lambda s: P('lyre', 69, 1.6, .7, s), 'rip': lambda s: I.rip(.5, s), 'sparkle': lambda s: I.shimmer(.6, .16, s, 91, 10)}
ns = 0
for p in Q['panels']:
    for j, c in enumerate(p['sfx']):
        f = KIND.get(c.get('s'))
        if f: add('sfx', f(ns + 1000), p['t'] + float(c['t']), .42 * float(c.get('v', 1)), pn(j) * 1.6); ns += 1
print('sfx cues', ns)
# --- montage (eight beats), ring, pull, whole
M = C['montage']
for i in range(8):
    tt = M + i * B; add('perc', I.taiko(.8 + .03 * i, 58, i), tt, 1.0); add('perc', I.taiko(.5 + .05 * i, 70, 40 + i), tt + B / 2, .7, .3); add('sfx', I.whoosh(.4, 400, 3800, .5, 90 + i, .6), tt - .22, .5, pn(i) * 2); add('sfx', I.twang(57 + dg(MIN, i), .7, 60 + i), tt, .55)
    for j in range(4): add('perc', I.rattle(.3 + .04 * i, .08, 6400, i * 4 + j), tt + j * B / 4, .4, .4); add('loom', I.sticks(.4, 900, j), tt + j * B / 4, .35, -.3)
    kind = ['sitar', 'kora', 'guzheng', 'charango', 'lyre', 'koto', 'harp', 'santur'][i]; bt = [x for x in tune(62, MIN, .9) if i * B - 1e-3 <= x[0] < (i + 1) * B - 1e-3]
    for (a, d, m, v) in bt: add('pluck', P(kind, m, 1.8, v, 1200 + i), M + a, .8, pn(i)); add('pluck', P(kind, m + 12, 1.4, v * .5, 1230 + i), M + a, .5, -pn(i))
pad(M, 2.5, 'Asus', 66, 1); pad(M + 2.5, 2.5, 'A', 80, 1); HORNS += [Note(M, 45, 2.4, 70), Note(M + 2.5, 52, 2.4, 92), Note(M + 2.5, 57, 2.4, 92)]; add('choir', I.choir([(0, 2.4, 57, .7), (2.5, 2.4, 61, .95), (2.5, 2.4, 64, .9)], 5.2, 'a', 9, 60, att=.6), M, .55); add('sfx', I.whoosh(2.4, 120, 5200, .9, 99, .93), M + 2.6, .7)
R = C['ring']
def tutti(t, d, root, scale, ch, full):
    tn = tune(62, MIN, .95); pad(t, d, ch[0], 84 if full else 74, 1); pad(t + d / 2, d / 2, ch[1], 88 if full else 78, 1)
    for k in range(int(d / B)): add('perc', I.taiko(.95 if k % 2 == 0 else .6, 56, k), t + k * B, .95); add('perc', I.clap(.6, k), t + k * B, .35 if k % 2 else 0, .3)
    for k in range(int(d / B) * 2): add('perc', I.foot(.6, k), t + k * B / 2, .5, pn(k)); add('perc', I.rattle(.5, .1, 6000, k), t + k * B / 2, .4, .4); add('perc', I.djembe('bts'[k % 3], .7, k), t + k * B / 2, .5, -.3)
    add('choir', I.choir(tn, 5.6, 'a', 12, 70 + int(t)), t, .62); add('choir', I.choir([(a, dd, m - 12, v) for a, dd, m, v in tn], 5.6, 'o', 8, 80 + int(t)), t, .45)
    HORNS.extend(humanize([Note(t + a, int(m) - 12, dd, 92) for a, dd, m, v in tn], 5)); 
    for kind, p, o, g in (('kora', -.5, 0, .5), ('santur', .5, 12, .35), ('charango', .3, 12, .3), ('koto', -.3, 0, .45), ('sitar', .15, 0, .4)): plucks(kind, [(a, dd, m + o, v * .8) for a, dd, m, v in tn], t, g, p, 1.8, int(1300 + t * 7 + o))
    add('lead', I.flute([(a, dd, m + 12, v) for a, dd, m, v in tn], 5.6, .4, .35, 90, vib=(5.2, .2, .15)), t, .45, .3); add('lead', I.bowed([(a, dd, m, v * .8) for a, dd, m, v in tn], 5.6, seed=91), t, .35, -.3)
tutti(R, 5, 62, MIN, ('Dm', 'F'), False); add('sfx', I.boom(1, 42, 3, 30), R, .8); add('perc', I.gong(38, .8, 6, 30), R, .7)
tutti(C['pull'], 5, 62, MIN, ('Bb', 'C'), True); add('sfx', I.boom(1, 42, 3, 31), C['pull'], .9); add('sfx', I.whoosh(2.6, 100, 3600, .9, 120, .9), C['pull'] + 4.9, .8)
t3 = C['pull'] + 5; pad(t3, 2.5, 'Gm', 92, 1); TROM += [Note(t3, 43, 2.4, 96), Note(t3, 50, 2.4, 92)]; HORNS += [Note(t3, 55, 2.4, 100), Note(t3, 62, 2.4, 100)]; add('choir', I.choir([(0, 2.45, m, .95) for m in (55, 58, 62, 67)], 3, 'a', 14, 88, att=.3), t3, .6)
for k in range(16): add('perc', I.taiko(.4 + .035 * k, 60 + k % 3 * 4, k), t3 + k * B / 4, .75, pn(k) * 2)
W = C['whole']; add('sfx', I.boom(1.2, 36, 5, 44), W, 1.0); add('perc', I.gong(38, 1.0, 9, 45), W, .9); add('perc', I.taiko(1, 50, 3), W, 1.1); add('sfx', I.shimmer(4.5, .34, 7, 84, 70), W + .1); pad(W, 5.4, 'D', 96, 1); pad(W + 5, 5.5, 'Dm', 62, 1)
HORNS += [Note(W, 50, 4.6, 104), Note(W, 57, 4.6, 104), Note(W, 62, 4.6, 104), Note(W, 66, 4.6, 98)]; TROM += [Note(W, 38, 4.4, 100), Note(W, 45, 4.4, 98)]; add('choir', I.choir([(0, 4.9, m, .95) for m in (50, 57, 62, 66, 69, 74)], 6, 'a', 18, 92, att=.12, rel=.8), W, .7); add('choir', I.choir([(0, 4.8, 38, .9), (0, 4.8, 45, .8)], 5.8, 'o', 8, 93), W, .5)
# --- glide to the empty square: the tune, slow, on one string
G = C['glide']; slow = [(a * 1.5, d * 1.5, m, v) for a, d, m, v in tune(62, MIN, .62)]
plucks('gut', slow, G + 1.25, .9, 0, 3.4, 1500, bright=.4); plucks('harp', [(a, d, m - 12, v * .5) for a, d, m, v in slow if a % 1.875 < .01 or d > .8], G + 1.25, .6, .2, 3.4, 1540); add('choir', I.choir([(0, 7, 62, .35), (0, 7, 57, .3)], 8, 'u', 6, 95, att=2, rel=2), G + .5, .4); add('amb', I.wind(18, .22, 12), G, .6); add('sfx', I.whoosh(3.2, 100, 900, .4, 130, .5), G + .2, .5)
Hh = C['hands']; pad(Hh, 5, 'Bb', 48, 0); pad(Hh + 5, 5.4, 'D', 50, 1); kid = [(0, 1.1, 74, .55), (1.25, .55, 77, .5), (1.875, .55, 79, .5), (2.5, 1.2, 81, .6), (3.75, .6, 79, .5), (4.375, 1.6, 74, .55)]
add('choir', I.choir(kid, 6.8, 'u', 3, 97, spread=.08, vib=(5.4, .12, .4)), Hh + 1.0, .42); 
for j, (dt, m) in enumerate(((.9, 62), (1.5, 69), (2.0, 74))): add('sfx', I.twang(m, .4, 70 + j), Hh + dt, .45)
L = C['held']; plucks('gut', [(0, 2, 62, .6), (1.25, 2, 69, .55), (2.5, 2, 67, .5), (3.75, 2, 69, .5), (4.6875, 2, 72, .5), (5.625, 4, 74, .6)], L, .85, 0, 5, 1600, bright=.4)
plucks('harp', [(0, 2, 38, .5), (2.5, 2, 45, .45), (5.625, 4, 50, .5), (5.66, 4, 57, .45), (5.70, 4, 62, .4), (5.74, 4, 66, .4)], L, .7, .15, 5, 1640); add('choir', I.choir([(0, 6.5, 50, .4), (0, 6.5, 57, .4), (0, 6.5, 62, .35), (0, 6.5, 66, .3)], 9, 'a', 10, 99, att=1.5, rel=2.2), L + 2.4, .4)
for k in range(10): add('loom', I.log(.3, 330, k), L + k * B * 2 + B, .30, .1); add('loom', I.membrane(64, .35, .12, .4, .3, .2, .8, k), L + k * B * 2, .4)
# sampled orchestra
print('orchestra…'); LN = DUR + 2
def orch(name, notes, g, stem):
    ok = [x for x in notes if 24 <= x.pitch <= 96]
    try: y = render_notes(instrument(name), ok, LN); ST[stem][:min(N, len(y))] += y[:N] * g
    except Exception as e: print('orch', name, e)
orch('strings', humanize(STR, 2, 12, 3), .50, 'strings'); orch('horns', HORNS, .50, 'brass'); orch('trombones', TROM, .5, 'brass'); orch('bass', BASS, .5, 'low')
# ================================================================ mix
print('mix…')
G_ = {'lead': 2.0, 'pluck': 2.15, 'perc': .58, 'low': 1.0, 'strings': .62, 'brass': 1.15, 'choir': 2.0, 'loom': .6, 'sfx': .62, 'amb': .6}; WET = {'lead': (.16, .22), 'pluck': (.18, .16), 'perc': (.16, .12), 'low': (.06, .08), 'strings': (.05, .30), 'brass': (.04, .34), 'choir': (.06, .34), 'loom': (.2, .08), 'sfx': (.06, .22), 'amb': (0, .15)}
for k in ST: print('  %-8s rms %.1f dB peak %.2f' % (k, 10 * np.log10((ST[k] ** 2).mean() + 1e-12), np.abs(ST[k]).max()))
dry = sum(ST[k] * G_[k] for k in ST); room = sum(ST[k] * G_[k] * WET[k][0] for k in ST); hall = sum(ST[k] * G_[k] * WET[k][1] for k in ST)
tt = np.arange(N) / SR; big = np.interp(tt, [0, C['panels'] - 2, C['panels'], C['ring'], C['whole'], C['end']], [1.5, 1.5, .8, .9, 1.4, 1.6])[:, None]
x = dry + convolve(room, ROOM)[:N] + convolve(hall, HALL)[:N] * big
x = hp(x, 28); x, _ = compress(x, -17, 1.8, .02, .22, makeup_db=1.5); env = np.interp(tt, [0, .4, C['out'], C['end'] - .05, C['end']], [0, 1, 1, 0.0, 0]); x = x * env[:, None]; x = x[:int(DUR * SR)]
for _ in range(3): g = -15.0 - lufs_integrated(x); x = limiter(soft_clip(x * 10 ** (g / 20)), -1.4)
print('LUFS %.2f  TP %.2f dBTP' % (lufs_integrated(x), true_peak_db(x))); write_wav(os.path.join(ROOT, 'out', 'soundtrack.wav'), x, 24)
