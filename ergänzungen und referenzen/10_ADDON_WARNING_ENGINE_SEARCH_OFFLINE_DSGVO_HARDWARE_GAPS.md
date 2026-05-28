# 10 — Querschnittsmodul: Warning Engine, Globale Suche, Offline, DSGVO, Hardware und Strukturkorrekturen

## Zweck dieser Datei

Diese Markdown-Datei ergänzt die bestehende **Kreile WerkstattCockpit App** und schließt Lücken, die in den bisherigen Add-ons (zuletzt 09) nicht oder nur am Rand behandelt wurden. Sie erweitert keine fachliche Domäne neu, sondern führt **Querschnittsmodule** ein, die durch alle bisherigen Module hindurchwirken — vor allem das Prinzip „mitdenkendes System = proaktiv warnend“.

**Grundsatz:** Ergänzung und Querschnitt, kein Neuaufbau. Bestehende Module (Wareneingang, Warendurchlauf, Aufträge, Teile, Kunden, Performance, Einstellungen) bleiben unverändert. Add-on klinkt sich ein.

**Abgrenzung zu kommenden Dateien:**

- **License-/Feature-Toggle-Spec (separat):** Datenmodelle in dieser Datei sehen optional ein Feld `requiredFeatureFlag?: string` vor. Die konkrete Toggle-Logik, Tier-Struktur und Lizenzverwaltung kommt aus der separaten Spec und wird hier nicht dupliziert.
- **Performance-Detailanalyse (separat):** Diese Datei baut die Hooks für Performance-bezogene Warnungen (Warning Engine konsumiert Performance-KPIs) und verweist auf die Performance-Tab-Struktur aus 09 Kapitel 6.4. Die Tiefenanalyse der Performance-Seite kommt aus der separaten Datei.

---

## 1. Zusammenfassung der ergänzten Bereiche

Diese Datei ergänzt 09 um:

1. **Warning Engine** — zentrales Querschnittsmodul für proaktive Warnungen aller Domänen.
2. **Globale Suche als Navigationsersatz** — Suche muss Eingaben wie „Rechnung schreiben“ als Aktion oder Ziel verstehen, nicht nur als Volltextsuche.
3. **Offline-Fähigkeit** — Tablet-Betrieb in Werkstatt mit instabilem WLAN.
4. **DSGVO-Minimum** — bewusst schmal gehalten, nur für Rechnungen und Kundenkontakt. Kein App-internes PII-Tagging, keine Funktionssperren.
5. **Hardware-Integration** — Bondrucker, Etikettendrucker, Scanner, Zahlungsterminal, Kamera.
6. **Onboarding & Nutzerverwaltung** — wo entstehen Nutzerkacheln aus Add-on 09 / Kapitel 5.1.
7. **Notfall-/Degraded-Modus** — App-Verhalten bei DB-, Netz- oder Anbieterausfall.
8. **Kundentypen-Logik** — neu sichtbar aus realer UI (Privatkunde, Gewerbekunde, Oldtimer-Liebhaber, Möbel & Kunst, Stammkunde).
9. **Branchensuche / Internet-Autofill** — bereits in UI sichtbar, aber bisher undokumentiert.
10. **Modulstruktur-Korrektur** — reale Bottom-Navigation weicht von 09-Modulliste ab (Home, Anfragen, Lager, Mehr).

---

## 2. Kontext und Abgrenzung

### 2.1 Konzept „mitdenkendes System“

Das System ist **proaktiv warnend**, nicht reaktiv-erklärend und nicht autonom-handelnd. Konkret bedeutet das:

| Stufe | Verhalten | Status |
|---|---|---|
| Reaktiv-erklärend | System reagiert auf Frage des Nutzers, erklärt Vorgänge | nicht ausreichend |
| **Proaktiv-warnend** | System erkennt Anomalien, Risiken, Inkonsistenzen ohne Aufforderung und meldet sie | **Zielbild V1** |
| Autonom-handelnd | System trifft Entscheidungen ohne Bestätigung | nicht V1 |

V1 ist regelbasiert (Warning Engine mit konfigurierbaren Regeln). KI-gestützte Anomalieerkennung ist V2-Option.

### 2.2 Abgleich mit realer App-Struktur

Aus den Screenshots der laufenden App ergibt sich, dass die reale Bottom-Navigation und die in Add-on 09 dokumentierte Modulliste auseinanderfallen. Die folgende Korrektur ist verbindlich:

| 09-Doku | Bottom-Nav real | Maßnahme |
|---|---|---|
| Heute | Home | Umbenennung in allen folgenden Dateien |
| Wareneingang / Scan / OCR | Scan + Warendurchlauf | aufgesplittet, Wareneingang ist Teil von Warendurchlauf |
| Warendurchlauf | Warendurchlauf | unverändert |
| Aufträge | Aufträge | unverändert |
| Teile | Teile | unverändert |
| Kunden | Kunden | unverändert |
| — | **Anfragen** | neu in Doku führen, Hauptmodul |
| — | **Lager** | neu in Doku führen, Hauptmodul |
| Verzug & Engpässe | unter „Mehr“ | Sekundärnavigation |
| Performance | unter „Mehr“ | Sekundärnavigation |
| Einstellungen | unter „Mehr“ | Sekundärnavigation |

**Begründung „Mehr“-Menü:** Bottom-Nav hat physisch nicht Platz für 11 Einträge. Die häufig genutzten Bereiche (Home, Aufträge, Anfragen, Teile, Kunden, Warendurchlauf, Lager, Scan) sind direkt erreichbar. Performance, Verzug, Einstellungen liegen unter „Mehr“ — sind aber über die globale Suche (siehe Kapitel 4) trotzdem in einem Schritt erreichbar.

### 2.3 Reales Branding

| Element | Wert |
|---|---|
| Firmenname | Galvanik Kreile |
| Tagline | Meisterbetrieb seit 1962 |
| Logo | GK rund, navy |
| Primärfarbe | Navy (etwa `#1A2942`) |
| Sekundärfarbe | Cremebeige (etwa `#F5EFE0`) |
| Akzent | Olivgrün, Dunkelorange punktuell |
| Headline-Font | Serif |
| Body-Font | Sans-serif |

Diese Werte werden für Loginscreen, Warning-Engine-Toasts, E-Mail-Vorlagen und Rechnungen verbindlich verwendet.

---

## 3. Kritische Realisierbarkeitsprüfung

| Bereich | Sofort machbar | Später anspruchsvoller | Risiko |
|---|:-:|:-:|---|
| Warning Engine V1 (regelbasiert) | Ja | Anomalie-KI, Cooldowns, Eskalation | Alert-Müdigkeit bei zu vielen Warnungen |
| Globale Suche mit Intent-Erkennung | Ja | semantische Suche, Lernmodell | Falsche Sprungziele zerstören Vertrauen |
| Offline-Cache lesend | Ja | Offline-Schreiben mit Konflikten | Doppelvergabe von Auftragsnummern |
| DSGVO-Minimum (Rechnungen + Kundenkontakt) | Ja | manuelle DSR-Bearbeitung | keine Funktionssperre, kein App-internes Tagging |
| Bondrucker / Etiketten | Ja, über Anbieter | direkte ESC/POS-Treiber | Hardware-Heterogenität |
| Onboarding-Flow | Ja | Self-Service-Einladung per E-Mail | unklare Rollenvergabe |
| Notfall-Modus | Ja, konzeptionell | echte Failover-Logik | Scheinverlässlichkeit |
| Kundentypen-Logik | Ja | typ-spezifische Pricing-/Rabattregeln | Komplexität in Rechnungen |
| Branchensuche/Autofill | Ja, über Anbieter | eigene Datenpflege | Anbieter-Abhängigkeit, DSGVO bei Drittquellen |

**Wichtigste Schlussfolgerung:**
Die Querschnittsmodule sind realistisch umsetzbar, **wenn zuerst die Warning Engine als Datenstruktur und UI-Skelett steht**. Sie ist die Klammer, an die alle anderen Module andocken. Ohne Warning Engine bleibt jedes Modul für sich stumm — und das System wirkt nicht mitdenkend, sondern nur funktional.

---

## 4. Architekturprinzip für dieses Add-on

