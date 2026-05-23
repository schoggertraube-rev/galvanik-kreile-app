export interface MockPart {
  id: string;
  name: string;
  material: string;
  finish: string;
  location: string;
  hours: string;
  actualHours?: string;
  condition?: string;
  station: "wareneingang" | "entmetallisierung" | "schleiferei" | "beschichtung" | "warenausgang";
  status: "Neu" | "Warten" | "In Bearbeitung" | "Fertig" | "Zusatzaufwand" | "Nacharbeit";
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
  station: "wareneingang" | "entmetallisierung" | "schleiferei" | "beschichtung" | "warenausgang";
  currentStationId?: string;
  risk: "green" | "yellow" | "orange" | "red" | "blocked";
  status?: "active" | "in_progress" | "completed" | "shipped" | "cancelled" | "waiting";
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
  type: "Privatkunde" | "Geschäftskunde" | "Institution" | string;
  city: string;
  address: string;
  phone: string;
  email: string;
  prefComm: "E-Mail" | "Telefon" | "Brief / Post";
  risk: "Niedrig" | "Mittel" | "Hoch";
  riskNote?: string;
  notes: string;
  priceAgreements: { id: string; scope: string; rate: string; date: string }[];
  orders: {
    id: string;
    orderNumber: string;
    task: string;
    intakeDate: string;
    dueDate: string;
    status: "active" | "done" | "waiting" | "critical";
    statusText: string;
    parts: { id: string; name: string; material: string; finish: string; location: string }[];
  }[];
  feedbacks: { id: string; date: string; type: "positive" | "negative" | "neutral"; text: string }[];
}

