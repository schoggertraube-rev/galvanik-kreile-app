import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("global refresh truth boundary", () => {
  it("refreshes through existing server-backed page loaders without a browser database channel", () => {
    const manager = source("src/components/layout/RealtimeSyncManager.tsx");
    expect(manager).toContain('window.setInterval(triggerRefresh, 30_000)');
    expect(manager).toContain('CustomEvent("kreile-sync-focus"');
    expect(manager).toContain('visibilitychange');
    expect(manager).not.toContain('supabase');
    expect(manager).not.toContain('postgres_changes');
    expect(manager).not.toContain('.channel(');
  });

  it("labels the mechanism as auto-refresh rather than live connectivity", () => {
    const header = source("src/components/layout/KreileHeader.tsx");
    expect(header).toContain("Auto-Refresh");
    expect(header).not.toMatch(/>\s*Live\s*</);
  });
});
