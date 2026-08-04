import { createId } from "@paralleldrive/cuid2";

type DemoCustomer = {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
};

type DemoOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  task: string;
  station: string;
  status: string;
  risk: string;
  intakeDate: Date;
  dueDate: Date;
  delayReason: string | null;
  statusText: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
};

type DemoItem = {
  id: string;
  orderId: string;
  customerId: string;
  name: string;
  quantity: number;
  material: string;
  surfaceRequested: string;
  currentStationId: string;
};

type DemoEvent = {
  id: string;
  orderId: string;
  itemId?: string;
  eventType: "received" | "completed";
  description: string;
  createdAt: Date;
};

type DemoComplaint = {
  id: string;
  orderId: string;
  customerId: string;
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
};

type DemoPhoneNote = {
  tenantId: string;
  customerId: string;
  orderId: string | null;
  rawText: string;
  category: string;
  status: string;
  urgency?: string;
  createdAt: Date;
};

// Utility to ensure a clean demo ID
export const demoId = (prefix: string) => `demo_${prefix}_${createId()}`;

export function generateDemoData() {
  const now = new Date();
  
  // Date helpers
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // --- CUSTOMERS ---
  const customers: DemoCustomer[] = [
    {
      id: demoId("cust_schmid"),
      name: "Schmid GmbH",
      type: "business",
      city: "München",
      address: "Musterstr. 1",
      phone: "089-123456",
      email: "info@schmid-gmbh.de",
      notes: "Demo-Kunde (Schmid)",
    },
    {
      id: demoId("cust_schmidt"),
      name: "Schmidt Metallbau",
      type: "business",
      city: "Stuttgart",
      address: "Industrieweg 42",
      phone: "0711-987654",
      email: "kontakt@schmidt-metall.de",
      notes: "Demo-Kunde (Schmidt)",
    },
    {
      id: demoId("cust_schmitt"),
      name: "Schmitt & Söhne",
      type: "business",
      city: "Nürnberg",
      address: "Handwerkerhof 3",
      phone: "0911-555666",
      email: "office@schmitt-soehne.de",
      notes: "Demo-Kunde (Schmitt)",
    },
    {
      id: demoId("cust_mueller"),
      name: "Müller CNC",
      type: "business",
      city: "Augsburg",
      address: "Fuggerstr. 10",
      phone: "0821-112233",
      email: "fertigung@mueller-cnc.de",
      notes: "Demo-Kunde (Müller)",
    },
    {
      id: demoId("cust_mueller_ae"),
      name: "Mueller Industries",
      type: "business",
      city: "Frankfurt",
      address: "Mainzer Landstr. 100",
      phone: "069-445566",
      email: "purchasing@mueller-industries.com",
      notes: "Demo-Kunde (Mueller)",
    },
    {
      id: demoId("cust_atelier_schmid"),
      name: "Atelier Schmid",
      type: "business",
      city: "Berlin",
      address: "Kunstallee 5",
      phone: "030-998877",
      email: "hallo@atelier-schmid.de",
      notes: "Demo-Kunde (Atelier)",
    },
    {
      id: demoId("cust_museum"),
      name: "Museum Lenzburg",
      type: "institution",
      city: "Lenzburg",
      address: "Schlossplatz 1",
      phone: "+41-62-8881122",
      email: "restauration@museum-lenzburg.ch",
      notes: "Demo-Kunde (Museum)",
    },
    {
      id: demoId("cust_kirche"),
      name: "Kirche St. Martin",
      type: "institution",
      city: "Kassel",
      address: "Martinsplatz 1",
      phone: "0561-334455",
      email: "pfarramt@st-martin-kassel.de",
      notes: "Demo-Kunde (Kirche)",
    },
    {
      id: demoId("cust_antik"),
      name: "Antik Galerie Main",
      type: "business",
      city: "Würzburg",
      address: "Alte Mainbrücke 2",
      phone: "0931-223344",
      email: "restaurierung@antik-main.de",
      notes: "Demo-Kunde (Antik Galerie)",
    },
    {
      id: demoId("cust_privat_lenz"),
      name: "Dieter Lenz",
      type: "privat",
      city: "Wiesbaden",
      address: "Kurhausplatz 8",
      phone: "0611-778899",
      email: "dieter.lenz@privat-mail.de",
      notes: "Demo-Kunde (Privat)",
    }
  ];

  // --- ORDERS ---
  const orders: DemoOrder[] = [];
  const items: DemoItem[] = [];
  const events: DemoEvent[] = [];
  const complaints: DemoComplaint[] = [];
  const phoneNotes: DemoPhoneNote[] = [];

  type OrderConfig = {
    orderNumber: string;
    customerId: string;
    title: string;
    task?: string;
    station?: string;
    status?: string;
    risk?: string;
    intakeDate?: Date;
    dueDate?: Date;
    delayReason?: string;
    statusText?: string;
    attachmentUrl?: string;
    itemName?: string;
    itemQty?: number;
    material?: string;
  };

  // Helper to create an order quickly
  const createOrder = (config: OrderConfig) => {
    const oId = demoId(`order_${config.orderNumber}`);
    const order = {
      id: oId,
      orderNumber: config.orderNumber,
      customerId: config.customerId,
      title: config.title,
      task: config.task || "Standard Verzinkung",
      station: config.station || "wareneingang",
      status: config.status || "in_progress",
      risk: config.risk || "green",
      intakeDate: config.intakeDate || daysAgo(2),
      dueDate: config.dueDate || daysAhead(5),
      delayReason: config.delayReason || null,
      statusText: config.statusText || null,
      attachmentUrl: config.attachmentUrl || null,
      createdAt: config.intakeDate || daysAgo(2),
    };
    orders.push(order);

    // Default item
    const iId = demoId(`item_${config.orderNumber}`);
    items.push({
      id: iId,
      orderId: oId,
      customerId: config.customerId,
      name: config.itemName || "Bauteil",
      quantity: config.itemQty || 100,
      material: config.material || "Stahl",
      surfaceRequested: config.task || "Verzinken",
      currentStationId: config.station || "wareneingang",
    });

    // Default Intake Event
    events.push({
      id: demoId(`event_in_${config.orderNumber}`),
      orderId: oId,
      itemId: iId,
      eventType: "received",
      description: "Wareneingang gebucht (Demo)",
      createdAt: order.intakeDate,
    });

    return { orderId: oId, itemId: iId };
  };

  // 1. Grüne, normale Aufträge (Aktiv)
  createOrder({ orderNumber: "DEMO-1001", customerId: customers[0].id, title: "Bleche verzinken", station: "galvanik", status: "in_progress", risk: "green" });
  createOrder({ orderNumber: "DEMO-1002", customerId: customers[1].id, title: "Winkelstücke eloxieren", station: "wareneingang", status: "in_progress", risk: "green" });
  createOrder({ orderNumber: "DEMO-1003", customerId: customers[2].id, title: "Rohre vernickeln", station: "galvanik", status: "in_progress", risk: "green" });
  createOrder({ orderNumber: "DEMO-1004", customerId: customers[3].id, title: "Frästeile verchromen", station: "warenausgang", status: "in_progress", risk: "green" });
  createOrder({ orderNumber: "DEMO-1005", customerId: customers[4].id, title: "Gehäuse pulverbeschichten", station: "wareneingang", status: "in_progress", risk: "green" });

  // 2. Gelbe, gefährdete Aufträge
  createOrder({ orderNumber: "DEMO-2001", customerId: customers[0].id, title: "Eil-Auftrag Bleche", station: "galvanik", status: "in_progress", risk: "yellow", dueDate: daysAhead(1), delayReason: "Badbelegung hoch" });
  createOrder({ orderNumber: "DEMO-2002", customerId: customers[5].id, title: "Kunstobjekt reinigen", station: "vorbehandlung", status: "in_progress", risk: "yellow", dueDate: daysAhead(2) });

  // 3. Rote, kritische / blockierte Aufträge
  createOrder({ orderNumber: "DEMO-3001", customerId: customers[1].id, title: "Träger verzinken", station: "warteschlange", status: "blocked", risk: "red", delayReason: "Materialfehler beim Kunden", dueDate: daysAgo(1), statusText: "Wartet auf Klärung" });
  createOrder({ orderNumber: "DEMO-3002", customerId: customers[3].id, title: "Spezialteile", station: "galvanik", status: "blocked", risk: "red", delayReason: "Badchemie gekippt", dueDate: daysAgo(2) });

  // 4. Reklamationen / Nacharbeit
  const reqOrder = createOrder({ orderNumber: "DEMO-4001", customerId: customers[2].id, title: "Wellen nacharbeiten", station: "vorbehandlung", status: "in_progress", risk: "red", statusText: "Nacharbeit" });
  complaints.push({
    id: demoId("comp_4001"),
    orderId: reqOrder.orderId,
    customerId: customers[2].id,
    reason: "Schichtdicke zu gering",
    description: "Kunde meldet 5µm statt 12µm. Teile müssen neu gemacht werden.",
    status: "open",
    createdAt: daysAgo(1),
  });

  // 5. Abgeschlossene Aufträge (für Historie)
  for (let i = 1; i <= 10; i++) {
    const oId = createOrder({ 
      orderNumber: `DEMO-500${i}`, 
      customerId: customers[i % 5].id, 
      title: `Historischer Auftrag ${i}`, 
      station: "abgeschlossen", 
      status: "completed", 
      risk: "green",
      intakeDate: daysAgo(10 + i),
      dueDate: daysAgo(2 + i),
    }).orderId;

    events.push({
      id: demoId(`event_out_500${i}`),
      orderId: oId,
      eventType: "completed",
      description: "Auftrag erfolgreich abgeschlossen",
      createdAt: daysAgo(2 + i),
    });
  }

  // 6. Wartet auf Freigabe / KV Offen
  createOrder({ orderNumber: "DEMO-6001", customerId: customers[6].id, title: "Rüstungsteile reinigen", station: "wareneingang", status: "pending", risk: "yellow", statusText: "Wartet auf Kundenfreigabe KV" });
  createOrder({ orderNumber: "DEMO-6002", customerId: customers[7].id, title: "Kirchenschmuck polieren", station: "wareneingang", status: "pending", risk: "yellow", statusText: "Wartet auf Material (Goldbad leer)" });
  createOrder({ orderNumber: "DEMO-6003", customerId: customers[8].id, title: "Alte Uhr aufarbeiten", station: "vorbehandlung", status: "pending", risk: "green", statusText: "Wartet auf Kunde bzgl. Detailklärung" });
  createOrder({ orderNumber: "DEMO-6004", customerId: customers[9].id, title: "Felgen verchromen", station: "warenausgang", status: "completed", risk: "green", statusText: "Abholbereit" });

  // 7. Spezialfälle für Telefonnotiz-Matching
  // Unklare Namen
  phoneNotes.push({
    tenantId: "demo-galvanik-kreile",
    customerId: customers[2].id,
    orderId: null,
    rawText: "Hier spricht Schmit. Wo bleiben meine Teile? Es eilt sehr!",
    category: "Rückfrage",
    status: "draft",
    urgency: "Hoch",
    createdAt: daysAgo(0),
  });
  phoneNotes.push({
    tenantId: "demo-galvanik-kreile",
    customerId: customers[3].id,
    orderId: null,
    rawText: "Herr Müller hier. Die Rechnung vom letzten Auftrag stimmt nicht.",
    category: "Buchhaltung",
    status: "draft",
    createdAt: daysAgo(1),
  });

  // Email-Demo mit Anhang
  createOrder({ 
    orderNumber: "DEMO-7001", 
    customerId: customers[8].id, 
    title: "Leuchter vergolden", 
    station: "wareneingang", 
    status: "in_progress", 
    risk: "green",
    attachmentUrl: "https://demo.kreile.de/sample-attachment.jpg",
    statusText: "[DEMO] Auftrag via E-Mail gestern empfangen"
  });

  return { customers, orders, items, events, complaints, phoneNotes };
}