// 1. Hand-crafted, realistic Workshop Orders (25 total, exactly 8 critical = red/orange)
export const INITIAL_ORDERS: MockOrder[] = [
  {
    id: "o1",
    orderNumber: "A-2026-0042",
    task: "StoÃŸstangen vernickeln (Opel Rekord C)",
    customerName: "Museum Lenzburg",
    customerId: "K-000124",
    intakeDate: "10.05.2026",
    dueDate: "20.05.2026",
    dueLabel: "ÃœberfÃ¤llig seit",
    dueValue: "3 Stunden",
    station: "schleiferei",
    currentStationId: "schleiferei",
    risk: "red", // 1. CRITICAL
    statusText: "KRITISCH â€“ ÃœBERFÃ„LLIG",
    delayReason: "Sehr tiefe Rostnarben erfordern hohen Schleifaufwand / BadkapazitÃ¤t ausgelastet",
    recommendedAction: "Express-Schaltung galvanisches Kupfer",
    parts: [
      { id: "T-2026-0042-A", name: "StoÃŸstange vorne Opel Rekord C", material: "Stahl", finish: "Vernickelt (Premium-Aufbau)", location: "Regal B-02", hours: "5.5h", actualHours: "4.0h", condition: "Kritisch (Tiefer Rost & Dellen)", station: "schleiferei", status: "Zusatzaufwand" },
      { id: "T-2026-0042-B", name: "StoÃŸstange hinten Opel Rekord C", material: "Stahl", finish: "Vernickelt (Premium-Aufbau)", location: "Regal B-02", hours: "4.0h", actualHours: "2.0h", condition: "Kritisch (Tiefer Rost & Dellen)", station: "schleiferei", status: "Zusatzaufwand" }
    ]
  },
  {
    id: "o2",
    orderNumber: "A-2026-0038",
    task: "Motorradteile Glanzverchromen (BMW R75)",
    customerName: "Atelier Schmid",
    customerId: "K-000125",
    intakeDate: "14.05.2026",
    dueDate: "21.05.2026",
    dueLabel: "FÃ¤llig",
    dueValue: "Morgen",
    station: "beschichtung",
    currentStationId: "beschichtung",
    risk: "orange", // 2. CRITICAL
    statusText: "GEFÃ„HRDET",
    delayReason: "ZusÃ¤tzliche Entlackungsschleife verzÃ¶gert Ablauf",
    recommendedAction: "Schichtzuteilung Schleiferei optimieren",
    parts: [
      { id: "T-2026-0038-A", name: "Kraftstofftank BMW R75 (SeitenflÃ¤chen)", material: "Stahlblech", finish: "Glanzverchromt (Teilmaskiert)", location: "Wagen 04", hours: "6.0h", actualHours: "0.5h", condition: "Mittel (Kratzer & Beulen)", station: "beschichtung", status: "In Bearbeitung" },
      { id: "T-2026-0038-B", name: "AuspuffkrÃ¼mmer links BMW R75", material: "Stahlblech", finish: "Glanzverchromt", location: "Wagen 04", hours: "2.0h", actualHours: "1.8h", condition: "Normaler VerschleiÃŸ", station: "beschichtung", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o3",
    orderNumber: "A-2026-0040",
    task: "Besteckteile versilbern (24 Stk.)",
    customerName: "Privatkunde Lenz",
    customerId: "K-000123",
    intakeDate: "18.05.2026",
    dueDate: "22.05.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "2 Tagen",
    station: "beschichtung",
    currentStationId: "beschichtung",
    risk: "yellow",
    statusText: "LEICHT KRITISCH",
    delayReason: "Feinsilber-Spezialvorbereitung",
    recommendedAction: "Vorbehandlung ansetzen",
    parts: [
      { id: "T-2026-0040-A", name: "Besteckteile 24er Set (Messer, Gabeln, LÃ¶ffel)", material: "Messing / Alpacca", finish: "Feinsilberschicht (90g/12)", location: "Kiste K-12", hours: "5.5h", actualHours: "4.8h", condition: "Gut (Normaler VerschleiÃŸ)", station: "beschichtung", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o4",
    orderNumber: "A-2026-0035",
    task: "Jugendstilleuchter brÃ¼nieren",
    customerName: "Kirche St. Martin",
    customerId: "K-000126",
    intakeDate: "19.05.2026",
    dueDate: "30.05.2026",
    dueLabel: "Wartet auf",
    dueValue: "Freigabe",
    station: "entmetallisierung",
    currentStationId: "entmetallisierung",
    risk: "blocked",
    statusText: "WARTET AUF MATERIAL/KV",
    delayReason: "Kostenvoranschlag gesendet â€“ RÃ¼ckmeldung Kunde ausstehend",
    recommendedAction: "Kundendaten Ã¶ffnen",
    parts: [
      { id: "T-2026-0035-A", name: "Jugendstil-Deckenleuchter Messingguss", material: "Messingguss", finish: "BrÃ¼niert & Wachs-Konserviert", location: "Regal A-05", hours: "6.0h", actualHours: "0.0h", condition: "Mittel (Teilweise oxidiert)", station: "entmetallisierung", status: "Warten" }
    ]
  },
  {
    id: "o5",
    orderNumber: "A-2026-0030",
    task: "MÃ¶belbeschlÃ¤ge vergolden",
    customerName: "Antik-Galerie Mainz",
    customerId: "K-000127",
    intakeDate: "15.05.2026",
    dueDate: "25.05.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "5 Tagen",
    station: "warenausgang",
    currentStationId: "warenausgang",
    risk: "green",
    statusText: "IM PLAN",
    recommendedAction: "Endpolitur vorbereiten",
    parts: [
      { id: "T-2026-0030-A", name: "Barocke MÃ¶bel-ZierbeschlÃ¤ge (6 Stk)", material: "Bronze/Messing", finish: "Glanzvergoldet (24 Karat)", location: "Kiste P-01", hours: "3.5h", actualHours: "3.5h", condition: "Gut (Normaler VerschleiÃŸ)", station: "warenausgang", status: "Neu" }
    ]
  },
  {
    id: "o6",
    orderNumber: "A-2026-0050",
    task: "Klassik-Autoteile spachteln & lagern",
    customerName: "Museum Lenzburg",
    customerId: "K-000124",
    intakeDate: "20.05.2026",
    dueDate: "05.06.2026",
    dueLabel: "Eingelagert",
    dueValue: "Bereit",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0050-A", name: "KÃ¼hlergrill Opel Rekord C", material: "Stahlblech", finish: "Glanzverchromt", location: "Lagerfach L-04", hours: "4.0h", actualHours: "0.0h", condition: "Eingelagert", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o7",
    orderNumber: "A-2026-0051",
    task: "Neuerfassung Lampenmaske",
    customerName: "Atelier Schmid",
    customerId: "K-000125",
    intakeDate: "21.05.2026",
    dueDate: "12.06.2026",
    dueLabel: "Neu erfasst",
    dueValue: "Wareneingang",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0051-A", name: "Lampenmaske Vespa V50", material: "Stahlblech", finish: "Glanzverchromt", location: "Kiste WE-01", hours: "2.0h", actualHours: "0.0h", condition: "Neu eingegangen", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o8",
    orderNumber: "A-2026-0060",
    task: "Motorradtank entmetallisieren (NSU Quick)",
    customerName: "Heinz Oldtimer-Ranch",
    customerId: "K-000128",
    intakeDate: "08.05.2026",
    dueDate: "18.05.2026",
    dueLabel: "ÃœberfÃ¤llig seit",
    dueValue: "4 Tagen",
    station: "entmetallisierung",
    currentStationId: "entmetallisierung",
    risk: "red", // 3. CRITICAL
    statusText: "KRITISCH â€“ ÃœBERFÃ„LLIG",
    delayReason: "Unerwartete Alt-Lackierung unter Chromschicht erfordert chemische Sonderbehandlung",
    recommendedAction: "Manuelle Abbeizung anordnen",
    parts: [
      { id: "T-2026-0060-A", name: "Tank NSU Quick 1952", material: "Stahlblech", finish: "Zur Entchromung", location: "Regal A-02", hours: "3.5h", actualHours: "1.0h", condition: "Kritisch", station: "entmetallisierung", status: "Zusatzaufwand" }
    ]
  },
  {
    id: "o9",
    orderNumber: "A-2026-0061",
    task: "Zierleisten schleifen (Porsche 356)",
    customerName: "Classic Bike Bodensee",
    customerId: "K-000134",
    intakeDate: "13.05.2026",
    dueDate: "23.05.2026",
    dueLabel: "FÃ¤llig",
    dueValue: "Morgen",
    station: "schleiferei",
    currentStationId: "schleiferei",
    risk: "orange", // 4. CRITICAL
    statusText: "GEFÃ„HRDET",
    delayReason: "Extrem dÃ¼nnwandiges Aluminium erfordert hochprÃ¤zises manuelles Schleifen",
    recommendedAction: "Zuteilung an Schleifermeister Weber",
    parts: [
      { id: "T-2026-0061-A", name: "Zierleistensatz Porsche 356 (8-teilig)", material: "Aluminium", finish: "Glanzpoliert", location: "Schublade S-04", hours: "8.0h", actualHours: "4.5h", condition: "Filigran", station: "schleiferei", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o10",
    orderNumber: "A-2026-0062",
    task: "Kirchen-Altarleuchter restaurieren",
    customerName: "Pfarrei St. Ursus",
    customerId: "K-000129",
    intakeDate: "05.05.2026",
    dueDate: "19.05.2026",
    dueLabel: "ÃœberfÃ¤llig seit",
    dueValue: "3 Tagen",
    station: "schleiferei",
    currentStationId: "schleiferei",
    risk: "red", // 5. CRITICAL
    statusText: "KRITISCH â€“ ÃœBERFÃ„LLIG",
    delayReason: "Freigabe des Denkmalschutzamtes dauerte 10 Tage",
    recommendedAction: "Express-Schicht am Samstag anberaumen",
    parts: [
      { id: "T-2026-0062-A", name: "Altarleuchter St. Ursus (Bronze)", material: "Bronze", finish: "Feuervergoldet (historisch)", location: "Tisch 02", hours: "15.0h", actualHours: "3.5h", condition: "Stark oxidiert", station: "schleiferei", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o11",
    orderNumber: "A-2026-0063",
    task: "Schloss-Fenstergriffe vergolden",
    customerName: "Schlossverwaltung Wildegg",
    customerId: "K-000133",
    intakeDate: "12.05.2026",
    dueDate: "24.05.2026",
    dueLabel: "FÃ¤llig",
    dueValue: "Morgen",
    station: "beschichtung",
    currentStationId: "beschichtung",
    risk: "orange", // 6. CRITICAL
    statusText: "GEFÃ„HRDET",
    delayReason: "Spezialelektrolyt (Gold-Kobalt) muss regeneriert werden",
    recommendedAction: "Laboranalyse Goldkonzentration",
    parts: [
      { id: "T-2026-0063-A", name: "Fenstergriffe Schloss Wildegg (12 Stk)", material: "Messing", finish: "Hartvergoldet 24k", location: "Kiste K-08", hours: "8.5h", actualHours: "6.0h", condition: "Alt", station: "beschichtung", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o12",
    orderNumber: "A-2026-0064",
    task: "KÃ¼hlerfigur Emily verchromen (Rolls-Royce)",
    customerName: "Privatkunde Dr. MÃ¼ller",
    customerId: "K-000130",
    intakeDate: "06.05.2026",
    dueDate: "16.05.2026",
    dueLabel: "ÃœberfÃ¤llig seit",
    dueValue: "6 Tagen",
    station: "beschichtung",
    currentStationId: "beschichtung",
    risk: "red", // 7. CRITICAL
    statusText: "KRITISCH â€“ ÃœBERFÃ„LLIG",
    delayReason: "Mehrfacher Fehlversuch wegen ungenÃ¼gender Haftung auf Zinkdruckguss",
    recommendedAction: "Kupfer-Zwischenschicht massiv verstÃ¤rken",
    parts: [
      { id: "T-2026-0064-A", name: "KÃ¼hlerfigur Emily (Rolls Royce)", material: "Zinkdruckguss", finish: "Glanzverchromt (Premium)", location: "Meisterschrank", hours: "6.5h", actualHours: "5.0h", condition: "Kritisch", station: "beschichtung", status: "Nacharbeit" }
    ]
  },
  {
    id: "o13",
    orderNumber: "A-2026-0065",
    task: "Oldtimer-Speichenfelgen verkupfern",
    customerName: "Heinz Oldtimer-Ranch",
    customerId: "K-000128",
    intakeDate: "11.05.2026",
    dueDate: "23.05.2026",
    dueLabel: "FÃ¤llig",
    dueValue: "Morgen",
    station: "beschichtung",
    currentStationId: "beschichtung",
    risk: "orange", // 8. CRITICAL
    statusText: "GEFÃ„HRDET",
    delayReason: "Sehr aufwÃ¤ndige Maskierung der GewindegÃ¤nge",
    recommendedAction: "Hilfsarbeiter fÃ¼r Abdeckarbeiten abstellen",
    parts: [
      { id: "T-2026-0065-A", name: "Speichenfelgen Borrani (4 Stk)", material: "Stahl/Messing", finish: "Sauer Kupfer matt", location: "Wagen 06", hours: "12.0h", actualHours: "8.0h", condition: "Normal", station: "beschichtung", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o14",
    orderNumber: "A-2026-0066",
    task: "Vespa KotflÃ¼gel spachteln & verchromen",
    customerName: "Classic Bike Bodensee",
    customerId: "K-000134",
    intakeDate: "16.05.2026",
    dueDate: "26.05.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "4 Tagen",
    station: "schleiferei",
    currentStationId: "schleiferei",
    risk: "yellow",
    statusText: "LEICHT KRITISCH",
    parts: [
      { id: "T-2026-0066-A", name: "KotflÃ¼gel Vespa V50", material: "Stahlblech", finish: "Glanzverchromt", location: "Kiste WE-02", hours: "4.5h", actualHours: "2.0h", condition: "Gut", station: "schleiferei", status: "In Bearbeitung" }
    ]
  },
  {
    id: "o15",
    orderNumber: "A-2026-0067",
    task: "Kirchenkelch versilbern & vergolden",
    customerName: "Pfarrei St. Ursus",
    customerId: "K-000129",
    intakeDate: "18.05.2026",
    dueDate: "05.06.2026",
    dueLabel: "Wartet auf",
    dueValue: "Freigabe",
    station: "entmetallisierung",
    currentStationId: "entmetallisierung",
    risk: "blocked",
    statusText: "WARTET AUF MATERIAL/KV",
    delayReason: "KV zur Genehmigung bei der DiÃ¶zese",
    parts: [
      { id: "T-2026-0067-A", name: "Kirchenkelch St. Ursus (Silber)", material: "Silber", finish: "Innenvergoldet 24k", location: "Safefach 1", hours: "6.0h", actualHours: "0.0h", condition: "Edel", station: "entmetallisierung", status: "Warten" }
    ]
  },
  {
    id: "o16",
    orderNumber: "A-2026-0068",
    task: "Silberbesteck polieren (60 Teile)",
    customerName: "Privatkunde Weber",
    customerId: "K-000132",
    intakeDate: "19.05.2026",
    dueDate: "02.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "11 Tagen",
    station: "schleiferei",
    currentStationId: "schleiferei",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0068-A", name: "60-teiliges Silberbesteck WMF", material: "Echtsilber", finish: "Glanzpoliert & Passiviert", location: "Karton WE-03", hours: "4.0h", actualHours: "0.0h", condition: "Gut", station: "schleiferei", status: "Neu" }
    ]
  },
  {
    id: "o17",
    orderNumber: "A-2026-0069",
    task: "Fenstergriffe matt vernickeln",
    customerName: "Metallbau Vock AG",
    customerId: "K-000131",
    intakeDate: "20.05.2026",
    dueDate: "03.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "12 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0069-A", name: "Fenstergriffe modern (35 Stk)", material: "Messing", finish: "Nickel matt (Edelstahl-Optik)", location: "Kiste WE-04", hours: "5.0h", actualHours: "0.0h", condition: "Neuware", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o18",
    orderNumber: "A-2026-0070",
    task: "Kamingitter antik brÃ¼nieren",
    customerName: "Privatkunde Dr. MÃ¼ller",
    customerId: "K-000130",
    intakeDate: "21.05.2026",
    dueDate: "10.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "19 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0070-A", name: "Kamingitter Schmiedeeisen", material: "Stahl", finish: "Schwarz brÃ¼niert & geÃ¶lt", location: "Palette 02", hours: "3.5h", actualHours: "0.0h", condition: "Rustikal", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o19",
    orderNumber: "A-2026-0071",
    task: "MÃ¼nzensammlung reinigen & konservieren",
    customerName: "Privatkunde Lenz",
    customerId: "K-000123",
    intakeDate: "21.05.2026",
    dueDate: "15.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "24 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0071-A", name: "RÃ¶mische KupfermÃ¼nzen (40 Stk)", material: "Kupfer", finish: "Utraschallreinigung & Mikrowachs", location: "Schublade WE-05", hours: "4.0h", actualHours: "0.0h", condition: "Historisch", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o20",
    orderNumber: "A-2026-0072",
    task: "Maschinenteile verzinken (Sondercharge)",
    customerName: "Metallbau Vock AG",
    customerId: "K-000131",
    intakeDate: "21.05.2026",
    dueDate: "08.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "17 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0072-A", name: "Halterungen verzinken (250 Stk)", material: "Stahl", finish: "Blau verzinkt (Dickschicht)", location: "Gitterbox 01", hours: "6.0h", actualHours: "0.0h", condition: "Neuware", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o21",
    orderNumber: "A-2026-0073",
    task: "Kronleuchter vergolden (Rokoko)",
    customerName: "Antik-Galerie Mainz",
    customerId: "K-000127",
    intakeDate: "20.05.2026",
    dueDate: "20.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "29 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0073-A", name: "Deckenkronleuchter Rokoko", material: "Messingguss", finish: "Glanzvergoldet 24k", location: "SpezialaufhÃ¤ngung 01", hours: "18.0h", actualHours: "0.0h", condition: "Starke Patina", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o22",
    orderNumber: "A-2026-0074",
    task: "AuspuffkrÃ¼mmer hochglanzverchromen",
    customerName: "Atelier Schmid",
    customerId: "K-000125",
    intakeDate: "22.05.2026",
    dueDate: "15.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "24 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0074-A", name: "AuspuffkrÃ¼mmer BMW R75 rechts", material: "Stahl", finish: "Glanzverchromt", location: "Kiste WE-06", hours: "2.0h", actualHours: "0.0h", condition: "Normal", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o23",
    orderNumber: "A-2026-0075",
    task: "TÃ¼rdrÃ¼cker patinieren (Alt-Berlin)",
    customerName: "Privatkunde Weber",
    customerId: "K-000132",
    intakeDate: "22.05.2026",
    dueDate: "12.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "21 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0075-A", name: "TÃ¼rgriffsatz Jugendstil (4er)", material: "Messing", finish: "Braun patiniert & gewachst", location: "Schublade WE-06", hours: "3.0h", actualHours: "0.0h", condition: "Normal", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o24",
    orderNumber: "A-2026-0076",
    task: "Kupferkessel glanzpolieren",
    customerName: "Schlossverwaltung Wildegg",
    customerId: "K-000133",
    intakeDate: "22.05.2026",
    dueDate: "18.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "27 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0076-A", name: "Historischer Kupferwaschkessel", material: "Kupferblech", finish: "Hand-Hochglanzpolitur & Zaponlack", location: "Palette WE-07", hours: "5.0h", actualHours: "0.0h", condition: "Patina", station: "wareneingang", status: "Neu" }
    ]
  },
  {
    id: "o25",
    orderNumber: "A-2026-0077",
    task: "Opel Rekord StoÃŸstangenteile Kupferaufbau",
    customerName: "Museum Lenzburg",
    customerId: "K-000124",
    intakeDate: "22.05.2026",
    dueDate: "22.06.2026",
    dueLabel: "FÃ¤llig in",
    dueValue: "31 Tagen",
    station: "wareneingang",
    currentStationId: "wareneingang",
    risk: "green",
    statusText: "IM PLAN",
    parts: [
      { id: "T-2026-0077-A", name: "Opel Rekord C ZierhÃ¶rner (4 Stk)", material: "Stahl", finish: "Galvanisch verkupfert & poliert", location: "Kiste WE-08", hours: "4.5h", actualHours: "0.0h", condition: "Starke Narben", station: "wareneingang", status: "Neu" }
    ]
  }
];

// 2. Customers Mock Database (Exactly 12 customers with fully detailed timelines & prices)
export const INITIAL_CUSTOMERS: MockCustomer[] = [
  {
    id: "K-000123",
    name: "Max Mustermann / Privatkunde Lenz",
    type: "Privatkunde",
    city: "Frankfurt",
    address: "GoethestraÃŸe 12, 60313 Frankfurt",
    phone: "+49 69 1234567",
    email: "max.mustermann@gmail.com",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "Sehr zuverlÃ¤ssiger Zahler. Klassik-Automobil-Liebhaber (besitzt Opel Rekord C). Erwartet hohe Detailtreue.",
    notes: "Kunde legt extremen Wert auf makellose Politur der StoÃŸfÃ¤nger-RÃ¼ckseiten vor der Vernickelung, um Korrosion zu verhindern.",
    priceAgreements: [
      { id: "pa1", scope: "Standard Privatkunden-Tarif", rate: "Listenpreis", date: "12.01.2025" },
      { id: "pa2", scope: "Rabatt ab 2. Auftrag", rate: "5% Rabatt auf Lohnanteil", date: "15.03.2025" }
    ],
    orders: [
      {
        id: "o3",
        orderNumber: "A-2026-0040",
        task: "Besteckteile versilbern (24 Stk.)",
        intakeDate: "18.05.2026",
        dueDate: "22.05.2026",
        status: "active",
        statusText: "FÃ¤llig in 2 Tagen",
        parts: [{ id: "T-2026-0040-A", name: "Besteckteile 24er Set", material: "Messing / Alpacca", finish: "Feinsilberschicht (90g/12)", location: "Kiste K-12" }]
      },
      {
        id: "o19",
        orderNumber: "A-2026-0071",
        task: "MÃ¼nzensammlung reinigen & konservieren",
        intakeDate: "21.05.2026",
        dueDate: "15.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0071-A", name: "RÃ¶mische KupfermÃ¼nzen", material: "Kupfer", finish: "Utraschallreinigung & Mikrowachs", location: "Schublade WE-05" }]
      }
    ],
    feedbacks: [
      { id: "f1", date: "30.10.2025", type: "positive", text: "Sehr zufrieden mit Glanzgrad des KÃ¼hlergrills. Hat uns ein Foto des fertigen Fahrzeugs geschickt." }
    ]
  },
  {
    id: "K-000124",
    name: "Museum Lenzburg",
    type: "GeschÃ¤ftskunde",
    city: "Lenzburg",
    address: "Schlossgasse 4, 5600 Lenzburg, Schweiz",
    phone: "+41 62 888 12 34",
    email: "restaurierung@museum-lenzburg.ch",
    prefComm: "Telefon",
    risk: "Niedrig",
    riskNote: "Rechnungsstellung an kantonale Kulturstiftung. Manchmal lÃ¤ngere interne Freigabewege, aber absolut bonitÃ¤tsstark.",
    notes: "SÃ¤mtliche Arbeiten mÃ¼ssen dokumentiert und mit dem Restaurierungsbericht abgeglichen werden. Keine aggressiven mechanischen Schleifverfahren ohne Absprache.",
    priceAgreements: [
      { id: "pa3", scope: "Rahmenvertrag Restaurierung", rate: "15% Rabatt auf Entlackung & BÃ¤der", date: "01.01.2024" }
    ],
    orders: [
      {
        id: "o1",
        orderNumber: "A-2026-0042",
        task: "StoÃŸstangen vernickeln (Opel Rekord C)",
        intakeDate: "10.05.2026",
        dueDate: "20.05.2026",
        status: "critical",
        statusText: "ÃœberfÃ¤llig seit 3 Stunden",
        parts: [{ id: "T-2026-0042-A", name: "StoÃŸstange vorne Opel Rekord C", material: "Stahl", finish: "Vernickelt (Premium)", location: "Regal B-02" }]
      },
      {
        id: "o6",
        orderNumber: "A-2026-0050",
        task: "Klassik-Autoteile spachteln & lagern",
        intakeDate: "20.05.2026",
        dueDate: "05.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0050-A", name: "KÃ¼hlergrill Opel Rekord C", material: "Stahlblech", finish: "Glanzverchromt", location: "Lagerfach L-04" }]
      },
      {
        id: "o25",
        orderNumber: "A-2026-0077",
        task: "Opel Rekord StoÃŸstangenteile Kupferaufbau",
        intakeDate: "22.05.2026",
        dueDate: "22.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0077-A", name: "Opel Rekord C ZierhÃ¶rner", material: "Stahl", finish: "Galvanisch verkupfert & poliert", location: "Kiste WE-08" }]
      }
    ],
    feedbacks: [
      { id: "f2", date: "05.12.2025", type: "positive", text: "Hervorragende historische Patina-Arbeit bei den SchlossbeschlÃ¤gen gelobt. Begleitkarte fÃ¼r Ausstellung erwÃ¼nscht." }
    ]
  },
  {
    id: "K-000125",
    name: "Atelier Schmid",
    type: "GeschÃ¤ftskunde",
    city: "MÃ¼nchen",
    address: "SchellingstraÃŸe 45, 80799 MÃ¼nchen",
    phone: "+49 89 543210",
    email: "info@atelier-schmid.de",
    prefComm: "E-Mail",
    risk: "Mittel",
    riskNote: "Ã„uÃŸerst anspruchsvoll bezÃ¼glich OberflÃ¤chengÃ¼te. Erfordert oft doppelte Meisterabnahme vor Auslieferung. Reagiert empfindlich auf kleinste Poren.",
    notes: "Spezialisiert auf High-End Oldtimer-MotorrÃ¤der. StandardmÃ¤ÃŸig alle galvanischen BÃ¤der mit doppelter Zwischenpolitur fahren.",
    priceAgreements: [
      { id: "pa5", scope: "Standard Motorradtanks", rate: "Festpreis 450â‚¬ zzgl. MwSt. pro StÃ¼ck", date: "10.02.2025" }
    ],
    orders: [
      {
        id: "o2",
        orderNumber: "A-2026-0038",
        task: "Motorradteile Glanzverchromen (BMW R75)",
        intakeDate: "14.05.2026",
        dueDate: "21.05.2026",
        status: "active",
        statusText: "GefÃ¤hrdet",
        parts: [{ id: "T-2026-0038-A", name: "Kraftstofftank BMW R75", material: "Stahlblech", finish: "Glanzverchromt (Teilmaskiert)", location: "Wagen 04" }]
      },
      {
        id: "o7",
        orderNumber: "A-2026-0051",
        task: "Neuerfassung Lampenmaske",
        intakeDate: "21.05.2026",
        dueDate: "12.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0051-A", name: "Lampenmaske Vespa V50", material: "Stahlblech", finish: "Glanzverchromt", location: "Kiste WE-01" }]
      },
      {
        id: "o22",
        orderNumber: "A-2026-0074",
        task: "AuspuffkrÃ¼mmer hochglanzverchromen",
        intakeDate: "22.05.2026",
        dueDate: "15.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0074-A", name: "AuspuffkrÃ¼mmer BMW R75 rechts", material: "Stahl", finish: "Glanzverchromt", location: "Kiste WE-06" }]
      }
    ],
    feedbacks: [
      { id: "f5", date: "02.10.2025", type: "positive", text: "Nachbesserung der Vespa-Maske als 'perfekt' bewertet. Kooperation lÃ¤uft seither reibungslos." }
    ]
  },
  {
    id: "K-000126",
    name: "Kirche St. Martin",
    type: "Institution",
    city: "KÃ¶ln",
    address: "Martinsfeld 1, 50676 KÃ¶ln",
    phone: "", // Missing number to test fallback
    email: "pfarramt@st-martin-koeln.de",
    prefComm: "Brief / Post",
    risk: "Hoch",
    riskNote: "Komplexe Entscheidungswege Ã¼ber Kirchenvorstand. Freigaben dauern oft mehrere Wochen. KostenvoranschlÃ¤ge mÃ¼ssen absolut exakt sein.",
    notes: "Konservatorische Anforderungen beachten. Erfordert schriftliches Analysezertifikat Ã¼ber die galvanische Versilberung/Goldauflage zur Vorlage beim Bistum.",
    priceAgreements: [
      { id: "pa7", scope: "Sonderkondition Kirche", rate: "10% Spendenrabatt auf Lohnanteil", date: "15.04.2026" }
    ],
    orders: [
      {
        id: "o4",
        orderNumber: "A-2026-0035",
        task: "Jugendstilleuchter brÃ¼nieren",
        intakeDate: "19.05.2026",
        dueDate: "30.05.2026",
        status: "waiting",
        statusText: "Wartet auf KV-Freigabe",
        parts: [{ id: "T-2026-0035-A", name: "Jugendstil-Deckenleuchter", material: "Messingguss", finish: "BrÃ¼niert & Wachs-Konserviert", location: "Regal A-05" }]
      }
    ],
    feedbacks: [
      { id: "f6", date: "20.05.2026", type: "neutral", text: "Hoher ErklÃ¤rungsbedarf bezÃ¼glich der Konservierungsmethode. ErklÃ¤rendes Telefonat mit Meister Kreile gefÃ¼hrt." }
    ]
  },
  {
    id: "K-000127",
    name: "Antik-Galerie Mainz",
    type: "GeschÃ¤ftskunde",
    city: "Mainz",
    address: "KaiserstraÃŸe 18, 55116 Mainz",
    phone: "+49 6131 998877",
    email: "info@antik-mainz.de",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "Sehr verlÃ¤sslicher Stammkunde fÃ¼r ZierbeschlÃ¤ge und EinrichtungsgegenstÃ¤nde.",
    notes: "Besonders empfindlich bei Vergoldungsschichten. Stets dicke Glanzgoldschicht applizieren.",
    priceAgreements: [
      { id: "pa8", scope: "ZierbeschlÃ¤ge Vergoldung", rate: "Festpreis 15â‚¬/Stk ab 10 Stk", date: "10.01.2025" }
    ],
    orders: [
      {
        id: "o5",
        orderNumber: "A-2026-0030",
        task: "MÃ¶belbeschlÃ¤ge vergolden",
        intakeDate: "15.05.2026",
        dueDate: "25.05.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0030-A", name: "Barocke MÃ¶bel-ZierbeschlÃ¤ge", material: "Bronze/Messing", finish: "Glanzvergoldet (24 Karat)", location: "Kiste P-01" }]
      },
      {
        id: "o21",
        orderNumber: "A-2026-0073",
        task: "Kronleuchter vergolden (Rokoko)",
        intakeDate: "20.05.2026",
        dueDate: "20.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0073-A", name: "Deckenkronleuchter Rokoko", material: "Messingguss", finish: "Glanzvergoldet 24k", location: "SpezialaufhÃ¤ngung 01" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000128",
    name: "Heinz Oldtimer-Ranch",
    type: "GeschÃ¤ftskunde",
    city: "Stuttgart",
    address: "PorschestraÃŸe 9, 70435 Stuttgart",
    phone: "+49 711 990011",
    email: "werkstatt@heinz-oldtimers.de",
    prefComm: "Telefon",
    risk: "Mittel",
    riskNote: "Hohes Auftragsvolumen, aber oft knappe Termine.",
    notes: "Fokus auf NSU- und BMW-Oldtimer-MotorrÃ¤der.",
    priceAgreements: [
      { id: "pa9", scope: "Motorradfelgen verkupfern", rate: "120â‚¬/Felge", date: "05.02.2026" }
    ],
    orders: [
      {
        id: "o8",
        orderNumber: "A-2026-0060",
        task: "Motorradtank entmetallisieren (NSU Quick)",
        intakeDate: "08.05.2026",
        dueDate: "18.05.2026",
        status: "critical",
        statusText: "Kritisch - ÃœberfÃ¤llig",
        parts: [{ id: "T-2026-0060-A", name: "Tank NSU Quick 1952", material: "Stahlblech", finish: "Zur Entchromung", location: "Regal A-02" }]
      },
      {
        id: "o13",
        orderNumber: "A-2026-0065",
        task: "Oldtimer-Speichenfelgen verkupfern",
        intakeDate: "11.05.2026",
        dueDate: "23.05.2026",
        status: "critical",
        statusText: "GefÃ¤hrdet",
        parts: [{ id: "T-2026-0065-A", name: "Speichenfelgen Borrani", material: "Stahl/Messing", finish: "Sauer Kupfer matt", location: "Wagen 06" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000129",
    name: "Pfarrei St. Ursus",
    type: "Institution",
    city: "Solothurn",
    address: "Hauptgasse 12, 4500 Solothurn, Schweiz",
    phone: "+41 32 622 11 22",
    email: "pfarrei@ursus-solothurn.ch",
    prefComm: "Brief / Post",
    risk: "Hoch",
    riskNote: "Erfordert schriftliche KostenvoranschlÃ¤ge mit detaillierter HandwerksbegrÃ¼ndung.",
    notes: "KirchenschÃ¤tze und historische Goldkelche.",
    priceAgreements: [],
    orders: [
      {
        id: "o10",
        orderNumber: "A-2026-0062",
        task: "Kirchen-Altarleuchter restaurieren",
        intakeDate: "05.05.2026",
        dueDate: "19.05.2026",
        status: "critical",
        statusText: "Kritisch - ÃœberfÃ¤llig",
        parts: [{ id: "T-2026-0062-A", name: "Altarleuchter St. Ursus (Bronze)", material: "Bronze", finish: "Feuervergoldet (historisch)", location: "Tisch 02" }]
      },
      {
        id: "o15",
        orderNumber: "A-2026-0067",
        task: "Kirchenkelch versilbern & vergolden",
        intakeDate: "18.05.2026",
        dueDate: "05.06.2026",
        status: "waiting",
        statusText: "Wartet auf Freigabe",
        parts: [{ id: "T-2026-0067-A", name: "Kirchenkelch St. Ursus", material: "Silber", finish: "Innenvergoldet 24k", location: "Safefach 1" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000130",
    name: "Privatkunde Dr. MÃ¼ller",
    type: "Privatkunde",
    city: "ZÃ¼rich",
    address: "Utoquai 34, 8008 ZÃ¼rich, Schweiz",
    phone: "+41 44 211 44 55",
    email: "dr.mueller@mueller-law.ch",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "Zahlt per Vorauskasse. Absolut premium-orientiert.",
    notes: "Rolls-Royce Sammler. Erwartet makellose Show-Chrom-OberflÃ¤chen.",
    priceAgreements: [],
    orders: [
      {
        id: "o12",
        orderNumber: "A-2026-0064",
        task: "KÃ¼hlerfigur Emily verchromen (Rolls-Royce)",
        intakeDate: "06.05.2026",
        dueDate: "16.05.2026",
        status: "critical",
        statusText: "Kritisch - ÃœberfÃ¤llig",
        parts: [{ id: "T-2026-0064-A", name: "KÃ¼hlerfigur Emily (Rolls Royce)", material: "Zinkdruckguss", finish: "Glanzverchromt (Premium)", location: "Meisterschrank" }]
      },
      {
        id: "o18",
        orderNumber: "A-2026-0070",
        task: "Kamingitter antik brÃ¼nieren",
        intakeDate: "21.05.2026",
        dueDate: "10.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0070-A", name: "Kamingitter Schmiedeeisen", material: "Stahl", finish: "Schwarz brÃ¼niert & geÃ¶lt", location: "Palette 02" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000131",
    name: "Metallbau Vock AG",
    type: "GeschÃ¤ftskunde",
    city: "Aargau",
    address: "Industriestrasse 14, 5400 Baden, Schweiz",
    phone: "+41 56 422 77 88",
    email: "auftrag@vock-metallbau.ch",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "GroÃŸer Industriebetrieb, verlÃ¤ssliche Zahlung.",
    notes: "Zink- und Nickel-Serienteile. Termineinbindung in Lieferketten beachten.",
    priceAgreements: [
      { id: "pa10", scope: "Blauverzinken GroÃŸserien", rate: "Kilopreis 1.80 CHF", date: "15.01.2026" }
    ],
    orders: [
      {
        id: "o17",
        orderNumber: "A-2026-0069",
        task: "Fenstergriffe matt vernickeln",
        intakeDate: "20.05.2026",
        dueDate: "03.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0069-A", name: "Fenstergriffe modern", material: "Messing", finish: "Nickel matt", location: "Kiste WE-04" }]
      },
      {
        id: "o20",
        orderNumber: "A-2026-0072",
        task: "Maschinenteile verzinken (Sondercharge)",
        intakeDate: "21.05.2026",
        dueDate: "08.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0072-A", name: "Halterungen verzinken", material: "Stahl", finish: "Blau verzinkt (Dickschicht)", location: "Gitterbox 01" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000132",
    name: "Privatkunde Weber",
    type: "Privatkunde",
    city: "Basel",
    address: "Spalenring 44, 4056 Basel, Schweiz",
    phone: "+41 61 301 22 33",
    email: "lisa.weber@sunrise.ch",
    prefComm: "Telefon",
    risk: "Niedrig",
    notes: "Bestecksets und Hausrat.",
    priceAgreements: [],
    orders: [
      {
        id: "o16",
        orderNumber: "A-2026-0068",
        task: "Silberbesteck polieren (60 Teile)",
        intakeDate: "19.05.2026",
        dueDate: "02.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0068-A", name: "60-teiliges Silberbesteck WMF", material: "Echtsilber", finish: "Glanzpoliert & Passiviert", location: "Karton WE-03" }]
      },
      {
        id: "o23",
        orderNumber: "A-2026-0075",
        task: "TÃ¼rdrÃ¼cker patinieren (Alt-Berlin)",
        intakeDate: "22.05.2026",
        dueDate: "12.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0075-A", name: "TÃ¼rgriffsatz Jugendstil", material: "Messing", finish: "Braun patiniert & gewachst", location: "Schublade WE-06" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000133",
    name: "Schlossverwaltung Wildegg",
    type: "Institution",
    city: "Wildegg",
    address: "Schlossberg, 5103 MÃ¶riken-Wildegg, Schweiz",
    phone: "+41 62 893 22 55",
    email: "info@schloss-wildegg.ch",
    prefComm: "E-Mail",
    risk: "Niedrig",
    notes: "Historische Zinn-, Messing- und Kupfer-Exponate. Konservierung steht vor Neuglanz.",
    priceAgreements: [],
    orders: [
      {
        id: "o11",
        orderNumber: "A-2026-0063",
        task: "Schloss-Fenstergriffe vergolden",
        intakeDate: "12.05.2026",
        dueDate: "24.05.2026",
        status: "critical",
        statusText: "GefÃ¤hrdet",
        parts: [{ id: "T-2026-0063-A", name: "Fenstergriffe Schloss Wildegg", material: "Messing", finish: "Hartvergoldet 24k", location: "Kiste K-08" }]
      },
      {
        id: "o24",
        orderNumber: "A-2026-0076",
        task: "Kupferkessel glanzpolieren",
        intakeDate: "22.05.2026",
        dueDate: "18.06.2026",
        status: "active",
        statusText: "Im Plan",
        parts: [{ id: "T-2026-0076-A", name: "Historischer Kupferwaschkessel", material: "Kupferblech", finish: "Hand-Hochglanzpolitur & Zaponlack", location: "Palette WE-07" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000134",
    name: "Classic Bike Bodensee",
    type: "GeschÃ¤ftskunde",
    city: "Konstanz",
    address: "Seeweg 14, 78464 Konstanz",
    phone: "+49 7531 445566",
    email: "info@classic-bike-bodensee.de",
    prefComm: "E-Mail",
    risk: "Niedrig",
    notes: "Spezialist fÃ¼r klassische MotorrÃ¤der aus dem Voralpengebiet.",
    priceAgreements: [],
    orders: [
      {
        id: "o9",
        orderNumber: "A-2026-0061",
        task: "Zierleisten schleifen (Porsche 356)",
        intakeDate: "13.05.2026",
        dueDate: "23.05.2026",
        status: "critical",
        statusText: "GefÃ¤hrdet",
        parts: [{ id: "T-2026-0061-A", name: "Zierleistensatz Porsche 356", material: "Aluminium", finish: "Glanzpoliert", location: "Schublade S-04" }]
      },
      {
        id: "o14",
        orderNumber: "A-2026-0066",
        task: "Vespa KotflÃ¼gel spachteln & verchromen",
        intakeDate: "16.05.2026",
        dueDate: "26.05.2026",
        status: "active",
        statusText: "FÃ¤llig in 4 Tagen",
        parts: [{ id: "T-2026-0066-A", name: "KotflÃ¼gel Vespa V50", material: "Stahlblech", finish: "Glanzverchromt", location: "Kiste WE-02" }]
      }
    ],
    feedbacks: []
  },
  {
    id: "K-000128",
    name: "Autohaus Meier GmbH",
    type: "Geschäftskunde",
    city: "München",
    address: "Autoallee 1, 80331 München",
    phone: "+49 89 112233",
    email: "service@autohaus-meier.de",
    prefComm: "Telefon",
    risk: "Niedrig",
    riskNote: "Großkunde, zahlt immer pünktlich.",
    notes: "Restauriert viele Oldtimer.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000129",
    name: "Zweirad-Schmiede Berlin",
    type: "Geschäftskunde",
    city: "Berlin",
    address: "Motorradweg 5, 10115 Berlin",
    phone: "+49 30 998877",
    email: "werkstatt@zweirad-schmiede.berlin",
    prefComm: "E-Mail",
    risk: "Mittel",
    riskNote: "Zahlungsziel oft ausgereizt.",
    notes: "Spezialist für Simson und MZ.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000130",
    name: "Johannes Wagner",
    type: "Privatkunde",
    city: "Hamburg",
    address: "Hafenstraße 12, 20457 Hamburg",
    phone: "+49 40 555666",
    email: "johannes.wagner@gmx.de",
    prefComm: "Telefon",
    risk: "Niedrig",
    riskNote: "",
    notes: "Privater Uhrensammler.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000131",
    name: "Classic Cars Stuttgart",
    type: "Geschäftskunde",
    city: "Stuttgart",
    address: "Porschestraße 9, 70435 Stuttgart",
    phone: "+49 711 334455",
    email: "info@classic-cars-stuttgart.de",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "Top-Kunde.",
    notes: "Höchste Qualitätsansprüche (Porsche 356 Teile).",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000132",
    name: "Musikhaus Klang GmbH",
    type: "Geschäftskunde",
    city: "Leipzig",
    address: "Notenweg 3, 04109 Leipzig",
    phone: "+49 341 223344",
    email: "werkstatt@musikhaus-klang.de",
    prefComm: "Telefon",
    risk: "Niedrig",
    riskNote: "",
    notes: "Instrumentenveredelung (Blechblasinstrumente versilbern).",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000133",
    name: "Elena Schmidt",
    type: "Privatkunde",
    city: "Dresden",
    address: "Altmarkt 5, 01067 Dresden",
    phone: "+49 351 778899",
    email: "elena.schmidt@web.de",
    prefComm: "E-Mail",
    risk: "Niedrig",
    riskNote: "",
    notes: "Antiker Schmuck zur Aufbereitung.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000134",
    name: "Möbelmanufaktur Holz & Stahl",
    type: "Geschäftskunde",
    city: "Köln",
    address: "Designring 7, 50667 Köln",
    phone: "+49 221 445566",
    email: "einkauf@holz-stahl.koeln",
    prefComm: "E-Mail",
    risk: "Mittel",
    riskNote: "Zahlung 30 Tage netto vereinbart.",
    notes: "Möbelbeschläge vernickeln und brünieren.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  },
  {
    id: "K-000135",
    name: "Schlosserei Müller",
    type: "Geschäftskunde",
    city: "Nürnberg",
    address: "Eisenstraße 14, 90402 Nürnberg",
    phone: "+49 911 667788",
    email: "mueller@schlosserei-nuernberg.de",
    prefComm: "Telefon",
    risk: "Niedrig",
    riskNote: "",
    notes: "Regelmäßige Aufträge für Zäune und Torbeschläge.",
    priceAgreements: [],
    orders: [],
    feedbacks: []
  }
];

export const INITIAL_SCAN_LOG = [
  { time: "16:15", type: "Etikett", desc: "DHL Paket von 'Antik-Haus GmbH' eingescannt", status: "Dublettenrisiko: Gering" },
  { time: "15:40", type: "Objekt", desc: "Foto von Tank BMW R75 zu A-2026-0038 hinzugefÃ¼gt", status: "Klassifiziert als Motorradteil" },
  { time: "14:10", type: "QR-Code", desc: "Teil T-2026-0042 an Station Schleiferei erfasst", status: "Status: In Bearbeitung" }
];

