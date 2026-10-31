// Serves the project on a free port and opens it in headless Chromium.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright comes preinstalled with the environment rather than from package.json.
const { chromium } = createRequire(import.meta.url)("playwright");

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };

export async function openPage(query, { width = 1600, height = 1240, scale = 1 } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = req.url.split("?")[0];
    const p = normalize(join(root, url === "/" ? "index.html" : decodeURIComponent(url)));
    try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  page.on("pageerror", (e) => console.error(e));
  page.on("console", (m) => m.type() === "warning" && console.warn(m.text()));
  await page.goto(`http://localhost:${server.address().port}/?${query}`);
  await page.waitForSelector("body[data-ready]");
  const missing = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "error").map((f) => f.family));
  if (missing.length) console.warn("fonts failed:", missing.join(", "));
  return { page, close: async () => { await browser.close(); server.close(); } };
}
