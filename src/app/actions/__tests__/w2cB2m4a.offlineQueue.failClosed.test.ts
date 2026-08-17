import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineAction } from "@/lib/offline/IndexedDBHelper";

const actionTypes: OfflineAction["actionType"][] = ["ORDER_CREATE", "ORDER_STATUS_UPDATE", "MATERIAL_BOOKING", "TIME_BOOKING", "CUSTOMER_CREATE", "CUSTOMER_UPDATE", "INQUIRY_CREATE", "INQUIRY_UPDATE_STATUS", "INQUIRY_UPDATE_PRICING", "ITEM_CREATE", "ITEM_UPDATE", "COMPLAINT_CREATE", "COMPLAINT_UPDATE", "APP_KVP_CREATE", "BUSINESS_KVP_CREATE"];
const queue = [...actionTypes.map((actionType, index) => ({ id: `queued-${index}`, actionType, payload: { index }, timestamp: "2026-08-10T10:00:00.000Z", expiresAt: index === 0 ? "2020-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z" })), { id: "legacy-unknown", actionType: "LEGACY_UNKNOWN", payload: {}, timestamp: "2026-08-10T10:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" }] as unknown as OfflineAction[];
const ports = { getQueue: vi.fn(async () => queue), removeFromQueue: vi.fn(), orderCreate: vi.fn(), customerCreate: vi.fn(), customerUpdate: vi.fn(), inquiryCreate: vi.fn(), inquiryStatus: vi.fn(), inquiryPricing: vi.fn() };

vi.mock("@/lib/offline/IndexedDBHelper", () => ({ IndexedDBHelper: { getQueue: ports.getQueue, removeFromQueue: ports.removeFromQueue } }));
vi.mock("@/lib/repositories/ordersRepository", () => ({ ordersRepository: { create: ports.orderCreate } }));
vi.mock("@/lib/repositories/customersRepository", () => ({ customersRepository: { create: ports.customerCreate, updateCustomer: ports.customerUpdate } }));
vi.mock("@/lib/repositories/inquiriesRepository", () => ({ inquiriesRepository: { create: ports.inquiryCreate, updateStatus: ports.inquiryStatus, updatePricing: ports.inquiryPricing } }));

describe("W2C-B2M4A OfflineManager queue fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("retains every queued action and reports the complete queue as NOT_AVAILABLE", async () => {
    const completions: CustomEvent[] = [];
    const expired: Event[] = [];
    const completionListener = (event: Event) => completions.push(event as CustomEvent);
    const expiredListener = (event: Event) => expired.push(event);
    window.addEventListener("kreile-sync-success", completionListener);
    window.addEventListener("kreile-sync-expired", expiredListener);
    const { OfflineManager } = await import("@/lib/offline/OfflineManager");
    await OfflineManager.syncQueue();
    window.removeEventListener("kreile-sync-success", completionListener);
    window.removeEventListener("kreile-sync-expired", expiredListener);

    expect(ports.getQueue).toHaveBeenCalledTimes(1);
    expect(ports.removeFromQueue).not.toHaveBeenCalled();
    for (const writer of [ports.orderCreate, ports.customerCreate, ports.customerUpdate, ports.inquiryCreate, ports.inquiryStatus, ports.inquiryPricing]) expect(writer).not.toHaveBeenCalled();
    expect(completions).toHaveLength(1);
    expect(completions[0].detail).toEqual({ count: 0, blockedCount: 16 });
    expect(expired).toHaveLength(0);
  });

  it("does nothing when the queue is empty", async () => {
    const completions: Event[] = [];
    const expired: Event[] = [];
    const completionListener = (event: Event) => completions.push(event);
    const expiredListener = (event: Event) => expired.push(event);
    window.addEventListener("kreile-sync-success", completionListener);
    window.addEventListener("kreile-sync-expired", expiredListener);
    ports.getQueue.mockResolvedValueOnce([]);

    try {
      const { OfflineManager } = await import("@/lib/offline/OfflineManager");
      await OfflineManager.syncQueue();
    } finally {
      window.removeEventListener("kreile-sync-success", completionListener);
      window.removeEventListener("kreile-sync-expired", expiredListener);
    }

    expect(ports.getQueue).toHaveBeenCalledTimes(1);
    expect(completions).toHaveLength(0);
    expect(expired).toHaveLength(0);
    expect(ports.removeFromQueue).not.toHaveBeenCalled();
    for (const writer of [ports.orderCreate, ports.customerCreate, ports.customerUpdate, ports.inquiryCreate, ports.inquiryStatus, ports.inquiryPricing]) expect(writer).not.toHaveBeenCalled();
  });

  it("keeps syncQueue free of deletion, repository, expiry, and mock-delay paths", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const source = await readFile(path.join(root, "lib/offline/OfflineManager.ts"), "utf8");
    const syncQueueSource = source.slice(source.indexOf("async syncQueue"), source.indexOf("// Global browser listeners"));
    expect(syncQueueSource).not.toMatch(/removeFromQueue|repositories\/|expiresAt|new Date|setTimeout|Mocking backend sync/);
  });
});
