# 12_KOMMUNIKATIONSZENTRALE_v2.md

**Projekt:** Galvanik Kreile · WerkstattCockpit
**Modul:** Kommunikationszentrale (konsolidiert)
**Status:** Aktiv · **überschreibt v1**
**Begleitdokument:** `kreile_kommunikationszentrale_mockup_v2.html`

---

## 0. Was sich gegenüber v1 ändert

Drei Schiebungen, die das Konzept entscheidend stärker machen:

1. **„Keine-Sackgasse"-Prinzip** — die größte Katastrophe wäre, wenn Infos im Posteingang versanden. Jede eingehende Nachricht produziert **automatisch Folge-Aktionen** in mindestens 2–3 anderen App-Bereichen (Kalender, Auftrag, Buchhaltung, Kundenkarte, Qualität, Performance). Der Chef bestätigt nur noch.
2. **Live-Kontext im Telefonat** — wer am Telefon klärt, braucht alle Infos parallel: Kalender frei? Material da? Zahlung offen? Letzter Auftrag? Das Telefonnotiz-Modal ist deshalb kein Notiz-Block mehr, sondern ein **Live-Cockpit fürs Gespräch**.
3. **WhatsApp-Optik** — Chat-Bubbles, Avatare, Antwortpfeile, KI-Vorschläge als Inline-Cards. Freundlicher, schneller, weniger E-Mail-Software-Charakter.

---

## 1. STOPP-Zonen (unverändert aus v1)

| Bereich | Pfad | Grund |
|---|---|---|
| Werkstattfluss | `src/components/layout/TopWorkflowBar.tsx` | läuft |
| Linke Sidebar | `src/components/layout/SidebarNav.tsx` | läuft |
| Stationsseiten | `src/pages/station/*` | Werkstatt-Kern |
| Auftragslogik | `src/lib/orders/*`, Tabelle `orders` | Datenkern (nur Lesen + neue Felder, kein Refactor) |
| Wareneingang | `src/pages/wareneingang/*` | eigener Flow |
| Smart-Scan-Branch | `feat/smart-scan-intake` | geparkt |

**Lese-Erlaubnis** + **Erweiterung erlaubt** (additiv, ohne Bruch): `customers`, `orders`, `users`, `materials`, `calendar_events`, `invoices`. Erweiterungen werden in §4 dokumentiert.

---

## 2. Kern-Prinzip „Keine Sackgasse"

Wenn der Chef eine Nachricht öffnet und keine sofortige Aktion daraus folgt, hat die App versagt. Jede Nachricht durchläuft eine Pipeline:

```
Eingang → Parse → Klassifikation → Entity-Extraktion → Konfliktprüfung → Action-Vorschläge → Bestätigung → Verteilung → Done
```

Die **Verteilung** ist der entscheidende Schritt. Eine eingehende Reklamations-E-Mail mit Foto produziert beispielsweise diese Folge-Aktionen:

| Aktion | Ziel-Bereich | Auto oder Bestätigung |
|---|---|---|
| Anlage Reklamations-Eintrag | `complaints` | auto |
| Foto-Anhang in Auftrag verlinken | `order_attachments` | auto |
| Bild-Analyse durch GoogleAI Vision | `message_attachments.vision_labels` | auto |
| Eintrag in Qualität-Cluster | `quality_clusters` | auto |
| Kunden-Akte: Reklamations-Counter +1 | `customers.complaint_count` | auto |
| Antwortvorlage „Eingang bestätigt" vorbereitet | UI-Vorschlag | Bestätigung |
| Versanddienstleister-Schaden vorbereitet | Entwurf in `outbound_drafts` | Bestätigung |
| Performance-Marker: „möglicher Bad-3-Drift" | `quality_clusters` | auto wenn Wiederholung |

Eine eingehende Telefonnotiz mit Abhol-Anfrage produziert:

| Aktion | Ziel-Bereich | Auto oder Bestätigung |
|---|---|---|
| Kalender-Check Wunschtermin | `calendar_events` (Lesen) | auto |
| Konfliktprüfung gegen Öffnungszeiten/Urlaub | `business_hours`, `staff_absences` | auto |
| Kalendereintrag „Abholung morgen 10:00" | `calendar_events` (Schreiben) | Bestätigung |
| Auftrag aktualisieren: Abholtermin, Zahlart | `orders.pickup_at`, `orders.payment_method` | Bestätigung |
| Zahlungsstatus aus Rechnung holen | `invoices` (Lesen) | auto |
| Antwort-Entwurf erzeugen | UI-Vorschlag | Bestätigung |
| Notiz an Kundenakte hängen | `customer_notes` | auto |

