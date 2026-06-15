# 44 — UNIVERSELLE ERFASSUNG (Eingangsflows)

> Geltungsbereich: vier Eingangsflows zur Anlage von Aufträgen, Kunden, Belegen und KV-Anfragen.
> Pflicht: 100 % Supabase-Live-Daten. Quelle jedes Eintrags ist nachvollziehbar.
> Visueller Standard: identisch zu Spec 40 (CI-Tokens, zentriertes Modal, Blur-Backdrop).
> Visuelle Referenz: `erfassung_flows_v3_CI.html`
> **Wichtig: Die bestehenden Einstiegskacheln (Home, Wareneingang, Suchleiste) bleiben unverändert — diese Spec beschreibt nur die Funktionen dahinter.**

---

## 0 · Anknüpfung an Bestehendes — Behutsamkeitsregeln

Drei Funktionen existieren bereits und dürfen nicht ersetzt werden:

| Bestehend | Behandlung in dieser Spec |
|---|---|
| **Telefonnotiz** (eigener Eintrag mit Notizfeld) | Wird **erweitert** um KI-Extraktion und Folgeaktion. Bestehende Speicherung der Notiz selbst bleibt unverändert. Erkennen von Verhaltenshinweisen ist additiv. |
| **Kommzentrale / Eingehende Anfragen** | Wird **erweitert** um „KV-Anfrage anlegen aus Mail"-Aktion. Bestehende E-Mail-Anzeige bleibt unverändert. |
| **Einstiegskacheln Home/Wareneingang** | Werden **nicht angefasst**. Nur die Funktion hinter dem Klick wird neu implementiert. |

**STOPP-Bedingung:** Wenn bestehende Komponenten (`PhoneNoteEditor`, `KommunikationClient`, Home-Tiles) verändert werden müssten, vorher beim Chef rückfragen. Niemals einfach überschreiben.

---

## 1 · Vier Flows im Überblick

| Flow | Einstieg | Quelle | Output |
|---|---|---|---|
| **Foto / Scan (universell)** | Home · Wareneingang · Suchleiste · Auftragsdetail | Foto/PDF | Auftrag, Beleg, Kunde oder Zuordnung |
| **Telefonnotiz** | Home-Kachel · Auftragsdetail | Freitext + Diktat | Notiz (immer) + optional Auftrag/Kunde |
| **Aus Anfrage** | Kommzentrale | Mail/Webform | KV-Anfrage + Lead |
| **Manuell** | Home-Kachel · „Neuer Auftrag" | Strukturierte Felder + optionaler Freitext | Auftrag direkt |

Alle vier Flows münden — sobald Daten gesammelt sind — in das **identische Datenmodell**. Unterschied liegt nur im Status (`Auftrag` vs. `KV-Anfrage`) und der Quelle (`source`-Feld).

---

## 2 · Datenmodell-Änderungen

### 2.1 Tabelle `customers` (additive Erweiterungen)

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS behavior_notes text,                  -- Verhaltenshinweise, Vorlieben
  ADD COLUMN IF NOT EXISTS source text,                          -- foto | phone | inquiry | manual | import
  ADD COLUMN IF NOT EXISTS source_ref text,                      -- ID des Quelldokuments (phone_note_id, inquiry_id, file_url)
  ADD COLUMN IF NOT EXISTS enriched_fields jsonb DEFAULT '[]',   -- ["email","phone","address"] — Felder per Web ergänzt
  ADD COLUMN IF NOT EXISTS is_lead boolean DEFAULT false,        -- true = noch kein echter Auftrag erteilt
  ADD COLUMN IF NOT EXISTS lead_since timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;             -- wann vom Lead zum Kunden
```

### 2.2 Tabelle `orders` (additive Erweiterungen)

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text,                          -- foto | phone | inquiry | manual
  ADD COLUMN IF NOT EXISTS source_ref text,                      -- ID zur Quelle
  ADD COLUMN IF NOT EXISTS freetext_original text,               -- ursprünglicher Freitext zum Audit
  ADD COLUMN IF NOT EXISTS is_quote boolean DEFAULT false,       -- true = KV-Anfrage, false = Auftrag
  ADD COLUMN IF NOT EXISTS quote_status text,                    -- offen | gesendet | angenommen | abgelehnt
  ADD COLUMN IF NOT EXISTS quote_converted_order_id text;        -- wenn KV → Auftrag, Referenz auf neuen Auftrag
```

