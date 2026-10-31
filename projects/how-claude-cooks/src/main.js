import { buildPoster } from "./scene.js";

await document.fonts.load('24px "Courier Prime"');
await document.fonts.load('italic 24px "Courier Prime"');
await document.fonts.load('bold 24px "Courier Prime"');
document.getElementById("stage").innerHTML = buildPoster();
document.body.dataset.ready = "1";
