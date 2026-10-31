// Saves PNG stills: node tools/still.mjs [t ...]   (no times = the finished poster)
// Writes stills/poster.png, or stills/t-<time>.png for each time given.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openPage, root } from "./page.mjs";

const times = process.argv.slice(2);
await mkdir(join(root, "stills"), { recursive: true });
const { page, close } = await openPage("static");
for (const t of times.length ? times : [null]) {
  if (t != null) await page.evaluate((t) => { window.__seek(t); document.getElementById("again").hidden = true; document.getElementById("start").hidden = true; }, +t);
  await page.waitForTimeout(100);
  const out = join(root, "stills", t == null ? "poster.png" : `t-${t}.png`);
  await page.screenshot({ path: out });
  console.log(out);
}
await close();
