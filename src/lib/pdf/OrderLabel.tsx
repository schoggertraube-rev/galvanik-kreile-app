import "server-only";

import { Document, Image as PdfImage, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

const MM = 72 / 25.4;
const LABEL_WIDTH = 62 * MM;
const LABEL_HEIGHT = 40 * MM;

const styles = StyleSheet.create({
  page: {
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    padding: 2.5 * MM,
    flexDirection: "row",
    fontFamily: "Helvetica",
    color: "#182033",
  },
  qrColumn: {
    width: 27 * MM,
    paddingRight: 2 * MM,
  },
  qr: {
    width: 25 * MM,
    height: 25 * MM,
  },
  qrCaption: {
    marginTop: 1.25 * MM,
    fontSize: 5.6,
    lineHeight: 1.05,
  },
  details: {
    flex: 1,
    paddingTop: 0.25 * MM,
  },
  field: {
    marginBottom: 1.1 * MM,
  },
  label: {
    fontSize: 5.4,
    lineHeight: 1,
    color: "#526078",
    textTransform: "uppercase",
  },
  value: {
    marginTop: 0.35 * MM,
    fontSize: 7.2,
    lineHeight: 1.08,
    fontFamily: "Helvetica-Bold",
  },
  orderNumber: {
    marginTop: 0.35 * MM,
    fontSize: 8.4,
    lineHeight: 1,
    fontFamily: "Helvetica-Bold",
  },
});

export type OrderLabelData = {
  orderNumber: string;
  customerName: string | null;
  partSummary: string | null;
  dueDate: string | null;
  intakeDate: string | null;
  qrCodeDataUrl: string;
};

function labelText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "fehlt";
}

function dateText(value: string | null): string {
  if (typeof value !== "string") return "fehlt";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return "fehlt";
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "fehlt";
  return `${dayText}.${monthText}.${yearText}`;
}

export function OrderLabelDocument({ data }: { data: OrderLabelData }) {
  return (
    <Document title={`Laufzettel ${labelText(data.orderNumber)}`}>
      <Page size={[LABEL_WIDTH, LABEL_HEIGHT]} style={styles.page}>
        <View style={styles.qrColumn}>
          <PdfImage src={data.qrCodeDataUrl} style={styles.qr} />
          <Text style={styles.qrCaption}>{`KREILE:${labelText(data.orderNumber)}`}</Text>
        </View>
        <View style={styles.details}>
          <View style={styles.field}>
            <Text style={styles.label}>Auftrag</Text>
            <Text style={styles.orderNumber}>{labelText(data.orderNumber)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Kunde</Text>
            <Text style={styles.value}>{labelText(data.customerName)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Anzahl Teile</Text>
            <Text style={styles.value}>{labelText(data.partSummary)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Liefertermin</Text>
            <Text style={styles.value}>{dateText(data.dueDate)}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Eingangsdatum</Text>
            <Text style={styles.value}>{dateText(data.intakeDate)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function createOrderLabelPdfDocument(data: OrderLabelData): ReactElement<DocumentProps> {
  return <OrderLabelDocument data={data} />;
}
