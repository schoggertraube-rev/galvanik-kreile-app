# AP-01 · Eingang-Modul + Kanal „Paket/persönlich" (getippt → Auftrag), eine Wahrheit

Status: **bereit** — Voraussetzung: TA-B2 (#156, gemergt) und TA-B2b (`TRUST_ANCHOR_B2B.md`) auf main. Fassung 3 vom 31.10. (korrigiert nach BLOCKER.md von Codex: Action-Pfad, keine Einzel-Transaktion, createOrderIntake unverändert; H18-Harness und Endversion-Update).
Gate-Rahmen: Mission KREILE-VERKAUFSSTUFE-1, Block **B2**, Branch **`kreile/b2-eingang`** (frisch von main nach dem Trust-Anchor).
WAS: BAUPLAN spec `5ac4d4b5ea34` (Owner-Freigabe 31.10.), Abschnitt `eingang`; Befehle `eingang.anlegen`/`eingang.notiz`/`eingang.zuordnen`; Screens `M6 anliegenwahl`, `3.0 rein`, `3 eingang`.

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
  customer: { mode: "EXISTING"; customerId: string };  // gleicher Typ wie OrderIntakeCustomerInput; AP-01: nur Bestandskunde
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
- Maßstab: Endversion-Prototyp (spec 5ac4d4b5ea34), Screens `rein`/`anliegenwahl`/`eingang`. Farben V1.1, Größen V8, Touch ≥ 48 px, heller Hintergrund, wichtige Knöpfe farbig nach Dringlichkeit, keine doppelten Beschreibungen, „fehlt" statt Vorbelegung. Der HTML-Mock geht nicht an Codex.

## Gate
- Akzeptanztest (Fassung 3, H18-Harness) liegt als `ap01_eingang_paket_persoenlich.integration.test.ts.txt` im Planungsordner. Bytegleich kopieren nach `src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts`; SHA-256 in der Abgabe gleich dem Wert in `WORKQUEUE.json`. Die frühere Kopie `src/test/acceptance/AP-01-eingang-paket-persoenlich.acceptance.test.ts` entfernen.
- Derselbe Test ist der H18-Nachweis: in `scripts/quality/h18-server-actions.json` unter `testedWriteActions` eintragen `"src/app/actions/eingang.actions.ts#erfasseAuftragAusEingangAction": ["src/test/acceptance/ap01_eingang_paket_persoenlich.integration.test.ts"]` und `inventorySha256` nachführen. Kein zusätzlicher Test.
- CI führt ihn im neuen Schritt „Acceptance tests against replay DB" (agentur-gate, aus TA-B2b) gegen die Replay-DB aus.
- Grep-Gate wie oben; Modul-Gates grün; Scope-Gate B2 grün; quality, ratchet, Fresh-Supabase-Replay, agentur-gate grün.

## Abnahme (Owner-Klickweg ≤ 6 Schritte, Preview-Link des SHA in der Abgabe)
1. Als Rolf anmelden. 2. Rotes Plus → „rein" öffnet sich. 3. Text tippen („2 Stück Flansch verzinken"). 4. Anliegen „Auftrag", Bestandskunde wählen; leere Pflichtfelder zeigen „fehlt". 5. „Wareneingang buchen". 6. Auftrag `A-2026-00NN` in der Liste; DB: `intake_item` (notiz, vorgang_id = Nummer), `orders`, `intake_event`, `ORDER_INTAKE_CREATED_V1`.

## Endversion-Update spec 5ac4d4b5ea34 (31.10., Fassung 3)
- Seite 3.0 `rein` heißt überall **„Neu erfassen“** (vorher „Was ist neu?“): Dialogtitel, Beschriftung und aria-label des roten Plus, Hinweis Taste N, Knöpfe in leeren Listen, Suche „Tun“. Ablauf, Befehle, Daten und Rechte unverändert.
- Kachel „Fotos mit Tablet/Handy“ in 3.0: Kamerasymbol (nicht Telefonhörer).
- Nicht in AP-01 (eigenes Folgepaket): `werkstattregel.ablauf/abschluss/ruecknahme`, Fall `rechnung_schreiben` in Der Tag › Geld einfordern.
- Der Akzeptanztest prüft keine Beschriftung; Test-SHA und Migrations-SHA bleiben gültig.
- `docs/project/endversion/codex/BAUPLAN.json` (SHA256 6E5E4EA663783F28C7A6ED1A8EF2017FAD1F8DA0458CC8A2670E6F1863453F77) kommt bytegleich mit dem Anker TA-B2b auf main.

