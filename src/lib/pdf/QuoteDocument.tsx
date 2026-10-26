import "server-only";

import { Document, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { CustomerSummary } from "@/lib/server/customerSummaryRead";
import type { CompanySettingsInput } from "@/modules/fundament/public";
import type { QuoteReadback } from "@/modules/quotes/public";

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", fontSize: 9, color: "#182033" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  company: { width: "52%", lineHeight: 1.45 },
  meta: { width: "38%", lineHeight: 1.55 },
  title: { fontSize: 23, fontFamily: "Helvetica-Bold", marginBottom: 18 },
  address: { marginBottom: 28, lineHeight: 1.45 },
  table: { borderTop: "1 solid #D5D0C7", marginTop: 16 },
  row: { flexDirection: "row", minHeight: 30, alignItems: "center", borderBottom: "1 solid #E4E0D8" },
  head: { fontFamily: "Helvetica-Bold", backgroundColor: "#F7F6F3" },
  pos: { width: "8%" },
  description: { width: "46%", paddingRight: 8 },
  quantity: { width: "12%", textAlign: "right" },
  price: { width: "17%", textAlign: "right" },
  total: { width: "17%", textAlign: "right" },
  totals: { marginTop: 14, alignItems: "flex-end" },
  totalLine: { width: "44%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalStrong: { fontFamily: "Helvetica-Bold", fontSize: 11, borderTop: "1 solid #182033" },
  note: { marginTop: 24, padding: 12, backgroundColor: "#F7F6F3", lineHeight: 1.45 },
  footer: { position: "absolute", left: 42, right: 42, bottom: 34, paddingTop: 10, borderTop: "1 solid #E4E0D8", fontSize: 7.5, lineHeight: 1.4 },
});

function money(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function date(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

export function createQuotePdfDocument(input: {
  company: CompanySettingsInput;
  customer: CustomerSummary;
  quote: QuoteReadback;
}): ReactElement<DocumentProps> {
  const { company, customer, quote } = input;
  const customerName = customer.companyName?.trim() || customer.name;
  return (
    <Document title={`Kostenvoranschlag ${quote.quoteNumber}`} author={company.companyName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.company}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>{company.companyName}</Text>
            <Text>{company.street}</Text>
            <Text>{company.zip} {company.city}</Text>
            <Text>{company.country}</Text>
          </View>
          <View style={styles.meta}>
            <Text>KV-Nr.: {quote.quoteNumber}</Text>
            <Text>Kunden-Nr.: {quote.customerNumber ?? "–"}</Text>
            <Text>Datum: {date(quote.createdAt)}</Text>
            <Text>Gewünschter Termin: {date(quote.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.address}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{customerName}</Text>
          {customer.contactPerson ? <Text>{customer.contactPerson}</Text> : null}
          <Text>{customer.street}</Text>
          <Text>{customer.zipCode} {customer.city}</Text>
          <Text>{customer.country}</Text>
        </View>

        <Text style={styles.title}>Kostenvoranschlag</Text>
        <Text>Gern bieten wir Ihnen folgende Leistungen an:</Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.head]}>
            <Text style={styles.pos}>Pos.</Text><Text style={styles.description}>Leistung</Text>
            <Text style={styles.quantity}>Menge</Text><Text style={styles.price}>Einzel netto</Text><Text style={styles.total}>Gesamt netto</Text>
          </View>
          {quote.positions.map((position) => (
            <View key={position.id} style={styles.row} wrap={false}>
              <Text style={styles.pos}>{position.position}</Text>
              <View style={styles.description}><Text>{position.name}</Text><Text>{position.surfaceRequested}{position.material ? ` · ${position.material}` : ""}</Text></View>
              <Text style={styles.quantity}>{position.quantity}</Text>
              <Text style={styles.price}>{money(position.unitPriceCents)}</Text>
              <Text style={styles.total}>{money(position.lineTotalCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={[styles.totalLine, styles.totalStrong]}><Text>Summe netto</Text><Text>{money(quote.totalNetCents)}</Text></View>
          <Text style={{ width: "44%", textAlign: "right", marginTop: 3 }}>zuzüglich gesetzlicher Umsatzsteuer</Text>
        </View>

        {quote.note ? <View style={styles.note}><Text style={{ fontFamily: "Helvetica-Bold" }}>Hinweis</Text><Text>{quote.note}</Text></View> : null}

        <View style={styles.footer} fixed>
          <Text>{company.companyName} · {company.street} · {company.zip} {company.city}</Text>
          <Text>USt-ID / Steuernummer: {company.taxId} · {company.bankName} · IBAN {company.iban} · BIC {company.bic}</Text>
        </View>
      </Page>
    </Document>
  );
}
