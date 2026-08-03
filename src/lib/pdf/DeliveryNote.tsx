import React from "react";
import { Page, Text, View, Document, StyleSheet, Image } from "@react-pdf/renderer";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { Customer } from "@/lib/repositories/customersRepository";
import type { CompanySettings } from "@/lib/repositories/companySettingsRepository";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 120,
    height: 40,
    backgroundColor: "#EEEEEE",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666666",
  },
  companyInfo: {
    fontSize: 9,
    color: "#666666",
    textAlign: "right",
    lineHeight: 1.4,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  customerBox: {
    marginBottom: 30,
    lineHeight: 1.5,
  },
  customerText: {
    fontSize: 10,
  },
  customerName: {
    fontSize: 12,
    fontWeight: "bold",
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: "#DDDDDD",
    marginBottom: 30,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableColHeader: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    backgroundColor: "#F8F8F8",
    padding: 5,
  },
  tableCol: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
  },
  tableColDescHeader: {
    width: "50%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    backgroundColor: "#F8F8F8",
    padding: 5,
  },
  tableColDesc: {
    width: "50%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#DDDDDD",
    padding: 5,
  },
  tableCellHeader: {
    margin: 2,
    fontSize: 9,
    fontWeight: "bold",
  },
  tableCell: {
    margin: 2,
    fontSize: 9,
  },
  signatureBox: {
    marginTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLine: {
    width: 200,
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingTop: 5,
  },
  signatureText: {
    fontSize: 9,
    color: "#666666",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 10,
  }
});

interface DeliveryNoteProps {
  orders: Order[];
  customer: Customer;
  settings: CompanySettings;
}

export const DeliveryNoteDocument = ({ orders, customer, settings }: DeliveryNoteProps) => {
  const currentDate = format(new Date(), "dd.MM.yyyy");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {settings.logoUrl && !settings.logoUrl.endsWith(".svg") ? (
            <Image src={settings.logoUrl} style={{ width: 120, objectFit: "contain" }} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{settings.companyName.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.companyInfo}>
            <Text style={{ fontWeight: "bold", color: "#000000" }}>{settings.companyName}</Text>
            <Text>{settings.street}</Text>
            <Text>{settings.zip} {settings.city}</Text>
            <Text>Tel: {settings.phone}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.documentTitle}>Lieferschein</Text>

        {/* Customer & Date */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
          <View style={styles.customerBox}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerText}>{customer.address}</Text>
            <Text style={styles.customerText}>{customer.city}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>Datum:</Text>
            <Text style={{ fontSize: 10 }}>{currentDate}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Auftrag</Text>
            </View>
            <View style={styles.tableColDescHeader}>
              <Text style={styles.tableCellHeader}>Beschreibung</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>Anzahl Teile</Text>
            </View>
          </View>
          
          {/* Table Rows */}
          {orders.map((order, i) => (
            <View style={styles.tableRow} key={order.id}>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{order.orderNumber}</Text>
              </View>
              <View style={styles.tableColDesc}>
                <Text style={{ ...styles.tableCell, fontWeight: "bold" }}>{order.task || order.title}</Text>
                {order.parts?.map((p: Record<string, unknown>, idx: number) => (
                  <Text key={idx} style={{ fontSize: 8, color: "#666", margin: "2 2 0 2" }}>
                    - {String(p.quantity ?? "")}x {String(p.name ?? "")} ({String(p.material ?? "")}, {String(p.surfaceRequested || p.finish || "")})
                  </Text>
                ))}
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{order.parts?.reduce((sum: number, p: Record<string, unknown>) => sum + (Number(p.quantity) || 0), 0) || 0} Stk.</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={styles.signatureBox}>
          <View>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Übergabe ({settings.companyName})</Text>
          </View>
          <View>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>Übernahme ({customer.name})</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{settings.companyName} • {settings.street} • {settings.zip} {settings.city} • USt-IdNr.: {settings.taxId}</Text>
          <Text>Gerichtsstand ist {settings.city}. Es gelten unsere Allgemeinen Geschäftsbedingungen.</Text>
        </View>
      </Page>
    </Document>
  );
};
