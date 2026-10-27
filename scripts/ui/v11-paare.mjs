import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const VIEWPORTS = [
  { geraet: "desktop", width: 1914, height: 917 },
  { geraet: "tablet", width: 1220, height: 880 },
  { geraet: "handy", width: 390, height: 844 },
];
const INTAKE_STATES = ["frisch", "neukunde", "kunde-mit-luecke"];

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const appUrl = option("app-url", process.env.KREILE_PREVIEW_URL)?.replace(/\/$/, "");
const screen = option("screen", "completed");
const pin = process.env.KREILE_PREVIEW_PIN;
const oidc = process.env.VERCEL_OIDC_TOKEN;
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const output = resolve("output/v11-paare");
const prototypePath = resolve("docs/project/linie/ui/designsystem_v1_1/kundenansicht/index.html");

if (!appUrl) throw new Error("APP_URL_MISSING: --app-url oder KREILE_PREVIEW_URL setzen");
if (!/^\d{4}$/.test(pin ?? "")) throw new Error("PREVIEW_PIN_MISSING: KREILE_PREVIEW_PIN nur für diesen Lauf setzen");
if (!["shell-plus", "neuer-eingang", "der-tag", "auftragskarte", "werkstatt", "completed"].includes(screen)) throw new Error(`SCREEN_NOT_IMPLEMENTED: ${screen}`);
delete process.env.KREILE_PREVIEW_PIN;

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const headers = {
  ...(oidc ? { "x-vercel-trusted-oidc-idp-token": oidc } : {}),
  ...(protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}),
};

async function loginStorage() {
  const context = await browser.newContext({ viewport: { width: 1914, height: 917 }, extraHTTPHeaders: headers });
  const page = await context.newPage();
  await page.goto(`${appUrl}/start`, { waitUntil: "networkidle", timeout: 30_000 });
  const rolf = page.getByRole("button", { name: /Rolf.*Meister/ });
  await rolf.waitFor();
  await rolf.click();
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
const skipped = [];

function contextOptions(viewport, authenticated = false) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.geraet !== "desktop",
    ...(authenticated ? { extraHTTPHeaders: headers, storageState } : {}),
  };
}

function prototypeUrl(viewport, targetScreen) {
  const url = new URL(pathToFileURL(prototypePath));
  url.searchParams.set("pruef", "1");
  url.searchParams.set("person", "rolf");
  url.searchParams.set("geraet", viewport.geraet);
  url.searchParams.set("screen", targetScreen);
  return url.href;
}

async function savePair({ viewport, name, title, app, prototype }) {
  const suffix = `${viewport.width}x${viewport.height}`;
  const prototypeFile = `${name}-prototyp-${suffix}.png`;
  const appFile = `${name}-app-${suffix}.png`;
  await prototype.screenshot({ path: resolve(output, prototypeFile), animations: "disabled" });
  await app.screenshot({ path: resolve(output, appFile), animations: "disabled" });
  pairs.push({ screen: name, title, ...viewport, prototypeFile, appFile });
}