### 2.3 Tabelle `items` (Foto-Upload bei Teilen)

```sql
-- photo_ids existiert bereits als jsonb. Falls nicht:
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS photo_ids jsonb DEFAULT '[]';
```

`item_photos` (existiert bereits aus Spec 40) wird wiederverwendet. Beim Erfassen entstehen Einträge mit `photo_type = 'intake'`.

### 2.4 Neue Tabelle `inquiries` (eingehende Anfragen aus Kommzentrale)

```sql
CREATE TABLE IF NOT EXISTS inquiries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL,
  source text NOT NULL,                    -- email | webform | whatsapp
  raw_subject text,
  raw_body text NOT NULL,
  sender_name text,
  sender_email text,
  sender_phone text,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',      -- new | extracted | converted | ignored | spam
  extracted_data jsonb,                    -- KI-Extraktion
  converted_to_order_id text,
  converted_to_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status);
CREATE INDEX IF NOT EXISTS inquiries_received_at_idx ON inquiries(received_at DESC);
```

> Hinweis: Falls die Kommzentrale bereits eine eigene Tabelle hat (z.B. `communication_messages` mit `type='inquiry'`), zuerst prüfen. Bei Konflikt: bestehende Tabelle nutzen, `inquiries` nicht zusätzlich anlegen.

### 2.5 Neue Tabelle `scan_uploads` (Foto/PDF-Uploads beim Scan-Flow)

```sql
CREATE TABLE IF NOT EXISTS scan_uploads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL,
  file_url text NOT NULL,                  -- Supabase Storage URL
  file_type text,                          -- image/jpeg | image/png | application/pdf
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  detected_type text,                      -- lieferschein | visitenkarte | beleg | etikett | qr | teil | unbekannt
  detection_confidence numeric(3,2),
  extracted_data jsonb,                    -- KI-Output
  status text NOT NULL DEFAULT 'new',      -- new | processed | linked | ignored
  linked_order_id text,
  linked_customer_id text,
  linked_invoice_id text
);
```

### 2.6 Supabase Storage Bucket

Bucket `scans` mit Policy: Tenant-isoliert lesen/schreiben.
Bucket `item-photos` (existiert vermutlich) wird für Teile-Fotos genutzt.

---

## 3 · Foto / Scan — Universal-Flow

### 3.1 Trigger-Stellen (alle ohne Re-Implementierung)

| Ort | Trigger |
|---|---|
| Home — Kachel „Foto / Scan" | öffnet Scan-Modal |
| Wareneingang — Kachel „Kamera" | öffnet Scan-Modal |
| Globale Suchleiste — Kamera-Icon rechts | öffnet Scan-Modal |
| OrderOverlay — „Foto +" Quick Action | öffnet Scan-Modal mit Kontext `order_id` |
| CustomerOverlay — Quick Action „Beleg scannen" | öffnet Scan-Modal mit Kontext `customer_id` |

### 3.2 Pipeline

```
Foto/PDF → Storage upload (scan_uploads.id erzeugt)
       → Gemini Vision API call: 
           Prompt-Templates für: Lieferschein, Visitenkarte, Beleg, Etikett, Teile-Foto, QR-Code
       → extracted_data + detected_type + confidence
       → App-Suche nach Treffern (orders.order_number, customers.name, items.id)
       → UI zeigt: Erkennung + Treffer + 4 Aktionsmöglichkeiten
```

### 3.3 Vier Aktionsmöglichkeiten

1. **Bestehendem Auftrag zuordnen** — Teile/Beleg an `linked_order_id` anhängen, `item_photos` Eintrag mit `photo_type='intake'`
2. **Neuen Auftrag anlegen** — Daten vorausgefüllt in Manuell-Wizard
3. **Als Beleg in Buchhaltung** — Eintrag in `belege` (oder vorhandene Buchhaltungstabelle)
4. **Nur Kunde anlegen** — `customers` INSERT mit `source='foto'`, Gemini ergänzt fehlende Felder per Web (siehe § 6)

### 3.4 Konflikt-Fall: Teile-Zuordnung

Wenn Scan Teile enthält die bereits am Zielauftrag existieren (Beispiel: Stoßstange schon da, Stoßstange aus Lieferschein):
- UI zeigt Konflikt
- Drei Optionen: `Menge erhöhen` / `Als zweites Teil anlegen` / `Aus Scan überspringen`

---

## 4 · Telefonnotiz — Erweiterung

### 4.1 Bestehender Flow bleibt

