# V3-Datenvertrags-Reconciliation

## Status

`NO_GO — REPAIR_CONTINUES`

Dies ist kein Release- oder Go-live-Nachweis. Die Matrix trennt belegte
Produktverträge von historischer, nicht mehr reproduzierbarer Quellannahme.

| Feld | Belegter Wert |
| --- | --- |
| Produktziel | Supabase `syhaigjhsbpjmtnggqka` |
| Zieltyp | `CANONICAL_PRODUCT_SYSTEM` |
| Production-Basis | `origin/main` `6e1d1831be823b7655130f0f46ba964d45c4b8dc` |
| Lokaler Reparaturbranch | `codex/foundation-consolidation-v3-20260728` |
| Schema-Snapshot | `contracts/product-schema-snapshot.v1.json` |
| Sicherheits-Snapshot | `contracts/product-security-snapshot.v1.json` + `contracts/product-security-acl-snapshot.v1.json` |
| Kandidaten-SHA | `f59f1ce4632058ed55ea3c678d756f085b95dc41` (lokaler Reparatur-Baseline-Commit; kein Remote-Apply) |

## Aktive Pfade und Datenwahrheit

| Route/Action | Kanonischer Konsument | Relation/Vertrag | Entscheidung | Lokaler Nachweis |
| --- | --- | --- | --- | --- |
| `/orders` | `getOrdersDb` | signierte Session → `perm_data_orders` → tenantgebundene Orders-/Kunden-/Teile-Abfrage | `KEEP_SERVER_GATED`; kein RLS-Nachweis behauptet | `src/app/actions/orders.actions.ts`, `src/lib/server/operationalOrders.ts` |
| `/customers` | `getCustomersDb` | signierte Session → `perm_view_customers` → tenantgebundene Kundenliste + Auftragszählung | `KEEP_SERVER_GATED`; minimales DTO | `src/app/actions/customers.actions.ts` |
| Login/Session | `resolveAuthorization` | signierte App-Session → aktiver `app_users`-Datensatz → Rollenvergleich | `KEEP_SERVER_GATED`; W3 muss die DB-Grenze beweisen | `src/lib/server/authorization.ts` |
| Prozesswechsel | `transitionOrderProcess` | kanonische Station/Status/Receipt-Struktur | `GATE` bis W1 + Retry- und W3-Nachweis | `src/app/actions/orders.actions.ts`, `src/lib/orders/processContract.ts` |
| Capture/OCR/Upload | Route/Action-Gates | Upload, OCR, Storage, Audit | `GATE` | `scripts/verify-foundation-boundaries.ts` |
| Buchhaltung/Analyse/Marketing | Layout- und Action-Gates | Finanz-, View-, Einwilligungs- und Exportdaten | `GATE` | `src/app/buchhaltung/layout.tsx`, `src/app/performance/layout.tsx`, `src/app/marketing/layout.tsx` |
| Realtime/Offline/Browser-Supabase | statische Boundary | Browser-RPC, Storage, Realtime, lokale Erfolgsvormerkung | `GATE` | `scripts/verify-foundation-boundaries.ts` |

Die ersten beiden Listenflächen sind absichtlich klein: gespeicherte, tenantgebundene
Stammdaten und Auftragszahl/Termin werden gezeigt; Risiko, Kapazität, Verlauf,
Details, Druck, Capture und Prozessmutation werden nicht vorgetäuscht.

## Aktueller Schemaabgleich

Der maschinenlesbare Abgleich gegen den sanitisierten Produkt-Snapshot liefert
nach Entfernen der falschen lokalen Tabellen-/Spaltendeklarationen genau drei
reale W1-Abweichungen.

