import "server-only";

import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { ImmutableInvoiceSummary, ReadInvoiceSummariesResult } from "@/lib/server/invoiceRead";
import type { ListOpenQuotesResult, QuoteReadback } from "@/modules/quotes/public";
import type { SearchHit, SearchMatchField, SearchProvider } from "@/modules/suche/public";
import type { AuxiliarySearchRecords } from "@/lib/server/searchAuxiliaryRead";

type SearchProviderReads = {
  readQuotes: () => Promise<ListOpenQuotesResult>;
  readInvoices: () => Promise<ReadInvoiceSummariesResult>;
  readAuxiliary: () => Promise<AuxiliarySearchRecords>;
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
  if (authorization.permissions.includes("perm_view_prices")) {
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
  if (authorization.permissions.includes("perm_view_leitstand")) {
    let auxiliaryPromise: Promise<AuxiliarySearchRecords> | null = null;
    const auxiliary = () => auxiliaryPromise ??= reads.readAuxiliary();
    providers.push({
      id: "documents", label: "Dokumente", search: async (query) => {
        const batch = await auxiliary(); const lowered = normalized(query);
        return { exhaustive: batch.exhaustive, hits: batch.documents.filter((row) => contains(row.customerName, lowered) || contains(row.orderNumber, lowered) || contains(row.content, lowered) || contains(row.mimeType, lowered)).map((row) => ({
          type:"DOCUMENT", id:row.id, title:row.mimeType === "application/pdf" ? "PDF-Dokument" : "Foto / Dokument", subtitle:[row.customerName,row.orderNumber].filter(Boolean).join(" · "), status:row.status,
          matchField:"note", source:"Dokumente", matchLabel:"Dokumentinhalt", matchValue:contains(row.content, lowered) ? query : contains(row.orderNumber, lowered) ? row.orderNumber ?? "" : row.customerName,
          context:[row.customerName,row.orderNumber,new Date(row.recordedAt).toLocaleDateString("de-DE")].filter(Boolean).join(" · "), href:row.orderId ? `/orders/${encodeURIComponent(row.orderId)}` : `/customers/${encodeURIComponent(row.customerId)}`, actionLabel:"Ablage öffnen",
        })) };
      },
    });
    providers.push({
      id: "mails", label: "Mails", search: async (query) => {
        const batch = await auxiliary(); const lowered = normalized(query);
        return { exhaustive: batch.exhaustive, hits: batch.mails.filter((row) => contains(row.subject, lowered) || contains(row.body, lowered) || contains(row.customerName, lowered) || contains(row.orderNumber, lowered)).map((row) => ({
          type:"MAIL", id:row.id, title:row.subject, subtitle:[row.customerName,row.orderNumber].filter(Boolean).join(" · "), status:row.status,
          matchField:contains(row.subject, lowered) ? "title" : "note", source:"Mails", matchLabel:contains(row.subject, lowered) ? "Betreff" : "Mailinhalt", matchValue:contains(row.subject, lowered) ? row.subject : query,
          context:[row.customerName,row.direction,new Date(row.recordedAt).toLocaleDateString("de-DE")].join(" · "), href:row.orderId ? `/orders/${encodeURIComponent(row.orderId)}` : `/customers/${encodeURIComponent(row.customerId)}`, actionLabel:"Vorgang zur Mail öffnen",
        })) };
      },
    });
    providers.push({
      id: "appointments", label: "Termine", search: async (query) => {
        const batch = await auxiliary(); const lowered = normalized(query);
        return { exhaustive: batch.exhaustive, hits: batch.appointments.filter((row) => contains(row.title, lowered) || contains(row.customerName, lowered) || contains(row.orderNumber, lowered) || contains(row.startsAt, lowered)).map((row) => ({
          type:"APPOINTMENT", id:row.id, title:row.title, subtitle:[row.customerName,row.orderNumber,new Date(row.startsAt).toLocaleString("de-DE")].filter(Boolean).join(" · "), status:row.status,
          matchField:contains(row.startsAt, lowered) ? "dueDate" : "title", source:"Termine", matchLabel:contains(row.startsAt, lowered) ? "Termin" : "Titel", matchValue:contains(row.startsAt, lowered) ? row.startsAt : row.title,
          context:[row.eventType,row.customerName,row.orderNumber].filter(Boolean).join(" · "), href:row.orderId ? `/orders/${encodeURIComponent(row.orderId)}` : row.customerId ? `/customers/${encodeURIComponent(row.customerId)}` : "/", actionLabel:"Bezug öffnen",
        })) };
      },
    });
  }
  return providers;
}
