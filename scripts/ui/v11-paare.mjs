import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VIEWPORTS = [
  { geraet: "desktop", width: 1914, height: 917 },
  { geraet: "tablet", width: 1220, height: 880 },
  { geraet: "handy", width: 390, height: 844 },
];

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const appUrl = option("app-url", process.env.KREILE_PREVIEW_URL)?.replace(/\/$/, "");
const screen = option("screen", "shell-plus");
const pin = process.env.KREILE_PREVIEW_PIN;
const oidc = process.env.VERCEL_OIDC_TOKEN;
const output = resolve("output/v11-paare");
const prototypePath = resolve("docs/project/linie/ui/designsystem_v1_1/kundenansicht/index.html");

if (!appUrl) throw new Error("APP_URL_MISSING: --app-url oder KREILE_PREVIEW_URL setzen");
if (!/^\d{4}$/.test(pin ?? "")) throw new Error("PREVIEW_PIN_MISSING: KREILE_PREVIEW_PIN nur für diesen Lauf setzen");
if (screen !== "shell-plus") throw new Error(`SCREEN_NOT_IMPLEMENTED: ${screen}`);
delete process.env.KREILE_PREVIEW_PIN;

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const headers = oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } : undefined;

async function loginStorage() {
  const context = await browser.newContext({ viewport: { width: 1914, height: 917 }, extraHTTPHeaders: headers });
  const page = await context.newPage();
  await page.goto(`${appUrl}/start`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("button", { name: /Rolf.*Meister/ }).click();
  const dialog = page.getByRole("dialog", { name: /Persönlichen Code eingeben/ });
  await dialog.waitFor();
  for (const digit of pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  await page.waitForURL(`${appUrl}/`, { timeout: 30_000 });
  const storage = await context.storageState();
  await context.close();
  return storage;
}

const storageState = await loginStorage();
const pairs = [];

try {
  for (const viewport of VIEWPORTS) {
    const contextOptions = {
      viewport: { width: viewport.width, height: viewport.height },
      extraHTTPHeaders: headers,
      storageState,
      hasTouch: viewport.geraet !== "desktop",
    };
    const appContext = await browser.newContext(contextOptions);
    const prototypeContext = await browser.newContext({
      viewport: contextOptions.viewport,
      hasTouch: contextOptions.hasTouch,
    });
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();

    await app.goto(`${appUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
    await app.locator(`.kr-app[data-geraet="${viewport.geraet}"]`).waitFor();
    await app.getByRole("button", { name: "Neu anlegen", exact: true }).click();
    await app.getByRole("menu").waitFor();

    const prototypeUrl = new URL(pathToFileURL(prototypePath));
    prototypeUrl.searchParams.set("pruef", "1");
    prototypeUrl.searchParams.set("person", "rolf");
    prototypeUrl.searchParams.set("geraet", viewport.geraet);
    prototypeUrl.searchParams.set("screen", "tag");
    await prototype.goto(prototypeUrl.href, { waitUntil: "load" });
    await prototype.locator(".kr-plus").click();
    await prototype.locator(".kr-plus-menue").waitFor();

    const suffix = `${viewport.width}x${viewport.height}`;
    const prototypeFile = `shell-plus-prototyp-${suffix}.png`;
    const appFile = `shell-plus-app-${suffix}.png`;
    await prototype.screenshot({ path: resolve(output, prototypeFile), animations: "disabled" });
    await app.screenshot({ path: resolve(output, appFile), animations: "disabled" });
    pairs.push({ ...viewport, prototypeFile, appFile });

    await appContext.close();
    await prototypeContext.close();
  }

  const cards = pairs.map((pair) => `
    <section>
      <h2>${pair.geraet} · ${pair.width}×${pair.height}</h2>
      <div class="pair">
        <figure><figcaption>V1.1-Prototyp</figcaption><img src="${pair.prototypeFile}" alt="V1.1-Prototyp ${pair.geraet}"></figure>
        <figure><figcaption>App</figcaption><img src="${pair.appFile}" alt="App ${pair.geraet}"></figure>
      </div>
    </section>`).join("\n");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>V1.1 Bildpaare</title><style>
    :root{font-family:Inter,system-ui,sans-serif;color:#12161f;background:#f4f2ee}body{margin:0;padding:24px}h1{margin:0 0 8px}p{margin:0 0 24px;color:#596176}section{margin:0 0 28px;padding:18px;background:#fff;border:1px solid #e4e0d8;border-radius:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}figcaption{margin:0 0 8px;font-weight:700}img{display:block;width:100%;height:auto;border:1px solid #d5d0c7}@media(max-width:900px){.pair{grid-template-columns:1fr}}
  </style></head><body><h1>Oberfläche V1.1 · Shell + Plus</h1><p>Links Prototyp, rechts App · gleicher Zustand · erzeugt ${new Date().toISOString()}</p>${cards}</body></html>`;
  await writeFile(resolve(output, "index.html"), html, "utf8");
  await writeFile(resolve(output, "result.json"), JSON.stringify({ appUrl, screen, pairs }, null, 2), "utf8");
  process.stdout.write(JSON.stringify({ output: "output/v11-paare/index.html", pairs: pairs.length }));
} finally {
  await browser.close();
}
