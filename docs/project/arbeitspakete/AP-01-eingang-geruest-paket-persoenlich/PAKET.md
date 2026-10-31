# AP-01 · Eingang-Modul + Kanal „Paket/persönlich" (getippt → Auftrag), eine Wahrheit

Status: **bereit** (Planungschat 31.10.). Quelle: BAUPLAN spec `403d1b31ad24`, Abschnitt `eingang`; Befehle `eingang.anlegen`/`eingang.notiz`/`eingang.zuordnen`; Screens `M6 anliegenwahl`, `3.0 rein`, `3 eingang`. Kanalreihenfolge U-215: Paket/persönlich zuerst.

## Ziel
Ein neues Modul `src/modules/eingang/` wird die **einzige** Erfassungsstrecke der App. AP-01 baut den getippten Pfad „Paket/persönlich": Rotes Plus → `rein` → Text tippen → Anliegen „Auftrag" + Bestandskunde wählen → Auftrag `A-JJJJ-NNNN` entsteht. Jeder Eingang wird als `intake_item` festgehalten. Der alte `GlobalCreateFlow` wird im selben Paket abgelöst — keine zweite Strecke.

## Roter Faden / Datenfluss (eine Wahrheit)
1. **Einstieg:** Das app-weite `requestGlobalCreate(kontext?)` bleibt der einzige Auslöser (heute aus 8 Stellen: Order-/Kundenkarte, Orders, Werkstatt, Wareneingang, Communication, OfficeHome, Layout). Es öffnet künftig `rein` des neuen Moduls. Kontext (offene Kunden-/Auftragskarte) wird als `rein.kontext` übernommen.
2. **Erfassen:** Beim Öffnen erzeugt das Gerät `client_key` (UUID v4). Text eintippen → Live-Erkennung (`eingang.lesen`, ohne Speichern). Pflichtfelder stehen auf „fehlt", nie Ersatzwert.
3. **Buchen:** „Wareneingang buchen" ruft **eine** neue Server-Action `erfasseAuftragAusEingang` (Modul `eingang`). Sie schreibt in **einer** Transaktion: `intake_item` (kanal `notiz`, `zuordnung hand`, `kunde_id`), ruft den **kanonischen** `createOrderIntake` (keine zweite Auftragsanlage!), setzt `intake_item.vorgang_art='auftrag'`, `vorgang_id=orderNumber`, und schreibt `intake_event` (`angelegt`, `zugeordnet`).
4. **Ergebnis:** Auftrag in der Liste; DB: `intake_item` + `orders` + `order_intake_receipts` (über createOrderIntake) + `intake_event` + Event `ORDER_INTAKE_CREATED_V1`.

## Ist → Soll (gegen origin/main ae79c12f)
- IST getippter Pfad: `src/components/layout/GlobalCreateFlow.tsx:466` (Flow), `src/app/GlobalCreateAppAdapter.tsx:33/75` (Mount), `src/components/layout/globalCreateRequest.ts` (Trigger). Stille Vorbelegung (4/8 grün bei leer, Owner 29.10.) + alter Entwurf über `intake_drafts`.
- IST Auftragsanlage: `src/lib/server/commands/orderIntakeCommand.ts` → `createOrderIntake(CreateOrderIntakeInput): OrderIntakeCommandResult` (schreibt `public.orders`, `public.items`, `private.order_intake_receipts`). **Bleibt unverändert, wird wiederverwendet.**
- SOLL: `src/modules/eingang/` (public.ts + server-public.ts + `eingang.manifest.json` + Tenant-Injektion nach BEISPIELE_MODUL.md). Screen `rein`/`anliegenwahl`/`eingang` (getippt). `requestGlobalCreate` zieht in das Modul um; `@/components/layout/GlobalCreateFlow` wird zu einem Re-Export auf das Modul (8 Importstellen bleiben unverändert — eine Wahrheit ohne 8 Datei-Änderungen).

