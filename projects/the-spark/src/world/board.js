// The motherboard as a landscape at golden hour: PCB valley, copper trace rivers, capacitor groves, RAM cliffs,
// a cooler tower with a slow fan on the horizon, light shafts through the case vents. Units ~ millimetres.
import * as THREE from 'three';
import { paint } from '../gl/paint.js';
import { Sprites, Ribbon, shaftMat, fxMesh } from '../gl/fx.js';
import { rbox, cyl, mesh, inst, merge, at, V3 } from '../gl/geo.js';
import { canvasTexture } from '../gl/tex.js';
import { rng, TAU, clamp, hash2, smooth } from '../core.js';

function pcbTexture() {
  return canvasTexture(2048, 2048, (c, S) => {
    const r = rng(404);
    c.fillStyle = '#0d5546'; c.fillRect(0, 0, S, S);
    // large tonal patches (ground planes)
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '8,70,58' : '20,104,84'},${0.25 + r() * 0.3})`;
      const w = 200 + r() * 500, h = 120 + r() * 420; c.fillRect(r() * S - w / 2, r() * S - h / 2, w, h);
    }
    const wrap = fn => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { c.save(); c.translate(ox, oy); fn(); c.restore(); } };
    // trace buses: parallel lines with 45-degree jogs, ending in vias
    for (let b = 0; b < 150; b++) {
      const n = 1 + Math.floor(r() * 7), gap = 9 + r() * 5;
      let x = r() * S, y = r() * S, d = Math.floor(r() * 8);
      const pts = [[x, y]];
      for (let k = 0; k < 3 + Math.floor(r() * 4); k++) {
        const len = 60 + r() * 320; x += Math.cos(d * Math.PI / 4) * len; y += Math.sin(d * Math.PI / 4) * len; pts.push([x, y]);
        d = (d + (r() < 0.5 ? 1 : 7)) % 8;
      }
      const col = r() < 0.16 ? 'rgba(214,168,84,0.9)' : `rgba(${40 + r() * 20},${150 + r() * 30},${118 + r() * 20},0.85)`;
      wrap(() => {
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * gap;
          c.strokeStyle = col; c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
          pts.forEach(([px, py], j) => { const q = px + o * 0.7, w = py - o * 0.7; j ? c.lineTo(q, w) : c.moveTo(q, w); });
          c.stroke();
          const [ex, ey] = pts[pts.length - 1];
          c.fillStyle = 'rgba(226,186,104,0.95)'; c.beginPath(); c.arc(ex + o * 0.7, ey - o * 0.7, 6, 0, TAU); c.fill();
          c.fillStyle = '#083c33'; c.beginPath(); c.arc(ex + o * 0.7, ey - o * 0.7, 2.4, 0, TAU); c.fill();
        }
      });
    }
    // solder pad rows and silkscreen ticks
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, n = 3 + Math.floor(r() * 9), hz = r() < 0.5;
      wrap(() => {
        for (let k = 0; k < n; k++) { c.fillStyle = 'rgba(224,196,128,0.9)'; hz ? c.fillRect(x + k * 16, y, 9, 20) : c.fillRect(x, y + k * 16, 20, 9); }
        c.strokeStyle = 'rgba(236,240,226,0.55)'; c.lineWidth = 2.5;
        hz ? c.strokeRect(x - 8, y - 8, n * 16 + 9, 36) : c.strokeRect(x - 8, y - 8, 36, n * 16 + 9);
      });
    }
  });
}

export function buildBoard() {
  // the world is authored right-to-left and mirrored, so the journey reads left-to-right on screen
  const root = new THREE.Scene();
  const scene = new THREE.Group(); scene.scale.x = -1; root.add(scene);
  const R = rng(77);
  root.fog = new THREE.FogExp2(0xb07a5a, 0.0012);
  root.userData.clear = 0x2a1a12;
  const cam = new THREE.PerspectiveCamera(30, 1920 / 804, 0.5, 600);
  // ---- light: low golden backlight through the vents, teal ambient
  const sun = new THREE.DirectionalLight(0xffc48a, 1.35); sun.position.set(60, 46, -90); sun.target.position.set(0, 0, 10);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.25;
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 100, bottom: -100, near: 10, far: 320 });
  const hemi = new THREE.HemisphereLight(0x6fb8c4, 0x0b3a36, 0.32);
  scene.add(sun, sun.target, hemi);

  // ---- ground
  const tex = pcbTexture(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4.2, 3.4);
  const ground = mesh(new THREE.PlaneGeometry(520, 420), paint(0xd8fff0, { map: tex, scale: 0.022, stroke: 0.4 }), { cast: false });
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -40); scene.add(ground);

  // ---- materials
  const alu = paint(0xb9c4cc, { scale: 0.045, stroke: 0.4, rim: 1.2 });
  const aluDark = paint(0x55636e, { scale: 0.045, stroke: 0.4 });
  const graphite = paint(0x232b33, { scale: 0.05, stroke: 0.4, rim: 1.4 });
  const sleeve = paint(0xffffff, { scale: 0.07, stroke: 0.45, rim: 1.3 });
  const gold = paint(0xe9b75a, { scale: 0.08, stroke: 0.4, rim: 1.5 });
  const copper = paint(0xc8793a, { scale: 0.05, stroke: 0.4, rim: 1.3 });
  const tan = paint(0xc9a36b, { scale: 0.5, stroke: 0.3 });
  const slot = paint(0x2a2f38, { scale: 0.05, stroke: 0.35, rim: 1.2 });

  // ---- capacitor groves (sleeve + aluminium cap)
  const caps = [], tops = [];
  const grove = (cx, cz, n, spread, rmin, rmax, hmin, hmax) => {
    for (let i = 0; i < n; i++) {
      const rad = rmin + R() * (rmax - rmin), h = hmin + R() * (hmax - hmin);
      const x = cx + (R() - 0.5) * spread, z = cz + (R() - 0.5) * spread * 0.7;
      const c = [0x1f3f7a, 0x2a4f8f, 0x4a2c78, 0x1c3440, 0x146a72][Math.floor(R() * 5)];
      caps.push({ p: [x, h / 2, z], s: [rad, h, rad], c });
      tops.push({ p: [x, h + 0.06, z], s: [rad * 0.93, 0.14, rad * 0.93], r: [0, R() * TAU, 0] });
    }
  };
  grove(-34, 30, 9, 24, 1.7, 2.6, 6, 10); grove(34, 34, 7, 20, 1.5, 2.4, 5, 9); grove(-58, -6, 10, 30, 2, 3, 7, 12);
  grove(34, -6, 6, 14, 1.2, 1.8, 4, 6); grove(-34, -40, 8, 24, 1.6, 2.4, 6, 9); grove(60, -30, 9, 30, 1.8, 2.8, 6, 11);
  grove(-20, 52, 5, 14, 1.3, 2.0, 4, 7); grove(46, 58, 4, 12, 1.4, 2.2, 5, 8);
  scene.add(inst(cyl(1, 1, 1, 28), sleeve, caps));
  scene.add(inst(cyl(1, 1, 1, 28), alu, tops));

  // ---- chips (ICs) with pin rows, SMD pebbles
  const chips = [], pins = [], smd = [];
  for (let i = 0; i < 26; i++) {
    const w = 4 + R() * 9, d = 4 + R() * 8, x = (R() - 0.5) * 190, z = (R() - 0.5) * 150 - 5;
    if (Math.abs(x + 2) < 30 && z < -30 && z > -100) continue;      // keep the socket clear
    if (x > 52 && x < 100 && z > -70 && z < 50) continue;            // RAM bank
    if (w > 9 && Math.abs(x) < 26 && z > -20) continue;               // keep big packages off the run
    chips.push({ p: [x, 0.6, z], s: [w, 1.2, d] });
    const n = Math.floor(w / 1.1);
    for (let k = 0; k < n; k++) for (const s of [-1, 1]) pins.push({ p: [x - w / 2 + 0.6 + k * 1.1, 0.25, z + s * (d / 2 + 0.35)], s: [0.5, 0.3, 0.9] });
  }
  scene.add(inst(rbox(1, 1, 1, 0.08, 2), graphite, chips));
  scene.add(inst(new THREE.BoxGeometry(1, 1, 1), alu, pins, { cast: false }));
  for (let i = 0; i < 520; i++) {
    const gx = Math.round((R() - 0.5) * 60) * 3.2, gz = Math.round((R() - 0.5) * 50) * 3.2 - 6, rot = R() < 0.5;
    smd.push({ p: [gx + (R() - 0.5), 0.22, gz + (R() - 0.5)], s: rot ? [1.3, 0.45, 0.7] : [0.7, 0.45, 1.3], c: R() < 0.5 ? 0xa88a5c : R() < 0.6 ? 0x22252b : 0x6e5a48 });
  }
  scene.add(inst(rbox(1, 1, 1, 0.12, 2), paint(0xffffff, { scale: 0.5, stroke: 0.3 }), smd, { cast: false }));

  // ---- RAM cliffs (right): slot + stick + heat spreader + light bar
  const ram = new THREE.Group(); scene.add(ram);
  const ramBars = [];
  for (let i = 0; i < 4; i++) {
    const x = 62 + i * 9.5, z = -12;
    ram.add(mesh(rbox(3.2, 2.4, 124, 0.3, 2), slot, { x, y: 1.2, z }));
    ram.add(mesh(rbox(0.9, 26, 118, 0.2, 2), paint(0x0f3f37, { scale: 0.1 }), { x, y: 14, z }));
    ram.add(mesh(rbox(2.2, 22, 116, 0.5, 3), i % 2 ? aluDark : graphite, { x, y: 17, z }));
    const bar = mesh(rbox(2.0, 2.2, 114, 0.9, 3), paint(0x402014, { emissive: 0xffa040, emissiveIntensity: 0.0, stroke: 0.1 }), { x, y: 29, z, cast: false });
    ram.add(bar); ramBars.push(bar);
    for (let k = 0; k < 14; k++) ram.add(mesh(rbox(2.5, 14, 1.2, 0.3, 2), alu, { x, y: 16, z: z - 52 + k * 8 }));
  }
  // gold contact teeth along the first stick
  const teeth = []; for (let k = 0; k < 58; k++) teeth.push({ p: [62 - 1.75, 3.0, -12 - 57 + k * 2], s: [0.25, 1.6, 1.2] });
  scene.add(inst(new THREE.BoxGeometry(1, 1, 1), gold, teeth, { cast: false }));

  // ---- CPU socket and the cooler tower with its fan (the horizon landmark)
  const tower = new THREE.Group(); tower.position.set(-4, 0, -64); scene.add(tower);
  tower.add(mesh(rbox(46, 3, 46, 0.6, 2), slot, { y: 1.5 }));
  tower.add(mesh(rbox(36, 2.4, 36, 0.8, 3), alu, { y: 4.2 }));
  tower.add(mesh(rbox(26, 5, 26, 1, 3), copper, { y: 7.8 }));
  const fins = []; for (let i = 0; i < 30; i++) fins.push({ p: [0, 13 + i * 1.75, 0], s: [44, 0.5, 30] });
  tower.add(inst(rbox(1, 1, 1, 0.12, 1), alu, fins));
  const pipes = []; for (const x of [-15, -5, 5, 15]) for (const z of [-8, 8]) pipes.push({ p: [x, 36, z], s: [1.3, 58, 1.3] });
  tower.add(inst(cyl(1, 1, 1, 14), copper, pipes));
  tower.add(mesh(rbox(46, 3, 32, 1, 3), graphite, { y: 66.5 }));
  // fan: frame ring + blades facing the camera
  const fan = new THREE.Group(); fan.position.set(0, 39, 19); tower.add(fan);
  const frame = merge([at(new THREE.TorusGeometry(21, 1.6, 10, 56)), at(rbox(46, 3, 4, 0.8, 2), 0, 22.5, 0), at(rbox(46, 3, 4, 0.8, 2), 0, -22.5, 0), at(rbox(3, 46, 4, 0.8, 2), 22.5, 0, 0), at(rbox(3, 46, 4, 0.8, 2), -22.5, 0, 0)]);
  fan.add(mesh(frame, graphite));
  const rotor = new THREE.Group(); fan.add(rotor);
  rotor.add(mesh(at(cyl(5.5, 5.5, 3.5, 28), 0, 0, 0, Math.PI / 2), aluDark));
  const blade = new THREE.Shape(); blade.moveTo(4, -1.5); blade.bezierCurveTo(9, -7, 17, -6, 19.5, 1); blade.bezierCurveTo(17, 5, 9, 6, 4.5, 2.5); blade.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(blade, { depth: 0.5, bevelEnabled: false, curveSegments: 10 });
  const bladeMat = paint(0x6f8792, { scale: 0.12, stroke: 0.3, side: THREE.DoubleSide, rim: 1.4 });
  for (let i = 0; i < 9; i++) { const b = mesh(bladeGeo, bladeMat); b.rotation.set(0.42, 0, 0); const h = new THREE.Group(); h.rotation.z = (i / 9) * TAU; h.add(b); rotor.add(h); }

  // ---- VRM heatsinks flanking the socket, chipset block, GPU slab
  const sink = (x, z, w, d, h, n) => { const g = []; g.push(at(rbox(w, 2, d, 0.4, 2), x, 1, z)); for (let i = 0; i < n; i++) g.push(at(rbox(w, h, d / n * 0.55, 0.25, 2), x, 2 + h / 2, z - d / 2 + (i + 0.5) * d / n)); return merge(g); };
  scene.add(mesh(sink(-44, -64, 12, 48, 13, 10), alu)); scene.add(mesh(sink(-4, -104, 44, 12, 11, 3), alu));
  scene.add(mesh(sink(44, 10, 20, 20, 5, 7), aluDark));
  const gpu = mesh(rbox(190, 16, 12, 1.2, 3), graphite, { x: -30, y: 34, z: 64, cast: false }); gpu.visible = false; scene.add(gpu);

  // ---- far case wall with vent slits (the "sky") and shafts
  const wall = mesh(new THREE.PlaneGeometry(700, 220), paint(0x1a1210, { stroke: 0.1 }), { cast: false, z: -170, y: 80 }); scene.add(wall);
  // painted in the world layer (so it is occluded and brushed like everything else), unlit and HDR
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv;
      float hh(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      void main(){
        float y = vUv.y;
        // sunset through the rear grille: a hot band low, cooling to plum and slate above
        vec3 col = mix(vec3(0.95, 0.4, 0.16), vec3(1.25, 0.8, 0.42), smoothstep(0.2, 0.33, y) * smoothstep(0.52, 0.36, y));
        col = mix(col, vec3(0.42, 0.2, 0.32), smoothstep(0.4, 0.62, y));
        col = mix(col, vec3(0.05, 0.16, 0.22), smoothstep(0.52, 0.85, y));
        col *= smoothstep(0.1, 0.24, y);
        // grille: irregular slits of light between dark slats, like trunks against a low sun
        float x = vUv.x * 58.0, id = floor(x), f = fract(x);
        float w = 0.3 + 0.42 * hh(id);
        float slit = smoothstep(w, w + 0.12, f) * smoothstep(1.0, 0.9, f);
        float cross = smoothstep(0.03, 0.06, abs(fract(y * 4.0 + hh(id) * 0.2) - 0.5));
        gl_FragColor = vec4(col * (0.05 + 0.95 * slit * cross), 1.0); }`,
  }));
  sky.position.set(0, 70, -168); scene.add(sky);
  const shafts = new THREE.Group(); scene.add(shafts);
  const sm = shaftMat(0xffb070, { gain: 0.2, mode: 1, streak: 3, pow: 1.2, soft: 14, fadeTop: 0.02, fadeBot: 0.75 });
  for (let i = 0; i < 9; i++) {
    const s = fxMesh(new THREE.PlaneGeometry(14 + hash2(i, 5) * 20, 210), sm);
    s.position.set(-170 + i * 40 + hash2(i, 9) * 14, 74, -100 + hash2(i, 3) * 70); s.rotation.set(0.0, 0, -0.62);
    shafts.add(s);
  }
  // ---- the hero trace: a gold river from the foreground to the socket
  const pathPts = [[58, 0.5, 78], [40, 0.5, 60], [38, 0.5, 44], [20, 0.5, 34], [2, 0.5, 30], [-10, 0.5, 14], [-8, 0.5, -4], [8, 0.5, -16], [6, 0.5, -30], [-4, 0.5, -38], [-4, 0.5, -46]].map(p => V3(...p));
  const path = new THREE.CatmullRomCurve3(pathPts, false, 'catmullrom', 0.5);
  const strip = (curve, w, y) => {
    const n = 220, pos = [], idx = [], nor = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n), sx = -tg.z, sz = tg.x;
      pos.push(p.x + sx * w, y, p.z + sz * w, p.x - sx * w, y, p.z - sz * w); nor.push(0, 1, 0, 0, 1, 0);
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  };
  for (const [o, w] of [[0, 0.75], [2.2, 0.32], [-2.2, 0.32], [3.6, 0.22], [-3.6, 0.22]]) {
    const pts = pathPts.map((p, i) => { const tg = path.getTangentAt(i / (pathPts.length - 1)); return V3(p.x - tg.z * o, 0, p.z + tg.x * o); });
    scene.add(mesh(strip(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), w, 0.12 + (o ? 0 : 0.03)), gold, { cast: false }));
  }
  const wake = new Ribbon(120, { color: 0xffc061, gain: 2.0, core: 0.7, soft: 2 }); scene.add(wake.mesh);

  // ---- LEDs that bloom as the spark passes, dust in the shafts, foreground bokeh
  const leds = []; const ledGlow = new Sprites(60, { shape: 'dot', core: 0.9, soft: 1.5 }); scene.add(ledGlow.mesh);
  for (let i = 0; i < 60; i++) {
    const u = 0.04 + (i / 60) * 0.94 + (R() - 0.5) * 0.01, p = path.getPointAt(clamp(u)), tg = path.getTangentAt(clamp(u)), side = (i % 2 ? 1 : -1) * (6 + R() * 16);
    leds.push({ u, x: p.x - tg.z * side, z: p.z + tg.x * side, y: 0.9, c: [[1.0, 0.72, 0.35], [0.45, 1.0, 0.75], [1.0, 0.5, 0.42], [0.5, 0.85, 1.0]][i % 4], h: R() });
  }
  scene.add(inst(new THREE.SphereGeometry(0.4, 12, 8), paint(0xdfe8e0, { stroke: 0.1 }), leds.map(l => ({ p: [l.x, l.y - 0.2, l.z] })), { cast: false }));
  const dust = new Sprites(420, { shape: 'dot', core: 0.2, soft: 3, drift: [3.5, 0.22, 0.6] });
  for (let i = 0; i < 420; i++) dust.set(i, (R() - 0.5) * 240, 2 + R() * 60, 90 - R() * 230, 0.35 + R() * 0.9, 1.0, 0.78, 0.5, 0.25 + R() * 0.5, R());
  dust.commit(); scene.add(dust.mesh);
  const bokeh = new Sprites(26, { shape: 'bokeh', soft: 2, drift: [1.2, 0.15, 0.3] });
  scene.add(bokeh.mesh);

  return {
    scene: root, cam, sun, hemi, path, pathLen: path.getLength(), at: u => { const p = path.getPointAt(clamp(u)); p.x = -p.x; return p; }, tan: u => { const p = path.getTangentAt(clamp(u)); p.x = -p.x; return p; }, leds, ledGlow, wake, rotor, ramBars, dust, bokeh, shafts, sm,
    // progress u (0..1) of the spark along the hero trace lights the wake, the LEDs and the RAM bars
    update(t, u, cameraW) {
      const camera = { position: V3(-cameraW.position.x, cameraW.position.y, cameraW.position.z) };
      rotor.rotation.z = -t * 1.1;
      const pts = []; const n = 110;
      for (let i = 0; i < n; i++) pts.push(path.getPointAt(clamp(u * (i / (n - 1)))).setY(0.3));
      wake.update(pts, camera, 2.6, (i, k) => u <= 0 ? 0 : 0.16 + 0.5 * Math.pow(k, 6));
      leds.forEach((l, i) => {
        const on = smooth(l.u - 0.01, l.u + 0.035, u), pop = 1 + 1.2 * Math.max(0, 1 - Math.abs(u - l.u - 0.03) / 0.03);
        ledGlow.set(i, l.x, l.y + 0.4, l.z, (2.2 + l.h * 1.6) * pop * on, l.c[0], l.c[1], l.c[2], on * (0.8 + 0.2 * Math.sin(t * 3 + i)), l.h);
      });
      ledGlow.commit();
      ramBars.forEach((b, i) => { b.material.emissiveIntensity = 1.5 * smooth(0.25 + i * 0.07, 0.4 + i * 0.07, u); });
    },
  };
}
