# Qualitäts-, Integrations- und Vernetzungsprüfung
## Kreile WerkstattCockpit — Audit 2026-06-19

---

## GESAMTURTEIL: NICHT BESTANDEN

**Begründung:** 2 P0-Befunde (Datenverlust / Funktionsattrappe in Kernfeatures) und 3 P1-Befunde (Auth-Kette, Mandantentrennung, mocked UI) schließen Livebetrieb aus. Die App kompiliert und startet, erfüllt aber ihre primären Nutzungsszenarien nicht.

---

## 1. Kritische Befunde (P0–P3)

| # | Prio | Komponente | Befund | Evidenz |
|---|------|------------|--------|---------|
| B-01 | **P0** | `/api/ocr-process/route.ts` | Bild-URL ist Literal-Platzhalter `https://YOUR_SUPABASE_URL/...` — OCR liefert nie ein echtes Ergebnis, da die URL nie aufgelöst wird. Kein KLIPPA_API_KEY in `.env.local` → fällt auf `ManualProvider` zurück, der keine echte Extraktion durchführt. | `route.ts:32`: `const imageUrl = \`https://YOUR_SUPABASE_URL/storage/v1/object/public/belege/${storagePath}\`` |
| B-02 | **P0** | `src/app/scan/page.tsx` | `handleConfirm()` erstellt keinen Auftrag. Zeigt Erfolgsmeldung „Auftrag wird erstellt", schreibt aber nichts in die DB. Kernfeature Scan-to-Order ist eine Attrappe. | `page.tsx:16`: `console.log("Confirmed scan data", data)` — kein DB-Schreibvorgang |
| B-03 | **P1** | Auth-Kette gesamt | Alle authentifizierten Seiten zeigen 0 Datensätze ohne aktive PIN-Session. `checkAppAuth()` → UNAUTHORIZED → Repository gibt `[]` zurück → UI zeigt leer. Kein Hinweis auf fehlende Session in der UI. | `authHelper.ts`, `orders.actions.ts:4-6`, `customers.actions.ts` |
| B-04 | **P1** | `customers.actions.ts` | Fehlender `tenant_id`-Filter: gibt Kundendaten **aller Mandanten** zurück. Bei Multi-Tenant-Betrieb kritischer Datenleck. | `customers.actions.ts`: keine `where(eq(customers.tenantId, ...))` Klausel |
| B-05 | **P1** | `src/app/buchhaltung/belege/neu/page.tsx` | Ruft `/api/ocr-process` auf — Route existiert, ist aber wegen B-01 (Platzhalter-URL, kein API-Key) nicht funktionsfähig. UI bietet Erfassung an, die niemals korrekt durchläuft. | Kommentar in Page: „We will create the OCR action later, for now we mock the call" |
| B-06 | **P2** | RLS-Status | 30 Tabellen ohne Row Level Security: `events`, `communications`, `forecast_version`, `inventory_items`, `aktion`, `arbeitszeit_buchung`, `attribution`, `ausgangsrechnung_position`, `einwilligung`, `feedback_eingang/mail`, `kampagne`, `kanal`, `konto`, `kosten_posten`, `kostenstellen_energie_monat`, `lern_metrik`, `marketing_asset/touchpoints`, `periode`, `price_agreements`, `segment`, `statistik_kennzahl`, `teile_klassifikator`, `telemetrie_event`, `touchpoint`, `vorlage_verbrauch/zeit`, `warning_event` | Supabase SQL: `rowsecurity = false` auf 30 Tabellen |
| B-07 | **P2** | `src/app/orders/page.tsx` | `type Order = any` als Fallback — keine Typsicherheit, TypeScript-Check wegen Timeout nicht abgeschlossen | `page.tsx:12` |
| B-08 | **P2** | Station-Navigation | TopWorkflowBar verlinkt korrekt `/station/beschichtung`, aber Test mit `/station/galvanik` ergibt 404 (nicht in VALID_SLUGS). Dokumentationspflicht: "galvanik" als Slug ist ungültig und muss aus jeder Kommunikation/Doku entfernt werden. | `station/[slug]/page.tsx:3` |
| B-09 | **P3** | Produktionscode | 30+ `mock`/`demo`/`TODO`-Kommentare und Platzhalter im Produktionscode aktiv (nicht nur dev-branches). | `grep -r "mock\|TODO\|placeholder" src/` — 30 Treffer |

---

