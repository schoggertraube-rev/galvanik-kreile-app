
export interface MockPart {
  id: string;
  name: string;
  material: string;
  finish: string;
  location: string;
  hours: string;
  actualHours?: string;
  condition?: string;
  quantity?: number;
  surfaceRequested?: string;
  station: "wareneingang" | "entmetallisierung" | "schleiferei" | "beschichtung" | "warenausgang" | string;
  status: string;
}

export interface MockOrder {
  id: string;
  orderNumber: string;
  task: string;
  customerName: string;
  customerId: string;
  intakeDate: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
  station: "wareneingang" | "entmetallisierung" | "schleiferei" | "beschichtung" | "warenausgang" | string;
  currentStationId?: string;
  risk: "green" | "yellow" | "orange" | "red" | "blocked" | string;
  status?: string;
  statusText: string;
  delayReason?: string;
  recommendedAction?: string;
  parts: MockPart[];
  priceAgreements?: { id: string; scope: string; rate: string; date: string }[];
  feedbacks?: { id: string; date: string; type: "positive" | "negative" | "neutral"; text: string }[];
}

export interface MockCustomer {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  prefComm: "E-Mail" | "Telefon" | "Brief / Post" | string;
  risk: "Niedrig" | "Mittel" | "Hoch" | string;
  riskNote?: string;
  notes: string;
  priceAgreements: { id: string; scope: string; rate: string; date: string }[];
  orders: {
    id: string;
    orderNumber: string;
    task: string;
    intakeDate: string;
    dueDate: string;
    status: string;
    statusText: string;
    parts: { id: string; name: string; material: string; finish: string; location: string }[];
  }[];
  feedbacks: { id: string; date: string; type: "positive" | "negative" | "neutral"; text: string }[];
}