**UX-Konsequenz:** Im Chat-View erscheint nach jeder eingehenden Nachricht eine **„Cockpit"-Karte** (dunkle KI-Bubble), die alle vorbereiteten Aktionen als Mini-Grid zeigt. Chef klickt entweder „Alle anwenden" oder einzeln. Verwerfen ist auch erlaubt — aber die Karte verschwindet nicht, bis aktiv entschieden wurde. Das verhindert das Versanden.

---

## 3. Modul-Architektur

```
/kommunikation               Hauptmodul, jetzt mit WhatsApp-Optik
├── Chats                    (Default-Tab, 4-Spalten-Layout)
├── Tagesfokus               (priorisierte Karten mit Action-Hint)
├── Qualität                 (Reklamationen, automatisch befüllt)
├── Vorlagen                 (Antwortbausteine)
└── Kanäle & Admin           (Anbindung)
```

**Sidebar-Eintrag:** „Kommunikation" mit Badge = Summe ungelesener + brennender Vorgänge.

---

## 4. Datenmodell (Migration `2026_06_xx_kommunikationszentrale.sql`)

Neue Tabellen + additive Erweiterungen bestehender Tabellen.

```sql
-- ===== Neue Tabellen =====

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','whatsapp','instagram','website','phone_note','sms','internal_note')),
  direction text not null check (direction in ('inbound','outbound')),
  external_id text,
  thread_id uuid,
  from_label text,
  from_address text,
  subject text,
  raw_text text,
  cleaned_text text,
  received_at timestamptz not null default now(),
  read_at timestamptz,
  status text not null default 'new' check (status in ('new','in_progress','waiting_customer','waiting_me','done','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','burning')),
  category text,
  customer_id uuid references customers(id),
  order_id uuid references orders(id),
  assigned_to uuid references users(id),
  attachments_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index messages_received_at_idx on messages (received_at desc);
create index messages_status_idx on messages (status) where status != 'archived';
create index messages_customer_idx on messages (customer_id);
create index messages_order_idx on messages (order_id);
create index messages_cleaned_text_fts on messages using gin (to_tsvector('german', coalesce(cleaned_text, '')));

create table message_analyses (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  provider text not null default 'gemini-1.5-flash',
  entities jsonb,                                    -- {customer:[], material:[], orders:[], dates:[], money:[]}
  themes text[],
  category text,
  urgency text,
  suggested_reply text,
  confidence numeric(3,2),
  reasoning text,
  created_at timestamptz default now()
);

create table message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes int,
  vision_labels jsonb,
  linked_order_id uuid references orders(id),         -- KI verlinkt Foto direkt zum Auftrag
  is_damage_photo boolean default false,
  created_at timestamptz default now()
);

-- ===== KERN: message_actions — die "Keine-Sackgasse"-Tabelle =====
create table message_actions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  action_type text not null,                          -- siehe Liste unten
  target_table text,                                  -- z.B. 'orders', 'calendar_events', 'invoices'
  target_id uuid,                                     -- ID im Ziel
  payload jsonb not null,                             -- die konkrete geplante Änderung
  auto_apply boolean default false,                   -- true = ohne Bestätigung
  status text not null default 'pending' check (status in ('pending','applied','dismissed','failed')),
  applied_at timestamptz,
  applied_by uuid references users(id),
  result jsonb,                                       -- z.B. {created_id: ..., conflicts: []}
  created_at timestamptz default now()
);

create index message_actions_message_idx on message_actions (message_id);
create index message_actions_status_idx on message_actions (status) where status = 'pending';

-- Erlaubte action_type-Werte (per Konvention, nicht Enum, damit erweiterbar):
-- 'create_calendar_event'
-- 'update_order_pickup'
-- 'update_order_payment_method'
-- 'link_attachment_to_order'
-- 'create_complaint'
-- 'add_to_quality_cluster'
-- 'increment_complaint_count'
-- 'create_invoice_draft'
-- 'create_invoice_reminder'
-- 'mark_invoice_paid'
-- 'add_customer_note'
-- 'create_outbound_draft'
-- 'schedule_callback'
-- 'create_quality_action'

create table reply_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  channel text,
  category text,
  body text not null,
  variables jsonb default '[]'::jsonb,                -- Liste der erwarteten Platzhalter
  is_active boolean default true,
  sort_order int default 0,
  updated_at timestamptz default now()
);

create table channel_configs (
  id uuid primary key default gen_random_uuid(),
  channel text unique not null,
  is_enabled boolean default false,
  status text default 'demo' check (status in ('online','demo','error','off')),
  config_encrypted text,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz default now()
);

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean default false
);

create table staff_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  starts_at date not null,
  ends_at date not null,
  reason text                                          -- 'urlaub','krankheit','seminar'
);

-- ===== Additive Erweiterungen bestehender Tabellen =====

alter table orders add column if not exists pickup_at timestamptz;
alter table orders add column if not exists pickup_confirmed boolean default false;
alter table orders add column if not exists payment_method text;                       -- 'bar','rechnung','überweisung','ec'
alter table orders add column if not exists last_communication_at timestamptz;
alter table customers add column if not exists complaint_count int default 0;
alter table customers add column if not exists last_contact_at timestamptz;
alter table customers add column if not exists communication_preference text;          -- 'email','phone','whatsapp'

-- ===== RLS =====
alter table messages enable row level security;
alter table message_analyses enable row level security;
alter table message_attachments enable row level security;
alter table message_actions enable row level security;
-- Policies: nur authentifizierte Werkstatt-User, Inserts via RPCs.
```