`PhoneNoteEditor` (oder die bestehende Komponente) speichert die Notiz wie bisher in `phone_notes`. KEINE Änderung an dieser Speicherung.

### 4.2 Additive Erweiterung NACH dem Speichern

Nach `INSERT INTO phone_notes` läuft ein **zusätzlicher Schritt**:

```
phone_note erstellt
  → Edge Function `notes-extract` (NEU): 
      Gemini Text Prompt → strukturierte Auftrags-Daten + getrennte Verhaltenshinweise
  → UI zeigt zweigeteilte Ergebniskarte:
      [Auftrags-Daten]  →  Aktion: KV-Anfrage anlegen / Nur Kunde / Nur Notiz
      [Verhaltenshinweis] → separat, gelb markiert, Übernahme-Button
```

### 4.3 Verhaltenshinweis-Behandlung

Wenn der User „Übernehmen" klickt:
- `behavior_notes` am erkannten Kunden ergänzen (anhängen, nicht ersetzen)
- Hinweis erscheint künftig in CustomerOverlay (siehe Spec 43)

Wenn kein Kunde erkannt: Verhaltenshinweis wird im Lead/neuen Kunden gespeichert.

### 4.4 Folgeaktionen (drei Wege)

| Auswahl | Effekt |
|---|---|
| KV-Anfrage anlegen | INSERT `orders` mit `is_quote=true`, `source='phone'`, `source_ref=phone_note_id` · Weiterleitung zum Auftrags-Wizard mit Vorausfüllung |
| Nur Kunde anlegen | INSERT `customers` mit `source='phone'`, ggf. Gemini-Web-Anreicherung |
| Nur Notiz behalten | Status bleibt bei `phone_notes`, kein weiterer Eintrag · Wenn „Rückruf am X" erkannt: Termin in `tasks` oder Kalender setzen |

---

## 5 · Aus Anfrage (Kommzentrale) — Erweiterung

### 5.1 Bestehender Flow bleibt

Eingehende E-Mails / Webform-Submissions landen weiterhin in der Kommzentrale (bestehende Komponente). Anzeige unverändert.

### 5.2 Additive Aktion „KV-Anfrage anlegen"

Pro Anfrage in Kommzentrale erscheint **zusätzlich** Button „KV-Anfrage daraus erstellen".

```
Klick auf Button
  → Edge Function `inquiry-extract` (NEU): 
      Gemini Text Prompt auf Mail-Body
      → strukturierte Auftrags-Daten + Verhaltenshinweise
  → UI zeigt Mail-Vorschau + Extraktion + Verhaltenshinweis
  → User klickt „KV-Anfrage anlegen":
      - INSERT inquiries (Status: extracted)
      - INSERT customers mit is_lead=true, source='inquiry'
      - INSERT orders mit is_quote=true, source='inquiry', source_ref=inquiry_id
      - Antwort-Mail-Entwurf wird vorbereitet (StatusMailDrawer, Template `kv_vorschlag`)
```

### 5.3 KV → Auftrag Konversion

Wenn der Lead die KV annimmt (manuell durch Mitarbeiter oder durch Klick auf KV-Antwort-Link):
- `orders.is_quote = false`, `quote_status = 'angenommen'`
- `customers.is_lead = false`, `converted_at = now()`

---

## 6 · Manuell — strukturiert + optionaler Freitext + Verhaltensnotiz

### 6.1 Drei Pflichtsektionen

| Sektion | Pflicht | Felder |
|---|---|---|
| **1 Kunde** | ja | Suche mit Dubletten-Check oder neu anlegen — Name/Firma, E-Mail, Telefon, Adresse |
| **2 Teile** | mindestens 1 | Bezeichnung, Material, Ziel-Oberfläche, Menge, **Fotos/Dateien (NEU)** |
| **3 Termin & Lieferung** | ja | Zugesagter Liefertermin, Priorität (Normal/Express), Rücklieferung (Abholung/Versand/Spedition) |

### 6.2 Teile-Sektion: Foto- und Datei-Upload (NEU)

Pro Teil-Karte:
- Multi-Upload-Bereich: Drag&Drop oder Klick
- Akzeptierte Formate: JPG, PNG, HEIC, PDF (max. 10 MB pro Datei, max. 6 Dateien pro Teil)
- Upload geht direkt in Supabase Storage Bucket `item-photos/{tenant}/{item_id}/`
- Pro Upload entsteht Eintrag in `item_photos` mit `photo_type='intake'`
- Vorschau-Thumbnails in der Teil-Karte sichtbar mit Löschen-Symbol
- **Pro Foto wird optional Gemini Vision aufgerufen** (siehe § 6.3): Material- und Schaden-Vorerkennung als Vorschlag