## Fassung 4 (01.11., Owner-autorisierte Amendierung U-225, gilt vor allen früheren Fassungen)
Anlass: Owner-Klicktest 01.11. (Kunde K-2026-0011 „3013 Bern / Deutschland“), Codex-Befund zu a20e7dec, Mindmap Auftragseingang (Planungschat). Bauplan spec `6b782924134c` (BAUPLAN.json SHA-256 `225B7FB5D3503522D8BC972E535CE53827E4047F75932B18E52E7B905CB35305`), kommt mit TA-B2c auf main.

**AP-01 deckt genau:** Einstieg rotes Plus / Taste N, getippte Notiz, **vollständiger Bestandskunde** → Auftrag. Alles andere ist ausdrücklich nicht AP-01 und wird nicht angedeutet.

1. **Symbol:** Rotes Plus und Dialogkopf „Neu erfassen“ zeigen das Plus-Symbol (`plus`). `inbox` entfällt. Kein Menü vor dem Dialog. Der direkte Einstieg aus a20e7dec bleibt.
2. **Unvollständiger/ungültiger Bestandskunde:** Im Eingang gibt es **keine** bearbeitbaren Kundenfelder. Abschnitt 1 zeigt „Unvollständig – für Auftrag fehlt: {liste}“ mit konkretem Grund je Feld (z. B. „PLZ 3013 passt nicht zu Deutschland“). Hauptknopf gesperrt. Knopf „In Kundenkarte ergänzen“ öffnet die Kundenkarte dieses Kunden; dort wird über den bestehenden Schreibweg `updateCustomerCommercialAction` gespeichert. Beim Zurückkehren in den Eingang wird der Kunde neu gelesen.
3. **Eine Prüfregel:** Die Vollständigkeit „für Aufträge“ (Pflicht: Name, Telefon; für Aufträge: Ansprechpartner, E-Mail-Muster, Straße, PLZ passend zum Land – DE 5 Ziffern, AT/CH 4 Ziffern, sonst 2–10 Zeichen –, Ort, Land; Zahlungsbedingung nur mit Recht `geld`) ist **eine** reine Funktion im Kundenmodul (`src/modules/customers/orderReadiness.ts`, Export über `src/modules/customers/public.ts`). Oberfläche und Server nutzen sie. Die bisherige Funktion `completeOrderCustomer` im Eingang wird durch sie ersetzt, nicht dupliziert. Signatur schon jetzt wie AP-K1 Punkt 5: `kundeVollstaendigkeit(kunde, { geld })` → `{ vollstaendig, felder, fehlt, text }` (in F4 auf den heutigen Feldern; AP-K1 erweitert nur die Felder, nicht die Schnittstelle).
4. **Server:** `erfasseAuftragAusEingangAction` liest den Kunden aus der DB und prüft ihn mit dieser Funktion **vor** Schritt a. Ist er unvollständig, kommt neues Ergebnis `{ code: "CUSTOMER_INCOMPLETE"; message: string; missing: string[] }` (Feldschlüssel wie `CustomerDraft`, z. B. `zipCode`, `country`), und es wird **nichts** geschrieben.
5. **Zurücknehmen aus a20e7dec:** `forceFields`/lokal eingeblendete PLZ/Land-Felder und jeder clientseitige `updateCustomer`-Aufruf im Eingang. Die Kunden-Komponente im Eingang bleibt bis AP-02 F2 nur Anzeige plus Neukunde-Sperre (kein „Neukunde anlegen“-Knopf in AP-01).
6. **Herkunftsprinzip:** Ein Mail-Eintrag in „Der Tag“ öffnet die bestehende Mailansicht (CommunicationPanel/Mail-Port), **nicht** „Neu erfassen“. Das Plus erhält keinen `sourceMode: "mail"` mehr.
7. **Gate zusätzlich:** Akzeptanztest `ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts.txt` bytegleich nach `src/test/acceptance/ap01b_eingang_bestandskunde_unvollstaendig.integration.test.ts`, SHA-256 `4B67978D5433D16395A7072E4B691F6AB5EF6B4A3F3D4D4C42131994120057A1`. Der Test aus Fassung 3 (SHA `BE54C2C5…`) bleibt unverändert gültig. H18: Der neue Test ist zweiter Nachweis für `erfasseAuftragAusEingangAction` (Eintrag ergänzen, `inventorySha256` nachführen). realRender-Test: unvollständiger Kunde zeigt den Grund und sperrt; „In Kundenkarte ergänzen“ ruft `openCustomer`; kein Eingabefeld für PLZ/Land im Eingang; Mail-Eintrag ruft nicht `requestGlobalCreate`.
9. **Seite 3 nach Spec 6b (werkbank.vorbelegung_je_aufruf.herkunft, .eingangsart, .termin_ist, werkbank.zahlung.ohne_uebergabe):** Plus ohne Kontext: Eingangsart, Übergabe, Zahlungsmodus und Terminstatus sind **leer** (Pflichtwahl, „fehlt“). Vorbelegung nur mit Quelle und sichtbarer Herkunft; Zahlungsmodus bleibt leer, solange die Übergabe fehlt. Server: kein fest verdrahtetes `intakeSource: "persoenlich"` mehr; `erfasseAuftragAusEingangAction` nimmt `intakeSource?` und `termStatus?` (Werte wie `OrderIntakeSource`/`OrderIntakeTermStatus`) an und reicht sie unverändert an `createOrderIntake` durch; fehlt der Wert, wird `null` gespeichert (keine stille Vorbelegung). Beide Akzeptanztests bleiben gültig (sie senden diese Felder nicht).
10. **Baureife:** Spec 6b meldet F1 `baureif: false` nur wegen der Lücke „kundeneu: Baustein adresse ohne Vertrag“. Fassung 4 ist eine Korrektur und baut **kein** kundeneu-/Adress-Element; sie ist nach `baureife.F1.darf` („nur Korrekturen … kein Neubau von Elementen mit Lücke“) zulässig (Planungschat-Entscheid 01.11.). Kein Neukunde, keine Adress-Komponente in F4.
8. **Abnahme (Owner):** (1) Plus → Dialog „Neu erfassen“ mit Plus-Symbol. (2) Vollständigen Kunden wählen → Auftrag anlegen → Nummer. (3) Kunden mit „3013 Bern / Deutschland“ wählen → Hinweis mit Grund, Knopf gesperrt. (4) „In Kundenkarte ergänzen“ → Land Schweiz → speichern. (5) Zurück in „Neu erfassen“, Kunde neu wählen; Eingangsart, Übergabe, Zahlung und Termin sind leer und müssen gewählt werden → Auftrag anlegen geht. (6) In „Der Tag“ einen Mail-Eintrag öffnen → die Mail erscheint, nicht „Neu erfassen“.