**Storage-Bucket:** `messages` (private, Lifecycle 12 Monate, 20 MB max).

---

## 5. Action-Executor — der Kern von „Keine Sackgasse"

Jede Action hat einen Handler in `src/lib/kommunikation/actions/`:

```ts
// src/lib/kommunikation/actions/types.ts
export type ActionType =
  | 'create_calendar_event'
  | 'update_order_pickup'
  | 'update_order_payment_method'
  | 'link_attachment_to_order'
  | 'create_complaint'
  | 'add_to_quality_cluster'
  | 'increment_complaint_count'
  | 'create_invoice_draft'
  | 'create_invoice_reminder'
  | 'mark_invoice_paid'
  | 'add_customer_note'
  | 'create_outbound_draft'
  | 'schedule_callback'
  | 'create_quality_action';

export interface ActionHandler<T = unknown> {
  type: ActionType;
  validate(payload: T, ctx: ActionContext): Promise<ValidationResult>;  // Konflikt-Check
  preview(payload: T, ctx: ActionContext): Promise<string>;             // menschlich lesbarer Hinweis
  execute(payload: T, ctx: ActionContext): Promise<ExecuteResult>;
}

export interface ActionContext {
  message: Message;
  customer?: Customer;
  order?: Order;
  user: User;
}
```

**Pipeline:**

1. Inbound message landet in `messages` (per Connector).
2. Worker ruft `analyzeMessage()` → Gemini liefert Entities + vorgeschlagene Actions.
3. Pro vorgeschlagene Action: `validate()` ruft Handler → liefert Konflikte (Termin belegt? Auftrag im falschen Status? Rechnung nicht offen?).
4. Actions in `message_actions` mit `status='pending'` und Konflikt-Info im `result.conflicts`.
5. Frontend zeigt im Chat-View die KI-Karte mit allen pending Actions, inkl. Konflikt-Warnung.
6. User klickt „Alle anwenden" oder einzeln → `execute()` läuft → `status='applied'`.

**Wichtig:** Verwerfen setzt `status='dismissed'` mit Grund. Eine Nachricht ohne *irgendeine* applied/dismissed Action bleibt im Posteingang als „ungeklärt" sichtbar (Filter „Hat offene Aktionen"). Das ist die strukturelle Anti-Sackgasse-Garantie.

**Beispiel: Konfliktprüfung Kalender**

```ts
// actions/createCalendarEvent.ts
validate({ at, duration_min, title }, ctx) {
  const conflicts = [];
  // 1. Öffnungszeiten
  const dow = at.getDay();
  const hours = await getBusinessHours(dow);
  if (hours.is_closed) conflicts.push({ severity: 'block', msg: 'Werkstatt geschlossen' });
  else if (at < hours.opens_at || at > hours.closes_at) conflicts.push({ severity: 'warn', msg: 'außerhalb Öffnungszeiten' });
  // 2. Urlaub
  const absences = await getAbsencesOn(at);
  if (absences.length > 0) conflicts.push({ severity: 'warn', msg: `Abwesend: ${absences.map(a => a.user.name).join(', ')}` });
  // 3. Andere Termine
  const overlaps = await getOverlappingEvents(at, duration_min);
  if (overlaps.length > 0) conflicts.push({ severity: 'block', msg: `Kollision mit ${overlaps[0].title}` });
  return { ok: conflicts.filter(c => c.severity === 'block').length === 0, conflicts };
}
```