```text
Bestehende App
├── Home
├── Aufträge
├── Anfragen
├── Teile
├── Kunden
├── Warendurchlauf  (inkl. Wareneingang / Scan / OCR)
├── Lager
├── Scan
└── Mehr
    ├── Verzug & Engpässe
    ├── Performance
    └── Einstellungen

Neue Querschnittsmodule (dieses Add-on)
├── WarningEngine          ← konsumiert Events aus ALLEN Modulen
├── GlobalSearch           ← liest Index aus ALLEN Modulen + Aktionsverzeichnis
├── OfflineSync            ← kapselt Schreibzugriffe ALLER Module
├── PrivacyMinimum         ← nur Rechnungen und Kundenkontakt
├── HardwareBridge         ← Drucker, Scanner, Terminal
├── OnboardingFlow         ← Nutzerkacheln und Rollen verwalten
├── EmergencyMode          ← Degraded-State erkennen und kommunizieren
└── CustomerTyping         ← Logik je Kundentyp (Privat/Gewerbe/Oldtimer/...)
```

Diese Module sind **Querschnitt**: sie haben keine eigene Hauptnavigation, sondern sind über Aktionen, Indikatoren und Konfiguration aus den Fachmodulen erreichbar.

---

## 5. Datenmodell-Erweiterungen

### 5.1 Warning Engine

> Ziel: zentrales Regel-, Event- und Quittierungssystem für alle proaktiven Warnungen.

```ts
export type WarningDomain =
  | "login"
  | "upload"
  | "stations"
  | "payment"
  | "data"
  | "performance"
  | "backup"
  | "search"
  | "offline"
  | "privacy"
  | "hardware"
  | "onboarding"
  | "emergency"
  | "customer";

export type WarningSeverity = "info" | "warn" | "critical";

export type WarningTriggerType =
  | "threshold"        // Schwellenwert überschritten
  | "anomaly"          // statistische Abweichung
  | "pattern"          // wiederkehrendes Muster
  | "timeout"          // erwartete Aktion blieb aus
  | "missing_data"     // Pflichtfeld leer
  | "drift"            // KPI bewegt sich aus Korridor
  | "expiry"           // Lizenz/Frist/Backup läuft ab
  | "manual";          // explizit angelegt

export type WarningRule = {
  id: string;
  code: string;                       // sprechender Kurzcode, z.B. "BACKUP_STALE_36H"
  domain: WarningDomain;
  severity: WarningSeverity;
  trigger: WarningTriggerType;

  title: string;                      // angezeigter Titel
  description?: string;
  expression: string;                 // serialisierte Regel, JSON-DSL oder Funktionsname
  cooldownMinutes?: number;           // Mindestabstand zwischen gleichen Warnungen
  proposedAction?: string;            // Handlungsempfehlung
  routeOnClick?: string;              // Sprungziel in der App (z.B. "/auftraege/:id")

  isActive: boolean;
  isMutedUntil?: string | null;

  requiredFeatureFlag?: string;       // RESERVIERT: kommt aus License-Feature-Toggle-Spec
  scope?: "global" | "role" | "user"; // wer sieht diese Warnung?

  createdAt: string;
  updatedAt: string;
};

export type WarningEvent = {
  id: string;
  ruleId: string;
  ruleCode: string;

  domain: WarningDomain;
  severity: WarningSeverity;

  entityType?: string;                // z.B. "order", "customer"
  entityId?: string;
  contextData?: Record<string, unknown>;

  message: string;
  proposedAction?: string;
  routeOnClick?: string;

  detectedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgmentNote?: string;

  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolution?: "fixed" | "dismissed" | "deferred" | "false_positive";
};

export type WarningSubscription = {
  id: string;
  userId: string;
  domain: WarningDomain | "all";
  minSeverity: WarningSeverity;
  channels: Array<"in_app" | "email" | "sms" | "push">;
  quietHours?: { fromHour: number; toHour: number };
  isActive: boolean;
};
```

**Regelpflicht:**

- Jede Warnregel muss `code`, `routeOnClick` und `proposedAction` haben. Eine Warnung ohne Sprungziel und Handlungsempfehlung erzeugt Frust statt Hilfe.
- `cooldownMinutes` ist Pflicht für alle Schwellenregeln, sonst entsteht Alert-Spam.
- Eine Warnung gilt erst als bearbeitet, wenn `resolvedAt` gesetzt ist. `acknowledgedAt` ist Zwischenschritt („gesehen, aber noch nicht behoben“).

---

### 5.2 Globale Suche

> Ziel: Suche soll Eingabe „Rechnung schreiben“ als Aktion verstehen und direkt in den Rechnungs-Workflow springen — nicht nur Volltext.

```ts
export type SearchableEntity =
  | "order"
  | "customer"
  | "item"
  | "inquiry"
  | "quote"
  | "invoice"
  | "file"
  | "user";

export type SearchIndexEntry = {
  id: string;
  entityType: SearchableEntity;
  entityId: string;

  primaryLabel: string;               // z.B. "AU-2026-0142"
  secondaryLabel?: string;            // z.B. "Müller GmbH, Stuttgart"
  aliases?: string[];                 // alternative Schreibweisen, z.B. Teilenummer-Varianten
  tags?: string[];

  searchText: string;                 // konkateniertes Suchfeld
  domainTokens?: string[];            // domänenspezifische Token (z.B. "galvanik", "schleifen")

  updatedAt: string;
};

export type SearchAction = {
  id: string;
  code: string;                       // z.B. "ACTION_CREATE_INVOICE"
  label: string;                      // z.B. "Rechnung schreiben"
  synonyms: string[];                 // ["rechnung erstellen", "abrechnen", "fakturieren"]
  routeOnSelect: string;              // z.B. "/auftraege/neu?step=invoice"
  requiredRoles?: string[];
  requiredFeatureFlag?: string;       // RESERVIERT
  icon?: string;
  description?: string;
};

export type SearchSuggestion = {
  type: "entity" | "action" | "recent" | "fuzzy";
  label: string;
  secondary?: string;
  routeOnSelect: string;
  score: number;
  source?: SearchableEntity | "action";
};
```

**Suchverhalten (verbindlich):**

1. Eingabe wird parallel gegen `SearchIndexEntry` und `SearchAction` ausgewertet.
2. Wenn die Top-3 Treffer Aktionen sind, werden sie **über** den Entity-Treffern angezeigt, mit klarer Markierung „Aktion“.
3. Bei null Treffern wird **nie** „keine Ergebnisse“ angezeigt, sondern:
   - Fuzzy-Vorschlag, falls Ähnlichkeit > 0,6
   - „Meinten Sie …?“ mit Top-3 nächstgelegene Tokens
   - Fallback: Sprung in das Modul, das am wahrscheinlichsten passt (z.B. „rechnung schreiben“ → Aufträge mit Filter „abgeschlossen, nicht abgerechnet“)
4. Letzte 10 Sucheingaben werden pro Nutzer gespeichert und als Vorschläge angeboten.

---

### 5.3 Offline-Fähigkeit

> Ziel: Tablet bleibt arbeitsfähig, wenn WLAN ausfällt. Aktionen werden gepuffert und beim Reconnect synchronisiert.

```ts
export type ConnectivityState = "online" | "degraded" | "offline";

export type PendingMutation = {
  id: string;                         // ULID, lokal generiert
  entityType: string;
  entityId: string;                   // ggf. ebenfalls lokale ULID, bis Server-ID vergeben
  operation: "create" | "update" | "delete_soft" | "station_move" | "upload" | "payment_status";

  payload: Record<string, unknown>;
  payloadHash: string;                // zur Idempotenz-Prüfung

  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  syncStatus: "queued" | "syncing" | "synced" | "conflict" | "failed";

  conflictResolution?: "server_wins" | "client_wins" | "manual";
};

export type SyncSession = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  totalMutations: number;
  successCount: number;
  conflictCount: number;
  failureCount: number;
  triggeredBy: "auto" | "manual";
};
```

**Offline-Regeln:**

- Standardmodus ist online. Sobald die App in „degraded“ (langsam) oder „offline“ fällt, wird der Nutzer im Header visuell informiert (kleiner Indikator, kein blockierender Dialog).
- Schreibaktionen werden in `PendingMutation` gepuffert. Lesezugriffe nutzen den letzten lokalen Cache.
- Kritische Schreibaktionen, die niemals offline sicher sind (z.B. Zahlung als bezahlt markieren mit echtem PSP), werden deutlich als „Synchronisation erforderlich“ markiert und nicht endgültig committet.
- Konfliktbehandlung: Server-Wins als Default, mit sichtbarem Hinweis im Audit-Log. Bei kritischen Konflikten (z.B. Auftragsnummer-Kollision) erscheint manuelle Auflösung.

---

### 5.4 DSGVO-Minimum (nur Rechnungen und Kundenkontakt)

