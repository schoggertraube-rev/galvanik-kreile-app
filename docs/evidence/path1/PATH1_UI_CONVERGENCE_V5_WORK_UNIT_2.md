# PATH1 UI Convergence V5 — Work Unit 2

Status: `REMOTE_CHECKPOINT_CANDIDATE_LOCAL_ACCEPTANCE_COMPLETE_NO_UI_PASS`.

Dieser Stand ist ein technischer Produktmeilenstein innerhalb des einen
Programms `PATH1_UI_CONVERGENCE`. Er ist kein UI-Teil-PASS, kein Draft-PR, kein
Merge und keine Production-Migration.

## Gelieferter vertikaler Vertrag

Der belegte Weg lautet:

`bestehender Kunde -> persistenter KV -> bestätigter Zuschlag -> bestehender F1.1-Auftrag -> Receipt und Readback`

- Das tenantneutrale Modul `src/modules/quotes` besitzt eine öffentliche,
  typisierte Client-Fassade, eine explizite `server-only`-Fassade und ein
  Manifest. App-, Router- und Supabase-Interna sind nicht Teil seiner
  öffentlichen Oberfläche.
- `createQuoteCommand` speichert einen KV mit Status, Version, Kunde, 1–20
  Positionen, DB-berechneter Nettosumme, Fälligkeit, stabiler KV-Nummer und
  append-only `QUOTE_CREATED_V1`-Receipt.
- Die KV-Nummer `KV-JJJJ-NNNN` wird atomar aus einem tenant-/jahrgebundenen
  DB-Zähler vergeben; es gibt kein `SELECT max`.
- `clientEventId` und Intent-Hash binden identische Wiederholung und
  abweichenden Intent. Tenant und Akteur stammen ausschließlich aus dem
  serverseitigen Authorization-Snapshot.
- Die Konversion bereitet nur einen streng validierten F1.1-Input vor. Der
  existierende `createOrderIntake` bleibt der einzige Auftragsschreiber.
- Erst dessen persistierter `order_intake_receipt` finalisiert in derselben
  Transaktion den KV als `converted`, schreibt `QUOTE_AWARDED_V1` und den
  unveränderlichen Konversionsbeleg. F1.1-Fehler lassen KV, Event und Auftrag
  unverändert.
- Readback erfolgt über `private.v_quotes_v1`,
  `private.v_quote_create_receipts_v1` und
  `private.v_quote_conversion_receipts_v1`; die Ports validieren Tenant,
  Event, Receipt, Auftrag und Version vor Erfolg.

## Client-/Server-Fassadenvertrag

Der zuvor durch `next build` belegte Browsergraph-Fehler ist geschlossen:

- `src/modules/customers/public.ts` und `src/modules/quotes/public.ts`
  exportieren ausschließlich UI beziehungsweise browser-sichere, type-only
  Verträge;
- `server-public.ts` importiert direkt `server-only` und exportiert explizit
  nur Commands sowie die dafür notwendigen Inputtypen;
- Server Actions und lokale Real-DB-Tests konsumieren `server-public`; Client-
  Adapter bleiben auf `public`;
- das Modul-Gate traversiert den Laufzeit-Importgraph der Client-Fassade und
  sperrt direkte oder transitive Kanten zu `server-only`, DB, Drizzle,
  `postgres`, Supabase und `privilegedDb`;
- `server-public` ist ausschließlich aus einer echten `use server`-App-Action
  oder einem Real-DB-Integrationstest erreichbar. Client/AppAdapter,
  Tiefimport und Re-Export-Umgehung schlagen fail-closed fehl.

Der fokussierte S1-Beweis umfasst 32/32 grüne Fälle; Customer-, Quote- und
S1-Fokus zusammen umfassen 3 Dateien und 40/40 Tests. `next build` kompiliert
ohne Server-Abhängigkeit im Browsergraph und generiert 57/57 statische Seiten.

## Routen- und Linkdisposition

Ein read-only Import-/Linkinventar belegte, dass die alten Seiten
`/quotes` und `/quotes/new` ausschließlich Attrappen waren. Deshalb wurden
deren zwei Pages und der ausschließlich zugehörige Alt-Test entfernt. Bis zur
späteren echten V5-Komposition liefern beide URLs fail-closed 404; es wurde
kein Ersatz-Placeholder angelegt.

Die zwei produktiv erreichbaren toten `/quotes`-Links wurden ausschließlich
aus `src/app/warendurchlauf/wareneingang/page.tsx` und
`src/components/intake/IntakeEntry.tsx` entfernt. Die beiden korrespondierenden
`PAGE_ROUTE`-Zeilen wurden aus der Provider-/Capability-Matrix entfernt. Keine
andere Capability-Klassifikation wurde verändert.