## Fassung 4.1 (01.11. abends, Owner-Klicktest auf bbf4c2fa, gilt zusätzlich zu Fassung 4, vor dem Merge von #158)
1. **Abbrechen / × / Esc** nach `werkbank.interaktion[abbrechen]` und Screen `entwurf` (3.6) in der Stufe-1-Form: ohne Änderung schließt die Erfassung sofort; mit Änderung erscheint 3.6 mit dem Stufe-1-Text und genau zwei Knöpfen „Verwerfen“ (leise) und „Weiter bearbeiten“ – kein „Entwurf behalten“ (X12, Stufe 2). „Verwerfen“ setzt die Erfassung **vollständig** zurück (alle Felder, erkannte Angaben, Positionen, neuer `clientKey`), Meldung „Entwurf verworfen“; das nächste Plus öffnet leer. „Weiter bearbeiten“ schließt nur 3.6. Heute bleiben Eingaben nach Abbrechen stehen – das ist zu beheben.
2. **Erkannte Kundenangaben ohne Scheinwirkung:** Der Kasten „{n} Angaben erkannt und vorausgefüllt“ / „bestätigt“ zeigt nur Angaben, die in AP-01 ein Feld füllen (Positionen, Menge, Oberfläche, Termin-Wunsch). Erkannte Kundenangaben (Name, Straße, Nr., PLZ, Ort, Telefon, E-Mail) erscheinen **nicht** als „bestätigt“, sondern füllen die Kundensuche vor (Telefon- oder E-Mail-Muster → dieser Wert, sonst der erkannte Name) und lösen sie aus.
3. **Kein Treffer → Kunde zuerst anlegen (Herkunft bleibt die Erfassung):** Unter „Kein Kunde gefunden“ steht „Kunde anlegen“. Er legt den bestehenden Dialog „Kunde anlegen“ (3.1, Schreibweg `createCustomerAction`) **über** die Erfassung (`werkbank.interaktion` überlagern/stapel), vorbelegt mit dem Suchtext nach `formulare.kunde.autofill` (Suchtext-Muster). Nach „Kunde speichern“ kehrt die App in **dieselbe** Erfassung zurück, alle Eingaben sind erhalten und der neue Kunde ist gesetzt. Danach geht „Auftrag anlegen“ wie beim Bestandskunden. Das ist die Zwischenlösung bis AP-02 F2 (dort Neukunde inline in Abschnitt 1, Buchen in einer Transaktion); AP-K1 ersetzt nur das Formular in 3.1, nicht diesen Ablauf.
4. **Der Tag › Mail:** Solange 3.4 „Wem gehört das?“ (AP-M) nicht gebaut ist, heißt der Knopf am Mail-Eintrag „Mail ansehen“ statt „Zuordnen“. Kein Knopf verspricht eine Zuordnung, die es noch nicht gibt.
5. **Gate:** Akzeptanztests unverändert (`BE54C2C5…`, `4B67978D…`). realRender: (a) Abbrechen mit Eingaben → 3.6 mit genau „Verwerfen“/„Weiter bearbeiten“; nach „Verwerfen“ und erneutem Öffnen sind alle Felder leer; (b) erkannte PLZ/Ort erscheinen nicht als „bestätigt“, die Kundensuche ist vorbelegt; (c) „Kunde anlegen“ öffnet 3.1 über der Erfassung, nach Speichern ist der Kunde in derselben Erfassung gesetzt und die Position noch da; (d) Mail-Eintrag zeigt „Mail ansehen“.
6. **Abnahme (Owner):** (1) Plus, Text „gregor laucht rembrücker strasse 4 63150 heusenstamm“ tippen → Kundensuche zeigt „gregor laucht“, kein „PLZ bestätigt“. (2) „Kunde anlegen“ → Dialog über der Erfassung, Name vorbelegt; Daten ergänzen, speichern → zurück, Kunde gesetzt, Text noch da. (3) Übergabe, Zahlung, Termin, Eingangsart wählen → Auftrag anlegen → Nummer. (4) Plus, etwas tippen, × → Rückfrage; „Verwerfen“ → Plus erneut: leer. (5) Der Tag: Mail-Eintrag zeigt „Mail ansehen“.

