// @vitest-environment node
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => "TEST-ablauf-" + globalThis.crypto.randomUUID());
vi.mock("@/lib/tenant", () => ({ KREILE_TENANT_SLUG: tenant }));
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { full, nativeFetch, sql, withRequest } from "../../../e2e/ablauf/replayHarness";
import { customerFixture } from "../../../e2e/ablauf/orderFixture";
import { COOKIE_NAME, getSecretKey, signAppSession } from "@/lib/server/appSession";
import { offlinePartition } from "@/lib/server/offlinePartition";
import { POST } from "@/app/api/offline/replay/route";

it("L-M2 withdraws one queued mail and sends the other when its tab closes", async () => {
  const customerId = await customerFixture("TEST L-M2 Tab");
  const scope = offlinePartition({ tenantId: KREILE_TENANT_SLUG, userId: full.actorId });
  const undoKey = randomUUID();
  const sendKey = randomUUID();
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: [
      "import { retainPendingWorkshopOriginal, withdrawPendingWorkshop, readPendingEntries } from './src/lib/offline/pendingStore';",
      "import { handOffClosingMail, observeDelayedCommandExit } from './src/lib/offline/replayWorkshopHttp';",
      "window.testMailQueue = { retainPendingWorkshopOriginal, withdrawPendingWorkshop, readPendingEntries, handOffClosingMail, observeDelayedCommandExit };",
    ].join("\n") },
    bundle: true, write: false, format: "esm", platform: "browser",
  });
  const scripts = new Map([
    ['/sw.js', await readFile('public/sw.js')],
    ['/kreile-offline-queue.js', await readFile('public/kreile-offline-queue.js')],
  ]);
  const token = signAppSession({
    userId: full.actorId, tenantId: KREILE_TENANT_SLUG, role: full.role, displayName: "TEST L-M2",
    issuedAt: full.actorIssuedAt, expiresAt: Date.now() + 5 * 60_000,
  }, getSecretKey());

  let markReceipt!: (value: { status: number; body: unknown }) => void;
  const receipt = new Promise<{ status: number; body: unknown }>(resolve => { markReceipt = resolve; });
  const deliveries: string[] = [];
  let receivedPosts = 0;
  let browserExitSignals = 0;
  const graph = vi.spyOn(globalThis, "fetch").mockImplementation(async (request, init) => {
    const url = new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
    if (url.hostname === "login.microsoftonline.com") {
      return Response.json({ access_token: "TEST-LM2-tab-close".repeat(4), expires_in: 3600 });
    }
    if (url.hostname === "graph.microsoft.com" && url.pathname.endsWith("/sendMail")) {
      deliveries.push(JSON.parse(String(init?.body)).message.subject);
      return new Response(null, { status: 202 });
    }
    return nativeFetch(request, init);
  });
  const path = "/api/offline/replay";
  const server = createServer(async (req, res) => {
    const script = req.url && scripts.get(req.url);
    if (script) {
      res.writeHead(200, { "content-type": "text/javascript" }).end(script);
      return;
    }
    if (req.url === "/queue.mjs") {
      res.writeHead(200, { "content-type": "text/javascript" }).end(bundle.outputFiles[0].text);
      return;
    }
    if (req.url !== path) {
      res.writeHead(200, {
        "content-type": "text/html",
        "set-cookie": `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`,
      }).end("<!doctype html><title>TEST L-M2 Tab</title>");
      return;
    }
    try {
      receivedPosts++;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = Object.fromEntries(Object.entries(req.headers)
        .flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
      const request = new Request(`http://${req.headers.host}${path}`, {
        method: "POST", headers, body: Buffer.concat(chunks),
      });
      const response = await withRequest(headers.cookie ?? "", () => POST(request), false, headers);
      const text = await response.text();
      markReceipt({ status: response.status, body: JSON.parse(text) });
      res.writeHead(response.status, { "content-type": "application/json" }).end(text);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      markReceipt({ status: 500, body: { reason } });
      res.writeHead(500).end();
    }
  });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw Error("TEST_LOOPBACK");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.newPage();
    const tab = await context.newPage();
    tab.on('console', message => { if (message.text() === 'TEST mail queue exit') browserExitSignals++; });
    await tab.goto(`http://127.0.0.1:${address.port}/TEST`);
    await tab.bringToFront();
    await tab.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await tab.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await tab.addScriptTag({ type: 'module', url: '/queue.mjs' });
    await tab.waitForFunction(() => Reflect.has(window, 'testMailQueue'));
    const insertedAt = await tab.evaluate(async ({ scope, customerId, sendKey, undoKey }) => {
      const pending = Reflect.get(window, 'testMailQueue');
      const capture = (key: string, subject: string) => {
        const now = Date.now();
        return {
          id: key, itemId: customerId, kind: "workshop", command: "mail.send",
          deviceCapturedAt: new Date(now).toISOString(), notBefore: new Date(now + 10_000).toISOString(),
          input: { clientEventId: key, targetType: "CUSTOMER", targetId: customerId, subject, body: "TEST Original" },
        };
      };
      pending.observeDelayedCommandExit(() => {
        console.info('TEST mail queue exit');
        pending.handOffClosingMail(scope, [undoKey, sendKey]);
      });
      await pending.retainPendingWorkshopOriginal(scope, capture(undoKey, "TEST Widerruf"));
      if (!await pending.withdrawPendingWorkshop(scope, undoKey)) throw Error("TEST_UNDO_FAILED");
      await pending.retainPendingWorkshopOriginal(scope, capture(sendKey, "TEST Tab geschlossen"));
      return Date.now();
    }, { scope, customerId, sendKey, undoKey });

    await tab.waitForTimeout(Math.max(0, insertedAt + 3000 - Date.now()));
    expect(deliveries).toEqual([]);
    const closed = tab.waitForEvent("close", { timeout: 5000 });
    await tab.close({ runBeforeUnload: true });
    await closed;
    const seen = await Promise.race([
      receipt,
      new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 5000); }),
    ]);
    if (!seen) throw Error(`TEST_TAB_NO_RECEIPT: exits=${browserExitSignals}, posts=${receivedPosts}, provider=${deliveries.length}`);
    expect(seen, JSON.stringify(seen)).toMatchObject({ status: 200, body: {
      code: "OK", mailReceipt: { clientRequestId: sendKey, actorId: full.actorId },
    } });
    expect(deliveries).toEqual(["TEST Tab geschlossen"]);
    expect(await sql`SELECT correlation_id::text AS key FROM public.events
      WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1'
        AND correlation_id IN (${sendKey}::uuid,${undoKey}::uuid)`).toEqual([{ key: sendKey }]);
    const reopened = await context.newPage();
    await reopened.goto(`http://127.0.0.1:${address.port}/TEST`);
    await reopened.addScriptTag({ type: 'module', url: '/queue.mjs' });
    await reopened.waitForFunction(async partition => {
      const pending = Reflect.get(window, 'testMailQueue');
      return pending && (await pending.readPendingEntries(partition)).length === 0;
    }, scope, { timeout: 5000 });
  } finally {
    if (deadline) clearTimeout(deadline);
    await browser?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    graph.mockRestore();
  }
}, 60_000);