> Ziel: Pflichtbestandteile abdecken (Aufbewahrung, Auskunft), **ohne** das App-Innenleben mit PII-Logik zu durchziehen. Keine Funktion wird wegen DSGVO blockiert.

**Geltungsbereich:**

| Bereich | DSGVO-Schicht aktiv? |
|---|:-:|
| Kundenstammdaten (Name, Adresse, Kontakt) | ja |
| Rechnungen und Zahlungen | ja (Steuerrecht zusätzlich) |
| Kundenkommunikation (E-Mail, Telefon-Notiz) | ja |
| Aufträge, Teile, Stationen, Fotos, Werkstattnotizen | **nein** — Werkstattprozess, kein eigenes PII-Tagging |
| Performance, Audit-Log, Backups, Suche | **nein** — interne Mechanik |

**Datenmodell (klein gehalten):**

```ts
export type DataRetentionPolicy = {
  id: string;
  entityType: "invoice" | "payment" | "customer";  // bewusst nur diese drei
  retentionYears: number;                          // 10 (Steuerrecht) oder kundendefiniert
  triggerField: string;                            // z.B. "invoiceDate", "lastContactAt"
  lawfulBasis: string;                             // z.B. "§147 AO", "Art. 6 Abs. 1 lit. b DSGVO"
};

export type DataSubjectRequest = {
  id: string;
  type: "access" | "erasure";                      // nur die zwei häufigsten Fälle
  customerId: string;
  receivedAt: string;
  deadline: string;                                // i.d.R. 30 Tage
  status: "open" | "in_progress" | "done";
  resultNote?: string;                             // freier Text, wie erledigt
  handledBy?: string;
  handledAt?: string;
};
```

**Audit-Log:** Bestehendes `AuditLogEntry` aus 09 / 4.3 wird **nicht erweitert**. Es protokolliert ohnehin Mutationen — das reicht für Auskunftsanfragen zum Kunden, da dort customerId als entityId steht.

**Regeln:**

- Keine PII-Kategorisierung quer durch die App.
- Keine automatische Anonymisierung, keine Konsent-Tabellen, keine Schwergewichts-Workflows.
- Aufbewahrung wirkt **nur** auf Rechnungen, Zahlungen und Kundenstammdaten — nicht auf Aufträge, Stationen, Fotos.
- Eine DSR-Liste in den Einstellungen reicht. Bearbeitung manuell: Inhaber sieht Anfrage, exportiert Kundendaten als CSV, markiert als erledigt.
- Hard-Delete eines Kunden ist **erlaubt**, sofern keine offene Rechnung existiert. Bei vorhandenen Rechnungen wird der Kundendatensatz beim Löschen auf eine minimale Spur reduziert (Name → „Gelöschter Kunde [ID]“, Adresse leer), Rechnungen bleiben referentiell intakt.
- Branchensuche-Abrufe werden **leichtgewichtig** im bestehenden AuditLog protokolliert (`action: "company_lookup"`). Kein separates Konsent-Modell.

**Was bewusst NICHT umgesetzt wird:**

- `PiiCategory` als Markierung durch alle Tabellen.
- `ConsentRecord` für Werbe-/Foto-/Newsletter-Zwecke (nur falls je relevant in eigenem Add-on).
- Automatisierte Auskunfts-/Lösch-Workflows mit Frist-Warnung als blockierende Eskalation.
- App-Bereichsweite Datenschutz-Annotationen.

---

### 5.5 Hardware-Integration

> Ziel: Drucker, Scanner, Terminal sind als adressierbare Geräte modelliert. Kein Hardcoding eines Anbieters.

```ts
export type HardwareDeviceKind =
  | "receipt_printer"     // Bondrucker, ESC/POS
  | "label_printer"       // Etiketten, ZPL/EPL
  | "a4_printer"          // Rechnungsdruck
  | "barcode_scanner"     // USB-HID oder Bluetooth
  | "qr_scanner"
  | "payment_terminal"
  | "scale"               // Waage, falls relevant
  | "camera_external";

export type HardwareDevice = {
  id: string;
  kind: HardwareDeviceKind;
  vendor?: string;
  model?: string;
  connection: "usb" | "bluetooth" | "lan" | "wlan" | "cloud_api";
  identifier?: string;                // Seriennummer, MAC, IP, API-Konto-ID
  stationLabel?: string;              // welcher Arbeitsplatz?
  isDefaultFor?: string;              // z.B. "invoice_print" als Default-Drucker für Rechnungen
  isActive: boolean;
  lastSeenAt?: string;
  capabilities?: string[];            // ["receipt_qr", "auto_cut"]
};

export type PrintJob = {
  id: string;
  deviceId: string;
  jobType: "invoice" | "delivery_note" | "label_item" | "label_order" | "receipt_payment";
  payload: Record<string, unknown>;
  status: "queued" | "printing" | "success" | "failed";
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};
```

**Regeln:**

- Drucker werden in Einstellungen verwaltet, niemals fest verdrahtet.
- Druckaktionen erzeugen `PrintJob`. Fehlgeschlagene Jobs erzeugen eine Warning Engine-Warnung (Domain: `hardware`).
- Etikettenformate sind als Vorlagen austauschbar (ZPL für Zebra, EPL als Fallback).

---

### 5.6 Onboarding / Nutzerverwaltung

> Ziel: Die Nutzerkacheln aus Add-on 09 / Kapitel 5.1 entstehen nicht von selbst. Es braucht einen Workflow.

```ts
export type UserInvite = {
  id: string;
  email?: string;
  displayName: string;
  proposedRole: "admin" | "meister" | "werkstatt" | "buero" | "viewer";

  invitedBy: string;
  invitedAt: string;
  oneTimeCode?: string;               // für PIN-Initialisierung am Tablet
  expiresAt?: string;
  status: "pending" | "accepted" | "expired" | "revoked";
};

export type RolePermission = {
  role: "admin" | "meister" | "werkstatt" | "buero" | "viewer";
  scope:
    | "orders.read"
    | "orders.write"
    | "orders.move_station"
    | "customers.read"
    | "customers.write"
    | "files.upload"
    | "files.delete_soft"
    | "files.delete_hard"
    | "payments.read"
    | "payments.write"
    | "performance.read"
    | "settings.read"
    | "settings.write"
    | "users.manage"
    | "audit.read"
    | "audit.export";
  allowed: boolean;
};
```

**Regeln:**

- Erster Admin wird einmalig in der Initialinstallation festgelegt (Setup-Wizard).
- Weitere Nutzer werden ausschließlich durch einen Nutzer mit `users.manage`-Recht angelegt.
- Nutzerkachel erscheint im Loginscreen **erst nach Annahme der Einladung** (Code-Eingabe + PIN-Setzung).

---

### 5.7 Notfall-/Degraded-Modus

> Ziel: App bleibt bei DB-, Backend- oder Anbieterausfall handlungsfähig oder kommuniziert klar, was nicht geht.

```ts
export type SystemHealthCheck = {
  id: string;
  checkType: "database" | "storage" | "search_index" | "payment_provider" | "email_provider" | "external_api";
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  errorMessage?: string;
  checkedAt: string;
};

export type EmergencyMode = {
  isActive: boolean;
  reason?: string;
  startedAt?: string;
  affectedFeatures: string[];        // z.B. ["payment.online", "search.fuzzy"]
  fallbackBehavior: Record<string, "disabled" | "readonly" | "queued" | "manual">;
};
```

**Regeln:**

- Healthchecks laufen alle 60 s im Hintergrund.
- Bei Ausfall einer Komponente wird das betroffene Feature in den Fallback-Modus geschaltet und der Nutzer im Header informiert.
- Eine kritische Warnung der Warning Engine entsteht automatisch.
- Beispiele:
  - PSP down → Zahlungsbutton wird deaktiviert, Hinweis: „Online-Zahlung temporär nicht verfügbar. Banküberweisung weiterhin möglich.“
  - DB down → komplette App in Read-only, Pending-Mutations puffern lokal.

---

### 5.8 Kundentypen-Logik (NEU aus realer UI)

> Ziel: Die in der UI sichtbaren Kundentypen (Privatkunde, Gewerbekunde, Oldtimer-Liebhaber, Möbel & Kunst, Stammkunde) haben fachliche Konsequenzen, die bisher in keiner Doku stehen.

