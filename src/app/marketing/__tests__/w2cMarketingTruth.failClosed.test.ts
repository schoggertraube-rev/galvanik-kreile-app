import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  delete: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
};
const revalidatePath = vi.fn();
const denial = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
const root = process.cwd();

vi.mock("@/db", () => ({ db }));
vi.mock("@/db/schema_marketing", () => ({ aktion: {}, kanal: {}, segment: {}, touchpoint: {} }));
vi.mock("drizzle-orm", () => ({ desc: vi.fn(), eq: vi.fn(), ilike: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const source = (file: string) => readFileSync(resolve(root, file), "utf8");
const routeFiles = [
  "src/app/marketing/page.tsx",
  "src/app/marketing/aktion/page.tsx",
  "src/app/marketing/aktion/neu/page.tsx",
  "src/app/marketing/segmente/page.tsx",
  "src/app/marketing/segmente/neu/page.tsx",
  "src/app/marketing/segmente/[id]/page.tsx",
  "src/app/marketing/kanaele/page.tsx",
  "src/app/marketing/attribution/page.tsx",
  "src/app/marketing/einwilligungen/page.tsx",
];

function expectNoEffects() {
  for (const port of Object.values(db)) expect(port).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
}

describe("W2C-B2M4B Marketing fail-closed truth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies all six marketing writers before database or revalidation effects", async () => {
    const [aktion, segmente, kanaele] = await Promise.all([
      import("../aktion/actions"),
      import("../segmente/actions"),
      import("../kanaele/actions"),
    ]);
    const formData = new FormData();

    await expect(aktion.createAktion(formData)).rejects.toThrow(denial);
    await expect(aktion.changeAktionStatus("aktion-1", "ausgefuehrt")).rejects.toThrow(denial);
    await expect(segmente.createSegment(formData)).rejects.toThrow(denial);
    await expect(segmente.updateSegment("segment-1", formData)).rejects.toThrow(denial);
    await expect(segmente.deleteSegment("segment-1")).rejects.toThrow(denial);
    await expect(kanaele.updateKanalConfig("kanal-1", true, {})).rejects.toThrow(denial);

    expectNoEffects();
  });

  it.each(routeFiles)("keeps %s as a pure shared unavailable route", (file) => {
    const page = source(file);

    expect(page.match(/^import .+;$/gm)).toEqual([
      'import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";',
    ]);
    expect(page).toContain("<FoundationUnavailable />");
    expect(page).not.toMatch(/"use client"|'use client'|useEffect|<form|<button|await\s|revalidate|\b(?:db|supabase)\b/i);
  });

  it("keeps the root away from the marketing studio, provider, seed, and operational actions", () => {
    const page = source("src/app/marketing/page.tsx");

    for (const forbidden of [
      "MarketingStudioClient",
      "InstagramAdapter",
      "ensureMarketingData",
      "getBesteAktionAction",
      "getFunnelAction",
      "getWirkungMiniAction",
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it("keeps subroutes away from their former operational clients and action modules", () => {
    const subroutes = routeFiles.slice(1).map(source);
    const forbidden = [
      "./actions",
      "../actions",
      "MarketingStudioClient",
      "getAttributionData",
      "getEinwilligungen",
      "getKanaele",
      "getSegments",
      "getSegmentById",
      "createAktion",
      "createSegment",
      "updateSegment",
      "deleteSegment",
      "updateKanalConfig",
    ];

    for (const page of subroutes) {
      for (const value of forbidden) expect(page).not.toContain(value);
    }
  });
});