export const INITIAL_ORDERS: MockOrder[] = [
  {
    "id": "ord_1",
    "orderNumber": "A-2026-0100",
    "task": "Stoßstange Mercedes 280SE bearbeiten",
    "customerName": "Museum Lenzburg",
    "customerId": "inst_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "wareneingang",
    "currentStationId": "wareneingang",
    "risk": "red",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_0_1",
        "name": "Stoßstange Mercedes 280SE",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "wareneingang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_2",
    "orderNumber": "A-2026-0101",
    "task": "Türgriff Holztür bearbeiten",
    "customerName": "Pfarrei St. Martin Steyr",
    "customerId": "inst_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "entmetallisierung",
    "currentStationId": "entmetallisierung",
    "risk": "orange",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_1_1",
        "name": "Türgriff Holztür",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "entmetallisierung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_3",
    "orderNumber": "A-2026-0102",
    "task": "Leuchter Pfarrei bearbeiten",
    "customerName": "Oldtimer-Sammler-Verein Westschweiz",
    "customerId": "inst_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "schleiferei",
    "currentStationId": "schleiferei",
    "risk": "red",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_2_1",
        "name": "Leuchter Pfarrei",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "schleiferei",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_4",
    "orderNumber": "A-2026-0103",
    "task": "Bremshebel Motorrad bearbeiten",
    "customerName": "Möbelmanufaktur Hartl",
    "customerId": "bus_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "beschichtung",
    "currentStationId": "beschichtung",
    "risk": "orange",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_3_1",
        "name": "Bremshebel Motorrad",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "beschichtung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_5",
    "orderNumber": "A-2026-0104",
    "task": "Schaltknauf Porsche 911 bearbeiten",
    "customerName": "Restaurant Goldener Anker",
    "customerId": "bus_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "warenausgang",
    "currentStationId": "warenausgang",
    "risk": "red",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_4_1",
        "name": "Schaltknauf Porsche 911",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "warenausgang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_6",
    "orderNumber": "A-2026-0105",
    "task": "Fensterbeschlag Jugendstil bearbeiten",
    "customerName": "Autohaus Sieber",
    "customerId": "bus_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "wareneingang",
    "currentStationId": "wareneingang",
    "risk": "orange",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_5_1",
        "name": "Fensterbeschlag Jugendstil",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "wareneingang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_7",
    "orderNumber": "A-2026-0106",
    "task": "Lampenfuß Empire bearbeiten",
    "customerName": "Schreinerei Bürkle",
    "customerId": "bus_4",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "entmetallisierung",
    "currentStationId": "entmetallisierung",
    "risk": "red",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_6_1",
        "name": "Lampenfuß Empire",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "entmetallisierung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_8",
    "orderNumber": "A-2026-0107",
    "task": "Wasserhahn historisch bearbeiten",
    "customerName": "Müller",
    "customerId": "priv_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-11T10:00:00Z",
    "dueLabel": "Überfällig seit",
    "dueValue": "2 Tagen",
    "station": "schleiferei",
    "currentStationId": "schleiferei",
    "risk": "orange",
    "status": "active",
    "statusText": "Kritisch",
    "parts": [
      {
        "id": "part_7_1",
        "name": "Wasserhahn historisch",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "schleiferei",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_9",
    "orderNumber": "A-2026-0108",
    "task": "Kerzenleuchter Bronze bearbeiten",
    "customerName": "Schmid",
    "customerId": "priv_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "beschichtung",
    "currentStationId": "beschichtung",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_8_1",
        "name": "Kerzenleuchter Bronze",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "beschichtung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_10",
    "orderNumber": "A-2026-0109",
    "task": "Beschlag Sekretär bearbeiten",
    "customerName": "Fischer",
    "customerId": "priv_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "warenausgang",
    "currentStationId": "warenausgang",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_9_1",
        "name": "Beschlag Sekretär",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "warenausgang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_11",
    "orderNumber": "A-2026-0110",
    "task": "Stoßstange Mercedes 280SE bearbeiten",
    "customerName": "Bauer",
    "customerId": "priv_4",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "wareneingang",
    "currentStationId": "wareneingang",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_10_1",
        "name": "Stoßstange Mercedes 280SE",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "wareneingang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_12",
    "orderNumber": "A-2026-0111",
    "task": "Türgriff Holztür bearbeiten",
    "customerName": "Wagner",
    "customerId": "priv_5",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "entmetallisierung",
    "currentStationId": "entmetallisierung",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_11_1",
        "name": "Türgriff Holztür",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "entmetallisierung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_13",
    "orderNumber": "A-2026-0112",
    "task": "Leuchter Pfarrei bearbeiten",
    "customerName": "Museum Lenzburg",
    "customerId": "inst_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "schleiferei",
    "currentStationId": "schleiferei",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_12_1",
        "name": "Leuchter Pfarrei",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "schleiferei",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_14",
    "orderNumber": "A-2026-0113",
    "task": "Bremshebel Motorrad bearbeiten",
    "customerName": "Pfarrei St. Martin Steyr",
    "customerId": "inst_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "beschichtung",
    "currentStationId": "beschichtung",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_13_1",
        "name": "Bremshebel Motorrad",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "beschichtung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_15",
    "orderNumber": "A-2026-0114",
    "task": "Schaltknauf Porsche 911 bearbeiten",
    "customerName": "Oldtimer-Sammler-Verein Westschweiz",
    "customerId": "inst_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "warenausgang",
    "currentStationId": "warenausgang",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_14_1",
        "name": "Schaltknauf Porsche 911",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "warenausgang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_16",
    "orderNumber": "A-2026-0115",
    "task": "Fensterbeschlag Jugendstil bearbeiten",
    "customerName": "Möbelmanufaktur Hartl",
    "customerId": "bus_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "wareneingang",
    "currentStationId": "wareneingang",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_15_1",
        "name": "Fensterbeschlag Jugendstil",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "wareneingang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_17",
    "orderNumber": "A-2026-0116",
    "task": "Lampenfuß Empire bearbeiten",
    "customerName": "Restaurant Goldener Anker",
    "customerId": "bus_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "entmetallisierung",
    "currentStationId": "entmetallisierung",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_16_1",
        "name": "Lampenfuß Empire",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "entmetallisierung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_18",
    "orderNumber": "A-2026-0117",
    "task": "Wasserhahn historisch bearbeiten",
    "customerName": "Autohaus Sieber",
    "customerId": "bus_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "schleiferei",
    "currentStationId": "schleiferei",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_17_1",
        "name": "Wasserhahn historisch",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "schleiferei",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_19",
    "orderNumber": "A-2026-0118",
    "task": "Kerzenleuchter Bronze bearbeiten",
    "customerName": "Schreinerei Bürkle",
    "customerId": "bus_4",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "beschichtung",
    "currentStationId": "beschichtung",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_18_1",
        "name": "Kerzenleuchter Bronze",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "beschichtung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_20",
    "orderNumber": "A-2026-0119",
    "task": "Beschlag Sekretär bearbeiten",
    "customerName": "Müller",
    "customerId": "priv_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "warenausgang",
    "currentStationId": "warenausgang",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_19_1",
        "name": "Beschlag Sekretär",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "warenausgang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_21",
    "orderNumber": "A-2026-0120",
    "task": "Stoßstange Mercedes 280SE bearbeiten",
    "customerName": "Schmid",
    "customerId": "priv_2",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "wareneingang",
    "currentStationId": "wareneingang",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_20_1",
        "name": "Stoßstange Mercedes 280SE",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "wareneingang",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_22",
    "orderNumber": "A-2026-0121",
    "task": "Türgriff Holztür bearbeiten",
    "customerName": "Fischer",
    "customerId": "priv_3",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "entmetallisierung",
    "currentStationId": "entmetallisierung",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_21_1",
        "name": "Türgriff Holztür",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "entmetallisierung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_23",
    "orderNumber": "A-2026-0122",
    "task": "Leuchter Pfarrei bearbeiten",
    "customerName": "Bauer",
    "customerId": "priv_4",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "schleiferei",
    "currentStationId": "schleiferei",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_22_1",
        "name": "Leuchter Pfarrei",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "schleiferei",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_24",
    "orderNumber": "A-2026-0123",
    "task": "Bremshebel Motorrad bearbeiten",
    "customerName": "Wagner",
    "customerId": "priv_5",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "beschichtung",
    "currentStationId": "beschichtung",
    "risk": "green",
    "status": "active",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_23_1",
        "name": "Bremshebel Motorrad",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "beschichtung",
        "status": "In Bearbeitung"
      }
    ]
  },
  {
    "id": "ord_25",
    "orderNumber": "A-2026-0124",
    "task": "Schaltknauf Porsche 911 bearbeiten",
    "customerName": "Museum Lenzburg",
    "customerId": "inst_1",
    "intakeDate": "2026-05-10T10:00:00Z",
    "dueDate": "2026-05-30T10:00:00Z",
    "dueLabel": "Fällig am",
    "dueValue": "30.05.2026",
    "station": "warenausgang",
    "currentStationId": "warenausgang",
    "risk": "green",
    "status": "waiting",
    "statusText": "Im Plan",
    "parts": [
      {
        "id": "part_24_1",
        "name": "Schaltknauf Porsche 911",
        "material": "Messing",
        "finish": "Glanz",
        "location": "Regal 1",
        "hours": "2h",
        "station": "warenausgang",
        "status": "In Bearbeitung"
      }
    ]
  }
];
export const INITIAL_CUSTOMERS: MockCustomer[] = [
  {
    "id": "inst_1",
    "name": "Museum Lenzburg",
    "type": "Institution",
    "city": "Lenzburg",
    "address": "Schlossgasse 1",
    "phone": "062 111 22 33",
    "email": "info@museum-lenzburg.ch",
    "prefComm": "E-Mail",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_0",
        "scope": "Rahmenvertrag 0",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_1",
        "orderNumber": "A-2026-0100",
        "task": "Stoßstange Mercedes 280SE bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_0_1",
            "name": "Stoßstange Mercedes 280SE",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_13",
        "orderNumber": "A-2026-0112",
        "task": "Leuchter Pfarrei bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_12_1",
            "name": "Leuchter Pfarrei",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_25",
        "orderNumber": "A-2026-0124",
        "task": "Schaltknauf Porsche 911 bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_24_1",
            "name": "Schaltknauf Porsche 911",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "inst_2",
    "name": "Pfarrei St. Martin Steyr",
    "type": "Institution",
    "city": "Steyr",
    "address": "Stadtplatz 41",
    "phone": "07252 444",
    "email": "pfarramt@st-martin-steyr.at",
    "prefComm": "Telefon",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_1",
        "scope": "Rahmenvertrag 1",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_2",
        "orderNumber": "A-2026-0101",
        "task": "Türgriff Holztür bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_1_1",
            "name": "Türgriff Holztür",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_14",
        "orderNumber": "A-2026-0113",
        "task": "Bremshebel Motorrad bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_13_1",
            "name": "Bremshebel Motorrad",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "inst_3",
    "name": "Oldtimer-Sammler-Verein Westschweiz",
    "type": "Institution",
    "city": "Lausanne",
    "address": "Rue du Lac 5",
    "phone": "021 555 66",
    "email": "contact@osvw.ch",
    "prefComm": "E-Mail",
    "risk": "Mittel",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_2",
        "scope": "Rahmenvertrag 2",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_3",
        "orderNumber": "A-2026-0102",
        "task": "Leuchter Pfarrei bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_2_1",
            "name": "Leuchter Pfarrei",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_15",
        "orderNumber": "A-2026-0114",
        "task": "Schaltknauf Porsche 911 bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_14_1",
            "name": "Schaltknauf Porsche 911",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "bus_1",
    "name": "Möbelmanufaktur Hartl",
    "type": "Geschäftskunde",
    "city": "München",
    "address": "Holzweg 12",
    "phone": "089 123456",
    "email": "kontakt@hartl-moebel.de",
    "prefComm": "E-Mail",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_3",
        "scope": "Rahmenvertrag 3",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_4",
        "orderNumber": "A-2026-0103",
        "task": "Bremshebel Motorrad bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_3_1",
            "name": "Bremshebel Motorrad",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_16",
        "orderNumber": "A-2026-0115",
        "task": "Fensterbeschlag Jugendstil bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_15_1",
            "name": "Fensterbeschlag Jugendstil",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "bus_2",
    "name": "Restaurant Goldener Anker",
    "type": "Geschäftskunde",
    "city": "Hamburg",
    "address": "Hafenstr 4",
    "phone": "040 98765",
    "email": "info@goldener-anker.de",
    "prefComm": "Telefon",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_4",
        "scope": "Rahmenvertrag 4",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_5",
        "orderNumber": "A-2026-0104",
        "task": "Schaltknauf Porsche 911 bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_4_1",
            "name": "Schaltknauf Porsche 911",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_17",
        "orderNumber": "A-2026-0116",
        "task": "Lampenfuß Empire bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_16_1",
            "name": "Lampenfuß Empire",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "bus_3",
    "name": "Autohaus Sieber",
    "type": "Geschäftskunde",
    "city": "Stuttgart",
    "address": "Benzstr 9",
    "phone": "0711 234567",
    "email": "werkstatt@sieber-auto.de",
    "prefComm": "E-Mail",
    "risk": "Mittel",
    "notes": "Stammkunde",
    "priceAgreements": [
      {
        "id": "pa_5",
        "scope": "Rahmenvertrag 5",
        "rate": "15% Rabatt",
        "date": "2026-01-01"
      }
    ],
    "orders": [
      {
        "id": "ord_6",
        "orderNumber": "A-2026-0105",
        "task": "Fensterbeschlag Jugendstil bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_5_1",
            "name": "Fensterbeschlag Jugendstil",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_18",
        "orderNumber": "A-2026-0117",
        "task": "Wasserhahn historisch bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_17_1",
            "name": "Wasserhahn historisch",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "bus_4",
    "name": "Schreinerei Bürkle",
    "type": "Geschäftskunde",
    "city": "Freiburg",
    "address": "Waldstr 1",
    "phone": "0761 345678",
    "email": "info@schreinerei-buerkle.de",
    "prefComm": "Telefon",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_7",
        "orderNumber": "A-2026-0106",
        "task": "Lampenfuß Empire bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_6_1",
            "name": "Lampenfuß Empire",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_19",
        "orderNumber": "A-2026-0118",
        "task": "Kerzenleuchter Bronze bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_18_1",
            "name": "Kerzenleuchter Bronze",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "priv_1",
    "name": "Müller",
    "type": "Privatkunde",
    "city": "Berlin",
    "address": "Hauptstr 1",
    "phone": "030 111222",
    "email": "mueller@example.com",
    "prefComm": "E-Mail",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_8",
        "orderNumber": "A-2026-0107",
        "task": "Wasserhahn historisch bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-11T10:00:00Z",
        "status": "active",
        "statusText": "Kritisch",
        "parts": [
          {
            "id": "part_7_1",
            "name": "Wasserhahn historisch",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_20",
        "orderNumber": "A-2026-0119",
        "task": "Beschlag Sekretär bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_19_1",
            "name": "Beschlag Sekretär",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "priv_2",
    "name": "Schmid",
    "type": "Privatkunde",
    "city": "Frankfurt",
    "address": "Zeil 10",
    "phone": "069 333444",
    "email": "schmid@example.com",
    "prefComm": "Telefon",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_9",
        "orderNumber": "A-2026-0108",
        "task": "Kerzenleuchter Bronze bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_8_1",
            "name": "Kerzenleuchter Bronze",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_21",
        "orderNumber": "A-2026-0120",
        "task": "Stoßstange Mercedes 280SE bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_20_1",
            "name": "Stoßstange Mercedes 280SE",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "priv_3",
    "name": "Fischer",
    "type": "Privatkunde",
    "city": "Köln",
    "address": "Rheinpromenade 5",
    "phone": "0221 555666",
    "email": "fischer@example.com",
    "prefComm": "E-Mail",
    "risk": "Mittel",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_10",
        "orderNumber": "A-2026-0109",
        "task": "Beschlag Sekretär bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_9_1",
            "name": "Beschlag Sekretär",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_22",
        "orderNumber": "A-2026-0121",
        "task": "Türgriff Holztür bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "waiting",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_21_1",
            "name": "Türgriff Holztür",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "priv_4",
    "name": "Bauer",
    "type": "Privatkunde",
    "city": "Nürnberg",
    "address": "Burgweg 2",
    "phone": "0911 777888",
    "email": "bauer@example.com",
    "prefComm": "E-Mail",
    "risk": "Niedrig",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_11",
        "orderNumber": "A-2026-0110",
        "task": "Stoßstange Mercedes 280SE bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_10_1",
            "name": "Stoßstange Mercedes 280SE",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_23",
        "orderNumber": "A-2026-0122",
        "task": "Leuchter Pfarrei bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_22_1",
            "name": "Leuchter Pfarrei",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  },
  {
    "id": "priv_5",
    "name": "Wagner",
    "type": "Privatkunde",
    "city": "Leipzig",
    "address": "Markt 3",
    "phone": "0341 999000",
    "email": "wagner@example.com",
    "prefComm": "Brief / Post",
    "risk": "Hoch",
    "notes": "Stammkunde",
    "priceAgreements": [],
    "orders": [
      {
        "id": "ord_12",
        "orderNumber": "A-2026-0111",
        "task": "Türgriff Holztür bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_11_1",
            "name": "Türgriff Holztür",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      },
      {
        "id": "ord_24",
        "orderNumber": "A-2026-0123",
        "task": "Bremshebel Motorrad bearbeiten",
        "intakeDate": "2026-05-10T10:00:00Z",
        "dueDate": "2026-05-30T10:00:00Z",
        "status": "active",
        "statusText": "Im Plan",
        "parts": [
          {
            "id": "part_23_1",
            "name": "Bremshebel Motorrad",
            "material": "Messing",
            "finish": "Glanz",
            "location": "Regal 1"
          }
        ]
      }
    ],
    "feedbacks": []
  }
];

export const INITIAL_INVENTORY = [
  {
    "id": "inv_1",
    "name": "Glanznickel",
    "unit": "Liter",
    "minStock": 50,
    "currentStock": 45,
    "pricePerUnit": 120.5
  },
  {
    "id": "inv_2",
    "name": "Kupferzyanid",
    "unit": "kg",
    "minStock": 20,
    "currentStock": 35,
    "pricePerUnit": 45
  },
  {
    "id": "inv_3",
    "name": "Schwefelsäure",
    "unit": "Liter",
    "minStock": 100,
    "currentStock": 120,
    "pricePerUnit": 8.5
  },
  {
    "id": "inv_4",
    "name": "Glanzzusatz Chrom",
    "unit": "Liter",
    "minStock": 10,
    "currentStock": 8,
    "pricePerUnit": 250
  },
  {
    "id": "inv_5",
    "name": "Polierpaste Vorpolitur",
    "unit": "kg",
    "minStock": 30,
    "currentStock": 15,
    "pricePerUnit": 22
  },
  {
    "id": "inv_6",
    "name": "Polierpaste Hochglanz",
    "unit": "kg",
    "minStock": 30,
    "currentStock": 40,
    "pricePerUnit": 35.5
  },
  {
    "id": "inv_7",
    "name": "Entfettungssalz",
    "unit": "kg",
    "minStock": 50,
    "currentStock": 80,
    "pricePerUnit": 12
  },
  {
    "id": "inv_8",
    "name": "Aktivator-Säure",
    "unit": "Liter",
    "minStock": 25,
    "currentStock": 20,
    "pricePerUnit": 18
  },
  {
    "id": "inv_9",
    "name": "Goldbad Ansatz",
    "unit": "Liter",
    "minStock": 2,
    "currentStock": 3,
    "pricePerUnit": 1450
  },
  {
    "id": "inv_10",
    "name": "Silberbad Ansatz",
    "unit": "Liter",
    "minStock": 5,
    "currentStock": 5,
    "pricePerUnit": 320
  }
];
export const INITIAL_MOVEMENTS = [
  {
    "id": "mov_0",
    "inventoryItemId": "inv_1",
    "type": "IN",
    "amount": 2,
    "date": "2026-05-01T08:00:00Z"
  },
  {
    "id": "mov_1",
    "inventoryItemId": "inv_2",
    "type": "OUT",
    "amount": 7,
    "date": "2026-05-02T08:00:00Z"
  },
  {
    "id": "mov_2",
    "inventoryItemId": "inv_3",
    "type": "OUT",
    "amount": 12,
    "date": "2026-05-03T08:00:00Z"
  },
  {
    "id": "mov_3",
    "inventoryItemId": "inv_4",
    "type": "IN",
    "amount": 17,
    "date": "2026-05-04T08:00:00Z"
  },
  {
    "id": "mov_4",
    "inventoryItemId": "inv_5",
    "type": "OUT",
    "amount": 22,
    "date": "2026-05-05T08:00:00Z"
  },
  {
    "id": "mov_5",
    "inventoryItemId": "inv_6",
    "type": "OUT",
    "amount": 27,
    "date": "2026-05-06T08:00:00Z"
  },
  {
    "id": "mov_6",
    "inventoryItemId": "inv_7",
    "type": "IN",
    "amount": 32,
    "date": "2026-05-07T08:00:00Z"
  },
  {
    "id": "mov_7",
    "inventoryItemId": "inv_8",
    "type": "OUT",
    "amount": 37,
    "date": "2026-05-08T08:00:00Z"
  },
  {
    "id": "mov_8",
    "inventoryItemId": "inv_9",
    "type": "OUT",
    "amount": 42,
    "date": "2026-05-09T08:00:00Z"
  },
  {
    "id": "mov_9",
    "inventoryItemId": "inv_10",
    "type": "IN",
    "amount": 47,
    "date": "2026-05-10T08:00:00Z"
  },
  {
    "id": "mov_10",
    "inventoryItemId": "inv_1",
    "type": "OUT",
    "amount": 52,
    "date": "2026-05-11T08:00:00Z"
  },
  {
    "id": "mov_11",
    "inventoryItemId": "inv_2",
    "type": "OUT",
    "amount": 57,
    "date": "2026-05-12T08:00:00Z"
  },
  {
    "id": "mov_12",
    "inventoryItemId": "inv_3",
    "type": "IN",
    "amount": 62,
    "date": "2026-05-13T08:00:00Z"
  },
  {
    "id": "mov_13",
    "inventoryItemId": "inv_4",
    "type": "OUT",
    "amount": 67,
    "date": "2026-05-14T08:00:00Z"
  },
  {
    "id": "mov_14",
    "inventoryItemId": "inv_5",
    "type": "OUT",
    "amount": 72,
    "date": "2026-05-15T08:00:00Z"
  },
  {
    "id": "mov_15",
    "inventoryItemId": "inv_6",
    "type": "IN",
    "amount": 77,
    "date": "2026-05-16T08:00:00Z"
  },
  {
    "id": "mov_16",
    "inventoryItemId": "inv_7",
    "type": "OUT",
    "amount": 82,
    "date": "2026-05-17T08:00:00Z"
  },
  {
    "id": "mov_17",
    "inventoryItemId": "inv_8",
    "type": "OUT",
    "amount": 87,
    "date": "2026-05-18T08:00:00Z"
  },
  {
    "id": "mov_18",
    "inventoryItemId": "inv_9",
    "type": "IN",
    "amount": 92,
    "date": "2026-05-19T08:00:00Z"
  },
  {
    "id": "mov_19",
    "inventoryItemId": "inv_10",
    "type": "OUT",
    "amount": 97,
    "date": "2026-05-20T08:00:00Z"
  }
];
export const INITIAL_BATHS = [
  {
    "id": "bath_1",
    "name": "Nickelbad 1",
    "processType": "nickel"
  },
  {
    "id": "bath_2",
    "name": "Chrombad 1",
    "processType": "chrome"
  },
  {
    "id": "bath_3",
    "name": "Entfettung 1",
    "processType": "cleaning"
  },
  {
    "id": "bath_4",
    "name": "Entmetallisierung 1",
    "processType": "stripping"
  }
];
export const INITIAL_MEASUREMENTS = [
  {
    "id": "meas_0_0",
    "bathId": "bath_1",
    "phValue": 4,
    "temperature": 50,
    "measuredAt": "2026-05-10T08:00:00Z"
  },
  {
    "id": "meas_0_1",
    "bathId": "bath_1",
    "phValue": 4.1,
    "temperature": 51,
    "measuredAt": "2026-05-11T08:00:00Z"
  },
  {
    "id": "meas_0_2",
    "bathId": "bath_1",
    "phValue": 4.2,
    "temperature": 52,
    "measuredAt": "2026-05-12T08:00:00Z"
  },
  {
    "id": "meas_1_0",
    "bathId": "bath_2",
    "phValue": 4,
    "temperature": 50,
    "measuredAt": "2026-05-10T08:00:00Z"
  },
  {
    "id": "meas_1_1",
    "bathId": "bath_2",
    "phValue": 4.1,
    "temperature": 51,
    "measuredAt": "2026-05-11T08:00:00Z"
  },
  {
    "id": "meas_1_2",
    "bathId": "bath_2",
    "phValue": 4.2,
    "temperature": 52,
    "measuredAt": "2026-05-12T08:00:00Z"
  },
  {
    "id": "meas_2_0",
    "bathId": "bath_3",
    "phValue": 4,
    "temperature": 50,
    "measuredAt": "2026-05-10T08:00:00Z"
  },
  {
    "id": "meas_2_1",
    "bathId": "bath_3",
    "phValue": 4.1,
    "temperature": 51,
    "measuredAt": "2026-05-11T08:00:00Z"
  },
  {
    "id": "meas_2_2",
    "bathId": "bath_3",
    "phValue": 4.2,
    "temperature": 52,
    "measuredAt": "2026-05-12T08:00:00Z"
  },
  {
    "id": "meas_3_0",
    "bathId": "bath_4",
    "phValue": 4,
    "temperature": 50,
    "measuredAt": "2026-05-10T08:00:00Z"
  },
  {
    "id": "meas_3_1",
    "bathId": "bath_4",
    "phValue": 4.1,
    "temperature": 51,
    "measuredAt": "2026-05-11T08:00:00Z"
  },
  {
    "id": "meas_3_2",
    "bathId": "bath_4",
    "phValue": 4.2,
    "temperature": 52,
    "measuredAt": "2026-05-12T08:00:00Z"
  }
];
export const INITIAL_PRICE_AGREEMENTS = [
  {
    "id": "pa_0",
    "customerId": "inst_1",
    "scope": "Rahmenvertrag 0",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  },
  {
    "id": "pa_1",
    "customerId": "inst_2",
    "scope": "Rahmenvertrag 1",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  },
  {
    "id": "pa_2",
    "customerId": "inst_3",
    "scope": "Rahmenvertrag 2",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  },
  {
    "id": "pa_3",
    "customerId": "bus_1",
    "scope": "Rahmenvertrag 3",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  },
  {
    "id": "pa_4",
    "customerId": "bus_2",
    "scope": "Rahmenvertrag 4",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  },
  {
    "id": "pa_5",
    "customerId": "bus_3",
    "scope": "Rahmenvertrag 5",
    "rate": "15% Rabatt",
    "date": "2026-01-01"
  }
];
export const INITIAL_COMPLAINTS = [
  {
    "id": "comp_0",
    "customerId": "inst_1",
    "orderId": "ord_1",
    "reason": "Fehlstellen in Beschichtung",
    "description": "Kunde meldet Poren",
    "createdAt": "2026-05-15T10:00:00Z",
    "status": "Offen"
  },
  {
    "id": "comp_1",
    "customerId": "inst_2",
    "orderId": "ord_2",
    "reason": "Fehlstellen in Beschichtung",
    "description": "Kunde meldet Poren",
    "createdAt": "2026-05-15T10:00:00Z",
    "status": "Offen"
  },
  {
    "id": "comp_2",
    "customerId": "inst_3",
    "orderId": "ord_3",
    "reason": "Fehlstellen in Beschichtung",
    "description": "Kunde meldet Poren",
    "createdAt": "2026-05-15T10:00:00Z",
    "status": "Offen"
  }
];
export const INITIAL_SCAN_LOG = [
  { id: "log-1", time: "08:15", type: "scan", desc: "Zylinderblock (T-004) erfasst", status: "success" },
  { id: "log-2", time: "08:22", type: "match", desc: "Kunde K-004 zugeordnet", status: "success" }
];

export const MOCK_REQUESTS = [
  {
    id: "q1",
    customerName: "Rosa Schneider",
    customerId: "K-000131",
    subject: "Vespa V50 Lampenmaske – Verchromung",
    description: "Hallo, ich möchte die Lampenmaske meiner Vespa V50 (Baujahr 1968) neu verchromen lassen. Das Teil hat leichte Rostflecken und eine alte Lackschicht. Sehr gerne würde ich ein Angebot erhalten. MfG Rosa Schneider",
    receivedAt: "2026-05-21",
    rustLevel: "Leicht",
    dirtLevel: "Leicht",
    partCount: 1,
    material: "Stahlblech",
    status: "offen",
    pricing: { grundarbeit: 120, reinigung: 20, entmetallisierung: 35, schleifaufwand: 40, badchemie: 25, risikopuffer: 15, marge: 30 },
  },
  {
    id: "q2",
    customerName: "Atelier Schmid",
    customerId: "K-000125",
    subject: "BMW R75 Motorradtank – Glanzverchromung",
    description: "Wir haben einen originalen BMW R75 Tank aus den 1940er-Jahren. Der Tank hat Beulen, tiefe Kratzer und Flugrost. Wir benötigen eine vollständige Glanzverchromung inkl. Entlackung und Entmetallisierung. Gibt es Erfahrung mit dieser Epoche?",
    receivedAt: "2026-05-20",
    rustLevel: "Stark",
    dirtLevel: "Stark",
    partCount: 1,
    material: "Stahlblech (Oldtimer)",
    status: "offen",
    pricing: { grundarbeit: 280, reinigung: 60, entmetallisierung: 90, schleifaufwand: 180, badchemie: 70, risikopuffer: 60, marge: 80 },
  },
  {
    id: "q3",
    customerName: "Kirchenverwaltung St. Urban",
    customerId: "K-000132",
    subject: "Historisches Besteck-Set (48-teilig) – Versilberung",
    description: "Wir besitzen ein historiches Silberbesteck (48 Teile, Messing/Alpacca), das für den kirchlichen Einsatz aufgearbeitet werden soll. Der Großteil ist stark oxidiert, einige Stücke haben leichte Dellen. Wir wünschen eine komplette Versilberung (90g/12).",
    receivedAt: "2026-05-19",
    rustLevel: "Mittel",
    dirtLevel: "Stark",
    partCount: 48,
    material: "Messing / Alpacca",
    status: "offen",
    pricing: { grundarbeit: 350, reinigung: 80, entmetallisierung: 120, schleifaufwand: 90, badchemie: 95, risikopuffer: 40, marge: 90 },
  },
];
