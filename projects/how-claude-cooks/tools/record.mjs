// Renders the animation frame by frame into an MP4 preview:
//   node tools/record.mjs [--fps 24] [--from 0] [--to END] [--scale 0.75]
// Writes out/how-claude-cooks.mp4 with the synthesized soundtrack.
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { openPage, root } from "./page.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const fps = arg("fps", 24), scale = arg("scale", 0.75);
const { page, close } = await openPage("t=0", { width: 1600, height: 1240, scale });
const end = await page.evaluate(() => window.__END);
const from = arg("from", 0), to = Math.min(arg("to", end + 1.5), end + 1.5);

await mkdir(join(root, "out"), { recursive: true });
const out = join(root, "out", "how-claude-cooks.mp4");
const silent = join(root, "out", "video-only.mp4"), wav = join(root, "out", "audio.wav");
await page.evaluate(() => { document.getElementById("start").hidden = true; });
await writeFile(wav, Buffer.from(await page.evaluate(() => window.__audioWav()), "base64"));
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", silent], { stdio: ["pipe", "inherit", "inherit"] });

const n = Math.round((to - from) * fps);
for (let f = 0; f <= n; f++) {
  await page.evaluate((t) => window.__seek(t), from + f / fps);
  ff.stdin.write(await page.screenshot({ type: "png" }));
  if (f % fps === 0) process.stdout.write(`\r${(from + f / fps).toFixed(1)}s / ${to.toFixed(1)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
const mux = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-ss", String(from), "-i", wav,
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out], { stdio: "inherit" });
await new Promise((r) => mux.on("close", r));
await rm(silent);
await rm(wav);
await close();
console.log(`\n${out}`);
