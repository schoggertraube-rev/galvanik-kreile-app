# AP-01 · Eingang-Modul + Kanal „Paket/persönlich" (getippt → Auftrag), eine Wahrheit

Status: **bereit** — Voraussetzung: Trust-Anchor B2 (`TRUST_ANCHOR_B2.md`) ist auf main gemergt. Fassung 2 vom 31.10. (korrigiert nach BLOCKER.md von Codex: Action-Pfad, keine Einzel-Transaktion, createOrderIntake unverändert).
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block **B2**, Branch **`kreile/b2-eingang`** (frisch von main nach dem Trust-Anchor).
WAS: BAUPLAN spec `403d1b31ad24` (Owner-Freigabe 31.10.), Abschnitt `eingang`; Befehle `eingang.anlegen`/`eingang.notiz`/`eingang.zuordnen`; Screens `M6 anliegenwahl`, `3.0 rein`, `3 eingang`.

## Ziel
Neues Modul `src/modules/eingang/` wird die **einzige** Erfassungsstrecke. AP-01 baut den getippten Pfad „Paket/persönlich": Rotes Plus → `rein` → Text tippen → Anliegen „Auftrag" + Bestandskunde → Auftrag `A-JJJJ-NNNN`. Jeder Eingang wird als `intake_item` festgehalten. Der alte `GlobalCreateFlow` wird im selben Paket abgelöst.

## Roter Faden / Datenfluss (eine Wahrheit, idempotente Reihenfolge)
1. **Einstieg:** `requestGlobalCreate(kontext?)` bleibt einziger Auslöser (8 Aufrufstellen unverändert), öffnet künftig `rein` des Moduls. Kontext einer offenen Kunden-/Auftragskarte wird übernommen.
2. **Erfassen:** Gerät erzeugt beim Öffnen `clientKey` (UUID v4). Text tippen → Live-Erkennung ohne Speichern. Pflichtfelder „fehlt", nie Ersatzwert.
3. **Buchen** über die Server-Action `erfasseAuftragAusEingangAction` in drei idempotenten Schritten (KEINE gemeinsame Transaktion mit createOrderIntake nötig):
   - a) `intake_item` per `client_key` anlegen bzw. wiederfinden (kanal `notiz`, quelle `geraet`, zuordnung `hand`, kunde_id) + `intake_event` `angelegt`.
   - b) **kanonischer** `createOrderIntake` mit `clientEventId = clientKey` (eigene Transaktion, eigene Idempotenz; Wiederholung → `replayed`, kein zweiter Auftrag).
   - c) `intake_item.vorgang_art='auftrag'`, `vorgang_id=orderNumber` setzen + `intake_event` `zugeordnet`.
   - Bricht ein Schritt ab, führt derselbe Aufruf mit demselben `clientKey` zum identischen Endzustand. Zwischenzustand (intake_item ohne Vorgang) ist ein gültiger offener Eingang, nichts geht verloren.
4. **Ergebnis:** DB hat genau einen `intake_item`, einen Auftrag (`orders` + `order_intake_receipts` über createOrderIntake), `intake_event` angelegt+zugeordnet, Event `ORDER_INTAKE_CREATED_V1`.

## Ist → Soll (gegen origin/main ae79c12f)
- IST: `src/components/layout/GlobalCreateFlow.tsx:466` (Flow), `src/app/GlobalCreateAppAdapter.tsx:33/75` (Mount), `src/components/layout/globalCreateRequest.ts` (Trigger); stille Vorbelegung (4/8 grün bei leer); alter Entwurf über `intake_drafts`.
- IST Auftragsanlage: `src/lib/server/commands/orderIntakeCommand.ts` → `createOrderIntake` (eigene `withPrivilegedTenantTransaction`). **Bleibt unverändert, wird nur aufgerufen.**
- SOLL Modul: `src/modules/eingang/` (public.ts, server-public.ts, `eingang.manifest.json`, Tenant-Injektion wie `customers`).
- SOLL Action: `src/app/actions/eingang.actions.ts` (gate-konformer Ort für Actions; unter `src/app/eingang/` sind nur page/layout/AppAdapter erlaubt). Die Action ruft nur den Modul-Command.
- SOLL Einstieg: `requestGlobalCreate` zieht ins Modul; `@/components/layout/GlobalCreateFlow` exportiert nur noch `requestGlobalCreate` weiter.

## Ersetzt / Entfernt (im selben Paket)
- `GlobalCreateFlow.tsx` (Interna), `GlobalCreateAppAdapter.tsx`, `globalCreateRequest.ts` → Logik ins Modul; alter Pfad nur Re-Export.
- Entwurf (Stufe 1 ohne Entwurf, U-212): Nutzung von `intake_drafts` entfällt; `src/lib/server/intakeDraft.ts`, `src/app/actions/intakeDraft.actions.ts`, Leser in `src/components/home/OfficeHome.tsx` und `src/lib/server/todayDashboard.ts` werden entkoppelt. Tabelle `private.intake_drafts` bleibt (kein Drop).
- Stille Vorbelegungen entfallen ersatzlos.
- NICHT anfassen: OCR-Stack (`src/lib/ocr/**`, `src/lib/buchhaltung/ocr/**`, `src/components/intake/OCRReviewPanel.tsx`), `microsoftGraph.ts`, `createOrderIntake`, `order_intake_receipts`.

