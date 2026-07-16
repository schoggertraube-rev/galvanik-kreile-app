import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("offline and outbox truth boundary", () => {
  it("treats browser connectivity as a hint and never converts queue read failure into zero", () => {
    const manager = source("src/lib/offline/OfflineManager.ts");

    expect(manager).toContain("getBrowserNetworkStatus");
    expect(manager).toContain('"adapter_missing"');
    expect(manager).toContain('CustomEvent("kreile-sync-complete"');
    expect(manager).not.toMatch(/getPendingCount[\s\S]*catch\s*\{[\s\S]*return 0/);
  });

  it("does not claim that queued writes are secured or synchronized", () => {
    const badge = source("src/components/offline/OfflineSyncBadge.tsx");
    const header = source("src/components/layout/KreileHeader.tsx");

    expect(badge).toContain('"kreile-sync-complete"');
    expect(badge).toContain("ohne bestätigten Backend-Beleg");
    expect(badge).not.toContain("Eingaben werden lokal gesichert");
    expect(badge).not.toContain("Wieder Online");
    expect(badge).not.toContain("Zuletzt synchronisiert");
    expect(header).toContain("Backend-Erreichbarkeit nicht geprüft");
    expect(header).not.toMatch(/>Online</);
  });

  it("confirms local writes only after transaction completion and preserves read failures", () => {
    const indexedDb = source("src/lib/offline/IndexedDBHelper.ts");
    const legacyOutbox = source("src/lib/offline/OfflineOutbox.ts");
    const context = source("src/lib/offline/SyncContext.tsx");

    expect(indexedDb).toContain("transaction.oncomplete = () => resolve(action)");
    expect(indexedDb).toContain("transaction.onabort");
    expect(legacyOutbox).toContain("tx.oncomplete = () => resolve()");
    expect(legacyOutbox).not.toMatch(/getAllItems[\s\S]*catch\s*\{[\s\S]*return \[\]/);
    expect(context).toContain("outboxReadError ?? syncBlocker");
    expect(context).toContain("setSyncBlocker");
  });
});