Wenn `block`: Aktion-Card zeigt rote Warnung + Alternativ-Vorschlag (nächster freier Slot).

---

## 6. Connector-Architektur (unverändert aus v1, leicht ergänzt)

Adapter-Pattern wie in v1. **Ergänzung:** Jeder Connector liefert beim `pullInbound()` strukturierte `RawMessage` plus optional vorab erkannte Attachments. Bei E-Mail werden Anhänge sofort in den Storage-Bucket hochgeladen und Bilder durch GoogleAI Vision analysiert (Damage/Material/Text-Erkennung).

**Worker-Pipeline:**

```
Worker (alle 2 Min)
  ↓ pro Connector: pullInbound()
  ↓ INSERT messages
  ↓ INSERT message_attachments
  ↓ Vision-Analyse für Bilder (async, parallel)
  ↓ analyzeMessage() → Gemini
  ↓ INSERT message_analyses
  ↓ generate proposed actions → INSERT message_actions (pending)
  ↓ validate actions → conflicts in result
  ↓ Supabase Realtime: Frontend bekommt Push
```

**Resilienz:** Wenn Gemini ausfällt, bleibt die Nachricht im Posteingang, aber ohne KI-Karte. Lokales Matching (Kundenname-Regex + Auftragsnr-Regex) läuft trotzdem.

---

## 7. Gemini-Integration (erweitert)

**Modell:** `gemini-1.5-flash`. Hybrid-Strategie wie in v1:

1. **Lokal zuerst**: `matchCustomer.ts`, Auftragsnr-Regex, Material-Lexikon → harte Fakten.
2. **Gemini danach**: bekommt Text + lokal erkannte Fakten + bestehenden Kontext (offene Aufträge, Kalender-Slots, Zahlungsstatus) → liefert Themen, Kategorie, Dringlichkeit, Antwortvorschlag UND **konkrete Action-Liste**.

**Erweiterter Prompt (`prompts.ts`):**

```ts
export const ENTITY_REPLY_ACTIONS_PROMPT = `
Du bist Assistent für Galvanik Kreile (Galvanik-Handwerksbetrieb).
Analysiere die folgende eingehende Nachricht und liefere strukturiertes JSON.

KONTEXT (aus DB):
- Erkannter Kunde: {{customer}}
- Offene Aufträge des Kunden: {{customerOpenOrders}}
- Erkannte Auftragsnummer im Text: {{detectedOrderId}}
- Auftragsdetails falls erkannt: {{orderDetails}}
- Erkanntes Material: {{material}}
- Lager-Status Material: {{materialStock}}
- Offene Rechnungen des Kunden: {{openInvoices}}
- Kalender 7 Tage: {{calendarSlots}}
- Öffnungszeiten: {{businessHours}}
- Abwesenheiten: {{absences}}

NACHRICHT:
"""
{{messageText}}
"""

Liefere ausschließlich gültiges JSON in dieser Struktur:
{
  "category": "reklamation"|"rueckfrage"|"termin"|"freigabe"|"buchhaltung"|"neuanfrage"|"sonst",
  "urgency": "low"|"normal"|"high"|"burning",
  "themes": string[],
  "confidence": 0..1,
  "suggested_reply": string,
  "proposed_actions": [
    {
      "type": "create_calendar_event" | "update_order_pickup" | "update_order_payment_method"
            | "link_attachment_to_order" | "create_complaint" | "add_to_quality_cluster"
            | "increment_complaint_count" | "create_invoice_draft" | "create_invoice_reminder"
            | "mark_invoice_paid" | "add_customer_note" | "create_outbound_draft"
            | "schedule_callback" | "create_quality_action",
      "payload": object,
      "reason": string,
      "auto_apply_recommended": boolean
    }
  ]
}