```ts
export type CustomerType =
  | "private"
  | "business"
  | "oldtimer_fan"
  | "art_furniture"
  | "regular";

export type CustomerTypeConfig = {
  type: CustomerType;
  label: string;

  // Steuerlich
  taxBehavior: "b2c" | "b2b" | "b2b_reverse_charge";
  requiresXRechnung: boolean;         // ab 2025 für B2B in DE relevant

  // Pricing & Rabatt
  defaultDiscountPercent: number;
  allowsCustomQuoting: boolean;       // Sonderkalkulation freigegeben

  // Bedienflow
  defaultCommunicationChannel: "email" | "phone" | "letter";
  requiresExtendedDocumentation: boolean; // Oldtimer/Kunst i.d.R. ja

  // Mahnwesen
  paymentTermDays: number;
  dunningLevelMax: 1 | 2 | 3;

  // Warning Engine-Integration
  warnIfOpenAmountAbove?: number;
};
```

**Regeln pro Typ (Vorschlag, anpassbar):**

| Typ | Steuer | XRechnung | Rabatt | Ext. Doku | Zahlungsziel | Warnung ab |
|---|---|:-:|---:|:-:|---:|---:|
| Privatkunde | b2c | nein | 0 % | nein | 14 Tage | 500 € offen |
| Gewerbekunde | b2b | ja | 0 % | nein | 30 Tage | 2.000 € offen |
| Oldtimer-Liebhaber | b2c | nein | 0 % | ja | 14 Tage | 1.500 € offen |
| Möbel & Kunst | b2c | nein | 0 % | ja | 14 Tage | 1.500 € offen |
| Stammkunde | b2b | ja | 5 % | nein | 30 Tage | 3.000 € offen |

Diese Tabelle gehört verbindlich in die Einstellungen und ist editierbar — die Werte sind keine Naturkonstanten, sondern initiale Defaults.

---

### 5.9 Branchensuche / Internet-Autofill

> Ziel: Der in der UI bereits sichtbare Button „Internet Autofill (Branchensuche)“ ist undokumentiert. Hier wird das Verhalten festgelegt.

```ts
export type CompanyLookupQuery = {
  id: string;
  rawInput: string;                   // z.B. Firmenname + PLZ
  customerId?: string;
  requestedBy?: string;
  requestedAt: string;
};

export type CompanyLookupResult = {
  id: string;
  queryId: string;
  source: "openregister" | "handelsregister" | "google_business" | "manual";
  legalName?: string;
  tradeName?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatId?: string;
  taxId?: string;
  confidence: number;                 // 0..1
  retrievedAt: string;
  rawData?: Record<string, unknown>;
};
```

**Regeln:**

- Vorschläge werden nur eingeblendet, niemals automatisch übernommen.
- DSGVO: Quelle und Abrufzeitpunkt werden geloggt. Nutzer muss explizit „Übernehmen“ klicken.
- Wenn keine Treffer: kein Fehler, sondern Hinweis „Keine Branchendaten gefunden. Bitte manuell eintragen.“

---

## 6. UI-/UX-Anforderungen

### 6.1 Warning Engine in der UI

**Sichtbarkeit:**

- Glocke im Header rechts oben, Badge mit Anzahl unbearbeiteter Warnungen, farbiger Punkt je höchster Severity.
- Klick öffnet Drawer mit Liste nach Severity sortiert.
- Jede Warnung zeigt: Titel, Kontext, Handlungsempfehlung, Sprungziel-Button, Quittieren-Button.
- Kritische Warnungen erscheinen zusätzlich als Toast im Moment der Entstehung.

**Verhalten:**

- Keine modalen Dialoge für Warnungen — Werkstattbetrieb darf nicht blockiert werden.
- Quittierte Warnungen verbleiben sichtbar in einem Tab „Quittiert“ für 7 Tage.
- Resolved Warnungen werden archiviert und sind nur über Suche/Audit auffindbar.

**Anti-Müdigkeit:**

- Pro Regel gilt der `cooldownMinutes`. Innerhalb des Cooldowns wird kein neues Event erzeugt, sondern ein Zähler im bestehenden Event erhöht.
- Mute-Funktion pro Regel (zeitlich begrenzt, mit Audit-Log).

---

### 6.2 Globale Suche

**Sichtbarkeit:**

- Globale Suchleiste ist auf jeder Seite im Header sichtbar (in der App bereits vorhanden, siehe Screenshot).
- Tastenkürzel: `Strg/Cmd + K` öffnet Suche überall.
- Kamera-Icon (in UI bereits sichtbar) ermöglicht Foto-Suche (perspektivisch OCR, MVP: nur Hinweis „Foto-Suche kommt“).

**Vorschlagsverhalten:**

```text
Eingabe: "rechnung schreiben"

Anzeige:
─────────────────────────────────
AKTIONEN
🧾 Rechnung schreiben
   → Neue Rechnung im aktuellen Auftrag
🧾 Rechnung zu Auftrag X erstellen
   → Letzte 3 abgeschlossene, nicht abgerechnete Aufträge
─────────────────────────────────
ZULETZT GEÖFFNET
📄 Rechnung AU-2026-0140
─────────────────────────────────
HILFE
❓ So funktioniert die Rechnungsstellung
```

**Pflichten:**

- Niemals „Keine Ergebnisse gefunden“ — immer mindestens ein Fallback (Aktion oder Hilfeseite).
- Suchverlauf je Nutzer (lokal + im Backend), löschbar in Einstellungen.
- Aktionen, die wegen fehlender Rolle/Feature nicht verfügbar sind, werden gegraut mit Hinweis dargestellt — nicht ausgeblendet.

---

### 6.3 Offline-Indikator

**Sichtbarkeit:**

```text
Header rechts:
[●] online
[◐] langsam (degraded)
[○] offline — N Aktionen warten auf Synchronisation
```

Klick auf den Indikator öffnet Drawer mit Liste der Pending-Mutations, Statusanzeige, Retry-Button.

**Pflichten:**

- Keine fortlaufenden Toast-Spams bei Verbindungsschwankung.
- Schreibaktionen, die offline nicht erlaubt sind, sind klar mit Hinweis blockiert.
- Beim Reconnect: dezenter Hinweis „X Aktionen synchronisiert“, kein Modal.

---

### 6.4 Hardware-Drucker im Auftrag

**Rechnung versenden / drucken:**

```text
[Per E-Mail senden]   → Standard
[Drucken auf Standard-Drucker]  → kein Picker, druckt sofort
[Drucker wählen]      → Geräteliste aus HardwareDevice
[Etikett für Versand]  → Etikettendrucker, ESC/POS oder ZPL
```

Druckaktion erzeugt `PrintJob`. Bei Fehler: Warning Engine Domain `hardware`.

---

### 6.5 Kundentypen im Anlege-Wizard

**Bereits sichtbar** (Screenshot Schritt 3 von 4):

```text
Kundentyp (PFLICHT)
[ Privatkunde ]  [ Gewerbekunde ]  [ Oldtimer-Liebhaber ]
[ Möbel & Kunst ]  [ Stammkunde ]
```

**Erweiterung:**

- Nach Auswahl erscheint **eine** Zeile mit den abgeleiteten Konsequenzen, z.B.:
  - Privatkunde: „Rechnung als B2C, Zahlungsziel 14 Tage.“
  - Gewerbekunde: „Rechnung als B2B inkl. XRechnung-Vorbereitung, Zahlungsziel 30 Tage.“
- Diese Zeile ist nicht modal, sondern als ruhiger Hinweis unter der Auswahl.

---

### 6.6 Branchensuche

```text
Kundenprofil vervollständigen
[🔍 Internet Autofill (Branchensuche)]
   → wenn geklickt: Suchdialog mit aktueller Adresseingabe vorbelegt

Bei Treffer:
─────────────────────────────────
Mustermann GmbH — Industriestr. 65, 79544 Stuttgart
Quelle: Handelsregister · Vertrauenswert 0,82
[Übernehmen]  [Verwerfen]  [Andere Quelle]
─────────────────────────────────
```

---

## 7. Warning-Engine-Regelkatalog (V1)

Folgende Regeln werden initial ausgeliefert. Jede ist im Code als benannte Funktion implementierbar.

### 7.1 Domain: login

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `LOGIN_BRUTEFORCE` | threshold | critical | 5 PIN-Fehlversuche/Kachel in 2 min | „Kachel temporär sperren, Admin informieren?“ |
| `SESSION_INACTIVE_30M` | timeout | info | Session > 30 min inaktiv | „Automatisch ausloggen?“ |
| `MULTIPLE_SESSIONS_SAME_USER` | pattern | warn | Gleicher Nutzer auf > 2 Geräten | „Bekannt oder verdächtig?“ |

