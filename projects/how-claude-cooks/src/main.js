import { buildPoster } from "./scene.js";
import { render, END, CUES } from "./anim.js";
import { scheduleAudio, renderWav } from "./audio.js";

await document.fonts.load('24px "Courier Prime"');
await document.fonts.load('italic 24px "Courier Prime"');
await document.fonts.load('bold 24px "Courier Prime"');
const stage = document.getElementById("stage");
stage.innerHTML = buildPoster();
const svg = stage.querySelector("svg");
const again = document.getElementById("again");
const start = document.getElementById("start");

// ?t=12.5 freezes on one moment, ?static shows the finished poster; otherwise it waits for a
// click (browsers only allow sound after one) and plays once.
const params = new URLSearchParams(location.search);
const frozen = params.has("static") ? END : params.has("t") ? +params.get("t") : null;

let ctx = null, zero = 0, clock = null, soundOn = true;
function frame() {
  const t = Math.min(END, clock());
  render(svg, t);
  again.hidden = t < END;
  if (t < END) requestAnimationFrame(frame);
}
async function play(withSound) {
  start.hidden = again.hidden = true;
  soundOn = withSound;
  if (ctx) { ctx.close(); ctx = null; }
  if (withSound) {
    ctx = new AudioContext();
    await ctx.resume();
    zero = ctx.currentTime + 0.1;
    scheduleAudio(ctx, ctx.destination, CUES, { zero, end: END + 1 });
    clock = () => ctx.currentTime - zero;
  } else {
    const t0 = performance.now();
    clock = () => (performance.now() - t0) / 1000;
  }
  requestAnimationFrame(frame);
}
start.querySelector(".sound").addEventListener("click", () => play(true));
start.querySelector(".silent").addEventListener("click", () => play(false));
again.addEventListener("click", () => play(soundOn));

// The recorder drives time directly and asks for the soundtrack.
window.__seek = (t) => render(svg, t);
window.__END = END;
window.__audioWav = () => renderWav(CUES, END + 1.5);

render(svg, frozen ?? 0);
if (frozen != null) again.hidden = frozen < END;
else start.hidden = false;
document.body.dataset.ready = "1";