## Fassung 4.2 (01.11. abends, Owner-Klicktest auf 3f605239, vor dem Merge von #158)
1. **Vollständigkeit Privat:** `getOrderReadiness` verlangt „Ansprechpartner“ nur bei Kundentyp Firma (`business`/`institution`), nie bei `privat` (`formulare.kunde.vollstaendigkeit.labels`: „Ansprechpartner – nur Firma“; Privat: die Person ist der Kontakt). Beleg: K-2026-0013 „gregor laucht“ (privat, contact_person leer) wird heute fälschlich gesperrt. Client und Server nutzen weiter dieselbe Funktion.
2. **Name aus „Schnell erfassen“ findet den Kunden** (`eingang.erkennung.notiz`, Regel „Wort mit ≥ 4 Zeichen aus dem Kundennamen … genau ein Kunde → Vorschlag, mehrere → bis 3 Vorschläge“): Text „sabrina schmidt“ ergibt den Vorschlag „Sabrina Schmidt · übernehmen“ (1 Klick setzt den Kunden) und füllt die Kundensuche vor, deren Treffer sofort erscheinen. Die Serversuche (`searchOrderIntakeCustomers`) findet „sabrina schmidt“ bereits (Planungschat 01.11. gegen Dev geprüft) – Ursache liegt im Client (Erkennung/Übergabe an die Suche); Codex nennt die Ursache in der Abgabe.
3. **„Kunde anlegen“ bleibt sichtbar:** Unter der Kundensuche steht „Kunde anlegen“ immer – bei Treffern **unter** den Treffern (ähnliche zuerst, `formulare.kunde.kundensuche`), bei keinem Treffer direkt unter „Kein Kunde gefunden“. Er verschwindet nicht beim Tippen.
6. **Hauptknopf nie ausgegraut** (`screens.eingang.aktionen[buchen]`, `werkbank.interaktion[hauptknopf]`, Befund 13): „Wareneingang buchen“ und auf dem Handy der Weiter-Knopf „Positionen“ sind immer klickbar. Fehlt eine Pflichtangabe (auch „Kunde unvollständig“), wird nichts gesendet; die Ansicht springt zum Feld der ersten offenen Prüflisten-Zeile (Handy: in dessen Schritt) und meldet „Noch offen: {Label}“. Während des Speicherns „Wird gebucht …“, ein zweiter Klick löst nichts aus. Heute sind beide Knöpfe `disabled`.
7. **Erfolg ohne Zwischenbildschirm** (`werkbank.interaktion[eingang-erfolg]`, U-185): Nach erfolgreichem Buchen schließt die Erfassung und die Karte des neuen Auftrags öffnet direkt mit Meldung „Auftrag {auftrag} angelegt“. Kein Bildschirm „Auftrag … angelegt“ mit „Auftragskarte öffnen“/„Weiteren Eingang anlegen“; Zurück führt nicht in die Erfassung.
8. **„In Kundenkarte ergänzen“ als Ebene** (`werkbank.interaktion[ueberlagern]`): Die Kundenkarte legt sich über die Erfassung; Zurück/Schließen/Speichern kehrt in **dieselbe** Erfassung mit allen Eingaben zurück; der Kunde wird dabei neu gelesen und neu geprüft (Hinweis verschwindet, wenn vollständig). Esc schließt nur die oberste Ebene.
9. **Kundenkarte „Neuer Auftrag“** (`werkbank.interaktion[aufruf-kunde]`): öffnet die Erfassung mit gesetztem Kunden und der Markierung „aus der Kundenkarte“; ist er unvollständig, gilt Punkt 8. (Nur prüfen und belegen; Plus mit offener Kunden-/Auftragskarte als Kontext ist AP-C.)
4. **Gate:** Akzeptanztests unverändert. realRender zusätzlich: (d) Buchen mit fehlender Angabe → kein Aufruf, Fokus/Sprung + „Noch offen: …“; Knopf nie `disabled` außer während des Speicherns; (e) Erfolg → `openOrder(orderId)` + Erfassung geschlossen, kein Erfolgsbildschirm; (f) „In Kundenkarte ergänzen“ → Ebene über der Erfassung, nach Rückkehr Eingaben erhalten und Kunde neu gelesen; (g) Esc mit offener Ebene schließt nur die Ebene. realRender: (a) Privatkunde ohne Ansprechpartner, sonst vollständig → kein Hinweis, Buchen möglich; Firma ohne Ansprechpartner → Hinweis; (b) „sabrina schmidt“ in „Schnell erfassen“ → Vorschlag mit „übernehmen“, Suche vorbelegt mit Treffer; (c) „Kunde anlegen“ sichtbar mit Treffern, ohne Treffer und während des Tippens. Unit-Test für die Prüffunktion (Privat/Firma).
5. **Abnahme (Owner):** (1) Plus, Kunde „gregor laucht“ wählen → kein „Ansprechpartner fehlt“, Auftrag anlegen geht. (2) Plus, „sabrina schmidt“ tippen → Vorschlag „Sabrina Schmidt · übernehmen“; Klick setzt sie. (3) Bei „Kunde suchen“ tippen → Treffer und darunter weiter „Kunde anlegen“. (4) „Wareneingang buchen“ ohne Position klicken → Sprung zur Position, „Noch offen: Teil / Leistung“. (5) Vollständig buchen → Auftragskarte öffnet direkt mit Meldung. (6) Sabrina wählen → „In Kundenkarte ergänzen“ → Karte über der Erfassung, Land Schweiz speichern, zurück → Hinweis weg, Eingaben noch da.