## 2. Vernetzungsprüfung

### 2.1 Auth-Kette (vollständig geprüft)

```
PIN-Eingabe /start
  → POST /api/login → setzt kreile_app_session Cookie (HMAC, 12h TTL)
  → checkAppAuth() → resolveAuthorization() → readAppSession()
  → bei fehlendem/abgelaufenem Cookie: return UNAUTHORIZED (kein throw)
  → Repository fängt !auth.ok → return []
  → UI: leere Liste, kein Hinweis auf Session-Problem
```

**Befund:** Kette funktioniert technisch, scheitert aber still. Kein UI-Feedback „Bitte einloggen". Alle 78 authentifizierten Seiten betroffen.

### 2.2 Scan → Auftrag (UNTERBROCHEN)

```
CameraCapture → OCR via geminiOcr → OcrResult
  → OCRReviewPanel zeigt Ergebnis
  → handleConfirm() aufgerufen
  → [ABBRUCH] console.log() statt DB-Write
  → false success: "Scan erfolgreich verarbeitet – Auftrag wird erstellt."
```

**Befund:** Chain endet vor dem einzigen wertvollen Schritt. Keine Server Action, keine API-Route, kein Datenbankschreibvorgang.

### 2.3 Beleg-OCR → Buchhaltung (UNTERBROCHEN)

```
Upload-Formular → /api/ocr-process POST
  → KlippaProvider.extractBeleg(imageUrl)
    imageUrl = "https://YOUR_SUPABASE_URL/..." → [ABBRUCH] DNS-Fehler
  → Fallback ManualProvider: gibt Stub zurück
  → beleg-Eintrag mit Dummy-Daten
  → verteilBeleg() schreibt Fehlerdaten in DB
```

**Befund:** OCR schreibt, aber mit falschen/leeren Daten. Ergebnisse in `beleg`-Tabelle wären unbrauchbar. Zudem: kein KLIPPA_API_KEY → keine echte OCR-Verarbeitung möglich.

### 2.4 Events-System → Analytics (funktioniert isoliert)

```
ui_events: 3.863 Einträge vorhanden
events: 58 Einträge (20× ORDER_CREATED, 8× STATION_EINGANG, 7× STATION_AUSGANG, ...)
```

**Befund:** Tracking läuft. Analytics-Basis ist vorhanden. Aber: `events`-Tabelle hat kein RLS (B-06).

### 2.5 Station-Workflow (teilweise funktionsfähig)

```
VALID_SLUGS: ["wareneingang","entmetallisierung","schleiferei","beschichtung","warenausgang"]
TopWorkflowBar: Galvanik → /station/beschichtung ✓
RightNav: korrekte Links ✓
STATION_EINGANG/AUSGANG Events: vorhanden → Workflow läuft
```

**Befund:** Stations-Workflow ist der einzige Bereich mit nachgewiesener End-to-End-Funktion.

---

## 3. Mengen- und Konsistenzprüfung

| Entität | DB-Zeilen | Nach Filter | UI-Anzeige | Erwartung | Delta | Ursache |
|---------|-----------|-------------|------------|-----------|-------|---------|
| Orders | 31 | 7 (op. Filter) | **0** | 7 | −7 | Auth-Failure (B-03) |
| Customers | 54 | 45 (name-Filter) | **0** | 45 | −45 | Auth-Failure (B-03) |
| Events | 58 | — | nicht geprüft | — | — | — |
| UI-Events | 3.863 | — | nicht geprüft | — | — | — |
| Belege | unbekannt | — | nicht geprüft | — | — | OCR-Attrappe (B-01, B-05) |
| API-Routes | 16 | 16 vorhanden | — | 16 | 0 | — |
| Pages | 78 | — | — | — | — | — |
| RLS aktiv | 55 | — | — | 85 | −30 | B-06 |
| RLS fehlt | 30 | — | — | 0 | +30 | B-06 |

**Fazit:** Alle sichtbaren Nutzdaten zeigen 0, obwohl echte Daten in der DB vorhanden sind. Ohne aktive PIN-Session ist die App vollständig leer.

---

## 4. Nicht nachgewiesene Behauptungen