async function captureShell(viewport) {
  const appContext = await browser.newContext(contextOptions(viewport, true));
  const prototypeContext = await browser.newContext(contextOptions(viewport));
  try {
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();
    await app.goto(`${appUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
    await app.locator(`.kr-app[data-geraet="${viewport.geraet}"]`).waitFor();
    await app.getByRole("button", { name: "Neu anlegen", exact: true }).click();
    await app.getByRole("menu").waitFor();
    await prototype.goto(prototypeUrl(viewport, "tag"), { waitUntil: "load" });
    await prototype.locator(".kr-plus").click();
    await prototype.locator(".kr-plus-menue").waitFor();
    await savePair({ viewport, name: "shell-plus", title: "Shell + Plus", app, prototype });
  } finally {
    await appContext.close();
    await prototypeContext.close();
  }
}

async function captureDay(viewport) {
  const appContext = await browser.newContext(contextOptions(viewport, true));
  const prototypeContext = await browser.newContext(contextOptions(viewport));
  try {
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();
    await app.goto(`${appUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
    await app.locator(`.kr-app[data-geraet="${viewport.geraet}"]`).waitFor();
    await app.getByRole("heading", { name: "Der Tag", exact: true }).waitFor();
    await prototype.goto(prototypeUrl(viewport, "tag"), { waitUntil: "load" });
    await prototype.getByRole("heading", { name: "Der Tag", exact: true }).waitFor();
    await savePair({ viewport, name: "der-tag", title: "Der Tag", app, prototype });
  } finally {
    await appContext.close();
    await prototypeContext.close();
  }
}

async function captureOrderCard(viewport) {
  const appContext = await browser.newContext(contextOptions(viewport, true));
  const prototypeContext = await browser.newContext(contextOptions(viewport));
  try {
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();
    const actionResponses = [];
    app.on("response", async (response) => {
      if (response.request().method() !== "POST") return;
      actionResponses.push({ status: response.status(), body: (await response.text().catch(() => "")).slice(0, 400) });
    });
    await app.goto(`${appUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
    await app.locator(`.kr-app[data-geraet="${viewport.geraet}"]`).waitFor();
    await app.locator(".kr-hb-eintrag .kr-btn").first().click();
    const loadingCard = app.getByRole("dialog", { name: "Auftragskarte", exact: true });
    await loadingCard.waitFor({ timeout: 10_000 });
    try {
      await app.getByRole("dialog", { name: /Auftragskarte A-/ }).waitFor({ timeout: 30_000 });
    } catch (error) {
      const cardText = await app.locator(".kr-dialog--karte").innerText().catch(() => "Seitenblatt fehlt");
      throw new Error(`ORDER_CARD_NOT_READY: ${cardText.replace(/\s+/g, " ").slice(0, 500)} · ACTIONS ${JSON.stringify(actionResponses)}`, { cause: error });
    }
    await prototype.goto(prototypeUrl(viewport, "auftrag"), { waitUntil: "load" });
    await prototype.getByRole("dialog", { name: /Auftragskarte A-/ }).waitFor();
    await savePair({ viewport, name: "auftragskarte", title: "Auftragskarte", app, prototype });
  } finally {
    await appContext.close();
    await prototypeContext.close();
  }
}

async function captureWorkshop(viewport) {
  const appContext = await browser.newContext(contextOptions(viewport, true));
  const prototypeContext = await browser.newContext(contextOptions(viewport));
  try {
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();
    await app.goto(`${appUrl}/warendurchlauf`, { waitUntil: "networkidle", timeout: 30_000 });
    await app.locator(`.kr-app[data-geraet="${viewport.geraet}"]`).waitFor();
    await app.getByRole("heading", { name: "Werkstatt", exact: true }).waitFor();
    await prototype.goto(prototypeUrl(viewport, "werkstatt"), { waitUntil: "load" });
    await prototype.getByRole("heading", { name: "Werkstatt", exact: true }).waitFor();
    await savePair({ viewport, name: "werkstatt", title: "Werkstatt", app, prototype });
  } finally {
    await appContext.close();
    await prototypeContext.close();
  }
}

async function openAppIntake(app, state) {
  await app.goto(`${appUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
  await app.getByRole("button", { name: "Neu anlegen", exact: true }).click();
  await app.getByRole("menuitem", { name: "Auftrag / KV", exact: true }).click();
  const dialog = app.getByRole("dialog", { name: "Neuer Eingang", exact: true });
  await dialog.waitFor();
  const customer = dialog.getByRole("combobox", { name: "Kunde", exact: true });
  await customer.waitFor();
  await customer.locator("option").nth(2).waitFor({ state: "attached" });
  if (state === "neukunde") {
    await customer.selectOption({ label: "Neukunde anlegen" });
    await dialog.getByLabel("Name / Firma", { exact: true }).waitFor();
  }
  if (state === "kunde-mit-luecke") {
    const values = await customer.locator("option").evaluateAll((options) => options.map((entry) => ({ value: entry.value, disabled: entry.disabled })).filter((entry) => entry.value && entry.value !== "NEW" && !entry.disabled));
    let found = false;
    for (const entry of values) {
      await customer.selectOption(entry.value);
      if (await dialog.getByLabel("E-Mail", { exact: true }).count()) { found = true; break; }
    }
    if (!found) throw new Error("NO_REAL_CUSTOMER_WITH_MISSING_EMAIL: keine Datenänderung ausgeführt");
  }
}

async function openPrototypeIntake(prototype, viewport, state) {
  await prototype.goto(prototypeUrl(viewport, "eingang"), { waitUntil: "load" });
  const dialog = prototype.locator(".kr-dialog");
  await dialog.waitFor();
  const customer = dialog.locator('select[data-in="eingang.kid"]');
  if (state === "neukunde") {
    await customer.selectOption("neu");
    await customer.dispatchEvent("change");
  }
  if (state === "kunde-mit-luecke") {
    await customer.selectOption("neu");
    await customer.dispatchEvent("change");
    await prototype.evaluate(() => {
      const select = document.querySelector('select[data-in="eingang.kid"]');
      if (!select) return;
      const selected = select.options[select.selectedIndex];
      selected.textContent = "Kunde mit Lücke · K-2026-0011";
      const labels = [...document.querySelectorAll(".kr-abschnitt[data-abschnitt='0'] .kr-feld")];
      for (const label of labels) {
        const text = label.querySelector(".kr-feld-label")?.textContent;
        if (["Name / Firma", "Straße", "PLZ", "Ort", "Telefon"].includes(text ?? "")) label.setAttribute("hidden", "");
      }
    });
  }
}

async function captureIntake(viewport, state) {
  const appContext = await browser.newContext(contextOptions(viewport, true));
  const prototypeContext = await browser.newContext(contextOptions(viewport));
  try {
    const app = await appContext.newPage();
    const prototype = await prototypeContext.newPage();
    try {
      await openAppIntake(app, state);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("NO_REAL_CUSTOMER_WITH_MISSING_EMAIL")) {
        skipped.push({ screen: `neuer-eingang-${state}`, geraet: viewport.geraet, reason: error.message });
        return;
      }
      throw error;
    }
    await openPrototypeIntake(prototype, viewport, state);
    await savePair({ viewport, name: `neuer-eingang-${state}`, title: `Neuer Eingang · ${state}`, app, prototype });
  } finally {
    await appContext.close();
    await prototypeContext.close();
  }
}

try {
  for (const viewport of VIEWPORTS) {
    if (screen === "shell-plus" || screen === "completed") await captureShell(viewport);
    if (screen === "der-tag" || screen === "completed") await captureDay(viewport);
    if (screen === "auftragskarte" || screen === "completed") await captureOrderCard(viewport);
    if (screen === "werkstatt" || screen === "completed") await captureWorkshop(viewport);
    if (screen === "neuer-eingang" || screen === "completed") {
      for (const state of INTAKE_STATES) await captureIntake(viewport, state);
    }
  }

  const cards = pairs.map((pair) => `
    <section>
      <h2>${pair.title} · ${pair.geraet} · ${pair.width}×${pair.height}</h2>
      <div class="pair">
        <figure><figcaption>V1.1-Prototyp</figcaption><img src="${pair.prototypeFile}" alt="V1.1-Prototyp ${pair.title} ${pair.geraet}"></figure>
        <figure><figcaption>App</figcaption><img src="${pair.appFile}" alt="App ${pair.title} ${pair.geraet}"></figure>
      </div>
    </section>`).join("\n");
  const gaps = skipped.length ? `<section><h2>Offene Nachweise</h2><ul>${skipped.map((entry) => `<li>${entry.screen} · ${entry.geraet}: ${entry.reason}</li>`).join("")}</ul></section>` : "";
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>V1.1 Bildpaare</title><style>
    :root{font-family:Inter,system-ui,sans-serif;color:#12161f;background:#f4f2ee}body{margin:0;padding:24px}h1{margin:0 0 8px}p{margin:0 0 24px;color:#596176}section{margin:0 0 28px;padding:18px;background:#fff;border:1px solid #e4e0d8;border-radius:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}figcaption{margin:0 0 8px;font-weight:700}img{display:block;width:100%;height:auto;border:1px solid #d5d0c7}@media(max-width:900px){.pair{grid-template-columns:1fr}}
  </style></head><body><h1>Oberfläche V1.1 · Bildpaare</h1><p>Links Prototyp, rechts App · gleicher Zustand · erzeugt ${new Date().toISOString()}</p>${gaps}${cards}</body></html>`;
  await writeFile(resolve(output, "index.html"), html, "utf8");
  await writeFile(resolve(output, "result.json"), JSON.stringify({ appUrl, screen, pairs, skipped }, null, 2), "utf8");
  process.stdout.write(JSON.stringify({ output: "output/v11-paare/index.html", pairs: pairs.length, skipped: skipped.length }));
} finally {
  await browser.close();
}
