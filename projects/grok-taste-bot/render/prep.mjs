// Extracts the source ranges in src/clips.js to JPEG frame sequences in cache/frames/<id>/ and writes
// cache/manifest.json ({ id: { w, h, scale, count } }) for the page.
//
//   node render/prep.mjs --sources ~/Desktop/sources --ref ~/Desktop/M9VKUr0ZYmdggYB6.mp4
// (or set SOURCES / REF). Re-run after changing a clip's range.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIPS, FPS, MAX_H } from '../src/clips.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const expand = p => p.replace(/^~(?=$|\/)/, homedir());
const sources = expand(opt('sources', process.env.SOURCES || '~/Desktop/sources'));
const ref = expand(opt('ref', process.env.REF || '~/Desktop/M9VKUr0ZYmdggYB6.mp4'));
const only = opt('only', null);

const outRoot = path.join(projectDir, 'cache', 'frames');
const manifestPath = path.join(projectDir, 'cache', 'manifest.json');
const manifest = {};

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = r.stdout.trim().split(',').map(Number);
  return { w, h };
}

for (const [id, c] of Object.entries(CLIPS)) {
  const file = c.file ? path.join(sources, c.file) : ref;
  if (!existsSync(file)) throw new Error('missing source: ' + file);
  const { w, h } = probe(file);
  const scale = Math.min(1, MAX_H / h);
  const dir = path.join(outRoot, id);
  if (!only || only.split(',').includes(id)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const isStill = /\.(jpe?g|png|webp)$/i.test(file);
    const vf = `fps=${FPS},scale=${Math.round(w * scale / 2) * 2}:${Math.round(h * scale / 2) * 2}:flags=lanczos`;
    const a = isStill
      ? ['-y', '-v', 'error', '-i', file, '-vf', vf.replace(`fps=${FPS},`, ''), '-q:v', '2', path.join(dir, '0001.jpg')]
      : ['-y', '-v', 'error', '-ss', String(c.from), '-t', String(c.to - c.from), '-i', file, '-vf', vf, '-q:v', '2', path.join(dir, '%04d.jpg')];
    const r = spawnSync('ffmpeg', a, { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg failed for ' + id);
  }
  const count = readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
  manifest[id] = { w, h, scale, count };
  console.log(id.padEnd(16), `${w}x${h}`, 'scale', scale.toFixed(3), count, 'frames');
}
// the reference's own sound effects (pops, whoosh, word clicks, end card), for src/audio.js
const refAudio = path.join(projectDir, 'cache', 'ref_audio.wav');
if (!only || only.split(',').includes('ref')) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', ref, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', refAudio], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed extracting reference audio');
}
mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
