import { buildPoster } from "./scene.js";
import { render, END } from "./anim.js";

await document.fonts.load('24px "Courier Prime"');
await document.fonts.load('italic 24px "Courier Prime"');
await document.fonts.load('bold 24px "Courier Prime"');
const stage = document.getElementById("stage");
stage.innerHTML = buildPoster();
const svg = stage.querySelector("svg");
const again = document.getElementById("again");

// ?t=12.5 freezes on one moment, ?static shows the finished poster; otherwise it plays once.
const params = new URLSearchParams(location.search);
const frozen = params.has("static") ? END : params.has("t") ? +params.get("t") : null;

let start = 0;
function frame(now) {
  const t = Math.min(END, (now - start) / 1000);
  render(svg, t);
  again.hidden = t < END;
  if (t < END) requestAnimationFrame(frame);
}
function play() {
  again.hidden = true;
  requestAnimationFrame((now) => { start = now; frame(now); });
}
again.addEventListener("click", play);

// The frame recorder drives time directly.
window.__seek = (t) => render(svg, t);
window.__END = END;

if (frozen != null) {
  render(svg, frozen);
  again.hidden = frozen < END;
} else play();
document.body.dataset.ready = "1";