REGELN:
- Wenn Reklamation: IMMER create_complaint + increment_complaint_count + add_customer_note.
- Wenn Abhol-Termin im Text: IMMER create_calendar_event mit konkretem Zeitvorschlag + update_order_pickup.
- Wenn Zahlungsfrage: IMMER mark_invoice_paid (wenn schon bezahlt) oder create_invoice_reminder (wenn offen).
- Wenn Foto im Anhang und Auftragsnr erkennbar: IMMER link_attachment_to_order.
- Niemals leere proposed_actions-Liste bei Inbound-Nachrichten zurückgeben — falls unsicher: schedule_callback + add_customer_note.
`;
```

**Telefonnotiz live**: gleicher Prompt, aber gestreamt und debounced (600 ms, Cap 10 Calls pro Notiz, Min-Textlänge 20 Zeichen).

**Datenschutz:** AVV mit Google Cloud, EU-Region wenn möglich. Personendaten in Prompt-Logs limitieren (nur in DB).

---

## 8. Telefonnotiz — Live-Cockpit (Star-Feature)

Das Telefonnotiz-Modal ist neu strukturiert. Links: Texteingabe (tippen oder diktieren). Rechts: **fünf Live-Sektionen**, die sich beim Tippen automatisch füllen.

| Sektion | Datenquelle | Aktualisierungs-Trigger |
|---|---|---|
| **Kunde** | `customers` via Fuzzy-Match | bei Kundennamen-Treffer |
| **Offene Aufträge** | `orders WHERE customer_id AND status != 'done'` | bei Kunden-Erkennung |
| **Kalender · Wunschtermin** | `calendar_events` + `business_hours` + `staff_absences` | bei Zeit-Phrase im Text |
| **Lager** | `materials.stock_level` | bei Material-Erkennung |
| **Zahlung** | `invoices` aggregiert | bei Kunden-Erkennung |
| **Antwort-Vorschlag** | Gemini-Output | bei Kombination Kunde+Material/Auftrag |

**Beispiel im Mockup:** Tippe „Müller fragt nach Zinkteilen Auftrag A-2026-0042 morgen" → rechts sofort:
- Kunde: Müller (Berlin, seit 2018, 14 Aufträge)
- Aufträge: A-2026-0042 (fertig, hervorgehoben), A-2026-0058 (in Bearbeitung)
- Kalender: Donnerstag 4.6. grün markiert „frei ✓"
- Lager: Zink 88 % voll, Bad 3
- Zahlung: 248 € offen, pünktliche Zahlungsmoral, Barzahlung bevorzugt
- Antwort: „Ihre Zinkteile sind fertig. Termin morgen 10:00 frei. Offene Rechnung 248 €."

**„Speichern & Aktionen anwenden"** speichert die Notiz UND führt die vorbereiteten Aktionen (Kalender, Auftrag aktualisieren, Notiz an Kundenakte) atomar aus.

**Bearbeitbar nach Speichern:** Telefonnotiz ist editierbar (`messages.cleaned_text` mit `updated_at`). Bei Edit werden die Aktionen NICHT erneut gefeuert — der User entscheidet aktiv.

**Hotkey** `T` global. Diktat via Web Speech API (Chromium).

---

## 9. UI — WhatsApp-Look

**Layout Chats-Tab:** vier Spalten.

```
[ 76 px ]  [ 320 px ]  [ flex 1   ]  [ 320 px ]
Rail       Chat-Liste  Chat-View    Smart-Panel
```