## Fresh-DB-Beleg

- lokale, frische Supabase auf Loopback PostgreSQL 17
  (`127.0.0.1:54322`), Reset einschließlich
  `20260914110000_path1_quote_persistence_contract.sql`: PASS;
- `src/test/path1_quote_to_order.integration.test.ts`: 1 Datei, 5/5 PASS;
- `src/modules/quotes/__tests__/quoteCommands.test.ts`: 1 Datei, 4/4 PASS;
- belegt: Erstanlage, DB-Summe, Nummernkreis, Create-Readback, Retry,
  Intent-Konflikt, stale Version, Foreign-/Empty-Tenant, fehlende Session,
  fehlendes Recht, atomare F1.1-Konversion, persistierter Order-Readback,
  parallele Doppelkonversion mit exakt einem Auftrag sowie Rollback ohne
  Award-Event/Receipt/Order;
- synthetische Fixture-Daten sind im Test eindeutig mit `SYNTHETISCH`
  gekennzeichnet und werden nach jedem Fall tenantgebunden bereinigt;
- keine Remote-DB-, Provider-, Deployment- oder Production-Mutation.

Datei-Hashes des geprüften Fachstands:

- Migration: `9A392A058350AE8F40B9CC20CE28681C9FE699988513E2722A8C494EF66470DB`
- Real-DB-Test: `A66F12CD50ED6632E96A8BFC08854A4B70B8D0A777BE664714A86EE50B3DF3F8`
- Quote-Command: `535AD07B2D8190DB273F9CD8CBE3D50546B287F68731A1E761139835135E8502`
- Quote-App-Action: `68410EF0841096B8165E901B2C98573F537452E7DED0270D05D54A09D08285EE`
- Customer-Client-Fassade: `2A8B01594FA8417FCCC8F27562174F6656A506D2ADF7044DD090CE937812A5CC`
- Customer-Server-Fassade: `52E33C28082E3559F82A159A7733B8BE598D2A3B7C3FF86C888308762BBF7E34`
- Quote-Client-Fassade: `CAF77224062204B0A9CC7C0BF8D11C26253FAE5E85C2DE112403E831C9F5007E`
- Quote-Server-Fassade: `83B475008610628FBAA14ACFD9E2A8623C8B957A874AC8AA91C032A7BED24845`
- Modul-Gate: `B20AB880C8051AF34001D04FAEC2A6CE6F2C50C5A8A75E669A89F29DFB0C3230`

## Lokale Abschlussgates

- Production Build: PASS; 57/57 statische Seiten, keine Server-Abhaengigkeit
  im Browsergraph und keine Route fuer `/quotes` oder `/quotes/new`;
- Customer-Real-DB: 1 Datei, 5/5 PASS;
- Quote-zu-F1.1-Real-DB: 1 Datei, 5/5 PASS;
- Customer-/Quote-/S1-Fokus: 3 Dateien, 40/40 PASS;
- vollstaendige Unit-Suite: 104 Dateien, 833/833 PASS;
- TypeScript und ESLint full: PASS, 0 Fehler/0 Warnungen;
- Modul-Gate: PASS, 0 Befunde; Authority-Selftest: 27/27 negative
  Faelle plus 2 gueltige Zustaende; Authority-Repo-Check: PASS;
- No-Fake: PASS (Pages 76/76, APIs 19/19, Actions 51/51, KPI 7/7,
  produktive Mocks 0, unregistrierte sichtbare Pfade 0);
- W4: Selftest 10/10 und Repo-Check 607 Dateien/25 Read-Ports PASS;
- Ratchet: PASS bei Debt 0 Fehler/0 Warnungen und leerer Issue-Liste;
- JSON/YAML-Parse und `git diff --check`: PASS.

Die dokumentierte mechanische Ratchet-Aktualisierung aendert ausschliesslich
`lintContractHash` von
`fd059f7c1722b49a583058026244490c35704f476d864b3a83d9aafc6429f469`
auf `818d7ffe189e9bf0695863c35789cb8df1a78adf0c77a76556a1848852a1e408`.
`judgeContractHash` bleibt
`49f30457f01b753a7a7726d8d3154692723362a42d6b741e9f784a7ef021ed46`;
Debt bleibt 0/0 und `issues` bleibt leer.

## Offener V5-Rest

Die manuelle V5-Oberfläche, das globale Plus und der vollständige sichtbare
Kunde/KV/Auftrag-Weg sind noch nicht geliefert. Ebenso bleiben der erneute
A–C-Abgleich gegen V5, Suche/Alltagsjobs ST1–ST3 und die Browsermatrix offen.
Es gibt in dieser Arbeitseinheit keine OCR-, Graph-, Azure-, KI- oder sonstige
Provideraktivierung.
