import "server-only";

import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { ImmutableInvoiceSummary, ReadInvoiceSummariesResult } from "@/lib/server/invoiceRead";
import type { ListOpenQuotesResult, QuoteReadback } from "@/modules/quotes/public";
import type { SearchHit, SearchMatchField, SearchProvider } from "@/modules/suche/public";

type SearchProviderReads = {
  readQuotes: () => Promise<ListOpenQuotesResult>;
  readInvoices: () => Promise<ReadInvoiceSummariesResult>;
};

const normalized = (value: string) => value.trim().toLocaleLowerCase("de-DE");
const contains = (value: string | null, query: string) => value !== null && normalized(value).includes(query);

function quoteHit(quote: QuoteReadback, query: string): SearchHit | null {
  const position = quote.positions.find((item) => [item.name, item.material, item.surfaceRequested].some((value) => contains(value, query)));
  const matched: { field: SearchMatchField; label: string; value: string } | null = contains(quote.quoteNumber, query)
    ? { field: "quoteNumber", label: "KV-Nummer", value: quote.quoteNumber }
    : contains(quote.customerDisplayName, query)
      ? { field: "customerName", label: "Kunde", value: quote.customerDisplayName }
      : contains(quote.note, query)
        ? { field: "note", label: "Notiz", value: quote.note ?? "" }
        : position
          ? { field: "position", label: "Position", value: [position.name, position.material, position.surfaceRequested].filter(Boolean).join(" · ") }
          : contains(quote.dueDate, query)
            ? { field: "dueDate", label: "Terminwunsch", value: quote.dueDate }
            : null;
  if (!matched) return null;
  return {
    type: "QUOTE",
    id: quote.quoteId,
    title: quote.quoteNumber,
    subtitle: `${quote.customerDisplayName} · Terminwunsch ${quote.dueDate}`,
    status: quote.status,
    matchField: matched.field,
    source: "Angebote",
    matchLabel: matched.label,
    matchValue: matched.value,
    context: `${quote.quoteNumber} · ${quote.customerDisplayName} · ${quote.totalNetCents} Cent netto`,
    href: `/customers/${encodeURIComponent(quote.customerId)}`,
    actionLabel: "Kundenkarte zum KV öffnen",
  };
}

function invoiceHit(invoice: ImmutableInvoiceSummary, query: string): SearchHit | null {
  const matched: { field: SearchMatchField; label: string; value: string } | null = contains(invoice.invoiceNumber, query)
    ? { field: "invoiceNumber", label: "Rechnungsnummer", value: invoice.invoiceNumber }
    : contains(invoice.orderNumber, query)
      ? { field: "orderNumber", label: "Auftragsnummer", value: invoice.orderNumber }
      : contains(invoice.customerName, query)
        ? { field: "customerName", label: "Kunde", value: invoice.customerName }
        : contains(invoice.dueDate, query)
          ? { field: "dueDate", label: "Fälligkeit", value: invoice.dueDate }
          : null;
  if (!matched) return null;
  return {
    type: "INVOICE",
    id: invoice.invoiceId,
    title: invoice.invoiceNumber,
    subtitle: `${invoice.customerName} · ${invoice.orderNumber}`,
    status: invoice.status,
    matchField: matched.field,
    source: "Rechnungen",
    matchLabel: matched.label,
    matchValue: matched.value,
    context: `${invoice.invoiceNumber} · ${invoice.customerName} · ${invoice.orderNumber}`,
    href: `/buchhaltung/rechnungen`,
    actionLabel: "Rechnung öffnen",
  };
}

export function buildSearchProviders(authorization: AuthorizationSnapshot, reads: SearchProviderReads): SearchProvider[] {
  const providers: SearchProvider[] = [];
  if (authorization.permissions.includes("perm_view_leitstand")) {
    providers.push({
      id: "quotes",
      label: "Angebote",
      search: async (query) => {
        const result = await reads.readQuotes();
        if (result.code !== "OK") throw new Error("SEARCH_QUOTES_UNAVAILABLE");
        const lowered = normalized(query);
        return { hits: result.quotes.map((quote) => quoteHit(quote, lowered)).filter((hit): hit is SearchHit => hit !== null), exhaustive: result.quotes.length < 100 };
      },
    });
  }
  if (["buero", "meister", "admin"].includes(authorization.role)) {
    providers.push({
      id: "invoices",
      label: "Rechnungen",
      search: async (query) => {
        const result = await reads.readInvoices();
        if (result.code !== "OK") throw new Error("SEARCH_INVOICES_UNAVAILABLE");
        const lowered = normalized(query);
        return { hits: result.data.map((invoice) => invoiceHit(invoice, lowered)).filter((hit): hit is SearchHit => hit !== null), exhaustive: result.data.length < 250 };
      },
    });
  }
  return providers;
}
