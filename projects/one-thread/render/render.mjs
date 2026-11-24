// Offline renderer: headless Chrome (GPU) over the DevTools protocol, no npm deps. Node >= 22.
//   node render/render.mjs --panel ur --t 0.5,2,4 [--view full|shot] [--sheet name] [--cols 2] [--scale 0.5]   panel look-dev
//   node render/render.mjs --stills 3.2,10.5 [--sheet name]                                                       film stills
//   node render/render.mjs [--h 1080|2160] [--jobs 3] [--from a --to b]                                           film (muxes out/soundtrack.wav)
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), projectDir = path.resolve(here, '..'), outDir = path.join(projectDir, 'out');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
const NAME = 'one-thread', H = +opt('h', 1080), JOBS = +opt('jobs', 3), CRF = String(opt('crf', 15));
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const pw of [path.join(homedir(), 'Library/Caches/ms-playwright'), path.join(homedir(), '.cache/ms-playwright')]) { let ds = []; try { ds = readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse(); } catch {} for (const d of ds) for (const sh of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) { const p = path.join(pw, d, sh, 'chrome-headless-shell'); if (existsSync(p)) return p; } }
  return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync) || 'google-chrome';
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const sinks = new Map();
function serve() {
  return new Promise(res => {
    const s = createServer(async (rq, rs) => {
      const u = new URL(rq.url, 'http://x');
      if (rq.method === 'POST') { const ch = []; for await (const c of rq) ch.push(c); const f = sinks.get(u.pathname); if (f) await f(Buffer.concat(ch), +u.searchParams.get('i')); rs.writeHead(200).end(); return; }
      const p = path.join(projectDir, decodeURIComponent(u.pathname)); if (!p.startsWith(projectDir)) return rs.writeHead(403).end();
      try { const b = await readFile(p); rs.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); rs.end(b); } catch { rs.writeHead(404).end(); }
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
async function browser(port, query) {
  const userDir = await mkdtemp(path.join(tmpdir(), 'one-thread-chrome-')), chromePath = findChrome();
  const proc = spawn(chromePath, [...(chromePath.includes('headless-shell') ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${userDir}`, '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps', '--disable-features=Translate,OptimizationHints,MediaRouter', '--no-service-autorun', '--disable-crash-reporter', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', '--window-size=1920,1080', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--js-flags=--max-old-space-size=8192', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let tail = ''; const wsUrl = await new Promise((ok, no) => { proc.stderr.on('data', d => { tail = (tail + d).slice(-5000); const m = tail.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); }); proc.on('exit', c => no(new Error('chrome exited ' + c + tail))); });
  let closing = false; proc.on('exit', (c, s) => { if (!closing) { console.error('chrome died', c, s, tail.slice(-1500)); process.exit(2); } });
  const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map(); let sessionId;
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); } else if (m.method === 'Runtime.consoleAPICalled') console.log('[page]', m.params.args.map(a => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') console.error('[page error]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
  await new Promise(r => (ws.onopen = r));
  const send = (method, params = {}, sid = sessionId) => new Promise((ok, no) => { const i = ++id; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }); sessionId = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?render=1&${query}` });
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  for (let i = 0; i < 300; i++) { if (await ev('!!(window.FILM&&window.FILM.ready)').catch(() => 0)) break; await new Promise(r => setTimeout(r, 100)); }
  await ev('window.FILM.ready');
  return { ev, close: async () => { closing = true; ws.close(); proc.kill('SIGKILL'); await rm(userDir, { recursive: true, force: true }).catch(() => 0); } };
}
const sheetOf = (files, name, cols) => { const out = path.join(outDir, name + '.png'); const rows = Math.ceil(files.length / cols); const inp = files.flatMap(f => ['-i', f]); spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inp, '-filter_complex', files.map((_, i) => `[${i}:v]`).join('') + `concat=n=${files.length}:v=1:a=0,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', out], { stdio: 'inherit' }); console.log(out); };
async function main() {
  await mkdir(outDir, { recursive: true }); const server = await serve(), port = server.address().port;
  const panel = opt('panel', null), stills = panel ? opt('t', '4') : opt('stills', null);
  if (stills) {
    const b = await browser(port, `h=${H}` + (panel ? `&panel=${panel}` : ''));
    const dir = path.join(outDir, 'stills-' + (opt('sheet', null) || panel || 'film')); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
    const files = [], scale = +opt('scale', 0.5); let n = 0; const extra = { view: opt('view', 'shot'), cam: opt('cam', null) && JSON.parse(opt('cam', 'null')), scale };
    for (const s of String(stills).split(',')) { const url = await b.ev(`window.FILM.still(${+s}, ${JSON.stringify(extra)})`); const f = path.join(dir, `${String(n++).padStart(3, '0')}_t${(+s).toFixed(2)}.png`); await writeFile(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f); }
    await b.close(); if (opt('sheet', null) && files.length > 1) sheetOf(files, opt('sheet'), +opt('cols', 2)); else files.forEach(f => console.log(f)); server.close(); return;
  }
  const b0 = await browser(port, `h=${H}&lite=1`); const info = await b0.ev('window.FILM.info()'); await b0.close(); console.log(info);
  const FPS = info.fps, a = Math.round(+opt('from', 0) * FPS), z = Math.round(+opt('to', info.duration) * FPS), part = opt('from', null) !== null, per = Math.ceil((z - a) / JOBS); const tmp = path.join(projectDir, 'tmp', 'seg-' + Date.now()); await mkdir(tmp, { recursive: true });
  const t0 = Date.now(); let done = 0; const segs = [];
  await Promise.all(Array.from({ length: JOBS }, async (_, j) => {
    const i0 = a + j * per, i1 = Math.min(z, i0 + per); if (i0 >= i1) return; const f = path.join(tmp, `s${j}.mp4`); segs[j] = f;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', f], { stdio: ['pipe', 'inherit', 'inherit'] });
    sinks.set('/frame/' + j, async buf => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); done++; if (done % 24 === 0) process.stdout.write(`\r${done}/${z - a}  ${(done / ((Date.now() - t0) / 1000)).toFixed(2)} fps  eta ${(((z - a - done) / (done / ((Date.now() - t0) / 1000))) / 60).toFixed(1)} min   `); });
    const b = await browser(port, `h=${H}`); for (let i = i0; i < i1; i += 24) await b.ev(`window.FILM.push(${i},${Math.min(i1, i + 24)},'/frame/${j}')`); await b.close(); ff.stdin.end(); await new Promise(r => ff.on('exit', r));
  }));
  const list = path.join(tmp, 'l.txt'); await writeFile(list, segs.filter(Boolean).map(f => `file '${f}'`).join('\n')); const wav = path.join(outDir, 'soundtrack.wav'), hasA = existsSync(wav) && !opt('no-audio', false); const out = path.join(outDir, part ? 'preview.mp4' : `${NAME}${H === 1080 ? '' : '-' + H + 'p'}.mp4`);
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, ...(hasA ? ['-ss', String(a / FPS), '-i', wav, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String((z - a) / FPS)] : []), '-c:v', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
  await rm(tmp, { recursive: true, force: true }); console.log('\nwrote', out, ((Date.now() - t0) / 60000).toFixed(1) + ' min'); server.close();
}
main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