### 7.2 Domain: upload

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `UPLOAD_DUPLICATE_HASH` | pattern | info | Datei mit gleichem Hash existiert | „Bestehende Datei ansehen?“ |
| `UPLOAD_VIRUS_FLAG` | threshold | critical | Virenscan positiv | „Datei in Quarantäne verschieben“ |
| `UPLOAD_OVERLOAD` | threshold | info | Auftrag > 50 Dateien | „Liste aufräumen oder archivieren?“ |
| `UPLOAD_MISSING_CATEGORY` | missing_data | warn | Datei ohne Kategorie | „Kategorie nachtragen“ |

### 7.3 Domain: stations

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `STATION_PING_PONG` | pattern | warn | Auftrag heute > 3x verschoben | „Ist Reihenfolge falsch geplant?“ |
| `STATION_SKIPPED` | pattern | info | Station übersprungen | „Bewusst übersprungen?“ |
| `STATION_MISSING_PHOTO` | missing_data | warn | Verschoben ohne Pflichtfoto | „Foto jetzt nachholen“ |
| `STATION_BLOCKED_RELEASE` | missing_data | critical | Verschoben ohne Kundenfreigabe | „Rückgängig machen“ |
| `STATION_CONCURRENT_MOVE` | pattern | warn | Gleicher Auftrag gleichzeitig von 2 Geräten | „Konflikt manuell prüfen“ |

### 7.4 Domain: payment

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `PAYMENT_OVERDUE_14D` | timeout | warn | Rechnung 14 Tage offen | „Erinnerung versenden“ |
| `PAYMENT_OVERDUE_30D` | timeout | critical | Rechnung 30 Tage offen | „Mahnstufe 1 versenden“ |
| `PAYMENT_CUSTOMER_RISK` | threshold | warn | Kunde > 3 offene Rechnungen | „Neuen Auftrag freigeben?“ |
| `PAYMENT_B2B_NO_XRECHNUNG` | missing_data | warn | B2B-Rechnung ohne XRechnung-Format | „Format ergänzen“ |
| `PAYMENT_PSP_DOWN` | drift | critical | PSP-Healthcheck failed | „Fallback aktivieren“ |

### 7.5 Domain: data

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `DATA_QUALITY_FORECAST_LOW` | threshold | info | < 30 Aufträge in Forecast-Basis | „Forecast als unsicher kennzeichnen“ |
| `DATA_REWORK_DOUBLED` | drift | warn | Reklamationsquote 2× ggü. Vormonat | „Ursachenanalyse starten“ |
| `DATA_DOCUMENTATION_DROP` | drift | warn | Fotodokuquote < 80 % | „Werkstatt erinnern“ |

### 7.6 Domain: backup

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `BACKUP_STALE_36H` | timeout | critical | Letztes erfolgreiches Backup > 36 h | „Manuelles Backup starten“ |
| `BACKUP_SIZE_DRIFT` | drift | warn | Backup heute < 60 % von gestern | „Datenverlust prüfen“ |
| `BACKUP_RESTORE_TEST_OVERDUE` | timeout | warn | Letzter Restore-Test > 30 Tage | „Restore-Test einplanen“ |

### 7.7 Domain: search

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `SEARCH_NO_RESULT_RATE_HIGH` | drift | info | > 20 % Nullsuchen in 24 h | „Index oder Synonymliste prüfen“ |

### 7.8 Domain: privacy

Beide Regeln gelten **nur** für Kundendaten und Rechnungen, niemals für App-Innenleben.

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `DSR_DEADLINE_NEAR` | timeout | info | Auskunfts-/Löschanfrage < 5 Tage bis Deadline | „Bearbeitung einplanen“ |
| `RETENTION_EXPIRED_INVOICE` | expiry | info | Aufbewahrungsfrist einer Rechnung abgelaufen | „Datensatz kann archiviert werden“ |

### 7.9 Domain: hardware

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `PRINTER_JOB_FAILED` | threshold | warn | Druckauftrag fehlgeschlagen | „Drucker prüfen“ |
| `DEVICE_OFFLINE_24H` | timeout | info | Gerät seit 24 h nicht erreichbar | „Verbindung prüfen“ |

### 7.10 Domain: customer

| Code | Trigger | Severity | Bedingung | Vorschlag |
|---|---|---|---|---|
| `CUSTOMER_OPEN_OVER_LIMIT` | threshold | warn | Offene Forderungen > typ-spezifischer Grenze | „Auftragsfreigabe prüfen“ |
| `CUSTOMER_NO_CONTACT_DETAILS` | missing_data | info | E-Mail und Telefon fehlen | „Kontakt nachpflegen“ |

---

## 8. Performance-Hooks (Vorbereitung für separate Datei)

> Diese Sektion baut **nur die Datenhooks**, nicht die UI oder Tabs der Performance-Seite. Letztere wird in der separaten Performance-Analyse-Datei detailliert.

Die Warning Engine konsumiert die folgenden Werte aus dem Performance-Subsystem (vermutlich `PerformanceSnapshot` aus 09 / 4.6):

| Wert | Warnregel-Code | Bemerkung |
|---|---|---|
| `reworkRate` | `DATA_REWORK_DOUBLED` | Drift-Erkennung |
| `documentationRate` | `DATA_DOCUMENTATION_DROP` | Schwellwert |
| `onTimeRate` | `PERF_ONTIME_DROP` | optional, Schwellwert |
| `averageLeadTimeHours` | `PERF_LEADTIME_DRIFT` | Drift |
| `strongestBottleneckStationId` | `PERF_BOTTLENECK_PERSISTENT` | wenn an > 3 Tagen gleich |
| `openInvoiceAmountTotal` | `PAYMENT_OPEN_TOTAL_HIGH` | Schwellwert |

**Vertrag mit kommender Performance-Datei:**

- Das Performance-Modul stellt einen Service `getCurrentPerformanceSnapshot()` bereit.
- Die Warning Engine fragt diesen Service zyklisch ab (z.B. alle 15 min) und vergleicht mit den letzten 7/30 Tagen.
- Welche Tabs, Charts, Forecasts und Exports im Performance-Bereich existieren, ist **nicht Gegenstand dieser Datei**.

---

## 9. Umsetzung in Antigravity: token-sparender Plan

### Phase 0 — Sicherheitscheckpoint

```text
Prüfe git status. Wenn Arbeitsbaum sauber ist, erstelle Checkpoint-Commit oder Tag „pre-addon-10“.
```

### Phase 1 — Datenmodelle und Mockdaten

```text
Lege Types und Mockdaten für die neuen Querschnittsmodule an:
WarningRule, WarningEvent, WarningSubscription
SearchIndexEntry, SearchAction
PendingMutation, SyncSession
DataRetentionPolicy, DataSubjectRequest        // nur für Rechnungen/Zahlungen/Kundenstamm
HardwareDevice, PrintJob
UserInvite, RolePermission
SystemHealthCheck, EmergencyMode
CustomerTypeConfig
CompanyLookupQuery, CompanyLookupResult

Keine bestehenden Types verändern. Keine UI berühren.
```

Zieldateien:

```text
src/types/warnings.ts
src/types/search.ts
src/types/offline.ts
src/types/privacy.ts
src/types/hardware.ts
src/types/onboarding.ts
src/types/emergency.ts
src/types/customerType.ts
src/types/companyLookup.ts

src/data/mockWarnings.ts
src/data/mockSearchIndex.ts
src/data/mockSearchActions.ts
src/data/mockHardwareDevices.ts
src/data/mockCustomerTypes.ts
```

### Phase 2 — Warning Engine Kern

```text
Implementiere die Warning Engine:
- Ruleregister mit den Regeln aus Kapitel 7
- Event-Bus, der Domain-Events aus bestehenden Modulen entgegennimmt
- Storage für WarningEvents (lokal mockbar)
- Cooldown- und Mute-Logik
- React-Hook useWarnings(domain?) für UI-Komponenten

Keine bestehenden Module verändern. Die Engine empfängt nur Events.
```

Zieldateien:

```text
src/lib/warnings/ruleRegistry.ts
src/lib/warnings/engine.ts
src/lib/warnings/eventBus.ts
src/lib/warnings/store.ts
src/lib/warnings/hooks.ts
src/components/warnings/WarningBell.tsx
src/components/warnings/WarningDrawer.tsx
src/components/warnings/WarningToast.tsx
```

### Phase 3 — Globale Suche mit Intent