## Ersetzt / Entfernt (im selben Paket)
- `GlobalCreateFlow.tsx` (Interna), `GlobalCreateAppAdapter.tsx`, `globalCreateRequest.ts` → Logik ins Modul; am alten Pfad nur noch Re-Export von `requestGlobalCreate`.
- Alter Entwurf: `intake_drafts`-Nutzung im getippten Pfad entfällt (Stufe 1 ohne Entwurf, U-212). `private.intake_drafts` bleibt als Tabelle bestehen (kein Drop), wird aber nicht mehr geschrieben/gelesen; `src/lib/server/intakeDraft.ts`, `src/app/actions/intakeDraft.actions.ts`, Leser in `OfficeHome.tsx`/`todayDashboard.ts` werden im selben Paket entkoppelt (Entwurf erscheint nicht mehr).
- Stille Vorbelegungen entfallen ersatzlos.
- NICHT anfassen (spätere Kanäle, A9): OCR-Stack (`src/lib/ocr/**`, `src/lib/buchhaltung/ocr/**`, `src/components/intake/OCRReviewPanel.tsx`), `microsoftGraph.ts`, `order_intake_receipts`, `createOrderIntake`.

## Verbote (Grep-Gate)
- Keine zweite Erfassungsstrecke neben `src/modules/eingang/`; kein zweiter `GlobalCreateFlow`-Flow.
- Kein zweiter Weg zur Auftragsanlage neben `createOrderIntake`.
- Keine Ersatzwerte auf Pflichtfeldern (`?? 19`, `|| "Stück"`, `|| "Deutschland"`, `|| 14`).
- Keine Personennamen (Rolf/Phillip/Gregor) im Code. Kein `DELETE` auf `intake_item`/`intake_event`.

## Datenvertrag (neue Migration, additiv, RLS + Tenant — Konvention wie 20261025182920)
- `public.intake_item`: `id uuid PK`, `tenant_id text NOT NULL`, `client_key text NOT NULL` + `UNIQUE(tenant_id, client_key)` (Idempotenz), `kanal text CHECK IN (mail,notiz,foto,datei,scan,weitergeleitet,system)`, `richtung text CHECK IN (rein,raus,intern) DEFAULT 'rein'`, `quelle text CHECK IN (app,outlook,geraet,mailabruf)`, `erstellt_am timestamptz`, `erstellt_von uuid` (Login), `erstellt_auf text NULL`, `betreff text NULL`, `text text NULL CHECK (length ≤ 20000)`, `kunde_id uuid NULL REFERENCES public.customers(id)`, `vorgang_art text NULL CHECK IN (kv,auftrag,rechnung)`, `vorgang_id text NULL`, `zuordnung text CHECK IN (offen,automatisch,bestaetigt,hand) DEFAULT 'offen'`, `einsatz text CHECK IN (offen,erledigt,info) DEFAULT 'offen'`, `geaendert_von uuid`, `geaendert_am timestamptz`, `version int NOT NULL DEFAULT 1`, `created_at/updated_at`. RLS `intake_item_tenant_isolation`; `GRANT SELECT, INSERT, UPDATE ... service_role` (kein DELETE — Spec `daten.intake_item.regeln`).
- `public.intake_event` (nur anhängen): `id uuid PK`, `tenant_id`, `item_id uuid REFERENCES public.intake_item(id)`, `zeit timestamptz DEFAULT statement_timestamp()`, `art text CHECK IN (angelegt,zugeordnet,anliegen,einsatz,...)`, `befehl_id uuid`, `von text`, `vorher jsonb`, `nachher jsonb`, `geraet_id text NULL`. RLS; `GRANT SELECT, INSERT` (kein UPDATE/DELETE, append-only).
- Leerer Pflichtwert → „fehlt" mit Sprung zur Eingabe (nie Ersatzwert).
- Weitere Tabellen (`intake_file`, `intake_suggestion`, `device_request`, `goods_receipt`) = Folgepakete (Scan/Foto/Ware/Mail), nicht in AP-01.

