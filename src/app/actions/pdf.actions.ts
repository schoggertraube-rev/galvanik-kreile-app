"use server";

import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { OrderLabelDocument } from "@/lib/pdf/OrderLabel";
import { DeliveryNoteDocument } from "@/lib/pdf/DeliveryNote";
import { DocumentProps } from "@react-pdf/renderer";
import { Order } from "@/lib/repositories/ordersRepository";
import { Customer } from "@/lib/repositories/customersRepository";
import { companySettingsRepository } from "@/lib/repositories/companySettingsRepository";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function generateOrderLabel(orderIds: string | string[]) {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (ids.length === 0) throw new Error("Keine Aufträge ausgewählt.");

  // Fetch all orders
  const allOrders = (await ordersRepository.getAll()) as Order[];
  const targetOrders = allOrders.filter(o => ids.includes(o.id));

  if (targetOrders.length === 0) throw new Error("Aufträge nicht gefunden.");

  // Fetch all customers for names
  const allCustomers = (await customersRepository.getAll()) as Customer[];
  const customerMap = new Map<string, string>(allCustomers.map(c => [c.id, c.name]));

  const pdfData = [];
  for (const o of targetOrders) {
    const link = `https://app.kreile.local/orders/${o.id}`;
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 150 });
    const cName = (o.customerId && customerMap.get(o.customerId)) || o.customerName || "Unbekannt";
    pdfData.push({ order: o, customerName: cName, qrCodeBase64: qr });
  }

  const settings = await companySettingsRepository.getSettings();

  const pdfStream = await renderToStream(
    React.createElement(OrderLabelDocument, { data: pdfData, settings }) as unknown as React.ReactElement<DocumentProps>
  );

  const pdfBuffer = await streamToBuffer(pdfStream);
  return pdfBuffer.toString("base64");
}

export async function generateDeliveryNote(orderIds: string | string[]) {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  if (ids.length === 0) throw new Error("Keine Aufträge ausgewählt.");

  const allOrders = (await ordersRepository.getAll()) as Order[];
  const targetOrders = allOrders.filter(o => ids.includes(o.id));

  if (targetOrders.length === 0) throw new Error("Aufträge nicht gefunden.");

  const customerId = targetOrders[0].customerId;
  const allCustomers = (await customersRepository.getAll()) as Customer[];
  const customer = allCustomers.find(c => c.id === customerId);

  if (!customer) throw new Error("Kunde zum Auftrag nicht gefunden.");

  // Mock logo base64 (usually read from public folder)
  // const logoPath = path.join(process.cwd(), "public", "logo.png");
  // const logoBase64 = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : undefined;
  
  const settings = await companySettingsRepository.getSettings();

  const pdfStream = await renderToStream(
    React.createElement(DeliveryNoteDocument, { orders: targetOrders, customer: customer, settings }) as unknown as React.ReactElement<DocumentProps>
  );
  
  const pdfBuffer = await streamToBuffer(pdfStream);
  return pdfBuffer.toString("base64");
}