```text
Erweitere die bestehende Suchleiste:
- SearchActionRegistry mit den initialen Aktionen (rechnung_schreiben, kunde_anlegen, scan_starten, etc.)
- Synonym-/Fuzzy-Matching auf Aktionen UND Entities
- Vorschlags-Dropdown mit Sektionen: Aktionen | Entities | Zuletzt | Hilfe
- Niemals „Keine Ergebnisse“ — immer Fallback-Vorschlag
- Strg/Cmd+K Hotkey

Bestehende Suchleisten-UI nicht ersetzen. Nur ihr Verhalten und Dropdown austauschen.
```

Zieldateien:

```text
src/lib/search/actionRegistry.ts
src/lib/search/index.ts
src/lib/search/fuzzy.ts
src/lib/search/recent.ts
src/components/search/GlobalSearchBar.tsx
src/components/search/SearchSuggestionList.tsx
src/components/search/SearchSuggestionItem.tsx
```

### Phase 4 — Offline-Schicht

```text
Implementiere PendingMutation-Queue und SyncSession:
- ConnectivityState-Listener (navigator.onLine + heuristisches Ping)
- Persistenz in IndexedDB
- Wrapper für alle Schreibaktionen (createOrder, moveStation, uploadFile, etc.)
- Reconnect-Logik mit Idempotenz-Prüfung über payloadHash

UI:
- Offline-Indikator im Header
- Drawer mit Pending-Liste

Server-Wins als Default-Konflikt-Strategie. Manuelle Auflösung für Auftragsnummer-Kollisionen.
```

Zieldateien:

```text
src/lib/offline/connectivity.ts
src/lib/offline/queue.ts
src/lib/offline/sync.ts
src/lib/offline/storage.ts
src/components/offline/OfflineIndicator.tsx
src/components/offline/PendingDrawer.tsx
```

### Phase 5 — DSGVO-Minimum (Rechnungen + Kundenkontakt)

```text
- DataRetentionPolicy NUR für entityType "invoice", "payment", "customer"
- Defaults: Rechnungen/Zahlungen 10 Jahre (Steuerrecht), Kundenstammdaten editierbar (Default 10 Jahre)
- DSR-Inbox als einfache Liste in Einstellungen (Anfragen manuell anlegen, Status "open"/"in_progress"/"done")
- CSV-Export der Kundendaten für Auskunftsanfrage (Stammdaten + verknüpfte Rechnungen)
- Hard-Delete-Kunde erlaubt, aber: bei verknüpften Rechnungen wird Kunde auf "Gelöschter Kunde [ID]" reduziert, Rechnungen bleiben intakt
- Branchensuche-Abrufe werden im bestehenden AuditLog mit action: "company_lookup" protokolliert

KEINE App-weiten PII-Tags. KEIN ConsentRecord. KEINE blockierenden Workflows.
```

Zieldateien:

```text
src/lib/privacy/retention.ts
src/lib/privacy/dsr.ts
src/lib/privacy/customerExport.ts
src/components/settings/DsrInbox.tsx
src/components/settings/RetentionSettings.tsx
```

### Phase 6 — Hardware-Bridge

```text
- HardwareDevice-CRUD in Einstellungen
- PrintJob-Queue mit Retry
- Adapter für Bondrucker (ESC/POS via WebUSB), Etikettendrucker (ZPL als String), A4-Drucker (window.print + PDF)
- Default-Gerät pro JobType

Kein echter Hardware-Treiber zwingend für MVP — Mocks für UI-Akzeptanz reichen.
```

Zieldateien:

```text
src/lib/hardware/registry.ts
src/lib/hardware/printQueue.ts
src/lib/hardware/adapters/escpos.ts
src/lib/hardware/adapters/zpl.ts
src/lib/hardware/adapters/a4.ts
src/components/settings/HardwareSettings.tsx
src/components/print/PrintDialog.tsx
```

### Phase 7 — Onboarding & Rollen

```text
- UserInvite-Workflow: Admin lädt ein, Code wird per Mail oder Aushang generiert
- Onboarding-Wizard im Tablet: Code eingeben, PIN setzen, Kachel erscheint
- RolePermission-Matrix in Einstellungen
- Erster Admin wird im allerersten Start gesetzt (Setup-Wizard)

Bestehende Login-Logik aus Add-on 09 nicht ersetzen — nur ergänzen.
```

Zieldateien:

```text
src/lib/onboarding/invites.ts
src/lib/onboarding/setupWizard.ts
src/lib/permissions/matrix.ts
src/components/onboarding/InviteUserDialog.tsx
src/components/onboarding/AcceptInviteScreen.tsx
src/components/settings/RoleMatrixEditor.tsx
src/components/settings/UserManagement.tsx
```

### Phase 8 — Notfall-/Degraded-Modus

```text
- SystemHealthCheck-Service mit Intervall 60s
- EmergencyMode-State im globalen Store
- Header-Banner bei aktivem Notfall-Modus
- Pro Feature: Fallback-Behavior aus EmergencyMode.fallbackBehavior konsumieren

Healthchecks zunächst nur für: Datenbank, Storage, Search-Index, ein PSP-Mock.
```

Zieldateien:

```text
src/lib/health/checks.ts
src/lib/health/store.ts
src/lib/health/emergencyMode.ts
src/components/health/EmergencyBanner.tsx
src/components/health/HealthStatusPanel.tsx
```

### Phase 9 — Kundentypen-Konsequenzen

```text
- CustomerTypeConfig-Tabelle in Einstellungen
- Wizard-Schritt 3 ergänzt um Konsequenzen-Hinweis nach Auswahl
- Default-Pricing/Zahlungsziel/Rabatt pro Typ in Auftragsanlage konsumieren
- B2B-Typen lösen XRechnung-Vorbereitung aus

Bestehende Kundentypen-Auswahl (UI-Buttons) nicht ändern.
```

Zieldateien:

```text
src/lib/customerType/registry.ts
src/lib/customerType/consequences.ts
src/components/customers/CustomerTypeConsequences.tsx
src/components/settings/CustomerTypeSettings.tsx
```

### Phase 10 — Branchensuche

```text
- CompanyLookup-Service mit Provider-Abstraktion (OpenRegister, Handelsregister, GoogleBusiness)
- UI-Dialog mit Trefferliste, Vertrauenswert, Quellenangabe
- DSGVO-konforme Protokollierung jedes Abrufs in AuditLog
- Übernahme nur per Klick, nie automatisch

MVP: Mock-Provider mit Beispieldaten reicht. Echte Anbieter in eigener Anbindung später.
```

Zieldateien:

```text
src/lib/companyLookup/service.ts
src/lib/companyLookup/providers/mock.ts
src/lib/companyLookup/providers/openregister.ts
src/components/customers/CompanyLookupDialog.tsx
```

---

## 10. Coding-Hilfen

### 10.1 Warning-Regel-Auswertung

```ts
export function evaluateRule(
  rule: WarningRule,
  context: Record<string, unknown>
): WarningEvent | null {
  if (!rule.isActive) return null;
  if (rule.isMutedUntil && new Date(rule.isMutedUntil) > new Date()) return null;

  const ruleFn = ruleRegistry[rule.code];
  if (!ruleFn) return null;

  const result = ruleFn(context);
  if (!result.triggered) return null;

  return {
    id: ulid(),
    ruleId: rule.id,
    ruleCode: rule.code,
    domain: rule.domain,
    severity: rule.severity,
    entityType: result.entityType,
    entityId: result.entityId,
    contextData: result.contextData,
    message: result.message ?? rule.title,
    proposedAction: rule.proposedAction,
    routeOnClick: rule.routeOnClick,
    detectedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
  };
}
```

### 10.2 Cooldown-Check

```ts
export function isInCooldown(
  rule: WarningRule,
  lastEventAt: string | undefined
): boolean {
  if (!rule.cooldownMinutes || !lastEventAt) return false;
  const elapsedMs = Date.now() - new Date(lastEventAt).getTime();
  return elapsedMs < rule.cooldownMinutes * 60 * 1000;
}
```

### 10.3 Such-Intent-Erkennung

```ts
export function findActions(
  input: string,
  actions: SearchAction[]
): SearchSuggestion[] {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return [];

  const scored = actions
    .map((a) => {
      const candidates = [a.label.toLowerCase(), ...a.synonyms.map((s) => s.toLowerCase())];
      const bestScore = Math.max(...candidates.map((c) => tokenOverlap(c, normalized)));
      return { action: a, score: bestScore };
    })
    .filter((x) => x.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ action, score }) => ({
    type: "action",
    label: action.label,
    routeOnSelect: action.routeOnSelect,
    score,
    source: "action",
  }));
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/));
  const tb = new Set(b.split(/\s+/));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}
```

### 10.4 Offline-Queue-Idempotenz

