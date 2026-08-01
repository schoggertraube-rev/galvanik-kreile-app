# Modularitaetsstrategie

Stand: 2026-08-01

## Ziel

Die Kreile-App bleibt das Referenzprodukt und wird zuerst stabil und verkaufsfaehig. Die Struktur wird nicht durch eine grosse Ordnerumsortierung repariert, sondern durch eindeutige Ownership, stabile Vertraege und einen belegten operativen Vertikalschnitt.

## Ist-Struktur auf `main@b511318...`

| Inventar | Anzahl |
|---|---:|
| TypeScript-/TSX-Dateien unter `src` | 617 |
| App-Routen mit `page.tsx` | 78 |
| Next-API-Routen mit `route.ts` | 18 |
| Action-Dateien unter `src/app/actions` | 34 |
| React-TSX-Dateien unter `src/components` | 188 |
| Testdateien unter `src` | 18 (16 Unit, 2 Integration) |
| lokale SQL-Migrationsdateien | 79 |

`src/app` hat 34 fachliche oder technische Top-Level-Bereiche, unter anderem `customers`, `orders`, `kunden-auftraege`, `today`, `station`, `warendurchlauf`, `buchhaltung`, `finanzen`, `cockpit`, `analyse`, `performance`, `lager`, `baeder`, `kommunikation` und `marketing`.

`src/features` enthaelt dagegen nur `analyse`, `customers` und `orders`. Fachlogik liegt gleichzeitig in:

- `src/app/actions`,
- Route- und Layout-Dateien,
- `src/components`,
- `src/features`,
- `src/lib/repositories`,
- `src/lib/services` und vielen fachlichen `src/lib/*`-Ordnern.

Das ist ein route-first Monolith mit partiellen Feature-Inseln. Die sichtbare Seitenzahl ist kein Beleg fuer durchgaengige Fachvertraege. Aktuell bestehen insbesondere konkurrierende Auth-/PIN-, Offline-, Today-, Auftrags- und Prototyp-Pfade.

## Zielstruktur

Die Zielstruktur beschreibt Ownership. Sie ist noch kein Auftrag, alle Dateien sofort zu verschieben.

```text
src/
  app/                 Routing, Layouts, Server-Composition
  modules/
    identity/          Nutzer, Rollen, Sessions, Geraetebindung
    customers/         Kunde und Kundenakte
    orders/            Auftrag und Auftragszustand
    intake/            Eingang, Behaelter, QR, Original-Capture
    production/        Teil, Arbeitsaktion, Station, Ereignis
    dispatch/          QS, Ausgang, Versand, Reklamation
    accounting/        Beleg, Rechnung, Zahlung, Export
    cockpit/           belegte Read-Models und Entscheidungen
  platform/
    auth/              technische Session-/Identity-Adapter
    database/          Drizzle/Supabase, Transaktionen, Views
    storage/           Originale, Fotos, Dokumente
    offline/           eine Outbox und Sync-Infrastruktur
    telemetry/         Audit, Diagnostics, Observability
  ui/                  fachneutrale Komponenten und Tokens
```

## Ownership der fachlichen Wahrheit

| Wahrheit | Besitzer | Vertrag nach aussen |
|---|---|---|
| Nutzer, Rolle, Session, Device | `modules/identity` | serverseitiger Identity-Snapshot und autorisierte Commands |
| Kunde | `modules/customers` | Customer-ID, Profil-Read-Model, Commands |
| Auftrag | `modules/orders` | Order-ID, Statusmaschine, Timeline-Port |
| Behaelter/QR/Original | `modules/intake` | operative Identitaet und unveraenderliches Original-Receipt |
| Teil/Arbeitsaktion/Ereignis | `modules/production` | Commands plus idempotentes Event-Receipt |
| QS/Ausgang | `modules/dispatch` | Freigabe-/Versandereignisse |
| Beleg/Rechnung/Zahlung | `modules/accounting` | Ledger-/Export-Vertraege |
| Today | `modules/production` fuer operative Tagesarbeit | versionierte View + TypeScript-Typ; UI nur Konsument |
| Unternehmer-Cockpit | `modules/cockpit` fuer quellenbelegte Chefentscheidungen | versionierte Views + Definitionen + TypeScript-Typen |
| Finanz-/Buchhaltungs-KPI | `modules/accounting` fuer fachliche Berechnung; `modules/cockpit` komponiert nur | versionierte View + Definition + TypeScript-Typ |
| Offline-Sync | `platform/offline` | genau eine Outbox, Receipt, Retry und Konfliktzustand |