### 6.3 Gemini Vision bei Teile-Foto (optional, nicht blockierend)

Beim Upload eines Teile-Fotos läuft im Hintergrund:
```
Gemini Vision Prompt:
  "Erkenne Material, sichtbare Schäden, Maßangaben falls Lineal sichtbar."
  → Vorschläge erscheinen als kleine Hint-Box unter dem Foto-Bereich:
     "KI vermutet: Messing, Pittings an einer Stelle"
     mit Buttons [Übernehmen] [Ignorieren]
```

User entscheidet — nichts wird automatisch in Felder geschrieben.

### 6.4 Optional aufklappbar: Freitext-Eingabe

```
Toggle: "+ Freitext nutzen — KI ergänzt Felder oben"
Geöffnet: zweispaltige Anzeige (Freitext links, Live-Extraktion rechts)
  → Gemini Text Prompt extrahiert: Kunde, Teile, Material, Ziel, Termin
  → Button "In Felder übernehmen" füllt strukturierte Felder oben
  → Freitext bleibt in orders.freetext_original gespeichert
```

### 6.5 Optional aufklappbar: Verhaltensnotiz zum Kunden

```
Toggle: "+ Verhaltensnotiz zum Kunden"
Geöffnet: gelb markiertes Textfeld
  → bei "Auftrag anlegen": Inhalt wird in customers.behavior_notes geschrieben (angehängt)
  → NICHT am Auftrag gespeichert
```

### 6.6 Dubletten-Check bei Kunde

Beim Tippen in „Kunde suchen":
```
Debounce 300ms → 
  SELECT id, name, customer_number, last_contact, count(*) AS orders_count
  FROM customers LEFT JOIN orders ON orders.customer_id = customers.id
  WHERE LOWER(name) LIKE '%' || LOWER($1) || '%'
     OR LOWER(company_name) LIKE '%' || LOWER($1) || '%'
  GROUP BY customers.id LIMIT 5
```

Ergebnisse als Vorschlagsliste. Bei eindeutigem Treffer: Match-Karte. Bei mehreren: Auswahl + Option „Doch neuer Kunde anlegen". Bei „neu anlegen" trotz ähnlichem Namen: zusätzliche Warnung mit Liste der Ähnlichkeiten.

### 6.7 Gemini Web-Anreicherung für neue Kunden

Wenn neuer Kunde angelegt wird und Felder fehlen (z.B. nur Name vorhanden):
```
Edge Function `customer-enrich` (NEU):
  Input: name, ggf. company_name, ggf. city
  Prompt: "Suche im Web öffentlich verfügbare Kontaktdaten für [Firma] in [Stadt]: Adresse, Telefon, E-Mail, Website."
  Output: Vorschläge mit Confidence
  → Felder werden lila markiert ("per Web ergänzt")
  → enriched_fields wird befüllt
  → User muss bestätigen vor dem Speichern
```

---

## 7 · Edge Functions

| Funktion | Zweck | Input | Output |
|---|---|---|---|
| `scan-analyze` | OCR + Belegtyp-Erkennung aus Bild/PDF | scan_upload_id, file_url | detected_type, extracted_data, confidence |
| `notes-extract` | Auftrags-Daten + Verhalten aus Notiz-Text | phone_note_id | { auftragsdaten, verhalten } |
| `inquiry-extract` | Auftrags-Daten aus Mail-Body | inquiry_id | { auftragsdaten, verhalten } |
| `freetext-extract` | Live-Extraktion aus Freitext-Feld | text | { kunde, teile, termin, auftragsnotiz, verhaltensnotiz } |
| `customer-enrich` | Web-Suche fehlender Kontaktdaten | name, city? | { email?, phone?, address?, website?, confidence } |
| `item-photo-analyze` | Material/Schäden aus Teile-Foto | item_photo_id | { material?, schäden?, confidence } |

Alle Funktionen lesen `GEMINI_API_KEY` aus `Deno.env`. Niemals client-seitig.

Rate-Limits: pro Tenant max. 100 Aufrufe / Minute. Bei Überschreitung 429 zurückgeben, UI zeigt „Bitte kurz warten".

---

## 8 · Komponenten-Layout