## Fassung 4.3 (01.11. nachts, Prüflauf des Planungschats per Playwright auf foa1yv18m / 1acf9118, vor dem Merge von #158)
Befund aus echtem Lauf (nicht Mock): Buchen mit 9/9 Pflichtangaben legt auf Dev **keinen Auftrag** an; `intake_item` entsteht (Schritt a), `createOrderIntake` (Schritt b) scheitert, die Oberfläche zeigt **nichts**. Belege: zwei verwaiste `intake_item` ohne Vorgang (01.11. 12:15 K-2026-0012, Bedingung bar; 22:09 K-2026-0013, privat, Bedingung vorkasse, gewählt „Bar oder Karte bei Abholung“). Die Akzeptanztests prüfen nur Bedingung vorkasse + Modus vorkasse.
1. **Ursache finden und beheben:** Buchung für K-2026-0012 und K-2026-0013 auf Dev nachstellen, Rückgabe von `createOrderIntake` (code/message) belegen, beheben. Regel: `werkbank.zahlung` – Zahlungsmodus aus der Bedingung vorbelegt und **änderbar**; erlaubt ist, was `paymentContract` erlaubt (eine Funktion für Client und Server).
2. **Zahlungsmodus vorbelegen:** Sobald Kunde und Übergabe gesetzt sind, ist der Zahlungsmodus nach `werkbank.zahlung`/`paymentContract` aus der Bedingung vorbelegt, sichtbar mit Herkunft „aus Kundenkarte“ (Präzisierung zu Fassung 4 Punkt 9: leer nur, solange Kunde oder Übergabe fehlt). Nicht erlaubte Modi sind nicht wählbar (mit Grund).
3. **Fehler sichtbar** (`werkbank.zustaende.fehler`, `werkbank.interaktion[fehler]`): jedes Ergebnis ≠ OK zeigt im offenen Dialog „Speichern fehlgeschlagen · alle Eingaben sind noch da“ mit der Servermeldung und „Erneut buchen“ (derselbe `clientKey`). Nie stilles Nichts.
4. **Keine verwaisten Eingänge:** Reihenfolge der Schritte in `erfasseAuftragAusEingangAction`: zuerst `createOrderIntake` (idempotent über `clientKey`), dann `intake_item`, dann Zuordnung. Scheitert der Auftrag, entsteht kein `intake_item`. Wiederholung mit demselben `clientKey` holt fehlende Schritte nach. (Die zwei vorhandenen Dev-Zeilen bleiben als Testdaten, nichts löschen.)
5. **Namenserkennung aus „Schnell erfassen“** besteht auf der echten Preview weiter nicht: nach Tippen von „sabrina schmidt“ ist „Angaben erkennen“ deaktiviert, kein Vorschlag, Kundensuche leer. Nachweis nur auf der Preview (Screenshot), nicht per Mock.
6. **Gate:** zusätzlich realRender/Integration für 1–4; Codex belegt in der Abgabe einen echten Buchungslauf auf Dev mit K-2026-0013 (Auftragsnummer, `intake_item.vorgang_id`). Danach Prüflauf des Planungschats (t14/t18) auf der neuen Preview.