| Erreichbarer Konsument | Remote-Ist | Entscheidung | Welle | Test/Gate |
| --- | --- | --- | --- | --- |
| Prozess-Receipt `events.client_event_id` | Spalte fehlt | `KEEP + ADDITIVE_FIX` | W1 | Prozess bleibt geschlossen bis Receipt/Retries bewiesen sind |
| PIN-/Audit-Receipt `audit_log.tenant_id` | Spalte fehlt | `KEEP + ADDITIVE_FIX` | W1 | Audit-Schreibpfad bleibt geschlossen |
| PIN-/Audit-Receipt `audit_log.client_request_id` | Spalte fehlt | `KEEP + ADDITIVE_FIX` | W1 | Audit-Schreibpfad bleibt geschlossen |
| `inquiries.converted_to_customer_id` | lokale Behauptung, kein aktiver Konsument | `DROP_AS_FALSE_TRUTH` | — | keine Produktmigration |
| `inquiries.converted_to_order_id` | lokale Behauptung, kein aktiver Konsument | `DROP_AS_FALSE_TRUTH` | — | keine Produktmigration |
| `qs` | lokale Paralleltabelle, kein aktiver Konsument | `DROP_AS_FALSE_TRUTH` | — | keine Produktmigration |
| `lager_artikel` | lokale Paralleltabelle, kein aktiver Konsument | `DROP_AS_FALSE_TRUTH` | — | keine Produktmigration |

Die ausführbare Prüfung ist `scripts/verify-product-schema-contract.ts`. Sie
prüft Relation/Spalten gegen den Produkt-Snapshot, aber ausdrücklich nicht
RLS, ACLs, Views, RPCs, Storage oder Route-Reichbarkeit; diese Grenzen werden
separat durch den Boundary-Check und W3 behandelt.

## Historischer „116 Mismatches“-Hinweis

Die Zahl 116 stammt aus einer früheren, nicht als kanonische Eingabematrix
eingecheckten Analyse. Für die einzelnen 116 Namen, Konsumenten und
Remote-Objekte existiert im kanonischen Quellstand kein reproduzierbares,
zielgebundenes Artefakt. Es wäre deshalb eine neue Scheinwahrheit, sie zu
erraten oder als erledigt zu markieren.

Entscheidung: `PROTECTED_BACKLOG`, nicht „vergessen“. Alle heute erreichbaren
Pfade sind durch die vorliegende Route-/Action-/Browser-Boundary geschützt.
Eine spätere Reaktivierung muss einen einzelnen, zielgebundenen Vertrag
`Konsument → Relation/View/RPC/Storage → Feld/Policy → Remote-Ist → Test`
einführen; sie darf den historischen Zähler weder übernehmen noch reduzieren,
ohne den jeweiligen Nachweis zu speichern.

## Abhängigkeits-DAG

```text
W1 additive Receipt-Spalten
  → W2 nur bei belegtem Backfill-Bedarf
  → W3 Actor/Tenant/RLS/ACL/View/Storage-Entscheidungen
  → Vertikalschnitt: Serveraktion → Mutation → Receipt → Readback → Reload → Retry → Negativfall
  → W4 Entfernung von Altverträgen nach Beweis
```

W1 verändert keine RLS-Policy, Grant, View, Storage-Regel oder Bestandszeile.
W3 darf nicht durch eine pauschale `USING (true)`-Policy, ein neues
Browser-Transportmodul oder ein generisches `supabase db push` ersetzt werden.

## Gegenwärtige Blocker

1. W1 benötigt ein isoliertes Labor mit kanonischem Migrationsrunner und
   anschließend eine einzelne explizite Produktfreigabe.
2. W3 ist nach aktuellem Produktkatalog nicht entscheidungsreif; die genaue
   Relation-, Policy-, View- und Storage-Inventur steht in
   `W3_AUTH_RLS_DISCOVERY_MANIFEST.md`.
3. Der lokale Reparatur-Baseline-Commit `f59f1ce` hat seinen nicht umgangenen
   Pre-Commit-Gate bestanden. Der Voll-Lint des gesamten historischen Baums
   bleibt dennoch rot und ist ein separater Release-Blocker; kein Hook wird
   umgangen.

Solange diese Punkte offen sind, bleibt der Status `NO_GO — REPAIR_CONTINUES`.