```
src/components/erfassung/
  ErfassungModal.tsx           -- Container mit Backdrop, CI-Modal-Stil
  ErfassungStepper.tsx         -- 4-Schritt-Indikator (wo relevant)
  ScanFlow/
    ScanUpload.tsx             -- Foto-/PDF-Upload mit Vorschau
    ScanAnalyzing.tsx          -- Spinner mit Status-Texten
    ScanResult.tsx             -- Erkennung + Treffer + 4 Aktionen
    AssignToOrderDialog.tsx    -- Konflikt-Auflösung Teile
  PhoneFlow/
    -- ANSCHLUSS AN BESTEHENDE PhoneNoteEditor (NICHT ERSETZEN)
    PhoneExtractionResult.tsx  -- additive Komponente nach Speichern
    BehaviorHintCard.tsx       -- gelb markierte Verhaltens-Karte
  InquiryFlow/
    -- ANSCHLUSS AN BESTEHENDE KommunikationClient (NICHT ERSETZEN)
    InquiryToQuote.tsx         -- additiver Dialog
  ManualFlow/
    ManualWizard.tsx           -- Hauptkomponente mit 3 Sektionen
    CustomerSection.tsx        -- mit Dubletten-Check
    ItemsSection.tsx           -- mit Foto-Upload
    DateSection.tsx
    FreetextToggle.tsx         -- aufklappbar
    BehaviorToggle.tsx         -- aufklappbar, gelb
  shared/
    ItemPhotoUploader.tsx      -- Drag&Drop, Multi-File, Storage Upload
    AiBadge.tsx                -- "KI", "per Web ergänzt"
    DuplicateWarning.tsx       -- Dubletten-Warnung mit Auswahl
```

---

## 9 · API-Routes (Next.js)

```
src/app/api/erfassung/
  scan-upload/route.ts           -- POST: Upload + scan_uploads INSERT + Edge Function Trigger
  scan-status/[id]/route.ts      -- GET: Status-Polling
  customer-search/route.ts       -- GET: Dubletten-Suche
  customer-enrich/route.ts       -- POST: Proxy zu customer-enrich Edge Function
  freetext-extract/route.ts      -- POST: Proxy zu freetext-extract Edge Function
  notes-extract/route.ts         -- POST: Proxy zu notes-extract Edge Function
  inquiry-extract/route.ts       -- POST: Proxy zu inquiry-extract Edge Function
  item-photo-upload/route.ts     -- POST: Storage Upload + item_photos INSERT
```

Alle Routes server-seitig, niemals Gemini-Key im Client.

---

## 10 · Vernetzung

| Modul | Verbindung |
|---|---|
| **OrderOverlay** (Spec 40) | Klick auf „Foto +" Quick Action öffnet ScanFlow mit Kontext `order_id` |
| **CustomerOverlay** (Spec 43) | Zeigt `behavior_notes` prominent oben · Quick Action „Beleg scannen" öffnet ScanFlow mit Kontext `customer_id` |
| **Auftragsbuch** | „+ Neuer Auftrag"-Button öffnet ManualWizard |
| **Wareneingang** | Kamera-Kachel öffnet ScanFlow im Modus „Lieferschein" |
| **Globale Suche** | Kamera-Icon öffnet ScanFlow im freien Modus |
| **Kommzentrale** | Pro Anfrage: Button „KV-Anfrage erstellen" → InquiryToQuote |
| **Analyse** (Spec separat) | Anteil neuer Kunden pro Quelle (`source`-Feld) auswertbar; Conversion-Rate Lead→Kunde |
| **Buchhaltung** | Scan-Aktion „Als Beleg in Buchhaltung" landet dort |

---

## 11 · Akzeptanzkriterien