```ts
export async function enqueueMutation(
  m: Omit<PendingMutation, "id" | "payloadHash" | "attempts" | "syncStatus" | "createdAt">
): Promise<PendingMutation> {
  const payloadHash = await sha256(JSON.stringify(m.payload));

  const existing = await offlineDb.pendingMutations
    .where("payloadHash").equals(payloadHash).first();

  if (existing) return existing;

  const pending: PendingMutation = {
    id: ulid(),
    ...m,
    payloadHash,
    attempts: 0,
    syncStatus: "queued",
    createdAt: new Date().toISOString(),
  };
  await offlineDb.pendingMutations.add(pending);
  return pending;
}
```

### 10.5 Kundentyp-Konsequenzen ableiten

```ts
export function getCustomerConsequences(type: CustomerType): {
  paymentTermDays: number;
  taxBehavior: "b2c" | "b2b" | "b2b_reverse_charge";
  requiresXRechnung: boolean;
  defaultDiscount: number;
  message: string;
} {
  const config = customerTypeRegistry[type];
  return {
    paymentTermDays: config.paymentTermDays,
    taxBehavior: config.taxBehavior,
    requiresXRechnung: config.requiresXRechnung,
    defaultDiscount: config.defaultDiscountPercent,
    message: buildConsequenceMessage(config),
  };
}

function buildConsequenceMessage(c: CustomerTypeConfig): string {
  const taxLabel = c.taxBehavior === "b2b" ? "B2B" : "B2C";
  const xr = c.requiresXRechnung ? ", XRechnung-Vorbereitung" : "";
  return `Rechnung als ${taxLabel}${xr}, Zahlungsziel ${c.paymentTermDays} Tage.`;
}
```

### 10.6 Healthcheck mit Fallback-Aktivierung

```ts
export async function runHealthcheck(): Promise<SystemHealthCheck[]> {
  const checks = [
    checkDatabase(),
    checkStorage(),
    checkSearchIndex(),
    checkPaymentProvider(),
  ];
  const results = await Promise.all(checks);

  const degraded = results.filter((r) => r.status !== "healthy");
  if (degraded.length > 0) {
    activateEmergencyMode({
      reason: degraded.map((d) => `${d.checkType}: ${d.errorMessage ?? d.status}`).join("; "),
      affectedFeatures: degraded.map((d) => mapCheckToFeature(d.checkType)),
    });
  } else {
    deactivateEmergencyMode();
  }

  return results;
}
```

### 10.7 Konsequenz nach Suchergebnis-Null

```ts
export function buildFallbackSuggestion(input: string): SearchSuggestion[] {
  const normalized = input.toLowerCase();

  // 1. Modul-Sprung anhand Keyword
  const modules = [
    { keys: ["rechnung", "abrechnen", "faktur"], route: "/auftraege?filter=billable", label: "Abrechenbare Aufträge öffnen" },
    { keys: ["kunde", "anlegen"], route: "/kunden/neu", label: "Neuen Kunden anlegen" },
    { keys: ["auftrag", "neu"], route: "/auftraege/neu", label: "Neuen Auftrag anlegen" },
    { keys: ["scan", "barcode"], route: "/scan", label: "Scan starten" },
    { keys: ["mahnung", "offen"], route: "/auftraege?filter=overdue", label: "Überfällige Rechnungen" },
  ];

  for (const m of modules) {
    if (m.keys.some((k) => normalized.includes(k))) {
      return [{
        type: "fuzzy",
        label: m.label,
        secondary: "Direktsprung zum passenden Modul",
        routeOnSelect: m.route,
        score: 0.5,
      }];
    }
  }

  // 2. Letzter Fallback: Hilfeseite
  return [{
    type: "fuzzy",
    label: "Suchhilfe öffnen",
    secondary: "Tipps zur Suche, Beispiele und Synonyme",
    routeOnSelect: "/hilfe/suche",
    score: 0.1,
  }];
}
```

---

## 11. Akzeptanzkriterien

### Warning Engine

- Glocke im Header sichtbar mit Badge-Zahl.
- Drawer zeigt Warnungen sortiert nach Severity.
- Jede Warnung hat Sprungziel-Button und Quittieren-Button.
- Quittierte Warnungen sind 7 Tage in einem Tab erreichbar.
- Cooldown verhindert Mehrfach-Toasts derselben Regel.
- Mute-Funktion ist auditierbar (AuditLogEntry mit `action: "warning_muted"`).
- Mindestens 15 Regeln aus Kapitel 7 sind ausgeliefert und aktiv.
- Keine modalen Dialoge für Warnungen.

### Globale Suche

- Eingabe „rechnung schreiben“ liefert mindestens eine Aktion als Top-Treffer.
- Eingabe ohne Treffer liefert nie „keine Ergebnisse“, sondern mindestens einen Fallback-Vorschlag.
- Strg/Cmd+K öffnet Suche überall.
- Letzte 10 Sucheingaben werden je Nutzer angezeigt.
- Aktionen ohne Berechtigung sind gegraut mit Hinweis, nicht ausgeblendet.

### Offline-Fähigkeit

- Offline-Indikator zeigt korrekten Zustand (online/degraded/offline).
- Schreibaktionen erzeugen `PendingMutation` bei Offline.
- Beim Reconnect werden Mutations synchronisiert, Statusanzeige aktualisiert.
- Doppelte Aktionen werden durch `payloadHash` deduppliziert.
- Konflikte werden im Audit-Log dokumentiert.

### Privacy (Minimum)

- DSR-Inbox in Einstellungen als einfache Liste sichtbar.
- Auskunftsanfrage führt zu CSV-Export von Kundenstammdaten + verknüpften Rechnungen.
- Aufbewahrungsfristen sind editierbar für die drei Entitäten Rechnung, Zahlung, Kunde — sonst nirgends.
- Hard-Delete-Kunde mit offenen Rechnungen reduziert Kunde auf „Gelöschter Kunde [ID]“, Rechnungen bleiben intakt.
- Branchensuche-Abruf erscheint im bestehenden AuditLog.
- **Keine** Funktion wird wegen DSGVO blockiert oder ausgeschaltet.

### Hardware

- Gerätekonfiguration in Einstellungen mit Test-Druck-Button.
- PrintJob-Liste mit Statusanzeige.
- Fehlerhafte Jobs erzeugen Warning Engine-Event.
- Bondrucker druckt Quittung für Vor-Ort-Zahlung als Mock-Ausgabe.

### Onboarding

- Einladung erzeugt Code, der Nutzer kann am Tablet eingeben und PIN setzen.
- Erst nach Annahme erscheint Nutzerkachel im Loginscreen.
- Rolle ist vor erstem Login bereits gesetzt.

### Notfallmodus

- Bei simuliertem PSP-Ausfall wird Zahlungsbutton deaktiviert mit Hinweis.
- Banner im Header sichtbar bei aktivem Notfall.
- Healthcheck-Ergebnisse sind in Einstellungen einsehbar.

### Kundentypen

- Nach Auswahl des Typs erscheint Konsequenzen-Hinweis (eine ruhige Zeile).
- Default-Zahlungsziel, Steuerverhalten und XRechnung-Flag werden in Auftrag und Rechnung übernommen.
- Defaults sind in Einstellungen editierbar.

### Branchensuche

- Trefferliste mit Quelle und Vertrauenswert.
- Übernahme nur per expliziten Klick.
- Jeder Abruf im AuditLog.

---

## 12. Nicht umsetzen / vermeiden

- Keine modalen Warnungs-Dialoge — Werkstattbetrieb darf nicht blockiert werden.
- Keine „Keine Ergebnisse gefunden“-Meldung in der Suche.
- Kein automatisches Übernehmen von Branchensuche-Treffern.
- Kein Hardcoding einzelner Drucker- oder PSP-Marken.
- Keine eigene Toggle-/Lizenz-Spec in dieser Datei — kommt aus separater Datei.
- Keine eigene Performance-Tab-Spezifikation — kommt aus separater Datei.
- Kein Anlegen von Nutzerkacheln ohne Onboarding-Flow.
- Keine Offline-Schreibaktion für kritische Zahlungsvorgänge.
- **Keine PII-Markierung quer durch die App** — DSGVO nur für Rechnungen und Kundenkontakt.
- **Keine Funktionssperre wegen DSGVO** — die App bleibt voll bedienbar.
- Keine Konsent-Tabellen, keine automatischen Anonymisierungs-Workflows.
- Keine Sammlung von Daten aus Drittquellen (Branchensuche) ohne Protokollierung.

---

## 13. Empfohlener Kurzprompt für Antigravity

