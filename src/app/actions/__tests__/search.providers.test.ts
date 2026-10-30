import { describe, expect, it, vi } from "vitest";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { ImmutableInvoiceSummary } from "@/lib/server/invoiceRead";
import type { QuoteReadback } from "@/modules/quotes/public";
import { buildSearchProviders } from "../search.providers";

const authorization: AuthorizationSnapshot = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "kreile",
  displayName: "Gregor",
  role: "admin",
  permissions: ["perm_view_leitstand", "perm_view_prices"],
  active: true,
};

const quote: QuoteReadback = {
  quoteId: "11111111-1111-4111-8111-111111111111",
  quoteNumber: "KV-2026-0042",
  customerId: "customer-1",
  customerNumber: "K-1042",
  customerDisplayName: "Muster GmbH",
  status: "draft",
  version: 1,
  currency: "EUR",
  dueDate: "2026-11-12",
  validUntil: null,
  termStatus: null,
  intakeSource: null,
  note: "Geländer prüfen",
  totalNetCents: 42000,
  linkedOrderId: null,
  actorId: authorization.userId,
  actorDisplayName: authorization.displayName,
  createdAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
  convertedAt: null,
  positions: [{ id: "22222222-2222-4222-8222-222222222222", position: 1, name: "Geländer", quantity: 1, material: "Stahl", surfaceRequested: "Verzinken", unitPriceCents: 42000, lineTotalCents: 42000 }],
};

const invoice: ImmutableInvoiceSummary = {
  invoiceId: "44444444-4444-4444-8444-444444444444",
  invoiceNumber: "R-2026-0042",
  orderId: "order-1",
  orderNumber: "A-2026-0042",
  customerId: "customer-1",
  customerName: "Muster GmbH",
  status: "issued",
  aggregateVersion: 1,
  orderVersion: 3,
  netAmountCents: 42000,
  vatRateBasisPoints: 1900,
  vatAmountCents: 7980,
  grossAmountCents: 49980,
  serviceDate: "2026-10-25",
  dueDate: "2026-11-08",
  issuedAt: "2026-10-26T10:00:00.000Z",
  originalPdfRef: "invoice://44444444-4444-4444-8444-444444444444/original",
  originalPdfSha256: "a".repeat(64),
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  cancellationPdfRef: null,
  cancellationPdfSha256: null,
};

describe("P2 module search providers", () => {
  it("registers and maps real quote and invoice reads", async () => {
    const providers = buildSearchProviders(authorization, {
      readQuotes: vi.fn().mockResolvedValue({ code: "OK", quotes: [quote] }),
      readInvoices: vi.fn().mockResolvedValue({ code: "OK", data: [invoice] }),
      readAuxiliary: vi.fn().mockResolvedValue({ documents: [], mails: [], appointments: [], exhaustive: true }),
    });
    expect(providers.map((provider) => provider.label)).toEqual(["Angebote", "Rechnungen", "Dokumente", "Mails", "Termine"]);
    await expect(providers[0]?.search("KV-2026")).resolves.toMatchObject({ hits: [{ type: "QUOTE", id: quote.quoteId, source: "Angebote" }], exhaustive: true });
    await expect(providers[1]?.search("R-2026")).resolves.toMatchObject({ hits: [{ type: "INVOICE", id: invoice.invoiceId, source: "Rechnungen" }], exhaustive: true });
  });

  it("omits invoice reads for workshop roles and fails closed on source errors", async () => {
    const readInvoices = vi.fn();
    const providers = buildSearchProviders({ ...authorization, role: "werkstatt", permissions: ["perm_view_leitstand"] }, {
      readQuotes: vi.fn().mockResolvedValue({ code: "UNAVAILABLE", message: "nicht lesbar" }),
      readInvoices,
      readAuxiliary: vi.fn().mockResolvedValue({ documents: [], mails: [], appointments: [], exhaustive: true }),
    });
    expect(providers.map((provider) => provider.label)).toEqual(["Angebote", "Dokumente", "Mails", "Termine"]);
    await expect(providers[0]?.search("KV")).rejects.toThrow("SEARCH_QUOTES_UNAVAILABLE");
    expect(readInvoices).not.toHaveBeenCalled();
  });
});