| Element | Spec |
|---|---|
| **Rail (links)** | schmal, Icon + Mini-Label, aktiver Tab = dunkel mit cream-Text. Demo-Pill an WhatsApp/Instagram. |
| **Chat-Liste** | Avatare 44 px mit Initialen, Channel-Mini-Icon unten rechts am Avatar, Name + Snippet, Ungelesen-Pill in Grün rechts (#16A34A). Urgenz-Balken vor dem Namen (rot/orange/blau). |
| **Chat-View** | cream-Hintergrund mit subtiler Dot-Pattern. Eingehende Bubbles weiß, ausgehende sand (#F2E9D6). Bubble-Tail unten-links/rechts. Lese-Häkchen grün. Date-Divider als Pill in der Mitte. |
| **AI-Cockpit-Karte** | dunkle Bubble zentriert, mit „Cockpit"-Tag, grünem Puls. Action-Grid 2×2 mit Mini-Icons. Primärbutton hell („Alle anwenden"). |
| **Composer** | runder Eingabe-Bubble, Kanal-Auswahl als Pill links („📧 E-Mail / 💬 SMS / 📝 Notiz"). Anhang-Button rund. Senden-Button rund schwarz. Vorschlags-Chips violett oberhalb. |
| **Smart-Panel (rechts)** | Kundenkarte mit Avatar, Micro-Stats (Aufträge / Offen), Offene Aufträge mit Status-Pill, Kalender-Strip 6 Tage, Lager-Rows, Zahlungs-Block. |

**Farbpalette:**

| Token | Wert |
|---|---|
| `--cream` | `#FAF6EE` |
| `--bubble-in` | `#FFFFFF` |
| `--bubble-out` | `#F2E9D6` |
| `--bubble-action` | `#1B1B1B` (dunkel, KI-Karte) |
| `--green-bright` | `#16A34A` (Ungelesen-Pill, Lese-Häkchen, frei-Slots) |
| Highlights Telefonnotiz | wie v1 (Kunde blau, Material gelb, Thema grün, Zeit orange, Auftrag violett) |

**Schriften:** Fraunces (Display + Telefonnotiz-Body) + Manrope (UI). **Keine generischen Inter-Defaults.**

**Mobile/Tablet:** ab 1100 px → Smart-Panel wird zu Drawer (Icon-Toggle). Ab 768 px → Chat-Liste und Chat-View werden separate Routen (klassisches Mobile-Pattern).

---

## 10. Bauplan in 4 Phasen (aktualisiert)

### Phase A — Datenfundament + Routing (½–1 Tag)

- Migration ausführen (§4): alle neuen Tabellen + additive Spalten
- `channel_configs` seeden
- `business_hours` mit Standard-Werkstattzeiten seeden (Mo–Fr 8–17, Sa–So zu)
- Route `/kommunikation` mit Tab-Container
- Sidebar-Badge

**Akzeptanz:** Migration sauber, keine bestehende Funktion gebrochen, Route erreichbar.

### Phase B — Telefonnotiz Live-Cockpit (2 Tage)

- `TelefonnotizModal` mit Live-Highlight-Editor (siehe HTML-Mockup, JS-Mechanismus 1:1 übernehmen)
- 5 Live-Sektionen rechts (Kunde, Aufträge, Kalender, Lager, Zahlung)
- Backend-Endpoint `/api/kommunikation/telefonnotiz/analyze` (debounced, mit Cap)
- Speichern → INSERT in `messages` + `message_analyses` + `message_actions` (pending)
- „Aktionen anwenden" → Executor läuft → Kalender-Eintrag, Order-Update, Customer-Note
- Hotkey `T`
- Telefonnotiz nachträglich bearbeitbar

**Akzeptanz:**
- Tippen „Müller A-2026-0042 morgen abholen" → in <500 ms alle 5 Sektionen befüllt
- Wunschtermin „morgen" wird grün im Kalender markiert wenn frei
- Speichern erzeugt Kalendereintrag, aktualisiert Auftrag, hängt Notiz an Kundenakte
- Konflikt-Test: Termin am Sonntag → rote Warnung, alternativer Vorschlag
- Bei Gemini-Ausfall: lokales Matching funktioniert weiter, keine Antwortvorschlag-Bubble

### Phase C — Chats-View mit Bubbles + AI-Cockpit-Karten (2 Tage)

- WhatsApp-Layout (4 Spalten, Rail + Liste + View + Smart-Panel)
- Bubbles (in/out, mit Subject-Tag, Anhang-Vorschau, Lese-Häkchen)
- AI-Cockpit-Karte rendert pending `message_actions` als Mini-Grid
- „Alle anwenden" / einzeln anwenden / verwerfen
- Composer mit Kanal-Auswahl, Anhang-Upload (Foto, Datei → Supabase Storage), Vorschlags-Chips
- Senden via aktivem Connector
- Smart-Panel rechts mit Kunde, Aufträge, Kalender, Lager, Zahlung — gefüllt aus selected message
- Realtime-Subscription auf `messages`

**Akzeptanz:**
- Neue E-Mail im IMAP-Postfach → erscheint in <2 Min als eingehende Bubble + AI-Cockpit-Karte mit ≥2 Action-Vorschlägen
- Foto-Anhang wird durch Vision analysiert (Damage-Marker), automatisch an erkannten Auftrag verlinkt
- Klick „Alle anwenden" auf AI-Karte → Kalender, Auftrag, Customer-Note werden atomar aktualisiert; bestätigend wird AI-Karte zu „erledigt" markiert
- Smart-Panel rechts zeigt korrekte Kundenstatistik
- Antwort senden via E-Mail funktioniert (echte Test-Mail)
- Anhang an Antwort hängbar
- Konfliktprüfung: Versuch Termin Sonntag → AI-Karte zeigt Warnung mit Alternative

### Phase D — Tagesfokus, Qualität, Vorlagen, Kanäle-Admin (2 Tage)

- **Tagesfokus**: Server-Query nach (priority, customer_value, age). Karte zeigt verfügbare Quick-Actions inkl. „Alle Aktionen anwenden" wenn AI-Karte vorliegt.
- **Qualität**: Aggregations-Query auf `messages WHERE category='reklamation'` + `complaints`. Cluster nach Station (aus verknüpften Aufträgen). Wiederholungs-Tag wenn >1 Fall in 7 Tagen. KI-Maßnahme (gecached 24h).
- **Vorlagen**: CRUD-Editor mit Platzhalter-Vorschau und Variable-Hinweisen aus `variables`.
- **Kanäle-Admin**: Statusliste + Toggle + Onboarding-Modale (E-Mail real, andere als geführte Anbindung).

**Akzeptanz:** Alle 5 Tabs liefern echte Daten, keine Demo-Reste außer wo bewusst markiert (WhatsApp/Instagram Demo bis Anbindung).

---

## 11. Gesamt-MVP-Akzeptanz

- [ ] Posteingang zeigt echte E-Mails in <2 Min nach IMAP-Eintreffen
- [ ] Pro Inbound-Nachricht: AI-Cockpit-Karte mit ≥2 vorgeschlagenen Aktionen
- [ ] Aktionen wenden tatsächlich Kalender / Auftrag / Buchhaltung / Kundenkarte an
- [ ] Konflikt-Validierung (Öffnungszeiten, Urlaub, Kollisionen) funktioniert
- [ ] Telefonnotiz Live-Cockpit zeigt alle 5 Sektionen
- [ ] Bilder werden durch Vision analysiert und an Aufträge verlinkt
- [ ] Reklamationen erscheinen automatisch in Qualität-Tab und erhöhen Customer-Counter
- [ ] Globale Suche findet auch alte Telefonnotizen (FTS auf `cleaned_text`)
- [ ] Anhänge können an Antworten gehängt werden
- [ ] WhatsApp-Look ist umgesetzt (Bubbles, Avatare, Lese-Häkchen, Smart-Panel)
- [ ] Kein Bruch bestehender Werkstatt-Funktionen
- [ ] Mobile/Tablet ab 768 px nutzbar (Chat-Liste/View getrennt, Smart-Panel als Drawer)

---

## 12. Reporting-Pflicht nach jeder Phase

Format wie v1. **STOPP-Bedingungen** (additiv):

- Action-Executor würde Daten in einer Tabelle ändern, die nicht in §4 als beschreibbar gelistet ist → STOPP
- Gemini-API-Kosten >5 € im Test → STOPP
- Bestehende `orders`-Spalte würde geändert (statt nur additiv) → STOPP

---

## 13. Was bewusst NICHT in dieser Spec ist

- WhatsApp-API-Setup-Detail (eigenes Onboarding-Dokument, wenn Meta-Business bestätigt)
- Instagram-OAuth-Detail
- SMS-Versand (Twilio) als Aktion vorgesehen, aber Connector erst Phase 2
- Marketing-Analytics für Web/Instagram (laut Memory deferred)
- Smart-Scan-Branch (geparkt)
- Block 4 Admin/Lizenz (geparkt)
- Evas Lerninsel (anderes Projekt, hier nichts zu suchen)

---

## 14. Übergabe an Antigravity

Antigravity erhält:

1. `12_KOMMUNIKATIONSZENTRALE_v2.md` — Master-Spec
2. `kreile_kommunikationszentrale_mockup_v2.html` — visuelle Referenz (im Browser öffnen)
3. `AGENTS.md` — Verhaltensgrundlage

**Erste Antigravity-Aufgabe:** Diagnose-Pass **nur Lesen**:
- Prüfe `src/components/layout/`, `src/pages/`, `supabase/migrations/`, `src/lib/orders/`, vorhandene Calendar/Invoice-Module
- Berichte: was existiert real (über Mock hinaus)? Welche Tabellen sind bereits da? Wo gibt es Konfliktrisiken mit additiver Erweiterung?
- Erst nach Bestätigung → Phase A.

---

**Ende v2.**
