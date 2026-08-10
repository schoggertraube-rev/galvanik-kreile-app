import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const source = (relativePath: string) => readFile(path.resolve(process.cwd(), relativePath), "utf8");

describe("W2C-B2M5A inquiry containment", () => {
  it("keeps the repository source free of action bridges and inquiry side-effect references", async () => {
    const repositorySource = await source("src/lib/repositories/inquiriesRepository.ts");
    const forbiddenReferences = [
      "@/app/actions/inquiries.actions",
      "getInquiries",
      "getOpenInquiriesCount",
      "createInquiry",
      "updateInquiry",
      "window",
      "Event",
      "dispatchEvent",
      "kreile-inquiries-updated",
      "Date",
    ];

    for (const reference of forbiddenReferences) {
      expect(repositorySource).not.toMatch(new RegExp(`(?<![\\w$])${reference.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?![\\w$])`));
    }
  });

  it("denies every repository method locally without dispatching an inquiry event", async () => {
    const { inquiriesRepository } = await import("@/lib/repositories/inquiriesRepository");
    const dispatchEvent = vi.spyOn(window, "dispatchEvent");
    const input = {
      customerName: "Kunde",
      customerId: "customer-id",
      subject: "Betreff",
      description: "Beschreibung",
      rustLevel: "Leicht" as const,
      dirtLevel: "Sauber" as const,
      partCount: 1,
      material: "Stahl",
      photo: undefined,
    };
    const pricing = {
      grundarbeit: 0,
      reinigung: 0,
      entmetallisierung: 0,
      schleifaufwand: 0,
      badchemie: 0,
      risikopuffer: 0,
      marge: 0,
    };

    await expect(inquiriesRepository.getAll()).rejects.toThrow("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
    await expect(inquiriesRepository.getOpenCount()).rejects.toThrow("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
    await expect(inquiriesRepository.create(input)).rejects.toThrow("NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.");
    await expect(inquiriesRepository.updateStatus("inquiry-id", "offen")).resolves.toBeNull();
    await expect(inquiriesRepository.updatePricing("inquiry-id", pricing)).resolves.toBeNull();

    expect(dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: "kreile-inquiries-updated" }));
  });

  it("keeps the routes as concrete FoundationUnavailable-only server compositions", async () => {
    const expected = (name: string) => [
      'import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";',
      "",
      'export const dynamic = "force-dynamic";',
      "export const revalidate = 0;",
      "",
      `export default function ${name}() {`,
      "  return <FoundationUnavailable />;",
      "}",
    ].join("\n");

    await expect(source("src/app/quotes/page.tsx")).resolves.toBe(expected("QuotesPage") + "\n");
    await expect(source("src/app/quotes/new/page.tsx")).resolves.toBe(expected("NewQuotePage") + "\n");
  });

  it("removes inquiry count truth while preserving the concrete orders and intake hooks", async () => {
    const [dashboard, intake] = await Promise.all([
      source("src/app/page.tsx"),
      source("src/components/intake/IntakeEntry.tsx"),
    ]);

    for (const forbidden of ["inquiriesRepository", "getOpenCount", "openQuotes", "kreile-inquiries-updated"]) {
      expect(dashboard).not.toContain(forbidden);
      expect(intake).not.toContain(forbidden);
    }
    expect(dashboard).toContain("Anfragen derzeit nicht verfügbar");
    expect(intake).toContain("Anfragen derzeit nicht verfügbar");
    expect(dashboard).toContain("getOrdersDb");
    expect(dashboard).toContain('"kreile-orders-updated"');
    expect(intake).toContain("ordersRepository.getAll");
    expect(intake).toContain('window.addEventListener("storage", fetchStats)');
    expect(intake).toContain('href="/quotes"');
  });
});
