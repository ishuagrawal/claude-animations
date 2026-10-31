// Serves the project and saves a PNG of the poster: node tools/still.mjs [out.png] [width] [height]
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright comes preinstalled with the environment rather than from package.json.
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [out = join(root, "stills/poster.png"), w = "1600", h = "1240"] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : req.url.split("?")[0]));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error(e));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForSelector("body[data-ready]");
const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status !== "loaded").map((f) => `${f.family} ${f.style} ${f.weight}`));
if (fonts.length) console.warn("fonts not loaded:", fonts.join(", "));
await page.waitForTimeout(300);
await mkdir(dirname(out), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
server.close();
console.log(out);