```text
Lies 10_ADDON_WARNING_ENGINE_SEARCH_OFFLINE_DSGVO_HARDWARE_GAPS.md als Ergänzung zur bestehenden Kreile WerkstattCockpit App. Setze nichts neu auf und ersetze keine funktionierenden Seiten. Arbeite als Querschnitts-Add-on in dieser Reihenfolge: zuerst Types und Mockdaten, dann Warning Engine (Bell, Drawer, Toast, Ruleregistry mit den 25+ Regeln aus Kapitel 7), dann globale Suche mit Intent-Erkennung (niemals „keine Ergebnisse“ anzeigen, immer Fallback-Vorschlag), dann Offline-Schicht mit PendingMutation-Queue, dann DSGVO-Minimum (NUR für Rechnungen, Zahlungen, Kundenstammdaten — kein App-weites PII-Tagging, keine Konsent-Tabellen, keine Funktionssperren), dann Hardware-Bridge mit PrintJob-Queue, dann Onboarding/Rollen-Matrix, dann Notfall-/Degraded-Modus mit Healthchecks, dann Kundentypen-Konsequenzen-UI im Wizard, dann Branchensuche-Service. Bestehende Bottom-Navigation (Home, Aufträge, Anfragen, Teile, Kunden, Warendurchlauf, Lager, Scan, Mehr) bleibt unverändert. Bestehende Suchleiste wird nur im Verhalten erweitert, nicht ersetzt. Bestehende Kundentypen-Auswahl bleibt visuell unverändert, nur die Konsequenzen-Zeile darunter ist neu. Reservierte Felder `requiredFeatureFlag?: string` bleiben leer, bis die License-Feature-Toggle-Spec kommt. Performance-Hooks aus Kapitel 8 werden gegen den Service `getCurrentPerformanceSnapshot()` aus dem Performance-Modul verdrahtet — die Tab-Struktur der Performance-Seite bleibt aus 09 Kapitel 6.4 unverändert, bis die separate Performance-Analyse-Datei eintrifft. DSGVO darf keine App-Funktion blockieren.
```

---

## 14. Quellen- und Technikhinweise für spätere Prüfung

Diese Punkte dienen Antigravity / Claude Code nur zur Einordnung. Vor echter Integration erneut prüfen.

- **IndexedDB** über `idb` oder `Dexie` für Offline-Queue, da localStorage nicht skaliert.
- **ULID** statt UUID für lokale IDs, weil sortierbar.
- **Fuse.js** oder eigene Fuzzy-Logik für Such-Intent. MVP eigene Implementation, später Fuse.js prüfen.
- **WebUSB** für direkte ESC/POS-Drucker, alternativ Cloud-Druck über Anbieter wie PrintNode.
- **Service Worker** für echte Offline-Fähigkeit. MVP reicht navigator.onLine.
- **OpenRegister.de** oder kostenpflichtige Handelsregister-APIs für Branchensuche. MVP Mock-Provider.
- **DSGVO**: Nur für Rechnungen, Zahlungen, Kundenstammdaten. Kein App-weites PII-Tagging, keine Konsent-Tabellen. CSV-Export der Kundendaten reicht als Auskunft.
- **XRechnung-Bibliothek** für B2B-Rechnungen: `@xrechnung/builder` oder vergleichbar.
- **Restore-Test-Automatisierung** über Supabase CLI oder eigenes Skript, monatlich.
- **Healthcheck-Service** kann am Anfang als reine Frontend-Heuristik laufen (ping + timeout), echter Server-Check folgt mit Backend-Reife.

---

## 15. Priorisierte Reihenfolge

| Priorität | Umsetzung | Grund |
|---:|---|---|
| 1 | Types/Mockdaten für alle Querschnittsmodule | Grundlage ohne Risiko |
| 2 | Warning Engine Kern + 5 Top-Regeln | Sofortwirkung „mitdenkend“ |
| 3 | Globale Suche mit Intent-Erkennung | Behebt akuten Pain Point („rechnung schreiben“) |
| 4 | Kundentypen-Konsequenzen | UI bereits da, Logik fehlt |
| 5 | Onboarding-Flow | Voraussetzung für saubere Nutzerverwaltung |
| 6 | Offline-Schicht (lesend) | Sicherheit im Werkstattalltag |
| 7 | DSGVO-Minimum (Rechnungen + Kundenkontakt) | Pflichtteil, schlank gehalten |
| 8 | Hardware-Bridge (A4-Druck, Mock-Etikett) | Rechnungsdruck ist Alltag |
| 9 | Notfall-/Degraded-Modus | Erst sinnvoll mit echtem Backend |
| 10 | Branchensuche (Mock-Provider) | UI bereits da, Logik fehlt |
| 11 | Warning Engine Vollausbau (alle Regeln) | nach Stabilität der ersten Regeln |
| 12 | Offline-Schicht (schreibend mit Konflikten) | nach erster Online-Stabilität |
| 13 | Hardware-Bridge (echte ESC/POS-Treiber) | hängt von Hardware-Auswahl ab |

---

## 16. Hinweise zur Integration mit kommenden Dateien

### License-Feature-Toggle-Spec (separat)

Die folgenden Felder sind in dieser Datei bereits **reserviert** und müssen von der kommenden Spec befüllt/verwendet werden:

| Datenmodell | Reserviertes Feld |
|---|---|
| `WarningRule` | `requiredFeatureFlag?: string` |
| `SearchAction` | `requiredFeatureFlag?: string` |

Erwartung an die kommende Spec:

- Definiert `FeatureFlag`-Datenmodell und Tier-Struktur.
- Liefert Service `isFeatureEnabled(flag: string, context?): boolean`.
- Klärt UI-Verhalten bei deaktivierter Feature (gegraut + Upgrade-Hinweis vs. komplett ausgeblendet).

### Performance-Detailanalyse (separat)

Diese Datei verlässt sich auf:

- `PerformanceSnapshot` aus Add-on 09 / 4.6.
- Service `getCurrentPerformanceSnapshot()` aus dem Performance-Modul.
- Tab-Struktur aus Add-on 09 / 6.4 als Platzhalter bis zur Verfeinerung.

Was die Performance-Detaildatei klären muss:

- Forecast-Algorithmen pro Tab (Umsatz, Auslastung, Lieferzeit).
- Saisonalität (Oldtimer-Saisonzyklen).
- Forecast-Genauigkeitsmessung (Plan vs. Ist).
- Datenqualitäts-Schwellen (wann ist Forecast unsicher).
- Drilldown-Mechanik (KPI klicken → betroffene Aufträge).
- Export-Formate je Tab.

Die Warning Engine in dieser Datei greift **nur auf den Snapshot zu**, nicht auf die Tab-UI.

---

## 17. Offene Fragen (blockierend für spätere Phasen)

Diese Fragen sind nicht für die Implementierung der Querschnittsmodule blockierend, müssen aber vor produktivem Betrieb geklärt werden:

1. **Welcher PSP wird gewählt?** Stripe, Mollie, SumUp — entscheidet Webhook-Architektur.
2. **Welcher Bondrucker-Typ?** Bestimmt ESC/POS-Variante.
3. **Welche Aufbewahrungsfristen abweichend vom gesetzlichen Minimum?** Branchenspezifisch ggf. länger.
4. **Datenschutzbeauftragter benannt?** Bei Kreile vermutlich nicht meldepflichtig (Mitarbeiterzahl), aber Ansprechperson im Impressum sinnvoll.
5. **Welche Branchensuche-Anbieter sind lizenziert?** Bestimmt Provider-Liste.
6. **Single-Tenant oder Multi-Mandant geplant?** Beeinflusst Datenmodell-Pluralität.
7. **WLAN-Stabilität im Werkstattbereich?** Bestimmt Offline-Investitionstiefe.
8. **Standorte/Werkstätten Anzahl?** Multi-Standort-Logik nötig oder nicht.

---

## 18. Nächster sinnvoller Arbeitsschritt

1. Diese Datei ins Projekt aufnehmen.
2. Performance-Detailanalyse-Datei separat ergänzen (sobald vorliegt).
3. License-Feature-Toggle-Spec separat ergänzen (sobald vorliegt).
4. Antigravity-Build starten mit Phase 0 → Phase 2 (Warning Engine Kern), weil der größte fühlbare Effekt für „mitdenkendes System“ dort entsteht.
5. Nach Phase 2 kurzer Review: Funktionieren die ersten 5 Warnregeln tatsächlich auf den bestehenden StatusEvents? Wenn nicht, Event-Bus erweitern statt Regeln verbiegen.
