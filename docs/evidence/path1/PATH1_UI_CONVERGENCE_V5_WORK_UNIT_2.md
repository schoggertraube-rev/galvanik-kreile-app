# PATH1 UI Convergence V5 — Work Unit 2

Status: `CANDIDATE_EXACT_SHA_CI_PREVIEW_AND_INDEPENDENT_REVIEW_PENDING_NO_UI_PASS`.

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
- Erst das vom bestehenden F1.1-Command in `public.events` persistierte
  `ORDER_INTAKE_CREATED_V1`-Ereignis finalisiert in derselben F1.1-Transaktion
  den KV als `converted`, schreibt `QUOTE_AWARDED_V1` und den
  unveränderlichen Konversionsbeleg. Das Quote-Modul liest weder
  `private.order_intake_receipts` noch koppelt es einen Trigger an diese
  Fremdtabelle. F1.1-Fehler lassen KV, Award-Event und Auftrag unverändert.
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

Customer-, Quote- und S1-Fokus umfassen auf dem gebündelten Stand 3 Dateien
und 59/59 Tests. `next build` kompiliert ohne Server-Abhängigkeit im
Browsergraph und generiert 55/55 statische Seiten.

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

- Migration: `AE82314EB68DADD03EAAC12A42B7BBD7E801DFA6798209DBCF6329EB1C520928`
- Real-DB-Test: `DB9FDA0FBD137C4D3337C6E85DC00720F3AB2DEBB0F63813161C5EE463DEEF94`
- Quote-Command: `F056D6C2224C17F0F5F16F1F0A3A91151329E098F4D76FF1CC685924CA707AFB`
- Quote-App-Action: `33A267EF1C70F62409655008B6B2EAA22929C53886EBD9F67EED3FCB5497C25C`
- Customer-Client-Fassade: `E97D5B13CCF7456A7258AED690C66096EDA5BA70E17A4DA4D9C55C6271968953`
- Customer-Server-Fassade: `C10681B50C23BE6EBE06E82100642943FF20D39B1C66795CAAE071B8BE1FAD50`
- Quote-Client-Fassade: `C28D1A0C281F36B06A1DECCAAF193306AEF4FBEBB999F45309936852D6FBDD34`
- Quote-Server-Fassade: `E016CAC418EE391BC9BF4B80F75ACEEA9F1B4C2350BBC4F9A30FAA4276178474`
- Modul-Gate: `994ECDF426E1F1791C63B08739D01C997F40200FCC6933A97BF6226109022C0D`
- W4-Runtime-Test: `EFDC8ED7562375CEBB0F348D73B1F32D770BDFDD6645C71700B702F2C1E67F6F`
- Orders-Public-Fassade: `78B4C59D9079F93E0FD194FDCE9DD940D240EBB10B02C96368245EA0B09F29A6`
- Orders-Attachment-Port: `44FC692B391A30622F681555DB913C79B3DB2F2E9F990AB5C4A5AB859E85837A`

## Lokale Abschlussgates

- Production Build: PASS; 55/55 statische Seiten, keine Server-Abhaengigkeit
  im Browsergraph und keine Route fuer `/quotes` oder `/quotes/new`;
- Customer-Real-DB: 1 Datei, 5/5 PASS;
- Quote-zu-F1.1-Real-DB: 1 Datei, 5/5 PASS;
- Customer-/Quote-/S1-Fokus: 3 Dateien, 59/59 PASS;
- vollstaendige Unit-Suite nach der gebuendelten Orders-Fassadenmigration:
  101 Dateien, 814/814 PASS;
- TypeScript und ESLint full: PASS, 0 Fehler/0 Warnungen;
- Modul-Gate: PASS, 0 Befunde; Authority-Selftest: 27/27 negative
  Faelle plus 2 gueltige Zustaende; Authority-Repo-Check: PASS;
- No-Fake: PASS (Pages 76/76, APIs 19/19, Actions 51/51, KPI 7/7,
  produktive Mocks 0, unregistrierte sichtbare Pfade 0);
- W4: Selftest 10/10 und Repo-Check 601 Dateien/25 Read-Ports PASS;
- Ratchet: PASS bei Debt 0 Fehler/0 Warnungen und leerer Issue-Liste;
- JSON/YAML-Parse und `git diff --check`: PASS.

Die dokumentierte mechanische Ratchet-Aktualisierung aendert ausschliesslich
`lintContractHash` von
`fd059f7c1722b49a583058026244490c35704f476d864b3a83d9aafc6429f469`
auf `818d7ffe189e9bf0695863c35789cb8df1a78adf0c77a76556a1848852a1e408`.
`judgeContractHash` bleibt
`49f30457f01b753a7a7726d8d3154692723362a42d6b741e9f784a7ef021ed46`;
Debt bleibt 0/0 und `issues` bleibt leer.

## Gebündelte Orders-Fassadenmigration und offener V5-Rest

Die fünf früheren Legacy-UI-Symbole sind aus `@/modules/orders/public`
entfernt und besitzen keinen produktiven Konsumenten mehr. Listen und
Stationsseiten verwenden die enge `OrderQueueRow`-Komposition; dieselbe
kanonische `OrderCardView` trägt im App-Adapter den echten
`OrderStationAttachmentPanel`-Port. Der eingefrorene W4-Vertrag wird damit
über eine reale Runtime-Fassade statt über ein Phantommodul belegt.

Der sichtbare Global-Plus-Weg ist Kandidat und wird separat in
`PATH1_UI_CONVERGENCE_V5_GLOBAL_CREATE.md` belegt. Gesamt-A–D, die erneute
Suche/Alltagsjobs ST1–ST3 und die vollständige Browsermatrix bleiben bis zur
Exact-SHA-CI und unabhängigen Abnahme offen. Es gibt keine OCR-, Graph-,
Azure-, KI- oder sonstige Provideraktivierung.