## Vertrag (Signaturen)
```ts
// src/modules/eingang/server-public.ts
export type ErfasseAuftragInput = {
  clientKey: string;                 // UUID v4 des Eingangs (= intake_item.client_key)
  text: string | null;              // getippte Notiz
  customer: { mode: "EXISTING"; id: string };   // AP-01: nur Bestandskunde
  dueDate: string;                   // ISO-Datum
  items: OrderIntakeItemInput[];     // wie createOrderIntake
  handoverMode?: "pickup" | "shipping";
  paymentMode?: PaymentMode;
};
export type ErfasseAuftragResult =
  | { code: "OK"; orderNumber: string; orderId: string; intakeItemId: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "CONFLICT"; message: string };     // client_key bereits verbucht
export function erfasseAuftragAusEingang(input: unknown): Promise<ErfasseAuftragResult>;
```
- Recht: Bereich `eingang` (BAUPLAN `eingang.befehle[eingang.notiz]`/`[eingang.anlegen]`; KV käme mit `geld`, nicht in AP-01). Server prüft genau dieses Recht.
- Idempotenz: `clientKey`. Zweiter Aufruf mit gleichem `clientKey` → `CONFLICT`, keine zweite Zeile.
- Ruft intern `createOrderIntake` mit `customer EXISTING`; dessen `VALIDATION_ERROR` (z. B. Kunde unvollständig) wird durchgereicht.

## Technische Freiheit
- Modul-Interna (Komponenten, State, Transaktionsführung) frei, solange Vertrag, Verbote und Idempotenz stimmen.

## Optische Umsetzung
- Maßstab ist der Endversion-Prototyp (spec 403d1b31ad24), Screens `rein`/`anliegenwahl`/`eingang`. Farben V1.1, Größen/Bedienbarkeit V8, Touch ≥ 48 px. Heller, fast weißer Hintergrund, keine creme/sand Flächen. Wichtige Knöpfe farbig nach Dringlichkeit. Keine doppelten Beschreibungen. Pflichtfelder ohne Wert zeigen „fehlt" statt Vorbelegung. Der HTML-Mock geht NICHT an Codex — nur der Bauplan.

## Gate
- Akzeptanztest `AP-01-eingang-paket-persoenlich.acceptance.test.ts` (dieser Ordner) → Codex kopiert ihn unverändert nach `src/test/acceptance/`, SHA-256 in der Abgabe; nie ändern.
- Grep-Gate: kein zweiter Erfassungs-Flow; keine Ersatzwert-Literale; `createOrderIntake` ist der einzige Auftrags-Schreibweg.
- Modul-Gates (`check-module-gates`) grün; `eingang.manifest.json` vorhanden.

## Abnahme (Owner-Klickweg ≤ 6 Schritte, Preview-Link des SHA in der Abgabe)
1. Als Rolf anmelden. 2. Rotes Plus → „rein" öffnet sich. 3. Text tippen (z. B. „2 Stück Flansch verzinken"). 4. Anliegen „Auftrag" wählen, Bestandskunde suchen und wählen; leere Pflichtfelder zeigen „fehlt". 5. „Wareneingang buchen". 6. Prüfen: Auftrag `A-2026-00NN` in der Liste; DB hat `intake_item` (kanal notiz, vorgang_id = Nummer), `orders`, `intake_event`, Event `ORDER_INTAKE_CREATED_V1`.

## Annahmen (ANNAHMEN.md)
- A-01 korrigiert (Migration nötig, aus DB-Abgleich). A-02 aus Spec belegt (Auftrag=`eingang`, KV=`geld`). A-03 = Schnitt-Entscheidung des Planungschats (Bestandskunde zuerst; Neukunde=AP-02, Ware=AP-03). Endversion-Chat darf widersprechen, bis Bau beginnt.
