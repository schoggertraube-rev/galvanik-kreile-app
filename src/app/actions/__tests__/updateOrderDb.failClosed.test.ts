import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbSpies = {
  update: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
};
const revalidatePathSpy = vi.fn();
const offlineQueue = [
  { id: "status-1", actionType: "ORDER_STATUS_UPDATE", payload: { id: "order-1", changes: { status: "completed" } }, timestamp: "2026-08-10T10:00:00.000Z", expiresAt: "2099-08-12T10:00:00.000Z" },
  { id: "material-1", actionType: "MATERIAL_BOOKING", payload: { inventoryItemId: "inventory-1", quantity: 1 }, timestamp: "2026-08-10T10:01:00.000Z", expiresAt: "2099-08-12T10:01:00.000Z" },
  { id: "time-1", actionType: "TIME_BOOKING", payload: { orderId: "order-1", eventType: "COSTS_BOOKED" }, timestamp: "2026-08-10T10:02:00.000Z", expiresAt: "2099-08-12T10:02:00.000Z" },
];
const offlineSpies = {
  removeFromQueue: vi.fn(),
  updateOrder: vi.fn(),
  createMovement: vi.fn(),
  addEvent: vi.fn(),
};

vi.mock("@/db", () => ({ db: dbSpies }));
vi.mock("@/db/schema", () => ({ orders: {}, items: {}, customers: {}, events: {} }));
vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuth: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
  revalidatePath: revalidatePathSpy,
}));
vi.mock("@/lib/offline/IndexedDBHelper", () => ({
  IndexedDBHelper: {
    getQueue: vi.fn(async () => offlineQueue),
    removeFromQueue: offlineSpies.removeFromQueue,
  },
}));
vi.mock("@/lib/repositories/ordersRepository", () => ({
  ordersRepository: { updateOrder: offlineSpies.updateOrder, create: vi.fn() },
}));
vi.mock("@/lib/repositories/inventoryRepository", () => ({
  inventoryRepository: { createMovement: offlineSpies.createMovement },
}));
vi.mock("@/lib/repositories/eventsRepository", () => ({
  eventsRepository: { addEvent: offlineSpies.addEvent },
}));

describe("updateOrderDb fail-closed (F0-W2C-B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("denies before any order, item, feedback, event, or revalidation side effect", async () => {
    const { updateOrderDb } = await import("../orders.actions");

    await expect(updateOrderDb("order-1", { status: "completed", currentStationId: "galvanik" })).resolves.toMatchObject({
      ok: false,
      error: "CONFLICT",
      message: expect.stringContaining("NOT_AVAILABLE"),
    });

    expect(dbSpies.update).not.toHaveBeenCalled();
    expect(dbSpies.select).not.toHaveBeenCalled();
    expect(dbSpies.insert).not.toHaveBeenCalled();
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });
});

describe("W2C-B1 caller containment", () => {
  const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const callerFiles = [
    "components/orders/StationStatusButton.tsx",
    "components/orders/StationCompletionModal.tsx",
    "components/orders/OrderActionGrid.tsx",
    "components/orders/OrderMaterialTimeDrawer.tsx",
    "app/warendurchlauf/galvanik/page.tsx",
    "app/status/page.tsx",
    "app/warendurchlauf/wareneingang/page.tsx",
    "lib/offline/OfflineManager.ts",
  ];

  it("removes the legacy writer from every named caller", async () => {
    const sources = await Promise.all(callerFiles.map((file) => readFile(path.join(srcRoot, file), "utf8")));
    for (const source of sources) {
      expect(source).not.toContain("updateOrderDb");
    }
  });

  it("leaves non-atomic flows visibly blocked and removes the simple start from the process port", async () => {
    const stationButton = await readFile(path.join(srcRoot, "components/orders/StationStatusButton.tsx"), "utf8");
    const blockedFiles = await Promise.all([
      "components/orders/variants/WareneingangActive.tsx",
      "components/orders/StationCompletionModal.tsx",
      "components/orders/OrderActionGrid.tsx",
      "components/orders/OrderMaterialTimeDrawer.tsx",
      "app/warendurchlauf/galvanik/page.tsx",
      "app/status/page.tsx",
      "app/warendurchlauf/wareneingang/page.tsx",
      "lib/offline/OfflineManager.ts",
    ].map((file) => readFile(path.join(srcRoot, file), "utf8")));

    expect(stationButton).not.toContain("transitionOrderProcess");
    expect(stationButton).not.toContain('action: "start"');
    for (const source of blockedFiles) {
      expect(source).toMatch(/NOT_AVAILABLE|disabled/);
    }
  });

  it("does not directly combine repository events with createStatusEvent in a caller", async () => {
    const sources = await Promise.all(callerFiles.map((file) => readFile(path.join(srcRoot, file), "utf8")));
    for (const source of sources) {
      expect(source.includes("eventsRepository.addEvent") && source.includes("createStatusEvent")).toBe(false);
    }
  });

  it("keeps the Wareneingang edit flow unavailable before an interactive modal can open", async () => {
    const wareneingang = await readFile(path.join(srcRoot, "app/warendurchlauf/wareneingang/page.tsx"), "utf8");

    expect(wareneingang).toContain("NOT_AVAILABLE: Auftragsbearbeitung");
    expect(wareneingang).not.toContain("OrderEditModal");
    expect(wareneingang).not.toContain("selectedOrderForEdit");
  });
});

describe("OfflineManager legacy mutation containment (F0-W2C-B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("keeps all three legacy mutations pending with no repository side effects or false sync count", async () => {
    const successEvents: CustomEvent[] = [];
    const listener = (event: Event) => successEvents.push(event as CustomEvent);
    window.addEventListener("kreile-sync-success", listener);

    const { OfflineManager } = await import("@/lib/offline/OfflineManager");
    await OfflineManager.syncQueue();

    window.removeEventListener("kreile-sync-success", listener);
    expect(offlineSpies.updateOrder).not.toHaveBeenCalled();
    expect(offlineSpies.createMovement).not.toHaveBeenCalled();
    expect(offlineSpies.addEvent).not.toHaveBeenCalled();
    expect(offlineSpies.removeFromQueue).not.toHaveBeenCalled();
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0].detail).toEqual({ count: 0, blockedCount: 3 });
  });
});