## Verbote (Grep-Gate)
- Keine zweite Erfassungsstrecke neben `src/modules/eingang/`.
- Kein zweiter Auftrags-Schreibweg neben `createOrderIntake`; keine Änderung an `orderIntakeCommand.ts`.
- Keine Ersatzwerte auf Pflichtfeldern (`?? 19`, `|| "Stück"`, `|| "Deutschland"`, `|| 14`).
- Keine Personennamen im Code. Kein DELETE auf `intake_item`/`intake_event`.

## Datenvertrag
- Migration `migration.sql` dieses Ordners (als neue Datei `supabase/migrations/<Zeitstempel>_ap01_intake_item.sql`, additiv): `public.intake_item` (Kernteilmenge) + `public.intake_event` (nur anhängen), RLS `tenant_isolation`, Grants nur `service_role`, kein DELETE. Auf Dev anwenden, Gleichstand belegen.
- `intake_item.client_key` UNIQUE je Tenant = Idempotenz. `vorgang_art`/`vorgang_id` nur gemeinsam gesetzt.
- Leerer Pflichtwert → „fehlt" mit Sprung zur Eingabe.
- Rechte (BAUPLAN `eingang.befehle`): Auftrag aus dem Eingang = Bereich `eingang`; KV (nicht in AP-01) zusätzlich `geld`.
- `intake_file`, `intake_suggestion`, `device_request`, `goods_receipt` = Folgepakete.

## Vertrag (Signaturen)
```ts
// src/modules/eingang/server-public.ts (Command) + src/app/actions/eingang.actions.ts (Action, ruft nur den Command)
export type ErfasseAuftragInput = {
  clientKey: string;                            // UUID v4 = intake_item.client_key = clientEventId für createOrderIntake
  text: string | null;
  customer: { mode: "EXISTING"; id: string };  // AP-01: nur Bestandskunde
  dueDate: string;                              // YYYY-MM-DD
  items: OrderIntakeItemInput[];
  handoverMode?: "pickup" | "shipping";
  paymentMode?: PaymentMode;
};
export type ErfasseAuftragResult =
  | { code: "OK"; orderNumber: string; orderId: string; intakeItemId: string; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "CONFLICT"; message: string };
export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult>;
```
- Recht `eingang`, serverseitig geprüft, vor jedem Schreiben. Ohne Recht: `FORBIDDEN`, keine Zeile.
- Idempotenz: zweiter Aufruf mit gleichem `clientKey` → `OK`, gleiche `orderNumber`/`intakeItemId`, `replayed: true`, keine zusätzliche Zeile.
- `VALIDATION_ERROR` von `createOrderIntake` wird durchgereicht; `intake_item` bleibt dann offen (ohne Vorgang).

## Technische Freiheit
- Modul-Interna, Komponenten, State frei, solange Vertrag, Verbote und Idempotenz stimmen.

## Optische Umsetzung
- Maßstab: Endversion-Prototyp (spec 403d1b31ad24), Screens `rein`/`anliegenwahl`/`eingang`. Farben V1.1, Größen V8, Touch ≥ 48 px, heller Hintergrund, wichtige Knöpfe farbig nach Dringlichkeit, keine doppelten Beschreibungen, „fehlt" statt Vorbelegung. Der HTML-Mock geht nicht an Codex.

## Gate
- Akzeptanztest liegt im Planungsordner als `AP-01-eingang-paket-persoenlich.acceptance.test.ts.txt` (Endung `.txt`, damit der globale Typecheck ihn am Planungsort nicht erfasst). Bytegleich kopieren nach `src/test/acceptance/AP-01-eingang-paket-persoenlich.acceptance.test.ts`; SHA-256 in der Abgabe gleich dem Wert in `WORKQUEUE.json`.
- Grep-Gate wie oben; Modul-Gates grün; Scope-Gate B2 grün; quality, ratchet, Fresh-Supabase-Replay, agentur-gate grün.

## Abnahme (Owner-Klickweg ≤ 6 Schritte, Preview-Link des SHA in der Abgabe)
1. Als Rolf anmelden. 2. Rotes Plus → „rein" öffnet sich. 3. Text tippen („2 Stück Flansch verzinken"). 4. Anliegen „Auftrag", Bestandskunde wählen; leere Pflichtfelder zeigen „fehlt". 5. „Wareneingang buchen". 6. Auftrag `A-2026-00NN` in der Liste; DB: `intake_item` (notiz, vorgang_id = Nummer), `orders`, `intake_event`, `ORDER_INTAKE_CREATED_V1`.
