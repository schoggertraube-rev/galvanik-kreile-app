import React from "react";
import { Page, Text, View, Document, StyleSheet, Image } from "@react-pdf/renderer";
import type { Order } from "@/lib/repositories/ordersRepository";
import { getUrgency } from "@/lib/orders/getUrgency";
import { format } from "date-fns";

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 15,
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 5,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  orderInfoBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "dashed",
    paddingBottom: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  orderNumberLabel: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
  },
  orderTask: {
    fontSize: 12,
    fontWeight: "bold",
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 8,
    marginBottom: 10,
  },
  colHalf: {
    width: "50%",
    marginBottom: 8,
  },
  colFull: {
    width: "100%",
  },
  label: {
    fontSize: 8,
    color: "#666666",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontWeight: "bold",
  },
  urgencyCritical: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#DC2626", // Red
  },
  urgencyWarning: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#D97706", // Orange
  },
  partRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingVertical: 3,
  },
  partText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  partSurface: {
    fontSize: 7,
    backgroundColor: "#EEEEEE",
    padding: 2,
    borderRadius: 2,
  },
  footer: {
    flexDirection: "column",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#000000",
  },
  qrCode: {
    width: 60,
    height: 60,
    marginBottom: 2,
  },
  qrText: {
    fontSize: 7,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  stationText: {
    fontSize: 8,
    color: "#666666",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginTop: 5,
  }
});

import type { CompanySettings } from "@/lib/repositories/companySettingsRepository";

interface OrderLabelData {
  order: Order;
  customerName: string;
  qrCodeBase64: string;
}

interface OrderLabelProps {
  data: OrderLabelData[];
  settings: CompanySettings;
}

export const OrderLabelDocument = ({ data, settings }: OrderLabelProps) => {
  return (
    <Document>
      {data.map(({ order, customerName, qrCodeBase64 }, index) => {
        const urgency = getUrgency(order.dueDate);
        const urgencyStyle = urgency === "kritisch" ? styles.urgencyCritical : urgency === "gefaehrdet" ? styles.urgencyWarning : styles.value;
        
        const createdDate = order.intakeDate ? format(new Date(order.intakeDate), "dd.MM.yyyy") : format(new Date(), "dd.MM.yyyy");
        const dueDate = order.dueDate ? format(new Date(order.dueDate), "dd.MM.yyyy") : "Kein Datum";

        return (
          <Page key={order.id || index} size="A6" style={styles.page}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.headerText}>{settings.companyName.toUpperCase()}</Text>
              <Text style={{ fontSize: 8 }}>A6 ETIKETT</Text>
            </View>

            {/* Order Number & Task */}
            <View style={styles.orderInfoBox}>
              <Text style={styles.orderNumberLabel}>AUFTRAGSNUMMER</Text>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <Text style={styles.orderTask}>{order.task || order.title}</Text>
            </View>

            {/* Details Grid */}
            <View style={styles.gridRow}>
              <View style={styles.colHalf}>
                <Text style={styles.label}>KUNDE</Text>
                <Text style={styles.value}>{customerName}</Text>
              </View>
              <View style={styles.colHalf}>
                <Text style={styles.label}>EINGANGSDATUM</Text>
                <Text style={styles.value}>{createdDate}</Text>
              </View>
              
              <View style={styles.colHalf}>
                <Text style={styles.label}>ZIELDATUM</Text>
                <Text style={urgencyStyle}>{dueDate}</Text>
              </View>

              <View style={styles.colFull}>
                <Text style={styles.label}>BAUTEILE</Text>
                <View>
                  {order.parts?.slice(0, 6).map((p: Record<string, unknown>, i: number) => (
                    <View key={i} style={styles.partRow}>
                      <Text style={styles.partText}>{String(p.quantity ?? "")}x {String(p.name ?? "")}</Text>
                      {Boolean(p.surfaceRequested) && <Text style={styles.partSurface}>{String(p.surfaceRequested)}</Text>}
                    </View>
                  ))}
                  {(order.parts?.length || 0) > 6 && (
                    <Text style={{ fontSize: 7, fontStyle: "italic", color: "#666", marginTop: 2 }}>+ weitere Positionen...</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Footer (QR Code) */}
            <View style={styles.footer}>
              {qrCodeBase64 ? (
                <View style={{ alignItems: "center" }}>
                  <Image src={qrCodeBase64} style={styles.qrCode} />
                  <Text style={styles.qrText}>{order.orderNumber}</Text>
                </View>
              ) : null}
              <Text style={styles.stationText}>Nächste Station: WARENEINGANG</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};
