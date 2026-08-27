import React, { type ReactElement } from "react";
import { Document, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";

/**
 * F1.4 — canonical shape of the immutable accounting snapshot stored on
 * public.invoices.snapshot (jsonb) and rendered into the immutable original
 * PDF. This module is the single source of truth for the snapshot/line
 * shape; src/lib/server/commands/immutableInvoiceCommand.ts imports these
 * types instead of redefining them, to avoid a second silent schema.
 */
export type ImmutableInvoiceBaseLine = {
  type: "BASE";
  itemId: string;
  name: string;
  quantity: number;
  unitNetAmountCents: number;
  lineNetAmountCents: number;
};

export type ImmutableInvoiceExtraWorkLine = {
  type: "EXTRA_WORK";
  itemId: string;
  catalogPositionId: string;
  catalogPositionName: string;
  minutes: number;
  hourlyRateCents: number;
  amountCents: number;
};

export type ImmutableInvoiceLine = ImmutableInvoiceBaseLine | ImmutableInvoiceExtraWorkLine;

export type ImmutableInvoiceSnapshot = {
  schemaVersion: 1;
  seller: {
    companyName: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    taxId: string;
    iban: string;
    bic: string;
    bankName: string;
  };
  customer: {
    name: string;
    companyName: string | null;
    contactPerson: string | null;
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  order: {
    orderId: string;
    orderVersion: number;
    orderNumber: string;
    title: string;
    freezeId: string;
  };
  lines: ImmutableInvoiceLine[];
  totals: {
    netAmountCents: number;
    vatRateBasisPoints: number;
    vatAmountCents: number;
    grossAmountCents: number;
  };
  serviceDate: string;
  issuedAt: string;
  paymentTermDays: number;
};

export type ImmutableInvoiceDocumentProps = {
  invoiceNumber: string;
  dueDate: string;
  snapshot: ImmutableInvoiceSnapshot;
};

export type ImmutableInvoiceCancellationDocumentProps = {
  invoiceNumber: string;
  cancelledAt: string;
  cancelReason: string;
  snapshot: ImmutableInvoiceSnapshot;
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  sellerBlock: {
    fontSize: 8,
    color: "#666666",
    lineHeight: 1.4,
  },
  metaBlock: {
    textAlign: "right",
  },
  documentTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  metaLine: {
    fontSize: 9,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  customerBlock: {
    lineHeight: 1.5,
  },
  customerName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  serviceBlock: {
    textAlign: "right",
    lineHeight: 1.5,
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: "#DDDDDD",
    marginTop: 10,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
  },
  colPos: {
    width: "6%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
  },
  colDesc: {
    width: "44%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
  },
  colQty: {
    width: "16%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
    textAlign: "right",
  },
  colUnit: {
    width: "17%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
    textAlign: "right",
  },
  colTotal: {
    width: "17%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
    textAlign: "right",
  },
  headerCell: {
    fontSize: 8,
    fontWeight: "bold",
  },
  cell: {
    fontSize: 8,
  },
  totalsBlock: {
    alignSelf: "flex-end",
    width: "45%",
    marginBottom: 24,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    marginTop: 2,
  },
  totalsLabel: {
    fontSize: 9,
  },
  totalsValue: {
    fontSize: 9,
  },
  totalsFinalLabel: {
    fontSize: 10,
    fontWeight: "bold",
  },
  totalsFinalValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  paymentBlock: {
    marginBottom: 24,
    lineHeight: 1.5,
  },
  cancellationNotice: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#C2185B",
    backgroundColor: "#FFF7FA",
    padding: 10,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#999999",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 8,
  },
});

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

const DATE_ONLY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

/**
 * F1.4 — Berlin is the single legal calendar truth for an instant on an
 * accounting document. The instant itself stays UTC; only its presentation is
 * localised.
 */
const berlinDateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Formatter 1 — a calendar day that is already a day, not an instant.
 * Purely lexical: `new Date("YYYY-MM-DD")` is deliberately not used, because it
 * would silently reinterpret the value as a UTC midnight instant and could shift
 * the printed day. Fails closed; there is no fallback date.
 */
function formatCalendarDate(dateOnly: string): string {
  if (typeof dateOnly !== "string" || !DATE_ONLY_PATTERN.test(dateOnly)) {
    throw new Error("INVOICE_PDF_CALENDAR_DATE_INVALID");
  }
  const year = Number(dateOnly.slice(0, 4));
  const month = Number(dateOnly.slice(5, 7));
  const day = Number(dateOnly.slice(8, 10));
  if (
    year < 2000 || year > 2100
    || month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
  ) throw new Error("INVOICE_PDF_CALENDAR_DATE_INVALID");
  return `${dateOnly.slice(8, 10)}.${dateOnly.slice(5, 7)}.${dateOnly.slice(0, 4)}`;
}

/**
 * Formatter 2 — a UTC instant rendered as the Berlin calendar day it legally
 * belongs to. Fails closed on anything that is not the canonical instant the
 * command persisted; there is no fallback date.
 */
function formatBerlinInstant(isoInstant: string): string {
  if (typeof isoInstant !== "string" || !ISO_INSTANT_PATTERN.test(isoInstant)) {
    throw new Error("INVOICE_PDF_INSTANT_INVALID");
  }
  const instant = new Date(isoInstant);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== isoInstant) {
    throw new Error("INVOICE_PDF_INSTANT_INVALID");
  }
  const parts = berlinDateFormat.formatToParts(instant);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!day || !month || !year) throw new Error("INVOICE_PDF_INSTANT_INVALID");
  return `${day}.${month}.${year}`;
}

function formatVatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
}

function lineDescription(line: ImmutableInvoiceLine): string {
  return line.type === "BASE" ? line.name : line.catalogPositionName;
}

function lineQuantity(line: ImmutableInvoiceLine): string {
  return line.type === "BASE" ? `${line.quantity} Stk.` : `${line.minutes} Min.`;
}

function lineUnitAmount(line: ImmutableInvoiceLine): string {
  return line.type === "BASE"
    ? formatCents(line.unitNetAmountCents)
    : `${formatCents(line.hourlyRateCents)}/Std.`;
}

function lineTotalAmount(line: ImmutableInvoiceLine): number {
  return line.type === "BASE" ? line.lineNetAmountCents : line.amountCents;
}

export function ImmutableInvoiceDocument({ invoiceNumber, dueDate, snapshot }: ImmutableInvoiceDocumentProps) {
  const { seller, customer, order, lines, totals } = snapshot;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.sellerBlock}>
            <Text style={{ fontWeight: "bold", color: "#000000", fontSize: 10 }}>{seller.companyName}</Text>
            <Text>{seller.street}</Text>
            <Text>{seller.zip} {seller.city}</Text>
            <Text>{seller.country}</Text>
            <Text>USt-IdNr.: {seller.taxId}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.documentTitle}>Rechnung</Text>
            <Text style={styles.metaLine}>Rechnungsnummer: {invoiceNumber}</Text>
            <Text style={styles.metaLine}>Rechnungsdatum: {formatBerlinInstant(snapshot.issuedAt)}</Text>
            <Text style={styles.metaLine}>Leistungsdatum: {formatCalendarDate(snapshot.serviceDate)}</Text>
            <Text style={styles.metaLine}>Auftragsnummer: {order.orderNumber}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.customerBlock}>
            <Text style={styles.customerName}>{customer.companyName ?? customer.name}</Text>
            {customer.companyName && customer.contactPerson ? <Text>{customer.contactPerson}</Text> : null}
            <Text>{customer.street}</Text>
            <Text>{customer.zip} {customer.city}</Text>
            <Text>{customer.country}</Text>
          </View>
          <View style={styles.serviceBlock}>
            <Text>Auftrag: {order.title}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.colPos, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Pos.</Text></View>
            <View style={[styles.colDesc, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Bezeichnung</Text></View>
            <View style={[styles.colQty, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Menge</Text></View>
            <View style={[styles.colUnit, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Einzelpreis netto</Text></View>
            <View style={[styles.colTotal, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Gesamt netto</Text></View>
          </View>
          {lines.map((line, index) => (
            <View style={styles.tableRow} key={`${line.type}-${line.itemId}-${index}`}>
              <View style={styles.colPos}><Text style={styles.cell}>{index + 1}</Text></View>
              <View style={styles.colDesc}><Text style={styles.cell}>{lineDescription(line)}</Text></View>
              <View style={styles.colQty}><Text style={styles.cell}>{lineQuantity(line)}</Text></View>
              <View style={styles.colUnit}><Text style={styles.cell}>{lineUnitAmount(line)}</Text></View>
              <View style={styles.colTotal}><Text style={styles.cell}>{formatCents(lineTotalAmount(line))}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Netto</Text>
            <Text style={styles.totalsValue}>{formatCents(totals.netAmountCents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>zzgl. USt ({formatVatRate(totals.vatRateBasisPoints)})</Text>
            <Text style={styles.totalsValue}>{formatCents(totals.vatAmountCents)}</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text style={styles.totalsFinalLabel}>Rechnungsbetrag brutto</Text>
            <Text style={styles.totalsFinalValue}>{formatCents(totals.grossAmountCents)}</Text>
          </View>
        </View>

        <View style={styles.paymentBlock}>
          <Text>Zahlungsziel: {snapshot.paymentTermDays} Tage netto, fällig am {formatCalendarDate(dueDate)}.</Text>
          <Text>Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer {invoiceNumber}.</Text>
        </View>

        <View style={styles.footer}>
          <Text>
            {seller.companyName} · {seller.street} · {seller.zip} {seller.city} · USt-IdNr.: {seller.taxId}
          </Text>
          <Text>
            {seller.bankName} · IBAN {seller.iban} · BIC {seller.bic}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Renders the immutable cancellation document exclusively from the persisted
 * F1.4 snapshot and cancellation metadata. No live order, customer or tenant
 * setting is read or recomputed for this accounting document.
 */
export function ImmutableInvoiceCancellationDocument({
  invoiceNumber,
  cancelledAt,
  cancelReason,
  snapshot,
}: ImmutableInvoiceCancellationDocumentProps) {
  const { seller, customer, order, lines, totals } = snapshot;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.sellerBlock}>
            <Text style={{ fontWeight: "bold", color: "#000000", fontSize: 10 }}>{seller.companyName}</Text>
            <Text>{seller.street}</Text>
            <Text>{seller.zip} {seller.city}</Text>
            <Text>{seller.country}</Text>
            <Text>USt-IdNr.: {seller.taxId}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.documentTitle}>Stornobeleg</Text>
            <Text style={styles.metaLine}>Zu Rechnung: {invoiceNumber}</Text>
            <Text style={styles.metaLine}>Stornodatum: {formatBerlinInstant(cancelledAt)}</Text>
            <Text style={styles.metaLine}>Leistungsdatum: {formatCalendarDate(snapshot.serviceDate)}</Text>
            <Text style={styles.metaLine}>Auftragsnummer: {order.orderNumber}</Text>
          </View>
        </View>

        <View style={styles.cancellationNotice}>
          <Text style={{ fontWeight: "bold" }}>Die Rechnung {invoiceNumber} wurde vollständig storniert.</Text>
          <Text>Stornogrund: {cancelReason}</Text>
          <Text>Das unveränderte Original bleibt als eigener Beleg erhalten.</Text>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.customerBlock}>
            <Text style={styles.customerName}>{customer.companyName ?? customer.name}</Text>
            {customer.companyName && customer.contactPerson ? <Text>{customer.contactPerson}</Text> : null}
            <Text>{customer.street}</Text>
            <Text>{customer.zip} {customer.city}</Text>
            <Text>{customer.country}</Text>
          </View>
          <View style={styles.serviceBlock}>
            <Text>Auftrag: {order.title}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={[styles.colPos, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Pos.</Text></View>
            <View style={[styles.colDesc, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Bezeichnung</Text></View>
            <View style={[styles.colQty, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Menge</Text></View>
            <View style={[styles.colUnit, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Einzelpreis netto</Text></View>
            <View style={[styles.colTotal, { backgroundColor: "#F8F8F8" }]}><Text style={styles.headerCell}>Storno netto</Text></View>
          </View>
          {lines.map((line, index) => (
            <View style={styles.tableRow} key={`cancel-${line.type}-${line.itemId}-${index}`}>
              <View style={styles.colPos}><Text style={styles.cell}>{index + 1}</Text></View>
              <View style={styles.colDesc}><Text style={styles.cell}>{lineDescription(line)}</Text></View>
              <View style={styles.colQty}><Text style={styles.cell}>{lineQuantity(line)}</Text></View>
              <View style={styles.colUnit}><Text style={styles.cell}>{formatCents(-Math.abs(line.type === "BASE" ? line.unitNetAmountCents : line.hourlyRateCents))}</Text></View>
              <View style={styles.colTotal}><Text style={styles.cell}>{formatCents(-Math.abs(lineTotalAmount(line)))}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Storno netto</Text>
            <Text style={styles.totalsValue}>{formatCents(-Math.abs(totals.netAmountCents))}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Storno USt ({formatVatRate(totals.vatRateBasisPoints)})</Text>
            <Text style={styles.totalsValue}>{formatCents(-Math.abs(totals.vatAmountCents))}</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text style={styles.totalsFinalLabel}>Stornobetrag brutto</Text>
            <Text style={styles.totalsFinalValue}>{formatCents(-Math.abs(totals.grossAmountCents))}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{seller.companyName} · {seller.street} · {seller.zip} {seller.city} · USt-IdNr.: {seller.taxId}</Text>
          <Text>{seller.bankName} · IBAN {seller.iban} · BIC {seller.bic}</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * F1.4 — typed factory that returns the concrete `<Document>` element with
 * `DocumentProps`, so callers (e.g. `renderToBuffer`) get a properly typed
 * `ReactElement<DocumentProps>` instead of the component's own prop type.
 * `React.createElement(ImmutableInvoiceDocument, props)` is intentionally
 * not used at the call site: its return type is `ReactElement<ImmutableInvoiceDocumentProps>`,
 * not `ReactElement<DocumentProps>`. Renders exactly the same element tree,
 * no bytes/content change.
 */
export function createImmutableInvoicePdfDocument(
  props: ImmutableInvoiceDocumentProps,
): ReactElement<DocumentProps> {
  return <ImmutableInvoiceDocument {...props} />;
}

export function createImmutableInvoiceCancellationPdfDocument(
  props: ImmutableInvoiceCancellationDocumentProps,
): ReactElement<DocumentProps> {
  return <ImmutableInvoiceCancellationDocument {...props} />;
}
