import { Customer } from "./types/customer";

export const EXTENDED_CUSTOMERS: Customer[] = [
  {
    id: "K-2026-0018",
    customerNumber: "K-2026-0018",
    name: 'Museum Lenzburg',
    
    companyInfo: { industry: 'Kultur & Museen', size: '10-50 Mitarbeiter', website: 'museum-lenzburg.ch', founded: '1905' },
    aiSummary: 'Das Museum Lenzburg ist eine der wichtigsten Kulturinstitutionen im Aargau. Höchste Anforderungen an Restaurierungsqualität. Budget für authentische Materialien ist vorhanden.',
    tags: ['VIP', 'Museumsqualität', 'Restauration'],
    creditRating: 'AAA (Öffentliche Hand)',
    type: "Institution",
    city: "Lenzburg",
    address: "Schlossgasse 1, 5600 Lenzburg",
    phone: "+41 62 888 12 34",
    email: "konservierung@museum-lenzburg.ch",
    contactPerson: "Dr. H. Keller",
    prefComm: "E-Mail",
    communicationPreference: "email",
    customerStatus: "vip",
    trustLevel: "very_reliable",
    risk: "Niedrig",
    riskNote: "Sehr verlässliche Zahlung, erwartet Museumsqualität.",
    
    paymentProfile: {
      defaultPaymentMethod: "invoice",
      paymentBehavior: "on_time",
      invoiceNotes: "Immer auf Kostenstelle 'Restauration 2026' ausstellen.",
      requiresPurchaseOrder: true
    },
    
    approvalProfile: {
      needsWrittenApproval: true,
      usualApprovalTimeDays: 7,
      decisionMaker: "Dr. Keller / Stiftungsrat",
      approvalNotes: "Kuratorium muss bei Budget > 2000 CHF absegnen."
    },

    expectationProfile: {
      qualityExpectation: "museum_quality",
      priceSensitivity: "low",
      communicationStyle: "detailed",
      riskNotes: "Historische Originalteile! Keine spanabhebende Vorbehandlung ohne Freigabe!"
    },

    technicalProfile: {
      commonMaterials: ["Messing", "Bronze", "Silber"],
      commonSurfaces: ["Altsilber", "Patiniert", "Konserviert"],
      recurringObjectTypes: ["Waffen", "Münzen", "Beschläge"],
      packagingPreference: "In Seidenpapier, einzeln verschweißt",
      handlingNotes: "Nur mit Baumwollhandschuhen berühren."
    },

    priceMemory: [
      {
        id: "pm-1",
        customerId: "K-2026-0018",
        title: "Schlossbeschläge schonend reinigen und patinieren",
        priceNet: 850,
        currency: "EUR",
        year: 2025,
        reason: "Sehr hoher manueller Aufwand",
        createdAt: "2025-10-12T10:00:00Z"
      }
    ],

    recurringItems: [
      {
        id: "ri-1",
        customerId: "K-2026-0018",
        name: "Vitrinen-Scharniere (Sonderanfertigung)",
        usualSurface: "Alt-Messing patiniert",
        averagePriceNet: 120,
        averageDurationDays: 14,
        notes: "Werden regelmäßig für Sonderausstellungen benötigt."
      }
    ],

    complaintSummary: {
      totalComplaints: 0,
      totalReworks: 1,
      lastComplaintAt: "2024-05-10T10:00:00Z",
      mainCauses: ["technical_edge_case"],
      riskLevel: "low"
    },

    relationshipInsights: [], // Will be generated dynamically

    orders: [
      {
        id: "ord-mus-1",
        orderNumber: "A-2026-0410",
        task: "Konservierung historische Schwertgriffe",
        intakeDate: "2026-05-20T08:00:00Z",
        dueDate: "2026-06-15T08:00:00Z",
        status: "active",
        statusText: "In Bearbeitung",
        parts: [
          { id: "p-1", name: "Schwertgriff 17. Jhd.", material: "Bronze", finish: "Patina konserviert", location: "Tresor" }
        ]
      }
    ],
    feedbacks: [],
    priceAgreements: [],
    notes: "Intern — nicht für Kunden sichtbar:\nSonderrabatt 15% auf alle Leistungen für das Museumsbund-Netzwerk gewährt."
  },

  {
    id: "K-2025-0102",
    customerNumber: "K-2025-0102",
    name: 'Atelier Schmid',
    
    companyInfo: { industry: 'Kunsthandwerk & Design', size: '1-5 Mitarbeiter', website: 'atelier-schmid-design.ch', founded: '2012', linkedin: 'linkedin.com/company/atelier-schmid' },
    aiSummary: 'Kleines, aber exklusives Design-Atelier. Margenstarke Spezialaufträge, jedoch notorisch schlechte Zahlungsmoral. Liquidität oft erst nach Projekt-Abschluss gegeben.',
    tags: ['Design', 'Spezialanfertigung', 'Vorkasse prüfen'],
    creditRating: 'B- (Achtung)',
    type: "Geschäftskunde",
    city: "Zürich",
    address: "Limmatstraße 45, 8005 Zürich",
    phone: "+41 44 222 55 66",
    email: "produktion@atelier-schmid.ch",
    contactPerson: "Markus Schmid",
    prefComm: "Telefon",
    communicationPreference: "phone",
    customerStatus: "regular",
    trustLevel: "stable",
    risk: "Mittel",
    
    paymentProfile: {
      defaultPaymentMethod: "invoice",
      paymentBehavior: "slow",
      invoiceNotes: "Zahlt oft erst nach 45 Tagen (Mahnstufe 1).",
      requiresPurchaseOrder: false
    },
    
    approvalProfile: {
      needsWrittenApproval: false,
      usualApprovalTimeDays: 1,
      decisionMaker: "Markus Schmid",
      approvalNotes: "Kurze WhatsApp oder Anruf reicht."
    },

    expectationProfile: {
      qualityExpectation: "high",
      priceSensitivity: "high",
      communicationStyle: "brief",
      riskNotes: "Vergleicht Preise mit Konkurrenz, sehr zeitkritisch."
    },

    technicalProfile: {
      commonMaterials: ["Stahl", "Aluminium"],
      commonSurfaces: ["Glanznickel", "Chrom"],
      recurringObjectTypes: ["Möbelgestelle", "Lampenfassungen"],
      packagingPreference: "Standard (Folie)",
      handlingNotes: "Keine"
    },

    priceMemory: [
      {
        id: "pm-2",
        customerId: "K-2025-0102",
        title: "Lampengestelle Serie 3 verchromen",
        priceNet: 45,
        currency: "EUR",
        year: 2026,
        reason: "Serienpreis ab 50 Stück",
        wasSpecialAgreement: true,
        createdAt: "2026-02-15T10:00:00Z"
      }
    ],

    recurringItems: [
      {
        id: "ri-2",
        customerId: "K-2025-0102",
        name: "Tischbein 'Industrial'",
        usualSurface: "Glanzchrom",
        usualMaterial: "Stahlrohr",
        averagePriceNet: 35,
        averageDurationDays: 5,
        notes: "Müssen vorher zwingend gut entfettet werden, Rohre innen oft ölig!"
      }
    ],

    complaintSummary: {
      totalComplaints: 2,
      totalReworks: 2,
      lastComplaintAt: "2025-11-20T10:00:00Z",
      mainCauses: ["insufficient_preparation"],
      riskLevel: "medium"
    },

    relationshipInsights: [],

    orders: [
      {
        id: "ord-schmid-1",
        orderNumber: "A-2026-0480",
        task: "Serie Tischbeine verchromen",
        intakeDate: "2026-05-24T08:00:00Z",
        dueDate: "2026-05-28T08:00:00Z",
        status: "critical",
        statusText: "Kritisch",
        parts: [
          { id: "p-2", name: "Tischbeine", material: "Stahl", finish: "Chrom", location: "Eingang" }
        ]
      }
    ],
    feedbacks: [],
    priceAgreements: [],
    notes: ""
  },

  {
    id: "K-2024-0044",
    customerNumber: "K-2024-0044",
    name: 'Kirche St. Martin',
    
    companyInfo: { industry: 'Kirchliche Einrichtung', size: 'K.A.', founded: '13. Jahrhundert' },
    aiSummary: 'Historische Kirchengemeinde. Aufträge kommen selten, aber umfassen oft sehr alte, unersetzliche Artefakte. Entscheidungen dauern wegen Gremien extrem lange.',
    tags: ['Historisch', 'Gremien-Entscheid', 'Unersetzlich'],
    creditRating: 'AA',
    type: "Institution",
    city: "Basel",
    address: "Münsterplatz 1, 4051 Basel",
    phone: "+41 61 123 45 67",
    email: "pfarramt@st-martin-basel.ch",
    contactPerson: "Pfarrer Thomas",
    prefComm: "Brief / Post",
    communicationPreference: "post",
    customerStatus: "sensitive",
    trustLevel: "very_reliable",
    risk: "Niedrig",
    
    paymentProfile: {
      defaultPaymentMethod: "invoice",
      paymentBehavior: "on_time",
      invoiceNotes: "Rechnung zwingend in Papierform an Pfarramt senden."
    },
    
    approvalProfile: {
      needsWrittenApproval: true,
      usualApprovalTimeDays: 14,
      decisionMaker: "Kirchenrat",
      approvalNotes: "Sitzungen nur alle 2 Wochen. Freigaben dauern sehr lange."
    },

    expectationProfile: {
      qualityExpectation: "museum_quality",
      priceSensitivity: "low",
      communicationStyle: "detailed",
      riskNotes: "Höchste Vorsicht, unersetzliche sakrale Gegenstände."
    },

    technicalProfile: {
      commonMaterials: ["Gold", "Silber", "Messing"],
      commonSurfaces: ["Feinvergoldung", "Poliert"],
      recurringObjectTypes: ["Kelche", "Leuchter", "Kreuze"]
    },

    priceMemory: [],
    recurringItems: [],
    complaintSummary: { totalComplaints: 0, totalReworks: 0, riskLevel: "low" },
    relationshipInsights: [],
    orders: [
      {
        id: "ord-kirche-1",
        orderNumber: "A-2026-0112",
        task: "Altarkreuz neu vergolden",
        intakeDate: "2026-05-10T10:00:00Z",
        dueDate: "2026-06-30T10:00:00Z",
        status: "waiting",
        statusText: "Wartet auf Freigabe",
        parts: [
          { id: "p-3", name: "Altarkreuz 19. Jhd", material: "Messing", finish: "Feinvergoldung", location: "Tresor" }
        ]
      }
    ],
    feedbacks: [],
    priceAgreements: [],
    notes: ""
  },

  {
    id: "K-2026-0099",
    customerNumber: "K-2026-0099",
    name: 'Privatkunde Lenz',
    
    aiSummary: 'Solventer Privatkunde (Oldtimer-Liebhaber). Restaurauriert aktuell einen Porsche 911 Classic. Zahlt pünktlich, diskutiert aber gerne über den Preis.',
    tags: ['Oldtimer', 'Privat', 'Preisbewusst'],
    creditRating: 'A (Privat)',
    type: "Privatkunde",
    city: "Aarau",
    address: "Bahnhofstr. 10, 5000 Aarau",
    phone: "079 888 77 66",
    email: "lenz.peter@example.com",
    contactPerson: "Peter Lenz",
    prefComm: "Telefon",
    communicationPreference: "whatsapp",
    customerStatus: "new",
    trustLevel: "unknown",
    risk: "Hoch",
    riskNote: "Neukunde, Vorkasse empfohlen.",
    
    paymentProfile: {
      defaultPaymentMethod: "cash",
      paymentBehavior: "unknown",
      invoiceNotes: "Barzahlung bei Abholung."
    },
    
    approvalProfile: {
      needsWrittenApproval: true,
      usualApprovalTimeDays: 2,
      decisionMaker: "Peter Lenz",
      approvalNotes: "Per WhatsApp Foto senden, er gibt dann frei."
    },

    expectationProfile: {
      qualityExpectation: "standard",
      priceSensitivity: "high",
      communicationStyle: "needs_guidance",
      riskNotes: "Kunde weiß nicht, dass tiefe Rostnarben nach dem Verchromen noch sichtbar sein können. Aufklärung zwingend!"
    },

    technicalProfile: {
      commonMaterials: ["Gusseisen"],
      commonSurfaces: ["Chrom"],
      recurringObjectTypes: ["Oldtimer-Teile"]
    },

    priceMemory: [],
    recurringItems: [],
    complaintSummary: { totalComplaints: 0, totalReworks: 0, riskLevel: "high" },
    relationshipInsights: [],
    orders: [
      {
        id: "ord-lenz-1",
        orderNumber: "A-2026-0501",
        task: "Oldtimer-Stoßstange verchromen",
        intakeDate: "2026-05-25T10:00:00Z",
        dueDate: "2026-06-10T10:00:00Z",
        status: "active",
        statusText: "In Bearbeitung",
        parts: [
          { id: "p-4", name: "Stoßstange hinten", material: "Gusseisen", finish: "Glanzchrom", location: "Schleiferei" }
        ]
      }
    ],
    feedbacks: [],
    priceAgreements: [],
    notes: "Intern — nicht für Kunden sichtbar:\nHat schon am Telefon stark über Preise diskutiert. Nicht ohne Anzahlung beginnen."
  },

  {
    id: "K-2023-0815",
    customerNumber: "K-2023-0815",
    name: 'Antik Galerie Main',
    
    companyInfo: { industry: 'Kunsthandel', size: '5-15 Mitarbeiter', website: 'antik-main.ch', founded: '1988' },
    aiSummary: 'Etablierte Antik-Galerie. Benötigt oft Serien-Restaurationen (z.B. Kronleuchter-Teile). Sehr verlässlich und unkompliziert.',
    tags: ['B2B', 'Galerie', 'Stammkunde'],
    creditRating: 'A+',
    type: "Geschäftskunde",
    city: "Luzern",
    address: "Seestraße 12, 6000 Luzern",
    phone: "041 555 44 33",
    email: "ankauf@antik-main.ch",
    contactPerson: "Frau Main",
    prefComm: "E-Mail",
    communicationPreference: "email",
    customerStatus: "watch",
    trustLevel: "needs_attention",
    risk: "Hoch",
    riskNote: "Sehr hohe Reklamationsquote bei Polierarbeiten.",
    
    paymentProfile: {
      defaultPaymentMethod: "bank_transfer",
      paymentBehavior: "on_time"
    },
    
    approvalProfile: {
      needsWrittenApproval: true,
      usualApprovalTimeDays: 3,
      decisionMaker: "Frau Main"
    },

    expectationProfile: {
      qualityExpectation: "show_quality",
      priceSensitivity: "medium",
      communicationStyle: "technical",
      riskNotes: "Extrem pingelig bei Glanzgrad. Akzeptiert absolut keine Mikrokratzer."
    },

    technicalProfile: {
      commonMaterials: ["Messing", "Kupfer"],
      commonSurfaces: ["Hochglanz poliert", "Zaponiert"],
      recurringObjectTypes: ["Antike Armaturen", "Türbeschläge"]
    },

    priceMemory: [],
    recurringItems: [],
    complaintSummary: { 
      totalComplaints: 5, 
      totalReworks: 4, 
      lastComplaintAt: "2026-04-15T10:00:00Z",
      mainCauses: ["unclear_expectation", "technical_edge_case"],
      riskLevel: "high" 
    },
    relationshipInsights: [],
    orders: [],
    feedbacks: [
      { id: "fb-1", date: "15.04.2026", type: "negative", text: "Polierrichtung am Türbeschlag war angeblich falsch, Lichtbrechung hat nicht gefallen. 2h nachgearbeitet." }
    ],
    priceAgreements: [],
    notes: "Intern — nicht für Kunden sichtbar:\nVorher-Fotos zwingend in hoher Auflösung machen. Kratzer im Grundmaterial vorher dokumentieren und von ihr per Mail als 'irreversibel' bestätigen lassen!"
  }
];
