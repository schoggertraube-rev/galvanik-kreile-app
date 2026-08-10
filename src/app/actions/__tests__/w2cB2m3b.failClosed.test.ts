import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = {
  auth: vi.fn(),
  createId: vi.fn(),
  createClient: vi.fn(),
  createAuthorizedDataClient: vi.fn(),
  createAuthorizedDataContext: vi.fn(),
  removeFromQueue: vi.fn(),
};

vi.mock("@/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: ports.auth }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: ports.createId }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: ports.createClient,
  createAuthorizedDataClient: ports.createAuthorizedDataClient,
  createAuthorizedDataContext: ports.createAuthorizedDataContext,
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: ports.createClient }));
vi.mock("@/lib/offline/IndexedDBHelper", () => ({
  IndexedDBHelper: {
    getQueue: vi.fn(async () => [{
      id: "kvp-1",
      actionType: "APP_KVP_CREATE",
      payload: { title: "Idee" },
      timestamp: "2026-08-10T10:00:00.000Z",
      expiresAt: "2099-08-12T10:00:00.000Z",
    }]),
    removeFromQueue: ports.removeFromQueue,
  },
}));
vi.mock("@/lib/repositories/ordersRepository", () => ({
  ordersRepository: { create: vi.fn() },
}));

const denial = "NOT_AVAILABLE: Sicherer Server-Command-Vertrag fehlt.";
const w3Denial = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("W2C B2M3B fail-closed commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("denies item, price, repository, system, and warning writers before every port", async () => {
    const [items, prices, stats, cockpit, { itemsRepository }, { kvpRepository }] = await Promise.all([
      import("../items.actions"),
      import("../price-lines.actions"),
      import("../systemStats"),
      import("@/app/cockpit/actions"),
      import("@/lib/repositories/itemsRepository"),
      import("@/lib/repositories/kvpRepository"),
    ]);

    const conflict = { ok: false, error: "CONFLICT", message: denial };
    await expect(items.createItemDb({ orderId: "o", name: "x" })).resolves.toEqual(conflict);
    await expect(items.updateItemDb("i", { name: "x" })).resolves.toEqual(conflict);
    await expect(items.deleteItemDb("i")).resolves.toEqual(conflict);
    await expect(prices.createPriceLineDb({ order_id: "o", position_text: "x", unit_price_eur: 1 })).resolves.toEqual(conflict);
    await expect(prices.updatePriceLineDb("p", { position_text: "x" })).resolves.toEqual(conflict);
    await expect(prices.deletePriceLineDb("p")).resolves.toEqual(conflict);
    await expect(itemsRepository.create({ orderId: "o", name: "x", quantity: 1 })).rejects.toThrow(denial);
    await expect(itemsRepository.update("i", {})).rejects.toThrow(denial);
    await expect(itemsRepository.createMany([])).rejects.toThrow(denial);
    await expect(kvpRepository.addItem({ title: "x", category: "x", benefit: "x", status: "neu", problemDesc: "", hasPhoto: false, date: "" })).rejects.toThrow(denial);
    await expect(kvpRepository.updateItemStatus("k", "neu")).rejects.toThrow(denial);
    await expect(stats.runSupabaseWriteTest()).resolves.toEqual({ success: false, message: denial, durationMs: 0 });
    await expect(cockpit.dismissWarnung("w", "ausreichend lang")).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: w3Denial });
    await expect(cockpit.refreshWarnungen()).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: w3Denial });

    for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled();
  });

  it("retains APP_KVP_CREATE and reports it blocked without removal", async () => {
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener("kreile-sync-success", listener);
    const { OfflineManager } = await import("@/lib/offline/OfflineManager");
    await OfflineManager.syncQueue();
    window.removeEventListener("kreile-sync-success", listener);

    expect(ports.removeFromQueue).not.toHaveBeenCalled();
    expect(events.at(-1)?.detail).toEqual({ count: 0, blockedCount: 1 });
  });
});

describe("W2C B2M3B caller quarantine", () => {
  it("keeps read paths and removes unavailable writer calls and local KVP persistence", async () => {
    const files = await Promise.all([
      "components/orders/ItemDrawer.tsx",
      "components/orders/PriceLinesEditor.tsx",
      "components/admin/AdminDashboard.tsx",
      "app/betrieb-kvp/BetriebKvpClient.tsx",
      "app/kvp/KvpClient.tsx",
      "app/cockpit/components/FruehwarnungenKachel.tsx",
    ].map((file) => readFile(path.join(root, file), "utf8")));
    const [itemDrawer, priceEditor, admin, betriebKvp, kvp, warnings] = files;

    expect(itemDrawer).toContain("PriceLinesEditor");
    expect(priceEditor).toContain("getPriceLinesDb");
    expect(betriebKvp).toContain("kvpRepository.getAll");
    expect(warnings).toContain("getAktiveWarnungen");
    expect(warnings).toMatch(/<button\s+disabled[\s\S]*?>\s*Aktualisieren \(NOT_AVAILABLE\)\s*<\/button>/);
    expect(itemDrawer).toMatch(/<button\s+disabled[\s\S]*?>[\s\S]*?<span className="text-xs">Löschen \(NOT_AVAILABLE\)<\/span>[\s\S]*?<\/button>/);
    expect(priceEditor).toMatch(/<button disabled[^>]*><Edit2[\s\S]*?<\/button>\s*<button disabled[^>]*><Trash2[\s\S]*?<\/button>\s*<span className="text-\[10px\] -\(\)">NOT_AVAILABLE<\/span>/);
    expect(betriebKvp).toMatch(/<button disabled[^>]*>Umgesetzt<\/button>\s*<button disabled[^>]*>Prüfen<\/button>\s*<button disabled[^>]*>Ablehnen<\/button>[\s\S]*?NOT_AVAILABLE: Statusänderungen benötigen einen sicheren Server-Command-Vertrag\./);
    expect(itemDrawer).not.toMatch(/createItemDb|updateItemDb|deleteItemDb|onSaved\(\)/);
    expect(priceEditor).not.toMatch(/createPriceLineDb|updatePriceLineDb|deletePriceLineDb/);
    expect(admin).not.toContain("runSupabaseWriteTest");
    expect(betriebKvp).not.toMatch(/kvpRepository\.(addItem|updateItemStatus)/);
    expect(kvp).not.toMatch(/localStorage\.setItem|enqueueAction|Date\.now|OfflineManager/);
    expect(warnings).not.toMatch(/refreshWarnungen|dismissWarnung/);
  });
});