| Behauptung | Status | Kommentar |
|------------|--------|-----------|
| „KI-Scan erstellt Auftrag" | ❌ FALSCH | handleConfirm() schreibt nichts |
| „OCR verarbeitet Belege" | ❌ FALSCH | Platzhalter-URL, kein API-Key |
| „Kunden werden angezeigt" | ❌ FALSCH | 0 in UI, 54 in DB |
| „Aufträge werden angezeigt" | ❌ FALSCH | 0 in UI, 7 operativ in DB |
| „RLS schützt alle Tabellen" | ❌ FALSCH | 30 Tabellen ungeschützt |
| Station-Workflow funktioniert | ✅ BELEGT | Events in DB nachgewiesen |
| UI-Tracking läuft | ✅ BELEGT | 3.863 ui_events |
| Auth-Kette technisch korrekt | ✅ BELEGT | Scheitert nur still |

---

## 5. Korrekturplan

### Phase 1 — Blocker (vor erstem echten Nutzertest)

**P0-1: Scan → Auftrag reparieren** (`src/app/scan/page.tsx`)
- `handleConfirm()` muss Server Action `createOrderFromScan()` aufrufen
- Mindestfelder: `customer_id` (oder `customer_name`), `description`, `tenant_id = "galvanik-kreile"`, `source = "scan"`
- Erfolg erst nach DB-Bestätigung anzeigen, nicht vorher
- Geschätzter Aufwand: 2–4h

**P0-2: OCR-URL-Platzhalter ersetzen** (`src/app/api/ocr-process/route.ts`)
- `imageUrl` aus Supabase Storage URL korrekt zusammensetzen: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/belege/${storagePath}`
- Für MVP: `GEMINI_API_KEY` ist bereits gesetzt → `GeminiProvider` implementieren oder `ManualProvider` durch Review-Workflow ersetzen
- KLIPPA ist nicht konfiguriert → entweder KLIPPA_API_KEY beschaffen oder Gemini als primären Provider nutzen
- Geschätzter Aufwand: 3–6h

### Phase 2 — Sicherheit und Datenintegrität (vor Livebetrieb)

**P1-1: Auth-Feedback einbauen**
- Bei UNAUTHORIZED: Redirect zu `/start` oder Toast „Session abgelaufen – bitte neu einloggen"
- Betrifft alle Seiten mit `getOrdersDb()`, `getCustomersDb()` etc.

**P1-2: tenant_id-Filter in customers.actions.ts**
```typescript
.where(and(
  eq(customers.tenantId, "galvanik-kreile"),
  sql`coalesce(${customers.source}, '') not in ('seed', 'test', 'demo', 'integration-test')`,
  ...
))
```

**P1-3: RLS auf 30 fehlende Tabellen aktivieren**
- Priorität: `events`, `communications`, `ausgangsrechnung_position`, `arbeitszeit_buchung`, `konto`
- Standard-Policy: `tenant_id = current_setting('app.tenant_id')`

### Phase 3 — Qualität (nach Stabilisierung)

- TypeScript strict mode check: `tsc --noEmit` vollständig durchführen
- `type Order = any` durch konkrete Typen ersetzen
- Mock-Kommentare und TODO-Platzhalter bereinigen (30+ Stellen)
- Settings-Page-404 untersuchen und beheben

---

## 6. Abschlussentscheidung

| Kriterium | Status |
|-----------|--------|
| Kompiliert | ✅ |
| Startet | ✅ |
| Kernfeature Scan→Auftrag funktioniert | ❌ |
| Kernfeature OCR-Beleg funktioniert | ❌ |
| Authentifizierung korrekt implementiert | ⚠️ (technisch korrekt, UI-Feedback fehlt) |
| Datenisolation (Mandanten) | ❌ |
| RLS vollständig | ❌ |
| Produktiv einsetzbar | ❌ |

**Urteil: NICHT BESTANDEN**

Die App ist auf Stufe „erweiterter Prototyp". Die Infrastruktur (DB-Schema, Auth, Routing, Events, Station-Workflow) ist solide und weiter fortgeschritten als ein Stub. Kernfeatures (Scan-to-Order, OCR-Buchhaltung) sind jedoch Attrappen mit falschen Erfolgsmeldungen. Livebetrieb wäre irreführend für Nutzer und würde stille Datenverluste produzieren.

**Freigabe nach:** Abschluss Phase 1 (P0-1 + P0-2) + Phase 2 Punkt 1+2. RLS (P1-3) kann parallel laufen.

---

*Audit durchgeführt: 2026-06-19 | Methode: Statische Codeanalyse, DB-Direktabfrage via Supabase MCP, Browser-UI-Test via Chrome Extension*