1. ScanFlow ist von allen 5 Trigger-Stellen aufrufbar (§ 3.1) und nutzt überall die gleiche `ErfassungModal.tsx`.
2. Erkennung eines Lieferscheins führt zu mindestens einer der 4 Aktionen (zuordnen / neuer Auftrag / Beleg / Kunde).
3. Telefonnotiz-Komponente wird nicht ersetzt — nur additive Erweiterung nach dem Speichern.
4. Verhaltenshinweise werden im UI klar visuell von Auftragsnotizen getrennt (gelb vs. weiß).
5. Verhaltenshinweise landen in `customers.behavior_notes`, nicht in `orders.*`.
6. Manueller Wizard hat drei Pflichtsektionen mit Validation (Kunde, mindestens 1 Teil, Liefertermin).
7. Teile-Sektion erlaubt Multi-Foto-Upload pro Teil mit Vorschau-Thumbnails.
8. Gemini Vision auf Teile-Fotos läuft asynchron, blockiert nicht die Erfassung.
9. Dubletten-Check bei Kundennamen läuft mit Debounce, zeigt bis zu 5 Vorschläge.
10. Bei „neu anlegen trotz Ähnlichkeit" erscheint zusätzliche Warnung.
11. Web-Anreicherung markiert ergänzte Felder lila, User muss bestätigen.
12. Alle Quellen werden in `source` und `source_ref` gespeichert (Audit-Spur).
13. KV-Anfragen (`is_quote=true`) werden in Listen und Statistik klar vom Auftrag (`is_quote=false`) unterschieden.
14. Etiketten- und Laufzettel-Druck steht in jedem Erfolgs-Screen zur Verfügung.
15. CI-Tokens durchgehend — kein hartcodierter Hex.
16. Build grün, keine Mock-Daten.

---

## 12 · Anti-Drift / STOPP-Bedingungen

- Bestehende `PhoneNoteEditor` oder `KommunikationClient` werden überschrieben → STOPP
- Verhaltensnotiz landet versehentlich am Auftrag statt am Kunden → STOPP
- Gemini-API-Key wird client-seitig importiert → STOPP
- Foto-Upload landet nicht in Supabase Storage sondern als Base64 in DB → STOPP
- Tabellennamen werden umbenannt (deutsche Spalten in `arbeitszeit_buchung` etc.) → STOPP
- Mock-Daten oder Math.random in Code-Pfad → STOPP
- Mehr als eine `ErfassungModal` Komponente → STOPP (eine universelle Quelle)

---

## 13 · Migrationen (Reihenfolge)

```sql
-- 1. customers erweitern
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS behavior_notes text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS enriched_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_lead boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_since timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- 2. orders erweitern
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS freetext_original text,
  ADD COLUMN IF NOT EXISTS is_quote boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_status text,
  ADD COLUMN IF NOT EXISTS quote_converted_order_id text;

-- 3. items Foto-Spalte sicherstellen
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS photo_ids jsonb DEFAULT '[]'::jsonb;

-- 4. inquiries (nur wenn nicht bereits durch Kommzentrale vorhanden)
CREATE TABLE IF NOT EXISTS inquiries ( ... );

-- 5. scan_uploads
CREATE TABLE IF NOT EXISTS scan_uploads ( ... );

-- 6. Storage Buckets
-- Manuell im Supabase Dashboard:
-- - scans (private, tenant-scoped)
-- - item-photos (private, tenant-scoped, falls noch nicht existent)

-- 7. PostgREST reload
NOTIFY pgrst, 'reload schema';
```

---

## 14 · Edge Function Secrets (zusätzlich)

Bestehende Secrets bleiben. Zusätzlich:

```
GEMINI_API_KEY              -- Gemini Pro Vision + Text API Key
GEMINI_MODEL_TEXT           -- z.B. "gemini-2.0-flash"
GEMINI_MODEL_VISION         -- z.B. "gemini-2.0-flash"
SCAN_STORAGE_BUCKET         -- "scans"
ITEM_PHOTO_STORAGE_BUCKET   -- "item-photos"
```

Setzen via `npx supabase secrets set GEMINI_API_KEY=...`.

---

## 15 · Reihenfolge der Umsetzung (empfohlen)

1. Migrationen (§ 13)
2. Storage Buckets anlegen (§ 13.6)
3. Gemini-Secrets setzen (§ 14)
4. Edge Functions in Reihenfolge: `customer-enrich`, `freetext-extract`, `notes-extract`, `scan-analyze`, `inquiry-extract`, `item-photo-analyze`
5. Shared Components: `ErfassungModal`, `ItemPhotoUploader`, `AiBadge`, `DuplicateWarning`
6. ManualFlow komplett (klarste Anforderungen, kein Anschluss an Bestehendes)
7. ScanFlow (universell, mehrere Trigger-Stellen)
8. PhoneFlow additive Erweiterung — vorher bestehenden `PhoneNoteEditor` lesen und dokumentieren
9. InquiryFlow additive Erweiterung — vorher bestehenden `KommunikationClient` lesen und dokumentieren
10. Verkabelung aller Trigger-Stellen
11. Build grün, Akzeptanzkriterien einzeln durchgehen