Eine Route, Komponente oder Local-Storage-Struktur darf keine zweite fachliche Wahrheit besitzen.

## Laufende Regeln

- `src/app` komponiert Module; es besitzt keine duplizierte Fachlogik.
- Modulgrenzen laufen ueber TypeScript-Typen, Props, SQL-Views und explizite Ports/Provider.
- Keine Tiefimporte in interne Ordner anderer Module.
- Kein Client-`tenantId` als Autorisierungsquelle.
- Kreile-spezifische Rollen, Tenant-Werte, Tabellen und UI-Texte bleiben in App-Adaptern oder Konfiguration, nicht im wiederverwendbaren Kern.
- KPI-Berechnungen gehoeren in belegte SQL-Read-Models, nicht parallel in Komponenten.
- Neue Offline-Mutationen duerfen nur ueber eine Outbox mit Idempotenz-Receipt laufen. Bestehende IndexedDB-, Service-Worker- und Local-Storage-Queues werden vor Abschaltung inventarisiert, idempotent importiert oder sichtbar quarantiniert; kein Store wird blind geloescht.
- Alte Pfade werden erst entfernt, wenn Importinventar, Negativtests, Runtime-Readback und Rollback geklaert sind.
- Jede geaenderte TS-/TSX-Datei ist lintfehlerfrei; der globale Ratchet darf niemals steigen.
- Waehrend kritischer Auth-, DB-Truth- und RLS-Arbeit werden keine Pakete vorschnell extrahiert.

## Implementierungsfolge

### 1. `APP-STRUCTURE-001` - Vertrag, kein Big Bang

- Importgraph fuer den operativen Kern erfassen.
- fuer jede Wahrheit genau einen Besitzer benennen.
- Ports fuer Identity, Database, Offline und Audit definieren.
- verbotene neue Cross-Imports als CI-Regel pruefbar machen.
- keine Massenverschiebung und keine fachliche Verhaltensaenderung in demselben PR.

### 2. `OPERATIVE-SLICE-001` - Struktur beweisen

Der erste echte Modulbeweis ist:

```text
customers -> orders -> intake -> production -> Today-Read-Model
                                      |
                                      +-> Receipt -> Reload-Readback
```

Der Slice muss realen Nutzer, Tenant-Negativfall, Audit, Loading/Empty/Error/Data und Tablet-Browserabnahme enthalten. Erst danach wird dieselbe Grenze auf weitere Pfade angewendet.

### 3. Strangler-Migration

- Bei jeder fachlichen Aenderung den betroffenen Altpfad hinter den neuen Vertrag fuehren.
- Alte Importe mit Adapter weiter bedienen, bis alle Konsumenten umgestellt sind.
- Doppelte Implementierung markieren und messen.
- Persistente Altformate mit Versions-/Payload-Inventar, Import/Drain, Quarantaene, Nutzeranzeige und Rollback migrieren.
- Loeschung separat und erst nach belegter Nichtnutzung beziehungsweise vollstaendig bestaetigter Drainage.

### 4. Wiederverwendbare Kerne

`LEDGER-CORE-PREP-001` bleibt zunaechst reine Analyse:

- Inventar der Buchhaltungs-, OCR- und Provider-Dateien,
- Cross-Imports und direkte Supabase-/SQL-Zugriffe,
- Kandidaten fuer gemeinsame Typen,
- empfohlene Modulgrenze und Adapter,
- Liste der vor einer Extraktion zu entkoppelnden Stellen.

`LEDGER-CORE-EXTRACT-001` folgt erst nach stabiler Kreile-Buchhaltung und belegter End-to-End-Nutzung. Kreile bleibt Referenzkonsument; weitere Apps nutzen denselben Kern ueber definierte Adapter.

## Abnahme

Eine Strukturmission ist nur `PASS`, wenn:

1. der fachliche Eigentuemervertrag eindeutig ist,
2. keine zweite Runtime-Wahrheit entsteht,
3. geaenderte Dateien lintfehlerfrei sind und der globale Ratchet nicht steigt,
4. TypeScript, Unit-, Integrations- und relevante Browsertests bestehen,
5. Datenbank-/View-Vertraege gegen Production und Integration abgeglichen sind,
6. Vercel Preview und unabhaengiges Red-Team bestanden sind,
7. Rollback und Salvage-Entscheidung dokumentiert sind.
